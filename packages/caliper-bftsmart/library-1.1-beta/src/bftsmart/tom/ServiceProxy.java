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
package bftsmart.tom;

import java.util.Arrays;
import java.util.Comparator;
import java.util.Random;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

import bftsmart.reconfiguration.ReconfigureReply;
import bftsmart.reconfiguration.views.View;
import bftsmart.tom.core.messages.TOMMessage;
import bftsmart.tom.core.messages.TOMMessageType;
import bftsmart.tom.util.Extractor;
import bftsmart.tom.util.Logger;
import bftsmart.tom.util.TOMUtil;

/**
 * This class implements a TOMSender and represents a proxy to be used on the
 * client side of the replicated system.
 * It sends a request to the replicas, receives the reply, and delivers it to
 * the application.
 */
public class ServiceProxy extends TOMSender {

	// Locks for send requests and receive replies
	protected ReentrantLock canReceiveLock = new ReentrantLock();
	protected ReentrantLock canSendLock = new ReentrantLock();
	private Semaphore sm = new Semaphore(0);
	private int reqId = -1; // request id
	private int operationId = -1; // request id
	private TOMMessageType requestType;
	private int replyQuorum = 0; // size of the reply quorum
	private TOMMessage replies[] = null; // Replies from replicas are stored here
	private int receivedReplies = 0; // Number of received replies
	private TOMMessage response = null; // Reply delivered to the application
	private int invokeTimeout = 40;
	private Comparator<byte[]> comparator;
	private Extractor extractor;
	private Random rand = new Random(System.currentTimeMillis());
	private int replyServer;
	private HashResponseController hashResponseController;
	private int invokeUnorderedHashedTimeout = 10;

	/**
	 * Constructor
	 *
	 * @see bellow
	 */
	public ServiceProxy(int processId) {
		this(processId, null, null, null);
	}

	/**
	 * Constructor
	 *
	 * @see bellow
	 */
	public ServiceProxy(int processId, String configHome) {
		this(processId, configHome, null, null);
	}

	/**
	 * Constructor
	 *
	 * @param processId Process id for this client (should be different from replicas)
	 * @param configHome Configuration directory for BFT-SMART
	 * @param replyComparator used for comparing replies from different servers
	 *                        to extract one returned by f+1
	 * @param replyExtractor used for extracting the response from the matching
	 *                       quorum of replies
	 */
	public ServiceProxy(int processId, String configHome,
			Comparator<byte[]> replyComparator, Extractor replyExtractor) {
		if (configHome == null) {
			init(processId);
		} else {
			init(processId, configHome);
		}

		replies = new TOMMessage[getViewManager().getCurrentViewN()];

		comparator = (replyComparator != null) ? replyComparator : new Comparator<byte[]>() {
			@Override
			public int compare(byte[] o1, byte[] o2) {
				return Arrays.equals(o1, o2) ? 0 : -1;
			}
		};

		extractor = (replyExtractor != null) ? replyExtractor : new Extractor() {

			@Override
			public TOMMessage extractResponse(TOMMessage[] replies, int sameContent, int lastReceived) {
				return replies[lastReceived];
			}
		};
	}

	/**
	 * Get the amount of time (in seconds) that this proxy will wait for
	 * servers replies before returning null.
	 *
	 * @return the invokeTimeout
	 */
	public int getInvokeTimeout() {
		return invokeTimeout;
	}

	public int getInvokeUnorderedHashedTimeout() {
		return invokeUnorderedHashedTimeout;
	}

	/**
	 * Set the amount of time (in seconds) that this proxy will wait for
	 * servers replies before returning null.
	 *
	 * @param invokeTimeout the invokeTimeout to set
	 */
	public void setInvokeTimeout(int invokeTimeout) {
		this.invokeTimeout = invokeTimeout;
	}

	public void setInvokeUnorderedHashedTimeout(int timeout) {
		this.invokeUnorderedHashedTimeout = timeout;
	}

	public byte[] invokeOrdered(byte[] request) {
		return invoke(request, TOMMessageType.ORDERED_REQUEST);
	}

	public byte[] invokeUnordered(byte[] request) {
		return invoke(request, TOMMessageType.UNORDERED_REQUEST);
	}

	public byte[] invokeUnorderedHashed(byte[] request) {
		return invoke(request, TOMMessageType.UNORDERED_HASHED_REQUEST);
	}

	/**
	 * This method sends a request to the replicas, and returns the related reply.
	 * If the servers take more than invokeTimeout seconds the method returns null.
	 * This method is thread-safe.
	 *
	 * @param request Request to be sent
	 * @param reqType TOM_NORMAL_REQUESTS for service requests, and other for
	 *        reconfig requests.
	 * @return The reply from the replicas related to request
	 */
	public byte[] invoke(byte[] request, TOMMessageType reqType) {
		canSendLock.lock();

		// Clean all statefull data to prepare for receiving next replies
		Arrays.fill(replies, null);
		receivedReplies = 0;
		response = null;
		replyQuorum = getReplyQuorum();

		// Send the request to the replicas, and get its ID
		reqId = generateRequestId(reqType);
		operationId = generateOperationId();
		requestType = reqType;

		replyServer = -1;
		hashResponseController = null;

		if(requestType == TOMMessageType.UNORDERED_HASHED_REQUEST){

			replyServer = getRandomlyServerId();
			Logger.println("["+this.getClass().getName()+"] replyServerId("+replyServer+") "
					+ "pos("+getViewManager().getCurrentViewPos(replyServer)+")");

			hashResponseController = new HashResponseController(getViewManager().getCurrentViewPos(replyServer),
					getViewManager().getCurrentViewProcesses().length);

			TOMMessage sm = new TOMMessage(getProcessId(),getSession(), reqId, operationId, request,
					getViewManager().getCurrentViewId(), requestType);
			sm.setReplyServer(replyServer);

			TOMulticast(sm);
		}else{
			TOMulticast(request, reqId, operationId, reqType);
		}

		Logger.println("Sending request (" + reqType + ") with reqId=" + reqId);
		Logger.println("Expected number of matching replies: " + replyQuorum);

		// This instruction blocks the thread, until a response is obtained.
		// The thread will be unblocked when the method replyReceived is invoked
		// by the client side communication system
		try {
			if(reqType == TOMMessageType.UNORDERED_HASHED_REQUEST){
				if (!this.sm.tryAcquire(invokeUnorderedHashedTimeout, TimeUnit.SECONDS)) {
					System.out.println("######## UNORDERED HASHED REQUEST TIMOUT ########");
					canSendLock.unlock();
					return invoke(request,TOMMessageType.ORDERED_REQUEST);
				}
			}else{ 
				if (!this.sm.tryAcquire(invokeTimeout, TimeUnit.SECONDS)) {
					Logger.println("###################TIMEOUT#######################");
					Logger.println("Reply timeout for reqId=" + reqId);
					System.out.print(getProcessId() + " // " + reqId + " // TIMEOUT // ");
					System.out.println("Replies received: " + receivedReplies);
					canSendLock.unlock();

					return null;
				}
			}
		} catch (InterruptedException ex) {
			ex.printStackTrace();
		}

		Logger.println("Response extracted = " + response);

		byte[] ret = null;

		if (response == null) {
			//the response can be null if n-f replies are received but there isn't
			//a replyQuorum of matching replies
			Logger.println("Received n-f replies and no response could be extracted.");

			canSendLock.unlock();
			if (reqType == TOMMessageType.UNORDERED_REQUEST || reqType == TOMMessageType.UNORDERED_HASHED_REQUEST) {
				//invoke the operation again, whitout the read-only flag
				Logger.println("###################RETRY#######################");
				return invokeOrdered(request);
			} else {
				throw new RuntimeException("Received n-f replies without f+1 of them matching.");
			}
		} else {
			//normal operation
			//******* EDUARDO BEGIN **************//
			if (reqType == TOMMessageType.ORDERED_REQUEST) {
				//Reply to a normal request!
				if (response.getViewID() == getViewManager().getCurrentViewId()) {
					ret = response.getContent(); // return the response
				} else {//if(response.getViewID() > getViewManager().getCurrentViewId())
					//updated view received
					reconfigureTo((View) TOMUtil.getObject(response.getContent()));

					canSendLock.unlock();
					return invoke(request, reqType);
				}
			} else if (reqType == TOMMessageType.UNORDERED_REQUEST || reqType == TOMMessageType.UNORDERED_HASHED_REQUEST){
				if (response.getViewID() == getViewManager().getCurrentViewId()) {
					ret = response.getContent(); // return the response
				}else{
					canSendLock.unlock();
					return invoke(request,TOMMessageType.ORDERED_REQUEST);
				}
			} else {
				if (response.getViewID() > getViewManager().getCurrentViewId()) {
					//Reply to a reconfigure request!
					Logger.println("Reconfiguration request' reply received!");
					Object r = TOMUtil.getObject(response.getContent());
					if (r instanceof View) { //did not executed the request because it is using an outdated view
						reconfigureTo((View) r);

						canSendLock.unlock();
						return invoke(request, reqType);
					}  else if (r instanceof ReconfigureReply) { //reconfiguration executed!
						reconfigureTo(((ReconfigureReply) r).getView());
						ret = response.getContent();
					} else{
						Logger.println("Unknown response type");
					}
				} else {
					Logger.println("Unexpected execution flow");
				}
			}
		}
		//******* EDUARDO END **************//

		canSendLock.unlock();
		return ret;
	}

	//******* EDUARDO BEGIN **************//
	private void reconfigureTo(View v) {
		Logger.println("Installing a most up-to-date view with id=" + v.getId());
		getViewManager().reconfigureTo(v);
		getViewManager().getViewStore().storeView(v);
		replies = new TOMMessage[getViewManager().getCurrentViewN()];
		getCommunicationSystem().updateConnections();
	}
	//******* EDUARDO END **************//

	/**
	 * This is the method invoked by the client side communication system.
	 *
	 * @param reply The reply delivered by the client side communication system
	 */
	@Override
	public void replyReceived(TOMMessage reply) {
		try {
			canReceiveLock.lock();
			if (reqId == -1) {//no message being expected
				Logger.println("throwing out request: sender=" + reply.getSender() + " reqId=" + reply.getSequence());
				canReceiveLock.unlock();
				return;
			}

			int pos = getViewManager().getCurrentViewPos(reply.getSender());

			if (pos < 0) { //ignore messages that don't come from replicas
				canReceiveLock.unlock();
				return;
			}

			int sameContent = 1;
			if (reply.getSequence() == reqId && reply.getReqType() == requestType) {

				Logger.println("Receiving reply from " + reply.getSender()
						+ " with reqId:" + reply.getSequence() + ". Putting on pos=" + pos);

				if(requestType == TOMMessageType.UNORDERED_HASHED_REQUEST)
				{
					response = hashResponseController.getResponse(pos,reply);
					if(response !=null){
						reqId = -1;
						this.sm.release(); // resumes the thread that is executing the "invoke" method
						canReceiveLock.unlock();
						return;
					}

				}else{
					if (replies[pos] == null) {
						receivedReplies++;
					}
					replies[pos] = reply;

					// Compare the reply just received, to the others
					
					for (int i = 0; i < replies.length; i++) {

						if ((i != pos || getViewManager().getCurrentViewN() == 1) && replies[i] != null
								&& (comparator.compare(replies[i].getContent(), reply.getContent()) == 0)) {
							sameContent++;
							if (sameContent >= replyQuorum) {
								response = extractor.extractResponse(replies, sameContent, pos);
								reqId = -1;
								this.sm.release(); // resumes the thread that is executing the "invoke" method
								canReceiveLock.unlock();
								return;
							}
						}
					}
				}
				
				if (response == null) {
					if (requestType.equals(TOMMessageType.ORDERED_REQUEST)) {
						if (receivedReplies == getViewManager().getCurrentViewN()) {
							reqId = -1;
							this.sm.release(); // resumes the thread that is executing the "invoke" method
						}
					}else if (requestType.equals(TOMMessageType.UNORDERED_HASHED_REQUEST)) {
						if (hashResponseController.getNumberReplies() == getViewManager().getCurrentViewN()) {
							reqId = -1;
							this.sm.release(); // resumes the thread that is executing the "invoke" method
						}
					} else {  // UNORDERED
						if (receivedReplies != sameContent) {
							reqId = -1;
							this.sm.release(); // resumes the thread that is executing the "invoke" method
						}
					}
				}
			}

			// Critical section ends here. The semaphore can be released
			canReceiveLock.unlock();
		} catch (Exception ex) {
			System.out.println("Problem at ServiceProxy.ReplyReceived()");
			ex.printStackTrace();
			canReceiveLock.unlock();
		}
	}

	private int getReplyQuorum() {
		if (getViewManager().getStaticConf().isBFT()) {
			return (int) Math.ceil((getViewManager().getCurrentViewN()
					+ getViewManager().getCurrentViewF()) / 2) + 1;
		} else {
			return (int) Math.ceil((getViewManager().getCurrentViewN()) / 2) + 1;
		}
	}

	private int getRandomlyServerId(){
		int numServers = super.getViewManager().getCurrentViewProcesses().length;
		int pos = rand.nextInt(numServers);

		return super.getViewManager().getCurrentViewProcesses()[pos];
	}

	private class HashResponseController{
		private TOMMessage reply;
		private byte [][] hashReplies;
		private int replyServerPos;
		private int countHashReplies;

		public HashResponseController(int replyServerPos, int length) {
			this.replyServerPos = replyServerPos;
			this.hashReplies = new byte[length][];
			this.reply = null;
			this.countHashReplies = 0;
		}


		public TOMMessage getResponse(int pos, TOMMessage tomMessage){

			if(hashReplies[pos]==null){
				countHashReplies++;
			}

			if(replyServerPos == pos){
				reply = tomMessage;
				hashReplies[pos] = TOMUtil.computeHash(tomMessage.getContent());
			}else{
				hashReplies[pos] = tomMessage.getContent();
			}
			Logger.println("["+this.getClass().getName()+"] hashReplies["+pos+"]="+Arrays.toString(hashReplies[pos]));

			if(hashReplies[replyServerPos]!=null){
				int sameContent = 1;
				for (int i = 0; i < replies.length; i++) {
					if ((i != replyServerPos || getViewManager().getCurrentViewN() == 1) && hashReplies[i] != null
							&& (Arrays.equals(hashReplies[i], hashReplies[replyServerPos]))) {
						sameContent++;
						if (sameContent >= replyQuorum) {
							return reply;
						}
					}
				}	
			}
			return null;
		}


		public int getNumberReplies(){
			return countHashReplies;
		}
	}
}
