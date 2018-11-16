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

//const commUtils = require('./util');
const path = require('path');
const nconf = require('nconf');
nconf.formats.yaml = require('nconf-yaml');

//
// The class representing the hierarchy of configuration settings.
//
const Config = class {
    /**
     * Constructor
     */
    constructor() {
        nconf.use('memory');
        nconf.use('mapenv', {type:'memory'});
        this.mapSettings(nconf.stores.mapenv, process.env);
        this._fileStores = [];
        nconf.argv();
        nconf.env();
        // reference to configuration settings
        this._config = nconf;
        const rootDir = path.join('..','..');
        const defaultConfig = path.join(__dirname, rootDir, 'config/default.yaml');
        //const defaultConfig = commUtils.resolvePath('config/default.yaml');
        this.file(defaultConfig);
    }

    /**
     * utility method to map (convert) the environment(upper case and underscores) style
     * names to configuration (lower case and dashes) style names
     * @param {Object} store store of the settings
     * @param {Object} settings settings of the configuration
     */
    mapSettings(store, settings) {
        for(let key in settings) {
            const value = settings[key];
            key = key.toLowerCase();
            key = key.replace(/_/g, '-');
            store.set(key,value);
        }
    }

    /**
     *   utility method to reload the file based stores so
     *   the last one added is on the top of the files hierarchy
     *   unless the bottom flag indicates to add otherwise
     * @param {String} path path of the file
     * @param {Boolean} bottom indicate of the files hierarchy
     */
    reorderFileStores(path, bottom) {
        // first remove all the file stores
        for(const x in this._fileStores) {
            this._config.remove(this._fileStores[x]);
        }

        if(bottom) {
            // add to the bottom of the list
            this._fileStores.push(path);
        } else {
            // add this new file to the front of the list
            this._fileStores.unshift(path);
        }

        // now load all the file stores
        for(const x in this._fileStores) {
            const name = this._fileStores[x];
            //this._config.file(name, name);
            this._config.file({file: name, format: nconf.formats.yaml});
        }
    }

    /**
     * Add an additional file
     * @param {String} path path of the file
     */
    file(path) {
        if(typeof path !== 'string') {
            throw new Error('The "path" parameter must be a string');
        }
        // just reuse the path name as the store name...will be unique
        this.reorderFileStores(path);
    }

    /**
     * Get the config setting with name.
     * If the setting is not found returns the default value provided.
     * @param {String} name of the setting
     * @param {any} default_value default value of the setting
     * @return {any} value of the setting
     */
    get(name, default_value) {
        let return_value = null;

        try {
            return_value = this._config.get(name);
        }
        catch(err) {
            return_value = default_value;
        }

        if(return_value === null || return_value === undefined) {
            return_value = default_value;
        }

        return return_value;
    }

    /**
     * Set a value into the 'memory' store of config settings.
     * This will override all other settings.
     * @param {String} name name of the setting
     * @param {String} value value of the setting
     */
    set(name, value) {
        this._config.set(name,value);
    }

};

module.exports = Config;

