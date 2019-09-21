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
package bftsmart.statemanagement.strategy.durability;

import bftsmart.consensus.messages.ConsensusMessage;
import bftsmart.reconfiguration.ServerViewController;
import bftsmart.statemanagement.ApplicationState;
import bftsmart.tom.core.messages.TOMMessage;
import bftsmart.tom.leaderchange.CertifiedDecision;
import bftsmart.tom.server.defaultservices.CommandsInfo;
import bftsmart.tom.util.BatchBuilder;

import java.util.LinkedList;
import java.util.Set;

/**
 * Stores the data used to transfer the state to a recovering replica.
 * This class serves the three different seeders defined in the CST optimized
 * version for f=1.
 * In that version, the newest replica to take the checkpoint is expected to send
 * the hash of the checkpoint plus the upper portion of the log. The replica which
 * took the checkpoint before that, i.e., the middle replica is expected to send
 * the checkpoint it has plus hashes of the lower and upper portions of the log.
 * The oldest replica to take the checkpoint must send the lower portion of the
 * log.
 * This object must be passed to the state manager class which will combine the
 * replies from the seeders, validating the values and updating the state in the
 * leecher.
 * 
 * @author Marcel Santos
 *
 */
public class CSTState implements ApplicationState {

    private static final long serialVersionUID = -7624656762922101703L;

    private final byte[] hashLogUpper;
    private final byte[] hashLogLower;
    private final byte[] hashCheckpoint;

    private final int checkpointCID;
    private final int lastCID;

    private final CommandsInfo[] logUpper;
    private final CommandsInfo[] logLower;

    private byte[] state;

    private final int pid;
    
    public CSTState(byte[] state, byte[] hashCheckpoint, CommandsInfo[] logLower, byte[] hashLogLower,
                    CommandsInfo[] logUpper, byte[] hashLogUpper, int checkpointCID, int lastCID, int pid) {
        setSerializedState(state);
        this.hashLogUpper = hashLogUpper;
        this.hashLogLower = hashLogLower;
        this.hashCheckpoint = hashCheckpoint;
        this.logUpper = logUpper;
        this.logLower = logLower;
        this.checkpointCID = checkpointCID;
        this.lastCID = lastCID;
        this.pid = pid;
    }

    @Override
    public boolean hasState() {
        return this.getSerializedState() != null;
    }

    @Override
    public byte[] getSerializedState() {
        return state;
    }

    @Override
    public byte[] getStateHash() {
        return hashCheckpoint;
    }

    @Override
    public void setSerializedState(byte[] state) {
        this.state = state;
    }

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

    public int getCheckpointCID() {
        return checkpointCID;
    }

    /**
     * Retrieves the specified batch of messages
     * @param cid Consensus ID associated with the batch to be fetched
     * @return The batch of messages associated with the batch correspondent consensus ID
     */
    public CommandsInfo getMessageBatch(int cid) {
        if (cid >= checkpointCID && cid <= lastCID) {
            if(logLower != null) {
                return logLower[cid - checkpointCID - 1];
            } else if(logUpper != null) {
                return logUpper[cid - checkpointCID - 1];
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    public byte[] getHashLogUpper() {
        return hashLogUpper;
    }

    public byte[] getHashLogLower() {
        return hashLogLower;
    }

    public CommandsInfo[] getLogUpper() {
        return logUpper;
    }

    public CommandsInfo[] getLogLower() {
        return logLower;
    }

    public byte[] getHashCheckpoint() {
        return hashCheckpoint;
    }
}
