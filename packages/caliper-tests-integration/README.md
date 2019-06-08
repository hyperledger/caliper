# caliper-Integration-Tests

Welcome to the Caliper Integration test readme. 
 
## Integration tests for Hyperledger Composer

To run the tests, make sure you've lerna bootstrapped and then run the script that starts the integration tests with 

```
./scripts/run-integration-tests.sh
```
The integration tests will start up a Verdaccio server, publish the Caliper packages, install the caliper-cli package, and then run a benchmark targetting a platform.

As long as the script finishes, it should tidy up all the artifacts that are created during tests but if it fails then you 
may have to do a manual clean up using

```
docker ps -aq | xargs docker kill
docker rm $(docker ps -aq)
```

## License <a name="license"></a>
Hyperledger Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the [LICENSE](../../LICENSE) file. Hyperledger Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.
