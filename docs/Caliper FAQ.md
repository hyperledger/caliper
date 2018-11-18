##  <center>Caliper FAQ 文档</center>
###  一、 Closed issues
1. <font color="#FF0000">Q:</font> cannot read property ‘getConnectivityState’  
<font color="#FF0000">A:</font> first executive the command `npm ls gRPC` to check wether the gRPC version is 1.10.1, if not, please executive `npm install grpc@1.10.1` at the root directory of caliper.  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#206/155/91/56  <font size="5">*********************************************************************</font><br />  
2. <font color="#FF0000">Q:</font> instantiate chaincode error: sendPeersProposal –Promise is rejected: chaincode error (status: 500 message: is not a valid endorsement system chaincode )  
<font color="#FF0000">A:</font> this is a sdk compatibility problem. Check the grpc and fabric version，if the version is wrong, please executive `npm install grpc@1.10.1 fabric-ca-client@1.1.0 fabric-client@1.1.0` to make sure you install the right version.  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#149/175/169/118  <font size="5">*********************************************************************</font><br />  
3. <font color="#FF0000">Q:</font> sendPeersProposal – Promise is rejected: Error: unavailable: connect failed at new createStatusError, SSL_ERROR_SSL: handshake failed with fatal error SSL_ERROR_SSL, SSL routines: ssl3_get_server_certificate: certificate verify failed  
<font color="#FF0000">A:</font> make usre grpc request ports is right, json config same to yaml config.  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#102  <font size="5">*********************************************************************</font><br />  
4. <font color="#FF0000">Q:</font> network 2org1peer_default not found  
<font color="#FF0000">A:</font> modify `CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=2-org-1-peer_default` at the docker-composer.yaml file.  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#145  <font size="5">*********************************************************************</font><br />

5. <font color="#FF0000">Q:</font> failed to read monitoring data  
<font color="#FF0000">A:</font> there is a lack of systeminformation and dockerode package. Please executive `npm install ststeminformation dockerode mustache ps-node pidusage.`  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#4  <font size="5">*********************************************************************</font><br />  
6. <font color="#FF0000">Q:</font> failed to run composer test: ‘SIGSEGV: segmentation violation’  
<font color="#FF0000">A:</font> add the environment variable `GODEBUG=netdns=cgo` to the containers at the docker-compose file   
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#15  <font size="5">*********************************************************************</font><br />  
7. <font color="#FF0000">Q:</font> cannot find module ’./api.js’  
<font color="#FF0000">A:</font> install 1.1 libs，`npm install fabric-ca-client@1.1.0 fabric-client@1.1.0`  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#65  <font size="5">*********************************************************************</font><br />  
8. <font color="#FF0000">Q:</font> instantiate chaincode error sendProposal – timeout after: 120000, sendPeersProposal - Promise is rejected: Error: REQUEST_TIMEOUT  
<font color="#FF0000">A:</font> increase timeout value，at the /src/fabric/e2eUtils.js line214 : `client.setConfigSetting(‘request-timeout’, 120000)`;  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue #137  <font size="5">*********************************************************************</font><br />  
9. <font color="#FF0000">Q:</font> sendPeersProposal – Promise is rejected: Error: unavailable: connect failed at new createStatusError, TypeSError: cannot read property ‘stack’ of undefined.  
<font color="#FF0000">A:</font> One solution:   
a. ker-compose -f network/fabric-v11/2-org-2-peer/docker-compose.yaml up -d in another shell  
b.	ove "start": "docker-compose -f network/fabric-v11/2-org-2-peer/docker-compose.yaml up -d", from config.json  
c.	e benchmark/simple/main.js  
another solution:   
user the root user to executive the command.  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#112  <font size="5">*********************************************************************</font><br />  
10. <font color="#FF0000">Q:</font> sendBroadcast – reject with BAD_REQUEST failed to create channels, cannot read property ‘getUpdates’ of undefined.  
<font color="#FF0000">A:</font> the problem is related to docker，please executive `docker stop $(docker ps -aq)` and `docker rm $(docker ps -aq)`  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#109/81/111  <font size="5">*********************************************************************</font><br />  
11. <font color="#FF0000">Q:</font> handshake failed with fatal error SSL_ERROR_SSL: error ssl routines ssl3_get_record: wrong version number.  
<font color="#FF0000">A:</font> enable the TLS of the fabric, `ORDERER_GENERAL_TLS_ENABLED=true `   
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> <https://chat.hyperledger.org/channel/caliper?msg=Hpx6wWfxvGKNR5Q5d>  
<font size="5">*********************************************************************</font><br />  
12. <font color="#FF0000">Q:</font> npm ERR! grpc@1.10.1 install: node-pre-gyp install –fallback-to-build –library= static_library npm ERR! Failed at the frpc@1.10.1 install script. Nmp ERR! This is probably not a problem with npm. There is likely additional logging output above.  
<font color="#FF0000">A:</font> please first insatll the node-gyp, if is ubuntu, executive `sudo apt-get install node-gyp`  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue #80  <font size="5">*********************************************************************</font><br />  
13. <font color="#FF0000">Q:</font> npm ERR! pkcs11js@1.0.15 install: node-gyp rebuild, npm ERR! Failed at the pkcs11js@1.0.15 install script.  
<font color="#FF0000">A:</font> please first insatll the node-gyp, if is ubuntu, executive `sudo apt-get install node-gyp`  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#79  <font size="5">*********************************************************************</font><br />  
14. <font color="#FF0000">Q:</font>  syntaxError: unexpected token function  
<font color="#FF0000">A:</font> check the node version, the command is `node –v” or “nvm ls`，make sure it is node 8.x  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#73  <font size="5">*********************************************************************</font><br />  
15. <font color="#FF0000">Q:</font> is it possible to run caliper on windows 10 ?  
<font color="#FF0000">A:</font> it is possible if all dependencies can be installed successfully, but never tried it .  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#108  <font size="5">*********************************************************************</font><br />  
16. <font color="#FF0000">Q:</font> two network directories for fabric: network/fabric and network/fabric-v11.  
<font color="#FF0000">A:</font> The original caliper as well as simplenetwork only support fabric v1.0 at the beginning, and then composer team add a new folder to include files they needed and named as fabric-v11 to disginguish with the old folder.  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#88  <font size="5">*********************************************************************</font><br />  
17. <font color="#FF0000">Q:</font> “[Transaction Info] - Submitted: 15000 Succ: 268 Fail:14729 Unfinished:3”, timeout is too small, default value is used instead. Invoke chaincode failed, error: failed to get valid event notification.   
<font color="#FF0000">A:</font> The reason of high failures may be due to the configured transaction rate exceeding the processing capacity of fabric and caliper itself. You can check the cpu usage of peers or bench-clients (it should be printed after each test round) to see if it is too high. You can lower the tps value in 'config-fabric.json' and run the test again to find out the maximum performance your SUT can reach  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#9  <font size="5">*********************************************************************</font><br />  
18. <font color="#FF0000">Q:</font> How to benchmark a multi-hosts fabric network?  
<font color="#FF0000">A:</font> Using caliper is completely independent of setting up the blockchain backend, the convenience ‘command.start’ script simplifies setting up things in development time, but it is optional, you can connect to an already running remote fabric network by setting the appropriate endpoints in the network config that is passed to caliper.  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#181  <font size="5">*********************************************************************</font><br />  
19. <font color="#FF0000">Q:</font> Rate-control, unknown rate control type linear-rate, cannot understand the idea of rate-control function  
<font color="#FF0000">A:</font> Adjust the composite rate controller to the new environment semantics  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#8/142/123/106  <font size="5">*********************************************************************</font><br />  
20. <font color="#FF0000">Q:</font> Hard-coded MSPID  
<font color="#FF0000">A:</font> The bug has been resolved, the mspid and domain names are read from the configuration file now.  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#98  <font size="5">*********************************************************************</font><br />  
21. <font color="#FF0000">Q:</font>  Limit size of the temp demo files, because the size of the log file grows continuously and may become too large.  
<font color="#FF0000">A:</font> below is two solution.  
a.	Disable launching demo related functions by configuration or command argument.  
b.	Limit the max size of the log file, for example, limit the length of the ‘x-axis’ and contains the recent data.  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#120  <font size="5">*********************************************************************</font><br />  
22. <font color="#FF0000">Q:</font> Instantiate chaincode error: [client-utils.js]: sendPeersProposal – promise is rejectecd: error:2 unknown:error starting container: post http://unix.sock/containers/create?name=dev-peer0.org1.example.com-simple-v0: dial unix /host/var/run/docker.sock: connect: permission denied.  
<font color="#FF0000">A:</font> This seems to be a permission error on fabric side, reinstall docker, fix the problem.  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> <https://chat.hyperledger.org/channel/caliper?msg=FzE7SaSmN9pFyfh9m>  
<font size="5">*********************************************************************</font><br />  
23. <font color="#FF0000">Q:</font> When using the same setup (containers, genesis block,policies), the result of simple network and balance transfer network are different. Why? Not sure , but I have some thoughts:  
<font color="#FF0000">A:</font> please do the two step.  
a.	please check whether the configuration of peers and orderers in both networks are the same, such as loglevel, tls, etc.  
b.	Lower the sending rate. Now the sending rate is much higher than actual throughput, that may cause unsteady performance results.  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> <https://chat.hyperledger.org/channel/caliper?msg=NtpsQ7B7rmSEXHyc8>  
<font size="5">*********************************************************************</font><br />  
24. <font color="#FF0000">Q:</font> requestError: Error: connect econn refused 127.0.0.8008 at new requestError (node_modules /request-promise-core/lib/errors.js)  
<font color="#FF0000">A:</font> Please use docker-compose -f sawtooth /simplenetwork/sawtooth-simple.yaml, then try.  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font>  
<font size="5">*********************************************************************</font><br />  
25. <font color="#FF0000">Q:</font>  Invoke chaincode failed, error：failed to get valid event notification at channel. sendTransaction.then.then(/src/fabric/e2eUtils.js)  
<font color="#FF0000">A:</font> the machine cannot handle the > 100 TPS rates during the rounds when everything is running on the same host. Try lowering the TPS rates to 10 in config.json. in an environment with limited resources, the connections to the eventhubs might be abruptly closed, that is why you donnot get the notification.  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font>  
<font size="5">*********************************************************************</font><br />
###  二、 Open issues
####  1. Environment problems
1.1 <font color="#FF0000">Q:</font>  Composer.init() failed, error: failed to load connector module ‘composer-connector-undefined’ for connection type “undefined”. Run small bank benchmark use case with multiple validator docker containers, submit batches failed, requestError: error: socket hang up at new requestError (/node_modules/request-promise-core/lib/errors.js).  but if trigger the test without commands and starting docker containers it will work properly.  
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#64   

1.2 <font color="#FF0000">Q:</font>  Error :[orderer.js]: sendBroadcast-on error: unavailable: connect failed at node_modules/grpc/src/client.js.   
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#211     

1.3 <font color="#FF0000">Q:</font>  sendPeersProposal-promise is rejected: error unavailable: connect failed at node_modules/grpc/src/client.js    
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#205/204   

1.4 <font color="#FF0000">Q:</font>  instantiate chaincode sendProposal –timed out, sendPeersProposal – promise is rejected error: request_timeout at timeout._ontimieout(fabric-client/lib/peer.js)    
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#173   

1.5 <font color="#FF0000">Q:</font>  instantiate chaincode sendproposal – timed out , sendPeersProposal – promise is rejected: error: request_timeout at timeout._ontimeout(node_modules/fabric-client/lib/Peer.js)    
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#165  

1.6 <font color="#FF0000">Q:</font>  create mychannel fail at channel.reduce.then.then(/src/fabric/create-channel.js)     
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#152  

1.7 <font color="#FF0000">Q:</font>  execute transaction timeout expired while executing transaction at createStatusError ( node_modules /grpc/src/client.js) sendPeersProposal – promise is rejected error chaincode error     
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#143 

1.8 <font color="#FF0000">Q:</font>  create mychannel sendbroadcast on error unavailable at createstatusError (node_modules/fabric-client/node_modules/grpc/src/client.js)    
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#93  

1.9 <font color="#FF0000">Q:</font>  SyntaxError: Unexpected end of JSON input &ERR_ipc_channel_closed    
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#168  

1.10 <font color="#FF0000">Q:</font> No_node: exception:no_node at connectionManager.onsoucketdata(/node_modules.node-zookeeper-client/lib/connectionManager.js)    
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#201  

1.11 <font color="#FF0000">Q:</font>  Cannot specify config file in ‘npm test’ command while running caliper.    
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#174  

1.12 <font color="#FF0000">Q:</font>  ssl_transport_security.cc handshake failed with fatal error SSL_error_ssl     
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#105 

1.13 <font color="#FF0000">Q:</font>  TLS problem      
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#163

1.14 <font color="#FF0000">Q:</font>  ssl_transport_security.cc handshake fad wileith fatal error SSL_error_ssl     
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#153 

1.15 <font color="#FF0000">Q:</font>  create-channel.js TLS path error      
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#150 

1.16 <font color="#FF0000">Q:</font>  Failed to load connector module “composer-connector-undefined”     
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#64 

1.17 <font color="#FF0000">Q:</font>  client : error:could not find context’s information in config file at fabric.getContest (/src/fabric/fabric.js)      
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#104 
####  2. Bug
2.1 <font color="#FF0000">Q:</font>  Using percpu_usage.length can cause invalid cpu statistics      
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#114 
####  3.	Enhancement problems
3.1 <font color="#FF0000">Q:</font>  Add unified logging framework. The node sdk created a quite nice logging mechanism utilizing Winston, it could be reused in a license compatible way.      
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#207  

3.2 <font color="#FF0000">Q:</font>  Remove the tape tests from the benchmark flow      
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#193

3.3 <font color="#FF0000">Q:</font>  refactoring promise chains to async/await      
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#192

3.4 <font color="#FF0000">Q:</font>  support for fabric version above 1.1      
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#185

3.5 <font color="#FF0000">Q:</font>  can you support tronprotocol?       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#183

3.6 <font color="#FF0000">Q:</font>  monitor disk r/w rate       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#140

3.7 <font color="#FF0000">Q:</font>  Support multiple orderers       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#139

3.8 <font color="#FF0000">Q:</font>  extract hard-coded constants to configurable variables       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#138

3.9 <font color="#FF0000">Q:</font>  extract common structures into separate files        
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#119

3.10 <font color="#FF0000">Q:</font>  improve caliper to support long time testing        
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#110

3.11 <font color="#FF0000">Q:</font>  Docker network default name error        
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#198

3.12 <font color="#FF0000">Q:</font>  An enhancement suggestion and I would like to contribute to this project        
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#92

3.13 <font color="#FF0000">Q:</font>  Change the invoke timeout from a constant value to a variable value and make the value related to sleep time.      
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#131

3.14 <font color="#FF0000">Q:</font>  configing Fabric change block size , block timeout, the stateDB and consensus protocol.      
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#154
####  4.General
4.1 <font color="#FF0000">Q:</font>  How to change maxmessagecount?      
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#210

4.2 <font color="#FF0000">Q:</font>  Fabric query invocations depend on the block time parameter       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#199

4.3 <font color="#FF0000">Q:</font>  Support common connection profile feature of the new fabric node sdk      
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#37

4.4 <font color="#FF0000">Q:</font>  Help using kafka for the ordering node      
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#171

4.5 <font color="#FF0000">Q:</font>  how to test TPS in orderer with kafka       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#107

4.6 <font color="#FF0000">Q:</font>  Calculate the execution time in hyperledger caliper       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#172

4.7 <font color="#FF0000">Q:</font>  Implement proper chaincode query for fabric NBI       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#115

4.8 <font color="#FF0000">Q:</font>  How to disable TLS. Ssl_transport_security.cc      
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#195
####  5. Unclassified issues
5.1 <font color="#FF0000">Q:</font>  Fabric.installSmartContract() failed, error: failed to send install Proposal or receive valid       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#166  
<font color="#FF0000">label:</font>  1 or 2  

5.2 <font color="#FF0000">Q:</font>  [clinet-utils.js] sendPeersProposal – Promise is rejected: error:14 unavailable: TCP read failed at new createStatusError(node_modules/grpc/client.js), [orderer.js]: sendBroadcast – on error: 14 unavailable: TCP read failed at createStatusError(node_modules/grpc/src/client.js) failed, error: failed to send install Proposal or receive valid       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#127  
<font color="#FF0000">label:</font>  1 or 2  

5.3 <font color="#FF0000">Q:</font>  Error undefined symbol: SSL_library_init while running simple test with hyperledger caliper failed, error: failed to send install Proposal or receive valid       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#70  
<font color="#FF0000">label:</font>  1 or 2  

5.4 <font color="#FF0000">Q:</font>  Handshake failed with fatal error ssl_error_SSL when simple test for fabric error ssl routines ssl3_get_server_certificate:certificate verify failed. [orderer.js] sendbroadcast – on error : unavailable       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#27  
<font color="#FF0000">label:</font>  1 or 2  

5.5 <font color="#FF0000">Q:</font>  Error: client encountered unexpected error at childProcess.<anonymous> (src/comm/client/client-util.js)       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> <https://chat.hyperledger.org/channel/caliper?msg=EcZMeMEqRsTpwKoPW>  
<font color="#FF0000">label:</font>  1 or 2  

5.6 <font color="#FF0000">Q:</font>  Sawtooth: batchbuildFactory – custom batch builders       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#189  
<font color="#FF0000">label:</font>  1 or 2  

5.7 <font color="#FF0000">Q:</font>  Error in register Tx event in fabric sdk nodejs        
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#141  
<font color="#FF0000">label:</font>  1 or 2  

5.8 <font color="#FF0000">Q:</font>  error invoke stoped. Unfinished number never decrease       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#130  
<font color="#FF0000">label:</font>  1 or 2  

5.9 <font color="#FF0000">Q:</font>  Failed to invoke chaincode name: “basic-sample-network”,error: transaction returned with failure       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#101  
<font color="#FF0000">label:</font>  1 or 2  

5.10 <font color="#FF0000">Q:</font>  Cannot deploy non-sample composer networks       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#96  
<font color="#FF0000">label:</font>  1 or 2  

5.11 <font color="#FF0000">Q:</font>  Failed ‘open’testing, error: client encountered unexpected error at childprocess (/src/comm /client/client-util.js)       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#78  
<font color="#FF0000">label:</font>  1 or 2  

5.12 <font color="#FF0000">Q:</font>  Why debug make error, while run is ok?       
<font color="#FF0000">Corresponding Issue or questions in rocket channel:</font> Issue#39  
<font color="#FF0000">label:</font>  1 or 2  
