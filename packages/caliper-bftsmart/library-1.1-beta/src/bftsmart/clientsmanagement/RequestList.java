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
package bftsmart.clientsmanagement;

import java.util.Arrays;
import java.util.LinkedList;
import java.util.ListIterator;

import bftsmart.tom.core.messages.TOMMessage;

/**
 * Extended LinkedList used to store pending requests issued by a client.
 *
 * @author alysson
 */
public class RequestList extends LinkedList<TOMMessage> {
	
	private static final long serialVersionUID = -3639222602426147629L;
	
	private int maxSize = Integer.MAX_VALUE;

    public RequestList() {
    }

    public RequestList(int maxSize) {
        super();
        this.maxSize = maxSize;
    }

    @Override
    public void addLast(TOMMessage msg) {
        super.addLast(msg);
        if(size() > maxSize) {
            super.removeFirst();
        }
    }

    public TOMMessage remove(byte[] serializedMessage) {
        for(ListIterator<TOMMessage> li = listIterator(); li.hasNext(); ) {
            TOMMessage msg = li.next();
            if(Arrays.equals(serializedMessage,msg.serializedMessage)) {
                li.remove();
                return msg;
            }
        }
        return null;
    }

    public TOMMessage removeById(int id){
        for(ListIterator<TOMMessage> li = listIterator(); li.hasNext(); ) {
            TOMMessage msg = li.next();
            if(msg.getId() == id) {
                li.remove();
                return msg;
            }
        }
        return null;
    }

     // I think this method can be removed in future versions of JBP
    public int[] getIds(){
        int ids[] = new int[size()];
        for(int i = 0; i < ids.length; i++){
            ids[i] = get(i).getId();
        }

        return ids;
    }

    public TOMMessage get(byte[] serializedMessage){
        for(ListIterator<TOMMessage> li = listIterator(); li.hasNext(); ) {
            TOMMessage msg = li.next();
            if(Arrays.equals(serializedMessage,msg.serializedMessage)) {
                return msg;
            }
        }
        return null;
    }


    public TOMMessage getById(int id){
        for(ListIterator<TOMMessage> li = listIterator(); li.hasNext(); ) {
            TOMMessage msg = li.next();
            if(msg.getId() == id) {
                return msg;
            }
        }
        return null;
    }
    
    public TOMMessage getBySequence(int sequence){
        for(ListIterator<TOMMessage> li = listIterator(); li.hasNext(); ) {
            TOMMessage msg = li.next();
            if(msg.getSequence() == sequence) {
                return msg;
            }
        }
        return null;
    }
    public boolean contains(int id){
        for(ListIterator<TOMMessage> li = listIterator(); li.hasNext(); ) {
            TOMMessage msg = li.next();
            if(msg.getId() == id) {
                return true;
            }
        }
        return false;
    }
}
