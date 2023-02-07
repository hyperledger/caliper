# Hyperledger Caliper Developer Documentation

## Overview

The current documentation gives an in-depth technical insight into the design and internal workings of Hyperledger Caliper. The aim of this document is to make contributions to the code-base easier and provide a basis for discussing architectural changes and enhancements - in the form of proposals.

## Contributing to the document

The document is split into multiple parts, following the main modules of Caliper. This allows the figures to target specific modules and their interactions instead of being all cluttered (resembling reverse-engineered figures) by containing everything.

The contributions to the current development documentation (this README) follows the traditional [contributing guide](./../CONTRIBUTING.md). Figures (e.g., class and sequence diagrams) are core building block of this documentation. In order to allow the meaningful version control of figures, [PlantUML](https://plantuml.com/) is used to create them. Every new figure source (the `.puml` file) and its resulting PNG output must be placed into the `dev-docs/figures` directory. 

> The [PlantUML VSCode extension](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml) is a convenient tool to edit and quickly visualize `puml` files. It can also generate the required PNG outputs. Moreover, the current directory contains a `generate-figure.sh` script that uses a containerized version of PlantUML to generate the selected figure next to its source. Usage example (from the current directory): `generate-figure.sh ./figures/worker-classes.puml`. Note that [Docker](https://docs.docker.com/engine/install/) is required to run the script.

## Proposals

Larger architectural changes (i.e., not just minor, local refactorings) first must be proposed in the form of a separate document. The document must: 
1. Provide a short overview of the proposed changes.
1. Detail the shortcomings of the current architecture, i.e., why the changes are necessary and what are their benefits.
1. Identify the affected parts of Caliper.
1. Detail the proposed changes to the code-base.
1. Discuss the potential breaking changes in the APIs.
1. Split the proposed changes into smaller work items if possible.

The proposals must be placed into the `dev-docs/proposals` directory following the traditional [contributing guide](./../CONTRIBUTING.md). The proposal file names must follow the `<PR number>-<short proposal title>` format. The `proposals/0000-proposal-template.md` file serves as the template for new proposals. Copy and rename the file to start working on a proposal. The practice for including figures in a proposal is the same as for this document. 

> You must prefix your figure sources and outputs with the PR number of the proposal, so figures of different proposal don't get mixed. To avoid guessing the PR number, you can first open an empty draft PR then continue your work using that PR number. That way the project maintainers will also be aware of the planned proposal and can aid you from the start (possibly avoiding potentially major revisions later on).

The content of the proposals will be discussed among the maintainers and contributor mainly in the form of PR comments and reviews. The proposal is deemed accepted once the corresponding PR is merged. Once the content of the proposal has been implemented, then the corresponding documentation and figures must be incorporated into the main developer documentation.

## Table of contents

> The developer documentation is work in progress. Available contents are (will be) listed below.