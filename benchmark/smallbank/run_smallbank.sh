cd ~/caliper/benchmark/smallbank
/opt/intel/storage-snapshot/sps-start.sh
node main.js -c config_long.yaml -n ../../network/fabric-v1.4/2org2peercouchdb/fabric-go-tls.json
/opt/intel/storage-snapshot/sps-stop.sh
#sleep 10
#/opt/intel/storage-snapshot/sps-start.sh
#node main.js -c config_long.yaml -n ../../network/fabric-v1.4/2org2peergoleveldb/fabric-go-tls.json
#/opt/intel/storage-snapshot/sps-stop.sh

