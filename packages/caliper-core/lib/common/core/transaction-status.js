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

/**
 * Internal transaction status class for Caliper
 */
class TxStatus {
    /**
     * Constructor
     * @param {string} id, transaction id
     */
    constructor(id) {
        this.status = {
            id: id,
            status: 'created',  // submitting status, three status 'created', 'success', 'failed' are reserved
            time_create: Date.now(),
            time_final: 0,
            result: null,
            verified: false,   // if false, we cannot be sure that the final Tx status is accurate
            flags: 0,    // the blockchain specified flag
            error_messages: [], // the blockchain specified error messages
            custom_data: new Map()
        };
    }

    /**
     * Getter of the tx id
     * @return {string}, id
     */
    GetID() {
        return this.status.id;
    }

    /**
     * Setter of the tx id
     * @param {string} id, id
     */
    SetID(id) {
        this.status.id = id;
    }

    /**
     * Getter of the tx status
     * @return {string}, status
     */
    GetStatus() {
        return this.status.status;
    }

    /**
     * Check if the tx has been committed successfully
     * @return {boolean} committed or not
     */
    IsCommitted() {
        return (this.status.status === 'success');
    }

    /**
     * Set the tx status to 'success'
     * The 'time_final' will also be recorded
     * @param {number} time The epoch time to record for the status change.
     */
    SetStatusSuccess(time) {
        this.status.status = 'success';
        this.status.time_final = time || Date.now();
    }

    /**
     * Getter of the tx creating time
     * @return {int} create time in ms
     */
    GetTimeCreate() {
        return this.status.time_create;
    }

    /**
     * Getter of the tx final time
     * @return {int} final time in ms
     */
    GetTimeFinal() {
        return this.status.time_final;
    }

    /**
     * Set the tx status to 'failed'
     * The 'time_final' will also be recorded
     */
    SetStatusFail() {
        this.status.status = 'failed';
        this.status.time_final = Date.now();
    }

    /**
     * Check if the tx status is verified
     * @return {boolean}, verified or not
     */
    IsVerified() {
        return this.status.verified;
    }

    /**
     * Setter of the tx verification state
     * @param {*} isVerified, verified or not
     */
    SetVerification(isVerified) {
        this.status.verified = isVerified;
    }

    /**
     * Getter of the blockchain specified flag
     * @return {any}, flag
     */
    GetFlag() {
        return this.status.flags;
    }

    /**
     * Setter of the blockchain specified flag
     * @param {any} flag, flag to be set
     */
    SetFlag(flag) {
        this.status.flags = flag;
    }

    /**
     * Setter of the error message
     * @param {int} idx, index of the error message
     * @param {any} msg, message to be stored
     */
    SetErrMsg(idx, msg) {
        this.status.error_messages[idx] = msg;
    }

    /**
     * Getter of the error messages
     * @return {array}, stored messages
     */
    GetErrMsg() {
        return this.status.error_messages;
    }

    /**
     * Setter of blockchain specified submitting result
     * @param {any} result result
     */
    SetResult(result) {
        this.status.result = result;
    }

    /**
     * Getter of stored submitting result
     * @return {any} result
     */
    GetResult() {
        return this.status.result;
    }

    /**
     * Getter of the status object
     * @return {object} status object
     */
    Marshal() {
        return this.status;
    }

    /**
     * Set any key/value
     * @param {string} key key
     * @param {any} value value
     */
    Set(key, value) {
        this.status.custom_data.set(key, value);
    }

    /**
     * Get any specified element
     * @param {string} key key
     * @return {any} value
     */
    Get(key) {
        return this.status.custom_data.get(key);
    }

    /**
     * Gets the Map of custom date recorded for the transaction.
     * @return {Map<string, object>} The map of custom data.
     */
    GetCustomData() {
        return this.status.custom_data;
    }
}

module.exports = TxStatus;
