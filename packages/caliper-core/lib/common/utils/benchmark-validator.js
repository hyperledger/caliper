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


'use strict';

const Logger = require('./caliper-utils').getLogger('benchmark-validator');

const PermittedObservers = ['none', 'local', 'prometheus'];
/**
 * Class for Benchmark validation
 */
class BenchmarkValidator {

    /**
     * Validate the bench configuration object
     * @param {Object} benchConfig the bench configuration object
     */
    static validateObject(benchConfig) {
        BenchmarkValidator.validateObserver(benchConfig);
    }

    /**
     * Validate the observer specified in the bench configuration object
     * @param {Object} benchConfig the bench configuration object
     */
    static validateObserver(benchConfig) {
        // Must be specified
        if (!benchConfig.hasOwnProperty('observer')) {
            Logger.info('No observer specified, will default to `none`');
            return;
        }
        // If specified must have type specified [local, prometheus]
        if (!benchConfig.observer.hasOwnProperty('type')) {
            BenchmarkValidator.throwMissingPropertyBenchmarkError('observer.type');
        }
        if (!PermittedObservers.includes(benchConfig.observer.type)) {
            BenchmarkValidator.throwInvalidPropertyBenchmarkError('observer.type', benchConfig.observer.type);
        }

        // Must have an integer interval specified if a non-null observer specified
        if (!(benchConfig.observer.type.localeCompare('none') === 0) && !benchConfig.observer.hasOwnProperty('interval')) {
            BenchmarkValidator.throwMissingPropertyBenchmarkError('observer.interval');
        }
        if (!PermittedObservers.includes(benchConfig.observer.type)) {
            BenchmarkValidator.throwInvalidPropertyBenchmarkError('observer.type', benchConfig.observer.type);
        }

        // If prometheus monitor specified, must be a prometheus observer or none
        if (benchConfig.monitor && benchConfig.monitor.type &&
            benchConfig.monitor.type.includes('prometheus') && (benchConfig.observer.type.localeCompare('local') === 0) ) {
            BenchmarkValidator.throwIncompatibleTypeBenchmarkError('observer.type.local', 'monitor.type.prometheus');
        }
    }

    /**
     * Throw a consistent error
     * @param {String} property property missing from benchmark configuration file
     */
    static throwMissingPropertyBenchmarkError(property) {
        throw new Error(`Benchmark configuration is missing required property '${property}'`);
    }

    /**
     * Throw a consistent error
     * @param {String} property property missing from benchmark configuration file
     * @param {String} value the set value
     */
    static throwInvalidPropertyBenchmarkError(property, value) {
        throw new Error(`Benchmark configuration has an invalid property '${property}' value of '${value}'`);
    }

    /**
     * Throw a consistent error
     * @param {String} properties0 the set properties0
     * @param {String} properties1 the set properties1
     */
    static throwIncompatibleTypeBenchmarkError(properties0, properties1) {
        throw new Error(`Benchmark configuration has an incompatible types of '${properties0}' and '${properties1}'`);
    }

}

module.exports = BenchmarkValidator;
