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
import java.util.Arrays;

import bftsmart.communication.client.ReplyListener;
import bftsmart.tom.AsynchServiceProxy;
import bftsmart.tom.RequestContext;
import bftsmart.tom.core.messages.TOMMessage;
import bftsmart.tom.core.messages.TOMMessageType;

/**
 * 
 * @author anogueira
 *
 */
public class AsyncLatencyClient {

	public static void main(String[] args) throws IOException {
		if (args.length < 5) {
			System.out.println("Usage: java ...AsyncLatencyClient <process id> <number of operations> <request size> <interval in micro seconds> <read only?>");
			System.exit(-1);
		}

		final AsynchServiceProxy serviceProxy = new AsynchServiceProxy(Integer.parseInt(args[0]));

		try {

			int numberOfOps = Integer.parseInt(args[1]);
			int requestSize = Integer.parseInt(args[2]);
			int interval = Integer.parseInt(args[3]);
			boolean readOnly = Boolean.parseBoolean(args[4]);
			byte[] request = new byte[requestSize];
			TOMMessageType reqType = (readOnly) ? TOMMessageType.UNORDERED_REQUEST   : TOMMessageType.ORDERED_REQUEST ;

			System.out.println("Executing experiment for "+numberOfOps+" ops");

			for (int i = 0; i < numberOfOps; i++) {
				serviceProxy.invokeAsynchRequest(request, new ReplyListener() {
					
					private int replies = 0;
					
					@Override
					public void replyReceived(RequestContext context, TOMMessage reply) {
						StringBuilder builder = new StringBuilder();
						builder.append("[RequestContext] id: "+context.getReqId()+" type: "+context.getRequestType());
						builder.append("[TOMMessage reply] sender id: "+reply.getSender()+ " Hash content: "+Arrays.toString(reply.getContent()));
						System.out.println(builder.toString());
						
						replies++;
						
						if(replies>= context.getTargets().length){
							System.out.println("[RequestContext] clean request context id: "+context.getReqId());
							serviceProxy.cleanAsynchRequest(context.getReqId());
							}
					}
				}, reqType);

				if (interval > 0) {
					Thread.sleep(0,interval);
				}
			}
			
			Thread.sleep(100);//wait 100ms to receive the last replies
			
		} catch(Exception e){
		} finally {
			serviceProxy.close();
		}

		System.out.println("Finished");
		System.exit(0);
	}
}
