# Caliper local publishing and integration test guide

Welcome to the Caliper Integration test readme. 

Once you performed the necessary steps to [build Caliper](https://hyperledger.github.io/caliper/docs/1_Getting_Started.html#building-caliper), you can move on to publishing the npm packages locally, then installing the Caliper CLI to start your benchmarks.

The following steps must be performed to publish and install the CLI package:
1. Start a local Verdaccio server to publish to
2. Publish the packages from the Caliper repository to the Verdaccio server
3. Install the CLI package from the Verdaccio server
4. Run the integration tests or any [sample benchmark](https://hyperledger.github.io/caliper/docs/1_Getting_Started.html#run-a-sample-benchmark)

The following commands must be executed from the `packages/caliper-tests-integration` directory:
```bash
cd ./packages/caliper-tests-integration
``` 

> If you don't care about the individual step descriptions, jump to the [One-step install](#one-step-install) section.

## Starting Verdaccio
To setup and start a local Verdaccio server, run the following npm command:
```bash
npm run start_verdaccio
```

In case of success, the output should resemble the following:
```
[PM2] Spawning PM2 daemon with pm2_home=.pm2
[PM2] PM2 Successfully daemonized
[PM2] Starting /home/user/projects/caliper/packages/caliper-tests-integration/node_modules/.bin/verdaccio in fork_mode (1 instance)
[PM2] Done.
┌───────────┬────┬──────┬────────┬────────┬─────────┬────────┬─────┬───────────┬────────┬──────────┐
│ App name  │ id │ mode │ pid    │ status │ restart │ uptime │ cpu │ mem       │ user   │ watching │
├───────────┼────┼──────┼────────┼────────┼─────────┼────────┼─────┼───────────┼────────┼──────────┤
│ verdaccio │ 0  │ fork │ 115203 │ online │ 0       │ 0s     │ 3%  │ 25.8 MB   │ user   │ disabled │
└───────────┴────┴──────┴────────┴────────┴─────────┴────────┴─────┴───────────┴────────┴──────────┘
 Use `pm2 show <id|name>` to get more details about an app
```
 
## Publishing the packages
Once Verdaccio is running, you can run the following command to publish the Caliper packages locally:
```bash
npm run publish_packages
```

Among the logs, you should see something similar at the end of every `=== Tarball Details ===` section: `+ caliper-<package>@0.1.0`

## Installing the CLI package
Once the packages are published locally, you can install the CLI package (and its dependencies):
```bash
npm run install_cli
```

The installation might take some time (you can ignore the warnings), but after a while you should see something like the following:
```
+ caliper-cli@0.1.0
updated 1 package in 66.969s

Installed test package caliper-cli from local npm server (attempt 1/5)
```

Congratulations, at this point the `caliper` binary is globally installed on your machine!

You can confirm it by running `caliper -v` which should output `v0.1.0`.

## Cleaning up Verdaccio
After you installed the Caliper CLI, you can stop the Verdaccio server and clean up after it:
```bash
npm run cleanup
```

## One-step install
For those who would like to modify the codebase and run benchmarks against the new codebase (or just don't care about the individual steps of publishing), a single npm command is available to perform the first three steps:

```bash
npm run e2e_install
```

It is equivalent to running:
```bash
npm run cleanup && npm run start_verdaccio && npm run publish_packages && npm run install_cli && npm run cleanup
```

## Running the integration tests
Once the CLI is installed, you can run the integration tests for a given platform.

* For Fabric: `BENCHMARK=fabric-ccp npm run run_tests`
* For Composer: `BENCHMARK=composer npm run run_tests`

As long as the script finishes, it should tidy up all the artifacts that are created during tests, but if it fails, then you may have to do a manual clean up (removing **every running Docker container**) executing the following commands:

```bash
docker ps -aq | xargs docker kill
docker rm $(docker ps -aq)
```

Alternatively, you can run any benchmark through the CLI, as [described in the documentation](https://hyperledger.github.io/caliper/docs/1_Getting_Started.html#run-a-sample-benchmark)

## Troubleshooting
The general guidelines for [building Caliper](https://hyperledger.github.io/caliper/docs/1_Getting_Started.html#building-caliper) also applies here.

Moreover, *permission denied* issues can occur when installing the CLI globally, depending how the global install directory is configured for npm.

To query the global install directory of npm, run `npm config get prefix`

If your user cannot write this directory, then either grant the necessary permissions, or set an install directory that is accessible by your user, e.g.: `npm config set prefix ~/.local`

## License <a name="license"></a>
Hyperledger Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the [LICENSE](../../LICENSE) file. Hyperledger Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.
