#!/bin/bash
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Print all commands.
set -v

# Grab the parent (generator_tests/fabric) directory.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${DIR}"

if [[ ! -d "bin" || ! -d "config" ]]; then
  curl -sSL -k https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh | bash -s -- --fabric-version 2.4.3 binary
fi

# change default settings (add config paths too)
export CALIPER_PROJECTCONFIG=../caliper.yaml

# Install yo
npm install --global yo@3.1.1

# back to this dir
cd ${DIR}

# Run benchmark generator using generator defaults (specify invalid values for options)
${GENERATOR_METHOD} -- --workspace 'myWorkspace' --contractId 'mymarbles' --contractVersion 'v0' --contractFunction 'queryMarblesByOwner' --contractArguments '["Alice"]' --workers 'marbles' --benchmarkName 'A name for the marbles benchmark' --benchmarkDescription 'A description for the marbles benchmark' --label 'A label for the round' --rateController 'fixed-rate' --txType 'txDuration' --txDuration 'marbles'

cd ../
# bind the sdk into the packages directory as it will search for it there, this ensures it doesn't contaminate real node_modules dirs (2.2 will work with a 1.4 fabric)
# Note: Fabric 2.2 binding is cached in CI
export FABRIC_VERSION=2.2.14
export NODE_PATH="$SUT_DIR/cached/v$FABRIC_VERSION/node_modules"
if [[ "${BIND_IN_PACKAGE_DIR}" = "true" ]]; then
    mkdir -p $SUT_DIR/cached/v$FABRIC_VERSION
    pushd $SUT_DIR/cached/v$FABRIC_VERSION
    ${CALL_METHOD} bind --caliper-bind-sut fabric:$FABRIC_VERSION
    popd
fi

export PATH=${DIR}/bin:$PATH

export MICROFAB_CONFIG='{
    "tls": {
        "enabled": true
    },
    "ordering_organizations": {
        "name": "Orderer"
    },
    "endorsing_organizations":[
        {
            "name": "Org1"
        },
        {
            "name": "Org2"
        }
    ],
    "channels":[
        {
            "name": "mychannel",
            "endorsing_organizations":[
                "Org1",
                "Org2"
            ]
        }
    ]
}'
export CHAINCODE_NAME="marbles"

docker run -d --name microfab -p 8080:8080 -p 2000-3000:2000-3000 --add-host host.docker.internal:host-gateway \
    -e MICROFAB_CONFIG="${MICROFAB_CONFIG}" \
    ghcr.io/hyperledger-labs/microfab:0.0.19

sleep 5

export CFG=$DIR/_cfg/uf
rm -rf $CFG
mkdir -p $CFG

npm install -g @hyperledger-labs/weft
curl -s https://console.127-0-0-1.nip.io:8080/ak/api/v1/components --insecure | weft microfab -w $CFG/_wallets -p $CFG/_gateways -m $CFG/_msp -f

export FABRIC_CFG_PATH=$DIR/config

export ORDERER_CA=$CFG/_msp/tls/orderer/tlsca-orderer-cert.pem
export ORDERER_ADDRESS=orderer-api.127-0-0-1.nip.io:8080

export CORE_PEER_CLIENT_CONNTIMEOUT=15s
export CORE_PEER_DELIVERYCLIENT_CONNTIMEOUT=15s

export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_MSPCONFIGPATH=$CFG/_msp/Org1/org1admin/msp
export CORE_PEER_ADDRESS=org1peer-api.127-0-0-1.nip.io:8080
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=$CFG/_msp/tls/org1peer/tlsca-org1peer-cert.pem

pushd $DIR/src/${CHAINCODE_NAME}/go
go mod vendor
popd

peer lifecycle chaincode package ${CHAINCODE_NAME}.tar.gz \
    --path $DIR/src/${CHAINCODE_NAME}/go \
    --lang golang \
    --label ${CHAINCODE_NAME}

export CHAINCODE_ID=$(peer lifecycle chaincode calculatepackageid ${CHAINCODE_NAME}.tar.gz)

peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz \
    --tls \
    --cafile $ORDERER_CA \
    --orderer $ORDERER_ADDRESS

peer lifecycle chaincode approveformyorg \
    --channelID mychannel \
    --name mymarbles \
    -v v0 \
    --package-id $CHAINCODE_ID \
    --sequence 1 \
    --connTimeout 15s \
    --signature-policy "OR('Org1MSP.member','Org2MSP.member')" \
    --tls \
    --cafile $ORDERER_CA \
    --orderer $ORDERER_ADDRESS

export CORE_PEER_LOCALMSPID=Org2MSP
export CORE_PEER_MSPCONFIGPATH=$CFG/_msp/Org2/org2admin/msp
export CORE_PEER_ADDRESS=org2peer-api.127-0-0-1.nip.io:8080
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=$CFG/_msp/tls/org2peer/tlsca-org2peer-cert.pem

peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz \
    --tls \
    --cafile $ORDERER_CA \
    --orderer $ORDERER_ADDRESS

peer lifecycle chaincode approveformyorg \
    --channelID mychannel \
    --name mymarbles \
    -v v0 \
    --package-id $CHAINCODE_ID \
    --sequence 1 \
    --connTimeout 15s \
    --signature-policy "OR('Org1MSP.member','Org2MSP.member')" \
    --tls \
    --cafile $ORDERER_CA \
    --orderer $ORDERER_ADDRESS

peer lifecycle chaincode commit \
    --channelID mychannel \
    --name mymarbles \
    -v v0 \
    --sequence 1  \
    --connTimeout 15s \
    --signature-policy "OR('Org1MSP.member','Org2MSP.member')" \
    --tls \
    --cafile $ORDERER_CA \
    --orderer $ORDERER_ADDRESS

peer lifecycle chaincode querycommitted \
    --channelID=mychannel \
    --tls \
    --cafile $ORDERER_CA \
    --orderer $ORDERER_ADDRESS

dispose () {
    JOBS=$(jobs -p)
    if [ -n "$JOBS" ]; then
        echo "Killing jobs: $JOBS"
        kill $JOBS
    fi
    docker stop microfab && docker rm microfab

    cd ${DIR}
    rm -r myWorkspace/benchmarks
}

trap 'dispose' EXIT

cd ${DIR}
# Run benchmark generator not using generator defaults
rm -r myWorkspace/benchmarks
${GENERATOR_METHOD} -- --workspace 'myWorkspace' --contractId 'mymarbles' --contractVersion 'v0' --contractFunction 'queryMarblesByOwner' --contractArguments '["Alice"]' --workers 2 --benchmarkName 'A name for the marbles benchmark' --benchmarkDescription 'A description for the marbles benchmark' --label 'A label for the round' --rateController 'fixed-rate' --txType 'txDuration' --txDuration 10

# Run benchmark test
cd ../
${CALL_METHOD} launch manager --caliper-workspace 'fabric/myWorkspace' --caliper-networkconfig 'networkconfig.yaml' --caliper-benchconfig 'benchmarks/config.yaml' --caliper-flow-only-test
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed run benchmark";
    dispose;
    exit ${rc};
fi
