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
package bftsmart.demo.listvalue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.ObjectInput;
import java.io.ObjectInputStream;
import java.io.ObjectOutput;
import java.io.ObjectOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

import bftsmart.tom.MessageContext;
import bftsmart.tom.ReplicaContext;
import bftsmart.tom.ServiceReplica;
import bftsmart.tom.server.defaultservices.DefaultRecoverable;


/**
 *
 * @author sweta
 * 
 * This class will create a ServiceReplica and will initialize
 * it with a implementation of Executable and Recoverable interfaces. 
 */
public class BFTListImpl extends DefaultRecoverable {

    BFTMapList tableList = new BFTMapList();
    ServiceReplica replica = null;    
    //The constructor passes the id of the server to the super class
    public BFTListImpl(int id) {
        super();
    	replica = new ServiceReplica(id, this, this);
    }

    
    public static void main(String[] args){
        if(args.length < 1) {
            System.out.println("Use: java BFTMapImpl <processId>");
            System.exit(-1);
        }
        new BFTListImpl(Integer.parseInt(args[0]));
    }
    
    @Override
    public byte[] getSnapshot() {
        try {

            //System.out.println("[getSnapshot] tables: " + tableMap.getSizeofTable());
            // serialize to byte array and return
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            ObjectOutput out = new ObjectOutputStream(bos);
            out.writeObject(tableList);
            
            out.flush();
            bos.flush();
            out.close();
            bos.close();
            return bos.toByteArray();
        } catch (IOException ex) {
            Logger.getLogger(BFTListImpl.class.getName()).log(Level.SEVERE, null, ex);
            return new byte[0];
        }   
    }
    
    //@Override
    /*public byte[] getSnapshot() {
        try {
            Map<String, Map<String, byte[]>> tables = tableMap.getTables();
            Collection<String> tableNames = tables.keySet();
            ByteArrayOutputStream baos = new ByteArrayOutputStream(10000);
            DataOutputStream dos = new DataOutputStream(baos);
            for(String tableName : tableNames) {
                System.out.println("[getSnapshot] Table name: " + tableName);
                dos.writeUTF(tableName);
                Map<String, byte[]> tableTmp = tables.get(tableName);
                dos.writeInt(tableTmp.size());
                for(String key : tableTmp.keySet()) {
                    dos.writeUTF(key);
                    dos.flush();
                    byte[] value = tableTmp.get(key);
                    dos.writeInt(value.length);
                    dos.write(value);
                    dos.flush();
                    System.out.println("[getSnapshot] ---- Size of  key '" + key + "': " + value.length);
                }
                System.out.println("[getSnapshot] ---- Count of rows for table '" + tableName + "': " + tableTmp.size());
                dos.flush();
            }
            byte[] state = baos.toByteArray();
            System.out.println("[getSnapshot] Current byte array size: " + state.length);
            return state;
        } catch (IOException ex) {
            Logger.getLogger(BFTMapImpl.class.getName()).log(Level.SEVERE, null, ex);
            return new byte[0];
        }
    }*/

    @Override
    public void installSnapshot(byte[] state) {
        try {

            // serialize to byte array and return
            ByteArrayInputStream bis = new ByteArrayInputStream(state);
            ObjectInput in = new ObjectInputStream(bis);
            tableList = (BFTMapList) in.readObject();
            in.close();
            bis.close();

        } catch (ClassNotFoundException ex) {
            Logger.getLogger(BFTListImpl.class.getName()).log(Level.SEVERE, null, ex);
        } catch (IOException ex) {
            Logger.getLogger(BFTListImpl.class.getName()).log(Level.SEVERE, null, ex);
        }
    }

    //@Override
    /*public void installSnapshot(byte[] state) {
        try {
            tableMap = new BFTTableMap();
            ByteArrayInputStream bais = new ByteArrayInputStream(state);
            DataInputStream dis = new DataInputStream(bais);
           
            System.out.println("[installSnapshot] Current byte array size: " + state.length);
            while(dis.available() > 0) {
                Map<String, byte[]> table = new HashMap<String, byte[]>();
                String tableName = dis.readUTF();
                System.out.println("[installSnapshot] Table name: " + tableName);
                tableMap.addTable(tableName, table);
                int tableSize = dis.readInt();
                System.out.println("[installSnapshot] ---- Count of rows for table '" + tableName + "': " + tableSize);
                for(int i = 0; i < tableSize; i++) {
                    String key = dis.readUTF();
                    int valueSize = dis.readInt();
                    byte[] value = new byte[valueSize];
                    dis.read(value, 0, valueSize);
                    System.out.println("[installSnapshot] ---- Size of  key '" + key + "': " + value.length);
                    tableMap.addData(tableName, key, value);
                }
               
            }
        } catch (IOException ex) {
            Logger.getLogger(BFTMapImpl.class.getName()).log(Level.SEVERE, null, ex);
        }
    }*/
    
    @Override
    @SuppressWarnings("static-access")
    public byte[][] appExecuteBatch(byte[][] commands, MessageContext[] msgCtxs) {
        
        byte [][] replies = new byte[commands.length][];
        for (int i = 0; i < commands.length; i++) {
            
            byte [] command = commands[i];
            
            // O MENSSAGE CONTEXT APARECE A NULO QUANDO SE INSTALA O ESTADO!!!
            //MessageContext msgCtx = msgCtxs[i];
            try {
                ByteArrayInputStream in = new ByteArrayInputStream(command);
                ByteArrayOutputStream out = null;
                byte[] reply = null;
                String listName, value;
                int index;
                List<String> list = null;
                int cmd = new DataInputStream(in).readInt();
                switch (cmd) {
                    //operations on the hashmap
                    case LVRequestType.PUT:
                        listName = new DataInputStream(in).readUTF();
                        value = new DataInputStream(in).readUTF();
                        //String value = new DataInputStream(in).readUTF();
                        //byte[] valueBytes = value.getBytes();
                        //System.out.println("Key received: " + key);
                        out = new ByteArrayOutputStream();
                        boolean added = tableList.addData(listName, value);
                        if (added) System.out.println("added " + listName + " with value " + value);
                        DataOutputStream dout = new DataOutputStream(out);
                        dout.writeBoolean(added);
                        dout.close();
                        out.close();
                        reply = out.toByteArray();
                        System.out.println("array size: " + reply.length);
                        break;
                    case LVRequestType.REMOVE:
                        listName = new DataInputStream(in).readUTF();
                        index = new DataInputStream(in).readInt();
                        System.out.println("Index received: " + index);
                        value = tableList.removeEntry(listName, index);
                        //value = new String(valueBytes);
                        System.out.println("Value removed is : " + value);
                        out = new ByteArrayOutputStream();
                        new DataOutputStream(out).writeUTF(value);
                        reply = out.toByteArray();
                        out.close();
                        break;
                    case LVRequestType.LIST_CREATE:
                        listName = new DataInputStream(in).readUTF();
                        //ByteArrayInputStream in1 = new ByteArrayInputStream(command);
                        ObjectInputStream objIn = new ObjectInputStream(in);
                        try {
                            boolean hasList = objIn.readBoolean();
                            if (hasList) list = (List<String>) objIn.readObject();
                            else list = new ArrayList<String>();
                        } catch (ClassNotFoundException ex) {
                            Logger.getLogger(BFTListImpl.class.getName()).log(Level.SEVERE, null, ex);
                        }
                        List<String> listCreated = tableList.addList(listName, list);
                        ByteArrayOutputStream bos = new ByteArrayOutputStream();
                        ObjectOutputStream objOut = new ObjectOutputStream(bos);
                        objOut.writeObject(listCreated);
                        objOut.close();
                        in.close();
                        reply = bos.toByteArray();
                        break;
                    case LVRequestType.LIST_REMOVE:
                        listName = new DataInputStream(in).readUTF();
                        list = tableList.removeList(listName);
                        bos = new ByteArrayOutputStream();
                        objOut = new ObjectOutputStream(bos);
                        objOut.writeObject(list);
                        objOut.close();
                        objOut.close();
                        reply = bos.toByteArray();
                        break;


                    case LVRequestType.SIZE_TABLE:
                        int size1 = tableList.getSizeofList();
                        System.out.println("Size " + size1);
                        out = new ByteArrayOutputStream();
                        new DataOutputStream(out).writeInt(size1);
                        reply = out.toByteArray();
                        out.close();
                        break;
                    case LVRequestType.GET:
                        listName = new DataInputStream(in).readUTF();
                        System.out.println("tablename: " + listName);
                        index = new DataInputStream(in).readInt();
                        System.out.println("index received: " + index);
                        value = tableList.getEntry(listName, index);
                        //value = new String(valueBytes);
                        System.out.println("The value to be get is: " + value);
                        out = new ByteArrayOutputStream();
                        new DataOutputStream(out).writeUTF(value);
                        reply = out.toByteArray();
                        out.close();
                        break;
                    case LVRequestType.SIZE:
                        String tableName2 = new DataInputStream(in).readUTF();
                        int size = tableList.getSize(tableName2);
                        out = new ByteArrayOutputStream();
                        new DataOutputStream(out).writeInt(size);
                        reply = out.toByteArray();
                        out.close();
                        break;
                    case LVRequestType.CHECK:
                        listName = new DataInputStream(in).readUTF();
                        index = new DataInputStream(in).readInt();
                        System.out.println("Table Key received: " + index);
                        value = tableList.getEntry(listName, index);
                        boolean entryExists = value != null;
                        out = new ByteArrayOutputStream();
                        new DataOutputStream(out).writeBoolean(entryExists);
                        reply = out.toByteArray();
                        out.close();
                        break;
                    case LVRequestType.LIST_CREATE_CHECK:
                        listName = new DataInputStream(in).readUTF();
                        System.out.println("Table of Table Key received: " + listName);
                        list = tableList.getName(listName);
                        boolean tableExists = (list != null);
                        System.out.println("Table exists: " + tableExists);
                        out = new ByteArrayOutputStream();
                        new DataOutputStream(out).writeBoolean(tableExists);
                        reply = out.toByteArray();
                        out.close();
                        break;
                    }
                    replies[i] = reply;
                } catch (IOException ex) {
                    Logger.getLogger(BFTListImpl.class.getName()).log(Level.SEVERE, null, ex);
                    return null;
                }
        }
        return replies;
    }

    @SuppressWarnings("static-access")
    public byte[] appExecuteUnordered(byte[] command, MessageContext msgCtx) {
    	try {
	        ByteArrayInputStream in = new ByteArrayInputStream(command);
	        ByteArrayOutputStream out = null;
	        byte[] reply = null;
	        int cmd = new DataInputStream(in).readInt();
                String value;
                int index;
                List<String> list;
	        switch (cmd) {
                case LVRequestType.SIZE_TABLE:
                    int size1 = tableList.getSizeofList();
                    System.out.println("Size " + size1);
                    out = new ByteArrayOutputStream();
                    new DataOutputStream(out).writeInt(size1);
                    reply = out.toByteArray();
                    break;
                case LVRequestType.GET:
                    String tableName = new DataInputStream(in).readUTF();
                    System.out.println("tablename: " + tableName);
                    index = new DataInputStream(in).readInt();
                    System.out.println("Key received: " + index);
                    value = tableList.getEntry(tableName, index);
                    //String value = new String(valueBytes);
                    System.out.println("The value to be get is: " + value);
                    out = new ByteArrayOutputStream();
                    new DataOutputStream(out).writeBytes(value);
                    reply = out.toByteArray();
                    break;
                case LVRequestType.SIZE:
                    String tableName2 = new DataInputStream(in).readUTF();
                    int size = tableList.getSize(tableName2);
                    System.out.println("Size " + size);
                    out = new ByteArrayOutputStream();
                    new DataOutputStream(out).writeInt(size);
                    reply = out.toByteArray();
                    break;
	        case LVRequestType.CHECK:
	            tableName = new DataInputStream(in).readUTF();
	            index = new DataInputStream(in).readInt();
	            System.out.println("Table Key received: " + index);
	            value = tableList.getEntry(tableName, index);
	            boolean entryExists = value != null;
	            out = new ByteArrayOutputStream();
	            new DataOutputStream(out).writeBoolean(entryExists);
	            reply = out.toByteArray();
	            break;
		case LVRequestType.LIST_CREATE_CHECK:
		    tableName = new DataInputStream(in).readUTF();
		    System.out.println("Table of Table Key received: " + tableName);
		    list = tableList.getName(tableName);
		    boolean tableExists = (list != null);
		    System.out.println("Table exists: " + tableExists);
		    out = new ByteArrayOutputStream();
		    new DataOutputStream(out).writeBoolean(tableExists);
		    reply = out.toByteArray();
		    break;
	        }
	        return reply;
	    } catch (IOException ex) {
	        Logger.getLogger(BFTListImpl.class.getName()).log(Level.SEVERE, null, ex);
	        return null;
	    }
    }

}