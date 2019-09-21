/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package bftsmart.tom.core;

import bftsmart.communication.ServerCommunicationSystem;
import bftsmart.communication.SystemMessage;
import bftsmart.tom.core.messages.TOMMessage;
import java.util.LinkedList;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;


/**
 *
 * @author snake
 */
public class ReplyManager {
    
    private LinkedList<ReplyThread> threads;
    private int iteration;
    
    public ReplyManager(int numThreads, ServerCommunicationSystem cs) {
        
        this.threads = new LinkedList();
        this.iteration = 0;
        
        for (int i = 0; i < numThreads; i++) {
            this.threads.add(new ReplyThread(cs));
        }
        
        for (ReplyThread t : threads)
            t.start();
    }
    
    public void send (TOMMessage msg) {

        iteration++;
        threads.get((iteration % threads.size())).send(msg);

    }
}
class ReplyThread extends Thread {
    
    private static final long POOL_TIME = 5000;
    
    private LinkedBlockingQueue<TOMMessage> replies;
    private ServerCommunicationSystem cs = null;
    
    ReplyThread(ServerCommunicationSystem cs) {
        this.cs = cs;
        this.replies = new LinkedBlockingQueue<TOMMessage>();
    }
    
    void send(TOMMessage msg) {
        replies.add(msg);
    }
    
    public void run() {

        TOMMessage msg;

        while (true) {

            try {
                msg = replies.poll(POOL_TIME, TimeUnit.MILLISECONDS);
                if (msg == null) {

                    continue; //go back to the start of the loop
                }
                cs.getClientsConn().send(new int[] {msg.getSender()}, msg.reply, false);
            } catch (InterruptedException ex) {
                ex.printStackTrace();
            }

        }

    }
}