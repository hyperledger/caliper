/**
 * Copyright 2017 HUAWEI All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * @file, Batch builder interface for usecases, each use cases has to override buildBatch and calculateAddress methods 
 */


'use strict'

class BatchBuilder {
    constructor() {
    }

    buildBatch(args) {
        throw new Error('buildBatch is not implemented for this application!!');
    }

    calculateAddress(name) {
        throw new Error('calculateAddress is not implemented for this application!!');
    }

}

module.exports = BatchBuilder;
