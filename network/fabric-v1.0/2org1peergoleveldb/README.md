# About the network

This directory contains a sample __Fabric v1.0__ network with the following properties.

## Topology
* The network has 2 participating organizations.
* The network has 1 orderer node in solo mode.
* Each organization has 1 peer in the network.
* The peers use __GoLevelDB__ as the world-state database.
* A channel named `mychannel` is created and the peers are joined.
* A sample chaincode is installed and instantiated. See the [configuration section](#platform-configurations) for details.

## Communication protocol
* The `docker-compose.yaml` file specifies a network __without TLS__ communication.
* The `docker-compose-tls.yaml` file specifies a network __with TLS__ communication.

The configuration files names (with or without the `-tls` part) indicate which network type it relies on. They are not distinguished further in the next sections.

## Platform configurations

The following network configuration files are available for the different platforms, containing the listed chaincodes that will be deployed (installed and instantiated).

### Fabric
* `fabric-go(-tls).json` (__golang__ implementations) 
  * `marbles` __without__ CouchDB index metadata and rich query support.
  * `drm`
  * `simple`
  * `smallbank`