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
package bftsmart.tom.server;

import bftsmart.statemanagement.ApplicationState;
import bftsmart.statemanagement.StateManager;
import bftsmart.tom.MessageContext;
import bftsmart.tom.ReplicaContext;

/**
 * Classes that implement this interface should implement a state transfer protocol.
 * Typically, classes should both implement this interface and one of the executables.
 * 
 * @author Marcel Santos
 *
 */
public interface Recoverable {
	
	public void setReplicaContext(ReplicaContext replicaContext);
	
    /**
     * 
     * This  method should return a representation of the application state
     * @param cid Consensus up to which the application should return an Application state
     * @param sendState true if the replica should send a complete
     * representation of the state instead of only the hash. False otherwise
     * @return  A representation of the application state
     */
    public ApplicationState getState(int cid, boolean sendState);
    
    /**
     * Sets the state to the representation obtained in the state transfer protocol
     * @param state State obtained in the state transfer protocol
     * @return 
     */
    public int setState(ApplicationState state);
    
    /**
     * Recoverers implementing this interface will have to chose among
     * different options of state managers like DurableStateManager or
     * StandardStateManager. The recoverer class can also define a new
     * strategy to manage the state and return it in this method.
     * @return the implementation of state manager that suplies the strategy defined
     */
    public StateManager getStateManager();
    
    /**
     * This method is invoked by ServiceReplica to pass information that was
     * decided in a particular consensus instance. This method is always invoked before
     * the executor. However, multiple invocations for the same consensus ID may
     * occur, so developers must take this behavior into consideration when developing
     * their own logging and checkpointing. If there is no information to be passed to
     * the application, noOp(...) is invoked instead.
     * 
     * @param CID the consensus instance ID associated with the request
     * @param requests A request decided in CID
     * @param msgCtx Message context associated with the client request and the consensus instance
     * where it was ordered. msgCtx.getConsensusId() will be equal to CID.
     * 
     * 
     */
    public void Op(int CID, byte[] requests, MessageContext msgCtx);
    
    /**
     * This method is invoked by ServiceReplica to indicate that a consensus instance
     * finished without delivering anything to the application (e.g., an instance
     * only decided a single reconfiguration operation. or an instance where the client
     * operation was not delivered because its view was outdated). To allow the underlying state
     * transfer protocol to execute correctly, it needs to be notified of this special case
     * In the current protocols included, it suffices to register a NOOP operation in the
     * logs used within the state transfer, but never deliver it to the application
     * 
     * @param CID the consensus instance where the aforementioned condition occurred
     * @param msgCtx Message context associated with the consensus instance. furthermore
     * msgCtx.getConsensusId() will be equal to CID.
     */
    public void noOp(int CID, MessageContext msgCtx);
	
}
