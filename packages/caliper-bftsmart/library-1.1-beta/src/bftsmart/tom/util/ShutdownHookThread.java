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

import bftsmart.communication.ServerCommunicationSystem;
import bftsmart.consensus.Consensus;
import bftsmart.tom.core.ExecutionManager;
import bftsmart.consensus.Epoch;
import bftsmart.consensus.TimestampValuePair;
import bftsmart.consensus.roles.Acceptor;
import bftsmart.tom.core.TOMLayer;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * Print information about the replica when it is shutdown.
 *
 */
public class ShutdownHookThread extends Thread {

    private final TOMLayer tomLayer;
    private final MessageDigest md;

    public ShutdownHookThread(TOMLayer tomLayer) {

        this.tomLayer = tomLayer;
        this.md = this.tomLayer.md;
    }

    @Override
    public void run() {
        
        StringBuffer buffer = new StringBuffer();
        SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss.SSS");
        int lastCons = tomLayer.getLastExec();
        int currentCons = tomLayer.getInExec();
        Consensus c = null;
        Epoch e = null;

        buffer.append("\n---------- DEBUG INFO ----------\n");
        buffer.append("\nCurrent time: " + sdf.format(new Date()));
        buffer.append("\nCurrent leader: " + tomLayer.execManager.getCurrentLeader());
        buffer.append("\nCurrent regency: " + tomLayer.getSynchronizer().getLCManager().getLastReg());

        buffer.append("\n\nLast finished consensus: " + (lastCons == -1 ? "None" : lastCons));
        if(lastCons > -1) {
            
            c = tomLayer.execManager.getConsensus(lastCons);
            
            for (TimestampValuePair rv : c.getWriteSet()) {
                if  (rv.getValue() != null && rv.getValue().length > 0)
                    rv.setHashedValue(md.digest(rv.getValue()));
            }
            
            buffer.append("\n\n\t -- Consensus state: \n\n\t\tETS=" + c.getEts() + " \n\t\tWriteSet=["+ c.getWriteSet()
            + "] \n\t\t(VAL,TS)=["+c.getQuorumWrites() + "]");
            
            e = c.getLastEpoch();
            if(e != null){
                buffer.append("\n\n\t -- Epoch state: \n"+e.toString());
            }
        }
        buffer.append("\n\nConsensus in execution: " + (currentCons == -1 ? "None" : currentCons));
        
        c = null;
        e = null;
        if(currentCons > -1) {
            
            c = tomLayer.execManager.getConsensus(currentCons);
            
            for (TimestampValuePair rv : c.getWriteSet()) {
                if  (rv.getValue() != null && rv.getValue().length > 0)
                    rv.setHashedValue(md.digest(rv.getValue()));
            }
            
            buffer.append("\n\n\t -- Consensus state: \n\n\t\tETS=" + c.getEts() + " \n\t\tWriteSet=["+ c.getWriteSet()
            + "] \n\t\t(VAL,TS)=["+c.getQuorumWrites() + "]");
            
            e = c.getLastEpoch();
            if(e != null) {
                buffer.append("\n\n\t -- Epoch state: \n"+e.toString());
            }
        }

        buffer.append("\n\n---------- ---------- ----------\n");
        
        System.out.println(buffer);
    }
}
