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
package bftsmart.tom.server;

import bftsmart.tom.MessageContext;

/**
 * 
 * Executables that implement this interface will receive a batch of requests and
 * deliver them to the application in a deterministic way.
 * 
 * @author Marcel Santos
 *
 */
public interface BatchExecutable extends Executable {
	
	/**
	 * Execute a batch of requests.
	 * @param command
	 * @param msgCtx
	 * @return
	 */
    public byte[][] executeBatch(byte[][] command, MessageContext[] msgCtx);

}
