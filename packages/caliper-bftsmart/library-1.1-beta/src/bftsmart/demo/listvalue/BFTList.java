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
import java.util.Collection;
import java.util.Set;

import java.util.logging.Level;
import java.util.logging.Logger;

import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.util.List;
import java.util.Map;

import bftsmart.tom.ServiceProxy;

/**
 *
 * @author sweta
 */
public class BFTList implements Map<String, List<String>> {

	ServiceProxy KVProxy = null;
        private boolean useReadOnly;
        
	BFTList(int id, boolean useReadOnly) {
		KVProxy = new ServiceProxy(id, "config");
                this.useReadOnly = useReadOnly;
	}
	ByteArrayOutputStream out = null;

	public List<String> get(String tableName) {
		try {
			out = new ByteArrayOutputStream();
			new DataOutputStream(out).writeInt(LVRequestType.GET);
			new DataOutputStream(out).writeUTF(tableName);

			byte[] rep = KVProxy.invokeOrdered(out.toByteArray());
			ByteArrayInputStream bis = new ByteArrayInputStream(rep) ;
			ObjectInputStream in = new ObjectInputStream(bis) ;
			List<String> table = (List<String>) in.readObject();
			in.close();
			return table;
		} catch (ClassNotFoundException ex) {
			Logger.getLogger(BFTList.class.getName()).log(Level.SEVERE, null, ex);
			return null;
		} catch (IOException ex) {
			Logger.getLogger(BFTList.class.getName()).log(Level.SEVERE, null, ex);
			return null;
		}

	}

	public String getEntry(String tableName,int index) {
		try {
			out = new ByteArrayOutputStream();
			new DataOutputStream(out).writeInt(LVRequestType.GET);
			new DataOutputStream(out).writeUTF(tableName);
			new DataOutputStream(out).writeInt(index);
			byte[] rep = KVProxy.invokeOrdered(out.toByteArray());
			ByteArrayInputStream bis = new ByteArrayInputStream(rep) ;
			ObjectInputStream in = new ObjectInputStream(bis) ;
			String value = in.readUTF();
			in.close();
                        return value;
		} catch (IOException ex) {
			Logger.getLogger(BFTList.class.getName()).log(Level.SEVERE, null, ex);
			return null;
		}
	}


	public List<String> put(String listName, List<String> value) {
		try {
			out = new ByteArrayOutputStream();
			new DataOutputStream(out).writeInt(LVRequestType.LIST_CREATE);
			new DataOutputStream(out).writeUTF(listName);
			//ByteArrayOutputStream bos = new ByteArrayOutputStream() ;
			ObjectOutputStream  out1 = new ObjectOutputStream(out) ;
			if (value != null) {
                            out1.writeBoolean(true);
                            out1.writeObject(value);
                        }
                        else {
                            out1.writeBoolean(false);
                        }
			out1.close();
			byte[] rep = KVProxy.invokeOrdered(out.toByteArray());
			ByteArrayInputStream bis = new ByteArrayInputStream(rep) ;
			ObjectInputStream in = new ObjectInputStream(bis) ;
			List<String> list = (List<String>) in.readObject();
			in.close();
			return list;

		} catch (ClassNotFoundException ex) {
			Logger.getLogger(BFTList.class.getName()).log(Level.SEVERE, null, ex);
			return null;
		} catch (IOException ex) {
			Logger.getLogger(BFTList.class.getName()).log(Level.SEVERE, null, ex);
			return null;
		}
	}

	public boolean putEntry(String listName, String value) {
		try {
			out = new ByteArrayOutputStream();
			new DataOutputStream(out).writeInt(LVRequestType.PUT);
			new DataOutputStream(out).writeUTF(listName);
			new DataOutputStream(out).writeUTF(value);
			byte[] rep = KVProxy.invokeOrdered(out.toByteArray());
                        System.out.println("blabla1");
			ByteArrayInputStream bis = new ByteArrayInputStream(rep);
                        System.out.println("blabla2");
			DataInputStream in = new DataInputStream(bis);
                        System.out.println("blabla3");
			boolean added = in.readBoolean();
                        System.out.println("blabla4");
			in.close();
                        bis.close();
                        return added;
		} catch (IOException ex) {
			Logger.getLogger(BFTList.class.getName()).log(Level.SEVERE, null, ex);
			return false;
		}

	}

	public List<String> remove(Object key) {
		try {
			out = new ByteArrayOutputStream();
			new DataOutputStream(out).writeInt(LVRequestType.LIST_REMOVE);
			new DataOutputStream(out).writeUTF((String) key);
			byte[] rep = KVProxy.invokeOrdered(out.toByteArray());

			ByteArrayInputStream bis = new ByteArrayInputStream(rep) ;
			ObjectInputStream in = new ObjectInputStream(bis) ;
			List<String> list = (List<String>) in.readObject();
			in.close();
			return list;
		} catch (ClassNotFoundException ex) {
			Logger.getLogger(BFTList.class.getName()).log(Level.SEVERE, null, ex);
			return null;
		} catch (IOException ex) {
			Logger.getLogger(BFTList.class.getName()).log(Level.SEVERE, null, ex);
			return null;
		}

	}

	public String removeEntry(String tableName,int index)  {
		try {
			out = new ByteArrayOutputStream();
			new DataOutputStream(out).writeInt(LVRequestType.REMOVE);
			new DataOutputStream(out).writeUTF((String) tableName);
			new DataOutputStream(out).writeInt(index);
			byte[] rep = KVProxy.invokeOrdered(out.toByteArray());
			ByteArrayInputStream bis = new ByteArrayInputStream(rep) ;
			ObjectInputStream in = new ObjectInputStream(bis) ;
			String rem = in.readUTF();
			in.close();
                        return rem;
		} catch (IOException ex) {
			Logger.getLogger(BFTList.class.getName()).log(Level.SEVERE, null, ex);
			return null;
		}

	}
	public int size() {
		try {
			out = new ByteArrayOutputStream();
			new DataOutputStream(out).writeInt(LVRequestType.SIZE_TABLE);
			byte[] rep;
			if(useReadOnly)
				rep = KVProxy.invokeUnordered(out.toByteArray());
			else
				rep = KVProxy.invokeOrdered(out.toByteArray());
			ByteArrayInputStream in = new ByteArrayInputStream(rep);
			int size = new DataInputStream(in).readInt();
			return size;
		} catch (IOException ex) {
			Logger.getLogger(BFTList.class.getName()).log(Level.SEVERE, null, ex);
			return -1;
		}
	}

	public int size1(String tableName) {
		try {
			out = new ByteArrayOutputStream();
			new DataOutputStream(out).writeInt(LVRequestType.SIZE);
			new DataOutputStream(out).writeUTF(tableName);
			byte[] rep;
			if(useReadOnly)
				rep = KVProxy.invokeUnordered(out.toByteArray());
			else
				rep = KVProxy.invokeOrdered(out.toByteArray());
			ByteArrayInputStream in = new ByteArrayInputStream(rep);
			int size = new DataInputStream(in).readInt();
			return size;
		} catch (IOException ex) {
			Logger.getLogger(BFTList.class.getName()).log(Level.SEVERE, null, ex);
			return 0;
		}
	}

	public boolean containsKey(String key) {

		try {

			out = new ByteArrayOutputStream();
			new DataOutputStream(out).writeInt(LVRequestType.LIST_CREATE_CHECK);
			new DataOutputStream(out).writeUTF((String) key);
			byte[] rep;
			if(useReadOnly)
				rep = KVProxy.invokeUnordered(out.toByteArray());
			else
				rep = KVProxy.invokeOrdered(out.toByteArray());
			ByteArrayInputStream in = new ByteArrayInputStream(rep);
			boolean res = new DataInputStream(in).readBoolean();
			return res;

		} catch (IOException ex) {
			Logger.getLogger(BFTList.class.getName()).log(Level.SEVERE, null, ex);
			return false;
		}

	}

	public boolean containsKey1(String tableName, String key) {

		try {

			out = new ByteArrayOutputStream();
			new DataOutputStream(out).writeInt(LVRequestType.CHECK);
			new DataOutputStream(out).writeUTF((String) tableName);
			new DataOutputStream(out).writeUTF((String) key);
			byte[] rep;
			if(useReadOnly)
				rep = KVProxy.invokeUnordered(out.toByteArray());
			else
				rep = KVProxy.invokeOrdered(out.toByteArray());
			ByteArrayInputStream in = new ByteArrayInputStream(rep);
			boolean res = new DataInputStream(in).readBoolean();
			return res;

		} catch (IOException ex) {
			Logger.getLogger(BFTList.class.getName()).log(Level.SEVERE, null, ex);
			return false;
		}

	}




	public boolean isEmpty() {
		throw new UnsupportedOperationException("Not supported yet.");
	}



	public boolean containsValue(Object value) {
		throw new UnsupportedOperationException("Not supported yet.");
	}

	public void putAll(Map m) {
		throw new UnsupportedOperationException("Not supported yet.");
	}

	public void clear() {
		throw new UnsupportedOperationException("Not supported yet.");
	}

	public Set keySet() {
		throw new UnsupportedOperationException("Not supported yet.");
	}

	public Collection values() {
		throw new UnsupportedOperationException("Not supported yet.");
	}

	public Set entrySet() {
		throw new UnsupportedOperationException("Not supported yet.");
	}

	public boolean containsKey(Object key) {
		throw new UnsupportedOperationException("Not supported yet.");
	}

    @Override
    public List<String> get(Object key) {
        throw new UnsupportedOperationException("Not supported yet.");
    }



}


