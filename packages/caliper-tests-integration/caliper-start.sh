#!/bin/bash

# document: https://hyperledger.github.io/caliper/vLatest/installing-caliper/

LEDGERSTATE=goleveldb

NODE_VER=$(node --version)
if [ $NODE_VER != "v8.16.1" ]; then
    echo "Node version invalid ... try: nvm use lts/carbon current is ${NODE_VER}"
    exit 1
fi

set -v
npm init -y
npm install --only=prod @hyperledger/caliper-cli
npx caliper bind --caliper-bind-sut fabric --caliper-bind-sdk 1.4.1
npx caliper benchmark run --caliper-workspace ../caliper-samples --caliper-benchconfig benchmark/marbles/config.yaml --caliper-networkconfig network/fabric-v1.4.1/2org1peer$LEDGERSTATE/fabric-go.yaml