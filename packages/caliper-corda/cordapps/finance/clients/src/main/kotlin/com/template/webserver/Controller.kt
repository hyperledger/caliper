package com.template.webserver

import net.corda.core.messaging.startFlow
import net.corda.core.utilities.OpaqueBytes
import net.corda.core.utilities.getOrThrow
import net.corda.finance.DOLLARS
import net.corda.finance.flows.CashIssueFlow
import org.json.simple.JSONArray
import org.json.simple.JSONObject
import org.slf4j.LoggerFactory
import org.springframework.web.bind.annotation.*
import kotlin.math.max

/**
 * Define your API endpoints here.
 */
@RestController
@RequestMapping("/") // The paths for HTTP requests are relative to this base path.
class Controller(rpc: NodeRPCConnection) {

    companion object {
        private val logger = LoggerFactory.getLogger(RestController::class.java)
    }

    private val proxy = rpc.proxy
    private val notaries = proxy.notaryIdentities();
    private val issueRef = OpaqueBytes.of(Byte.MAX_VALUE);
    private val notary = notaries.get(0)
    private val issueAmount = 1_000.DOLLARS;

    @GetMapping(value = "/connectionStatus", produces = arrayOf("text/plain"))
    private fun connectionStatus(): String {
        return "{ \"status\" : up }"
    }

    @GetMapping(value = "/transactionsHistory", produces = arrayOf("text/plain"))
    private fun transactionsHistory(): String {
        return proxy.stateMachineRecordedTransactionMappingSnapshot().toString()
    }

    @GetMapping(value = ["/startCashIssueFlow"], produces = ["text/plain"])
    @ResponseBody
    private fun startFlow(@RequestParam("nTX") nTX: Int, @RequestParam("batch") batch: Int,
                          @RequestParam("sendingrate") sendingrate: Int): String {
        // batch = nThreads
        var min: Long = 99999999999
        var max: Long = 0
        var time_btw = 1e9 / sendingrate
        var sum: Long = 0
        var end = ArrayList<Long>(nTX)
        var threads = ArrayList<Thread>(batch)
        var success = 0
        var start = System.nanoTime()
        for (j in 0..batch) {
            val thread = Thread {
                for (i in 0..(nTX/batch) {
                    val start = System.nanoTime()
                    val flow = proxy.startFlow(::CashIssueFlow, issueAmount, issueRef, notary).returnValue.getOrThrow();
                    success++;
                    end.add(System.nanoTime() - start)
                    Thread.sleep(max(0.0, (time_btw - (System.nanoTime() - start)) / 1e6).toLong())
                }
            }
            threads.add(thread)
        }
        for (j in 0..batch) {
            thread[j].start()
            if (j == batch - 1) {
                thread.join()
            }
        }

        var total = System.nanoTime() - start
        // compute max, min resp time
        for (i in 0..nTX) {
            sum += end[i]
            if (end[i] < min) {
                min = end[i]
            }
            if (end[i] > max) {
                max = end[i]
            }
        }
        // compute all metrics and convert them into JSON
        var avg_resp_time = sum / nTX.toLong()
        var expected_resp_time = total / nTX.toLong() / 1e9;
        var obj_array = JSONObject()
        // used for input params has reminder
        var inp = JSONObject()
        inp.put("nTX_sent", nTX); inp.put("nThreads", batch); inp.put("sending_rate", sendingrate)
        // used for the output measurements that we are interested in
        var out = JSONObject()
        out.put("throughput", 1.0 / expected_resp_time); out.put("avg_resp_time", avg_resp_time);
        out.put("max_resp_time", max); out.put("min_resp_time", min); out.put("simulation_time", total);
        out.put("success", nTX); out.put("fail", nTX - nTX)
        // used for metrics info
        var info = JSONObject(); info.put("throughput", "tps"); info.put("time", "ns")
        // link the four json objects into main
        obj_array.put("input_params", inp);
        obj_array.put("output_params", out);
        obj_array.put("metrics", info)
        return obj_array.toJSONString();

    }


}
