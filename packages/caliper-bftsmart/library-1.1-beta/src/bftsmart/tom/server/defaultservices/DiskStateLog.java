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

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.ObjectOutputStream;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.channels.SocketChannel;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

import bftsmart.statemanagement.ApplicationState;
import bftsmart.tom.MessageContext;

public class DiskStateLog extends StateLog {

	private int id;
	public final static String DEFAULT_DIR = "files".concat(System
			.getProperty("file.separator"));
	private static final int INT_BYTE_SIZE = 4;
	private static final int EOF = 0;

	private RandomAccessFile log;
	private boolean syncLog;
	private String logPath;
	private String lastCkpPath;
	private boolean syncCkp;
	private boolean isToLog;
	private ReentrantLock checkpointLock = new ReentrantLock();
	private Map<Integer, Long> logPointers;
	
	public DiskStateLog(int id, byte[] initialState, byte[] initialHash,
			boolean isToLog, boolean syncLog, boolean syncCkp) {
		super(id, initialState, initialHash);
		this.id = id;
		this.isToLog = isToLog;
		this.syncLog = syncLog;
		this.syncCkp = syncCkp;
		this.logPointers = new HashMap<>();
	}

	private void createLogFile() {
		logPath = DEFAULT_DIR + String.valueOf(id) + "."
				+ System.currentTimeMillis() + ".log";
		try {
			log = new RandomAccessFile(logPath, (syncLog ? "rwd" : "rw"));
			// PreAllocation
			/*
			 * log.setLength(TEN_MB); log.seek(0);
			 */
		} catch (FileNotFoundException e) {
			e.printStackTrace();
		}
	}

	/**
	 * Adds a message batch to the log. This batches should be added to the log
	 * in the same order in which they are delivered to the application. Only
	 * the 'k' batches received after the last checkpoint are supposed to be
	 * kept
	 * 
	 * @param commands The batch of messages to be kept.
         * @param consensusId
	 */
        @Override
	public void addMessageBatch(byte[][] commands, MessageContext[] msgCtx, int consensusId) {
		CommandsInfo command = new CommandsInfo(commands, msgCtx);
		if (isToLog) {
			if(log == null)
				createLogFile();
			writeCommandToDisk(command, consensusId);
		}
		setLastCID(consensusId);
	}

	private void writeCommandToDisk(CommandsInfo commandsInfo, int consensusId) {
		ByteArrayOutputStream bos = new ByteArrayOutputStream();
		try {
			ObjectOutputStream oos = new ObjectOutputStream(bos);
			oos.writeObject(commandsInfo);
			oos.flush();

			byte[] batchBytes = bos.toByteArray();

			ByteBuffer bf = ByteBuffer.allocate(3 * INT_BYTE_SIZE
					+ batchBytes.length);
			bf.putInt(batchBytes.length);
			bf.put(batchBytes);
			bf.putInt(EOF);
			bf.putInt(consensusId);
			
			log.write(bf.array());
			log.seek(log.length() - 2 * INT_BYTE_SIZE);// Next write will overwrite
													// the EOF mark
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
	    }
	}

        @Override
	public void newCheckpoint(byte[] state, byte[] stateHash, int consensusId) {
		String ckpPath = DEFAULT_DIR + String.valueOf(id) + "."
				+ System.currentTimeMillis() + ".tmp";
		try {
			checkpointLock.lock();
			RandomAccessFile ckp = new RandomAccessFile(ckpPath,
					(syncCkp ? "rwd" : "rw"));

			ByteBuffer bf = ByteBuffer.allocate(state.length + stateHash.length
					+ 4 * INT_BYTE_SIZE);
			bf.putInt(state.length);
			bf.put(state);
			bf.putInt(stateHash.length);
			bf.put(stateHash);
			bf.putInt(EOF);
			bf.putInt(consensusId);

			byte[] ckpState = bf.array();
			
			ckp.write(ckpState);
			ckp.close();

			if (isToLog)
				deleteLogFile();
			deleteLastCkp();
			renameCkp(ckpPath);
			if (isToLog)
				createLogFile();
			
		} catch (FileNotFoundException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		} finally {
			checkpointLock.unlock();
		}
	}

	private void renameCkp(String ckpPath) {
		String finalCkpPath = ckpPath.replace(".tmp", ".ckp");
		new File(ckpPath).renameTo(new File(finalCkpPath));
		lastCkpPath = finalCkpPath;
	}

	private void deleteLastCkp() {
		if (lastCkpPath != null)
			new File(lastCkpPath).delete();
	}

	private void deleteLogFile() {
		try {
			if(log != null)
				log.close();
			new File(logPath).delete();
		} catch (IOException e) {
			e.printStackTrace();
		}
	}

	/**
	 * Constructs a TransferableState using this log information
	 * 
	 * @param cid Consensus ID correspondent to desired state
         * @param sendState
	 * @return TransferableState Object containing this log information
	 */
        @Override
	public DefaultApplicationState getApplicationState(int cid, boolean sendState) {
//		readingState = true;
		CommandsInfo[] batches = null;

		int lastCheckpointCID = getLastCheckpointCID();
		int lastCID = getLastCID();
		System.out.println("LAST CKP CID = " + lastCheckpointCID);
		System.out.println("CID = " + cid);
		System.out.println("LAST CID = " + lastCID);
		if (cid >= lastCheckpointCID && cid <= lastCID) {

			int size = cid - lastCheckpointCID;

			FileRecoverer fr = new FileRecoverer(id, DEFAULT_DIR);

//			if (size > 0 && sendState) {
			if (size > 0) {
				CommandsInfo[] recoveredBatches = fr.getLogState(size, logPath);

				batches = new CommandsInfo[size];

				for (int i = 0; i < size; i++)
					batches[i] = recoveredBatches[i];
			}
			
			checkpointLock.lock();
			byte[] ckpState = fr.getCkpState(lastCkpPath);
			byte[] ckpStateHash = fr.getCkpStateHash();
			checkpointLock.unlock();

			System.out.println("--- FINISHED READING STATE");
//			readingState = false;

//			return new DefaultApplicationState((sendState ? batches : null), lastCheckpointCID,
			return new DefaultApplicationState(batches, lastCheckpointCID,
					cid, (sendState ? ckpState : null), ckpStateHash, this.id);

		}
		return null;
	}
	
	public void transferApplicationState(SocketChannel sChannel, int cid) {
		FileRecoverer fr = new FileRecoverer(id, DEFAULT_DIR);
		fr.transferCkpState(sChannel, lastCkpPath);
//		int lastCheckpointCID = getLastCheckpointCID();
//		int lastCID = getLastCID();
//		if (cid >= lastCheckpointCID && cid <= lastCID) {
//			int size = cid - lastCheckpointCID;
//			fr.transferLog(sChannel, size);
//		}
	}

	public void setLastCID(int cid, int checkpointPeriod, int checkpointPortion) {
		super.setLastCID(cid);
		// save the file pointer to retrieve log information later
		if((cid % checkpointPeriod) % checkpointPortion == checkpointPortion -1) {
			int ckpReplicaIndex = (((cid % checkpointPeriod) + 1) / checkpointPortion) -1;
			try {
				System.out.println(" --- Replica " + ckpReplicaIndex + " took checkpoint. My current log pointer is " + log.getFilePointer());
				logPointers.put(ckpReplicaIndex, log.getFilePointer());
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
	}

	/**
	 * Updates this log, according to the information contained in the
	 * TransferableState object
	 * 
	 * @param transState
	 *            TransferableState object containing the information which is
	 *            used to updated this log
	 */
        @Override
	public void update(DefaultApplicationState transState) {
		newCheckpoint(transState.getState(), transState.getStateHash(), transState.getLastCheckpointCID());
		setLastCheckpointCID(transState.getLastCheckpointCID());
	}
	
	protected ApplicationState loadDurableState() {
		FileRecoverer fr = new FileRecoverer(id, DEFAULT_DIR);
		lastCkpPath = fr.getLatestFile(".ckp");
		logPath = fr.getLatestFile(".log");
		byte[] checkpoint = null;
		if(lastCkpPath != null)
			checkpoint = fr.getCkpState(lastCkpPath);
		CommandsInfo[] log = null;
		if(logPath !=null)
			log = fr.getLogState(0, logPath);
		int ckpLastConsensusId = fr.getCkpLastConsensusId();
		int logLastConsensusId = fr.getLogLastConsensusId();
		System.out.println("log last consensus di: " + logLastConsensusId);
		ApplicationState state = new DefaultApplicationState(log, ckpLastConsensusId,
				logLastConsensusId, checkpoint, fr.getCkpStateHash(), this.id);
		if(logLastConsensusId > ckpLastConsensusId) {
			super.setLastCID(logLastConsensusId);
		} else
			super.setLastCID(ckpLastConsensusId);
		super.setLastCheckpointCID(ckpLastConsensusId);
		
		return state;
	}
}
