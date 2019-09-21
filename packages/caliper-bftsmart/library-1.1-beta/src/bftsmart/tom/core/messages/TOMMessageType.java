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
package bftsmart.tom.core.messages;

/**
 * Possible types of TOMMessage
 * 
 * @author alysson
 */
public enum TOMMessageType {
    ORDERED_REQUEST, //0
    UNORDERED_REQUEST, //1
    REPLY, //2
    RECONFIG, //3
    ASK_STATUS, // 4
    STATUS_REPLY,// 5
    UNORDERED_HASHED_REQUEST; //6
    
    public int toInt() {
        switch(this) {
            case ORDERED_REQUEST: return 0;
            case UNORDERED_REQUEST: return 1;
            case REPLY: return 2;
            case RECONFIG: return 3;
            case ASK_STATUS: return 4;
            case STATUS_REPLY: return 5;
            case UNORDERED_HASHED_REQUEST: return 6;
            default: return -1;
        }
    }
    
    public static TOMMessageType fromInt(int i) {
        switch(i) {
            case 0: return ORDERED_REQUEST;
            case 1: return UNORDERED_REQUEST;
            case 2: return REPLY;
            case 3: return RECONFIG;
            case 4: return ASK_STATUS;
            case 5: return STATUS_REPLY;
            case 6: return UNORDERED_HASHED_REQUEST;
            default: return RECONFIG;
        }            
    }
}
