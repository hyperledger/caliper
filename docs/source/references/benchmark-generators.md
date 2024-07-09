## Overview
The Caliper benchmark generator is a Yeoman generator for generating the configuration and callback files used to perform benchmarks on deployed smart contracts. This page will take you through installing and using the generator.

## Installation
You must first have Yeoman installed to be able to install and use the generator. You can do this using the following command:

```sh
npm install -g yo
```

Once Yeoman is installed, use the following command to install the generator:

```sh
npm install -g @hyperledger/generator-caliper
```

## Using the Generator
To use the generator, run the following command

```sh
yo caliper
```

If successful, you should get the following output where you will be prompted to choose a generator - choose Benchmark to run the Caliper benchmark generator:

```sh
Welcome to the Hyperledger Caliper generator!
? Which generator would you like to run? (Use arrow keys)
❯ Benchmark
```

!!! note
    *Alternatively, you can run the benchmark generator using: `yo caliper:benchmark`.*

You will then get the following output where you will be prompted to name your workspace:

```sh
Welcome to the Hyperledger Caliper benchmark generator!
Let's start off by creating a workspace folder!
? What would you like to call your workspace? myWorkspace
```

### Callback Prompts
The benchmark generator will initially take you through generating the callback file and you will be prompted for:

- the **name** of your smart contract,
- the **version** of your smart contract,
- a smart contract **function**
- the argument variables of your smart contract function, which must be entered in array format

By the end, you should have something similar to the following:

```sh
Now for the callback file...
? What is the name of your smart contract? fabcar
? What is the version of your smart contract? 0.0.1
? Which smart contract function would you like to perform the benchmark on? changeCarOwner
? What are the arguments of your smart contract function? (e.g. ["arg1", "arg2"]) ["CAR001", "Tom"]
```

### Configuration Prompts
Next, you will be taken through generating the [configuration file](https://hyperledger.github.io/caliper/v0.5.0/reference/benchmark-generator/Architecture#ConfigurationFile) and you will be prompted for:

- the **name** of the benchmark
- a **description** of the benchmark
- the number of **workers**

!!! note
    *On an invalid input value for workers, a default value will be used.*

- a **label** for differentiating between multiple rounds
- the **rate controller** you would like to use. The generator currently provides the rate controllers displayed below as options. The generated configuration file will use default `opts` for whichever rate controller is chosen.

```sh
? Which rate controller would you like to use? (Use arrow keys)
❯ Fixed Rate
  Fixed Backlog
  Linear Rate
  Fixed Feedback Rate
```

- the method of which you should like to measure the length of the round. The round may be measured using either **transaction duration**, which defines the length of the round in seconds, or **transaction number**, which defines the length of the round using the number of transactions to be generated in the round.

```sh
? How would you like to measure the length of the round? (Use arrow keys)
❯ Transaction Duration
  Transaction Number
```

- a value for either `txNumber` or `txDuration` depending on the answer to previous prompt.

!!! note
    *On an invalid input value for either **txDuration** or **txNumber**, a default value will be used.*

By the end, you should have something similar to the following:

```sh
Now for the benchmark configuration file...
? What would you like to name your benchmark? Fabcar benchmark
? What description would you like to provide for your benchamrk? Benchmark for performance testing fabcar contract modules
? How many workers would you like to have? 5
? What label (hint for test) would you like to provide for your benchmark? Round for changing car owner
? Which rate controller would you like to use? Fixed Rate
? How would you like to measure the length of the round? Transaction Number
? How many transactions would you like to have in this round? 60
```

On successful generation, you should see the following:

```sh
Generating benchmarking files...
   create myBenchmark/benchmarks/callbacks/changeCarOwner.js
   create myBenchmark/benchmarks/config.yaml
Finished generating benchmarking files
```

The generator can also be run non-interactively from the command line using the following command line options:

| Options               | Default       | Description                                                                                  |
|-----------------------|---------------|----------------------------------------------------------------------------------------------|
| `--workspace`         |               | A workspace to put all the generated benchmark files.                                         |
| `--contractId`        |               | The name of your smart contract.                                                             |
| `--version`           |               | The version of your smart contract.                                                          |
| `--contractFunction`  |               | Your smart contract function.                                                                |
| `--contractArguments` | `[]`          | The arguments of your smart contract function. These must be in an array format.             |
| `--benchmarkName`     |               | A name for your benchmark.                                                                   |
| `--benchmarkDescription` |           | A description for your benchmark.                                                            |
| `--workers`           | `5`           | A value for the number of workers.                                                           |
| `--label`             |               | A label for the round.                                                                       |
| `--rateController`    |               | The rate controller.                                                                         |
| `--txType`            |               | The way you would like to measure the length of the round - either “txDuration” or “txNumber”.|
| `--txDuration`        | `50`          | The value for transaction duration if “txDuration” was entered for txType.                   |
| `--txNumber`          | `50`          | The value for transaction number if “txNumber” was entered for txType.                       |

Below is an example of the generator being run non-interactively from the command line using the options above:

```sh
yo caliper:benchmark -- --workspace 'myWorkspace' --contractId 'fabcar' --version '0.0.1' --contractFunction 'changeCarOwner' --contractArguments '["CAR001", "Tom"]' --benchmarkName 'Fabcar benchmark' --benchmarkDescription 'Benchmark for performance testing fabcar contract modules' --workers 5 --label 'Round for changing car owner' --rateController 'fixed-rate' --txType 'txDuration' --txDuration 50
```

!!! note
    *All the options above are required when using the generator non-interactively.*

## Next Steps
The generated files will be placed within the workspace directory you named at the beginning of the generator, and you should have a directory structure similar to the one shown below:

```sh
.myWorkspace
└── benchmarks
    │  callbacks
    │  └── changeCarOwner.js
    └─ config.yaml
```

Currently, the generator does not provide `invokerIdentity` or `contractArguments` as inputs to your callback file. Should these be required, you will need to provide these in the `run` function of your callback file.

The generator only generates a single callback file for a single smart contract function. If you would like to test other smart contract functions, you may create more callback files under the callbacks directory. You will also need to update your benchmnark configuration file to take into account the extra callbacks.

!!! note
    *The benchmark generator will only create the benchmark configuration file and the callback file. You will still need to provide a network configuration file to be able to perform the benchmark.*

## License
The Caliper codebase is released under the [Apache 2.0 license](https://hyperledger.github.io/caliper/v0.5.0/general/license/). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at [http://creativecommons.org/licenses/by/4.0/](http://creativecommons.org/licenses/by/4.0/).