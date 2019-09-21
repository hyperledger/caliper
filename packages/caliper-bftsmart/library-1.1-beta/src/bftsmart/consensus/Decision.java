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
package bftsmart.consensus;

import bftsmart.tom.core.messages.TOMMessage;

/**
 *
 * This class represents a Consensus Instance.
 *
 * @author Joao Sousa
 * @author Alysson Bessani
 */
public class Decision {

    private final int cid; // Consensus ID in which the value was decided
    private Epoch decisionEpoch = null; // Epoch in which the value was decided
    private int regency; // Regency in which the value was decided
    private int leader; // Leader with which the value was decided
    
    private byte[] value = null; // decided value
    private TOMMessage[] deserializedValue = null; // decided value (deserialized)
    
    //for benchmarking
    public TOMMessage firstMessageProposed = null;
    public int batchSize = 0;

    /**
     * Creates a new instance of Decision
     * @param cid The ID for the respective consensus
     */
    public Decision(int cid) {
        this.cid = cid;
    }

    /**
     * Set regency in which the value was decided
     * @param regency Regency in which the value was decided
     */
    public void setRegency(int regency) {
        this.regency = regency;
    }

    /**
     * Set leader with which the value was decided
     * @param leader Leader with which the value was decided
     */
    public void setLeader(int leader) {
        this.leader = leader;
    }

    /**
     * Returns regency in which the value was decided
     * @return Regency in which the value was decided
     */
    public int getRegency() {
        return regency;
    }

    /**
     * Returns leader with which the value was decided
     * @return Leader with which the value was decided
     */
    public int getLeader() {
        return leader;
    }
    
    /**
     * Set epoch in which the value was decided
     * @param epoch The epoch in which the value was decided
     */
    public void setDecisionEpoch(Epoch epoch) {
        this.decisionEpoch = epoch;
    }


    /**
     * Get epoch in which the value was decided
     * 
     * @return The epoch in which the value was decided
     */
    public Epoch getDecisionEpoch() {
        return decisionEpoch;
    }
    
    /**
     * Sets the decided value
     * @return Decided Value
     */
    public byte[] getValue() {
        while (value == null) {
            waitForPropose(); // Eduardo: should have a separate waitForDecision  (works for now, because it is just a sleep)
            value = decisionEpoch.propValue;
        }
        return value;
    }

    public TOMMessage[] getDeserializedValue() {
        while (deserializedValue == null) {
            waitForPropose();
            deserializedValue = decisionEpoch.deserializedPropValue;
        }
        return deserializedValue;
    }

    /**
     * The ID for the associated consensus
     * @return ID for the associated consensus
     */
    public int getConsensusId() {
        return cid;
    }

    private void waitForPropose() {
        while (decisionEpoch == null &&
                decisionEpoch.deserializedPropValue == null) {
            try {
                System.out.println("waiting for propose for consensus" + cid);
                Thread.sleep(1);
            } catch (InterruptedException ie) {
            }
        }
    }
}
