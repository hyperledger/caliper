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
import java.math.BigInteger;
import java.net.InetSocketAddress;
import java.util.Hashtable;
import java.util.Map;
import java.util.StringTokenizer;

public class Configuration {
    
    protected int processId;
    protected boolean channelsBlocking;
    protected BigInteger DH_P;
    protected BigInteger DH_G;
    protected int autoConnectLimit;
    protected Map<String, String> configs;
    protected HostsConfig hosts;
           
    private String hmacAlgorithm = "HmacSha1";
    private int hmacSize = 160;

    protected static String configHome = "";

   
    protected static String hostsFileName = "";


    public Configuration(int procId){
        processId = procId;
        init();
    }
    
    public Configuration(int processId, String configHomeParam){
        this.processId = processId;
        configHome = configHomeParam;
        init();
    }

     public Configuration(int processId, String configHomeParam, String hostsFileNameParam){
        this.processId = processId;
        configHome = configHomeParam;
        hostsFileName = hostsFileNameParam;
        init();
    }
    
    protected void init(){
        try{
            hosts = new HostsConfig(configHome, hostsFileName);
            
            loadConfig();
            
            String s = (String) configs.remove("system.autoconnect");
            if(s == null){
                autoConnectLimit = -1;
            }else{
                autoConnectLimit = Integer.parseInt(s);
            }

            s = (String) configs.remove("system.channels.blocking");
            if(s == null){
                channelsBlocking = false;
            }else{
                channelsBlocking = (s.equalsIgnoreCase("true"))?true:false;
            }
            
            s = (String) configs.remove("system.diffie-hellman.p");
            if (s == null) {
                String pHexString = "FFFFFFFF FFFFFFFF C90FDAA2 2168C234 C4C6628B 80DC1CD1"
                    + "29024E08 8A67CC74 020BBEA6 3B139B22 514A0879 8E3404DD"
                    + "EF9519B3 CD3A431B 302B0A6D F25F1437 4FE1356D 6D51C245"
                    + "E485B576 625E7EC6 F44C42E9 A637ED6B 0BFF5CB6 F406B7ED"
                    + "EE386BFB 5A899FA5 AE9F2411 7C4B1FE6 49286651 ECE65381"
                    + "FFFFFFFF FFFFFFFF";
                    DH_P = new BigInteger(pHexString.replaceAll(" ", ""), 16);
            } else {
                DH_P = new BigInteger(s,16);
            }
            s = (String) configs.remove("system.diffie-hellman.g");
            if (s == null) {
                DH_G = new BigInteger("2");
            } else {
                DH_G = new BigInteger(s);
            }
            
        }catch(Exception e){
            System.err.println("Wrong system.config file format.");
            e.printStackTrace(System.out);
        }
    }
     
    public final boolean isHostSetted(int id){
        if(hosts.getHost(id) == null){
            return false;
        }
        return true;
    }
    
    
    public final boolean useBlockingChannels(){
        return this.channelsBlocking;
    }
    
    public final int getAutoConnectLimit(){
        return this.autoConnectLimit;
    }
    
    public final BigInteger getDHP(){
        return DH_P;
    }

    public final BigInteger getDHG(){
        return DH_G;
    }
    
    public final String getHmacAlgorithm() {
        return hmacAlgorithm;
    }

    public final int getHmacSize() {
        return hmacSize;
    }

    public final String getProperty(String key){
        Object o = configs.get(key);
        if( o != null){
            return o.toString();
        }
        return null;
    }
    
    public final Map<String, String> getProperties(){
        return configs;
    }
    
    public final InetSocketAddress getRemoteAddress(int id){
        return hosts.getRemoteAddress(id);
    }
    

    public final InetSocketAddress getServerToServerRemoteAddress(int id){
        return hosts.getServerToServerRemoteAddress(id);
    }

    
    public final InetSocketAddress getLocalAddress(int id){
        return hosts.getLocalAddress(id);
    }
    
    public final String getHost(int id){
        return hosts.getHost(id);
    }
    
    public final int getPort(int id){
        return hosts.getPort(id);
    }
    
     public final int getServerToServerPort(int id){
        return hosts.getServerToServerPort(id);
    }
    
    
    public final int getProcessId(){
        return processId;
    }

    public final void setProcessId(int processId){
        this.processId = processId;
    }
    
  
    public final void addHostInfo(int id, String host, int port){
        this.hosts.add(id,host,port);
    }
    
    private void loadConfig(){
        configs = new Hashtable<String, String>();
        try{
            if(configHome == null || configHome.equals("")){
                configHome="config";
            }
            String sep = System.getProperty("file.separator");
            String path =  configHome+sep+"system.config";;
            FileReader fr = new FileReader(path);
            BufferedReader rd = new BufferedReader(fr);
            String line = null;
            while((line = rd.readLine()) != null){
                if(!line.startsWith("#")){
                    StringTokenizer str = new StringTokenizer(line,"=");
                    if(str.countTokens() > 1){
                        configs.put(str.nextToken().trim(),str.nextToken().trim());
                    }
                }
            }
            fr.close();
            rd.close();
        }catch(Exception e){
            e.printStackTrace(System.out);
        }
    }
}
