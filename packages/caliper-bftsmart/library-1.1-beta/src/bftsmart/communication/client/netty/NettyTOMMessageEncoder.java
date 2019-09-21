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
import io.netty.handler.codec.MessageToByteEncoder;

import java.nio.channels.Channels;
import java.util.Map;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import javax.crypto.Mac;

import bftsmart.tom.core.messages.TOMMessage;


public class NettyTOMMessageEncoder extends MessageToByteEncoder<TOMMessage> {
    
    private boolean isClient;
    private Map sessionTable;
    private int macLength;
    private int signatureLength;
    private ReentrantReadWriteLock rl;
    private boolean useMAC;

    public NettyTOMMessageEncoder(boolean isClient, Map sessionTable, int macLength, ReentrantReadWriteLock rl, int signatureLength, boolean useMAC){
        this.isClient = isClient;
        this.sessionTable = sessionTable;
        this.macLength = macLength;
        this.rl = rl;
        this.signatureLength = signatureLength;
        this.useMAC = useMAC;
    }

    @Override
	protected void encode(ChannelHandlerContext context, TOMMessage sm, ByteBuf buffer) throws Exception {
        byte[] msgData;
        byte[] macData = null;
        byte[] signatureData = null;

        msgData = sm.serializedMessage;
        if (sm.signed){
            //signature was already produced before            
            signatureData = sm.serializedMessageSignature;
            if (signatureData.length != signatureLength)
                System.out.println("WARNING: message signature has size "+signatureData.length+" and should have "+signatureLength);
        }
        
        if (useMAC) {
            macData = produceMAC(sm.destination, msgData, sm.getSender());
            if(macData == null) {
            	System.out.println("uses MAC and the MAC returned is null. Won't write to channel");
            	return;
            }
        }

        int dataLength = 1+msgData.length+(macData==null?0:macData.length)+
                (signatureData==null?0:signatureData.length);

        //Logger.println("Sending message with "+dataLength+" bytes.");
        /* msg size */
        buffer.writeInt(dataLength);
        /* control byte indicating if the message is signed or not */
        buffer.writeByte(sm.signed==true?(byte)1:(byte)0);       
        /* data to be sent */
        buffer.writeBytes(msgData);
         /* MAC */
        if (useMAC)
        	buffer.writeBytes(macData);
        /* signature */
        if (signatureData != null)
        	buffer.writeBytes(signatureData);

        context.flush();
    }

    byte[] produceMAC(int id, byte[] data, int me) {
        NettyClientServerSession session = (NettyClientServerSession)sessionTable.get(id);
        if(session == null) {
        	System.out.println("NettyTOMMessageEncoder.produceMAC(). session for client " + id + " is null");
        	return null;
        }
        Mac macSend = session.getMacSend();
        return macSend.doFinal(data);
    }

}
