## Design document for integrating block event listener as a separate process into caliper

### Goal
* Split the caliper process into sender and listener.
Current version of the caliper relies on a single threaded process to send the transactions as well as listen for the transaction confirmation event. This can cause an issue for clients with higher send rates since node.js is itself a single threaded. The callback of the eventhub may get queued in the event loop and hence may result in incorrect confirmation time.

To tacke this issue, caliper can be split into 2 sub processes namely,
* sender who is just responsible for generting the transaction load
* listener which connects to the event peer, listens for the block event, note the timestamp and then publish it to Apache Kafka MQ. 

A persistence layer is required so that after the sender has finished generating the load, it can then consume blocks and associated confirmation time from the Queue and compute the `time_final` property for each transaction.

### changes made to the existing caliper project

* Add a listener module in the root directory of the caliper project.
* Fork the listener process in main.js file of every benchmark.
* Remove the event hub connecton logic In the fabric/e2e_utlis.js file.
* At the end of every round, call a function getTransactionConfirmation(defined in e2e_utils.js) in the local-client.js to fetch the blocks from MQ and update the time_final property for every transaction.
* Kill the listener process in bencch-flow.js


