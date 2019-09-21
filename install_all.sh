#!/usr/bin/env bash

npm install
npm run repoclean
npm run bootstrap

cd ./packages/caliper-tests-integration/
npm run start_verdaccio
npm run publish_packages
npm run install_cli
npm run cleanup
cd ./../..
