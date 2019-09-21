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

import java.io.Externalizable;
import java.io.IOException;
import java.io.ObjectInput;
import java.io.ObjectOutput;

import bftsmart.reconfiguration.views.View;

/**
 *
 * @author eduardo
 */
public class ReconfigureReply implements Externalizable {

    private View newView;
    private String[] joinSet;
    
    
    
    //The ideal thing now would be identifying the consensus with a
    // tuple (view number, consensus number in increasing order)
    //Ex: (0,0),(0,1)... update to next view... (1,0),(1,1),....
    private int lastExecConsId = -1;
    
    private int execLeader = -1;
    
    public ReconfigureReply() {
    }
    
    public ReconfigureReply(View newView, String[] joinSet, int lastExectConsensus, int leader) {
      this.newView = newView;
      this.lastExecConsId = lastExectConsensus;
      this.execLeader = leader;
      
      if(joinSet == null){
          this.joinSet = new String[0];
      }else{
          this.joinSet = joinSet;
      }
    }

    public View getView() {
        return newView;
    }    
    
    public String[] getJoinSet() {
        return joinSet;
        
    }

    public int getExecLeader() {
        return execLeader;
    }
    
    

    public int getLastExecConsId() {
        return lastExecConsId;
    }
    
    
    
    @Override
    public void writeExternal(ObjectOutput out) throws IOException {
       out.writeObject(newView);
       out.writeInt(this.lastExecConsId);
       out.writeInt(this.execLeader);
       
       out.writeInt(joinSet.length);
       
       for(int i=0; i < joinSet.length;i++){
           out.writeUTF(joinSet[i]);
       }       
    }

    @Override
    public void readExternal(ObjectInput in) throws IOException, ClassNotFoundException {
        newView = (View) in.readObject();
        this.lastExecConsId = in.readInt();
        this.execLeader = in.readInt();
        joinSet = new String[in.readInt()];
        for(int i = 0; i < joinSet.length;i++){
            joinSet[i] = in.readUTF();
        }
    }
    
    
}
