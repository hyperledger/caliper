package bftsmart.demo.counter;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.util.ArrayList;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

import bftsmart.tom.ServiceProxy;
import bftsmart.tom.util.Logger;

public class CounterBenchmark {

	static ServiceProxy counterProxy;

	public static void main(String[] args) throws IOException, InterruptedException {
		if (args.length < 5) {
			//System.out.println(
					//"Usage: java ...CounterBenchmark <process id> <increment> <number of operations> <sending rate> <benchmarking type>");
			//System.out.println("       if <increment> equals 0 the request will be read-only");
			//System.out.println("Different benchmark types");
			//System.out.println("1. Random operations");
		    	//System.exit(-1);
		}

		int clientId = Integer.parseInt(args[0]);
		int inc = Integer.parseInt(args[1]);
		int nb_TXs = Integer.parseInt(args[2]);
		int sending_rate = Integer.parseInt(args[3]);
		int benchmark_type = Integer.parseInt(args[4]);
		counterProxy = new ServiceProxy(clientId);
		String res = "";
		switch (benchmark_type) {
		case 1:
			res = compute(inc, nb_TXs, sending_rate);
			break;
		}
		System.out.println(res);
		System.exit(1);
	}

	/**
	 * compute the transactions and generate a JSON benchmark report
	 * 
	 * @param operations array
	 * @return Json String
	 * @throws InterruptedException
	 */
	@SuppressWarnings("unchecked")
	public static String compute(int inc, int nb_TXs, int sending_rate) throws InterruptedException {
		ArrayList<Long> response_times = new ArrayList<Long>();
		long sum = 0;
		long s1 = System.nanoTime();
		try {
			Logger.debug = false;

			for (int i = 0; i < nb_TXs; i++) {
				long start = System.nanoTime();
				//System.out.println("Counter sending: " + i);
				incrementCounter(inc);
				long end = System.nanoTime() - start;
				sum += end;
				response_times.add(end);
				Thread.sleep(Long.max(0, (long) (1e3 / sending_rate - end / 1e6)));
			}

			long e1 = System.nanoTime() - s1;
			long min = 999999999, max = 0;
			JSONArray resptimes = new JSONArray();
			// compute max, min resp time
			for (Long l : response_times) {
				if (l < min) {
					min = l;
				}
				if (max < l) {
					max = l;
				}
				resptimes.add(l);
			}
			// compute all metrics and convert them into JSON
			long avg_resp_time = sum / nb_TXs;
			long expected_resp_time = (e1 / nb_TXs);
			JSONObject obj_array = new JSONObject();
			// used for input params has reminder
			JSONObject inp = new JSONObject();
			inp.put("nTX_sent", nb_TXs);
			inp.put("nThreads", 1);
			inp.put("sending_rate", sending_rate);
			// used for the output measurements that we are interested in
			JSONObject out = new JSONObject();
			out.put("throughput", 1e9 / expected_resp_time);
			out.put("avg_resp_time", avg_resp_time);
			out.put("max_resp_time", max);
			out.put("min_resp_time", min);
			out.put("simulation_time", e1);
			out.put("success", nb_TXs);
			out.put("fail", nb_TXs - nb_TXs);
			// used for metrics info
			JSONObject info = new JSONObject();
			info.put("throughput", "tps");
			info.put("time", "ns");
			// link the four json objects into main
			obj_array.put("input_params", inp);
			obj_array.put("output_params", out);
			obj_array.put("measurements", resptimes);
			obj_array.put("metrics", info);
			return obj_array.toJSONString();
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			counterProxy.close();
		}
		return null;
	}

	/**
	 * Method to implement the counter
	 * 
	 * @param inc incrementor
	 * @throws IOException
	 */
	public static void incrementCounter(int inc) throws IOException {

		ByteArrayOutputStream out = new ByteArrayOutputStream(4);
		new DataOutputStream(out).writeInt(inc);
		//int newValue = new DataInputStream(new ByteArrayInputStream(out.toByteArray())).readInt();

		byte[] reply;
		if (inc == 0)
			reply = counterProxy.invokeUnordered(out.toByteArray());
		else
			reply = counterProxy.invokeOrdered(out.toByteArray());
		if (reply != null) {
			int newValue = new DataInputStream(new ByteArrayInputStream(reply)).readInt();
			//System.out.println("Counter value: " + newValue);
		}
	


	}

}
