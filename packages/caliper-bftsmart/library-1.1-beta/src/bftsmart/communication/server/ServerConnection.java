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
package bftsmart.communication.server;

import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.net.Socket;
import java.net.UnknownHostException;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import bftsmart.communication.SystemMessage;
import bftsmart.reconfiguration.ServerViewController;
import bftsmart.reconfiguration.VMMessage;
import bftsmart.tom.ServiceReplica;
import bftsmart.tom.util.Logger;
import bftsmart.tom.util.TOMUtil;
import java.math.BigInteger;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.HashSet;

/**
 * This class represents a connection with other server.
 *
 * ServerConnections are created by ServerCommunicationLayer.
 *
 * @author alysson
 */
public class ServerConnection {

    public static final String MAC_ALGORITHM = "HmacMD5";
    private static final long POOL_TIME = 5000;
    //private static final int SEND_QUEUE_SIZE = 50;
    private ServerViewController controller;
    private Socket socket;
    private DataOutputStream socketOutStream = null;
    private DataInputStream socketInStream = null;
    private int remoteId;
    private boolean useSenderThread;
    protected LinkedBlockingQueue<byte[]> outQueue;// = new LinkedBlockingQueue<byte[]>(SEND_QUEUE_SIZE);
    private HashSet<Integer> noMACs = null; // this is used to keep track of data to be sent without a MAC.
                                            // It uses the reference id for that same data
    private LinkedBlockingQueue<SystemMessage> inQueue;
    private SecretKey authKey = null;
    private Mac macSend;
    private Mac macReceive;
    private int macSize;
    private Lock connectLock = new ReentrantLock();
    /** Only used when there is no sender Thread */
    private Lock sendLock;
    private boolean doWork = true;

    public ServerConnection(ServerViewController controller, Socket socket, int remoteId,
            LinkedBlockingQueue<SystemMessage> inQueue, ServiceReplica replica) {

        this.controller = controller;

        this.socket = socket;

        this.remoteId = remoteId;

        this.inQueue = inQueue;

        this.outQueue = new LinkedBlockingQueue<byte[]>(this.controller.getStaticConf().getOutQueueSize());

        this.noMACs = new HashSet<Integer>();
        // Connect to the remote process or just wait for the connection?
        if (isToConnect()) {
            //I have to connect to the remote server
            try {
                this.socket = new Socket(this.controller.getStaticConf().getHost(remoteId),
                        this.controller.getStaticConf().getServerToServerPort(remoteId));
                ServersCommunicationLayer.setSocketOptions(this.socket);
                new DataOutputStream(this.socket.getOutputStream()).writeInt(this.controller.getStaticConf().getProcessId());

            } catch (UnknownHostException ex) {
                ex.printStackTrace();
            } catch (IOException ex) {
                ex.printStackTrace();
            }
        }
        //else I have to wait a connection from the remote server

        if (this.socket != null) {
            try {
                socketOutStream = new DataOutputStream(this.socket.getOutputStream());
                socketInStream = new DataInputStream(this.socket.getInputStream());
            } catch (IOException ex) {
                Logger.println("Error creating connection to "+remoteId);
                ex.printStackTrace();
            }
        }
               
       //******* EDUARDO BEGIN **************//
        this.useSenderThread = this.controller.getStaticConf().isUseSenderThread();

        if (useSenderThread && (this.controller.getStaticConf().getTTPId() != remoteId)) {
            new SenderThread().start();
        } else {
            sendLock = new ReentrantLock();
        }
        authenticateAndEstablishAuthKey();
        
        if (!this.controller.getStaticConf().isTheTTP()) {
            if (this.controller.getStaticConf().getTTPId() == remoteId) {
                //Uma thread "diferente" para as msgs recebidas da TTP
                new TTPReceiverThread(replica).start();
            } else {
                new ReceiverThread().start();
            }
        }
        //******* EDUARDO END **************//
    }

    public SecretKey getSecretKey() {
        return authKey;
    }
    
    /**
     * Stop message sending and reception.
     */
    public void shutdown() {
        Logger.println("SHUTDOWN for "+remoteId);
        
        doWork = false;
        closeSocket();
    }

    /**
     * Used to send packets to the remote server.
     */
    public final void send(byte[] data, boolean useMAC) throws InterruptedException {
        if (useSenderThread) {
            //only enqueue messages if there queue is not full
            if (!useMAC) {
                Logger.println("(ServerConnection.send) Not sending defaultMAC " + System.identityHashCode(data));
                noMACs.add(System.identityHashCode(data));
            }

            if (!outQueue.offer(data)) {
                Logger.println("(ServerConnection.send) out queue for " + remoteId + " full (message discarded).");
            }
        } else {
            sendLock.lock();
            sendBytes(data, useMAC);
            sendLock.unlock();
        }
    }

    /**
     * try to send a message through the socket
     * if some problem is detected, a reconnection is done
     */
    private final void sendBytes(byte[] messageData, boolean useMAC) {       
        boolean abort = false;
        do {
            if (abort) return; // if there is a need to reconnect, abort this method
            if (socket != null && socketOutStream != null) {
                try {
                    //do an extra copy of the data to be sent, but on a single out stream write
                    byte[] mac = (useMAC && this.controller.getStaticConf().getUseMACs() == 1)?macSend.doFinal(messageData):null;
                    byte[] data = new byte[5 +messageData.length+((mac!=null)?mac.length:0)];
                    int value = messageData.length;

                    System.arraycopy(new byte[]{(byte)(value >>> 24),(byte)(value >>> 16),(byte)(value >>> 8),(byte)value},0,data,0,4);
                    System.arraycopy(messageData,0,data,4,messageData.length);
                    if(mac != null) {
                        //System.arraycopy(mac,0,data,4+messageData.length,mac.length);
                        System.arraycopy(new byte[]{ (byte) 1},0,data,4+messageData.length,1);
                        System.arraycopy(mac,0,data,5+messageData.length,mac.length);
                    } else {
                        System.arraycopy(new byte[]{(byte) 0},0,data,4+messageData.length,1);                        
                    }

                    socketOutStream.write(data);

                    return;
                } catch (IOException ex) {
                    closeSocket();
                    waitAndConnect();
                    abort = true;
                }
            } else {
                waitAndConnect();
                abort = true;
            }
        } while (doWork);
    }

    //******* EDUARDO BEGIN **************//
    //return true of a process shall connect to the remote process, false otherwise
    private boolean isToConnect() {
        if (this.controller.getStaticConf().getTTPId() == remoteId) {
            //Need to wait for the connection request from the TTP, do not tray to connect to it
            return false;
        } else if (this.controller.getStaticConf().getTTPId() == this.controller.getStaticConf().getProcessId()) {
            //If this is a TTP, one must connect to the remote process
            return true;
        }
        boolean ret = false;
        if (this.controller.isInCurrentView()) {
            
             //in this case, the node with higher ID starts the connection
             if (this.controller.getStaticConf().getProcessId() > remoteId) {
                 ret = true;
             }
                
            /** JCS: I commented the code below to fix a bug, but I am not sure
             whether its completely useless or not. The 'if' above was taken
             from that same code (its the only part I understand why is necessary)
             I keep the code commented just to be on the safe side*/
            
            /**
            
            boolean me = this.controller.isInLastJoinSet(this.controller.getStaticConf().getProcessId());
            boolean remote = this.controller.isInLastJoinSet(remoteId);

            //either both endpoints are old in the system (entered the system in a previous view),
            //or both entered during the last reconfiguration
            if ((me && remote) || (!me && !remote)) {
                //in this case, the node with higher ID starts the connection
                if (this.controller.getStaticConf().getProcessId() > remoteId) {
                    ret = true;
                }
            //this process is the older one, and the other one entered in the last reconfiguration
            } else if (!me && remote) {
                ret = true;

            } //else if (me && !remote) { //this process entered in the last reconfig and the other one is old
                //ret=false; //not necessary, as ret already is false
            //}
              
            */
        }
        return ret;
    }
    //******* EDUARDO END **************//


    /**
     * (Re-)establish connection between peers.
     *
     * @param newSocket socket created when this server accepted the connection
     * (only used if processId is less than remoteId)
     */
    protected void reconnect(Socket newSocket) {
        
        connectLock.lock();

        if (socket == null || !socket.isConnected()) {

            try {

                //******* EDUARDO BEGIN **************//
                if (isToConnect()) {

                    socket = new Socket(this.controller.getStaticConf().getHost(remoteId),
                            this.controller.getStaticConf().getServerToServerPort(remoteId));
                    ServersCommunicationLayer.setSocketOptions(socket);
                    new DataOutputStream(socket.getOutputStream()).writeInt(this.controller.getStaticConf().getProcessId());

                //******* EDUARDO END **************//
                } else {
                    socket = newSocket;
                }
            } catch (UnknownHostException ex) {
                ex.printStackTrace();
            } catch (IOException ex) {
                
                System.out.println("Impossible to reconnect to replica " + remoteId);
                //ex.printStackTrace();
            }

            if (socket != null) {
                try {
                    socketOutStream = new DataOutputStream(socket.getOutputStream());
                    socketInStream = new DataInputStream(socket.getInputStream());
                    
                    authKey = null;
                    authenticateAndEstablishAuthKey();
                } catch (IOException ex) {
                    ex.printStackTrace();
                }
            }
        }

        connectLock.unlock();
    }

    //TODO!
    public void authenticateAndEstablishAuthKey() {
        if (authKey != null || socketOutStream == null || socketInStream == null) {
            return;
        }

        try {
            //if (conf.getProcessId() > remoteId) {
            // I asked for the connection, so I'm first on the auth protocol
            //DataOutputStream dos = new DataOutputStream(socket.getOutputStream());
            //} else {
            // I received a connection request, so I'm second on the auth protocol
            //DataInputStream dis = new DataInputStream(socket.getInputStream());
            //}
            
            //Derive DH private key from replica's own RSA private key
            
            PrivateKey RSAprivKey = controller.getStaticConf().getRSAPrivateKey();
            BigInteger DHPrivKey =
                    new BigInteger(RSAprivKey.getEncoded());
            
            //Create DH public key
            BigInteger myDHPubKey =
                    controller.getStaticConf().getDHG().modPow(DHPrivKey, controller.getStaticConf().getDHP());
            
            //turn it into a byte array
            byte[] bytes = myDHPubKey.toByteArray();
            
            byte[] signature = TOMUtil.signMessage(RSAprivKey, bytes);
            
            //send my DH public key and signature
            socketOutStream.writeInt(bytes.length);
            socketOutStream.write(bytes);
            
            socketOutStream.writeInt(signature.length);
            socketOutStream.write(signature);
            
            //receive remote DH public key and signature
            int dataLength = socketInStream.readInt();
            bytes = new byte[dataLength];
            int read = 0;
            do {
                read += socketInStream.read(bytes, read, dataLength - read);
                
            } while (read < dataLength);
            
            byte[] remote_Bytes = bytes;

            dataLength = socketInStream.readInt();
            bytes = new byte[dataLength];
            read = 0;
            do {
                read += socketInStream.read(bytes, read, dataLength - read);
                
            } while (read < dataLength);
            
            byte[] remote_Signature = bytes;
            
            //verify signature
            PublicKey remoteRSAPubkey = controller.getStaticConf().getRSAPublicKey(remoteId);
            
            if (!TOMUtil.verifySignature(remoteRSAPubkey, remote_Bytes, remote_Signature)) {
                
                System.out.println(remoteId + " sent an invalid signature!");
                shutdown();
                return;
            }
            
            BigInteger remoteDHPubKey = new BigInteger(remote_Bytes);

            //Create secret key
            BigInteger secretKey =
                    remoteDHPubKey.modPow(DHPrivKey, controller.getStaticConf().getDHP());
            
           System.out.println("#Diffie-Hellman complete with " + remoteId);
            
            SecretKeyFactory fac = SecretKeyFactory.getInstance("PBEWithMD5AndDES");
            PBEKeySpec spec = new PBEKeySpec(secretKey.toString().toCharArray());
            
            //PBEKeySpec spec = new PBEKeySpec(PASSWORD.toCharArray());
            authKey = fac.generateSecret(spec);

            macSend = Mac.getInstance(MAC_ALGORITHM);
            macSend.init(authKey);
            macReceive = Mac.getInstance(MAC_ALGORITHM);
            macReceive.init(authKey);
            macSize = macSend.getMacLength();
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    private void closeSocket() {
        if (socket != null) {
            try {
                socketOutStream.flush();
                socket.close();
            } catch (IOException ex) {
                Logger.println("Error closing socket to "+remoteId);
            } catch (NullPointerException npe) {
            	Logger.println("Socket already closed");
            }

            socket = null;
            socketOutStream = null;
            socketInStream = null;
        }
    }

    private void waitAndConnect() {
        if (doWork) {
            try {
                Thread.sleep(POOL_TIME);
            } catch (InterruptedException ie) {
            }

            outQueue.clear();
            reconnect(null);
        }
    }

    /**
     * Thread used to send packets to the remote server.
     */
    private class SenderThread extends Thread {

        public SenderThread() {
            super("Sender for " + remoteId);
        }

        @Override
        public void run() {
            byte[] data = null;

            while (doWork) {
                //get a message to be sent
                try {
                    data = outQueue.poll(POOL_TIME, TimeUnit.MILLISECONDS);
                } catch (InterruptedException ex) {
                }

                if (data != null) {
                    //sendBytes(data, noMACs.contains(System.identityHashCode(data)));
                    int ref = System.identityHashCode(data);
                    boolean sendMAC = !noMACs.remove(ref);
                    Logger.println("(ServerConnection.run) " + (sendMAC ? "Sending" : "Not sending") + " MAC for data " + ref);
                    sendBytes(data, sendMAC);
                }
            }

            Logger.println("Sender for " + remoteId + " stopped!");
        }
    }

    /**
     * Thread used to receive packets from the remote server.
     */
    protected class ReceiverThread extends Thread {

        public ReceiverThread() {
            super("Receiver for " + remoteId);
        }

        @Override
        public void run() {
            byte[] receivedMac = null;
            try {
                receivedMac = new byte[Mac.getInstance(MAC_ALGORITHM).getMacLength()];
            } catch (NoSuchAlgorithmException ex) {
                ex.printStackTrace();
            }

            while (doWork) {
                if (socket != null && socketInStream != null) {
                    try {
                        //read data length
                        int dataLength = socketInStream.readInt();
                        byte[] data = new byte[dataLength];

                        //read data
                        int read = 0;
                        do {
                            read += socketInStream.read(data, read, dataLength - read);
                        } while (read < dataLength);

                        //read mac
                        boolean result = true;
                        
                        byte hasMAC = socketInStream.readByte();
                        if (controller.getStaticConf().getUseMACs() == 1 && hasMAC == 1) {
                            read = 0;
                            do {
                                read += socketInStream.read(receivedMac, read, macSize - read);
                            } while (read < macSize);

                            result = Arrays.equals(macReceive.doFinal(data), receivedMac);
                        }

                        if (result) {
                            SystemMessage sm = (SystemMessage) (new ObjectInputStream(new ByteArrayInputStream(data)).readObject());
                            sm.authenticated = (controller.getStaticConf().getUseMACs() == 1 && hasMAC == 1);
                            
                            if (sm.getSender() == remoteId) {
                                if (!inQueue.offer(sm)) {
                                    Logger.println("(ReceiverThread.run) in queue full (message from " + remoteId + " discarded).");
                                    System.out.println("(ReceiverThread.run) in queue full (message from " + remoteId + " discarded).");
                                }
                            }
                        } else {
                            //TODO: violation of authentication... we should do something
                            Logger.println("WARNING: Violation of authentication in message received from " + remoteId);
                        }
                    } catch (ClassNotFoundException ex) {
                        //invalid message sent, just ignore;
                    } catch (IOException ex) {
                        if (doWork) {
                            Logger.println("Closing socket and reconnecting");
                            closeSocket();
                            waitAndConnect();
                        }
                    }
                } else {
                    waitAndConnect();
                }
            }
        }
    }

    //******* EDUARDO BEGIN: special thread for receiving messages indicating the entrance into the system, coming from the TTP **************//
    // Simly pass the messages to the replica, indicating its entry into the system
    //TODO: Ask eduardo why a new thread is needed!!! 
    //TODO2: Remove all duplicated code

    /**
     * Thread used to receive packets from the remote server.
     */
    protected class TTPReceiverThread extends Thread {

        private ServiceReplica replica;

        public TTPReceiverThread(ServiceReplica replica) {
            super("TTPReceiver for " + remoteId);
            this.replica = replica;
        }

        @Override
        public void run() {
            byte[] receivedMac = null;
            try {
                receivedMac = new byte[Mac.getInstance(MAC_ALGORITHM).getMacLength()];
            } catch (NoSuchAlgorithmException ex) {
            }

            while (doWork) {
                if (socket != null && socketInStream != null) {
                    try {
                        //read data length
                        int dataLength = socketInStream.readInt();

                        byte[] data = new byte[dataLength];

                        //read data
                        int read = 0;
                        do {
                            read += socketInStream.read(data, read, dataLength - read);
                        } while (read < dataLength);

                        //read mac
                        boolean result = true;
                        
                        byte hasMAC = socketInStream.readByte();
                        if (controller.getStaticConf().getUseMACs() == 1 && hasMAC == 1) {
                            
                            System.out.println("TTP CON USEMAC");
                            read = 0;
                            do {
                                read += socketInStream.read(receivedMac, read, macSize - read);
                            } while (read < macSize);

                            result = Arrays.equals(macReceive.doFinal(data), receivedMac);
                        }

                        if (result) {
                            SystemMessage sm = (SystemMessage) (new ObjectInputStream(new ByteArrayInputStream(data)).readObject());

                            if (sm.getSender() == remoteId) {
                                //System.out.println("Mensagem recebia de: "+remoteId);
                                /*if (!inQueue.offer(sm)) {
                                bftsmart.tom.util.Logger.println("(ReceiverThread.run) in queue full (message from " + remoteId + " discarded).");
                                System.out.println("(ReceiverThread.run) in queue full (message from " + remoteId + " discarded).");
                                }*/
                                this.replica.joinMsgReceived((VMMessage) sm);
                            }
                        } else {
                            //TODO: violation of authentication... we should do something
                            Logger.println("WARNING: Violation of authentication in message received from " + remoteId);
                        }
                    } catch (ClassNotFoundException ex) {
                        ex.printStackTrace();
                    } catch (IOException ex) {
                        //ex.printStackTrace();
                        if (doWork) {
                            closeSocket();
                            waitAndConnect();
                        }
                    }
                } else {
                    waitAndConnect();
                }
            }
        }
    }
        //******* EDUARDO END **************//
}
