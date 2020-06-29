---
layout: vNext
title:  "Writing Connectors"
categories: reference
permalink: /vNext/writing-connectors/
order: 2
---

## How to write your own blockchain connector
Connectors are used to connect and interact with a target SUT. Caliper requires all connectors to extend the class [`BlockchainConnector`](https://github.com/hyperledger/caliper/blob/master/packages/caliper-core/lib/common/core/blockchain-connector.js),

```javascript
    'use strict';

    /**
     * Base class for all blockchain connectors
     */
    class BlockchainConnector {

        /**
         * Constructor
         * @param {number} workerIndex The zero based worker index
         * @param {string} bcType The target SUT type
         */
        constructor(workerIndex, bcType) {
            this.workerIndex = workerIndex;
            this.bcType = bcType;
        }

        getType() {
            return this.bcType;
        }

        getWorkerIndex() {
            return this.workerIndex;
        }

        async init(workerInit) {
            throw new Error('init is not implemented for this blockchain connector');
        }

        async installSmartContract() {
            throw new Error('installSmartContract is not implemented for this blockchain connector');
        }

        async getContext(name, args) {
            throw new Error('getContext is not implemented for this blockchain connector');
        }

        async releaseContext(context) {
            throw new Error('releaseContext is not implemented for this blockchain connector');
        }

        async invokeSmartContract(context, contractID, contractVer, args, timeout) {
            throw new Error('invokeSmartContract is not implemented for this blockchain connector');
        }

        async querySmartContract(context, contractID, contractVer, args, timeout) {
            throw new Error('querySmartContract is not implemented for this blockchain connector');
        }

        async queryState(context, contractID, contractVer, key, fcn) {
            throw new Error('queryState is not implemented for this blockchain connector');
        }

    }

    module.exports = BlockchainConnector;
```

The connector must provide concrete implementations of the methods that are intended to be used by the connector:
- init. Used to initialize the connector and the SUT
- installSmartContract. Used to perform the installation of contracts present in the network configuration file
- getContext. Used to conditionally initialize and return the context used by a workload module
- releaseContext. Used to release the context used by a workload module
- invokeSmartContract. Used within a workload module to invoke a transaction through the connector to the target SUT, using passed arguments
- querySmartContract. Used within a workload module to query the target SUT using passed arguments via the connector
- queryState. Used within a workload module to query the target SUT via the connector

The above methods are called at key phases within the lifecycle of Caliper of a Caliper test. Unrequired methods should be overridden with `Promise.resolve()` to prevent Caliper lifecycle errors.

Each connector exists as a distinct package within the Caliper repository, and these packages are made accessible to Caliper via the internal core function `getBuiltinConnectorPackageNames` within `caliper-core/lib/common/utils/caliper-utils.js`

```javascript
    /**
     * Get the mapping of simple builtin connector names to fully qualified package names.
     * @return {Map<string, string>} The mapping from simple names to package names.
     */
    static getBuiltinConnectorPackageNames() {
        return new Map([
            ['burrow', '@hyperledger/caliper-burrow'],
            ['ethereum', '@hyperledger/caliper-ethereum'],
            ['fabric', '@hyperledger/caliper-fabric'],
            ['fisco-bcos', '@hyperledger/caliper-fisco-bcos'],
            ['iroha', '@hyperledger/caliper-iroha'],
            ['sawtooth', '@hyperledger/caliper-sawtooth']
        ]);
    }
```

Connectors are exposed by connector-factories that are used to create instances of the connector class for use by Caliper master and worker processes.

```javascript
    'use strict';

    const MyBlockchainConnector = require('./myblockchain-connector');

    /**
     * Constructs a MyBlockchain connector.
     * @param {number} workerIndex The zero-based index of the worker who wants to create an adapter connector. -1 for the master process.
     * @return {Promise<BlockchainConnector>} The initialized connector instance.
     * @async
     */
    async function connectorFactory(workerIndex) {
        return new MyBlockchain(workerIndex, 'myblockchain');
    }

    module.exports.ConnectorFactory = connectorFactory;
```

### Steps
To create a new connector:
- Create a new package for your connector
- Within the package, create a connector that extends `BlockchainConnector` and provides implementations for the internal functions
- Within the package, create a connector factory that may be used to generate instances of your connector
- Update `getBuiltinConnectorPackageNames` within `caliper-core/lib/common/utils/caliper-utils.js` to include the new connector

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.
