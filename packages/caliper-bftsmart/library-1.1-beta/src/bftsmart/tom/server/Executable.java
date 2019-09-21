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
 * Executables that implement this interface can received unordered client requests.
 * To support ordered requests, objects that implement this interface must also implement
 * either 'FIFOExecutable', 'BatchExecutable' or 'SingleExecutable'.
 * 
 * @author Marcel Santos
 *
 */
public interface Executable {

    /**
     * Method called to execute a request totally ordered.
     * 
     * The message context contains some useful information such as the command
     * sender.
     * 
     * @param command the command issue by the client
     * @param msgCtx information related with the command
     * 
     * @return the reply for the request issued by the client
     */
    public byte[] executeUnordered(byte[] command, MessageContext msgCtx);
}
