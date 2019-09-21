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

import java.net.InetSocketAddress;

/**
 * This class is used to define the roles in the Collaborative State Transfer protocol.
 * The recovering replica uses this class to define which replicas should send the
 * checkpoint, log of operations lower and higher portions
 * 
 * @author Marcel Santos
 */
public class CSTRequestF1 extends CSTRequest {
	
	private static final long serialVersionUID = 6298204287341984504L;
	
	/** id of the replica responsible for sending the upper portion of the log;*/
	private int logUpper;
	/** id of the replica responsible for sending the lower portion of the log;*/
	private int logLower;
	private int ckpPeriod;
	private int logUpperSize;
//	private int logLowerSkip;
	private int logLowerSize;
	private InetSocketAddress address;
	
	public CSTRequestF1(int cid) {
		super(cid);
	}
	
//	public int getCkpPeriod() {
//		return this.ckpPeriod;
//	}
//
	public int getLogUpper() {
		return logUpper;
	}

	public void setLogUpper(int logUpper) {
		this.logUpper = logUpper;
	}

	public int getLogLower() {
		return logLower;
	}

	public void setLogLower(int logLower) {
		this.logLower = logLower;
	}
	
	public int getLogUpperSize() {
		return logUpperSize;
	}

	
	/**
	 * Define and set the attributes of this CST Request according to the
	 * algorithm described in the durability state transfer paper.
	 * In summary, the algorithm defines that, in a situation with three
	 * seeders, the seeder in the middle (the one that took the checkpoint
	 * just after the oldest) must send the checkpoint. The oldest must
	 * send the log of the period between the middle checkpoint until the
	 * checkpoint of the newest replica. The newest replica must send the
	 * log from the begging to the CID requested.
	 */
	public void defineReplicas(int[] otherReplicas, int globalCkpPeriod, int me) {
    	int N = otherReplicas.length + 1; // The total number of replicas is the others plus me 
    	ckpPeriod = globalCkpPeriod / N;
//    	logLowerSkip = ckpPeriod;
    	logLowerSize = ckpPeriod;
    	logUpperSize = (cid + 1) % ckpPeriod;
    	
    	// position of the replica with the oldest checkpoint in the others array
    	int oldestReplicaPosition = getOldest(otherReplicas, cid, globalCkpPeriod, me);
    	
    	logLower = otherReplicas[oldestReplicaPosition];
    	checkpointReplica = otherReplicas[(oldestReplicaPosition + 1) % otherReplicas.length];
    	logUpper = otherReplicas[(oldestReplicaPosition + 2) % otherReplicas.length];
    	
    }
	
	/**
	 * Iterates over the others array to find the oldest replica to generate the
	 * checkpoint. In the case where the oldest replica to generate the checkpoint
	 * is me, and therefore, it is not in the others array, it is returned the
	 * replica with id immediate before me
	 * @param others the other replicas in BFT-SMaRt
	 * @param cid the CID that I am requesting
	 * @param globalCheckpointPeriod the global checkpoint period in which all replicas
	 * should perform the checkpoint
	 * @param me my id
	 * @return the position of the replica with the latest checkpoint in the others array
	 */
	private int getOldest(int[] others, int cid, int globalCheckpointPeriod, int me) {
		int N = others.length + 1;
		int oldestCkpReplica = (cid % globalCheckpointPeriod) / (globalCheckpointPeriod / N);
		if(oldestCkpReplica == me) {
			oldestCkpReplica = (oldestCkpReplica + 1) % N;
		} else if((oldestCkpReplica + 3) % N == me) {
	    	logUpperSize = ((cid + 1) % ckpPeriod) + ckpPeriod;
		} else if((oldestCkpReplica + 2) % N == me) {
	    	logLowerSize = 2 * ckpPeriod;
		} else {
		}
		for(int i = 0; i < others.length; i++) {
			if(others[i] == oldestCkpReplica)
				return i;
		}
		return -1;
	}

	public InetSocketAddress getAddress() {
		return address;
	}

	public void setAddress(InetSocketAddress address) {
		this.address = address;
	}

//	public int getLogLowerSkip() {
//		return logLowerSkip;
//	}

	public int getLogLowerSize() {
		return logLowerSize;
	}
	
}
