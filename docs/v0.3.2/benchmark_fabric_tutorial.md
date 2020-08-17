---
layout: v0.3.2
title:  "Setting up and Running a Performance Benchmark on an existing network"
categories: 
permalink: /v0.3.2/benchmark-fabric-tutorial/
order: 
---
## Table of Contents
{:.no_toc}

- TOC
{:toc}

## Overview

This tutorial takes you through performance testing a smart contract on a pre-existing Fabric network using Caliper. 

You will need to already have a fabric network deployed. This tutorial follows from this [fabric tutorial](https://hlf.readthedocs.io/en/latest/test_network.html) but you can follow from any Fabric network. You need to have initiated a smart contract (part two of the Fabric tutorial). 


## Step 1 - Install and Bind Caliper

Globally install caliper CLI using the following terminal command:

`npm install -g --only=prod @hyperledger/caliper-cli@0.3.2`

Bind the SDK using the following terminal command:

`caliper bind --caliper-bind-sut fabric:1.4.8 --caliper-bind-args=-g`

## Step 2 - Setting Up Folders

Caliper needs two configuration files:
- The network configuration file that will describe the network and will provide the connection requirements. 
- The benchmark file which will have the callback and the references for the user test files. 

First set up a parent folder named **caliper-workspace** and then within this folder create two subfolders named **networks** and **benchmarks**

We will then populate these folders with the assets required by Caliper. 

## Step 3 - Network Configuration File

The network configuration file is an extension of the common connection profile and provides the connection requirements for clients that interact with the network. The file can be in YAML or JSON format, this tutorial shows the JSON format. 

### Create File

Under the **networks** folder create a file called **network_config.json**. That is the file we will be populating. 

This is the shape of the file before population. The file is made up of eight objects: caliper, clients, channels, name, organization, peers, certificateAuthorities, and version. Each of these we will be adding properties to that are required for the benchmark to occur. 

``` bash
{
    "caliper" : {
    },
    "clients" : {
    },
    "channels" : {
    },
    "name": {
    },
    "organization" : {
    },
    "peers" : {
    },
    "certificateAuthorities" : {
    },
    "version" : {
    }
}
```

### Find and Copy Template

First we will use a template to populate the file initially. This template will have some unique certificates on therefore you will need to use the one on the network however it should still like the one below. 

We will be using Org1 to connect in this example. To find the template, look in the **fabric-samples** -> **test-network** -> **organizations** -> **peerOrganizations** -> **org1.example.com** -> **connection-org1.json** 

The YAML file can also be found here. 

Copy the whole template and paste it into the **network_config.json** file. 

It should look like this: 

``` bash
{
    "name": "test-network-org1",
    "version": "1.0.0",
    "client": {
        "organization": "Org1",
        "connection": {
            "timeout": {
                "peer": {
                    "endorser": "300"
                }
            }
        }
    },
    "organizations": {
        "Org1": {
            "mspid": "Org1MSP",
            "peers": [
                "peer0.org1.example.com"
            ],
            "certificateAuthorities": [
                "ca.org1.example.com"
            ]
        }
    },
    "peers": {
        "peer0.org1.example.com": {
            "url": "grpcs://localhost:7051",
            "tlsCACerts": {
                "pem": "-----BEGIN CERTIFICATE-----\nMIICVzCCAf2gAwIBAgIQb+x0YUP7g9uNtlYpTr6waTAKBggqhkjOPQQDAjB2MQsw\nCQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEWMBQGA1UEBxMNU2FuIEZy\nYW5jaXNjbzEZMBcGA1UEChMQb3JnMS5leGFtcGxlLmNvbTEfMB0GA1UEAxMWdGxz\nY2Eub3JnMS5leGFtcGxlLmNvbTAeFw0yMDA3MjkwODUyMDBaFw0zMDA3MjcwODUy\nMDBaMHYxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpDYWxpZm9ybmlhMRYwFAYDVQQH\nEw1TYW4gRnJhbmNpc2NvMRkwFwYDVQQKExBvcmcxLmV4YW1wbGUuY29tMR8wHQYD\nVQQDExZ0bHNjYS5vcmcxLmV4YW1wbGUuY29tMFkwEwYHKoZIzj0CAQYIKoZIzj0D\nAQcDQgAEIlfDNcVbmSvQ6+POVYoanr8MMWP0hHPrNU8uNOkHYtk+O09JHyRZx/pm\n1MlxEQBCmNj2AYazcBM5BKw8siP3xqNtMGswDgYDVR0PAQH/BAQDAgGmMB0GA1Ud\nJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcDATAPBgNVHRMBAf8EBTADAQH/MCkGA1Ud\nDgQiBCDfjgtM72QcQU8dQouTPHYgSc0iUoKwJ3n/np65mfQMEzAKBggqhkjOPQQD\nAgNIADBFAiAOhNqA/Fj/TxdcH1QRtgiRhyr002rR8+dEiV30hWprjQIhAJx086aV\nKlQr3biwIbY3NVKvRC1X1UOPA9mIGd6VeKlX\n-----END CERTIFICATE-----\n"
            },
            "grpcOptions": {
                "ssl-target-name-override": "peer0.org1.example.com",
                "hostnameOverride": "peer0.org1.example.com"
            }
        }
    },
    "certificateAuthorities": {
        "ca.org1.example.com": {
            "url": "https://localhost:7054",
            "caName": "ca-org1",
            "tlsCACerts": {
                "pem": "-----BEGIN CERTIFICATE-----\nMIICUTCCAfegAwIBAgIQK7H9n9I/Ckn+h1sZsfpQnjAKBggqhkjOPQQDAjBzMQsw\nCQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEWMBQGA1UEBxMNU2FuIEZy\nYW5jaXNjbzEZMBcGA1UEChMQb3JnMS5leGFtcGxlLmNvbTEcMBoGA1UEAxMTY2Eu\nb3JnMS5leGFtcGxlLmNvbTAeFw0yMDA3MjkwODUyMDBaFw0zMDA3MjcwODUyMDBa\nMHMxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpDYWxpZm9ybmlhMRYwFAYDVQQHEw1T\nYW4gRnJhbmNpc2NvMRkwFwYDVQQKExBvcmcxLmV4YW1wbGUuY29tMRwwGgYDVQQD\nExNjYS5vcmcxLmV4YW1wbGUuY29tMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE\n7GBAPjSWqjqC98z94r1TRc6p6aHs6ffIKZeHVCss+npZcifvo7xX/+cj68wFiGaE\n9Empd9BLw74vHMu8g8htYaNtMGswDgYDVR0PAQH/BAQDAgGmMB0GA1UdJQQWMBQG\nCCsGAQUFBwMCBggrBgEFBQcDATAPBgNVHRMBAf8EBTADAQH/MCkGA1UdDgQiBCDw\nI1jEy5mYTvFN5B3yZ7YloA8m9cqwcrwkwFGD2hbSzzAKBggqhkjOPQQDAgNIADBF\nAiAF2khyo+q1ANlWYObB4grxu9Nqh8mI31F4MLYba/L2WAIhAPFSkNWQFnNId196\n8A/4BocViI+qLs1pm0KoJxuyaUt/\n-----END CERTIFICATE-----\n"
            },
            "httpOptions": {
                "verify": false
            }
        }
    }
}
```

### Caliper Object

Identify the Distributed ledger technology engine that is being tested. Add an object called `caliper` to the schema that contains the property `blockchain` with the string value `fabric`. 

It should look like this:  

```bash 
"caliper": {
        "blockchain": "fabric"
    },

```

### Clients Object

Add an object called `Clients` to the schema and a property named after one of the identities in the network. In this case the identity used is `Admin@org1.example.com`. Then nest the existing `Client` object within the identity. 

``` bash
"clients": {
    "Admin@org1.example.com": {
        "client": {
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
```

Under the `client` object add a property called `credentialStore` under this property add a property called `path` that has a string variable leading to a temp file in the workspace with the name `tmp/hfc-kvs/org1`. Also under the `credentialStore` property add a property called `cryptoStore` and under this add another `path` property that points to the same temp file above, `tmp/hfc-kvs/org1`. 

This is what should be add to the `client` : 

``` bash
"credentialStore": {
    "path": "tmp/hfc-kvs/org1",
    "cryptoStore": {
        "path": "tmp/hfc-kvs/org1"
    }
},
```

Under the `client` object add a property called `clientPrivateKey` under this property add a property called `path` that has a string variable leading to a the identities private key. This can be found in the network, in this example it is found under **fabric-samples** -> **test-network** -> **organizations** -> **peerOrganizations** -> **org1.example.com** -> **users** -> **Admin@org1.example.com** -> **msp** -> **keystore** -> **priv_sk** . Ensure that it is the correct identities private key. 

This is what should be added to the `client`:

``` bash
"clientPrivateKey": {
    "path": "../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/priv_sk"
    },
```

Also under the `client` object add another property called `clientSignedCert` and under this add a property called `path` that has a string variable leading to the identities signed certificate. This can be found in the network, in this example it is found under **fabric-samples** -> **test-network** -> **organizations** -> **peerOrganizations** -> **org1.example.com** -> **users** -> **Admin@org1.example.com** -> **msp** -> **signedcerts** -> **admin@org1.example.com-cert.pem**

This is what should be added to the `client`:

``` bash
"clientSignedCert": {
    "path": "../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem"
    },
```

That is all you need to add to the `clients` object. It should now look like this: 

```bash
    "clients": {
        "Admin@org1.example.com": {
            "client": {
                "credentialStore": {
                    "path": "tmp/hfc-kvs/org1",
                    "cryptoStore": {
                        "path": "tmp/hfc-kvs/org1"
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
```

### Channels Object

Add an object called `channels` to the schema and a property named after the channel name. The default channel name, and the one used in this tutorial, is `mychannel`. Under the channel name, add two properties, one called `created` and the other `chaincodes`. 

Set `created` to the boolean variable `true`. It should look like this:

``` bash
"created" : true,
```

`chaincodes` is going to hold an array which will have two properties, `id` and `version`. `id` will have the chaincode ID, in this case it is `fabcar`. The version is that specific chaincode's version, in this case that is `0.0.1`. It should look like this: 

``` bash
"chaincodes": [
    {
        "id":"fabcar",
        "version":"0.0.1"
    }
]
```

This is what the `channels` object should look like:

``` bash
    "channels": {
        "mychannel": {
            "created" : true,
            "chaincodes": [
                {
                    "id":"fabcar",
                    "version":"0.0.1"
                }
            ]
        }
    },
```

### Organizations Object

In the `organizations` object under `Org1` add two more properties: 
- `adminPrivateKey` that will have the path to the admin user's private key.
-`signedCert` that will have the path to the admin user's signed certificate

 As we, in this example, the identity we are using is the admin user, these paths will be the same as in the clients object. If you are using a different identity the admin user's keys and certificate can be found in: **fabric-samples** -> **test-network** -> **organizations** -> **peerOrganizations** -> **org1.example.com** -> **users** -> **Admin@org1.example.com** -> **msp**. 

This is what should be added: 

```bash
"adminPrivateKey": {
    "path": "../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/priv_sk"
    },
"signedCert": {
    "path": "../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem"
    }
```

And this is what the `organizations` object should look like now:

```bash
    "organizations":{
        "Org1": {
            "mspid": "Org1MSP",
            "peers": [
                "peer0.org1.example.com"
            ],
            "certificateAuthorities": [
                "ca.org1.example.com"
            ],
            "adminPrivateKey": {
                "path": "../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/priv_sk"
            },
            "signedCert": {
                "path": "../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem"
            }
        }
    },
```

### Resulting file:

The network configuration file should now be fully populated. It can be useful to take time to look over and ensure that the paths to the certificate and keys are correct. 

The whole file should resemble like this: 

```bash
{
    "caliper": {
        "blockchain": "fabric"
    },
    "clients": {
        "Admin@org1.example.com": {
            "client": {
                "credentialStore": {
                    "path": "tmp/hfc-kvs/org1",
                    "cryptoStore": {
                        "path": "tmp/hfc-kvs/org1"
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
            "chaincodes": [
                {
                    "id":"fabcar",
                    "version":"0.0.1"
                }
            ]
        }
    },
    "name": "test-network-org1",
    "organizations":{
        "Org1": {
            "mspid": "Org1MSP",
            "peers": [
                "peer0.org1.example.com"
            ],
            "certificateAuthorities": [
                "ca.org1.example.com"
            ],
            "adminPrivateKey": {
                "path": "../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/priv_sk"
            },
            "signedCert": {
                "path": "../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem"
            }
        }
    },
    "peers": {
        "peer0.org1.example.com": {
            "url": "grpcs://localhost:7051",
            "tlsCACerts": {
                "pem": "-----BEGIN CERTIFICATE-----\nMIICVzCCAf2gAwIBAgIQb+x0YUP7g9uNtlYpTr6waTAKBggqhkjOPQQDAjB2MQsw\nCQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEWMBQGA1UEBxMNU2FuIEZy\nYW5jaXNjbzEZMBcGA1UEChMQb3JnMS5leGFtcGxlLmNvbTEfMB0GA1UEAxMWdGxz\nY2Eub3JnMS5leGFtcGxlLmNvbTAeFw0yMDA3MjkwODUyMDBaFw0zMDA3MjcwODUy\nMDBaMHYxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpDYWxpZm9ybmlhMRYwFAYDVQQH\nEw1TYW4gRnJhbmNpc2NvMRkwFwYDVQQKExBvcmcxLmV4YW1wbGUuY29tMR8wHQYD\nVQQDExZ0bHNjYS5vcmcxLmV4YW1wbGUuY29tMFkwEwYHKoZIzj0CAQYIKoZIzj0D\nAQcDQgAEIlfDNcVbmSvQ6+POVYoanr8MMWP0hHPrNU8uNOkHYtk+O09JHyRZx/pm\n1MlxEQBCmNj2AYazcBM5BKw8siP3xqNtMGswDgYDVR0PAQH/BAQDAgGmMB0GA1Ud\nJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcDATAPBgNVHRMBAf8EBTADAQH/MCkGA1Ud\nDgQiBCDfjgtM72QcQU8dQouTPHYgSc0iUoKwJ3n/np65mfQMEzAKBggqhkjOPQQD\nAgNIADBFAiAOhNqA/Fj/TxdcH1QRtgiRhyr002rR8+dEiV30hWprjQIhAJx086aV\nKlQr3biwIbY3NVKvRC1X1UOPA9mIGd6VeKlX\n-----END CERTIFICATE-----\n"
            },
            "grpcOptions": {
                "ssl-target-name-override": "peer0.org1.example.com",
                "hostnameOverride": "peer0.org1.example.com"
            }
        }
    },
    "certificateAuthorities": {
        "ca.org1.example.com": {
            "url": "https://localhost:7054",
            "caName": "ca-org1",
            "tlsCACerts": {
                "pem": "-----BEGIN CERTIFICATE-----\nMIICUTCCAfegAwIBAgIQK7H9n9I/Ckn+h1sZsfpQnjAKBggqhkjOPQQDAjBzMQsw\nCQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEWMBQGA1UEBxMNU2FuIEZy\nYW5jaXNjbzEZMBcGA1UEChMQb3JnMS5leGFtcGxlLmNvbTEcMBoGA1UEAxMTY2Eu\nb3JnMS5leGFtcGxlLmNvbTAeFw0yMDA3MjkwODUyMDBaFw0zMDA3MjcwODUyMDBa\nMHMxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpDYWxpZm9ybmlhMRYwFAYDVQQHEw1T\nYW4gRnJhbmNpc2NvMRkwFwYDVQQKExBvcmcxLmV4YW1wbGUuY29tMRwwGgYDVQQD\nExNjYS5vcmcxLmV4YW1wbGUuY29tMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE\n7GBAPjSWqjqC98z94r1TRc6p6aHs6ffIKZeHVCss+npZcifvo7xX/+cj68wFiGaE\n9Empd9BLw74vHMu8g8htYaNtMGswDgYDVR0PAQH/BAQDAgGmMB0GA1UdJQQWMBQG\nCCsGAQUFBwMCBggrBgEFBQcDATAPBgNVHRMBAf8EBTADAQH/MCkGA1UdDgQiBCDw\nI1jEy5mYTvFN5B3yZ7YloA8m9cqwcrwkwFGD2hbSzzAKBggqhkjOPQQDAgNIADBF\nAiAF2khyo+q1ANlWYObB4grxu9Nqh8mI31F4MLYba/L2WAIhAPFSkNWQFnNId196\n8A/4BocViI+qLs1pm0KoJxuyaUt/\n-----END CERTIFICATE-----\n"
            },
            "httpOptions": {
                "verify": false
            }
        }
    },
    "version": "1.0"
}
```

## Step 4 - Test Callback File

The test callback file interacts with the deployed smart contract during the benchmark round. Each test callback file must export three functions: 
- `init` - used to initialise the ledger to run the session
- `run` - used to interact with the smart contract method during the monitored phase of the benchmark
- `end` - will end and clean up after the completion of the `run` phase

### Create File

Under the **benchmarks** folder create subfolder called **callbacks**, in this folder create a file called **queryAssetBenchmark.js**. That is the file we will be populating. 

When we populate this file we make reference to the **fabcar.js** file. This has the smart contract code. It can be found in: **fabric-samples** -> **chaincode** -> **fabcar** -> **javascript** -> **lib** -> **fabcar.js**

### Setting up File

Caliper uses the following methods to interact with a deployed smart contract:
- `invokeSmartContract (ctx, contractId, contractVersion, args)`
- `querySmartContract (ctx, contractId, contractVersion, args)`

Where: 
- `ctx` is the user context
- `contractId` is the smart contract name, in this case that is fabcar
- `contractVersion` is the smart contract version, in this case that is 0.0.1
- `args` is an object containing:
    - `chaincodeFunction` is the name of the smart contract function to call
    - `invokerIdentity` is the identity to use when performing the function call, in this case we user Admin@org1.example.com
    - `chaincodeArguments` which is an array of arguments to pass to the function when it is being called, in this case this is the colour, make, model, and owner of the car. 

Here is the basic template for the file. 

``` bash
'use strict';

module.exports.info  = 'Template callback';

const contractID = 'fabcar';
const version = '0.0.1';

let bc, ctx, clientArgs, clientIdx;

module.exports.init = async function(blockchain, context, args) {
};

module.exports.run = function() {
    return Promise.resolve();
};

module.exports.end = async function() {
};
```

### Init Function

This function is used to init passed arguments and prepare any items required by the `run` function. 

First we will set the blockchain (`bc`), context (`ctx`), and args (`clientArgs`). 

Then assume that the number of assets to be created will be given as `clientArgs.assets` and create a `for` loop that is between 0 and the number of assets to be created. 

In the `for` loop we will be using the smart contract method (found, in this example, in **fabcar.js**) `createCar`. Since this may throw if an error occurs, we will be using a try-catch lock to print an error to ease debugging. I

n the catch, add an information statement reporting the error. 

In the try, await completion of an `invokeSmartContract` call on the blockchain object passing the context, contract name, contract version, and an object that contains: `chaincodeFunction` set as `createCar`; `invokeIdentity` set as `admin@org.example.com`; `chaincodeArguments` set as an array containing `assetID` and the arguments needed to be passed to `createCar`.

The function should look like this:

```bash
module.exports.init = async function(blockchain, context, args) {
    bc = blockchain;
    ctx = context;
    clientArgs = args;
    clientIdx = context.clientIdx.toString();
    for (let i=0; i<clientArgs.assets; i++) {
        try {
            const assetID = `${clientIdx}_${i}`;
            console.log(`Client ${clientIdx}: Creating asset ${assetID}`);
            const myArgs = {
                chaincodeFunction: 'createCar',
                invokerIdentity: 'Admin@org1.example.com',
                chaincodeArguments: [assetID,'blue','ford','focus','jim']
            };
            await bc.bcObj.invokeSmartContract(ctx, contractID, version, myArgs);
        } catch (error) {
            console.log(`Client ${clientIdx}: Smart Contract threw with error: ${error}` );
        }
    }
};
```

The `chaincodeArguments` we passed unique own arguments to be used. The smart contract will be tested on making multiple of the same asset (blue, ford, focus, Jim). If you are using a different smart contract, you will pass in different arguments here. 

### Run Function

This function runs repeatedly in the benchmark test phase. We will be evaluating the `queryCar` smart contract function by querying the assets we created in the `init` function. Because we are running this for multiple assets concurrently it will need to return a unresolved promise and not block.

First, create a string identity for the asset to query, formed by the concat of the test client index and a random integer between 0 and the number of created assets. 

Then return the call on `querySmartContract`, passing context, contract name, contract version, and an object that contains: `chaincodeFunction` set as `queryCar`; `invokerIdentity` set as `admin@org1.example.com`; and `chaincodeArguments` set as an array that contains the asset to query in this run. 

The function should look like this:

```bash
module.exports.run = function() {
    const randomId = Math.floor(Math.random()*clientArgs.assets);
    const myArgs = {
        chaincodeFunction: 'queryCar',
        invokerIdentity: 'Admin@org1.example.com',
        chaincodeArguments: [`${clientIdx}_${randomId}`]
    };
    return bc.bcObj.querySmartContract(ctx, contractID, version, myArgs);
};
```

### End Function

This function is used to clean up after a test as it deletes the assets created in the `init` function. 

We will not be using this function this time as the smart contract we are testing doesn't have a function to delete the assets. So this function will remain empty. 

However, if you are using a different smart contract to test that does have a delete function you can use the same for loop from the `init` phase. You only need to modify the `chaincodeFunction` to call the name of the delete function from the chaincode. 

### Resulting File:

The test callback file should now be fully populated. 

The whole file should look like this:

```bash
'use strict';

module.exports.info  = 'Template callback';

const contractID = 'fabcar';
const version = '0.0.1';

let bc, ctx, clientArgs, clientIdx;

module.exports.init = async function(blockchain, context, args) {
    bc = blockchain;
    ctx = context;
    clientArgs = args;
    clientIdx = context.clientIdx.toString();
    for (let i=0; i<clientArgs.assets; i++) {
        try {
            const assetID = `${clientIdx}_${i}`;
            console.log(`Client ${clientIdx}: Creating asset ${assetID}`);
            const myArgs = {
                chaincodeFunction: 'createCar',
                invokerIdentity: 'Admin@org1.example.com',
                chaincodeArguments: [assetID,'blue','ford','fiesta','Jamie']
            };
            await bc.bcObj.invokeSmartContract(ctx, contractID, version, myArgs);
        } catch (error) {
            console.log(`Client ${clientIdx}: Smart Contract threw with error: ${error}` );
        }
    }
};

module.exports.run = function() {
    const randomId = Math.floor(Math.random()*clientArgs.assets);
    const myArgs = {
        chaincodeFunction: 'queryCar',
        invokerIdentity: 'Admin@org1.example.com',
        chaincodeArguments: [`${clientIdx}_${randomId}`]
    };
    return bc.bcObj.querySmartContract(ctx, contractID, version, myArgs);
};

module.exports.end = async function() {
};
```

## Step 5 - Benchmark Configuration File

The benchmark configuration file defines the benchmark rounds and references the defined callbacks. It will specify the number of test clients to use when generating the load, the number of test rounds, the duration of each round, the load generation method during each round, and the callback to use within each round. 

The file will be a YAML file. It is to note that YAML files are case sensitive and all labels are in lowercase. 

This file will have three root blocks that need to be populated. The shape of the file will be as follows:

``` bash
test:

monitor:

observer:
```
### Create File

Under the **benchmarks** folder create a file called **myAssetBenchmark.yaml**. That is the file we will be populating.

### Test Block

First add a root level block named `test`. In this block add:

- a `name` key with the value `my-asset-benchmark`
- a `description` key with a short description as the value, in this example that is `test benchmark`
- a literal block named `workers` that has the following keys and values:
    - `type: local`
    - `number: 2`

It should look like this so far: 

Also add a literal block named `rounds`. This block contains each benchmark test round that is to be run headed by a unique round label. Rounds may be used to benchmark different smart contract methods, or the same method in a different manner. 

The `round` block contains the following: 

- `label` - the unique header label to use for the round.
- `description` - a description of the round being run.
- `chaincodeId` - the chaincode ID that is being tested. 
- `txDuration` - the length of the round measured by duration. 
- `rateControl` - a rate control method with options and the type. 
- `callback` - a path to the callback file that is being tested, in this case this is the queryAssetBenchmark.js file. 
- `arguments` - an optional array of arguments to be passed to the callback file when being invoked. 

This is how it should be populated: 

``` bash
rounds:
    - label: queryAsset
    description: Query asset benchmark
    chaincodeId: fabcar
    txDuration: 30
    rateControl: 
        type: fixed-backlog
        opts:
            unfinished_per_client: 2
    callback: benchmarks/callbacks/queryAssetBenchmarks.js
    arguments:
        assets: 10
```

### Monitor Block

Add another root level block called `monitor` with a single key named `type` with a single arrange entry of `none` as value. This is because we will not be performing any resource monitoring during the benchmark testing. 

It should look like this: 

```bash
monitor:
  type:
  - none
```

### Observer Block

Add a root level block named `observer` that contains two keys named `type` and `interval`. The should hold values `local` and `5` respectively. This indicated we will be observing ghe test progression every five seconds using local statistics. 

It should look like this:

``` bash
observer:
  type: local
  interval: 5
```

### Resulting File

The benchmark configuration file should now be fully populated. 

It should look like this:

```bash
test:
    name: my-asset-benchmark
    description: test benchmark
    workers:
      type: local
      number: 2
    rounds:
      - label: queryAsset
        description: Query asset benchmark
        chaincodeId: fabcar
        txDuration: 30
        rateControl: 
          type: fixed-backlog
          opts:
            unfinished_per_client: 2
        callback: benchmarks/callbacks/queryAssetBenchmarks.js
        arguments:
          assets: 10
  
monitor:
  type:
  - none
  
observer:
  type: local
  interval: 5
```

## Step 6 - Running and Result

### Setting up the command

We are now ready to run the performance benchmark using the above materials we have created. The performance benchmark will be using the Caliper CLI and will also need to paths to the network configuration file, the benchmark configuration file, and the workspace. 

That should be as follows: 

- caliper-networkconfig: `networks/network_config.json`
- caliper-benchconfig: `benchmarks/myAssetBenchmark.yaml`
- caliper-workspace: `./`

Since the chaincode has already been installed and instantiated the only actions caliper needs to perform is the test phase using a fabric gateway that has discovery enabled. To specify this you should add the following additional flags to the CLI command:

- `caliper-flow-only-test`
- `caliper-fabric-gateway-usegateway`
- `caliper-fabric-gateway-discovery`

### Run the command

Ensure that you are in the caliper-workspace directory. 

In the terminal run the following Caliper CLI command:

`caliper launch master --caliper-benchconfig benchmarks/myAssetBenchmark.yaml --caliper-networkconfig networks/network_config.json --caliper-workspace ./ --caliper-flow-only-test --caliper-fabric-gateway-usegateway --caliper-fabric-gateway-discovery`

### Result

The resulting report will detail the following items for each benchmark round:

- Name - the round name from the benchmark configuration file
- Succ/Fail - the number of successful/failing transactions
- Send Rate - the rate at which caliper issued the transactions
- Latency (max/min/avg) - statistics relating to the time taken in seconds between issuing a transaction and receiving a response
- Throughput - the average number of transactions processed per second

You have successfully benchmarked a smart contract. You can repeat the test varying the benchmark parameters. For the full set of parameters you can see the [Caliper Documentation](https://hyperledger.github.io/caliper/)

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.