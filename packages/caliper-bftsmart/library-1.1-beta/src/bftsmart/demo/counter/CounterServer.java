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
package bftsmart.demo.counter;

import bftsmart.tom.MessageContext;
import bftsmart.tom.ServiceReplica;
import bftsmart.tom.server.defaultservices.DefaultRecoverable;
//import bftsmart.tom.server.defaultservices.DefaultRecoverable;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.ObjectInput;
import java.io.ObjectInputStream;
import java.io.ObjectOutput;
import java.io.ObjectOutputStream;

/**
 * Example replica that implements a BFT replicated service (a counter).
 *
 */

public final class CounterServer extends DefaultRecoverable  {
    
    private int counter = 0;
    private int iterations = 0;
    
    ServiceReplica replica = null;

    public CounterServer(int id) {
    	replica = new ServiceReplica(id, this, this);
    }
    
    @Override
    public byte[][] appExecuteBatch(byte[][] commands, MessageContext[] msgCtxs) {
        
        
        byte [][] replies = new byte[commands.length][];
        for (int i = 0; i < commands.length; i++) {
            if(msgCtxs != null && msgCtxs[i] != null) {
            replies[i] = executeSingle(commands[i],msgCtxs[i]);
            }
            else executeSingle(commands[i],null);
        }
        
        return replies;
    }
        
    @Override
    public byte[] appExecuteUnordered(byte[] command, MessageContext msgCtx) {
                
        iterations++;
        System.out.println("(" + iterations + ") Reading counter at value: " + counter);
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream(4);
            new DataOutputStream(out).writeInt(counter);
            return out.toByteArray();
        } catch (IOException ex) {
            System.err.println("Invalid request received!");
            return new byte[0];
        }
    }
    
    private byte[] executeSingle(byte[] command, MessageContext msgCtx) {
        iterations++;
        try {
            int increment = new DataInputStream(new ByteArrayInputStream(command)).readInt();
            //System.out.println("read-only request: "+(msgCtx.getConsensusId() == -1));
            counter += increment;
            
            if (msgCtx != null) {
                if (msgCtx.getConsensusId() == -1) {
                    System.out.println("(" + iterations + ") Counter was incremented: " + counter);
                } else {
                    System.out.println("(" + iterations + " / " + msgCtx.getConsensusId() + ") Counter was incremented: " + counter);
                }
            }
            else {
                System.out.println("(" + iterations + ") Counter was incremented: " + counter);
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream(4);
            new DataOutputStream(out).writeInt(counter);
            return out.toByteArray();
        } catch (IOException ex) {
            System.err.println("Invalid request received!");
            return new byte[0];
        }
    }

    public static void main(String[] args){
        if(args.length < 1) {
            System.out.println("Use: java CounterServer <processId>");
            System.exit(-1);
        }      
        new CounterServer(Integer.parseInt(args[0]));
    }

    
	@SuppressWarnings("unchecked")
	@Override
	public void installSnapshot(byte[] state) {
		try {
			System.out.println("setState called");
			ByteArrayInputStream bis = new ByteArrayInputStream(state);
			ObjectInput in = new ObjectInputStream(bis);
			counter =  in.readInt();
			in.close();
			bis.close();
		} catch (Exception e) {
			System.err.println("[ERROR] Error deserializing state: "
					+ e.getMessage());
		}
	}

	@Override
	public byte[] getSnapshot() {
		try {
			System.out.println("getState called");
			ByteArrayOutputStream bos = new ByteArrayOutputStream();
			ObjectOutput out = new ObjectOutputStream(bos);
			out.writeInt(counter);
			out.flush();
			bos.flush();
			out.close();
			bos.close();
			return bos.toByteArray();
		} catch (IOException ioe) {
			System.err.println("[ERROR] Error serializing state: "
					+ ioe.getMessage());
			return "ERROR".getBytes();
		}
	}
}
