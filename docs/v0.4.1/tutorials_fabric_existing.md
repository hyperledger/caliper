---
layout: v0.4.1
title:  "Setting up and Running a Performance Benchmark on an existing network"
categories: 
permalink: /v0.4.1/fabric-tutorial/tutorials-fabric-existing/
order: 
---
## Table of Contents
{:.no_toc}

- TOC
{:toc}

## Overview
This tutorial takes you through performance testing a smart contract on a pre-existing Fabric network using Caliper. 

To complete this tutorial you will need to have installed NodeJS. To do this, we recommend using [nvm](https://github.com/nvm-sh/nvm).

This tutorial is based on resources available from the official [Hyperledger Fabric documentation](https://hyperledger-fabric.readthedocs.io/en/release-2.2/tutorials.html). A network comprised of two organizations and a solo orderer, with the javascript `asset-transfer-basic` smart contract, is assumed to be built and ready to performance test. 

> The following command list is a minimalist quick step guide to get the required Fabric network up and running. __We use available Hyperledger Fabric resources at explicit levels. To understand and troubleshoot what occurs during the creation of the test network, please refer to the Fabric documentation linked above!__

```bash
# Clone a fixed version of the Hyperledger Fabric samples repo
git clone https://github.com/hyperledger/fabric-samples.git
cd fabric-samples
git checkout 22393b629bcac7f7807cc6998aa44e06ecc77426
# Install the Fabric tools and add them to PATH
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.2.0 1.4.8 -s
export PATH=$PATH:$(pwd)/bin
# Create and initialize the network
cd test-network
./network.sh up createChannel
./network.sh deployCC -ccn basic -ccl javascript
```

## Step 1 - Create a Caliper Workspace
Create a folder named **caliper-workspace** at the same level as the **fabric-samples** directory, and then within the **caliper-workspace** folder, create three folders named **networks**, **benchmarks**, and **workload** respectively

Caliper installation and use will be based on a local npm installation. Within the **caliper-workspace** directory, install caliper CLI using the following terminal command:

`npm install --only=prod @hyperledger/caliper-cli@0.4.0`

Bind the SDK using the following terminal command:

`npx caliper bind --caliper-bind-sut fabric:2.1`

Further information relating to the installation and binding of Caliper may be found within the relevant [documentation pages](./Installing_Caliper.md).

Caliper requires two configuration files:
- The network configuration file, which describes the network under test and provides the test identities to use. 
- The benchmark file, which defines the performance test to be completed via a sequenced set of test rounds, each specifying a workload module and a series of options to drive the workload over a time interval. 

We will now populate these folders with the assets required by Caliper. 

## Step 2 - Build a Network Configuration File
The network configuration file is the file required by Caliper workers to create a connection to the existing Fabric network so that they may submit transactions. It resembles the Fabric common connection profile, augmented with additional required fields. The file can be in YAML or JSON format, this tutorial shows the JSON format. 

### Create a Template Network Configuration File
Under the **networks** folder create a template file called **networkConfig.json** with the following content:
``` json
{
    "version" : "1.0",
    "name": "Caliper test",
    "caliper" : {
        "blockchain": "fabric"
    },
    "clients" : {
    },
    "channels" : {
    },
    "organizations" : {
    },
    "peers" : {
    }
}
```
__version__: The version of the configuration file being used. Only "1.0" is accepted.

__name__: The name for the configuration, in this instance "Caliper test".

__caliper__: Indicates to Caliper the SUT that is being targeted, and may contain additional start/end commands that are not required within this tutorial. For the purposes of this tutorial, we are targeting a `fabric` network.

__clients__: Lists the identities to be used within the performance test

__channels__: Describes the Hyperledger Fabric channels available, their state, and the smart contracts deployed on these channels

__organizations__: The Hyperledger Fabric organizations that are to be used within the benchmarking

__peers__: The Hyperledger Fabric peers that are to be used within the benchmarking

### Populating The Template File
Following the test-network tutorial, a Common Connection Profile (CCP) is generated; we will use this file to help populate the Hyperledger Fabric specific elements of the Caliper network configuration file. The template will have some unique certificates for the Hyperledger Fabric network that was created, therefore you will notice differences to contents shown in subsequent stages; it is essential that you use the certificates created for interaction with the test-network you wish to target.

We will be using Org1 to connect in this example. To find the generated JSON or YAML CCP files, look in **fabric-samples** -> **test-network** -> **organizations** -> **peerOrganizations** -> **org1.example.com**. We assume use of the json CCP **connection-org1.json**. 

#### Organizations and Peers
These are populated using the contents of the CCP:
1. Copy the `organizations` and `peers` elements of the CCP into the Caliper network configuration file. 
2. Within the `organizations.Org1` object, delete the `certificateAuthorities` listing. This is done for two reasons:
    
    i) We will not be using the certificate authority to register or enrol

    ii) There has been a breaking change delivered to the CCP that is incompatible with the validator Caliper applies to the configuration files.

Your Caliper network configuration file should now look similar to this:
``` json
{
    "version" : "1.0",
    "name": "Caliper test",
    "caliper" : {
        "blockchain": "fabric"
    },
    "clients" : {
    },
    "channels" : {
    },
    "organizations": {
        "Org1": {
            "mspid": "Org1MSP",
            "peers": [
                "peer0.org1.example.com"
            ]
        }
    },
    "peers": {
        "peer0.org1.example.com": {
            "url": "grpcs://localhost:7051",
            "tlsCACerts": {
                "pem": "-----BEGIN CERTIFICATE-----<UNIQUE CONTENT>-----END CERTIFICATE-----\n"
            },
            "grpcOptions": {
                "ssl-target-name-override": "peer0.org1.example.com",
                "hostnameOverride": "peer0.org1.example.com"
            }
        }
    }
}
```

#### Clients
Specify the identities to be used by Caliper when performing the benchmark. Identities *must* be valid, meaning they must be known to the Fabric network and have the corresponding crypto material for use. Identities are listed within a `clients` stanza. Here we use the single identity `Admin@org1.example.com`, within which we nest the `client` object from the CCP to indicate the organization to which the identity belongs and provide basic connection timeout information. 

```json
"clients": {
    "Admin@org1.example.com": {
        "client": {
            "organization": "Org1",
            "connection": {
                "timeout": {
                    "peer": {
                        "endorser": "300"
                    }
                }
            }
        }
    }
}
```

Under the `client` object add a property called `credentialStore` under this property add a property called `path` that has a string variable leading to a temp file in the workspace with the name `/tmp/org1`. Also under the `credentialStore` property add a property called `cryptoStore` and under this add another `path` property that points to the same temp file above, `/tmp/org1`. 

This is what should be added to the `client` : 

```json
"credentialStore": {
    "path": "/tmp/org1",
    "cryptoStore": {
        "path": "/tmp/org1"
    }
}
```

Under the `client` object add a property called `clientPrivateKey` under this property add a property called `path` that has a string variable leading to the private key of the identity. Note that the provided path is workspace relative. In this example the private key is located at **fabric-samples** -> **test-network** -> **organizations** -> **peerOrganizations** -> **org1.example.com** -> **users** -> **Admin@org1.example.com** -> **msp** -> **keystore** -> **priv_sk** .

This is what should be added to the `client` object:

```json
"clientPrivateKey": {
    "path": "../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/priv_sk"
}
```

Also under the `client` object add another property called `clientSignedCert` and under this add a property called `path` that has a string variable leading to the signed certificate of the identity. Again note that the provided path is workspace relative. In this example it is located at **fabric-samples** -> **test-network** -> **organizations** -> **peerOrganizations** -> **org1.example.com** -> **users** -> **Admin@org1.example.com** -> **msp** -> **signedcerts** -> **admin@org1.example.com-cert.pem**

This is what should be added to the `client` object:

```json
"clientSignedCert": {
    "path": "../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem"
}
```

The `clients` object should now look like this: 

```json
    "clients": {
        "Admin@org1.example.com": {
            "client": {
                "organization": "Org1",
                "connection": {
                    "timeout": {
                        "peer": {
                            "endorser": "300"
                        }
                    }
                },
                "credentialStore": {
                    "path": "tmp/hfc-kvs/org1",
                    "cryptoStore": {
                        "path": "tmp/hfc-kvs/org1"
                    }
                },
                "clientPrivateKey": {
                    "path": "../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/priv_sk"
                },
                "clientSignedCert": {
                    "path": "../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem"
                }
            }
        }
    }
```

#### Channels Object
The Fabric connector for Caliper requires assistance when creating connections to a Fabric network. A `channels` object must be provided that lists the smart contracts that may be interacted with.

Add the known channel, `mychannel`, that was created by the `test-network` into the `channels` section of the Caliper network configuration file and give it the property `created` with a boolean value of true. We must list the smart contracts available on this channel as objects within an array named `contracts`. Each smart contract object has two properties, `id` and `version`. `id` specifies contract ID; in this case it is `basic`. The version is the specific contract version; in this case it is `1.0.0`. Add this as an object within the array such that the resulting `channels` object within the Caliper network configuration file becomes:

```json
    "channels": {
        "mychannel": {
            "created" : true,
            "contracts": [
                {
                    "id":"basic",
                    "version":"1.0.0"
                }
            ]
        }
    }
```

### The Complete Network Configuration File
The Caliper network configuration file should now be fully populated. It can be useful to take time to look over and ensure that the paths to the certificates and keys are correct. 

```json
{
    "version" : "1.0",
    "name": "Caliper test",
    "caliper" : {
        "blockchain": "fabric"
    },
    "clients": {
        "Admin@org1.example.com": {
            "client": {
                "credentialStore": {
                    "path": "/tmp/org1",
                    "cryptoStore": {
                        "path": "/tmp/org1"
                    }
                },
                "organization": "Org1",
                "clientPrivateKey": {
                    "path": "../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/priv_sk"
                },
                "clientSignedCert": {
                    "path": "../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem"
                },
                "connection": {
                    "timeout": {
                        "peer": {
                            "endorser": "300"
                        }
                    }
                }

            }
        }
    },
    "channels": {
        "mychannel": {
            "created" : true,
            "contracts": [
                {
                    "id":"basic",
                    "version":"1.0.0"
                }
            ]
        }
    },
    "organizations":{
        "Org1": {
            "mspid": "Org1MSP",
            "peers": [
                "peer0.org1.example.com"
            ]
        }
    },
    "peers": {
        "peer0.org1.example.com": {
            "url": "grpcs://localhost:7051",
            "tlsCACerts": {
                "pem": "-----BEGIN CERTIFICATE-----\n<UNIQUE CONTENT>\n-----END CERTIFICATE-----\n"
            },
            "grpcOptions": {
                "ssl-target-name-override": "peer0.org1.example.com",
                "hostnameOverride": "peer0.org1.example.com"
            }
        }
    }
}
```

## Step 3 - Build a Test Workload Module
The workload module interacts with the deployed smart contract during the benchmark round. The workload module extends the Caliper class `WorkloadModuleBase` from `caliper-core`. The workload module provides three overrides: 
- `initializeWorkloadModule` - used to initialize any required items for the benchmark
- `submitTransaction` - used to interact with the smart contract method during the monitored phase of the benchmark
- `cleanupWorkloadModule` - used to clean up after the completion of the benchmark

For more information, please see the specific documentation on `Workload Configuration` accessible on the left hand menu.

The workload we will be driving aims to benchmark the querying of existing assets within the world state database. Consequently we will use all three phases available in the workload module:
- `initializeWorkloadModule` - to create assets that may be queried in the `submitTransaction` phase
- `submitTransaction` - to query assets created in the `initializeWorkloadModule` phase
- `cleanupWorkloadModule` - used to remove assets created in the `initializeWorkloadModule` phase so that the benchmark may be repeated

### Create A Template Workload Module
Within the **workload** folder create a file called **readAsset.js** with the following content: 

``` js
'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class MyWorkload extends WorkloadModuleBase {
    constructor() {
        super();
    }
    
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
    }
    
    async submitTransaction() {
        // NOOP
    }
    
    async cleanupWorkloadModule() {
        // NOOP
    }
}

function createWorkloadModule() {
    return new MyWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
```

### Populating the Template File
When we populate this file we make reference to the available methods within the deployed smart contract **assetTransfer.js** file that can be found in: **fabric-samples** -> **asset-transfer-basic** -> **chaincode-javascript** -> **lib** -> **assetTransfer.js**

#### Populate initializeWorkloadModule
This method is used to prepare any items required by the primary `submitTransaction` method as the benchmark completes. 

The number of assets to be created will be given as `roundArguments.assets`. We create assets using the smart contract by populating an arguments object, which defines the transaction body, and using the Caliper API `sendRequests`, which requires knowledge of:
- contractId, the name of smart contract that is to be used and is present within the Caliper network configuration file
- contractFunction, the specific function within the smart contract to invoke
- contractArguments, the arguments to pass to the smart contract function
- invokerIdentity, the identity to use that is present within the Caliper network configuration file
- readOnly, if performing a query operation or not

The method should look like this:
```js
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        for (let i=0; i<this.roundArguments.assets; i++) {
            const assetID = `${this.workerIndex}_${i}`;
            console.log(`Worker ${this.workerIndex}: Creating asset ${assetID}`);
            const request = {
                contractId: this.roundArguments.contractId,
                contractFunction: 'CreateAsset',
                invokerIdentity: 'Admin@org1.example.com',
                contractArguments: [assetID,'blue','20','penguin','500'],
                readOnly: false
            };

            await this.sutAdapter.sendRequests(request);
        }
    }
```

In the above example, different assets will be created that have the same parameters (blue, 20, penguin, 500). Comparing the above to the smart contract method itself, it should be evident that there is a 1:1 mapping of contract arguments to the method parameters.

#### Populate submitTransaction
This method runs repeatedly in the benchmark test phase. We will be evaluating the `ReadAsset` smart contract method by querying the assets we created in the `initializeWorkloadModule` method. 

First, create a string identity for the asset to query, formed by the concatenation of the worker index and a random integer between 0 and the number of created assets. 

Then await the call on `sendRequests`, passing an object containing: `contractId` set as that passed in from the round arguments; `contractFunction` set as `ReadAsset`; `invokerIdentity` set as `admin@org1.example.com`; and `chaincodeArguments` set as an array that contains the asset to query in this run. 

The method should look like this:
```js
    async submitTransaction() {
        const randomId = Math.floor(Math.random()*this.roundArguments.assets);
        const myArgs = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'ReadAsset',
            invokerIdentity: 'Admin@org1.example.com',
            contractArguments: [`${this.workerIndex}_${randomId}`],
            readOnly: true
        };

        await this.sutAdapter.sendRequests(myArgs);
    } 
```

#### Populate cleanupWorkloadModule
This function is used to clean up after a test as it deletes the assets created in the `initializeWorkloadModule` function though use of the smart contract function `DeleteAsset`. The implementation is similar to that within `initializeWorkloadModule`. Note it is possible to refactor both `initializeWorkloadModule` and `cleanupWorkloadModule` to utilize a common method that performs the create/delete action, this is left to the interested reader.

```js
   async cleanupWorkloadModule() {
        for (let i=0; i<this.roundArguments.assets; i++) {
            const assetID = `${this.workerIndex}_${i}`;
            console.log(`Worker ${this.workerIndex}: Deleting asset ${assetID}`);
            const request = {
                contractId: this.roundArguments.contractId,
                contractFunction: 'DeleteAsset',
                invokerIdentity: 'Admin@org1.example.com',
                contractArguments: [assetID],
                readOnly: false
            };

            await this.sutAdapter.sendRequests(request);
        }
    }
```

### The Complete Workload Module
The test callback file should now be fully populated:

```js
'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class MyWorkload extends WorkloadModuleBase {
    constructor() {
        super();
    }
    
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        for (let i=0; i<this.roundArguments.assets; i++) {
            const assetID = `${this.workerIndex}_${i}`;
            console.log(`Worker ${this.workerIndex}: Creating asset ${assetID}`);
            const request = {
                contractId: this.roundArguments.contractId,
                contractFunction: 'CreateAsset',
                invokerIdentity: 'Admin@org1.example.com',
                contractArguments: [assetID,'blue','20','penguin','500'],
                readOnly: false
            };

            await this.sutAdapter.sendRequests(request);
        }
    }
    
    async submitTransaction() {
        const randomId = Math.floor(Math.random()*this.roundArguments.assets);
        const myArgs = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'ReadAsset',
            invokerIdentity: 'Admin@org1.example.com',
            contractArguments: [`${this.workerIndex}_${randomId}`],
            readOnly: true
        };

        await this.sutAdapter.sendRequests(myArgs);
    }
    
    async cleanupWorkloadModule() {
        for (let i=0; i<this.roundArguments.assets; i++) {
            const assetID = `${this.workerIndex}_${i}`;
            console.log(`Worker ${this.workerIndex}: Deleting asset ${assetID}`);
            const request = {
                contractId: this.roundArguments.contractId,
                contractFunction: 'DeleteAsset',
                invokerIdentity: 'Admin@org1.example.com',
                contractArguments: [assetID],
                readOnly: false
            };

            await this.sutAdapter.sendRequests(request);
        }
    }
}

function createWorkloadModule() {
    return new MyWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
```

## Step 4 - Build a Benchmark Configuration File
The benchmark configuration file defines the benchmark rounds and references the defined workload module(s). It will specify the number of test workers to use when generating the load, the number of test rounds, the duration of each round, the rate control applied to the transaction load during each round, and options relating to monitors. This particular tutorial will not make use of any of the available monitors or transaction observers; for these details please refer to the documentation.

The benchmark configuration file may be provided in a yaml or json format: here we will use a yaml format. Please note that yaml files are case sensitive and all labels are in lowercase. 

The benchmark configuration file has a single required stanza:

``` bash
test:
```

### Create A Template Benchmark Configuration File

Under the **benchmarks** folder create a file called **myAssetBenchmark.yaml** with the following content:

```yaml
test:
    name: basic-contract-benchmark
    description: A test benchmark
    workers:
    rounds:
```

__test__: The root level block that contains the benchmark test information.

__name__: The name of the test, in this case "basic-contract-benchmark".

__description__: A description for the benchmark, in this case "A test benchmark".

__workers__: A set of keys used to define the number of workers (separate worker client instances) used in the subsequent benchmark.

__rounds__: An array of distinct test rounds that will be progressed sequentially. Rounds may be used to benchmark different smart contract methods, or the same method in a different manner. 

### Populating the Template File
We will now populate the template file to specify the number of workers and the test round that uses the workload module we have created.

#### Populate Workers
We will be using two separate workers, this is accomplished through the workers specification:

``` yaml
  type: local
  number: 2
```

#### Populate Rounds
Each `round` block contains the following: 
- `label` - the unique header label to use for the round.
- `description` - a description of the round being run.
- `txDuration` - the specification of the test duration, in seconds
- `rateControl` - a rate control type, with options. 
- `workload` - the workload module to use, with arguments to pass to the module. All arguments passed are available as `roundArguments` within the workload module.

We will specify a benchmark round labeled `readAsset`, with the description `Query asset benchmark`, to run for a 30s duration, using a `fixed-load` rate controller aiming to maintain a constant transaction pressure of 2. Additionally we will be providing a workload through specification of our `readAsset.js` workload file, which we will pass the arguments `{assets: 10, contractId: asset-transfer-basic}`.

The above is accomplished through the round specification:

``` yaml
    - label: readAsset
      description: Read asset benchmark
      txDuration: 30
      rateControl: 
        type: fixed-load
        opts:
          transactionLoad: 2
      workload:
        module: workload/readAsset.js
        arguments:
          assets: 10
          contractId: basic
```

### The Complete Benchmark Configuration File
The benchmark configuration file should now be fully populated:

```yaml
test:
    name: basic-contract-benchmark
    description: test benchmark
    workers:
      type: local
      number: 2
    rounds:
      - label: readAsset
        description: Read asset benchmark
        txDuration: 30
        rateControl: 
          type: fixed-load
          opts:
            transactionLoad: 2
        workload:
          module: workload/readAsset.js
          arguments:
            assets: 10
            contractId: basic
```

## Step 5 - Run the Caliper Benchmark
We are now ready to run the performance benchmark using the above configuration files and test module. The performance benchmark will be run using the Caliper CLI, which will need to be supplied a path to the workspace and workspace relative paths to the network configuration file and the benchmark configuration file. This information is provided with the flags `--caliper-workspace`, `--caliper-networkconfig`, and `--caliper-benchconfig` respectively.

Since the smart contract has already been installed and instantiated, Caliper only needs to perform the test phase. This is specified by using the flag `--caliper-flow-only-test`.

Since the target network has discovery enabled, we may use this feature through use of a Hyperledger Fabric gateway by using the flags `--caliper-fabric-gateway-enabled` and `--caliper-fabric-gateway-discovery`.

### Run the command
Ensure that you are in the **caliper-workspace** directory. 

In the terminal run the following Caliper CLI command:

`npx caliper launch manager --caliper-workspace ./ --caliper-networkconfig networks/networkConfig.json --caliper-benchconfig benchmarks/myAssetBenchmark.yaml --caliper-flow-only-test --caliper-fabric-gateway-enabled --caliper-fabric-gateway-discovery`

### Benchmark Results
The resulting report will detail the following items for each benchmark round:

- Name - the round name from the benchmark configuration file
- Succ/Fail - the number of successful/failing transactions
- Send Rate - the rate at which caliper issued the transactions
- Latency (max/min/avg) - statistics relating to the time taken in seconds between issuing a transaction and receiving a response
- Throughput - the average number of transactions processed per second

You have successfully benchmarked a smart contract. You can repeat the test varying the benchmark parameters, as well as adding resource monitors. For the full set of options, please refer to the [Caliper Documentation](https://hyperledger.github.io/caliper/)

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.