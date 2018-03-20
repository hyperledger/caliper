#!/usr/bin/env bash

# Prior to generation, need to run:
# export FABRIC_CFG_PATH=<path to directory>

# The below assumes you have the relevant code available to generate the cryto-material
~/fabric/1_1_preview/bin/cryptogen generate --config=./crypto-config.yaml
~/fabric/1_1_preview/bin/configtxgen -profile OrgsOrdererGenesis -outputBlock orgs.genesis.block
~/fabric/1_1_preview/bin/configtxgen -profile OrgsChannel -outputCreateChannelTx mychannel.tx -channelID mychannel

# Rename the key files we use to be key.pem instead of a uuid
for KEY in $(find crypto-config -type f -name "*_sk"); do
    KEY_DIR=$(dirname ${KEY})
    mv ${KEY} ${KEY_DIR}/key.pem
done