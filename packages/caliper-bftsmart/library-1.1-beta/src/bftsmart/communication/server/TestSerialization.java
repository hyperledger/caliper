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
package bftsmart.communication.server;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;

import bftsmart.tom.core.messages.TOMMessage;



public class TestSerialization {

    /**
     * @param args the command line arguments
     */
    public static void main(String[] args) throws Exception {
        // TODO code application logic here
        TOMMessage tm = new TOMMessage(0,0,0,new String("abc").getBytes(),0);

        ByteArrayOutputStream baos = new ByteArrayOutputStream(4);
        DataOutputStream oos = new DataOutputStream(baos);

        tm.wExternal(oos);
        oos.flush();
        //oos.writeObject(tm);


        byte[] message = baos.toByteArray();
        System.out.println(message.length);

        ByteArrayInputStream bais = new ByteArrayInputStream(message);
        DataInputStream ois = new DataInputStream(bais);

        //TOMMessage tm2 = (TOMMessage) ois.readObject();
        TOMMessage tm2 = new TOMMessage();
        tm2.rExternal(ois);

//        System.out.println(new String(tm2.getContent()));
    }

}
