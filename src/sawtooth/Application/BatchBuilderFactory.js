'use strict'

var SimpleBatchBuilder = require('./SimpleBatchBuilder.js')
var SmallBankBatchBuilder = require('./SmallBankBatchBuilder.js')

class BatchBuilderFactory {
    static getBatchBuilder(familyName, familyVersion) {
        let sawtoothContractVersion = '1.0'
        if (familyVersion === 'v0') {
            sawtoothContractVersion = '1.0'
        }

        if(familyName === 'simple') {
            return new SimpleBatchBuilder(familyName, sawtoothContractVersion);
        }
        else if(familyName === 'smallbank') {
            return new SmallBankBatchBuilder(familyName, sawtoothContractVersion);
        }
        else {
            throw new Error('There is no batch builder for '+ familyName +' and '+ familyVersion);
        }
   } 
}

module.exports = BatchBuilderFactory;
