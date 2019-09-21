package com.template

import net.corda.client.rpc.CordaRPCClient
import net.corda.core.messaging.CordaRPCOps
import net.corda.core.utilities.NetworkHostAndPort.Companion.parse
import net.corda.core.utilities.loggerFor
import net.corda.finance.flows.CashIssueFlow


import net.corda.core.messaging.startFlow
import net.corda.core.utilities.OpaqueBytes
import net.corda.core.utilities.getOrThrow
import net.corda.finance.DOLLARS



/**
 * Connects to a Corda node via RPC and performs RPC operations on the node.
 *
 * The RPC connection is configured using command line arguments.
 */
fun main(args: Array<String>) = Client().main(args)

class Client {

    lateinit var proxy: CordaRPCOps

    companion object {
        val logger = loggerFor<Client>()

    }

    fun startProxy(args: Array<String>){
        // Create an RPC connection to the node.
        require(args.size == 3) { "Usage: Client <node address> <rpc username> <rpc password>" }
        val nodeAddress = parse(args[0])
        val rpcUsername = args[1]
        val rpcPassword = args[2]
        val client = CordaRPCClient(nodeAddress)
        proxy = client.start(rpcUsername, rpcPassword).proxy
    }

    fun startFlow() {
        // Interact with the node.
        // For example, here we print the nodes on the network.
        val nodes = proxy.networkMapSnapshot();

        val notaries = proxy.notaryIdentities();
        val issueRef = OpaqueBytes.of(Byte.MAX_VALUE);

        val issueAmount = 1_000.DOLLARS;
        var sum: Double = 0.0
        val nTX = 1
        for (i in 0..nTX) {
            val start = System.currentTimeMillis()
            val flow = proxy.startFlow(::CashIssueFlow, issueAmount, issueRef, notaries.get(0)).returnValue.getOrThrow();
            val end = System.currentTimeMillis() - start
            sum = sum.plus(end.toDouble())
            logger.info("{}", flow)
        }
        /**
            val meanTime = (sum/nTX/1000)
            logger.info("{}", "Throughput " + 1.0/meanTime)
        */
    }

    fun main(args: Array<String>) {
        // Create an RPC connection to the node.
        require(args.size == 3) { "Usage: Client <node address> <rpc username> <rpc password>" }
        val nodeAddress = parse(args[0])
        val rpcUsername = args[1]
        val rpcPassword = args[2]
        val client = CordaRPCClient(nodeAddress)
        val proxy = client.start(rpcUsername, rpcPassword).proxy

        // Interact with the node.
        // For example, here we print the nodes on the network.
        val nodes = proxy.networkMapSnapshot();

        val notaries = proxy.notaryIdentities();
        val issueRef = OpaqueBytes.of(Byte.MAX_VALUE);

        val issueAmount = 1_000.DOLLARS;
        var sum: Double = 0.0
        val nTX = 1000
        for (i in 0..nTX) {
            val start = System.currentTimeMillis()
            val flow = proxy.startFlow(::CashIssueFlow, issueAmount, issueRef, notaries.get(0)).returnValue.getOrThrow();
            val end = System.currentTimeMillis() - start
            sum = sum.plus(end.toDouble())
            logger.info("{}", end)
        }
        val meanTime = (sum/nTX/1000)
        logger.info("{}", "Throughput " + 1.0/meanTime)

    }
}