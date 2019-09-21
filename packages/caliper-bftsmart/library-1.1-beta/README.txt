BFT-SMaRt v1.1-beta
----------

This package contains the BFT-SMaRt source code (src/), binary file (bin/), libraries needed (lib/), documentation (doc/), running scripts (runscripts/) and configuration files (config/).
BFT-SMaRt requires the Java Runtime Environment version 1.7 or later.

---------------- Important notice ------------------------

This beta version of BFT-SMaRt offers the most stable execution via the class bftsmart.tom.server.defaultservices.DefaultRecoverable under Byzantine faults. Applications can also be implemented using 'bftsmart.tom.server.defaultservices.DefaultSingleRecoverable' and 'bftsmart.tom.server.defaultservices.durability.DurabilityCoordinator', but they are not as stable as 'DefaultRecoverable'. In future versions these classes will be properly tested and fixed.

------------- How to run BFT-SMaRt -----------------------

To run any demonstration you first need to configure BFT-SMaRt to define the protocol behavior and the location of each replica.

1.) The servers must be specified in the configuration file (see 'config/hosts.config'). An example:

#server id, address and port (the ids from 0 to n-1 are the service replicas) 
0 127.0.0.1 11000
1 127.0.0.1 11010
2 127.0.0.1 11020
3 127.0.0.1 11030

2.) The system configurations also have to be specified (see 'config/system.config'). Most of the parameters are self explanatory.

You can run the counter demonstration by executing the following commands, from within the main folder:

#Start the servers (4 replicas, to tolerate 1 fault)
./runscripts/smartrun.sh bftsmart.demo.counter.CounterServer 0
./runscripts/smartrun.sh bftsmart.demo.counter.CounterServer 1
./runscripts/smartrun.sh bftsmart.demo.counter.CounterServer 2
./runscripts/smartrun.sh bftsmart.demo.counter.CounterServer 3

Important tip: Never forget to delete the 'config/currentView' file after you modify 'config/hosts.config' or 'config/system.config'. If 'config/currentView' exists, BFT-SMaRt always fetches the group configuration from this file first. Otherwise, BFT-SMaRt fetches information from the other files and creates 'config/currentView' from scratch. Note that 'config/currentView' only stores information related to the group of replicas. You do not need to delete this file if, for instance, you want to enable the debugger or change the value of the request timeout.

#Start a client

./runscripts/smartrun.sh bftsmart.demo.counter.CounterClient 1001 <increment> [<number of operations>]

If <increment> equals 0 the request will be read-only. Default <number of operations> equals 1000.

You can use the './runscripts/runsmart.ba'" script in Windows, and the './runscripts/runsmart.sh' script in Linux.
When running the script in Linux it is necessary to set the permissions to execute the script with the command 'chmod +x ./runscripts/runsmart.sh'.

These scripts can easily be adapted to execute other demos, such as:

- Random. You can run it by using the 'RandomServer' and 'RandomClient' classes located in the package 'bftsmart.demo.random'.
- BFTMap. A Table of hash maps where tables can be created and key value pair added to it.
  The server is 'bftmap.demo.bftmap.BFTMapServer' and the clients are 'BFTMapClient' for incremental inserts or 'BFTMapInteractiveClient' for a command line client. Parameters to run the BFTMap demo are displayed when attempts to start the servers and clients are made without parameters.
- YCSB. You can run a Yahoo! Cloud Serving Benchmark with BFT-SMaRt by executing the './runscripts/startReplicaYCSB.sh' and './runscripts/ycsbClient.sh' scripts.
  
Important tip: always make sure that each client uses a unique ID. Otherwise, clients may not be able to complete their operations.

---------- State transfer protocol(s) --------------

BFT-SMaRt offers two state transfer protocols. The first is a basic protocol that can be used by extending the class 'bftsmart.tom.server.defaultservices.DefaultRecoverable' that logs requests into memory and periodically takes snapshots of the application state.

The second, more advanced protocol can be used by extending the class 'bftsmart.tom.server.defaultservices.durability.DurabilityCoordinator'. This protocol stores its logs to disk. To mitigate the latency of writing to disk, such tasks is done in batches and in parallel with the requests' execution. Additionally, the snapshots are taken at different points of the execution in different replicas.

Important tip: regardless of the chosen protocol, developers must avoid using Java API objects like 'HashSet' or 'HashMap', and use 'TreeSet' or 'TreeMap' instead. This is because serialization of Hash* objects is not deterministic, i.e, it generates different results for equal objects. This will lead to problems after more than 'f' replicas used the state transfer protocol to recover from failures.

----------- Group reconfiguration ------------------

The library also implements a reconfiguration protocol that can be used to add/remove replicas from the initial group. You can add/remove replicas on-the-fly by executing the following commands:

./runscripts/smartrun.sh bftsmart.reconfiguration.VMServices <smart id> <ip address> <port> (to add a replica to the group)
./runscripts/smartrun.sh bftsmart.reconfiguration.VMServices <smart id> (to remove a replica from the group)

Important tip: everytime you use the reconfiguration protocol, you must make sure that all replicas and the host where you invoke the above commands have the latest 'config/currentView' file. The current implementation of BFT-SMaRt does not provide any mechanism to distribute this file, so you will need to distribute it on your own (e.g., using the 'scp' command). You also need to make sure that any client that starts executing can read from the latest config/currentView file.

---------- BFT-SMaRt under crash faults ------------

You can run BFT-SMaRt in crash-faults only mode by setting the 'system.bft' parameter in the configuration file to 'false'. This mode requires less replicas to execute, but will not withstand full Byzantine behavior from compromised replicas.

------ Generating public/private key pairs ---------

If you need to generate public/private keys for more replicas or clients, you can use the following command:

./runscripts/smartrun.sh bftsmart.tom.util.RSAKeyPairGenerator <id> <key size>

Keys are stored in the 'config/keys' folder. The command above creates key pairs both for clients and replicas.

----- Additional information and publications ------

Finally, if you are interested in learning more about BFT-SMaRt, you can read:

- The technical report at the handler: http://hdl.handle.net/10455/6897
- The paper about its state machine protocol published in EDCC'12: http://ieeexplore.ieee.org/xpl/articleDetails.jsp?arnumber=6214759
- The paper about its advanced state transfer protocol published in Usenix'13: https://www.usenix.org/conference/atc13/technical-sessions/presentation/bessani
- The tool description published in DSN'14: http://ieeexplore.ieee.org/xpls/abs_all.jsp?arnumber=6903593&tag=1

Feel free to contact us if you have any questions!
