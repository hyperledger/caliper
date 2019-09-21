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
package bftsmart.tom;

import bftsmart.consensus.messages.ConsensusMessage;
import bftsmart.tom.core.messages.TOMMessage;
import bftsmart.tom.core.messages.TOMMessageType;

import java.io.Serializable;
import java.util.Random;
import java.util.Set;

/**
 * This class represents the whole context of a request ordered in the system.
 * It stores all informations regarding the message sent by the client, as well as
 * the consensus instance in which it was ordered.
 * 
 * @author alysson
 */
public class MessageContext implements Serializable {
	
    private static final long serialVersionUID = -3757195646384786213L;

    // Client info
    private final int sender;
    private final int viewID;
    private final TOMMessageType type;
    private final int session;
    private final int sequence;
    private final int operationId;
    private final int replyServer;
    private final  byte[] signature;
    
    // Consensus info
    private final long timestamp;
    private final int regency;
    private final int leader;
    private final int consensusId;
    private final int numOfNonces;
    private final long seed;
    private final Set<ConsensusMessage> proof;
                
    private final TOMMessage firstInBatch; //to be replaced by a statistics class
    private boolean lastInBatch; // indicates that the command is the last in the batch. Used for logging
    private final boolean noOp;
    
    public boolean readOnly = false;
    
    private byte[] nonces;
    
    /**
     * Constructor 
     * 
     * @param sender
     * @param viewID
     * @param type
     * @param session
     * @param sequence
     * @param operationId
     * @param replyServer
     * @param signature
     * @param timestamp
     * @param numOfNonces
     * @param seed
     * @param regency
     * @param leader
     * @param consensusId
     * @param proof
     * @param firstInBatch
     * @param noOp 
     */
    public MessageContext(int sender, int viewID, TOMMessageType type,
            int session, int sequence, int operationId, int replyServer, byte[] signature,
            long timestamp, int numOfNonces, long seed, int regency, int leader, int consensusId,
            Set<ConsensusMessage> proof, TOMMessage firstInBatch, boolean noOp) {
        
        this.nonces = null;
               
        this.sender = sender;
        this.viewID = viewID;
        this.type = type;
        this.session = session;
        this.sequence = sequence;
        this.operationId = operationId;
        this.replyServer = replyServer;
        this.signature = signature;
        
        this.timestamp = timestamp;
        this.regency = regency;
        this.leader = leader;
        this.consensusId = consensusId;
        this.numOfNonces = numOfNonces;
        this.seed = seed;
        
        this.proof = proof;
        this.firstInBatch = firstInBatch;
        this.noOp = noOp;
    }

    public static long getSerialVersionUID() {
        return serialVersionUID;
    }

    public int getViewID() {
        return viewID;
    }

    public TOMMessageType getType() {
        return type;
    }

    public int getSession() {
        return session;
    }

    public int getSequence() {
        return sequence;
    }

    public int getOperationId() {
        return operationId;
    }
    
    public int getReplyServer() {
        return replyServer;
    }
    
    public byte[] getSignature() {
        return signature;
    }
    
    /**
     * Returns the sender of the message
     * @return The sender of the message
     */
    public int getSender() {
        return sender;
    }

    /**
     * @return the timestamp
     */
    public long getTimestamp() {
        return timestamp;
    }

    /**
     * @return the nonces
     */
    public byte[] getNonces() {
        
        if (nonces == null) { //obtain the nonces to be delivered to the application          
            
            nonces = new byte[numOfNonces];
            if (nonces.length > 0) {
                Random rnd = new Random(seed);
                rnd.nextBytes(nonces);
            }
            
        }
        
        return nonces;
    }

    public int getNumOfNonces() {
        return numOfNonces;
    }

    public long getSeed() {
        return seed;
    }
    
    /**
     * @return the consensusId
     */
    public int getConsensusId() {
        return consensusId;
    }
    
    /**
     * 
     * @return the leader with which the batch was decided
     */
    public int getLeader() {
        return leader;
    }
    /**
     * 
     * @return the proof for the consensus
     */
    public Set<ConsensusMessage> getProof() {
        return proof;
    }
    
    /**
     * @return the regency
     */
    public int getRegency() {
        return regency;
    }
    
    /**
     * @return the first message in the ordered batch
     */
    public TOMMessage getFirstInBatch() {
        return firstInBatch;
    }

    public void setLastInBatch() {
    	lastInBatch = true;
    }
    
    public boolean isLastInBatch() {
    	return lastInBatch;
    }

    public boolean isNoOp() {
        return noOp;
    }
    
    /**
     * Generates a TOMMessage for its associated requests using the new info that it now supports since the previous commit.
     * It is assumed that the byte array passed to this method is the serialized request associated to the original TOMMessage.
     * @param content Serialized request associated to the original TOMMessage.
     * @return A TOMMessage object that is equal to the original object issued by the client
     */
    public TOMMessage recreateTOMMessage(byte[] content) {

        TOMMessage ret = new TOMMessage(sender, session, sequence, operationId, content, viewID, type);
        ret.setReplyServer(replyServer);
        ret.serializedMessageSignature = signature;
        ret.serializedMessage = TOMMessage.messageToBytes(ret);
        
        return ret;
    }

}