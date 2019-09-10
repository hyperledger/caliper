---
layout: page
title:  "Iroha Configuration"
categories: config
permalink: /vLatest/iroha-config/
---

> The latest supported version of Hyperledger Iroha is v1.0 beta-3

* The npm package is in **alfa phase**, so if you have some problems with installing or compilation - please contact [Iroha maintainers](https://github.com/hyperledger/iroha/issues).

## Using Alternative Iroha Versions
If you wish to use a specific Iroha version, it is necessary to modify the iroha-lib version levels listed as dependancies in `packages/caliper-iroha/package.json`, and then rebuild the Caliper project using the following commands issued at the root Caliper project location:

- `npm install`
- `npm run repoclean`
- `npm run bootstrap`

## Issues

Iroha integration is currently in an early phase of development, if you think you can help us out, please send a PR!