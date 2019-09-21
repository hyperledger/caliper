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
package bftsmart.tom.server.defaultservices;

import bftsmart.consensus.messages.ConsensusMessage;
import bftsmart.reconfiguration.ServerViewController;
import bftsmart.statemanagement.ApplicationState;
import bftsmart.tom.core.messages.TOMMessage;
import bftsmart.tom.leaderchange.CertifiedDecision;
import bftsmart.tom.util.BatchBuilder;

import java.util.Arrays;
import java.util.LinkedList;
import java.util.Set;
/**
 * This class represents a state transfered from a replica to another. The state associated with the last
 * checkpoint together with all the batches of messages received do far, comprises the sender's
 * current state
 * 
 * @author Joao Sousa
 */
public class DefaultApplicationState implements ApplicationState {

    private static final long serialVersionUID = 6771081456095596363L;

    protected byte[] state; // State associated with the last checkpoint
    protected byte[] stateHash; // Hash of the state associated with the last checkpoint
    protected int lastCID = -1; // Consensus ID for the last messages batch delivered to the application
    protected boolean hasState; // indicates if the replica really had the requested state

    private CommandsInfo[] messageBatches; // batches received since the last checkpoint.
    private int lastCheckpointCID; // Consensus ID for the last checkpoint
    private byte[] logHash;
    
    private int pid;

    /**
     * Constructs a TansferableState
     * This constructor should be used when there is a valid state to construct the object with
     * @param messageBatches Batches received since the last checkpoint.
     * @param state State associated with the last checkpoint
     * @param stateHash Hash of the state associated with the last checkpoint
     */
    public DefaultApplicationState(CommandsInfo[] messageBatches, int lastCheckpointCID, int lastCID, byte[] state, byte[] stateHash, int pid) {
       
        this.messageBatches = messageBatches; // batches received since the last checkpoint.
        this.lastCheckpointCID = lastCheckpointCID; // Consensus ID for the last checkpoint
        this.lastCID = lastCID; // Consensus ID for the last messages batch delivered to the application
        this.state = state; // State associated with the last checkpoint
        this.stateHash = stateHash;
        this.hasState = true;
        this.pid = pid;
    }

    public DefaultApplicationState(CommandsInfo[] messageBatches, byte[] logHash, int lastCheckpointCID, int lastCID, byte[] state, byte[] stateHash, int pid) {
    	this(messageBatches, lastCheckpointCID, lastCID, state, stateHash, pid);
    	this.logHash = logHash;
    }

    /**
     * Constructs a TansferableState
     * This constructor should be used when there isn't a valid state to construct the object with
     */
    public DefaultApplicationState() {
        this.messageBatches = null; // batches received since the last checkpoint.
        this.lastCheckpointCID = -1; // Consensus ID for the last checkpoint
        this.lastCID = -1;
        this.state = null; // State associated with the last checkpoint
        this.stateHash = null;
        this.hasState = false;
        this.pid = -1;
    }
    
    
    @Override
    public void setSerializedState(byte[] state) {
        this.state = state;
    }

    @Override
    public byte[] getSerializedState() {
        return state;
    }
      
    /**
     * Indicates if the TransferableState object has a valid state
     * @return true if it has a valid state, false otherwise
     */
    @Override
    public boolean hasState() {
        return hasState;
    }


    /**
     * Retrieves the consensus ID for the last messages batch delivered to the application
     * @return Consensus ID for the last messages batch delivered to the application
     */
    @Override
    public int getLastCID() {
        return lastCID;
    }
    
    /**
     * Retrieves the certified decision for the last consensus present in this object
     * @param controller
     * @return The certified decision for the last consensus present in this object
     */
    @Override
    public CertifiedDecision getCertifiedDecision(ServerViewController controller) {
        CommandsInfo ci = getMessageBatch(getLastCID());
        if (ci != null && ci.msgCtx[0].getProof() != null) { // do I have a proof for the consensus?
            
            Set<ConsensusMessage> proof = ci.msgCtx[0].getProof();
            LinkedList<TOMMessage> requests = new LinkedList<>();
            
            //Recreate all TOMMessages ordered in the consensus
            for (int i = 0; i < ci.commands.length; i++) {
                
                requests.add(ci.msgCtx[i].recreateTOMMessage(ci.commands[i]));
                
            }
            
            //Serialize the TOMMessages to re-create the proposed value
            BatchBuilder bb = new BatchBuilder(0);
            byte[] value = bb.makeBatch(requests, ci.msgCtx[0].getNumOfNonces(),
                    ci.msgCtx[0].getSeed(), ci.msgCtx[0].getTimestamp(), controller);
            
            //Assemble and return the certified decision
            return new CertifiedDecision(pid, getLastCID(), value, proof);
        }
        else return null; // there was no proof for the consensus
    }

    /**
     * Retrieves the state associated with the last checkpoint
     * @return State associated with the last checkpoint
     */
    public byte[] getState() {
        return state;
    }

    /**
     * Retrieves the hash of the state associated with the last checkpoint
     * @return Hash of the state associated with the last checkpoint
     */
    @Override
    public byte[] getStateHash() {
        return stateHash;
    }

    /**
     * Sets the state associated with the last checkpoint
     * @param state State associated with the last checkpoint
     */
    public void setState(byte[] state) {
        this.state = state;
    }
    
    /**
     * Retrieves all batches of messages
     * @return Batch of messages
     */
    public CommandsInfo[] getMessageBatches() {
        return messageBatches;
    }

    public void setMessageBatches(CommandsInfo[] messageBatches) {
    	this.messageBatches = messageBatches;
    }

    /**
     * Retrieves the specified batch of messages
     * @param cid Consensus ID associated with the batch to be fetched
     * @return The batch of messages associated with the batch correspondent consensus ID
     */
    public CommandsInfo getMessageBatch(int cid) {
        if (messageBatches != null && cid >= lastCheckpointCID && cid <= lastCID) {
            return messageBatches[cid - lastCheckpointCID - 1];
        }
        else return null;
    }

    /**
     * Retrieves the consensus ID for the last checkpoint
     * @return Consensus ID for the last checkpoint, or -1 if no checkpoint was yet executed
     */
    public int getLastCheckpointCID() {

        return lastCheckpointCID;
    }


    @Override
    public boolean equals(Object obj) {
        if (obj instanceof DefaultApplicationState) {
            DefaultApplicationState tState = (DefaultApplicationState) obj;

            if ((this.messageBatches != null && tState.messageBatches == null) ||
                    (this.messageBatches == null && tState.messageBatches != null)) {
                //System.out.println("[DefaultApplicationState] returing FALSE1!");
                return false;
            }

            if (this.messageBatches != null && tState.messageBatches != null) {

                if (this.messageBatches.length != tState.messageBatches.length) {
                    //System.out.println("[DefaultApplicationState] returing FALSE2!");
                    return false;
                }
                
                for (int i = 0; i < this.messageBatches.length; i++) {
                    
                    if (this.messageBatches[i] == null && tState.messageBatches[i] != null) {
                        //System.out.println("[DefaultApplicationState] returing FALSE3!");
                        return false;
                    }

                    if (this.messageBatches[i] != null && tState.messageBatches[i] == null) {
                        //System.out.println("[DefaultApplicationState] returing FALSE4!");
                        return false;
                    }
                    
                    if (!(this.messageBatches[i] == null && tState.messageBatches[i] == null) &&
                        (!this.messageBatches[i].equals(tState.messageBatches[i]))) {
                        //System.out.println("[DefaultApplicationState] returing FALSE5!" + (this.messageBatches[i] == null) + " " + (tState.messageBatches[i] == null));
                        return false;
                    }
                }
            }
            return (Arrays.equals(this.stateHash, tState.stateHash) &&
                    tState.lastCheckpointCID == this.lastCheckpointCID &&
                    tState.lastCID == this.lastCID && tState.hasState == this.hasState);
        }
        //System.out.println("[DefaultApplicationState] returing FALSE!");
        return false;
    }

    @Override
    public int hashCode() {
        int hash = 1;
        hash = hash * 31 + this.lastCheckpointCID;
        hash = hash * 31 + this.lastCID;
        hash = hash * 31 + (this.hasState ? 1 : 0);
        if (this.stateHash != null) {
            for (int i = 0; i < this.stateHash.length; i++) hash = hash * 31 + (int) this.stateHash[i];
        } else {
            hash = hash * 31 + 0;
        }
        if (this.messageBatches != null) {
            for (int i = 0; i < this.messageBatches.length; i++) {
                if (this.messageBatches[i] != null) {
                    hash = hash * 31 + this.messageBatches[i].hashCode();
                } else {
                    hash = hash * 31 + 0;
                }
            }
        } else {
            hash = hash * 31 + 0;
        }
        return hash;
    }

}
