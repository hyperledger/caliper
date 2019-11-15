# Caliper Application Example(s)

Basic CLI driven sample(s)

## Working Benchmarks (local)
- Fabric
```bash
caliper benchmark run -w <workspace path> -c benchmark/simple/config.yaml -n network/fabric-v1.4/2org1peercouchdb/fabric-node.yaml
```

- Sawtooth
```bash
caliper benchmark run -w <workspace path> -c benchmark/simple/config-sawtooth.yaml -n network/sawtooth/simplenetwork/sawtooth.json 
```

- FISCO BCOS
```
caliper benchmark run -w <workspace path> -c benchmark/fisco-bcos/transfer/solidity/config.yaml -n network/fisco-bcos/4nodes1group/fisco-bcos.json
```

## Benchmarks Under Construction

- Burrow
```bash
caliper benchmark run -w <workspace path> -c benchmark/simple/config.yaml -n network/burrow/simple/burrow.json
```

- Iroha
```bash
caliper benchmark run -w <workspace path> -c benchmark/simple/config-iroha.yaml -n network/iroha/simplenetwork/iroha.json 
```

- FISCO BCOS
```bash
caliper benchmark run -w <workspace path> -c benchmark/fisco-bcos/transfer/solidity/config.yaml -n network/fisco-bcos/4nodes1group/fisco-bcos.json
```

## Starting and using a Zookeeper client

```bash
caliper zooclient start -w <workspace path> -n network/fabric-v1.4/2org1peercouchdb/fabric-node.json -a 127.0.0.1:2181
caliper benchmark run -w <workspace path> -c benchmark/simple/config-zookeeper.yaml  -n network/fabric-v1.4/2org1peercouchdb/fabric-node.json
```
