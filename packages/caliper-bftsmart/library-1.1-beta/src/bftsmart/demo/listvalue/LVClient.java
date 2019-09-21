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

/**
 * 
 * @author sweta
 */
public class LVClient {
	static int inc = 0;

	public static void main(String[] args) {
		if (args.length < 2) {
			System.out
					.println("Usage: java BFTMapInteractiveClient <process id> <use readonly?>");
			System.exit(-1);
		}

		int idProcess = Integer.parseInt(args[0]);// get process id

		BFTList bftMap = new BFTList(idProcess, Boolean.parseBoolean(args[1]));
		String tableName = "table-" + idProcess;

		try {
			createTable(bftMap, tableName);
		} catch (Exception e1) {
			System.out
					.println("Problems: Inserting a new value into the table("
							+ tableName + "): " + e1.getLocalizedMessage());
			System.exit(1);
		}

		while (true) {
			try {
				boolean result = insertValue(bftMap, tableName);
				if (!result) {
					System.out
							.println("Problems: Inserting a new value into the table("
									+ tableName + ")");
					System.exit(1);
				}

				int sizeTable = getSizeTable(bftMap);

				System.out.println("Size of the table(" + tableName + "): "
						+ sizeTable);
			} catch (Exception e) {
				bftMap = new BFTList(idProcess, Boolean.parseBoolean(args[1]));
				try {
					createTable(bftMap, tableName);
				} catch (Exception e1) {
					System.out.println("problems :-(");
				}
			}
		}
	}

	private static boolean createTable(BFTList bftMap, String nameTable)
			throws Exception {
		boolean tableExists;

		tableExists = bftMap.containsKey(nameTable);
		if (tableExists == false)
			bftMap.put(nameTable, null);

		return tableExists;
	}

	private static boolean insertValue(BFTList bftMap, String nameTable)
			throws Exception {

		String value = "Key" + (inc++);

		boolean added = bftMap.putEntry(nameTable, value);
		System.out.println("Result : " + added);

		return true;
	}

	private static int getSizeTable(BFTList bftMap) throws Exception {
		int res = bftMap.size();
		// if(res == -1)
		// throw new Exception();
		return res;
	}

}