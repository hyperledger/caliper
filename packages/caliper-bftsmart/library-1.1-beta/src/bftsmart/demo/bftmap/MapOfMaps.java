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
package bftsmart.demo.bftmap;

import java.util.TreeMap;
import java.util.Map;

import java.io.Serializable;

/**
 *
 * 
 * @author sweta
 */
public class MapOfMaps implements Serializable {
	
	private static final long serialVersionUID = -8898539992606449057L;
	
	private Map<String, Map<String,byte[]>> tableMap = null;

	public MapOfMaps() {
		tableMap=new TreeMap<String, Map<String,byte[]>>();
	}

	public Map<String,byte[]> addTable(String key, Map<String, byte[]> table) {
		return tableMap.put(key, table);
	}

	public byte[] addData(String tableName, String key, byte[] value) {
		Map<String,byte[]> table = tableMap.get(tableName);
		if (table == null) { 
            System.out.println("Non-existant table: "+tableName);
            return null;
        }
		byte[] ret = table.put(key, value);
		return ret;
	}

	public Map<String,byte[]> getTable(String tableName) {
		return tableMap.get(tableName);
	}

	public byte[] getEntry(String tableName, String key) {
		System.out.println("Table name: "+tableName);
		System.out.println("Entry key: "+ key);
		Map<String,byte[]> info= tableMap.get(tableName);
		if (info == null) { 
                    System.out.println("Non-existant table: "+tableName);
                    return null;
                }
		return info.get(key);
	}

	public int getNumOfTables() {
		return tableMap.size();
	}

	public int getSize(String tableName) {
		Map<String,byte[]> table = tableMap.get(tableName);
		return (table == null)?0:table.size();
	}

	public Map<String,byte[]> removeTable(String tableName) {
		return tableMap.remove(tableName);
	}

	public byte[] removeEntry(String tableName,String key) {
		Map<String,byte[]> info= tableMap.get(tableName);
		return info.remove(key);
	}
}
