/**
 * Copyright (c) 2007-2013 Alysson Bessani, Eduardo Alchieri, Paulo Sousa, and
 * the authors indicated in the @author tags
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */
package bftsmart.tom;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;
import java.util.logging.Level;
import java.util.logging.Logger;

import bftsmart.communication.ServerCommunicationSystem;
import bftsmart.tom.core.ExecutionManager;
import bftsmart.consensus.messages.MessageFactory;
import bftsmart.consensus.roles.Acceptor;
import bftsmart.consensus.roles.Proposer;
import bftsmart.reconfiguration.Reconfiguration;
import bftsmart.reconfiguration.ReconfigureReply;
import bftsmart.reconfiguration.ServerViewController;
import bftsmart.reconfiguration.VMMessage;
import bftsmart.tom.core.ReplyManager;
import bftsmart.tom.core.TOMLayer;
import bftsmart.tom.core.messages.TOMMessage;
import bftsmart.tom.core.messages.TOMMessageType;
import bftsmart.tom.leaderchange.CertifiedDecision;
import bftsmart.tom.server.BatchExecutable;
import bftsmart.tom.server.Executable;
import bftsmart.tom.server.FIFOExecutable;
import bftsmart.tom.server.Recoverable;
import bftsmart.tom.server.Replier;
import bftsmart.tom.server.RequestVerifier;
import bftsmart.tom.server.SingleExecutable;

import bftsmart.tom.server.defaultservices.DefaultReplier;
import bftsmart.tom.util.ShutdownHookThread;
import bftsmart.tom.util.TOMUtil;

/**
 * This class receives messages from DeliveryThread and manages the execution
 * from the application and reply to the clients. For applications where the
 * ordered messages are executed one by one, ServiceReplica receives the batch
 * decided in a consensus, deliver one by one and reply with the batch of
 * replies. In cases where the application executes the messages in batches, the
 * batch of messages is delivered to the application and ServiceReplica doesn't
 * need to organize the replies in batches.
 */
public class ServiceReplica {

    class MessageContextPair {

        TOMMessage message;
        MessageContext msgCtx;

        MessageContextPair(TOMMessage message, MessageContext msgCtx) {
            this.message = message;
            this.msgCtx = msgCtx;
        }
    }
    // replica ID
    private int id;
    // Server side comunication system
    private ServerCommunicationSystem cs = null;
    private ReplyManager repMan = null;
    private ServerViewController SVController;
    private boolean isToJoin = false;
    private ReentrantLock waitTTPJoinMsgLock = new ReentrantLock();
    private Condition canProceed = waitTTPJoinMsgLock.newCondition();
    private Executable executor = null;
    private Recoverable recoverer = null;
    private TOMLayer tomLayer = null;
    private boolean tomStackCreated = false;
    private ReplicaContext replicaCtx = null;
    private Replier replier = null;
    private RequestVerifier verifier = null;

    /**
     * Constructor
     *
     * @param id Replica ID
     * @param executor Executor
     * @param recoverer Recoverer
     */
    public ServiceReplica(int id, Executable executor, Recoverable recoverer) {
        this(id, "", executor, recoverer, null);
    }

    /**
     * Constructor
     *
     * @param id Replica ID
     * @param executor Executor
     * @param recoverer Recoverer
     * @param verifier Requests verifier
     */
    public ServiceReplica(int id, Executable executor, Recoverable recoverer, RequestVerifier verifier) {
        this(id, "", executor, recoverer, verifier);
    }

    /**
     * Constructor
     *
     * @param id Process ID
     * @param configHome Configuration directory for JBP
     * @param executor Executor
     * @param recoverer Recoverer
     * @param verifier Requests verifier
     */
    public ServiceReplica(int id, String configHome, Executable executor, Recoverable recoverer, RequestVerifier verifier) {
        this(id, configHome, false, executor, recoverer, verifier);
    }

    /**
     * Constructor
     *
     * @param id Replica ID
     * @param isToJoin: if true, the replica tries to join the system, otherwise it waits for TTP message informing its join
     * @param executor Executor
     * @param recoverer Recoverer
     */
    public ServiceReplica(int id, boolean isToJoin, Executable executor, Recoverable recoverer) {
        this(id, "", isToJoin, executor, recoverer, null);
    }

    public ServiceReplica(int id, String configHome, boolean isToJoin, Executable executor, Recoverable recoverer, RequestVerifier verifier) {
        this.isToJoin = isToJoin;
        this.id = id;
        this.SVController = new ServerViewController(id, configHome);
        this.executor = executor;
        this.recoverer = recoverer;
        this.replier = new DefaultReplier();
        this.init();
        this.recoverer.setReplicaContext(replicaCtx);
        this.replier.setReplicaContext(replicaCtx);
        this.verifier = verifier;
    }

    public void setReplyController(Replier replier) {
        this.replier = replier;
    }

    // this method initializes the object
    private void init() {
        try {
            cs = new ServerCommunicationSystem(this.SVController, this);
        } catch (Exception ex) {
            Logger.getLogger(ServiceReplica.class.getName()).log(Level.SEVERE, null, ex);
            throw new RuntimeException("Unable to build a communication system.");
        }

        if (this.SVController.isInCurrentView()) {
            System.out.println("In current view: " + this.SVController.getCurrentView());
            initTOMLayer(); // initiaze the TOM layer
        } else {
            System.out.println("Not in current view: " + this.SVController.getCurrentView());
            if (this.isToJoin) {
                System.out.println("Sending join: " + this.SVController.getCurrentView());
                
                // Not in initial view. Will perform a join;
                int port = this.SVController.getStaticConf().getServerToServerPort(id) - 1;
                String ip = this.SVController.getStaticConf().getServerToServerRemoteAddress(id).getAddress().getHostAddress();
                ReconfigureReply r = null;
                Reconfiguration rec = new Reconfiguration(id);
                do {
                    rec.addServer(id, ip, port);
                    r = rec.execute();
                } while (!r.getView().isMember(id));
                rec.close();
                this.SVController.processJoinResult(r);

                // initiaze the TOM layer
                initTOMLayer();

                this.cs.updateServersConnections();
                this.cs.joinViewReceived();
            } else {
                
                //Not in the initial view, just waiting for the view where the join has been executed
                System.out.println("Waiting for the TTP: " + this.SVController.getCurrentView());
                waitTTPJoinMsgLock.lock();
                try {
                    canProceed.awaitUninterruptibly();
                } finally {
                    waitTTPJoinMsgLock.unlock();
                }
            }

        }
        initReplica();
    }

    public void joinMsgReceived(VMMessage msg) {
        ReconfigureReply r = msg.getReply();

        if (r.getView().isMember(id)) {
            this.SVController.processJoinResult(r);

            initTOMLayer(); // initiaze the TOM layer
            cs.updateServersConnections();
            this.cs.joinViewReceived();
            waitTTPJoinMsgLock.lock();
            canProceed.signalAll();
            waitTTPJoinMsgLock.unlock();
        }
    }

    private void initReplica() {
        cs.start();
        repMan = new ReplyManager(SVController.getStaticConf().getNumRepliers(), cs);
    }

    /**
     * This message delivers a readonly message, i.e., a message that was not
     * ordered to the replica and gather the reply to forward to the client
     *
     * @param message the request received from the delivery thread
     */
    public final void receiveReadonlyMessage(TOMMessage message, MessageContext msgCtx) {
        byte[] response = null;

        // This is used to deliver the requests to the application and obtain a reply to deliver
        //to the clients. The raw decision does not need to be delivered to the recoverable since
        // it is not associated with any consensus instance, and therefore there is no need for
        //applications to log it or keep any proof.
        if (executor instanceof FIFOExecutable) {
            response = ((FIFOExecutable) executor).executeUnorderedFIFO(message.getContent(), msgCtx, message.getSender(), message.getOperationId());
        } else {
            response = executor.executeUnordered(message.getContent(), msgCtx);
        }

        if (message.getReqType() == TOMMessageType.UNORDERED_HASHED_REQUEST
                && message.getReplyServer() != this.id) {
            response = TOMUtil.computeHash(response);
        }

        // Generate the messages to send back to the clients
        message.reply = new TOMMessage(id, message.getSession(), message.getSequence(),
                response, SVController.getCurrentViewId(), message.getReqType());

        if (SVController.getStaticConf().getNumRepliers() > 0) {
            repMan.send(message);
        } else {
            cs.send(new int[]{message.getSender()}, message.reply);
        }
    }

    public void receiveMessages(int consId[], int regencies[], int leaders[], CertifiedDecision[] cDecs, TOMMessage[][] requests) {
        int numRequests = 0;
        int consensusCount = 0;
        List<TOMMessage> toBatch = new ArrayList<>();
        List<MessageContext> msgCtxts = new ArrayList<>();
        boolean noop = true;

        for (TOMMessage[] requestsFromConsensus : requests) {

            TOMMessage firstRequest = requestsFromConsensus[0];
            int requestCount = 0;
            noop = true;
            for (TOMMessage request : requestsFromConsensus) {

                if (request.getViewID() == SVController.getCurrentViewId()) {

                    if (request.getReqType() == TOMMessageType.ORDERED_REQUEST) {

                        noop = false;

                        numRequests++;
                        MessageContext msgCtx = new MessageContext(request.getSender(), request.getViewID(),
                                request.getReqType(), request.getSession(), request.getSequence(), request.getOperationId(),
                                request.getReplyServer(), request.serializedMessageSignature, firstRequest.timestamp,
                                request.numOfNonces, request.seed, regencies[consensusCount], leaders[consensusCount],
                                consId[consensusCount], cDecs[consensusCount].getConsMessages(), firstRequest, false);
                        
                        if (requestCount + 1 == requestsFromConsensus.length) {

                            msgCtx.setLastInBatch();
                        }
                        request.deliveryTime = System.nanoTime();
                        if (executor instanceof BatchExecutable) {
                            
                            // This is used to deliver the content decided by a consensus instance directly to
                            // a Recoverable object. It is useful to allow the application to create a log and
                            // store the proof associated with decisions (which are needed by replicas
                            // that are asking for a state transfer). 
                            if (this.recoverer != null) this.recoverer.Op(msgCtx.getConsensusId(), request.getContent(), msgCtx);

                            // deliver requests and contexts to the executor later
                            msgCtxts.add(msgCtx);
                            toBatch.add(request);
                        } else if (executor instanceof FIFOExecutable) {
                            
                            // This is used to deliver the content decided by a consensus instance directly to
                            // a Recoverable object. It is useful to allow the application to create a log and
                            // store the proof associated with decisions (which are needed by replicas
                            // that are asking for a state transfer). 
                            if (this.recoverer != null) this.recoverer.Op(msgCtx.getConsensusId(), request.getContent(), msgCtx);
                            
                            // This is used to deliver the requests to the application and obtain a reply to deliver
                            //to the clients. The raw decision is passed to the application in the line above.
                            byte[] response = ((FIFOExecutable) executor).executeOrderedFIFO(request.getContent(), msgCtx, request.getSender(), request.getOperationId());

                            // Generate the messages to send back to the clients
                            request.reply = new TOMMessage(id, request.getSession(),
                                    request.getSequence(), response, SVController.getCurrentViewId());
                            bftsmart.tom.util.Logger.println("(ServiceReplica.receiveMessages) sending reply to " + request.getSender());
                            replier.manageReply(request, msgCtx);
                        } else if (executor instanceof SingleExecutable) {

                            // This is used to deliver the content decided by a consensus instance directly to
                            // a Recoverable object. It is useful to allow the application to create a log and
                            // store the proof associated with decisions (which are needed by replicas
                            // that are asking for a state transfer). 
                            if (this.recoverer != null) this.recoverer.Op(msgCtx.getConsensusId(), request.getContent(), msgCtx);

                            // This is used to deliver the requests to the application and obtain a reply to deliver
                            //to the clients. The raw decision is passed to the application in the line above.
                            byte[] response = ((SingleExecutable) executor).executeOrdered(request.getContent(), msgCtx);

                            // Generate the messages to send back to the clients
                            request.reply = new TOMMessage(id, request.getSession(),
                                    request.getSequence(), response, SVController.getCurrentViewId());
                            bftsmart.tom.util.Logger.println("(ServiceReplica.receiveMessages) sending reply to " + request.getSender());
                            replier.manageReply(request, msgCtx);
                        } else {
                            throw new UnsupportedOperationException("Interface not existent");
                        }
                    } else if (request.getReqType() == TOMMessageType.RECONFIG) {
                        SVController.enqueueUpdate(request);
                    } else {
                        throw new RuntimeException("Should never reach here!");
                    }
                } else if (request.getViewID() < SVController.getCurrentViewId()) { // message sender had an old view, resend the message to
                                                                                    // him (but only if it came from consensus an not state transfer)
                    
                    tomLayer.getCommunication().send(new int[]{request.getSender()}, new TOMMessage(SVController.getStaticConf().getProcessId(),
                            request.getSession(), request.getSequence(), TOMUtil.getBytes(SVController.getCurrentView()), SVController.getCurrentViewId()));
                }
                requestCount++;
            }

            // This happens when a consensus finishes but there are no requests to deliver
            // to the application. This can happen if a reconfiguration is issued and is the only
            // operation contained in the batch. The recoverer must be notified about this,
            // hence the invocation of "noop"
            if (noop && this.recoverer != null) {
                System.out.println(" --- A consensus instance finished, but there were no commands to deliver to the application.");
                System.out.println(" --- Notifying recoverable about a blank consensus.");

                MessageContext msgCtx = new MessageContext(-1, -1, null, -1, -1, -1, -1, null, // Since it is a noop, there is no need to pass info about the client...
                        -1, 0, 0, regencies[consensusCount], leaders[consensusCount], consId[consensusCount], cDecs[consensusCount].getConsMessages(), //... but there is still need to pass info about the consensus
                        null, true); // there is no command that is the first of the batch, since it is a noop
                msgCtx.setLastInBatch();
                
                this.recoverer.noOp(msgCtx.getConsensusId(), msgCtx);
            }
            
            consensusCount++;
        }

        if (executor instanceof BatchExecutable && numRequests > 0) {
            //Make new batch to deliver
            byte[][] batch = new byte[numRequests][];

            //Put messages in the batch
            int line = 0;
            for (TOMMessage m : toBatch) {
                batch[line] = m.getContent();
                line++;
            }

            MessageContext[] msgContexts = new MessageContext[msgCtxts.size()];
            msgContexts = msgCtxts.toArray(msgContexts);
            
            //Deliver the batch and wait for replies
            byte[][] replies = ((BatchExecutable) executor).executeBatch(batch, msgContexts);

            //Send the replies back to the client
            for (int index = 0; index < toBatch.size(); index++) {
                TOMMessage request = toBatch.get(index);
                request.reply = new TOMMessage(id, request.getSession(), request.getSequence(),
                        replies[index], SVController.getCurrentViewId());

                if (SVController.getStaticConf().getNumRepliers() > 0) {
                    repMan.send(request);
                } else {
                    cs.send(new int[]{request.getSender()}, request.reply);
                }
            }
            //DEBUG
            bftsmart.tom.util.Logger.println("BATCHEXECUTOR END");
        }
    }

    /**
     * This method makes the replica leave the group
     */
    public void leave() {
        ReconfigureReply r = null;
        Reconfiguration rec = new Reconfiguration(id);
        do {
            //System.out.println("while 1");
            rec.removeServer(id);

            r = rec.execute();
        } while (r.getView().isMember(id));
        rec.close();
        this.cs.updateServersConnections();
    }

    /**
     * This method initializes the object
     *
     * @param cs Server side communication System
     * @param conf Total order messaging configuration
     */
    private void initTOMLayer() {
        if (tomStackCreated) { // if this object was already initialized, don't do it again
            return;
        }

        if (!SVController.isInCurrentView()) {
            throw new RuntimeException("I'm not an acceptor!");
        }

        // Assemble the total order messaging layer
        MessageFactory messageFactory = new MessageFactory(id);

        Acceptor acceptor = new Acceptor(cs, messageFactory, SVController);
        cs.setAcceptor(acceptor);

        Proposer proposer = new Proposer(cs, messageFactory, SVController);

        ExecutionManager executionManager = new ExecutionManager(SVController, acceptor, proposer, id);

        acceptor.setExecutionManager(executionManager);

        tomLayer = new TOMLayer(executionManager, this, recoverer, acceptor, cs, SVController, verifier);

        executionManager.setTOMLayer(tomLayer);

        SVController.setTomLayer(tomLayer);

        cs.setTOMLayer(tomLayer);
        cs.setRequestReceiver(tomLayer);

        acceptor.setTOMLayer(tomLayer);

        if (SVController.getStaticConf().isShutdownHookEnabled()) {
            Runtime.getRuntime().addShutdownHook(new ShutdownHookThread(tomLayer));
        }
        tomLayer.start(); // start the layer execution
        tomStackCreated = true;

        replicaCtx = new ReplicaContext(cs, SVController);
    }

    /**
     * Obtains the current replica context (getting access to several
     * information and capabilities of the replication engine).
     *
     * @return this replica context
     */
    public final ReplicaContext getReplicaContext() {
        return replicaCtx;
    }

}
