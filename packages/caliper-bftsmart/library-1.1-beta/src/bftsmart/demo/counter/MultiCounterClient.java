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
package bftsmart.demo.counter;

/**
 *
 * @author alysson
 */
public class MultiCounterClient {

    /**
     * @param args the command line arguments
     */
    public static void main(String[] args) throws Exception {
        int numOfClients = (args.length > 0)?Integer.parseInt(args[0]):2;
        int initialProcess = (args.length > 1)?Integer.parseInt(args[1]):4;

        Process[] p = new Process[numOfClients];
        
        for (int i = 0; i < numOfClients; i++) {
            int id = initialProcess+i;
            int inc = 1;

            System.out.println("Starting client "+id);

            //UNIX (not tested yet!)
            p[i] = Runtime.getRuntime().exec("/bin/sh -e java -cp dist/SMART-SVN.jar "
                    + "bftsmart.demo.counter.CounterClient " + id + " " + inc + " 5000"
                    + " > output-" + id + "-" + inc + ".txt 2>&1");

            //Windows
            //p[i] = Runtime.getRuntime().exec("cmd /c java -cp dist/SMaRt.jar "
            //        + "bftsmart.demo.counter.CounterClient " + id + " " + inc
            //        + " > output-" + id + "-" + inc + ".txt 2>&1");
        }

        for (int i = 0; i < numOfClients; i++) {
            int r = p[i].waitFor();
            System.out.println("Client "+(i+initialProcess)+" finished with "+r);
        }

    }
}
