/**
 * Copyright (c) 2007-2013 Alysson Bessani, Eduardo Alchieri, Paulo Sousa, and
 * the authors indicated in the
 *
 * @author tags
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */
package bftsmart.tom.server.defaultservices;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.concurrent.locks.ReentrantLock;
import java.util.logging.Level;

import bftsmart.reconfiguration.ServerViewController;
import bftsmart.reconfiguration.util.TOMConfiguration;
import bftsmart.statemanagement.ApplicationState;
import bftsmart.statemanagement.StateManager;
import bftsmart.statemanagement.strategy.StandardStateManager;
import bftsmart.tom.MessageContext;
import bftsmart.tom.ReplicaContext;
import bftsmart.tom.server.BatchExecutable;
import bftsmart.tom.server.Recoverable;
import bftsmart.tom.util.Logger;

/**
 *
 * This class provides a basic state transfer protocol using the interface
 * 'BatchExecutable'.
 * 
 * @author Joao Sousa
 */
public abstract class DefaultRecoverable implements Recoverable, BatchExecutable {

    private int checkpointPeriod;
    private ReentrantLock logLock = new ReentrantLock();
    private ReentrantLock hashLock = new ReentrantLock();
    private ReentrantLock stateLock = new ReentrantLock();
    private TOMConfiguration config;
    private ServerViewController controller;
    private MessageDigest md;
    private StateLog log;
    private StateManager stateManager;

    public DefaultRecoverable() {

        try {
            md = MessageDigest.getInstance("MD5"); // TODO: shouldn't it be SHA?
        } catch (NoSuchAlgorithmException ex) {
            java.util.logging.Logger.getLogger(DefaultRecoverable.class.getName()).log(Level.SEVERE, null, ex);
        }
    }

    @Override
    public byte[][] executeBatch(byte[][] commands, MessageContext[] msgCtxs) {
        return executeBatch(commands, msgCtxs, false);
    }

    private byte[][] executeBatch(byte[][] commands, MessageContext[] msgCtxs, boolean noop) {

        int cid = msgCtxs[msgCtxs.length-1].getConsensusId();

        // As the delivery thread may deliver several consensus at once it is necessary
        // to find if a checkpoint might be taken in the middle of the batch execution
        int[] cids = consensusIds(msgCtxs);
        int checkpointIndex = findCheckpointPosition(cids);

        byte[][] replies = new byte[commands.length][];

        if (checkpointIndex == -1) {

            if (!noop) {

                stateLock.lock();
                replies = appExecuteBatch(commands, msgCtxs);
                stateLock.unlock();

            }

            saveCommands(commands, msgCtxs);
        } else {
            // there is a replica supposed to take the checkpoint. In this case, the commands
            // must be executed in two steps. First the batch of commands containing commands
            // until the checkpoint period is executed and the log saved or checkpoint taken
            // if this replica is the one supposed to take the checkpoint. After the checkpoint
            // or log, the pointer in the log is updated and then the remaining portion of the
            // commands is executed
            byte[][] firstHalf = new byte[checkpointIndex + 1][];
            MessageContext[] firstHalfMsgCtx = new MessageContext[firstHalf.length];
            byte[][] secondHalf = new byte[commands.length - (checkpointIndex + 1)][];
            MessageContext[] secondHalfMsgCtx = new MessageContext[secondHalf.length];
            System.arraycopy(commands, 0, firstHalf, 0, checkpointIndex + 1);
            System.arraycopy(msgCtxs, 0, firstHalfMsgCtx, 0, checkpointIndex + 1);
            if (secondHalf.length > 0) {
                System.arraycopy(commands, checkpointIndex + 1, secondHalf, 0, commands.length - (checkpointIndex + 1));
                System.arraycopy(msgCtxs, checkpointIndex + 1, secondHalfMsgCtx, 0, commands.length - (checkpointIndex + 1));
            } else {
                firstHalfMsgCtx = msgCtxs;
            }

            byte[][] firstHalfReplies = new byte[firstHalf.length][];
            byte[][] secondHalfReplies = new byte[secondHalf.length][];

            // execute the first half
            cid = msgCtxs[checkpointIndex].getConsensusId();

            if (!noop) {
                stateLock.lock();
                firstHalfReplies = appExecuteBatch(firstHalf, firstHalfMsgCtx);
                stateLock.unlock();
            }

            System.out.println("(DefaultRecoverable.executeBatch) Performing checkpoint for consensus " + cid);
            stateLock.lock();
            byte[] snapshot = getSnapshot();
            stateLock.unlock();
            saveState(snapshot, cid);

            System.arraycopy(firstHalfReplies, 0, replies, 0, firstHalfReplies.length);

            // execute the second half if it exists
            if (secondHalf.length > 0) {
//	        	System.out.println("----THERE IS A SECOND HALF----");
                cid = msgCtxs[msgCtxs.length - 1].getConsensusId();

                if (!noop) {
                    stateLock.lock();
                    secondHalfReplies = appExecuteBatch(secondHalf, secondHalfMsgCtx);
                    stateLock.unlock();
                }

                Logger.println("(DefaultRecoverable.executeBatch) Storing message batch in the state log for consensus " + cid);
                saveCommands(secondHalf, secondHalfMsgCtx);

                System.arraycopy(secondHalfReplies, 0, replies, firstHalfReplies.length, secondHalfReplies.length);
            }

        }

        if (cids != null && cids.length > 0) {
            getStateManager().setLastCID(cids[cids.length - 1]);
        }
        return replies;
    }

    public final byte[] computeHash(byte[] data) {
        byte[] ret = null;
        hashLock.lock();
        ret = md.digest(data);
        hashLock.unlock();

        return ret;
    }

    private StateLog getLog() {
        return log;
    }

    private void saveState(byte[] snapshot, int lastCID) {

        StateLog thisLog = getLog();

        logLock.lock();

        Logger.println("(TOMLayer.saveState) Saving state of CID " + lastCID);

        thisLog.newCheckpoint(snapshot, computeHash(snapshot), lastCID);
        thisLog.setLastCID(lastCID);
        thisLog.setLastCheckpointCID(lastCID);

        logLock.unlock();
        Logger.println("(TOMLayer.saveState) Finished saving state of CID " + lastCID);
    }

    /**
     * Write commands to log file
     *
     * @param commands array of commands. Each command is an array of bytes
     * @param msgCtx
     */
    public void saveCommands(byte[][] commands, MessageContext[] msgCtx) {
        //if(!config.isToLog())
        //	return;        
        if (commands.length != msgCtx.length) {
            System.out.println("----SIZE OF COMMANDS AND MESSAGE CONTEXTS IS DIFFERENT----");
            System.out.println("----COMMANDS: " + commands.length + ", CONTEXTS: " + msgCtx.length + " ----");
        }
        logLock.lock();

        int cid = msgCtx[0].getConsensusId();
        int batchStart = 0;
        for (int i = 0; i <= msgCtx.length; i++) {
            if (i == msgCtx.length) { // the batch command contains only one command or it is the last position of the array
                byte[][] batch = Arrays.copyOfRange(commands, batchStart, i);
                MessageContext[] batchMsgCtx = Arrays.copyOfRange(msgCtx, batchStart, i);
                log.addMessageBatch(batch, batchMsgCtx, cid);
            } else {
                if (msgCtx[i].getConsensusId() > cid) { // saves commands when the cid changes or when it is the last batch
                    byte[][] batch = Arrays.copyOfRange(commands, batchStart, i);
                    MessageContext[] batchMsgCtx = Arrays.copyOfRange(msgCtx, batchStart, i);
                    log.addMessageBatch(batch, batchMsgCtx, cid);
                    cid = msgCtx[i].getConsensusId();
                    batchStart = i;
                }
            }
        }
        logLock.unlock();
    }

    @Override
    public ApplicationState getState(int cid, boolean sendState) {
        logLock.lock();
        ApplicationState ret = (cid > -1 ? getLog().getApplicationState(cid, sendState) : new DefaultApplicationState());
        
        // Only will send a state if I have a proof for the last logged decision/consensus
        //TODO: I should always make sure to have a log with proofs, since this is a result
        // of not storing anything after a checkpoint and before logging more requests        
        if (ret == null || (config.isBFT() && ret.getCertifiedDecision(this.controller) == null)) ret = new DefaultApplicationState();
        
        logLock.unlock();
        return ret;
    }

    @Override
    public int setState(ApplicationState recvState) {

        int lastCID = -1;
        if (recvState instanceof DefaultApplicationState) {

            DefaultApplicationState state = (DefaultApplicationState) recvState;

            int lastCheckpointCID = state.getLastCheckpointCID();
            lastCID = state.getLastCID();

            System.out.println("(DefaultRecoverable.setState) I'm going to update myself from CID "
                    + lastCheckpointCID + " to CID " + lastCID);
            
            bftsmart.tom.util.Logger.println("(DefaultRecoverable.setState) I'm going to update myself from CID "
                    + lastCheckpointCID + " to CID " + lastCID);

            stateLock.lock();
            if (state.getSerializedState() != null) {
                System.out.println("The state is not null. Will install it");
                log.update(state);
                installSnapshot(state.getSerializedState());
            }

            for (int cid = lastCheckpointCID + 1; cid <= lastCID; cid++) {
                try {

                    bftsmart.tom.util.Logger.println("(DefaultRecoverable.setState) interpreting and verifying batched requests for cid " + cid);
                    if (state.getMessageBatch(cid) == null) {
                        System.out.println("(DefaultRecoverable.setState) " + cid + " NULO!!!");
                    }

                    CommandsInfo cmdInfo = state.getMessageBatch(cid); 
                    byte[][] commands = cmdInfo.commands; // take a batch
                    MessageContext[] msgCtx = cmdInfo.msgCtx;
                    
                    if (commands == null || msgCtx == null || msgCtx[0].isNoOp()) {
                        continue;
                    }                        
                    appExecuteBatch(commands, msgCtx);
                    
                } catch (Exception e) {
                    e.printStackTrace(System.err);
                    if (e instanceof ArrayIndexOutOfBoundsException) {
                        System.out.println("CID do ultimo checkpoint: " + state.getLastCheckpointCID());
                        System.out.println("CID do ultimo consenso: " + state.getLastCID());
                        System.out.println("numero de mensagens supostamente no batch: " + (state.getLastCID() - state.getLastCheckpointCID() + 1));
                        System.out.println("numero de mensagens realmente no batch: " + state.getMessageBatches().length);
                    }
                }

            }
            stateLock.unlock();

        }
        
        return lastCID;
    }

    /**
     * Iterates over the message context array and get the consensus id of each
     * command being executed. As several times during the execution of commands
     * and logging the only infomation important in MessageContext is the
     * consensus id, it saves time to have it already in an array of ids
     *
     * @param ctxs the message context, one for each command to be executed
     * @return the id of the consensus decision for each command
     */
    private int[] consensusIds(MessageContext[] ctxs) {
        int[] cids = new int[ctxs.length];
        for (int i = 0; i < ctxs.length; i++) {
            cids[i] = ctxs[i].getConsensusId();
        }
        return cids;
    }

    /**
     * Iterates over the commands to find if the replica took a checkpoint. This
     * iteration over commands is needed due to the batch execution strategy
     * introduced with the durable techniques to improve state management. As
     * several consensus instances can be executed in the same batch of
     * commands, it is necessary to identify if the batch contains checkpoint
     * indexes.
     *
     * @param msgCtxs the contexts of the consensus where the messages where
     * executed. There is one msgCtx message for each command to be executed
     *
     * @return the index in which a replica is supposed to take a checkpoint. If
     * there is no replica taking a checkpoint during the period comprised by
     * this command batch, it is returned -1
     */
    private int findCheckpointPosition(int[] cids) {
        if (checkpointPeriod < 1) {
            return -1;
        }
        if (cids.length == 0) {
            throw new IllegalArgumentException();
        }
        int firstCID = cids[0];
        if ((firstCID + 1) % checkpointPeriod == 0) {
            return cidPosition(cids, firstCID);
        } else {
            int nextCkpIndex = (((firstCID / checkpointPeriod) + 1) * checkpointPeriod) - 1;
            if (nextCkpIndex <= cids[cids.length - 1]) {
                return cidPosition(cids, nextCkpIndex);
            }
        }
        return -1;
    }

    /**
     * Iterates over the message contexts to retrieve the index of the last
     * command executed prior to the checkpoint. That index is used by the state
     * transfer protocol to find the position of the log commands in the log
     * file.
     *
     * @param msgCtx the message context of the commands executed by the
     * replica. There is one message context for each command
     * @param cid the CID of the consensus where a replica took a checkpoint
     * @return the higher position where the CID appears
     */
    private int cidPosition(int[] cids, int cid) {
        int index = -1;
        if (cids[cids.length - 1] == cid) {
            return cids.length - 1;
        }
        for (int i = 0; i < cids.length; i++) {
            if (cids[i] > cid) {
                break;
            }
            index++;
        }
        System.out.println("--- Checkpoint is in position " + index);
        return index;
    }
   
    @Override
    public void setReplicaContext(ReplicaContext replicaContext) {
        this.config = replicaContext.getStaticConfiguration();
        this.controller = replicaContext.getSVController();
        if (log == null) {
            checkpointPeriod = config.getCheckpointPeriod();
            byte[] state = getSnapshot();
            if (config.isToLog() && config.logToDisk()) {
                int replicaId = config.getProcessId();
                boolean isToLog = config.isToLog();
                boolean syncLog = config.isToWriteSyncLog();
                boolean syncCkp = config.isToWriteSyncCkp();
                log = new DiskStateLog(replicaId, state, computeHash(state), isToLog, syncLog, syncCkp);

                ApplicationState storedState = ((DiskStateLog) log).loadDurableState();
                if (storedState.getLastCID() > 0) {
                    setState(storedState);
                    getStateManager().setLastCID(storedState.getLastCID());
                }
            } else {
                log = new StateLog(this.config.getProcessId(), checkpointPeriod, state, computeHash(state));
            }
        }
        getStateManager().askCurrentConsensusId();
    }

    @Override
    public StateManager getStateManager() {
        if (stateManager == null) {
            stateManager = new StandardStateManager();
        }
        return stateManager;
    }


    
    
    @Override
    public byte[] executeUnordered(byte[] command, MessageContext msgCtx) {
        return appExecuteUnordered(command, msgCtx);
    }
    
    @Override
    public void Op(int CID, byte[] requests, MessageContext msgCtx) {
        //Requests are logged within 'executeBatch(...)' instead of in this method.
    }
    
    @Override
    public void noOp(int CID, MessageContext msgCtx) {
        
        executeBatch(new byte[1][0], new MessageContext[]{msgCtx}, true);

    }
    
    public abstract void installSnapshot(byte[] state);
    
    public abstract byte[] getSnapshot();
    
    public abstract byte[][] appExecuteBatch(byte[][] commands, MessageContext[] msgCtxs);
    
    public abstract byte[] appExecuteUnordered(byte[] command, MessageContext msgCtx);

}
