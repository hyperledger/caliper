#!/bin/sh

# persistent pool requires known peer id
# copy prexisting tendermint priv keys
# to avoid regeneration

mkdir -p /tmp/chain
cp -r /chain /tmp
cd /tmp/chain
burrow start --validator-index=${NODEID} --config=.burrow_val${NODEID}.toml
