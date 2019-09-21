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
import java.util.HashMap;
import java.util.Map;

import java.io.Serializable;
import java.util.List;

/**
 *
 * @author sweta
 */
public class BFTMapList implements Serializable {
	
	private static final long serialVersionUID = -8898539992606449057L;
	
	private Map<String, List<String>> tableList = null;

	public BFTMapList() {
		tableList=new HashMap<String, List<String>>();
	}

        public Map<String, List<String>> getLists() {
            return tableList;
        }
        
	public List<String> addList(String key, List<String> list) {
		return tableList.put(key, list);
	}

	public boolean addData(String tableName, String value) {
		List <String> list = tableList.get(tableName);
                return list.add(value);
	}

	public List<String> getName(String tableName) {
		return tableList.get(tableName);
	}

	public String getEntry(String tableName, int index) {
		System.out.println("Table name: "+tableName);
		System.out.println("Entry index: "+ index);
		List<String> info= tableList.get(tableName);
		System.out.println("Table: "+info);
		return info.get(index);
	}

	public int getSizeofList() {

		return tableList.size();

	}

	public int getSize(String tableName) {
		List<String> table = tableList.get(tableName);
		return table.size();
	}

	public List<String> removeList(String tableName) {
		return tableList.remove(tableName);
	}

	public String removeEntry(String tableName,int index) {
		List<String> info= tableList.get(tableName);
		return info.remove(index);
	}
}
