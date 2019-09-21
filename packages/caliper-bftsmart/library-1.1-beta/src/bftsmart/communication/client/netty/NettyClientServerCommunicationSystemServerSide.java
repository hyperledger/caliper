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

import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.Channel;
import io.netty.channel.ChannelFuture;
import io.netty.channel.ChannelHandler.Sharable;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.ChannelOption;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.ConnectException;
import java.net.InetSocketAddress;
import java.nio.channels.ClosedChannelException;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map.Entry;
import java.util.Set;
import java.util.concurrent.locks.ReentrantLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import javax.crypto.Mac;

import org.slf4j.LoggerFactory;

import bftsmart.communication.client.CommunicationSystemServerSide;
import bftsmart.communication.client.RequestReceiver;
import bftsmart.reconfiguration.ServerViewController;
import bftsmart.tom.core.messages.TOMMessage;
import bftsmart.tom.util.Logger;
import bftsmart.tom.util.TOMUtil;

/**
 *
 * @author Paulo
 */
@Sharable
public class NettyClientServerCommunicationSystemServerSide extends SimpleChannelInboundHandler<TOMMessage> implements CommunicationSystemServerSide {

	private RequestReceiver requestReceiver;
	private HashMap sessionTable;
	private ReentrantReadWriteLock rl;
	private ServerViewController controller;
        
        // This locked seems to introduce a bottleneck and seems useless, but I cannot recall why I added it
	//private ReentrantLock sendLock = new ReentrantLock();
	private NettyServerPipelineFactory serverPipelineFactory;
    private org.slf4j.Logger logger = LoggerFactory.getLogger(NettyClientServerCommunicationSystemServerSide.class);

	public NettyClientServerCommunicationSystemServerSide(ServerViewController controller) {
		try {

			this.controller = controller;
			sessionTable = new HashMap();
			rl = new ReentrantReadWriteLock();

			//Configure the server.
			Mac macDummy = Mac.getInstance(controller.getStaticConf().getHmacAlgorithm());

			serverPipelineFactory = new NettyServerPipelineFactory(this, sessionTable, macDummy.getMacLength(), controller, rl, TOMUtil.getSignatureSize(controller));

			EventLoopGroup bossGroup = new NioEventLoopGroup();
			EventLoopGroup workerGroup = new NioEventLoopGroup();

			ServerBootstrap b = new ServerBootstrap(); 
			b.group(bossGroup, workerGroup)
			.channel(NioServerSocketChannel.class) 
			.childHandler(new ChannelInitializer<SocketChannel>() {
				@Override
				public void initChannel(SocketChannel ch) throws Exception {
					ch.pipeline().addLast(serverPipelineFactory.getDecoder());
					ch.pipeline().addLast(serverPipelineFactory.getEncoder());
					ch.pipeline().addLast(serverPipelineFactory.getHandler());
				}
			})	.childOption(ChannelOption.SO_KEEPALIVE, true).childOption(ChannelOption.TCP_NODELAY, true);

			// Bind and start to accept incoming connections.
			ChannelFuture f = b.bind(new InetSocketAddress(controller.getStaticConf().getHost(
					controller.getStaticConf().getProcessId()),
					controller.getStaticConf().getPort(controller.getStaticConf().getProcessId()))).sync(); 

			System.out.println("#Bound to port " + controller.getStaticConf().getPort(controller.getStaticConf().getProcessId()));
			System.out.println("#myId " + controller.getStaticConf().getProcessId());
			System.out.println("#n " + controller.getCurrentViewN());
			System.out.println("#f " + controller.getCurrentViewF());
			System.out.println("#requestTimeout= " + controller.getStaticConf().getRequestTimeout());
			System.out.println("#maxBatch= " + controller.getStaticConf().getMaxBatchSize());
			System.out.println("#Using MACs = " + controller.getStaticConf().getUseMACs());
			System.out.println("#Using Signatures = " + controller.getStaticConf().getUseSignatures());
			//******* EDUARDO END **************//

		} catch (NoSuchAlgorithmException ex) {
			ex.printStackTrace();
		} catch (InterruptedException ex) {
			ex.printStackTrace();
		}
	}

	@Override
	public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause){
		if(cause instanceof ClosedChannelException)
			System.out.println("Connection with client closed.");
		else if(cause instanceof ConnectException) {
			System.out.println("Impossible to connect to client.");
		} else {
			cause.printStackTrace(System.err);
		}
	}

	@Override
	protected void channelRead0(ChannelHandlerContext arg0, TOMMessage sm) throws Exception {
		//delivers message to TOMLayer
		if (requestReceiver == null)
			System.out.println("RECEIVER NULO!!!!!!!!!!!!");
		else requestReceiver.requestReceived(sm);
	}

	@Override
	public void channelActive(ChannelHandlerContext ctx) {
		Logger.println("Session Created, active clients=" + sessionTable.size());
		System.out.println("Session Created, active clients=" + sessionTable.size());
	}

	@Override
	public void channelInactive(ChannelHandlerContext ctx) {
		rl.writeLock().lock();
		try {
			Set s = sessionTable.entrySet();
			Iterator i = s.iterator();
			while (i.hasNext()) {
				Entry m = (Entry) i.next();
				NettyClientServerSession value = (NettyClientServerSession) m.getValue();
				if (ctx.channel().equals(value.getChannel())) {
					int key = (Integer) m.getKey();
					System.out.println("#Removing client channel with ID= " + key);
					sessionTable.remove(key);
					System.out.println("#active clients=" + sessionTable.size());
					break;
				}
			}
			
            

		} finally {
			rl.writeLock().unlock();
		}
		Logger.println("Session Closed, active clients=" + sessionTable.size());
	}

	@Override
	public void setRequestReceiver(RequestReceiver tl) {
		this.requestReceiver = tl;
	}

	@Override
	public void send(int[] targets, TOMMessage sm, boolean serializeClassHeaders) {

		//serialize message
		DataOutputStream dos = null;

		byte[] data = null;
		try {
			ByteArrayOutputStream baos = new ByteArrayOutputStream();
			dos = new DataOutputStream(baos);
			sm.wExternal(dos);
			dos.flush();
			data = baos.toByteArray();
			sm.serializedMessage = data;
		} catch (IOException ex) {
			Logger.println("Error enconding message.");
		} finally {
			try {
				dos.close();
			} catch (IOException ex) {
				System.out.println("Exception closing DataOutputStream: " + ex.getMessage());
			}
		}

		//replies are not signed in the current JBP version
		sm.signed = false;
		//produce signature if necessary (never in the current version)
		if (sm.signed) {
			//******* EDUARDO BEGIN **************//
			byte[] data2 = TOMUtil.signMessage(controller.getStaticConf().getRSAPrivateKey(), data);
			//******* EDUARDO END **************//
			sm.serializedMessageSignature = data2;
		}

		for (int i = 0; i < targets.length; i++) {
			rl.readLock().lock();
			//sendLock.lock();
			try {       
				NettyClientServerSession ncss = (NettyClientServerSession) sessionTable.get(targets[i]);
				if (ncss != null) {
					Channel session = ncss.getChannel();
					sm.destination = targets[i];
					//send message
					session.writeAndFlush(sm); // This used to invoke "await". Removed to avoid blockage and race condition.
				} else {
					System.out.println("!!!!!!!!NettyClientServerSession NULL !!!!!! sequence: " + sm.getSequence() + ", ID; " + targets[i]);
				}
			} finally {
				//sendLock.unlock();
				rl.readLock().unlock();
			}
		}
	}

}
