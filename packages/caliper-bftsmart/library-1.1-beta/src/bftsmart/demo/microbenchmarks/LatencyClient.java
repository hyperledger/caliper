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
package bftsmart.demo.microbenchmarks;

import java.io.IOException;

import bftsmart.tom.ServiceProxy;
import bftsmart.tom.util.Storage;

/**
 * Example client that updates a BFT replicated service (a counter).
 *
 */
public class LatencyClient {

    @SuppressWarnings("static-access")
    public static void main(String[] args) throws IOException {
        if (args.length < 5) {
            System.out.println("Usage: java ...LatencyClient <process id> <number of operations> <request size> <interval> <read only?>");
            System.exit(-1);
        }

        ServiceProxy counterProxy = new ServiceProxy(Integer.parseInt(args[0]));
        //counterProxy.setInvokeTimeout(1);

        try {

            int numberOfOps = Integer.parseInt(args[1]);
            int requestSize = Integer.parseInt(args[2]);
            int interval = Integer.parseInt(args[3]);
            boolean readOnly = Boolean.parseBoolean(args[4]);

            byte[] request = new byte[requestSize], reply;

            System.out.println("Warm up...");

            for (int i = 0; i < numberOfOps/2; i++) {
            	if(readOnly)
            		reply = counterProxy.invokeUnordered(request);
            	else
            		reply = counterProxy.invokeOrdered(request);
            }

            Storage st = new Storage(numberOfOps/2);

            System.out.println("Executing experiment for "+numberOfOps/2+" ops");

            for (int i = 0; i < numberOfOps/2; i++) {
                long last_send_instant = System.nanoTime();
            	if(readOnly)
            		reply = counterProxy.invokeUnordered(request);
            	else
            		reply = counterProxy.invokeOrdered(request);
                st.store(System.nanoTime() - last_send_instant);

                    if (interval > 0) {
                        //sleeps interval ms before sending next request
                        Thread.sleep(interval);
                    }
            }

            System.out.println("Average time for " + numberOfOps / 2 + " executions (-10%) = " + st.getAverage(true) / 1000 + " us ");
            System.out.println("Standard desviation for " + numberOfOps / 2 + " executions (-10%) = " + st.getDP(true) / 1000 + " us ");
            System.out.println("Average time for " + numberOfOps / 2 + " executions (all samples) = " + st.getAverage(false) / 1000 + " us ");
            System.out.println("Standard desviation for " + numberOfOps / 2 + " executions (all samples) = " + st.getDP(false) / 1000 + " us ");
            System.out.println("Maximum time for " + numberOfOps / 2 + " executions (all samples) = " + st.getMax(false) / 1000 + " us ");

        } catch(Exception e){
        } finally {
            counterProxy.close();
        }
        
        System.exit(0);
    }
}
