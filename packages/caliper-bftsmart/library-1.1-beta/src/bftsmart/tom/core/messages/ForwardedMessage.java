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
package bftsmart.tom.core.messages;

import java.io.IOException;
import java.io.ObjectInput;
import java.io.ObjectOutput;

import bftsmart.communication.SystemMessage;
import bftsmart.tom.core.messages.TOMMessage;



/**
 * Message used to forward a client request to the current leader when the first
 * timeout for this request is triggered (see RequestTimer).
 *
 */
public final class ForwardedMessage extends SystemMessage {

    private TOMMessage request;

    public ForwardedMessage() {
    }

    public ForwardedMessage(int senderId, TOMMessage request) {
        super(senderId);
        this.request = request;
    }

    public TOMMessage getRequest() {
        return request;
    }

    @Override
    public void writeExternal(ObjectOutput out) throws IOException {
        super.writeExternal(out);

        out.writeInt(request.serializedMessage.length);
        out.write(request.serializedMessage);
        out.writeBoolean(request.signed);

        if (request.signed) {
            out.writeInt(request.serializedMessageSignature.length);
            out.write(request.serializedMessageSignature);
        }
    }

    @Override
    public void readExternal(ObjectInput in) throws IOException, ClassNotFoundException {
        super.readExternal(in);

        byte[] serReq = new byte[in.readInt()];
        in.readFully(serReq);

        request = TOMMessage.bytesToMessage(serReq);
        request.serializedMessage = serReq;

        boolean signed = in.readBoolean();

        if (signed) {

            byte[] serReqSign = new byte[in.readInt()];
            in.readFully(serReqSign);
            request.serializedMessageSignature = serReqSign;

        }
    }

}
