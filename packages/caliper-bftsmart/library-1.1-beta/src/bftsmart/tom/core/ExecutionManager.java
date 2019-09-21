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
package bftsmart.tom.core;

import bftsmart.consensus.Consensus;
import bftsmart.consensus.Epoch;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.TreeMap;
import java.util.concurrent.locks.ReentrantLock;

import bftsmart.consensus.Decision;
import bftsmart.consensus.messages.MessageFactory;
import bftsmart.consensus.messages.ConsensusMessage;
import bftsmart.consensus.roles.Acceptor;
import bftsmart.consensus.roles.Proposer;
import bftsmart.reconfiguration.ServerViewController;
import bftsmart.tom.core.TOMLayer;
import bftsmart.tom.util.Logger;


/**
 * This class manages consensus instances. It can have several epochs if
 * there were problems during consensus.
 *
 * @author Alysson
 */
public final class ExecutionManager {

    private ServerViewController controller;
    private Acceptor acceptor; // Acceptor role of the PaW algorithm
    private Proposer proposer; // Proposer role of the PaW algorithm
    //******* EDUARDO BEGIN: now these variables are all concentrated in the Reconfigurationmanager **************//
    //private int me; // This process ID
    //private int[] acceptors; // Process ID's of all replicas, including this one
    //private int[] otherAcceptors; // Process ID's of all replicas, except this one
    //******* EDUARDO END **************//
    private Map<Integer, Consensus> consensuses = new TreeMap<Integer, Consensus>(); // Consensuses
    private ReentrantLock consensusesLock = new ReentrantLock(); //lock for consensuses table
    // Paxos messages that were out of context (that didn't belong to the consensus that was/is is progress
    private Map<Integer, List<ConsensusMessage>> outOfContext = new HashMap<Integer, List<ConsensusMessage>>();
    // Proposes that were out of context (that belonged to future consensuses, and not the one running at the time)
    private Map<Integer, ConsensusMessage> outOfContextProposes = new HashMap<Integer, ConsensusMessage>();
    private ReentrantLock outOfContextLock = new ReentrantLock(); //lock for out of context
    private boolean stopped = false; // Is the execution manager stopped?
    // When the execution manager is stopped, incoming paxos messages are stored here
    private Queue<ConsensusMessage> stoppedMsgs = new LinkedList<ConsensusMessage>();
    private Epoch stoppedEpoch = null; // epoch at which the current consensus was stopped
    private ReentrantLock stoppedMsgsLock = new ReentrantLock(); //lock for stopped messages
    private TOMLayer tomLayer; // TOM layer associated with this execution manager
    private int paxosHighMark; // Paxos high mark for consensus instances
    
    /** THIS IS JOAO'S CODE, TO HANDLE THE STATE TRANSFER */
    
    private int revivalHighMark; // Paxos high mark for consensus instances when this replica CID equals 0
    private int timeoutHighMark; // Paxos high mark for a timed-out replica
    
    private int lastRemovedCID = 0; // Addition to fix memory leak
        
    /******************************************************************/
    
    // This is the new way of storing info about the leader,
    // uncoupled from any consensus instance
    private int currentLeader;
    
    /**
     * Creates a new instance of ExecutionManager
     *
     * @param controller
     * @param acceptor Acceptor role of the PaW algorithm
     * @param proposer Proposer role of the PaW algorithm
     * @param me This process ID
     */
    public ExecutionManager(ServerViewController controller, Acceptor acceptor,
            Proposer proposer, int me) {
        //******* EDUARDO BEGIN **************//
        this.controller = controller;
        this.acceptor = acceptor;
        this.proposer = proposer;
        //this.me = me;

        this.paxosHighMark = this.controller.getStaticConf().getPaxosHighMark();
        /** THIS IS JOAO'S CODE, TO HANDLE THE STATE TRANSFER */
        this.revivalHighMark = this.controller.getStaticConf().getRevivalHighMark();
        this.timeoutHighMark = this.controller.getStaticConf().getTimeoutHighMark();
        /******************************************************************/
        //******* EDUARDO END **************//
        
        // Get initial leader
        if (controller.getCurrentViewAcceptors().length > 0)
            currentLeader = controller.getCurrentViewAcceptors()[0];
        else currentLeader = 0;
    }
    
    /**
     * Set the current leader
     * @param leader Current leader
     */
    public void setNewLeader (int leader) {
            this.currentLeader = leader;
    }

    /**
     * Get the current leader
     * @return Current leader
     */
    public int getCurrentLeader() {
            return currentLeader;
    }
        
    /**
     * Sets the TOM layer associated with this execution manager
     * @param tom The TOM layer associated with this execution manager
     */
    public void setTOMLayer(TOMLayer tom) {
        this.tomLayer = tom;

    }

    /**
     * Returns the TOM layer associated with this execution manager
     * @return The TOM layer associated with this execution manager
     */
    public TOMLayer getTOMLayer() {
        return tomLayer;
    }

    /**
     * Returns the acceptor role of the PaW algorithm
     * @return The acceptor role of the PaW algorithm
     */
    public Acceptor getAcceptor() {
        return acceptor;
    }

    public Proposer getProposer() {
        return proposer;
    }

    
    public boolean stopped() {
        return stopped;
    }

    public boolean hasMsgs() {
        return !stoppedMsgs.isEmpty();
    }

    public Queue<ConsensusMessage> getStoppedMsgs() {
        return stoppedMsgs;
    }
    
    public void clearStopped() {
        stoppedMsgs.clear();
    }
    /**
     * Stops this execution manager
     */
    public void stop() {
        Logger.println("(ExecutionManager.stoping) Stoping execution manager");
        stoppedMsgsLock.lock();
        this.stopped = true;
        if (tomLayer.getInExec() != -1) {
            stoppedEpoch = getConsensus(tomLayer.getInExec()).getLastEpoch();
            //stoppedEpoch.getTimeoutTask().cancel();
            if (stoppedEpoch != null) Logger.println("(ExecutionManager.stop) Stoping epoch " + stoppedEpoch.getTimestamp() + " of consensus " + tomLayer.getInExec());
        }
        stoppedMsgsLock.unlock();
    }

    
    
    /**
     * Restarts this execution manager
     */
    public void restart() {
        Logger.println("(ExecutionManager.restart) Starting execution manager");
        stoppedMsgsLock.lock();
        this.stopped = false;

        //process stopped messages
        while (!stoppedMsgs.isEmpty()) {
            ConsensusMessage pm = stoppedMsgs.remove();
            if (pm.getNumber() > tomLayer.getLastExec()) acceptor.processMessage(pm);
        }
        stoppedMsgsLock.unlock();
        Logger.println("(ExecutionManager.restart) Finished stopped messages processing");
    }

    /**
     * Checks if this message can execute now. If it is not possible,
     * it is stored in outOfContextMessages
     *
     * @param msg the received message
     * @return true in case the message can be executed, false otherwise
     */
    public final boolean checkLimits(ConsensusMessage msg) {
        outOfContextLock.lock();
        
        int lastConsId = tomLayer.getLastExec();
        
        int inExec = tomLayer.getInExec();
        
        Logger.println("(ExecutionManager.checkLimits) Received message  " + msg);
        Logger.println("(ExecutionManager.checkLimits) I'm at consensus " + 
                inExec + " and my last consensus is " + lastConsId);
        
        boolean isRetrievingState = tomLayer.isRetrievingState();

        if (isRetrievingState) {
            Logger.println("(ExecutionManager.checkLimits) I'm waiting for a state");
        }

        boolean canProcessTheMessage = false;

        /** THIS IS JOAO'S CODE, TO HANDLE THE STATE TRANSFER */
        // This serves to re-direct the messages to the out of context
        // while a replica is receiving the state of the others and updating itself
        if (isRetrievingState || // Is this replica retrieving a state?
                (!(lastConsId == -1 && msg.getNumber() >= (lastConsId + revivalHighMark)) && //not a recovered replica
                (msg.getNumber() > lastConsId && (msg.getNumber() < (lastConsId + paxosHighMark))) && // not an ahead of time message
                !(stopped && msg.getNumber() >= (lastConsId + timeoutHighMark)))) { // not a timed-out replica which needs to fetch the state

            if (stopped) {//just an optimization to avoid calling the lock in normal case
                stoppedMsgsLock.lock();
                if (stopped) {
                    Logger.println("(ExecutionManager.checkLimits) adding message for consensus " + msg.getNumber() + " to stoopped");
                    //the execution manager was stopped, the messages should be stored
                    //for later processing (when the consensus is restarted)
                    stoppedMsgs.add(msg);
                }
                stoppedMsgsLock.unlock();
            } else {
                if (isRetrievingState || 
                        msg.getNumber() > (lastConsId + 1) || 
                        (inExec != -1 && inExec < msg.getNumber()) || 
                        (inExec == -1 && msg.getType() != MessageFactory.PROPOSE)) { //not propose message for the next consensus
                    Logger.println("(ExecutionManager.checkLimits) Message for consensus " + 
                            msg.getNumber() + " is out of context, adding it to out of context set");
                    

                    //System.out.println("(ExecutionManager.checkLimits) Message for consensus " + 
                     //       msg.getNumber() + " is out of context, adding it to out of context set; isRetrievingState="+isRetrievingState);
                    
                    
                    addOutOfContextMessage(msg);
                } else { //can process!
                    Logger.println("(ExecutionManager.checkLimits) message for consensus " + 
                            msg.getNumber() + " can be processed");
            
                    //Logger.debug = false;
                    canProcessTheMessage = true;
                }
            }
        } else if ((lastConsId == -1 && msg.getNumber() >= (lastConsId + revivalHighMark)) || //recovered...
                (msg.getNumber() >= (lastConsId + paxosHighMark)) ||  //or too late replica...
                (stopped && msg.getNumber() >= (lastConsId + timeoutHighMark))) { // or a timed-out replica which needs to fetch the state

            //Start state transfer
            /** THIS IS JOAO'S CODE, FOR HANLDING THE STATE TRANSFER */
            Logger.println("(ExecutionManager.checkLimits) Message for consensus "
                    + msg.getNumber() + " is beyond the paxos highmark, adding it to out of context set");
            addOutOfContextMessage(msg);

            if (controller.getStaticConf().isStateTransferEnabled()) {
                //Logger.debug = true;
                tomLayer.getStateManager().analyzeState(msg.getNumber());
            }
            else {
                System.out.println("##################################################################################");
                System.out.println("- Ahead-of-time message discarded");
                System.out.println("- If many messages of the same consensus are discarded, the replica can halt!");
                System.out.println("- Try to increase the 'system.paxos.highMarc' configuration parameter.");
                System.out.println("- Last consensus executed: " + lastConsId);
                System.out.println("##################################################################################");
            }
            /******************************************************************/
        }
        
        outOfContextLock.unlock();

        return canProcessTheMessage;
    }

    /**
     * Informs if there are messages till to be processed associated the specified consensus
     * @param cid The ID for the consensus in question
     * @return True if there are still messages to be processed, false otherwise
     */
    public boolean receivedOutOfContextPropose(int cid) {
        outOfContextLock.lock();
        /******* BEGIN OUTOFCONTEXT CRITICAL SECTION *******/
        boolean result = outOfContextProposes.get(cid) != null;
        /******* END OUTOFCONTEXT CRITICAL SECTION *******/
        outOfContextLock.unlock();

        return result;
    }

    /**
     * Removes a consensus from this manager
     * @param id ID of the consensus to be removed
     * @return The consensus that was removed
     */
    public Consensus removeConsensus(int id) {
        consensusesLock.lock();
        /******* BEGIN CONSENSUS CRITICAL SECTION *******/
        Consensus consensus = consensuses.remove(id);

        // Addition to fix memory leak
        for (int i = lastRemovedCID; i < id; i++) consensuses.remove(i);
        lastRemovedCID = id;
        
        /******* END CONSENSUS CRITICAL SECTION *******/
        consensusesLock.unlock();

        outOfContextLock.lock();
        /******* BEGIN OUTOFCONTEXT CRITICAL SECTION *******/
        outOfContextProposes.remove(id);
        outOfContext.remove(id);

        /******* END OUTOFCONTEXT CRITICAL SECTION *******/
        outOfContextLock.unlock();

        return consensus;
    }

    /** THIS IS JOAO'S CODE, FOR HANDLING THE STATE TRANSFER */
    public void removeOutOfContexts(int id) {

        outOfContextLock.lock();
        /******* BEGIN OUTOFCONTEXT CRITICAL SECTION *******/
        Integer[] keys = new Integer[outOfContextProposes.keySet().size()];
        outOfContextProposes.keySet().toArray(keys);
        for (int i = 0; i < keys.length; i++) {
            if (keys[i] <= id) {
                outOfContextProposes.remove(keys[i]);
            }
        }

        keys = new Integer[outOfContext.keySet().size()];
        outOfContext.keySet().toArray(keys);
        for (int i = 0; i < keys.length; i++) {
            if (keys[i] <= id) {
                outOfContext.remove(keys[i]);
            }
        }

        /******* END OUTOFCONTEXT CRITICAL SECTION *******/
        outOfContextLock.unlock();
    }

    /********************************************************/
    /**
     * Returns the specified consensus
     *
     * @param cid ID of the consensus to be returned
     * @return The consensus specified
     */
    public Consensus getConsensus(int cid) {
        consensusesLock.lock();
        /******* BEGIN CONSENSUS CRITICAL SECTION *******/
        
        Consensus consensus = consensuses.get(cid);

        if (consensus == null) {//there is no consensus created with the given cid
            //let's create one...
            Decision dec = new Decision(cid);

            consensus = new Consensus(this, dec);

            //...and add it to the consensuses table
            consensuses.put(cid, consensus);
        }

        /******* END CONSENSUS CRITICAL SECTION *******/
        consensusesLock.unlock();

        return consensus;
    }
    
    public boolean isDecidable(int cid) {
        if (receivedOutOfContextPropose(cid)) {
            Consensus cons = getConsensus(cid);
            ConsensusMessage prop = outOfContextProposes.get(cons.getId());
            Epoch epoch = cons.getEpoch(prop.getEpoch(), controller);
            byte[] propHash = tomLayer.computeHash(prop.getValue());
            List<ConsensusMessage> msgs = outOfContext.get(cid);
            int countWrites = 0;
            int countAccepts = 0;
            if (msgs != null) {
                for (ConsensusMessage msg : msgs) {
                    
                    if (msg.getEpoch() == epoch.getTimestamp() &&
                            Arrays.equals(propHash, msg.getValue())) {
                        
                        if (msg.getType() == MessageFactory.WRITE) countWrites++;
                        else if (msg.getType() == MessageFactory.ACCEPT) countAccepts++;
                    }
                }
            }
            
            if(controller.getStaticConf().isBFT()){
            	return ((countWrites > (2*controller.getCurrentViewF())) &&
            			(countAccepts > (2*controller.getCurrentViewF())));
            }else{
            	return (countAccepts > controller.getQuorum());
            }
        }
        return false;
    }
    public void processOutOfContextPropose(Consensus consensus) {
        outOfContextLock.lock();
        /******* BEGIN OUTOFCONTEXT CRITICAL SECTION *******/
        
        ConsensusMessage prop = outOfContextProposes.remove(consensus.getId());
        if (prop != null) {
            Logger.println("(ExecutionManager.processOutOfContextPropose) (" + consensus.getId()
                    + ") Processing out of context propose");
            acceptor.processMessage(prop);
        }

        /******* END OUTOFCONTEXT CRITICAL SECTION *******/
        outOfContextLock.unlock();
    }

    public void processOutOfContext(Consensus consensus) {
        outOfContextLock.lock();
        /******* BEGIN OUTOFCONTEXT CRITICAL SECTION *******/
        
        //then we have to put the pending paxos messages
        List<ConsensusMessage> messages = outOfContext.remove(consensus.getId());
        if (messages != null) {
            Logger.println("(ExecutionManager.processOutOfContext) (" + consensus.getId()
                    + ") Processing other " + messages.size()
                    + " out of context messages.");

            for (Iterator<ConsensusMessage> i = messages.iterator(); i.hasNext();) {
                acceptor.processMessage(i.next());
                if (consensus.isDecided()) {
                    Logger.println("(ExecutionManager.processOutOfContext) consensus "
                            + consensus.getId() + " decided.");
                    break;
                }
            }
            Logger.println("(ExecutionManager.processOutOfContext) (" + consensus.getId()
                    + ") Finished out of context processing");
        }

        /******* END OUTOFCONTEXT CRITICAL SECTION *******/
        outOfContextLock.unlock();
    }

    /**
     * Stores a message established as being out of context (a message that
     * doesn't belong to current executing consensus).
     *
     * @param m Out of context message to be stored
     */
    public void addOutOfContextMessage(ConsensusMessage m) {
        outOfContextLock.lock();
        /******* BEGIN OUTOFCONTEXT CRITICAL SECTION *******/
        if (m.getType() == MessageFactory.PROPOSE) {
            Logger.println("(ExecutionManager.addOutOfContextMessage) adding " + m);
            outOfContextProposes.put(m.getNumber(), m);
        } else {
            List<ConsensusMessage> messages = outOfContext.get(m.getNumber());
            if (messages == null) {
                messages = new LinkedList<ConsensusMessage>();
                outOfContext.put(m.getNumber(), messages);
            }
            Logger.println("(ExecutionManager.addOutOfContextMessage) adding " + m);
            messages.add(m);

        }

        /******* END OUTOFCONTEXT CRITICAL SECTION *******/
        outOfContextLock.unlock();
    }

    @Override
    public String toString() {
        return stoppedMsgs.toString();
    }
}
