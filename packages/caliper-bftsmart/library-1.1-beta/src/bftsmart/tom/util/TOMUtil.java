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

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.SignatureException;
import java.util.Arrays;
import java.util.concurrent.locks.ReentrantLock;

import bftsmart.reconfiguration.ViewController;

public class TOMUtil {

    //private static final int BENCHMARK_PERIOD = 10000;

    //some message types
    public static final int RR_REQUEST = 0;
    public static final int RR_REPLY = 1;
    public static final int RR_DELIVERED = 2;
    public static final int STOP = 3;
    public static final int STOPDATA = 4;
    public static final int SYNC = 5;
    public static final int SM_REQUEST = 6;
    public static final int SM_REPLY = 7;
    public static final int SM_ASK_INITIAL = 11;
    public static final int SM_REPLY_INITIAL = 12;

    public static final int TRIGGER_LC_LOCALLY = 8;
    public static final int TRIGGER_SM_LOCALLY = 9;
    
    //the signature engine used in the system and the signatureSize
    private static Signature signatureEngine;
    private static int signatureSize = -1;

    //the message digest engine used in the system
    private static MessageDigest md = null;
           
    //lock to make signMessage and verifySignature reentrant
    private static ReentrantLock lock = new ReentrantLock();

    //private static Semaphore sem = new Semaphore(10, true);

    //private static Storage st = new Storage(BENCHMARK_PERIOD);
    //private static int count=0;
    public static int getSignatureSize(ViewController controller) {
        if (signatureSize > 0) {
            return signatureSize;
        }

        byte[] signature = signMessage(controller.getStaticConf().getRSAPrivateKey(),
                "a".getBytes());

        if (signature != null) {
            signatureSize = signature.length;
        }

        return signatureSize;
    }
    
    //******* EDUARDO BEGIN **************//
    public static byte[] getBytes(Object o) {
        ByteArrayOutputStream bOut = new ByteArrayOutputStream();
        ObjectOutputStream obOut = null;
        try {
            obOut = new ObjectOutputStream(bOut);
            obOut.writeObject(o);
            obOut.flush();
            bOut.flush();
            obOut.close();
            bOut.close();
        } catch (IOException ex) {
            ex.printStackTrace();
            return null;
        }

        return bOut.toByteArray();
    }

    public static Object getObject(byte[] b) {
        if (b == null)
            return null;

        ByteArrayInputStream bInp = new ByteArrayInputStream(b);
        try {
            ObjectInputStream obInp = new ObjectInputStream(bInp);
            Object ret = obInp.readObject();
            obInp.close();
            bInp.close();
            return ret;
        } catch (Exception ex) {
            ex.printStackTrace();
            return null;
        }
    }
    //******* EDUARDO END **************//

    /**
     * Sign a message.
     *
     * @param key the private key to be used to generate the signature
     * @param message the message to be signed
     * @return the signature
     */
    public static byte[] signMessage(PrivateKey key, byte[] message) {
        lock.lock();
        byte[] result = null;
        try {
            if (signatureEngine == null) {
                signatureEngine = Signature.getInstance("SHA1withRSA");
            }

            signatureEngine.initSign(key);

            signatureEngine.update(message);

            result = signatureEngine.sign();
        } catch (Exception e) {
            e.printStackTrace();
        }

        lock.unlock();
        return result;
    }

    /**
     * Verify the signature of a message.
     *
     * @param key the public key to be used to verify the signature
     * @param message the signed message
     * @param signature the signature to be verified
     * @return true if the signature is valid, false otherwise
     */
    public static boolean verifySignature(PublicKey key, byte[] message, byte[] signature) {
        lock.lock();
        boolean result = false;
        //long startTime = System.nanoTime();
        try {
            if (signatureEngine == null) {
                signatureEngine = Signature.getInstance("SHA1withRSA");
            }

            signatureEngine.initVerify(key);

            result = verifySignature(signatureEngine, message, signature);
            /*
            st.store(System.nanoTime()-startTime);
            //statistics about signature execution time
            count++;
            if (count%BENCHMARK_PERIOD==0){                
            System.out.println("#-- (TOMUtil) Signature verification benchmark:--");
            System.out.println("#Average time for " + BENCHMARK_PERIOD + " signature verifications (-10%) = " + st.getAverage(true) / 1000 + " us ");
            System.out.println("#Standard desviation for " + BENCHMARK_PERIOD + " signature verifications (-10%) = " + st.getDP(true) / 1000 + " us ");
            System.out.println("#Average time for " + BENCHMARK_PERIOD + " signature verifications (all samples) = " + st.getAverage(false) / 1000 + " us ");
            System.out.println("#Standard desviation for " + BENCHMARK_PERIOD + " signature verifications (all samples) = " + st.getDP(false) / 1000 + " us ");
            System.out.println("#Maximum time for " + BENCHMARK_PERIOD + " signature verifications (-10%) = " + st.getMax(true) / 1000 + " us ");
            System.out.println("#Maximum time for " + BENCHMARK_PERIOD + " signature verifications (all samples) = " + st.getMax(false) / 1000 + " us ");
            count = 0;
            st = new Storage(BENCHMARK_PERIOD);
            }
         */
        } catch (Exception e) {
            e.printStackTrace();
        }

        lock.unlock();
        return result;
    }

    /**
     * Verify the signature of a message.
     *
     * @param initializedSignatureEngine a signature engine already initialized
     *        for verification
     * @param message the signed message
     * @param signature the signature to be verified
     * @return true if the signature is valid, false otherwise
     */
    public static boolean verifySignature(Signature initializedSignatureEngine, byte[] message, byte[] signature) throws SignatureException {
        //TODO: limit the amount of parallelization we can do to save some cores for other tasks
        //maybe we can use a semaphore here initialized with the maximum number of parallel verifications:
        //sem.acquire()
        initializedSignatureEngine.update(message);
        return initializedSignatureEngine.verify(signature);
        //sem.release()
    }

    public static String byteArrayToString(byte[] b) {
        String s = "";
        for (int i = 0; i < b.length; i++) {
            s = s + b[i];
        }

        return s;
    //Logger.println(s);
    }

    public static boolean equalsHash(byte[] h1, byte[] h2) {
        return Arrays.equals(h2, h2);
    }

    public static final byte[] computeHash(byte[] data) {
        
        lock.lock();
        byte[] result = null;
        
        try {
            if (md == null) md = MessageDigest.getInstance("MD5");
            
        } catch (NoSuchAlgorithmException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        } // TODO: shouldn't it be SHA?
        
        result = md.digest(data);
        lock.unlock();
        return result;
    }
    
}
