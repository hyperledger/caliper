# Hyperledger Caliper GUI 
![caliper-log](./resources/caliper-logo.png)

## Get Started

Both the dashboard and server must be started:
1. Start `caliper-gui-server` with the command `npm start`
2. Start `caliper-gui-dashboard` with the command `npm start`

If using MongDB or some other databases, please make sure the DB are installed and connected.

## Caliper Server
The server provides an API that supports the configuration files and testing result data transmission between Caliper GUI and Caliper-core modules.

**MongoDB** is required to start the API and Server.

*TODO: integrate with stable version of caliper-cli and caliper-core modules, and re-format the received data into the format that can be easily visualizaed by Caliper GUI visualizations.*

## Caliper GUI
Caliper GUI provides multiple visualizations for the benchmark data from Caliper CLI. The supported visualizations are:

- Transaction latency
- Transaction throughput
- Read latency
- Read throughput

*TODO: using Redux to support global state tree, and making all the test functionalities globally accessible in the GUI applications*

*TODO: consider using Electron to wrap the GUI and make it a desktop application for Mac/Linux/Windows.*

## Contributing

Please refer to the Hyperledger Caliper contributing manual. All contribution are welcomed!

## Licensing

- Copyright 2019 Jason You Hyperledger Caliper
- Licensed under Apache 2.0
