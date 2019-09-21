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

import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.handler.codec.ByteToMessageDecoder;
import io.netty.handler.codec.MessageToByteEncoder;

import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import javax.crypto.SecretKey;

import bftsmart.reconfiguration.ClientViewController;


public class NettyClientPipelineFactory{

    NettyClientServerCommunicationSystemClientSide ncs;
    Map sessionTable;
    int macLength;
    int signatureLength;

    //******* EDUARDO BEGIN **************//
    ClientViewController controller;
    //******* EDUARDO END **************//

    ReentrantReadWriteLock rl;

    public NettyClientPipelineFactory(NettyClientServerCommunicationSystemClientSide ncs, Map sessionTable, int macLength, ClientViewController controller, ReentrantReadWriteLock rl, int signatureLength) {
        this.ncs = ncs;
        this.sessionTable = sessionTable;
        this.macLength = macLength;
        this.signatureLength = signatureLength;
        this.rl = rl;
        this.controller = controller;
    }


    public ByteToMessageDecoder getDecoder(){
    	return new NettyTOMMessageDecoder(true, sessionTable, macLength,controller,rl,signatureLength,controller.getStaticConf().getUseMACs()==1?true:false);	
    }
    
    public MessageToByteEncoder getEncoder(){
    	return new NettyTOMMessageEncoder(true, sessionTable, macLength,rl, signatureLength, controller.getStaticConf().getUseMACs()==1?true:false);	
    }
    
    public SimpleChannelInboundHandler getHandler(){
    	return ncs;	
    }

}
