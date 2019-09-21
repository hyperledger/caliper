# caliper-bftsmart

caliper-bftsmart aims to make benchmarks for BFTSMaRt more generic than the YCSH benchmarks presented 
in their source code.


## Table of Contents

1. [A glimpse into benchmarking bftsmart applications](#one)
2. [Integration into Caliper](#two)
3. [Installation](#three)
4. [Usage](#four)
5. [Further work](#five)
6. [License](#six)


## Benchmarking BFTSMaRt applications <a name="one"></a>

BFTSMaRt is an old and well known byzantine fault tolerant algorithm implemented in 2008 by . 
Its implementation focus on the consensus protocol BFT and not on nice Data-structure to represent
daily use-cases. It is therefore much more lightweight than others. 
It focus on what matter: consistent replication under byzantine fault. The following 
benchmark is a base for further and more complex benchmarks. 

## Integration into Caliper <a name="two"></a>


This package has the following structure:
 ```
 /configurations
    /benchmark: config.yaml 
    /network: config-java.yaml
/library
    /Here goes the bftsmart code and jars
/lib
    /bftsmart.js
    /bftsmartUtils.js
 ```


## Installation <a name="three"></a>

- You need the adequate JVM to be installed.
- If you want to work on another bftsmart version you can download it here: 

#### Dependencies


## Usage <a name="four"></a>


### Caution

## License <a name="six"></a>
Hyperledger Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the [LICENSE](../../LICENSE) file. Hyperledger Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.

