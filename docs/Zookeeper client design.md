![architecture](zk-arch.png)

The architecture is as shown in the figure. The concept of master, zookeeper client, as well as local client can be found in  [architecture](Architecture.md) document. 

Each zookeeper client creates three znodes under /caliper folder: 
* /caliper/clients/client_id, which uniquely identifies this zookeeper client
* /caliper/client_id_in, which contains sequential child znodes which represent messages sent to this zookeeper client.
* /caliper/client_id_out, which contains messages created by this zookeeper client

The master learns the availability of zookeeper clients by getting children in /caliper/clients, then it can assign tasks to these clients by creating child znodes under each client's "in" folder. It also watch all "out" folder to get responses.

If a new child is created in its "in" folder, the zookeeper client will get the notification, then it can read the data and handle the message accordingly. For example, if the message contains a testing task, the zookeeper client will launch multiple local clients to run the test according to the workload defined in the task.

The zookeeper structure described before is as below:

![structure](zk-structure.png)
 
The zookeeper client will try to remove znodes it creates when it is closed. Users can remove the caliper folder to clean up garbage manually.




