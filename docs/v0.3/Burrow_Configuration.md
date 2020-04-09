---
layout: v0.3
title:  "Burrow Configuration"
categories: config
permalink: /v0.3/burrow-config/
---

> The latest supported version of Hyperledger Burrow is v0.23.1

* The NPM package is in Alpha, so please contact us on RocketChat if you have any issues!

## Using Alternative Burrow Versions
If you wish to use a specific Burrow version, it is necessary to modify the `@monax/burrow` version levels listed as dependancies in `packages/caliper-burrow/package.json`, and then rebuild the Caliper project using the following commands issued at the root Caliper project location:

- `npm install`
- `npm run repoclean`
- `npm run bootstrap`

## Issues

Burrow integration is currently in an early phase of development, if you think you can help us out, please send a PR!

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.
