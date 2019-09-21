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
package bftsmart.statemanagement.strategy;

import java.io.IOException;
import java.io.ObjectInput;
import java.io.ObjectOutput;

import bftsmart.reconfiguration.views.View;
import bftsmart.statemanagement.ApplicationState;
import bftsmart.statemanagement.SMMessage;

/**
 * 
 * @author Marcel Santos
 *
 */
public class StandardSMMessage extends SMMessage {

	private int replica;

    public StandardSMMessage(int sender, int cid, int type, int replica, ApplicationState state, View view, int regency, int leader) {
    	super(sender, cid, type, state, view, regency, leader);
    	this.replica = replica;
    }
	
    public StandardSMMessage() {
    	super();
    }
    
    /**
     * Retrieves the replica that should send the state
     * @return The replica that should send the state
     */
    public int getReplica() {
        return replica;
    }

    @Override
    public void writeExternal(ObjectOutput out) throws IOException{
        super.writeExternal(out);
        out.writeInt(replica);
    }

    @Override
    public void readExternal(ObjectInput in) throws IOException, ClassNotFoundException{
        super.readExternal(in);
        replica = in.readInt();
    }
}
