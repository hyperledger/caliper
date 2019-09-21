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
import java.util.Random;

public class BFTMapClient {
	
	private static int VALUE_SIZE = 1024;

	public static void main(String[] args){
		if(args.length < 1) {
			System.out.println("Usage: java BFTMapClient <process id>");
			System.exit(-1);
		}

		int idProcess = Integer.parseInt(args[0]);//get process id

		BFTMap bftMap = new BFTMap(idProcess);
		String tableName = "table";

		try {
			createTable(bftMap,tableName);
		} catch (Exception e1) {
			e1.printStackTrace();
			System.out.println("Problems: Inserting a new value into the table("+tableName+"): "+e1.getLocalizedMessage());
			System.exit(1);
		}
		
		int ops = 0;
		while(true)	{
			try {
				boolean result = insertValue(bftMap,tableName,ops);
				if(!result) {
//					System.out.println("Problems: Inserting a new value into the table("+tableName+")");
//					System.exit(1);	
				}

				if(ops % 100 == 0)
					System.out.println("ops sent: "+ops);
				ops++;
//				Thread.sleep(10);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}

	private static boolean createTable(BFTMap bftMap, String nameTable) throws Exception {
		boolean tableExists;

		tableExists = bftMap.containsKey(nameTable);
		System.out.println("tableExists:" + tableExists);
		if (tableExists == false)
			bftMap.put(nameTable, new TreeMap<String,byte[]>());
		System.out.println("Created the table. Maybe");

		return tableExists;
	}

	private static boolean insertValue(BFTMap bftMap, String nameTable, int index) throws Exception {
		String key = "Key" + index;
		Random rand = new Random();
		byte[] valueBytes = new byte[VALUE_SIZE];
		rand.nextBytes(valueBytes);
		byte[] resultBytes = bftMap.putEntry(nameTable, key, valueBytes);
//		System.out.println("resultBytes" + resultBytes);
		if(resultBytes == null)
			return false;
		return true;
		
	}

	private static int getSizeTable(BFTMap bftMap, String tableName) throws Exception {
		int res = bftMap.size1(tableName);
		if(res == -1)
			throw new Exception();
		return  res;
	}

}