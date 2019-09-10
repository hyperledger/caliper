---
layout: pageNext
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
