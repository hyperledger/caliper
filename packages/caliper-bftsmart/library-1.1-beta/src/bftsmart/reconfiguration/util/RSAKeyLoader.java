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
package bftsmart.reconfiguration.util;

import java.io.BufferedReader;
import java.io.FileReader;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.EncodedKeySpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import org.apache.commons.codec.binary.Base64;

/**
 * Used to load JCA public and private keys from conf/keys/publickey<id> and
 * conf/keys/privatekey<id>
 */
public class RSAKeyLoader {

	private String path;
        private int id;
	private PrivateKey priKey;
	
	/** Creates a new instance of RSAKeyLoader */
	public RSAKeyLoader(int id, String configHome) {
            
                this.id = id;
		if (configHome.equals("")) {
			path = "config" + System.getProperty("file.separator") + "keys" +
					System.getProperty("file.separator");
		} else {
			path = configHome + System.getProperty("file.separator") + "keys" +
					System.getProperty("file.separator");
		}
	}

	/**
	 * Loads the public key of some processes from configuration files
	 *
	 * @return the PublicKey loaded from config/keys/publickey<id>
	 * @throws Exception problems reading or parsing the key
	 */
	public PublicKey loadPublicKey(int id) throws Exception {
		BufferedReader r = new BufferedReader(new FileReader(path + "publickey" + id));
		String tmp = "";
		String key = "";
		while ((tmp = r.readLine()) != null) {
			key = key + tmp;
		}
		r.close();
		PublicKey ret = getPublicKeyFromString(key);
		return ret;
	}
        
	public PublicKey loadPublicKey() throws Exception {
		BufferedReader r = new BufferedReader(new FileReader(path + "publickey" + this.id));
		String tmp = "";
		String key = "";
		while ((tmp = r.readLine()) != null) {
			key = key + tmp;
		}
		r.close();
		PublicKey ret = getPublicKeyFromString(key);
		return ret;
	}

	/**
	 * Loads the private key of this process
	 *
	 * @return the PrivateKey loaded from config/keys/publickey<conf.getProcessId()>
	 * @throws Exception problems reading or parsing the key
	 */
	public PrivateKey loadPrivateKey() throws Exception {
		if (priKey == null) {
			BufferedReader r = new BufferedReader(
					new FileReader(path + "privatekey" + this.id));
			String tmp = "";
			String key = "";
			while ((tmp = r.readLine()) != null) {
				key = key + tmp;
			}
			r.close();
			priKey = getPrivateKeyFromString(key);
		}
		return priKey;
	}

	//utility methods for going from string to public/private key
	private PrivateKey getPrivateKeyFromString(String key) throws Exception {
		KeyFactory keyFactory = KeyFactory.getInstance("RSA");
		EncodedKeySpec privateKeySpec = new PKCS8EncodedKeySpec(Base64.decodeBase64(key));
		PrivateKey privateKey = keyFactory.generatePrivate(privateKeySpec);
		return privateKey;
	}

	private PublicKey getPublicKeyFromString(String key) throws Exception {
		KeyFactory keyFactory = KeyFactory.getInstance("RSA");
		EncodedKeySpec publicKeySpec = new X509EncodedKeySpec(Base64.decodeBase64(key));
		PublicKey publicKey = keyFactory.generatePublic(publicKeySpec);
		return publicKey;
	}
}
