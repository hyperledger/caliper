package bftsmart.tom;

import bftsmart.communication.client.ReplyListener;
import bftsmart.tom.core.messages.TOMMessageType;

/**
 * This class contains information related to a client request.
 */
public final class RequestContext{

	private final int reqId;
	private final int operationId;
	private final TOMMessageType requestType;
	private final int [] targets;
	private final long sendingTime;
	private final ReplyListener replyListener;


	public RequestContext(int reqId, int operationId, TOMMessageType requestType, int [] targets, 
			long sendingTime, ReplyListener replyListener) {
		this.reqId = reqId;
		this.operationId = operationId;
		this.requestType = requestType;
		this.targets = targets;
		this.sendingTime = sendingTime;
		this.replyListener = replyListener;
	}
	
	public final int getReqId() {
		return reqId;
	}
	public  final int getOperationId() {
		return operationId;
	}
	public final TOMMessageType getRequestType() {
		return requestType;
	}
	public  final long getSendingTime() {
		return sendingTime;
	}
	public ReplyListener getReplyListener(){
		return replyListener;
	}
	public int [] getTargets() {
		return targets;
	}
}

