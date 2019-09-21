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
package bftsmart.demo.random;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.util.Scanner;
import java.math.BigInteger;

import bftsmart.tom.MessageContext;
import bftsmart.tom.ServiceReplica;
import bftsmart.tom.server.defaultservices.DefaultRecoverable;

/**
 *
 * @author Joao Sousa
 */
public final class RandomServer extends DefaultRecoverable {

    private int value = 0;
    private int iterations = 0;
    private int id = -1;
    
    private ServiceReplica replica;
    
    public ServiceReplica getReplica() {
		return replica;
	}

	public void setReplica(ServiceReplica replica) {
		this.replica = replica;
	}


    public RandomServer(int id) {
    	replica = new ServiceReplica(id, this, this);
        this.id = id;
    }

    public RandomServer(int id, boolean join) {
    	replica = new ServiceReplica(id, join, this, this);
        this.id = id;
    }

    public byte[] execute(byte[] command, MessageContext msgCtx) {
        iterations++;
        try {
            DataInputStream input = new DataInputStream(new ByteArrayInputStream(command));
            int operator = input.readInt();            
            int argument = (new BigInteger(msgCtx.getNonces())).intValue() + 1;

            System.out.println("(" + id + ")[server] Argument: " + argument);
            switch (operator) {
                case 0:
                    value = value + argument;
                    System.out.println("(" + id + ")[server] Operator: +");
                    break;
                case 1:
                    value = value - argument;
                    System.out.println("(" + id + ")[server] Operator: -");
                    break;
                case 2:
                    value = value * argument;
                    System.out.println("(" + id + ")[server] Operator: *");
                    break;
                case 3:
                    value = value / argument;
                    System.out.println("(" + id + ")[server] Operator: /");
                    break;
            }
            
            if (msgCtx == null) {
                
                System.out.println("Message Context is still null!!!???");
                System.exit(0);
            }
            
            System.out.println("(" + id + ")[server] (" + iterations + " / " + 
                    msgCtx.getConsensusId() + " / " + msgCtx.getRegency() + " / "
                    + msgCtx.getLeader() +  ") Current value: " + value);
            
            ByteArrayOutputStream out = new ByteArrayOutputStream(4);
            new DataOutputStream(out).writeInt(value);
            return out.toByteArray();
        } catch (IOException ex) {
            System.err.println("Invalid request received!");
            return new byte[0];
        }
    }

    /**
     * Just return the current value
     * 
     * @param command Command to b executed
     * @param msgCtx Context of  the message received
     * @return Reply t obe sent to the client
     */
    @Override
    public byte[] appExecuteUnordered(byte[] command, MessageContext msgCtx) {
        iterations++;
        try {
            System.out.println("(" + id + ")[server] (" + iterations + " / " + 
                    msgCtx.getConsensusId() + ") Current value: " + value);
            
            ByteArrayOutputStream out = new ByteArrayOutputStream(4);
            new DataOutputStream(out).writeInt(value);
            return out.toByteArray();
        } catch (IOException ex) {
            System.err.println("Never happens!");
            return new byte[0];
        }        
    }

        public static void main(String[] args){
        if(args.length < 1) {
            System.out.println("Use: java RandomServer <processId>");
            System.exit(-1);
        }

        RandomServer replica = null;
        if(args.length > 1) {
            replica = new RandomServer(Integer.parseInt(args[0]), Boolean.valueOf(args[1]));
        }else{
            replica = new RandomServer(Integer.parseInt(args[0]));
        }

        Scanner scan = new Scanner(System.in);
        String ln = scan.nextLine();
        if (ln != null) replica.getReplica().leave();
        //new RandomServer(Integer.parseInt(args[0]));
    }

    public byte[] getState() {

        byte[] b = new byte[4];
        //byte[] b = new byte[1024 * 1024 * 30];
        //for (int i = 0; i > b.length; i++) b[i] = (byte) i;
        for (int i = 0; i < 4; i++) {
            int offset = (b.length - 1 - i) * 8;
            b[i] = (byte) ((value >>> offset) & 0xFF);
        }
        return b;

        //throw new UnsupportedOperationException("Not supported yet.");
    }

    public void setState(byte[] state) {

        int value = 0;
        for (int i = 0; i < 4; i++) {
            int shift = (4 - 1 - i) * 8;
            value += (state[i] & 0x000000FF) << shift;
        }

        this.value = value;
    }

    @Override
    public void installSnapshot(byte[] state) {
        int value = 0;
        for (int i = 0; i < 4; i++) {
            int shift = (4 - 1 - i) * 8;
            value += (state[i] & 0x000000FF) << shift;
        }

        this.value = value;
    }

    @Override
    public byte[] getSnapshot() {
        byte[] b = new byte[4];
        //byte[] b = new byte[1024 * 1024 * 30];
        //for (int i = 0; i > b.length; i++) b[i] = (byte) i;
        for (int i = 0; i < 4; i++) {
            int offset = (b.length - 1 - i) * 8;
            b[i] = (byte) ((value >>> offset) & 0xFF);
        }
        return b;
    }

    @Override
    public byte[][] appExecuteBatch(byte[][] commands, MessageContext[] msgCtxs) {
        byte [][] replies = new byte[commands.length][];
        for (int i = 0; i < commands.length; i++) {
            //replies[i] = execute(commands[i], (msgCtxs  != null ? msgCtxs[i] : null));
            replies[i] = execute(commands[i], msgCtxs[i]);
        }
        return replies;
    }

}
