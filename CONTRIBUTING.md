## Contributing to Hyperledger Caliper

We are using GitHub issues for bug reports and feature requests.

If you find any bug in the source code or have any trivial changes (such as typos fix, minor feature), you can raise an issue or delivery a fix via a pull request directly.

If you have any enhancement suggestions or want to help extend caliper with more DLTs or have any other major changes, please start by opening an issue first.
That way, relevant parties (e.g. maintainers or main contributors of the relevant subsystem) can have a chance to look at it before you do any work.

All PRs must get at least one review, you can ask `hyperledger/caliper-committers` for review.
Normally we will review your contribution in one week.
If you haven't heard from anyone in one week, feel free to @ or mail a maintainer to review it.

All PRs must be signed before be merged, be sure to use `git commit -s` to commit your changes.
   
There is also a [RocketChat Channel](https://chat.hyperledger.org/channel/caliper) for communication, anybody is welcome to join. 

### Caliper Structure

For beginners of Caliper, if you want to :

* Create a new test case

  You should create a new folder in`caliper/benchmark` directory and include all test scripts needed in this folder.
  A `main.js` is needed as the bootstrap for the test case. You can simply copy it from `caliper/benchmark/simple/` directory or write a new one by yourself.
  In the latter case, the command should as least accepts two arguments(-c and -n) which are used to specify the test configuration file and network configuration file.
 
  You may also provide some sample configuration files with the test scripts to illustrate how to run an end-to-end test.
    
  New smart contracts may be needed to run the the new test case, `caliper/src/contract` folder is recommended to use to maintain those smart contracts.
    
* Add supporting for a new DLT
  
  You must implement a new class inherited from `BlockchainInterface` as the adaptor for the DLT. All source codes should be maintained in `caliper/src`.
  
  You can also provide some sample DLT networks so that other people can try the test easily. The network files should be maintained in `caliper/network`.
  
* Help to improve the current implementation for a DLT

  The `caliper/src` folder contains source codes for all supported DLTs.
  
* Help to improve the benchmark engine

  The `caliper/src/comm` folder contains source codes for the benchmark engine. For example, the `bench-flow.js` implements the default end-to-end test flow.
