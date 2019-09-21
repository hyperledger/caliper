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

import java.io.Serializable;

/**
 * This class is used to define the roles in the Collaborative State Transfer protocol.
 * The recovering replica uses this class to define which replicas should send the
 * checkpoint, log of opperations lower and higher portions
 * 
 * @author Marcel Santos
 */
public abstract class CSTRequest implements Serializable {
	
	private static final long serialVersionUID = 7463498141366035002L;
	
	protected int cid;
	/** id of the replica responsible for sending the checkpoint;*/
	protected int checkpointReplica;
	
	public CSTRequest(int cid) {
		this.cid = cid;
	}
	
	public int getCID() {
		return cid;
	}
	
	public int getCheckpointReplica() {
		return checkpointReplica;
	}

	public abstract void defineReplicas(int[] processes, int globalCkpPeriod, int replicaId);

}
