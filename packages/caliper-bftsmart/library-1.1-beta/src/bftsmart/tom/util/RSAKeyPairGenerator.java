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

import java.io.BufferedWriter;
import java.io.FileWriter;
import java.security.Key;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import org.apache.commons.codec.binary.Base64;

/**
 * Utility class used to generate a key pair for some process id on
 * config/keys/publickey<id> and config/keys/privatekey<id>
 *
 */
public class RSAKeyPairGenerator {
    
    /** Creates a new instance of KeyPairGenerator */
    public RSAKeyPairGenerator() {
    }

    /**
     * Generate the key pair for the process with id = <id> and put it on the
     * files config/keys/publickey<id> and config/keys/privatekey<id>
     *
     * @param id the id of the process to generate key
     * @throws Exception something goes wrong when writing the files
     */
    public void run(int id, int size) throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(size);
        KeyPair kp = keyGen.generateKeyPair();
        PublicKey puk = kp.getPublic();
        PrivateKey prk = kp.getPrivate();
        saveToFile(id,puk,prk);
    }
    
    private void saveToFile(int id, PublicKey puk, PrivateKey prk) throws Exception {
        String path = "config"+System.getProperty("file.separator")+"keys"+
                System.getProperty("file.separator");
        
        BufferedWriter w = new BufferedWriter(new FileWriter(path+"publickey"+id,false));
        w.write(getKeyAsString(puk));
        w.flush();
        w.close();
        
        w = new BufferedWriter(new FileWriter(path+"privatekey"+id,false));
        w.write(getKeyAsString(prk));
        w.flush();
        w.close();
    }
    
    
    private String getKeyAsString(Key key) {
        byte[] keyBytes = key.getEncoded();

        return Base64.encodeBase64String(keyBytes);
    }

    public static void main(String[] args){
        try{
            new RSAKeyPairGenerator().run(Integer.parseInt(args[0]), Integer.parseInt(args[1]));
        }catch(Exception e){
            System.err.println("Use: RSAKeyPairGenerator <id> <key size>");
        }
    }

}
