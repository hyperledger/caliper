---
layout: vNext
title:  "Declarative Workload Configuration"
categories: docs
permalink: /vNext/declarative-workload-module/
---
## Table of contents

- [Overview](#overview)
- [Example](#example)
- [Hierarchy](#hierarchy)
  - [Contracts](#contracts)
  - [Functions](#functions)
  - [Parameters](#parameters)
    - [Uniform Random](#uniform-random)
    - [Parameters Reference](#parameter-reference)
    - [Variable Reference](#variable-reference)
    - [List Element](#list-element)
    - [Formatted String](#formatted-string)

## Overview
`DeclarativeWorkloadModuleBase` is a Caliper `WorkloadModule` implementation that is used through assiging `declarative` to `workload.module` in the Benchmark Configuration file. The Contracts, Functions and Parameters for test runs are specified under `arguments.behavior`.

## Example

```yaml
workload:
    module: declarative
        arguments:
            parameterOne: param1
            parameterTwo: 42
            behavior:
                contractSelection: 'uniform_random_list_element'
                contracts:
                - name: contract1
                  functionSelection: 'uniform_random_list_element'
                  functions:
                  - name: function1
                    parameters:
                    - name: randomNumber
                      type: uniform_random
                      options:
                        min: 10
                        max: 100
```
The example above means the follows:
- The WorkloadModule used here is `declarative`.
- The `roundArguments` taken in by Caliper are `parameterOne`, assigned the value of `'param1'` and `parameterTwo` assigned the value of `42`.
- The `arguments.behavior` section specifies the declared properties of the workload module.
- `contractSelection` specifies how a contract will be chosen from a `contracts` list.
- `contracts` contains `name` and `functionSelection`, followed by `functions` which has `function1` present in it as the only list item.
- `functions` contains `name` and `parameters`.
- `parameters` contains a value provider with the `name` randomNumber of `type` uniform_random. This generates a random number between 10 and 100 for the parameter. 

## Hierarchy
Under `arguments.behavior`, `contracts` is the top layer. It consists of a list of contracts to be tested. Within a single `contracts` list element, `functions` property holds the list of all functions present under that contract. Similarly, under each `functions` list item, there is a `parameters` list which has different types of user defined parameters under it.

### Contracts

Used to specify the list of contracts to be tested. Each `contracts` list element has the following format.

|Property|Type       |Description|
|:-------|:----------|:----------|
|name    |string     |Name of SUT contract to be tested|
|functionSelection|string|Type of contract picking logic|
|function|list|List of Contract functions|

### Functions

Used to specify the list of functions under a contract to be tested. Each `functions` list element has the following format.

|Property|Type|Description|
|:-------|:---|:----------|
|name    |string|Name of SUT function to be tested|
|parameters|list|List of user-defined parameters to be generated|

### Parameters

Used to specify different generated parameters for each function. The `parameters` list can contain one or more of the following items.

#### Uniform Random

Value provider format for generating a random number within a given range.

##### Example

```yaml
- name: randomNumber
  type: uniform_random
  options:
    min: 0
    max: 100
```
##### Attributes

|Property   |Type  |Description                                        |
|:----------|:-----|:--------------------------------------------------|
|type       |string|Assigned the value `uniform_random`                |
|name       |string|Parameter Name                                     |
|options.min|number|Mininum inclusive range for generated random number|
|options.max|number|Maximum inclusive range for generated random number|

#### Parameter Reference

Value Provider format for referencing a `module.arguments` item.

##### Example
```yaml
- name: referenceNumber
  type: parameter_reference
  options:
    name: marbleNumber #assuming this is defined under round.arguments
```
##### Attributes

|Property|Type|Description|
|:-------|:---|:----------|
|type    |string|Assigned the value `parameter_reference`|
|name    |string|Parameter name|
|options.name|string|Should be a variable name specified under `module.arguments`|

#### Variable Reference

Value Provider format for referencing a Caliper workload variable.

##### Example
```yaml
- name: referenceNumber
  type: variable_reference
  options:
    name: txIndex #a Caliper workload parameter
```
##### Attributes

|Property|Type|Description|
|:-------|:---|:----------|
|type    |string|Assigned the value `variable_reference`.|
|name    |string|Parameter name|
|options.name    |string|Parameter Name. Should refer to a Caliper variable. |

#### List Element

Value provider format for selecting an item from a given list.
##### Example

```yaml
- name: selectedColor
  type: list_element
  options:
    list: ['red', blue', 'green'],
    selector:
      type: parameter_reference
      options:
        name: marblePrefix #assuming this is defined under module.arguments
```
##### Attributes

|Property|Type|Description|
|:-------|:---|:----------|
|type    |string|Assigned the value `list_element`|
|name    |string|Parameter Name|
|options.list|list|List from which element is chosen.|
|options.selector|object|Contains information about `variable_reference` and `parameter_reference` item used to select list item.|


#### Formatted String

Value provider format for generating formatted strings.

##### Example

```yaml
- name: generatedString
  type: formatted_string
  options:
    format: '{1}'
    parts:
      - type: parameter_reference
        options:
          name: marbleIndex
```

##### Attributes

|Property|Type  |Description|
|:-------------|:-----|:----------|
|type          |string|Assigned the value `formatted_string`|
|name          |string|Parameter Name|
|options.format|string|Specifies format and placeholders for variables. Placeholders are specified using this syntax: `{variable_no}`.|
|options.parts |list  |Specifies variable and parameter reference value providers for use in string|
