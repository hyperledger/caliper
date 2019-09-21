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
package bftsmart.tom.leaderchange;

import java.util.Iterator;
import java.util.LinkedList;
import java.util.ListIterator;
import java.util.Timer;
import java.util.TimerTask;
import java.util.TreeSet;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import bftsmart.communication.ServerCommunicationSystem;
import bftsmart.reconfiguration.ServerViewController;
import bftsmart.tom.core.TOMLayer;
import bftsmart.tom.core.messages.TOMMessage;
import bftsmart.tom.util.TOMUtil;
import java.util.Hashtable;
import java.util.Set;

/**
 * This thread serves as a manager for all timers of pending requests.
 *
 */
public class RequestsTimer {

    private Timer timer = new Timer("request timer");
    private RequestTimerTask rtTask = null;
    private TOMLayer tomLayer; // TOM layer
    private long timeout;
    private long shortTimeout;
    private TreeSet<TOMMessage> watched = new TreeSet<TOMMessage>();
    private ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();
    
    private boolean enabled = true;
    
    private ServerCommunicationSystem communication; // Communication system between replicas
    private ServerViewController controller; // Reconfiguration manager
    
    private Hashtable <Integer, Timer> stopTimers = new Hashtable<>();
    
    //private Storage st1 = new Storage(100000);
    //private Storage st2 = new Storage(10000);
    /**
     * Creates a new instance of RequestsTimer
     * @param tomLayer TOM layer
     */
    public RequestsTimer(TOMLayer tomLayer, ServerCommunicationSystem communication, ServerViewController controller) {
        this.tomLayer = tomLayer;
        
        this.communication = communication;
        this.controller = controller;
        
        this.timeout = this.controller.getStaticConf().getRequestTimeout();
        this.shortTimeout = -1;
    }

    public void setShortTimeout(long shortTimeout) {
        this.shortTimeout = shortTimeout;
    }
    
    public void setTimeout(long timeout) {
        this.timeout = timeout;
    }
    
    public long getTimeout() {
        return timeout;
    }
    
    public void startTimer() {
        if (rtTask == null) {
            long t = (shortTimeout > -1 ? shortTimeout : timeout);
            //shortTimeout = -1;
            rtTask = new RequestTimerTask();
            if (controller.getCurrentViewN() > 1) timer.schedule(rtTask, t);
        }
    }
    
    public void stopTimer() {
        if (rtTask != null) {
            rtTask.cancel();
            rtTask = null;
        }
    }
    
    public void Enabled(boolean phase) {
        
        enabled = phase;
    }
    
    public boolean isEnabled() {
    	return enabled;
    }
    
    /**
     * Creates a timer for the given request
     * @param request Request to which the timer is being createf for
     */
    public void watch(TOMMessage request) {
        //long startInstant = System.nanoTime();
        rwLock.writeLock().lock();
        watched.add(request);
        if (watched.size() >= 1 && enabled) startTimer();
        rwLock.writeLock().unlock();
    }

    /**
     * Cancels a timer for a given request
     * @param request Request whose timer is to be canceled
     */
    public void unwatch(TOMMessage request) {
        //long startInstant = System.nanoTime();
        rwLock.writeLock().lock();
        if (watched.remove(request) && watched.isEmpty()) stopTimer();
        rwLock.writeLock().unlock();
    }

    /**
     * Cancels all timers for all messages
     */
    public void clearAll() {
        TOMMessage[] requests = new TOMMessage[watched.size()];
        rwLock.writeLock().lock();
        
        watched.toArray(requests);

        for (TOMMessage request : requests) {
            if (request != null && watched.remove(request) && watched.isEmpty() && rtTask != null) {
                rtTask.cancel();
                rtTask = null;
            }
        }
        rwLock.writeLock().unlock();
    }
    
    public void run_lc_protocol() {
            
        long t = (shortTimeout > -1 ? shortTimeout : timeout);
        
        //System.out.println("(RequestTimerTask.run) I SOULD NEVER RUN WHEN THERE IS NO TIMEOUT");

        LinkedList<TOMMessage> pendingRequests = new LinkedList<TOMMessage>();

        rwLock.readLock().lock();
        
        for (Iterator<TOMMessage> i = watched.iterator(); i.hasNext();) {
            TOMMessage request = i.next();
            if ((request.receptionTime + System.currentTimeMillis()) > t) {
                pendingRequests.add(request);
            } else {
                break;
            }
        }

        rwLock.readLock().unlock();
                
        if (!pendingRequests.isEmpty()) {
            for (ListIterator<TOMMessage> li = pendingRequests.listIterator(); li.hasNext(); ) {
                TOMMessage request = li.next();
                if (!request.timeout) {

                    request.signed = request.serializedMessageSignature != null;
                    tomLayer.forwardRequestToLeader(request);
                    request.timeout = true;
                    li.remove();
                }
            }

            if (!pendingRequests.isEmpty()) {
                System.out.println("Timeout for messages: " + pendingRequests);
                //Logger.debug = true;
                //tomLayer.requestTimeout(pendingRequests);
                //if (reconfManager.getStaticConf().getProcessId() == 4) Logger.debug = true;
                tomLayer.getSynchronizer().triggerTimeout(pendingRequests);
            }
            else {
                rtTask = new RequestTimerTask();
                timer.schedule(rtTask, t);
            }
        } else {
            rtTask = null;
            timer.purge();
        }
        
    }
    
    public void setSTOP(int regency, LCMessage stop) {
        
        stopSTOP(regency);
        
        SendStopTask stopTask = new SendStopTask(stop);
        Timer stopTimer = new Timer("Stop message");
        
        stopTimer.schedule(stopTask, timeout);
        
       stopTimers.put(regency, stopTimer);

    }   
    
    public void stopSTOP(int regency){
        
        Timer stopTimer = stopTimers.remove(regency);
        if (stopTimer != null) stopTimer.cancel();

    }
    
    public Set<Integer> getTimers() {
        
        return ((Hashtable <Integer,Timer>) stopTimers.clone()).keySet();
        
    }
    
    class RequestTimerTask extends TimerTask {

        @Override
        /**
         * This is the code for the TimerTask. It executes the timeout for the first
         * message on the watched list.
         */
        public void run() {
            
            int[] myself = new int[1];
            myself[0] = controller.getStaticConf().getProcessId();

            communication.send(myself, new LCMessage(-1, TOMUtil.TRIGGER_LC_LOCALLY, -1, null));

        }
    }
    
    class SendStopTask extends TimerTask {
        
        private LCMessage stop;
        
        public SendStopTask(LCMessage stop) {
            this.stop = stop;
        }

        @Override
        /**
         * This is the code for the TimerTask. It sends a STOP
         * message to the other replicas
         */
        public void run() {

                System.out.println("(SendStopTask.run) Re-transmitting STOP message to install regency " + stop.getReg());
                communication.send(controller.getCurrentViewOtherAcceptors(),this.stop);

                setSTOP(stop.getReg(), stop); //repeat
        }
        
    }
}
