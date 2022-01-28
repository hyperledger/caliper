---
layout: vNext
title:  "Declarative Workloads"
categories: reference
permalink: /vNext/declarative-workload-module/
order: 4
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
- [Implementing the DeclarativeWorkloadModuleBase class](#implementing-the-declarativeworkloadmodulebase-class)
  - [submitWithArguments](#submitwitharguments)
## Overview
`DeclarativeWorkloadModuleBase` is a base class that can be implemented for declaratively assigning workload parameters. The Contracts, Functions and Parameters for test runs are specified under `arguments.behavior`.

## Example

```yaml
workload:
  module: declarative
    arguments:
      parameterOne: param1
      parameterTwo: 42
      behavior:
        contracts:
        - name: contract1
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
- A `contracts` list is defined.
- `contracts` contains `name`, followed by `functions` which has `function1` present in it as the only list item.
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
|function|list|List of Function descriptions|

### Functions

Used to specify the list of functions under a contract to be tested. Each `functions` list element has the following format.

|Property|Type|Description|
|:-------|:---|:----------|
|name    |string|Name of SUT function to be tested|
|parameters|list|List of Parameter descriptions|

### Parameters

Used to specify different generated parameters for each function.
|Property   |Type  |Description                                        |
|:----------|:-----|:--------------------------------------------------|
|type       |string|Assigned a value according to the type of paramter used|
|name       |string|Parameter Name                                         |
|options    |string|Additional information about the parameter definition   |

The `parameters` list can contain one or more of the following items.

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
|options.name    |string|Parameter Name. Should refer to a base-class provided variable. |

#### List Element

Value provider format for selecting an item from a given list.
##### Example

```yaml
- name: selectedColor
  type: list_element
  options:
    list: ['red', blue', 'green'],
    selector:
      type: variable_reference
      options:
        name: txIndex #assuming this is defined under module.arguments
```
##### Attributes

|Property|Type|Description|
|:-------|:---|:----------|
|options.list|list|List from which element is chosen.|
|options.selector|object|Contains information about any valid numeric value provider. Used for selecting elements by index.|


#### Formatted String

Value provider format for generating formatted strings.

##### Example

```yaml
- name: generatedString
  type: formatted_string
  options:
    format: 'example_{1}_{2}'
    parts:
      - type: parameter_reference
        options:
          name: marbleIndex
      - type: variable_reference
        options:
          name: txIndex
```

##### Attributes

|Property|Type  |Description|
|:-------------|:-----|:----------|
|options.format|string|Specifies format and placeholders for variables. Placeholders are specified using this syntax: `{variable_no}`. 1-based indexing of the `parts` list is used for this purpose.|
|options.parts |list  |Specifies variable and parameter reference value providers for use in string|

## Implementing the DeclarativeWorkloadModuleBase class

### submitWithArguments

The `DeclarativeWorkloadModuleBase` is exported as a module. In order to use it, `submitWithArguments()` needs to be implemented by the user. It accepts `generatedArguments` during a Caliper run.