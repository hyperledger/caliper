#!/bin/bash

# document: https://hyperledger.github.io/caliper/vLatest/installing-caliper/

LEDGERSTATE=goleveldb # couchdb
VERSION=1.4.1 # 1.1
FILE=fabric-go-tls-ibp # fabric-go, fabric-go-tls

NODE_VER=$(node --version)
if [ $NODE_VER != "v8.16.1" ]; then
    echo "Node version invalid ... try: nvm use lts/carbon current is ${NODE_VER}"
    exit 1
fi

set -v
npm init -y
npm install --only=prod @hyperledger/caliper-cli
npx caliper bind --caliper-bind-sut fabric --caliper-bind-sdk $VERSION
set +v

echo "* Start testing with ledger state as ${LEDGERSTATE}"
set -v
npx caliper benchmark run --caliper-workspace ../caliper-samples --caliper-benchconfig benchmark/marbles/config.yaml --caliper-networkconfig network/fabric-v$VERSION/2org1peer$LEDGERSTATE/$FILE.yaml