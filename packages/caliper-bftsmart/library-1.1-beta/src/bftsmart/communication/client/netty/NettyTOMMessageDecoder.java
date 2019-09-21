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
package bftsmart.communication.client.netty;

import io.netty.buffer.ByteBuf;
import io.netty.channel.ChannelHandlerContext;
import io.netty.handler.codec.ByteToMessageDecoder;

import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import org.slf4j.LoggerFactory;

import bftsmart.reconfiguration.ViewController;
import bftsmart.tom.core.messages.TOMMessage;
import bftsmart.tom.util.Logger;

/**
 *
 * @author Paulo Sousa
 */
public class NettyTOMMessageDecoder extends ByteToMessageDecoder {

    /**
     * number of measures used to calculate statistics
     */
    //private final int BENCHMARK_PERIOD = 10000;
    private boolean isClient;
    private Map sessionTable;
    //private Storage st;
    private int macSize;
    private int signatureSize;
    private ViewController controller;
    private boolean firstTime;
    private ReentrantReadWriteLock rl;
    //******* EDUARDO BEGIN: commented out some unused variables **************//
    //private long numReceivedMsgs = 0;
    //private long lastMeasurementStart = 0;
    //private long max=0;
    //private Storage st;
    //private int count = 0;
   
    //private Signature signatureEngine;
    
    
     //******* EDUARDO END **************//
    
    private boolean useMAC;

    private org.slf4j.Logger logger = LoggerFactory.getLogger(NettyTOMMessageDecoder.class);

    
    public NettyTOMMessageDecoder(boolean isClient, Map sessionTable, int macLength, ViewController controller, ReentrantReadWriteLock rl, int signatureLength, boolean useMAC) {
        this.isClient = isClient;
        this.sessionTable = sessionTable;
        this.macSize = macLength;
        this.controller = controller;
        this.firstTime = true;
        this.rl = rl;
        this.signatureSize = signatureLength;
        this.useMAC = useMAC;
        bftsmart.tom.util.Logger.println("new NettyTOMMessageDecoder!!, isClient=" + isClient);
    }

    @Override
    protected void decode(ChannelHandlerContext context, ByteBuf buffer, List<Object> list) throws Exception  {

        // Wait until the length prefix is available.
        if (buffer.readableBytes() < 4) {
            return;
        }

        int dataLength = buffer.getInt(buffer.readerIndex());

        //Logger.println("Receiving message with "+dataLength+" bytes.");

        // Wait until the whole data is available.
        if (buffer.readableBytes() < dataLength + 4) {
            return;
        }

        // Skip the length field because we know it already.
        buffer.skipBytes(4);

        int totalLength = dataLength - 1;

        //read control byte indicating if message is signed
        byte signed = buffer.readByte();

        int authLength = 0;

        if (signed == 1) {
            authLength += signatureSize;
        }
        if (useMAC) {
            authLength += macSize;
        }

        byte[] data = new byte[totalLength - authLength];
        buffer.readBytes(data);

        byte[] digest = null;
        if (useMAC) {
            digest = new byte[macSize];
            buffer.readBytes(digest);
        }

        byte[] signature = null;
        if (signed == 1) {
            signature = new byte[signatureSize];
            buffer.readBytes(signature);
        }

        DataInputStream dis = null;
        TOMMessage sm = null;

        try {
            ByteArrayInputStream bais = new ByteArrayInputStream(data);
            dis = new DataInputStream(bais);
            sm = new TOMMessage();
            sm.rExternal(dis);
            sm.serializedMessage = data;

            if (signed == 1) {
                sm.serializedMessageSignature = signature;
                sm.signed = true;
            }
            if (useMAC) {
                sm.serializedMessageMAC = digest;
            }

            if (isClient) {
                //verify MAC
                if (useMAC) {
                    if (!verifyMAC(sm.getSender(), data, digest)) {
                        System.out.println("MAC error: message discarded");
                        return;
                    }
                }
            } else { /* it's a server */
                //verifies MAC if it's not the first message received from the client
                rl.readLock().lock();
                if (sessionTable.containsKey(sm.getSender())) {
                    rl.readLock().unlock();
                    if (useMAC) {
                        if (!verifyMAC(sm.getSender(), data, digest)) {
                            Logger.println("MAC error: message discarded");
                            return;
                        }
                    }
                } else {
                    //creates MAC/publick key stuff if it's the first message received from the client
                    bftsmart.tom.util.Logger.println("Creating MAC/public key stuff, first message from client" + sm.getSender());
                    bftsmart.tom.util.Logger.println("sessionTable size=" + sessionTable.size());

                    rl.readLock().unlock();
                    
                    SecretKeyFactory fac = SecretKeyFactory.getInstance("PBEWithMD5AndDES");
                    String str = sm.getSender() + ":" + this.controller.getStaticConf().getProcessId();                                        
                    PBEKeySpec spec = new PBEKeySpec(str.toCharArray());
                    SecretKey authKey = fac.generateSecret(spec);
            
                    Mac macSend = Mac.getInstance(controller.getStaticConf().getHmacAlgorithm());
                    macSend.init(authKey);
                    Mac macReceive = Mac.getInstance(controller.getStaticConf().getHmacAlgorithm());
                    macReceive.init(authKey);
                    NettyClientServerSession cs = new NettyClientServerSession(context.channel(), macSend, macReceive, sm.getSender());
                                       
                    rl.writeLock().lock();
//                    logger.info("PUT INTO SESSIONTABLE - [client id]:"+sm.getSender()+" [channel]: "+cs.getChannel());
                    sessionTable.put(sm.getSender(), cs);
                    bftsmart.tom.util.Logger.println("#active clients " + sessionTable.size());
                    rl.writeLock().unlock();
                    if (useMAC && !verifyMAC(sm.getSender(), data, digest)) {
                        Logger.println("MAC error: message discarded");
                        return;
                    }
                }
            }
            list.add(sm);
        } catch (Exception ex) {
            bftsmart.tom.util.Logger.println("Impossible to decode message: "+
                    ex.getMessage());
            ex.printStackTrace();
        }
        return;
    }

    boolean verifyMAC(int id, byte[] data, byte[] digest) {
        //long startInstant = System.nanoTime();
        rl.readLock().lock();
        Mac macReceive = ((NettyClientServerSession) sessionTable.get(id)).getMacReceive();
        rl.readLock().unlock();
        boolean result = Arrays.equals(macReceive.doFinal(data), digest);
        //long duration = System.nanoTime() - startInstant;
        //st.store(duration);
        return result;
    }

}
