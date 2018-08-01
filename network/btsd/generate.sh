#!/usr/bin/env bash
~/go/src/github.com/hyperledger/fabric/build/bin/cryptogen generate --config=./crypto-config.yaml
~/go/src/github.com/hyperledger/fabric/build/bin/configtxgen -profile BTSDGenesis -outputBlock btsd.genesis.block
~/go/src/github.com/hyperledger/fabric/build/bin/configtxgen -profile BTSDChannel -outputCreateChannelTx mychannel.tx -channelID BTSDChannel