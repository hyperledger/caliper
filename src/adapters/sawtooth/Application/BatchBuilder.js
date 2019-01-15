/**
 * Copyright 2017 HUAWEI All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */


'use strict';

/**
 * Batch builder class
 */
class BatchBuilder {
    /**
     * Constructor
     */
    constructor() {
    }

    /**
     * Build batch
     * @param {*} args transactions arguments
     */
    buildBatch(args) {
        throw new Error('buildBatch is not implemented for this application!!');
    }

    /**
     * Calculate address
     * @param {String} name address name
     */
    calculateAddress(name) {
        throw new Error('calculateAddress is not implemented for this application!!');
    }

}

module.exports = BatchBuilder;
