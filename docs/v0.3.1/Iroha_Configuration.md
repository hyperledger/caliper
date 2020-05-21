---
layout: v0.3.1
title:  "Iroha Configuration"
categories: config
permalink: /v0.3.1/iroha-config/
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

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.
