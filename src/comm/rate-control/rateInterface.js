'use strict'

class RateInterface {
    constructor(blockchain, opts) {
        this.blockchain = blockchain;
        this.options = opts;
    }

    /**
     * Initialise the rate controller with a passed msg object
     * @param {*} msg 
     */
    init(msg) {
        throw new Error('init is not implemented for this blockchain system');
    }    

    /**
     * Perform the rate control action based on knowledge of the start time, current index, and current results.
     * @param {*} start 
     * @param {*} idx 
     * @param {*} results 
     */
    applyRateControl(start, idx, results) {
        throw new Error('applyRateControl is not implemented for this blockchain system');
    }
}

module.exports = RateInterface;