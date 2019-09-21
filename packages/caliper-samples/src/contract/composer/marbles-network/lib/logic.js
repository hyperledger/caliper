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
  * Trade a marble to a new player
  * @param  {org.hyperledger_composer.marbles.TradeMarble} tradeMarble - the trade marble transaction
  * @transaction
  */
async function tradeMarble(tradeMarble) {   // eslint-disable-line no-unused-vars
    tradeMarble.marble.owner = tradeMarble.newOwner;
    const assetRegistry = await getAssetRegistry('org.hyperledger_composer.marbles.Marble'); // eslint-disable-line no-undef
    await assetRegistry.update(tradeMarble.marble);
}
