/**
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * @file, definition of the Fabric class, which implements the caliper's NBI for hyperledger fabric
 */

'use strict';

const childProcess = require('child_process');
const path = require('path');

/**
 * Class used to spawn composer client workers
 */
class ComposerClientFactory {

    /**
     * Require paths to configuration data used when calling new on fabric.js
     * @param {String} absNetworkFile absolute workerPath
     * @param {Sting} workspace_root root location
     */
    constructor(absNetworkFile, workspace_root){
        this.absNetworkFile = absNetworkFile;
        this.workspaceRoot = workspace_root;
    }


    /**
     * Spawn the worker and perform required init
     * @returns {Object} the child process
     */
    async spawnWorker() {
        const child = childProcess.fork(path.join(__dirname, './composerClientWorker.js'));

        const msg = {
            type: 'init',
            absNetworkFile: this.absNetworkFile,
            networkRoot: this.workspaceRoot
        };
        child.send(msg);

        return child;
    }
}

module.exports = ComposerClientFactory;
