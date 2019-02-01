# About the Adapters
This folder containers kinds of adapters which will interact with the corresponding backend blockchain.

# How to write your own blockchain adapter
Let's look inside first and learn about how the whole framework interacts with the backend blockchain system.
When the benchmark engine is running, the master process of benchmark engine will call the user defined blockchain class to complete the blockchain's and chaincodes' installation. Then, after the master process launches the corresponding clients, each client will do the test. During the test, the client will get current blockchain's context, run test scripts, release the blockchain's context in the end, and return the performance statistics. Hence, if users intend to test the blockchain system which Caliper is unable to support, the bellows are what the users would concern about.

* Use Blockchain NBI to write your own blockchain Class: Below is a Blockchain interface implementation example.
  ```
    /**
    * Implements {BlockchainInterface} for a myblockchain backend.
    */
    class Myblockchain extends BlockchainInterface{

        /**
    * Create a new instance of the {Myblockchain} class.
    * @param {string} config_path The path of  Myblockchain network configuration file.
    */
        constructor(config_path) {

        }

        /**
        * Initialize the {Myblockchain} object.
        */
        init() {
        ...
        }

        /**
        * Deploy the chaincode specified in the network configuration file to all peers.
        * @return {Myblockchain} resolve
        */
        installSmartContract() {
        ...
        }

        /**
        * Return the Burrow context associated with the given callback module name.
        * @param {string} name The name of the callback module as defined in the configuration files.
        * @param {object} args Unused.
        * @return {object} The assembled Myblockchain context.
        * @async
        */
        getContext(name, args) {
            ...
        }

        /**
        * Release the given Myblockchain context.
        * @param {object} context The Myblockchain context to release.
        * @async
        */
        async releaseContext(context) {
            ...
        }

        /**
    * Invoke a smart contract.
    * @param {Object} context context object
    * @param {String} contractID identity of the contract
    * @param {String} contractVer version of the contract
    * @param {Array} args array of JSON formatted arguments for multiple transactions
    * @param {Number} timeout request timeout, in seconds
    * @return {Promise<object>} the promise for the result of the execution.
    */
        async invokeSmartContract(context, contractID, contractVer, args, timeout) {
            ...
        }

        /**
        * Query the given chaincode according to the specified options.
        * @param {object} context The Myblockchain context returned by {getContext}.
        * @param {string} contractID The name of the chaincode.
        * @param {string} contractVer The version of the chaincode.
        * @param {string} key The argument to pass to the chaincode query.
        * @param {string} [fcn=query] The chaincode query function name.
        * @return {Promise<object>} The promise for the result of the execution.
        */
        async queryState(context, contractID, contractVer, key, fcn = 'query') {
            ...
        }

        /**
    * Get adapter specific transaction statistics.
    * @param {JSON} stats txStatistics object
    * @param {Array} results array of txStatus objects.
    */
        getDefaultTxStats(stats, results) {
            ...
        }
    }
  ```

* Add your own blockchain type into the blockchain's constructor function: In the file `src/comm/blockchain.js`, a new blockchain type should be added into the constructor function.
  ```
    if(config.caliper.blockchain === 'myblockchain') {
        let myblockchain = require('../adapters/myblockchain/myblockchain.js');
        this.bcType = 'myblockchain';
        this.bcObj = new myblockchain(configPath);
    }
  ```
* Add predefined Network files into the directory `network/`:  These files will be useful when Caliper is trying to simulate your blockchain system. Please add all of the related files what a new boot blockchain system needs.
* Add your own network configuration file into the corresponding network folder: Make sure the files that are necessary to boot your blockchain are specified here.
* Define your command which will be excuted before and after the test
* Define your own smart contracts:  As Caliper has several test cases now, it is necessary to realize your own smart contracts according to current test cases, eg. you could provide your smart contracts about opening an account, querying an account, deleting an account and transfering according to the test case `simple`. Your own smart contracts could be put into the directory `src/contract/myblockchain/`.
* Define the installation script: To faciliate other user, an installation script in the file `packeage.json` is appreciated. Your packages and  other dependencies should be added. 
  ```
  "scripts": {
    "myblockchain-deps": "npm install --no-save myblockchainpackage
  }
  ```
If you would like to define your test module, please use Blockchain NBI to write your own test script which should include 3 functions(init(), run()and end()) as the files in the directory `bechmark/simple/open.js` and  `bechmark/simple/query.js`, and change the callback property in the test configuration file into current test script's path.