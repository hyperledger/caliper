# Caliper FAQ

## **I. Environment, Platform & Version**

**Q:** How do I run Caliper to test a blockchain system?
**A:** Details for setting up Caliper to run benchmark tests on a blockchain system are provided in the [Getting Started](../index.md) page of the site. When you run Caliper to test a blockchain network, you may encounter some errors. If so, first you should check the version of tools, SDKs and modules to make sure it is right.

## **II. Configuration Files of Caliper**

**Q:** What kind of configuration files are needed to run Caliper?
**A:** There are two kinds of configuration files in Caliper: the benchmark configuration file, which defines the arguments of the benchmark, like workload and monitoring settings; the blockchain configuration file, which specifies the information needed to interact with the backend blockchain system. For examples of these files please refer to [here](https://github.com/hyperledger/caliper-benchmarks)

There is another configuration file, namely `./config/default.yaml`, containing runtime setting for Caliper and the blockchain adapters. These settings can also be specified as command line arguments or environment variables.

## **III. Testing a Blockchain Network**

**Q:** What kind of networks does Caliper support currently?
**A:** Now you can use Caliper to test Besu, Ethereum and Fabric.

**Q:** How can I test a blockchain system that Caliper does not support currently？
**A:** If you want to test the blockchain system that Caliper does not support now, you must write your own blockchain adapter that Caliper can use to inferface with the backend network. For details, you can refer to the [Writing Adapters](../connectors/writing-connectors.md) page. The Caliper-specific configurations remain unchanged. Take a look at the provided adapter implementations and example networks to gather some best-practices.

## **IV. Other Questions Related to Caliper**

**Q:** How can I calculate the throughput (TPS)?
**A:** Caliper will record the submitting time and committing time (the time when the Tx is committed on the ledger or when the failure occurred) for each Tx. The throughput is calculated by `Succ+Fail/(last committing time - first submitting time)`. This means both successful and failed transactions are included in the throughput calculation.


## V. **Other Questions Related to the Backend Blockchain System**

**Q:** How can I test my own Fabric chaincode?
**A:** You first need to deploy that chaincode to your Fabric network, then create your benchmark and workload files see the Caliper Fabric tutorial for further guidance.

**Q:** How can I use TLS communication?
**A:** Fabric supports secure communication between nodes and clients using TLS. TLS communication can use both one-way (server only) and two-way (server and client) authentication. You can refer to the [Fabric TLS](https://hyperledger-fabric.readthedocs.io/en/release-2.5/enable_tls.html) configuration page for server side settings. For Caliper-side settings, check the adapter documentation that details how to set the necessary credentials.

### **Q:** How can I monitor remote Docker containers?
**A:** If you need to access the Docker daemon remotely, you need to explicitly enable remote access. Beware that the default setup provides unencrypted and unauthenticated direct access to the Docker daemon. For details, refer to the official [Docker documentation](https://success.docker.com/article/how-do-i-enable-the-remote-api-for-dockerd).

## License
The Caliper codebase is released under the Apache 2.0 license. Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.