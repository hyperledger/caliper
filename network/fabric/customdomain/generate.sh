#!/usr/bin/env bash
bin/cryptogen generate --config=./crypto-config.yaml
bin/configtxgen -profile TwoOrgsOrdererGenesis -outputBlock twoorgs.genesis.block
bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx mychannel.tx -channelID mychannel