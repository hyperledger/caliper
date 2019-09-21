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
package bftsmart.reconfiguration.views;

import java.net.InetSocketAddress;

public class TestViewSerialization {

    /**
     * @param args the command line arguments
     */
    public static void main(String[] args) throws Exception {
        int[] ids = {1,2,3,4};
        InetSocketAddress[] in = new InetSocketAddress[4];
        in[0] = new InetSocketAddress("127.0.0.1",1234);
        in[1] = new InetSocketAddress("127.0.0.1",1234);
        in[2] = new InetSocketAddress("127.0.0.1",1234);
        in[3] = new InetSocketAddress("127.0.0.1",1234);
        View v = new View(10, ids,1,in);
        ViewStorage st = new DefaultViewStorage();
        st.storeView(v);
        
        View r = st.readView();
        System.out.println(r);
    }

}
