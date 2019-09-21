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

import bftsmart.reconfiguration.ServerViewController;
import bftsmart.tom.leaderchange.CertifiedDecision;

import java.io.Serializable;

/**
 * This interface represents a state transfered from a replica to another. The state associated with the last
 * checkpoint together with all the batches of messages received do far, comprises the sender's
 * current state
 * 
 * IMPORTANT: The hash state MUST ALWAYS be present, regardless if the replica is supposed to
 * send the complete state or not
 * 
 * @author Joao Sousa
 */
public interface ApplicationState extends Serializable {

    /**
     * The consensus of the last batch of commands which the application was given
     * @return consensus of the last batch of commands which the application was given
     */
    public int getLastCID();
    
    /**
     * Retrieves the certified decision for the last consensus present in this object
     * @param controller
     * @return The certified decision for the last consensus present in this object
     */
    public CertifiedDecision getCertifiedDecision(ServerViewController controller);

    /**
     * Indicates if the sender replica had the state requested by the recovering replica
     * @return true if the sender replica had the state requested by the recovering replica, false otherwise
     */
    public boolean hasState();

    /**
     * Sets a byte array that must be a representation of the application state
     * @param state a byte array that must be a representation of the application state
     */
    public void setSerializedState(byte[] state);
    
    /**
     * Byte array that must be a representation of the application state
     * @return A byte array that must be a representation of the application state
     */
    public byte[] getSerializedState();
    
    /**
     * Gets an secure hash of the application state
     * @return Secure hash of the application state
     */
    public byte[] getStateHash();

    /**
     * This method MUST be implemented. However, the attribute returned by getSerializedState()
     * should be ignored, and getStateHash() should be used instead
     */
    @Override
    public abstract boolean equals(Object obj);

    /**
     * This method MUST be implemented. However, the attribute returned by getSerializedState()
     * should be ignored, and getStateHash() should be used instead
     */
    @Override
    public abstract int hashCode();
}
