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

import bftsmart.tom.MessageContext;

/**
 * This classes serves as a log for the state associated with the last checkpoint, and the message
 * batches received since the same checkpoint until the present. The state associated with the last
 * checkpoint together with all the batches of messages received so far, comprises this replica
 * current state
 * 
 * @author Joao Sousa
 */
public class StateLog {

    private CommandsInfo[] messageBatches; // batches received since the last checkpoint.
    private int lastCheckpointCID; // Consensus ID for the last checkpoint
    private byte[] state; // State associated with the last checkpoint
    private byte[] stateHash; // Hash of the state associated with the last checkpoint
    private int position; // next position in the array of batches to be written
    private int lastCID; // Consensus ID for the last messages batch delivered to the application
    private int id; //replica ID

    /**
     * Constructs a State log
     * @param id
     * @param k The checkpoint period
     * @param initialState
     * @param initialHash
     */
    public StateLog(int id, int k, byte[] initialState, byte[] initialHash) {

        this.messageBatches = new CommandsInfo[k - 1];
        this.lastCheckpointCID = -1;
        this.state = initialState;
        this.stateHash = initialHash;
        this.position = 0;
        this.lastCID = -1;
        this.id = id;
    }
    
    /**
     * Constructs a State log
     * @param id
     * @param k The checkpoint period
     */
    public StateLog(int id, int k) {

        this.messageBatches = new CommandsInfo[k - 1];
        this.lastCheckpointCID = -1;
        this.state = null;
        this.stateHash = null;
        this.position = 0;
        this.lastCID = -1;
        this.id = id;
    }

    public StateLog(int id, byte[] initialState, byte[] initialHash) {
        this.lastCheckpointCID = -1;
        this.state = initialState;
        this.stateHash = initialHash;
        this.lastCID = -1;
        this.id = id;
    }
    
    /**
     * Sets the state associated with the last checkpoint, and updates the consensus ID associated with it
     * @param state State associated with the last checkpoint
     * @param stateHash
     * @param lastConsensusId
     */
    public void newCheckpoint(byte[] state, byte[] stateHash, int lastConsensusId) {

    	if(messageBatches != null) {
    		for (int i = 0; i < this.messageBatches.length; i++)
                messageBatches[i] = null;
    	}

        position = 0;
        this.state = state;
        this.stateHash = stateHash;
                       
    }

    /**
     * Sets the consensus ID for the last checkpoint
     * @param lastCheckpointCID Consensus ID for the last checkpoint
     */
    public void setLastCheckpointCID(int lastCheckpointCID) {
        this.lastCheckpointCID = lastCheckpointCID;
    }

    /**
     * Retrieves the consensus ID for the last checkpoint
     * @return Consensus ID for the last checkpoint, or -1 if none was obtained
     */
    public int getLastCheckpointCID() {
        
        return lastCheckpointCID ;
    }

    /**
     * Sets the consensus ID for the last messages batch delivered to the application
     * @param lastCID the consensus ID for the last messages batch delivered to the application
     */
    public void setLastCID(int lastCID) {

       this.lastCID = lastCID;
    }

    /**
     * Retrieves the consensus ID for the last messages batch delivered to the application
     * @return Consensus ID for the last messages batch delivered to the application
     */
    public int getLastCID() {
        return lastCID;
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
    public byte[] getStateHash() {
        return stateHash;
    }

    /**
     * Adds a message batch to the log. This batches should be added to the log
     * in the same order in which they are delivered to the application. Only
     * the 'k' batches received after the last checkpoint are supposed to be kept
     * @param commands The batch of messages to be kept.
     * @param msgCtx The message contexts related to the commands
     * @param lastConsensusId
     */
    public void addMessageBatch(byte[][] commands, MessageContext[] msgCtx, int lastConsensusId) {
        if (position < messageBatches.length) {
            messageBatches[position] = new CommandsInfo(commands, msgCtx);
            position++;
        }
        setLastCID(lastConsensusId);
    }

    /**
     * Returns a batch of messages, given its correspondent consensus ID
     * @param cid Consensus ID associated with the batch to be fetched
     * @return The batch of messages associated with the batch correspondent consensus ID
     */
    public CommandsInfo getMessageBatch(int cid) {
        if (cid > lastCheckpointCID && cid <= lastCID) {
            return messageBatches[cid - lastCheckpointCID - 1];
        }
        else return null;
    }

    /**
     * Retrieves all the stored batches kept since the last checkpoint
     * @return All the stored batches kept since the last checkpoint
     */
    public CommandsInfo[] getMessageBatches() {
        return messageBatches;
    }

    /**
     * Retrieves the total number of stored batches kept since the last checkpoint
     * @return The total number of stored batches kept since the last checkpoint
     */
    public int getNumBatches() {
        return position;
    }
    /**
     * Constructs a TransferableState using this log information
     * @param cid Consensus ID correspondent to desired state
     * @param setState
     * @return TransferableState Object containing this log information
     */
    public DefaultApplicationState getApplicationState(int cid, boolean setState) {

    	System.out.println("--- CID requested: " + cid + ". Last checkpoint: " + lastCheckpointCID + ". Last CID: " + this.lastCID);
        CommandsInfo[] batches = null;

        int lastCID = -1;
       
        if (cid >= lastCheckpointCID && cid <= this.lastCID) {
            
    	System.out.println("--- Constructing ApplicationState up until CID " + cid);

            int size = cid - lastCheckpointCID ;

            if (size > 0) {
                batches = new CommandsInfo[size];

                for (int i = 0; i < size; i++)
                    batches[i] = messageBatches[i];
            }
            lastCID = cid;
            return new DefaultApplicationState(batches, lastCheckpointCID, lastCID, (setState ? state : null), stateHash, this.id);

        }
        else return null;
    }

    /**
     * Updates this log, according to the information contained in the TransferableState object
     * @param transState TransferableState object containing the information which is used to updated this log
     */
    public void update(DefaultApplicationState transState) {

        position = 0;
        if (transState.getMessageBatches() != null) {
            for (int i = 0; i < transState.getMessageBatches().length; i++, position = i) {
                this.messageBatches[i] = transState.getMessageBatches()[i];
            }
        }

        this.lastCheckpointCID = transState.getLastCheckpointCID();

        this.state = transState.getState();

        this.stateHash = transState.getStateHash();

        this.lastCID = transState.getLastCID();
    }

}
