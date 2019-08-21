## Contributing to Hyperledger Caliper GUI

We are using GitHub issues for bug reports and feature requests.

If you find any bug in the source code or have any trivial changes (such as typos fix, minor feature), you can raise an issue or delivery a fix via a pull request directly.

If you have any enhancement suggestions or want to help extend caliper gui with any other major changes, please start by opening an issue first.
That way, relevant parties (e.g. maintainers or main contributors of the relevant subsystem) can have a chance to look at it before you do any work.

All PRs must get at least one review, you can ask `hyperledger/caliper-committers` for review.
Normally we will review your contribution in one week.
If you haven't heard from anyone in one week, feel free to @ or mail a maintainer to review it.

All PRs must be signed before be merged, be sure to use `git commit -s` to commit your changes.

We use Travis Ci to test the build - please test on your local branch before raising a PR. More information on Travis, and linking to your github repository may be found here: https://docs.travis-ci.com/user/for-beginners/
   
There is also a [RocketChat Channel](https://chat.hyperledger.org/channel/caliper) for communication, anybody is welcome to join. 

## Caliper GUI Structure
Caliper GUI is modularised under `packages/caliper-gui` into the following components:

### gui-client
This contains the GUI front end implemented with React.js and Reactstrap. It take test and network configuration files from uesr, and starts test with click. This app also provide a test generating form. The web app source contains the following folders:

- caliper-gui-dashboard/src/assets: react app basic web scripts.
- caliper-gui-dashboard/src/components: dashboard components, such as forms, navbars, sidebar, etc.
- caliper-gui-dashboard/src/data: saving all the (sample) configuration files.
- caliper-gui-dashboard/src/layouts: the main entry point or logic flow of the application.
- caliper-gui-dashboard/src/variables: storing all chart data and options for dashboard. Using socket.io to get real time update from backend caliper-cli in here.
- caliper-gui-dashboard/src/views: main display components in the application.

#### Next step and improvements
- Fully integrate with the current caliper-cli from caliper-gui server and api.
- Finalize the JSON data flow structure for real-time visualiation.
    - Linking all the real-time result output from caliper-cli to global visualization data state in dashboard, and visualize them with updated data.
- Implementing the global state tree with Redux, so that the data and state in GUI-client can used in global easily.
- Implement the global test button on the sidebar
    - If the configuration files are not provided, then jump to configuration with a guide
    - If all configuration files are provided, then start test and update global states.
    - Jump to the dashboard for real-time visualization results when test finished.
- Constantly update the test configuration generating form, so that it matches all the latest API of caliper-cli.

### gui-server
...

#### Next step and improvements

### Relevant Caliper Structures

### caliper-samples
This contains samples that may be run using the caliper-cli, and extended to include more adaptor scenarios. The package contains the following folders:
- benchmark: contains benchmark configuration files
- src: contains smart contracts to be tested
- network: contains blockchain (network) configuration files

### caliper-core
Contains all the Caliper core code. Interested developers can follow the code flow from the above `run-benchmark.js` file, that enters `caliper-flow.js` in the core package.

## Creating a New Test Case

Currently the easiest way to create a new test case is to extend or add to the `caliper-samples` package. You have options from this point:
- run the integration tests to get the CLI module installed, then use the command line comand `caliper benchmark run -c benchmark/my-config.yaml -n network/my-network.yaml -w <path>/caliper-samples`
- directly run `node ./packages/caliper-cli/caliper.js benchmark run -c benchmark/my-config.yaml -n network/my-network.yaml -w ./packages/caliper-samples` from the root folder

Before adding a benchmark, please inspect the `caliper-samples` structure and example benchmarks; you will need to add your own configuration files for the blockchain system under test, the benchmark configuration, smart contracts, and test files (callbacks) that interact with the deployed smart contract. You can then run the benchmark using the `run-benchmark.js` script and passing your configuration files that describe that benchmark.
