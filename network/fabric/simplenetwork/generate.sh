#!/usr/bin/env bash
~/go/src/github.com/hyperledger/fabric/build/bin/cryptogen generate --config=./crypto-config.yaml
~/go/src/github.com/hyperledger/fabric/build/bin/configtxgen -profile TwoOrgsOrdererGenesis -outputBlock twoorgs.genesis.block
~/go/src/github.com/hyperledger/fabric/build/bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx mychannel.tx -channelID mychannel