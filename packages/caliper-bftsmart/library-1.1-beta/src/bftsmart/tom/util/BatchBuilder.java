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
package bftsmart.tom.util;

import java.nio.ByteBuffer;
import java.util.List;
import java.util.Random;

import bftsmart.reconfiguration.ServerViewController;
import bftsmart.tom.core.messages.TOMMessage;

/**
 * Batch format: TIMESTAMP(long) + N_NONCES(int) + SEED(long) +
 *               N_MESSAGES(int) + N_MESSAGES*[MSGSIZE(int),MSG(byte),SIG(byte)] +
 *
 *
 * The methods does not try to enforce any constraint, so be correct when using it.
 *
 */
public final class BatchBuilder {

	private Random rnd;

        public BatchBuilder(long seed){
            rnd = new Random(seed);
            
        }

        /** build buffer */
	private byte[] createBatch(long timestamp, int numberOfNonces, long seed, int numberOfMessages, int totalMessagesSize,
			boolean useSignatures, byte[][] messages, byte[][] signatures, ServerViewController controller) {
		int size = 20 + //timestamp 8, nonces 4, nummessages 4
				(numberOfNonces > 0 ? 8 : 0) + //seed if needed
				(numberOfMessages*(4+(useSignatures?TOMUtil.getSignatureSize(controller):0)))+ // msglength + signature for each msg
				totalMessagesSize; //size of all msges

		ByteBuffer  proposalBuffer = ByteBuffer.allocate(size);

		proposalBuffer.putLong(timestamp);

		proposalBuffer.putInt(numberOfNonces);

		if(numberOfNonces>0){
			proposalBuffer.putLong(seed);
		}

		proposalBuffer.putInt(numberOfMessages);

		for (int i = 0; i < numberOfMessages; i++) {
			putMessage(proposalBuffer,messages[i], false, signatures[i]);
		}

		return proposalBuffer.array();
	}
          
	private void putMessage(ByteBuffer proposalBuffer, byte[] message, boolean isHash, byte[] signature) {
		proposalBuffer.putInt(isHash?0:message.length);
		proposalBuffer.put(message);

		if(signature != null) {
			proposalBuffer.put(signature);
		}
	}

	public byte[] makeBatch(List<TOMMessage> msgs, int numNounces, long timestamp, ServerViewController controller) {

		int numMsgs = msgs.size();
		int totalMessageSize = 0; //total size of the messages being batched

		byte[][] messages = new byte[numMsgs][]; //bytes of the message (or its hash)
		byte[][] signatures = new byte[numMsgs][]; //bytes of the message (or its hash)

		// Fill the array of bytes for the messages/signatures being batched
		int i = 0;
                
		for (TOMMessage msg : msgs) {
			//TOMMessage msg = msgs.next();
			//Logger.println("(TOMLayer.run) adding req " + msg + " to PROPOSE");
			messages[i] = msg.serializedMessage;
			signatures[i] = msg.serializedMessageSignature;

			totalMessageSize += messages[i].length;
			i++;
		}

		// return the batch
		return createBatch(timestamp, numNounces,rnd.nextLong(), numMsgs, totalMessageSize,
				controller.getStaticConf().getUseSignatures() == 1, messages, signatures, controller);

	}
	public byte[] makeBatch(List<TOMMessage> msgs, int numNounces, long seed, long timestamp, ServerViewController controller) {

		int numMsgs = msgs.size();
		int totalMessageSize = 0; //total size of the messages being batched

		byte[][] messages = new byte[numMsgs][]; //bytes of the message (or its hash)
		byte[][] signatures = new byte[numMsgs][]; //bytes of the message (or its hash)

		// Fill the array of bytes for the messages/signatures being batched
		int i = 0;
                
		for (TOMMessage msg : msgs) {
			//TOMMessage msg = msgs.next();
			//Logger.println("(TOMLayer.run) adding req " + msg + " to PROPOSE");
			messages[i] = msg.serializedMessage;
			signatures[i] = msg.serializedMessageSignature;

			totalMessageSize += messages[i].length;
			i++;
		}

		// return the batch
		return createBatch(timestamp, numNounces,seed, numMsgs, totalMessageSize,
				controller.getStaticConf().getUseSignatures() == 1, messages, signatures, controller);

	}
}
