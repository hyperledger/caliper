package bftsmart.tom;

import java.util.Hashtable;

import bftsmart.communication.client.ReplyListener;
import bftsmart.tom.core.messages.TOMMessage;
import bftsmart.tom.core.messages.TOMMessageType;
import bftsmart.tom.util.Extractor;
import java.util.Comparator;

/**
 * This class is an extension of 'ServiceProxy' that can waits for replies
 * asynchronously.
 * 
 * @author Andre Nogueira
 *
 */
public class AsynchServiceProxy extends ServiceProxy{

	/**
	 * 
	 */
	private Hashtable<Integer, RequestContext> requestsContext;


	/**
	 * 
	 * @param processId Replica id
	 */
	public AsynchServiceProxy(int processId) {
		this(processId, null);
                requestsContext =  new Hashtable<Integer, RequestContext>();
	}

	/**
	 * 
	 * @param processId Replica id
	 * @param configHome Configuration folder
	 */
	public AsynchServiceProxy(int processId, String configHome) {
		super(processId,configHome);
		requestsContext =  new Hashtable<Integer, RequestContext>();
	}

        public AsynchServiceProxy(int processId, String configHome,
			Comparator<byte[]> replyComparator, Extractor replyExtractor) {
            super(processId, configHome, replyComparator, replyExtractor);
            requestsContext =  new Hashtable<Integer, RequestContext>();
        }

	/**
	 * 
	 * @param request
	 * @param replyListener
	 * @param reqType Request type
	 * @return 
	 */
    public int invokeAsynchRequest(byte[] request, ReplyListener replyListener, TOMMessageType reqType) {
		return invokeAsynchRequest(request, super.getViewManager().getCurrentViewProcesses(), replyListener, reqType);
    }
    
    /**
     *   
     * @param request
     * @param targets
     * @param replyListener
     * @param reqType Request type
     * @return
     */
    public int invokeAsynchRequest(byte[] request, int[] targets, ReplyListener replyListener, TOMMessageType reqType) {
		return invokeAsynch(request, targets, replyListener, reqType);
    }
    
    
    /**
     * 
     * @param requestId Request 
     */
	public void cleanAsynchRequest(int requestId){
		requestsContext.remove(requestId);
	}

	
	/**
	 * 
	 */
    @Override
    public void replyReceived(TOMMessage reply) {
		try {
			canReceiveLock.lock();

			RequestContext requestContext = requestsContext.get(reply.getSequence());

			if(requestContext == null){ // it is not a asynchronous request
				super.replyReceived(reply);
				return;
			}
			
			if ( contains(requestContext.getTargets(), reply.getSender()) && 
					(reply.getSequence() == requestContext.getReqId()) &&
					(reply.getReqType().compareTo(requestContext.getRequestType())) == 0 ) {
				
				ReplyListener replyListener = requestContext.getReplyListener();

				if (replyListener != null) {
					requestContext.getReplyListener().replyReceived(requestContext, reply);
				}
			}
		} catch (Exception ex) {
			ex.printStackTrace();
		} finally{
			canReceiveLock.unlock();
		}
	}


	
    /**
     * 
     * @param request
     * @param targets
     * @param replyListener
     * @param reqType
     * @return
     */
	private int invokeAsynch(byte[] request,int[] targets, ReplyListener replyListener, TOMMessageType reqType) {
		RequestContext requestContext = null;
		
		canSendLock.lock();

		requestContext = new RequestContext(generateRequestId(reqType), generateOperationId(),
				reqType, targets, System.currentTimeMillis(), replyListener);

		try {
			sendMessageToTargets(request, requestContext.getReqId(), requestContext.getOperationId(), targets, reqType);

			requestsContext.put(requestContext.getReqId(), requestContext);
			
		} finally {
			canSendLock.unlock();
		}

		return requestContext.getReqId();
	}

	
	/**
	 * 
	 * @param targets
	 * @param senderId
	 * @return
	 */
	private boolean contains(int [] targets, int senderId){
		for(int i=0;i<targets.length;i++)
			if(targets[i] == senderId)
				return true;
		return false;
	}

	
}
