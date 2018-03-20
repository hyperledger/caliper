#!/bin/bash
#export GOPATH="$HOME/go"
#export GOROOT="/usr/local/go"
#export NODEHOME="/usr/local/bin/node"
#export PATH=$PATH:$GOROOT/bin:$NODEHOME/bin
cd `dirname $0`/..
node ./scripts/test.js $1 -c ./benchmark/$1/$2 > output.log #node ./scripts/test.js $1 -n ./benchmark/$1/$2 > output.log
