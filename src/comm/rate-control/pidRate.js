/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
* 
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict'

var RateInterface = require('./rateInterface.js');

/**
 * Discrete Time PID Controller for driving at a target loading (backlog transactions). This controller will aim to maintain a defined backlog
 * of transactions by modifying the driven TPS.
 * 
 * The target loading, initial TPS rate and gains for the controller must be specified within the options for the controller type:
 * "rateControl" : [{"type": "pid-rate", "opts": {"targetLoad": 10, "initialTPS": 4, "proportional": 0.0005, "integral": 0.0001, "derrivative": 0.005}}]
 */
class PidRate extends RateInterface {
    constructor(blockchain, options) {
        super(blockchain, options);
    }

    init(msg) {  
        this.targetLoad = this.options.targetLoad;
        this.tps = this.options.initialTPS;
        this.proportional = this.options.proportional;
        this.integral = this.options.integral;
        this.derrivative = this.options.derrivative;
        this.errorHistory = [0,0,0];
    }

    /**
    * Sleep based on targetting a specific Fabric working load through a PID control law
    * @param start {number}, generation time of the first transaction
    * @param txSeq {number}, sequence number of the current transaction
    * @param currentResults {Array}, current results
    * @return {promise}
    */
    applyRateControl(start, idx, currentResults) {
        // We steer the load by increasing/decreasing the sleep time to adjust the TPS using a discrete time PID
        // We will only observe currentResults growth once the txn is complete and a result is available
        // -at this point the txn will either be in state success/fail

        let sleep;

        // Only perform after the history has been filled
        if (currentResults.length < this.errorHistory.length) {            
            
            this.updateFactorVariables(currentResults, idx);
            sleep = 1000/this.tps;

            if ( sleep > 10 ) {
                return new Promise(resolve => setTimeout(resolve, sleep));
            } else {
                return Promise.resolve();
            }
        } else {
            // Construct discrete time PID control to modify tps
            // u(k) = u(k-1) + a*e[k] + b*e[k-1] + c*e[k-2]
            // a = (Kp + Ki*(t/2) + Kd/t)
            // b = (-Kp + Ki*(t/2) -2*Kd/t)
            // c = Kd/t

            // What is the current transaction backlog error e?
            let currentLoadError = this.updateFactorVariables(currentResults, idx);

            // Determine Controller Coeffients
            // sleep is the previous time interval, t
            sleep = 1000/this.tps;
            let a = this.proportional + (this.integral*sleep/2) + (this.derrivative/sleep);
            let b = -this.proportional + (this.integral*sleep/2) - (2*this.derrivative/sleep);
            let c = this.derrivative/sleep;

            // Determine new signal (tps)
            this.tps = this.tps + a*this.errorHistory[0] + b*this.errorHistory[1] + c*this.errorHistory[2];

            sleep = 1000/this.tps;

            if ( sleep > 10 ) {
                return new Promise(resolve => setTimeout(resolve, sleep));
            } else {
                return Promise.resolve();
            }
        }        
    }

    updateFactorVariables(results, idx){
        // Results are an array with content {id, status, time_crete, time_final, time_endorse, time_order}
        // They only exist within the result set once a transaction has been completed
        
        let pending = idx - results.length;
        
        // update the error history of pending transactions
        // = what you want - what you have
        let error = this.targetLoad - pending;
        this.errorHistory.unshift(error);
        this.errorHistory.pop();

        return error;
    }
}

module.exports = PidRate;