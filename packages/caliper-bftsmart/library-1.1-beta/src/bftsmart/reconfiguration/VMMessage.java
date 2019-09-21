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
package bftsmart.reconfiguration;

import java.io.IOException;
import java.io.ObjectInput;
import java.io.ObjectOutput;

import bftsmart.communication.SystemMessage;

/**
 *
 * @author eduardo
 */
public class VMMessage extends SystemMessage{
    private ReconfigureReply reply;
    
    public VMMessage(){}
    
    public VMMessage(ReconfigureReply reply){
        super();
        this.reply = reply;
    }
    
     public VMMessage(int from, ReconfigureReply reply){
         super(from);
         this.reply = reply;
    }
     
     
      // Implemented method of the Externalizable interface
    @Override
    public void writeExternal(ObjectOutput out) throws IOException {
        super.writeExternal(out);
        out.writeObject(reply);
    }

    // Implemented method of the Externalizable interface
    @Override
    public void readExternal(ObjectInput in) throws IOException, ClassNotFoundException {
        super.readExternal(in);
        this.reply = (ReconfigureReply) in.readObject();
    }

    public ReconfigureReply getReply() {
        return reply;
    }
}
