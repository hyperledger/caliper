---
layout: vNext
title:  "Sawtooth Configuration"
categories: config
permalink: /vNext/sawtooth-config/
---

> The latest supported version of Hyperledger Sawtooth is v1.0

## Using Alternative Sawtooth Versions
If you wish to use a specific Sawtooth version, it is necessary to modify the `protocol-buffers` and `sawtooth-sdk` version levels listed as dependancies in `packages/caliper-sawtooth/package.json`, and then rebuild the Caliper project using the following commands issued at the root Caliper project location:

- `npm install`
- `npm run repoclean`
- `npm run bootstrap`

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.
