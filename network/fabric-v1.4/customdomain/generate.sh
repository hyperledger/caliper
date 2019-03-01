#!/usr/bin/env bash
/home/panyu/go-workspace/src/github.com/hyperledger/fabric/release/linux-amd64/bin/cryptogen generate --config=./crypto-config.yaml
/home/panyu/go-workspace/src/github.com/hyperledger/fabric/release/linux-amd64/bin/configtxgen -profile TwoOrgsOrdererGenesis -outputBlock twoorgs.genesis.block -channelID genesischannel 
/home/panyu/go-workspace/src/github.com/hyperledger/fabric/release/linux-amd64/bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx mychannel.tx -channelID mychannel

# Rename the key files we use to be key.pem instead of a uuid
for KEY in $(find crypto-config -type f -name "*_sk"); do
    KEY_DIR=$(dirname ${KEY})
    mv ${KEY} ${KEY_DIR}/key.pem
done
