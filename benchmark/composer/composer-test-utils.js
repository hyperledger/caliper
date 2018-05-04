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
 * Test Utilities for Composer benchmark tests
 */
class TestUtil {
    /**
     * Internal helper function to remove all items within a registry that follow a naming convention
     * @param {Registry} registry the asset registry to use
     * @param {String} baseName the base name of the assets to remove
     */
    static async clearAll(registry, baseName) {
        let assets =[];
        let retrieve = true;
        let innerId = 0;
        while (retrieve){
            let id = baseName + '_' + innerId++;
            let exists = await registry.exists(id);
            if (exists){
                let asset = await registry.get(id);
                assets.push(asset);
            } else {
                retrieve = false;
            }
        }
        await registry.removeAll(assets);
    }

}

// Exports
module.exports = TestUtil;