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
package bftsmart.demo.ycsb;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.Serializable;
import java.util.HashMap;
import java.util.Set;

/**
 * 
 * @author Marcel Santos
 *
 */
public class YCSBMessage implements Serializable {
	
	private static final long	serialVersionUID	= 6198684730704708506L;

	public enum Type {
		CREATE, READ, SCAN, UPDATE, DELETE, SIZE, ERROR
	};

	public enum Entity {
		TABLE, RECORD, FIELD
	};

	private Type	type;
	private Entity	entity;
	private String	table;
	private String	key;
	private Set<String> fields;
	private HashMap<String, byte[]> values;
	private int result = -1;
	private HashMap<String, byte[]> results;
	private String errorMsg;
	
	private YCSBMessage() {
		super();
		result = -1;
	}
	
	public static YCSBMessage newInsertRequest(String table, String key, HashMap<String, byte[]> values) {
		YCSBMessage message = new YCSBMessage();
		message.type = Type.CREATE;
		message.entity = Entity.RECORD;
		message.table = table;
		message.key = key;
		message.values = values;
		return message;
	}
	
	public static YCSBMessage newUpdateRequest(String table, String key, HashMap<String, byte[]> values) {
		YCSBMessage message = new YCSBMessage();
		message.type = Type.UPDATE;
		message.entity = Entity.RECORD;
		message.table = table;
		message.key = key;
		message.values = values;
		return message;
	}

	public static YCSBMessage newReadRequest(String table, String key, Set<String> fields, HashMap<String, byte[]> results) {
		YCSBMessage message = new YCSBMessage();
		message.type = Type.READ;
		message.entity = Entity.RECORD;
		message.table = table;
		message.key = key;
		message.fields = fields;
		message.results = results;
		return message;
	}
	
	public static YCSBMessage newInsertResponse(int result) {
		YCSBMessage message = new YCSBMessage();
		message.result = result;
		return message;
	}
	
	public static YCSBMessage newUpdateResponse(int result) {
		YCSBMessage message = new YCSBMessage();
		message.result = result;
		return message;
	}

	public static YCSBMessage newReadResponse(HashMap<String, byte[]> results, int result) {
		YCSBMessage message = new YCSBMessage();
		message.result = result;
		message.results = results;
		return message;
	}
	
	public static YCSBMessage newErrorMessage(String errorMsg) {
		YCSBMessage message = new YCSBMessage();
		message.errorMsg = errorMsg;
		return message;
	}
	
	public byte[] getBytes() {
		try {
			byte[] aArray = null;
			ByteArrayOutputStream aBaos = new ByteArrayOutputStream();
			ObjectOutputStream aOos = new ObjectOutputStream(aBaos);
			aOos.writeObject(this);
			aOos.flush();
			aBaos.flush();
			aArray = aBaos.toByteArray();
			aOos.close();
			aBaos.close();
			return aArray;
		} catch (IOException ex) {
			ex.printStackTrace();
			return null;
		}
	}

	public static YCSBMessage getObject(byte[] theBytes) {
		try {
			ByteArrayInputStream aBais = new ByteArrayInputStream(theBytes);
			ObjectInputStream aOis = new ObjectInputStream(aBais);
			YCSBMessage aMessage = (YCSBMessage) aOis.readObject();
			aOis.close();
			aBais.close();
			return aMessage;
		} catch (ClassNotFoundException ex) {
			return null;
		} catch (IOException e) {
			return null;
		}
	}

	@Override
	public String toString() {
		StringBuilder sb = new StringBuilder();
		sb.append("(").append(type).append(",").append(entity).append(",");
		sb.append(table).append(",").append(key).append(",").append(values).append(")");
		return sb.toString();
	}

	public int getResult() {
		return result;
	}
	public HashMap<String, byte[]> getResults() {
		return results;
	}

	public Type getType() {
		return type;
	}

	public Entity getEntity() {
		return entity;
	}

	public String getTable() {
		return table;
	}

	public String getKey() {
		return key;
	}

	public Set<String> getFields() {
		return fields;
	}

	public HashMap<String, byte[]> getValues() {
		return values;
	}
	
	public String getErrorMsg() {
		return errorMsg;
	}

}
