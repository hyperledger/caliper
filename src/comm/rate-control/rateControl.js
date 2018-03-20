'use strict'

var RateControl = class {
    constructor(rateControl, blockchain) {
        console.log('*****', rateControl);
        switch (rateControl.type) {
            case 'fixed-rate':
                var interval = require('./fixedRate.js');
                this.controller = new interval(blockchain, rateControl.opts);
                break
            default:
                throw new Error('Unknown rate control type ' + rateControl.type);
        }
    }

    /**
    * Initialise the rate controller with a passed msg object
    * @param msg
    * @return {Promise}
    */
    init(msg) {
        return this.controller.init(msg);
    }

    /**
     * Perform the rate control action based on knowledge of the start time, current index, and current results.
     * @param {*} start
     * @param {*} idx
     * @param {*} results
     * @return Promise
     */
    applyRateControl(start, idx, results) {
        return this.controller.applyRateControl(start, idx, results);
    }

}

module.exports = RateControl;