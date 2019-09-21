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

import bftsmart.reconfiguration.views.View;

/**
 *
 * @author eduardo
 */
public class ReconfigurationTest {

    public ReconfigurationTest() {
    }

    public void run(int id){
       /* ServiceProxy proxy = new ServiceProxy(id);
        
        ReconfigureRequest request = new ReconfigureRequest(id);
        request.setProperty("f","1");
        
        System.out.println("Going to send a reconf!!!");
        
        byte[] reply = proxy.invoke(TOMUtil.getBytes(request), ReconfigurationManager.TOM_RECONFIG_REQUEST, false);
        
        ReconfigureReply r = (ReconfigureReply)TOMUtil.getObject(reply);*/
        
        Reconfiguration rec = new Reconfiguration(id);
        
        //rec.setReconfiguration(ReconfigurationManager.CHANGE_F,"1");
        rec.setF(2);
        
        ReconfigureReply r = rec.execute();
        
        
        
        View v = r.getView();
        
        System.out.println("New view f: "+v.getF());
        
        rec.close();
   }
    
    
    
    public static void main(String[] args){
        new ReconfigurationTest().run(Integer.parseInt(args[0]));
    }
    
    
    
    
}
