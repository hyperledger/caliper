# Caliper Application Example(s)

Basic CLI driven sample(s)

## Working Benchmarks (local)
- Fabric
```bash
caliper benchmark run -w <workspace path> -c benchmark/simple/config.yaml -n network/fabric-v1.4/2org1peercouchdb/fabric-node.json
```

- Fabric CCP
```bash
caliper benchmark run -w <workspace path> -c benchmark/simple/config.yaml -n .network/fabric-v1.2/2org1peercouchdb/fabric-ccp-node.json
```

- Composer
```bash
caliper benchmark run -w <workspace path> -c benchmark/composer/config.yaml -n network/fabric-v1.3/2org1peercouchdb/composer.json
```

- Sawtooth
```bash
caliper benchmark run -w <workspace path> -c benchmark/simple/config-sawtooth.yaml -n network/sawtooth/simplenetwork/sawtooth.json 
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

## Starting and using a Zookeeper client

```bash
caliper zooclient start -w <workspace path> -n network/fabric-v1.4/2org1peercouchdb/fabric-node.json -a 127.0.0.1:2181
caliper benchmark run -w <workspace path> -c benchmark/simple/config-zookeeper.yaml  -n network/fabric-v1.4/2org1peercouchdb/fabric-node.json
```
