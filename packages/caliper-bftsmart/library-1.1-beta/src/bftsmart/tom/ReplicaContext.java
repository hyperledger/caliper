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

import bftsmart.communication.ServerCommunicationSystem;
import bftsmart.reconfiguration.ServerViewController;
import bftsmart.reconfiguration.util.TOMConfiguration;
import bftsmart.reconfiguration.views.View;

/**
 * This class contains information related to the replica.
 * 
 * @author Alysson Bessani
 */
public class ReplicaContext {
    
    private ServerCommunicationSystem cs; // Server side comunication system
    private ServerViewController SVController;

    public ReplicaContext(ServerCommunicationSystem cs, 
                                 ServerViewController SVController) {
        this.cs = cs;
        this.SVController = SVController;
    }

    /**
     * Returns the controller of the replica's view
     * @return The controller of the replica's view
     */
    public ServerViewController getSVController() {
        return SVController;
    }
    
    //TODO: implement a method that allow the replica to send a message with
    //total order to all other replicas
       
    /**
     * Returns the static configuration of this replica.
     * 
     * @return the static configuration of this replica
     */
    public TOMConfiguration getStaticConfiguration() {
        return SVController.getStaticConf();
    }
    
    /**
     * Returns the current view of the replica group.
     * 
     * @return the current view of the replica group.
     */
    public View getCurrentView() {
        return SVController.getCurrentView();
    }

	public ServerCommunicationSystem getServerCommunicationSystem() {
		return cs;
	}

	public void setServerCommunicationSystem(ServerCommunicationSystem cs) {
		this.cs = cs;
	}
}
