---
layout: page
title:  "Caliper FAQ"
categories: opensource
---


### I. Environment, Platform & Version
**Q:** How do I run Caliper to test a blockchain system?  
**A:** Details for setting up Caliper to run benchmark tests on a blockchain system are provided in the [Getting Started](https://hyperledger.github.io/caliper/docs/1_Getting_Started.html) page of the site.  
When you run Caliper to test a blockchain network, you maybe encounter some errors. If so, first you should check the version of tools, SDKs and modules to make sure it is right.
 
### II.	Configuration Files of Caliper  
**Q:** What kind of configuration files are needed to run Caliper?  
**A:** There are two kinds of configuration files in Caliper: the benchmark configuration file, which defines the arguments of the benchmark, like workload and monitoring settings; the blockchain configuration file, which specifies the information needed to interact with the backend blockchain system.  

a. **Benchmark configuration file**: The example benchmark configuration files are named like `config-xxx.yaml` and are located in the directories of the sample benchmarks. The configuration contains test round and monitoring settings. You can refer to the [Architecture documentation](https://hyperledger.github.io/caliper/docs/2_Architecture.html) for details.  

b. **Blockchain configuration file**: The blockchain configuration file is named like `xxx-yyy.json/`, where `xxx` is the blockchain type (for example, `fabric`, `sawtooth`, `burrow` or `iroha`), and `yyy` is some deployment-specific information, like the language of the chaincodes (for example, `fabric-go.json` for a Fabric deployment). You can refer to the platform-specific configuration pages for more information.

c. There is another configuration file, namely `./config/default.yaml`, containing runtime setting for Caliper and the blockchain adapters. These settings can also be specified as command line arguments or environment variables.

### III. Testing a Blockchain Network  
**Q:** What kind of networks does Caliper support currently?  
**A:** Now you can use Caliper to test Fabric, Iroha, Composer, Sawtooth and Burrow networks. Caliper provides some example networks out-of-the-box. For Fabric, example networks are located in the `network/fabric-v<VERSION>/<X>org<Y>peer<STATEDB>` directories, where `<VERSION>` is the version of Fabric binaries comprising the network, `<X>` is the number of organizations in the network, `<Y>` is the number of peers each organization has and `<STATEDB>` denotes the type of the DB storing the world state (`goleveldb` or `couchdb`).

**Q:** How can I change the network topology that Caliper tests?  
**A:** Caliper supports Fabric, Sawtooth, Iroha, Composer and Burrow and provides example configurations for each platform. Below are the steps needed to test a custom Fabric network:  

a.	Before the test, you should modify the `configtx.yaml` and `crypto-config.yaml` files (add extra organizations and/or peers) as needed and regenerate the artifacts (crypto materials, genesis block and channel configuration) used to bootstrap the network. 
 
b.	Modify a `docker-compose.yaml` file according to your new network topology, which can start the docker containers of the blockchain nodes.  

c.	Modify the Fabric network configuration file according to your new Fabric network topology (possibly including a new chaincode to deploy and test).  

d.	Run Caliper to test your blockchain network.   

**Q:** How can I test a blockchain system that Caliper does not support currently？  
**A:** If you want to test the blockchain system that Caliper does not support now, you must write your own blockchain adapter that Caliper can use to inferface with the backend network. For details, you can refer to the [Writing Adapters](https://hyperledger.github.io/caliper/docs/Writing_Adapters.html) page. The Caliper-specific configurations remain unchanged. Take a look at the provided adapter implementations and example networks to gather some best-practices.  

### IV.	Other Questions Related to Caliper  
**Q:** How can I calculate the throughput (TPS)?  
**A:** Caliper will record the submitting time and committing time (the time when the Tx is committed on the ledger or when the failure occurred) for each Tx.
So the send rate is calculated by `(Succ+Fail) / (last submitting time - first submitting time)`.
The throughput is calculated by `Succ/(last committing time - first submitting time)`, here only successful committed Txs will be calculated.

### V. Other Questions Related to the Backend Blockchain System  

**Q:** How can I test my own Fabric chaincode?  
**A:** You can modify the chaincode property information in the blockchain network configuration file according to your own chaincode properties (path, arguments, etc.). You also can put the chaincode files into the `./src/contract/fabric` directory.

**Q:** How can I test a Kafka ordering service for a Fabric network?  
**A:** Kafka is one of the supported consensus algorithms in Fabric (details at the [Kafka consensus documentation](https://hyperledger-fabric.readthedocs.io/en/latest/kafka.html)). For the support of multiple orderer nodes, refer to the adapter configuration page. 

**Q:** How can I test multiple hosts for a Fabric network?  
**A:** Caliper performs automatic load balancing if multiple targets are nodes in the network. Refer to the custom Fabric network question for putting together a multiple-host network. 

**Q:** How can I use TLS communication?  
**A:** Fabric supports secure communication between nodes and clients using TLS. TLS communication can use both one-way (server only) and two-way (server and client) authentication. You can refer to the [Fabric TLS configuration](https://hyperledger-fabric.readthedocs.io/en/release-1.4/enable_tls.html) page for server side settings. For Caliper-side settings, check the adapter documentation that details how to set the necessary credentials.  

**Q:** How can I monitor remote Docker containers?  
**A:** If you need to access the Docker daemon remotely, you need to explicitly enable remote access. Beware that the default setup provides unencrypted and unauthenticated direct access to the Docker daemon. For details, refer to the official [Docker documentation](https://success.docker.com/article/how-do-i-enable-the-remote-api-for-dockerd).
