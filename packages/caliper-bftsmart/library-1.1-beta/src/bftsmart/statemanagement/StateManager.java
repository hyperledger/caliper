/**
Copyright (c) 2007-2013 Alysson Bessani, Eduardo Alchieri, Paulo Sousa, and the authors indicated in the @author tags

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package bftsmart.statemanagement;

import bftsmart.tom.core.DeliveryThread;
import bftsmart.tom.core.TOMLayer;

/**
 * TODO: Don't know if this class will be used. For now, leave it here
 *
 *  Check if the changes for supporting dynamicity are correct
 *  
 * @author Joao Sousa
 */
public interface StateManager {

    public void requestAppState(int cid);
    
    public void analyzeState(int cid);

    public void stateTimeout();
    
    public void init(TOMLayer tomLayer, DeliveryThread dt);
    
    public void SMRequestDeliver(SMMessage msg, boolean isBFT);
    
    public void SMReplyDeliver(SMMessage msg, boolean isBFT);

    public void askCurrentConsensusId();
    
    public void currentConsensusIdAsked(int sender);
    
    public void currentConsensusIdReceived(SMMessage msg);
    
    public void setLastCID(int lastCID);
    
    public int getLastCID();
    
    public boolean isRetrievingState();
}
