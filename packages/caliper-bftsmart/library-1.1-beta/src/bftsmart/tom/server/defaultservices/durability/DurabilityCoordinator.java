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
package bftsmart.tom.server.defaultservices.durability;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.concurrent.locks.ReentrantLock;
import java.util.logging.Level;

import bftsmart.reconfiguration.util.TOMConfiguration;
import bftsmart.statemanagement.ApplicationState;
import bftsmart.statemanagement.StateManager;
import bftsmart.statemanagement.strategy.durability.CSTRequest;
import bftsmart.statemanagement.strategy.durability.CSTState;
import bftsmart.statemanagement.strategy.durability.DurableStateManager;
import bftsmart.tom.MessageContext;
import bftsmart.tom.ReplicaContext;
import bftsmart.tom.server.BatchExecutable;
import bftsmart.tom.server.Recoverable;
import bftsmart.tom.server.defaultservices.CommandsInfo;
import bftsmart.tom.util.Logger;
import bftsmart.tom.util.TOMUtil;

/**
 * Implements the Collaborative State Transfer protocol. In this protocol, instead of
 * all replicas send the state and log, or state and hash of the log, the replicas
 * are divided into three groups. One group sends the state, another group sends the
 * lower half of the log and the third group sends the upper portion of the log.
 * The replica that receives the state, logs and hashes validates the state and install
 * it.
 * The details of the protocol are described in the paper "On the Efficiency of Durable
 * State Machine Replication".
 *
 * @author Marcel Santos
 */
public abstract class DurabilityCoordinator implements Recoverable, BatchExecutable {

	private ReentrantLock logLock = new ReentrantLock();
	private ReentrantLock hashLock = new ReentrantLock();
	private ReentrantLock stateLock = new ReentrantLock();

	private TOMConfiguration config;

	private MessageDigest md;

	private DurableStateLog log;

	private StateManager stateManager;

	private int lastCkpCID;
	private int globalCheckpointPeriod;
	private int checkpointPortion;
	private int replicaCkpIndex;

	public DurabilityCoordinator() {
		try {
			md = MessageDigest.getInstance("MD5"); // TODO: shouldn't it be SHA?
		} catch (NoSuchAlgorithmException ex) {
			java.util.logging.Logger.getLogger(DurabilityCoordinator.class.getName()).log(Level.SEVERE, null, ex);
		}
	}

        @Override
        public byte[][] executeBatch(byte[][] commands, MessageContext[] msgCtxs) {
            return executeBatch(commands, msgCtxs, false);
        }
    
        private byte[][] executeBatch(byte[][] commands, MessageContext[] msgCtx, boolean noop) {
		int cid = msgCtx[msgCtx.length-1].getConsensusId();

		int[] cids = consensusIds(msgCtx);
		int checkpointIndex = findCheckpointPosition(cids);
		byte[][] replies = new byte[commands.length][];

		// During the consensus IDs contained in this batch of commands none of the
		// replicas is supposed to take a checkpoint, so the replica will only execute
		// the command and return the replies
		if(checkpointIndex == -1) {
			
                    if (!noop) {
                        stateLock.lock();
			replies = appExecuteBatch(commands, msgCtx);
			stateLock.unlock();
                    }
                    Logger.println("(DurabilityCoordinator.executeBatch) Storing message batch in the state log for consensus " + cid);
                    saveCommands(commands, msgCtx);
		} else {
			// there is a replica supposed to take the checkpoint. In this case, the commands
			// has to be executed in two steps. First the batch of commands containing commands
			// until the checkpoint period is executed and the log saved or checkpoint taken
			// if this replica is the one supposed to take the checkpoint. After the checkpoint
			// or log, the pointer in the log is updated and then the remaining portion of the
			// commands is executed
			byte[][] firstHalf = new byte[checkpointIndex + 1][];
			MessageContext[] firstHalfMsgCtx = new MessageContext[firstHalf.length];
			byte[][] secondHalf = new byte[commands.length - (checkpointIndex + 1)][];
			MessageContext[] secondHalfMsgCtx = new MessageContext[secondHalf.length];
			System.arraycopy(commands, 0, firstHalf, 0, checkpointIndex +1);
			System.arraycopy(msgCtx, 0, firstHalfMsgCtx, 0, checkpointIndex+1);
			if(secondHalf.length > 0) {
				System.arraycopy(commands, checkpointIndex + 1, secondHalf, 0, commands.length - (checkpointIndex + 1));
				System.arraycopy(msgCtx, checkpointIndex+1, secondHalfMsgCtx, 0,  commands.length - (checkpointIndex + 1));
			} else
				firstHalfMsgCtx = msgCtx;

			byte[][] firstHalfReplies = new byte[firstHalf.length][];
			byte[][] secondHalfReplies = new byte[secondHalf.length][];

			// execute the first half
			cid = msgCtx[checkpointIndex].getConsensusId();
			
                        if (!noop) {
                            stateLock.lock();
                            firstHalfReplies = appExecuteBatch(firstHalf, firstHalfMsgCtx);
                            stateLock.unlock();
                        }
                        
			if (cid % globalCheckpointPeriod == replicaCkpIndex && lastCkpCID < cid ) {
				Logger.println("(DurabilityCoordinator.executeBatch) Performing checkpoint for consensus " + cid);
				stateLock.lock();
				byte[] snapshot = getSnapshot();
				stateLock.unlock();
				saveState(snapshot, cid);
				lastCkpCID = cid;
			} else {
				Logger.println("(DurabilityCoordinator.executeBatch) Storing message batch in the state log for consensus " + cid);
				saveCommands(firstHalf, firstHalfMsgCtx);
			}

			System.arraycopy(firstHalfReplies, 0, replies, 0, firstHalfReplies.length);

			// execute the second half if it exists
			if(secondHalf.length > 0) {
				//	        	System.out.println("----THERE IS A SECOND HALF----");
				cid = msgCtx[msgCtx.length - 1].getConsensusId();
				if (!noop) {
                                    
                                    stateLock.lock();
                                    secondHalfReplies = appExecuteBatch(secondHalf, secondHalfMsgCtx);
                                    stateLock.unlock();
                                    
                                }
				Logger.println("(DurabilityCoordinator.executeBatch) Storing message batch in the state log for consensus " + cid);
				saveCommands(secondHalf, secondHalfMsgCtx);

				System.arraycopy(secondHalfReplies, 0, replies, firstHalfReplies.length, secondHalfReplies.length);
			}

		}

		if(cids != null && cids.length > 0)
			getStateManager().setLastCID(cids[cids.length-1]);
		return replies;
	}

	/**
	 * Iterates over the commands to find if any replica took a checkpoint.
	 * When a replica take a checkpoint, it is necessary to save in an auxiliary table
	 * the position in the log in which that replica took the checkpoint.
	 * It is used during state transfer to find lower or upper log portions to be
	 * restored in the recovering replica.
	 * This iteration over commands is needed due to the batch execution strategy
	 * introduced with the durable techniques to improve state management. As several
	 * consensus instances can be executed in the same batch of commands, it is necessary
	 * to identify if the batch contains checkpoint indexes.

	 * @param msgCtxs the contexts of the consensus where the messages where executed.
	 * There is one msgCtx message for each command to be executed

	 * @return the index in which a replica is supposed to take a checkpoint. If there is
	 * no replica taking a checkpoint during the period comprised by this command batch, it
	 * is returned -1
	 */
	private int findCheckpointPosition(int[] cids) {
		if(config.getGlobalCheckpointPeriod() < 1)
			return -1;
		if(cids.length == 0)
			throw new IllegalArgumentException();
		int firstCID = cids[0];
		if((firstCID + 1) % checkpointPortion == 0) {
			return cidPosition(cids, firstCID);
		} else {
			int nextCkpIndex = (((firstCID / checkpointPortion) + 1) * checkpointPortion) - 1;
			if(nextCkpIndex <= cids[cids.length -1]) {
				return cidPosition(cids, nextCkpIndex);
			}
		}
		return -1;
	}

	/**
	 * Iterates over the message contexts to retrieve the index of the last
	 * command executed prior to the checkpoint. That index is used by the
	 * state transfer protocol to find the position of the log commands in
	 * the log file. 
	 * 
	 * @param msgCtx the message context of the commands executed by the replica.
	 * There is one message context for each command
	 * @param cid the CID of the consensus where a replica took a checkpoint
	 * @return the higher position where the CID appears
	 */
	private int cidPosition(int[] cids, int cid) {
		int index = -1;
		if(cids[cids.length-1] == cid)
			return cids.length-1;
		for(int i = 0; i < cids.length; i++) {
			if(cids[i] > cid)
				break;
			index++;
		}
		System.out.println("--- Checkpoint is in position " + index);
		return index;
	}


	@Override
	public ApplicationState getState(int cid, boolean sendState) {
		logLock.lock();
		ApplicationState ret = null;
		logLock.unlock();
		return ret;
	}

	@Override
	public int setState(ApplicationState recvState) {
		int lastCID = -1;
		if (recvState instanceof CSTState) {
			CSTState state = (CSTState) recvState;

			int lastCheckpointCID = state.getCheckpointCID();
			lastCID = state.getLastCID();

			bftsmart.tom.util.Logger.println("(DurabilityCoordinator.setState) I'm going to update myself from CID "
					+ lastCheckpointCID + " to CID " + lastCID);

			stateLock.lock();
			if(state.getSerializedState() != null) {
				System.out.println("The state is not null. Will install it");
				log.update(state);
				installSnapshot(state.getSerializedState());
			}

			System.out.print("--- Installing log from " + (lastCheckpointCID+1) + " to " + lastCID);

			for (int cid = lastCheckpointCID + 1; cid <= lastCID; cid++) {
				try {
					bftsmart.tom.util.Logger.println("(DurabilityCoordinator.setState) interpreting and verifying batched requests for CID " + cid);
					CommandsInfo cmdInfo = state.getMessageBatch(cid); 
					byte[][] commands = cmdInfo.commands;
					MessageContext[] msgCtx = cmdInfo.msgCtx;

                                        if (commands == null || msgCtx == null || msgCtx[0].isNoOp()) {
                                            continue;
                                        }
                                        
					appExecuteBatch(commands, msgCtx);
				} catch (Exception e) {
					e.printStackTrace(System.err);
				}

			}
			System.out.println("--- Installed");
			stateLock.unlock();

		}

		return lastCID;
	}

	private final byte[] computeHash(byte[] data) {
		byte[] ret = null;
		hashLock.lock();
		ret = md.digest(data);
		hashLock.unlock();
		return ret;
	}

	private void saveState(byte[] snapshot, int lastCID) {
		logLock.lock();

		Logger.println("(TOMLayer.saveState) Saving state of CID " + lastCID);

		log.newCheckpoint(snapshot, computeHash(snapshot), lastCID);
		log.setLastCID(-1);
		log.setLastCheckpointCID(lastCID);

		logLock.unlock();
		Logger.println("(TOMLayer.saveState) Finished saving state of CID " + lastCID);
	}

	/**
	 * Write commands to log file
	 * @param commands array of commands. Each command is an array of bytes
	 * @param msgCtx
	 */
	private void saveCommands(byte[][] commands, MessageContext[] msgCtx) {
		if(!config.isToLog())
			return;       
                
                if (commands.length != msgCtx.length) {
                    System.out.println("----SIZE OF COMMANDS AND MESSAGE CONTEXTS IS DIFFERENT----");
                    System.out.println("----COMMANDS: " + commands.length + ", CONTEXTS: " + msgCtx.length + " ----");
                }
                
                logLock.lock();

		int cid = msgCtx[0].getConsensusId();
		int batchStart = 0;
		for(int i = 0; i <= msgCtx.length; i++) {
			if(i == msgCtx.length) { // the batch command contains only one command or it is the last position of the array
				byte[][] batch = Arrays.copyOfRange(commands, batchStart, i);
				MessageContext[] batchMsgCtx = Arrays.copyOfRange(msgCtx, batchStart, i);
				log.addMessageBatch(batch, batchMsgCtx, cid);
				log.setLastCID(cid, globalCheckpointPeriod, checkpointPortion);
				//				if(batchStart > 0)
				//					System.out.println("Last batch: " + commands.length + "," + batchStart + "-" + i + "," + batch.length);
			} else {
				if(msgCtx[i].getConsensusId() > cid) { // saves commands when the CID changes or when it is the last batch
					byte[][] batch = Arrays.copyOfRange(commands, batchStart, i);
					MessageContext[] batchMsgCtx = Arrays.copyOfRange(msgCtx, batchStart, i);
					//					System.out.println("THERE IS MORE THAN ONE CID in this batch." + commands.length + "," + batchStart + "-" + i + "," + batch.length);
					log.addMessageBatch(batch, batchMsgCtx, cid);
					log.setLastCID(cid, globalCheckpointPeriod, checkpointPortion);
					cid = msgCtx[i].getConsensusId();
					batchStart = i;
				}
			}
		}
		logLock.unlock();
	}


	public CSTState getState(CSTRequest cstRequest) {
		CSTState ret = log.getState(cstRequest);
		return ret;
	}

	@Override
	public void setReplicaContext(ReplicaContext replicaContext) {
		this.config = replicaContext.getStaticConfiguration();
		if(log == null) {
			globalCheckpointPeriod = config.getGlobalCheckpointPeriod();
			replicaCkpIndex = getCheckpointPortionIndex();
			checkpointPortion = globalCheckpointPeriod / config.getN();

//			byte[] state = getSnapshot();
			if(config.isToLog()) {
				int replicaId = config.getProcessId();
				boolean isToLog = config.isToLog();
				boolean syncLog = config.isToWriteSyncLog();
				boolean syncCkp = config.isToWriteSyncCkp();
//				log = new DurableStateLog(replicaId, state, computeHash(state), isToLog, syncLog, syncCkp);
				log = new DurableStateLog(replicaId, null, null, isToLog, syncLog, syncCkp);
				CSTState storedState = log.loadDurableState();
				if(storedState.getLastCID() > -1) {
					System.out.println("LAST CID RECOVERED FROM LOG: " + storedState.getLastCID());
					setState(storedState);
					getStateManager().setLastCID(storedState.getLastCID());
				} else {
					System.out.println("REPLICA IS IN INITIAL STATE");
				}
			}
			getStateManager().askCurrentConsensusId();
		}
	}

	private int getCheckpointPortionIndex() {
		int numberOfReplicas = config.getN();
		int ckpIndex = ((globalCheckpointPeriod / numberOfReplicas) * (config.getProcessId() + 1)) -1;
		return ckpIndex;
	}

	/**
	 * Iterates over the message context array and get the consensus id of each command
	 * being executed. As several times during the execution of commands and logging the
	 * only information important in MessageContext is the consensus id, it saves time to
	 * have it already in an array of ids
	 * @param ctxs the message context, one for each command to be executed
	 * @return the id of the consensus decision for each command
	 */
	private int[] consensusIds(MessageContext[] ctxs) {
		int[] cids = new int[ctxs.length];
		for(int i = 0; i < ctxs.length; i++)
			cids[i] = ctxs[i].getConsensusId();
		return cids;
	}
        
	@Override
	public StateManager getStateManager() {
		if(stateManager == null)
			stateManager = new DurableStateManager();
		return stateManager;
	}

	public byte[] getCurrentStateHash() {
		byte[] currentState = getSnapshot();
		byte[] currentStateHash = TOMUtil.computeHash(currentState);
		System.out.println("--- State size: " + currentState.length + " Current state Hash: " + Arrays.toString(currentStateHash));
		return currentStateHash;
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
