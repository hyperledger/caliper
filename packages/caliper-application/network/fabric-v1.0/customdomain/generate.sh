#!/usr/bin/env bash

# if the binaries are not available, download them
if [[ ! -d "bin" ]]; then
  curl -sSL http://bit.ly/2ysbOFE | bash -s -- 1.0.0 1.0.0 0.4.14 -ds
fi

rm -rf ./crypto-config/
rm -f ./twoorgs.genesis.block
rm -f ./mychannel.tx

./bin/cryptogen generate --config=./crypto-config.yaml
./bin/configtxgen -profile TwoOrgsOrdererGenesis -outputBlock twoorgs.genesis.block -channelID syschannel
./bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx mychannel.tx -channelID mychannel

# Rename the key files we use to be key.pem instead of a uuid
for KEY in $(find crypto-config -type f -name "*_sk"); do
    KEY_DIR=$(dirname ${KEY})
    mv ${KEY} ${KEY_DIR}/key.pem
done
