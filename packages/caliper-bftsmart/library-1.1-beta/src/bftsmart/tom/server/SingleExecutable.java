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
 * Executables that implement this interface will receive client requests individually.
 * 
 * @author Marcel Santos
 *
 */
public interface SingleExecutable extends Executable {

    /**
     * Method called to execute a request totally ordered.
     * 
     * The message context contains a lot of information about the request, such
     * as timestamp, nonces and sender. The code for this method MUST use the value
     * of timestamp instead of relying on its own local clock, and nonces instead
     * of trying to generated its own random values.
     * 
     * This is important because this values are the same for all replicas, and
     * therefore, ensure the determinism required in a replicated state machine.
     *
     * @param command the command issue by the client
     * @param msgCtx information related with the command
     * 
     * @return the reply for the request issued by the client
     */
    public byte[] executeOrdered(byte[] command, MessageContext msgCtx);

}
