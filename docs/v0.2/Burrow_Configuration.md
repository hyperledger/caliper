---
layout: v0.2
title:  "Burrow Configuration"
categories: config
permalink: /v0.2/burrow-config/
---

> The latest supported version of Hyperledger Burrow is v0.23.1

* The NPM package is in Alpha, so please contact us on RocketChat if you have any issues!

## Using Alternative Burrow Versions
If you wish to use a specific Sawtooth version, it is necessary to modify the `@monax/burrow` version levels listed as dependancies in `packages/caliper-burrow/package.json`, and then rebuild the Caliper project using the following commands issued at the root Caliper project location:

- `npm install`
- `npm run repoclean`
- `npm run bootstrap`

## Issues

Burrow integration is currently in an early phase of development, if you think you can help us out, please send a PR!