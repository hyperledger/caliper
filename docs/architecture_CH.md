---
layout: page
title:  "Architecture (CH)"
categories: docs
order: 3
---

## Architecture
![architecture](architecture.png)

### Adaptation Layer(适配层)

适配层用于将现有的区块链系统集成到Caliper框架中。 每个适配器使用相应的区块链本机SDK或RESTful API实现'Caliper Blockchain 北向接口'。 目前支持Hyperledger Fabric1.0和Sawtooth，而对以太坊和其他区块链系统的支持正在计划中。

### Interface&Core Layer（接口及核心层）
接口和核心层实现核心功能，并为上层应用提供北向接口。提供的四种北向接口如下：
* *Blockchain operating interfaces:* 包含诸如在后端区块链上部署智能合约，调用合约，从账本查询状态等操作.
* *Resource Monitor:* 包含启动/停止监视器和获取后端区块链系统资源消耗状态的操作，包括CPU，内存，网络IO等。现在提供两种监视器，一种是监视本地/远程docker容器，以及另一个是观看本地进程。未来将实现更多功能.
* *Performance Analyzer:* 包含读取预定义性能统计信息（包括TPS，延迟，成功率等）和打印基准测试结果的操作。在调用区块链北向接口时记录关键指标，例如创建事务的时间和提交时间，事务结果等。之后使用这些指标来生成统计信息.
* *Report Generator:* 生成HTML格式测试报告.
   
### Application Layer(应用层)

应用程序层包含针对典型区块链方案实施的测试。 每个测试都有一个配置文件，用于定义后端区块链网络和测试参数。 这些测试可以直接用于测试区块链系统的性能.

我们预制了一个默认的基准测试引擎以帮助开发人员理解框架并快速实施自己的测试。 后一部分将介绍如何使用基准引擎。 当然，开发人员可以直接在而不需要框架的情况下使用NBI来实现他们的测试.


## Benchmark Engine


![Benchmark Engine](test-framework.png)

### Configuration File
 
我们使用两种配置文件。 一个是基准配置文件，它定义基准测试参数，如负载量（workload）等。 另一个是区块链配置文件，它指定了有助于与待测试的系统（SUT）交互的必要信息.  

以下是基准配置文件示例:
```json
{
  "blockchain": {
    "type": "fabric",
    "config": "./fabric.json"
  },
  "command" : {
    "start": "docker-compose -f ../../network/fabric/simplenetwork/docker-compose.yaml up -d",
    "end" : "docker-compose -f ../../network/fabric/simplenetwork/docker-compose.yaml down;docker rm $(docker ps -aq)"
  },
  "test": {
    "name": "simple",
    "description" : "This is an example benchmark for caliper",
    "clients": {
      "type": "local",
      "number": 5
    },
    "rounds": [{
        "label" : "open",
        "txNumber" : [5000, 5000, 5000],
        "rateControl" : [{"type": "fixed-rate", "opts": {"tps" : 100}}, {"type": "fixed-rate", "opts": {"tps" : 200}}, {"type": "fixed-rate", "opts": {"tps" : 300}}],
        "arguments": {  "money": 10000 },
        "callback" : "benchmark/simple/open.js"
      },
      {
        "label" : "query",
        "txNumber" : [5000, 5000],
        "rateControl" : [{"type": "fixed-rate", "opts": {"tps" : 300}}, {"type": "fixed-rate", "opts": {"tps" : 400}}],
        "callback" : "benchmark/simple/query.js"
      }]
  },
  "monitor": {
    "type": ["docker", "process"],
    "docker":{
      "name": ["peer0.org1.example.com", "http://192.168.1.100:2375/orderer.example.com"]
    },
    "process": [
      {
        "command" : "node",
        "arguments" : "local-client.js",
        "multiOutput" : "avg"
      }
    ],
    "interval": 1
  }
}
```
* **test** - :定义测试的元数据，以及具有指定工作负载的多轮测试
  * **name&description** : 可读的名称和基准的描述，被报告生成器使用并在测试报告中显示.
  * **clients** : 定义客户端类型以及相关参数，'type'属性必须是'local'或'zookeeper'
    * local: 在这种情况下，本地进程将被分叉并充当区块链客户端。 分叉客户端的数量应该由'number'属性定义.
    * zookeeper: 在这种情况下，客户端可以位于不同的机器上，并通过zookeeper从master获取任务。 应定义Zookeeper服务器地址以及由zookeeper客户端本地启动的模拟区块链客户端的数量。 定义zookeeper配置的示例如下:
      ```
      "type": "zookeeper",
      "zoo" : {
        "server": "10.229.42.159:2181",
        "clientsPerHost": 5
      }
      ```
  * **label** : 对测试进行提示。例如，你可以使用事务名称作为标签名称来告知主要用于测试性能的事务。 该值还可用作blockchain.getContext（）中的Context名。 又例如，开发人员可能希望测试不同Fabric通道的性能，在这种情况下，具有不同标签的测试可以绑定到不同的Fabric通道.  
  * **txMode** : 指定事务的生成模式。支持两种测试事务配置。一个被命名为`real-time` 这意味着事务将实时生成并立即发送到后端系统。这是Caliper的默认测试模式. 若未设置txMode，Caliper将在 `real-time` mode下运行. Th另一种模式是文件相关的测试模式，这意味着客户端生成的事务将被缓冲，并在发送到后端系统之前保存到文件中。文件模式有两个子类，分别命名为 `file-read` 和 `file-write`. 在 `file-read` mode下, Caliper将读取事务文件以进行测试。在文件写入模式下，将根据txNumber，tps，duration等配置设置生成所有事务，然后将这些事务发送到后端系统以完成测试。生成的事务文件保存在当前目录中。如果该目录下的事务文件与当前基准配置文件的参数（如txNumber和客户端编号）不匹配，则Caliper将生成新的事务文件。事务文件可以在docker模式下重复使用，而在自己部署的网络中则不可重复使用。值得注意的是，文件相关的txMode目前仅支持固定发送速率（即速率控制的类型应为固定速率）和fabric（1.0 / 1.1 / 1.2）. S由于Fabric客户端不支持版本1.0,1.1和1.2中的函数sendSignedTransaction, 有必要将文件 `node_modules/fabric-client/lib/Channel.js/ChannelSignedTransaction.js` 重命名为  `node_modules/fabric-client/lib/Channel.js` . 与文件相关的txMode标记了在fabric客户端将事务发送到订购者节点之前的转换创建时间. 文件txMode和`real-time`txMode之间的创建时间存在明显差异，而后者将创建时间标记为相应适配器处理事务的时间。
  * **txNumber** : 定义一个子轮数组，每个轮次具有不同的事务编号。 例如, [5000,400] 表示在第一轮中将生成总共5000个交易，在第二轮中将生成400个交易.
  * **txDuration** : 定义具有基于时间的测试运行的子轮数组. 例如 [150,400] 表示将进行两次运行，第一次测试将运行150秒，第二次运行将运行400秒。 如果除txNumber外还有指定，则txDuration选项优先.
  * **rateControl** : 定义在基准测试子轮次期间使用的自定义速率控制数组。 如果未指定，则默认为“固定费率”，将以设定的1 TPS速率推动基准测试。 如果已定义，则速率控制机制必须存在，并且可以提供用于控制消息发送速率的选项，或指定消息速率配置文件. 在每一轮测试中,  **txNumber** 或 **txDuration** 在 **rateControl** 中具有相应的速率控制项. 有关可用速率控制器以及如何实现自定义速率控制器的更多信息，请参阅 [速率控制部分]({{ site.baseurl }}{% link docs/Rate_Controllers.md %})
  * **trim** : 对客户端结果执行修剪（trim）操作，以消除测试报告中包含的warm-up和cool-down阶段. 如果指定，修剪选项将遵循每轮的measurement. 例如, 如果 `txNumber` 在测试模式中，值30表示每个客户端最初和最后的30个交易结果将被修剪掉i、; 如果 `txDuration` 被使用, 则从每个客户端产生的前30秒和后30秒的结果将会被忽略掉.
  * **arguments** : 用户自定义参数，将会被直接传递到用户定义的测试模组中。
  * **callback** : 指明用户在该轮测试中定义的模组. 请参阅[User defined test module]({{ site.baseurl }}{% link docs/Writing_Benchmarks.md %}) 获取更多信息.
* **monitor** - 定义资源监视器和受监视对象的类型，以及监视的时间间隔.
  * docker : docker monitor用于监视本地或远程主机上的指定docker容器。 Docker Remote API用于检索远程容器的统计信息。保留的容器名称“all”表示将监视主机上的所有容器。在上面的示例中，监视器将每秒检索两个容器的统计信息，一个是名为“peer0.org1.example.com”的本地容器，另一个是位于主机'192.168上的名为“orderer.example.com”的远程容器。 .1.100'，2375是该主机上Docker的侦听端口.
  * process : 进程监视器用于监视指定的本地进程。例如，用户可以使用此监视器来监视模拟区块链客户端的资源消耗。 'command'和'arguments'属性用于指定进程。如果找到多个进程，'multiOutput'属性用于定义输出的含义。 'avg'表示输出是这些过程的平均资源消耗，而'sum'表示输出是总和消耗.  
  * others : 待后续补充.

以下是一个区块链配置文件的示例：
```json
{
  "caliper": {
    "blockchain": "fabric",
    "command" : {
      "start": "docker-compose -f network/fabric-v1.1/2org1peergoleveldb/docker-compose.yaml up -d;sleep 3s",
      "end" : "docker-compose -f network/fabric-v1.1/2org1peergoleveldb/docker-compose.yaml down;docker rm $(docker ps -aq);docker rmi $(docker images dev* -q)"
    }
  },
  "fabric": {
    "cryptodir": "network/fabric-v1.1/config/crypto-config",
    "network": {
      "orderer": {
        "url": "grpc://localhost:7050",
        "mspid": "OrdererMSP",
        "msp": "network/fabric-v1.1/config/crypto-config/ordererOrganizations/example.com/msp/",
        "server-hostname": "orderer.example.com",
        "tls_cacerts": "network/fabric-v1.1/config/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt"
      },
      "org1": {
        "name": "peerOrg1",
        "mspid": "Org1MSP",
        "msp": "network/fabric-v1.1/config/crypto-config/peerOrganizations/org1.example.com/msp/",
        "ca": {
          "url": "http://localhost:7054",
          "name": "ca-org1"
        },
        "peer1": {
          "requests": "grpc://localhost:7051",
          "events": "grpc://localhost:7053",
          "server-hostname": "peer0.org1.example.com",
          "tls_cacerts": "network/fabric-v1.1/config/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
        }
      },
      "org2": {
        "name": "peerOrg2",
        "mspid": "Org2MSP",
        "msp": "network/fabric-v1.1/config/crypto-config/peerOrganizations/org2.example.com/msp/",
        "ca": {
          "url": "http://localhost:8054",
          "name": "ca-org2"
        },
        "peer1": {
          "requests": "grpc://localhost:8051",
          "events": "grpc://localhost:8053",
          "server-hostname": "peer0.org2.example.com",
          "tls_cacerts": "network/fabric-v1.1/config/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"
        }
      }
    },
    "channel": [
      {
        "name": "mychannel",
        "deployed": false,
        "config": "network/fabric-v1.1/config/mychannel.tx",
        "organizations": ["org1", "org2"]
      }
    ],
    "chaincodes": [
      {"id": "simple", "path": "contract/fabric/simple/go", "language":"golang", "version": "v0", "channel": "mychannel"},
    ],
    "endorsement-policy": {
      "identities": [
        {
          "role": {
            "name": "member",
            "mspId": "Org1MSP"
          }
        },
        {
          "role": {
            "name": "member",
            "mspId": "Org2MSP"
          }
        },
        {
          "role": {
            "name": "admin",
            "mspId": "Org1MSP"
          }
        }
      ],
      "policy": { "2-of": [{"signed-by": 0}, {"signed-by": 1}]}
    },
    "context": {
      "open": "mychannel", 
      "query": "mychannel"
    }
  },
  "info" : {
    "Version": "1.1.0",
    "Size": "2 Orgs with 1 Peer",
    "Orderer": "Solo",
    "Distribution": "Single Host"
  }
}
```
* **caliper** - 定义caliper使用的参数:
  * **blockchain** - 定义后端区块链系统的类型和适配器的配置文件，以识别要与之交互的后端区块链网络. 参阅 [*Fabric Config*]({{ site.baseurl }}{% link docs/Fabric_Configuration.md %}) 了解更多信息.
  * **command** - 定义将在测试的特定阶段调用的命令
    * **start** : 在测试开始时调用
    * **end** : 完成所有测试后调用
* **fabric** - 定义将由后端区块链系统使用的网络相关配置。 这里的名称是fabric，但它可以更改为caliper支持的DLT中的任何一个，例如Composer，Sawtooth，Iroha和Burrow.
### Master

实现默认测试流程，其中包含三个阶段：

* 准备阶段：在此阶段，主服务器使用区块链配置文件创建并初始化内部区块链对象，按照配置中指定的信息部署智能合约，并启动监控对象以监控后端区块链系统的资源消耗.

* 测试阶段: 在此阶段，主服务器启动循环以根据基准配置文件执行测试。 将根据定义的workload生成任务并将其分配给客户端。 该阶段将存储客户端返回的性能统计信息以供以后分析.

* 报告阶段: 分析每个测试轮次的所有客户的统计数据，并自动生成HTML格式报告。 报告示例如下:


<img src="{{ site.baseurl }}/assets/img/report.png" alt="report example">

### Clients

#### Local Clients

在此模式下，主服务器使用Node.js集群模块来分叉多个本地客户端（子进程）来执行实际的测试工作。 由于Node.js本质上是单线程的，因此本地集群可用于提高客户在多核机器上的性能.

总工作负载被划分并平均分配给子进程。 子进程充当区块链客户端，具有临时生成的context以与后端区块链系统交互。 context通常包含客户端的标识和加密材料，并将在测试任务完成时发布.

* 对于Hyperledger Fabric，context也绑定到特定channel，该关系在Fabric配置文件中定义.

客户端调用一个测试模块，该模块实现用户定义的测试逻辑。稍后将解释该模块.

本地客户端仅在第一轮测试开始时启动一次，并在完成所有测试后销毁.

#### Zookeeper Clients

在此模式下，将独立启动多个zookeeper客户端。 zookeeper客户端将在启动后注册并监视测试任务。 测试后，将创建包含性能统计结果的znode

如上所述，zookeeper客户端还会分叉多个子进程（本地客户端）来执行实际的测试工作.

有关更多详细信息，请参阅 [Zookeper Client Design]({{ site.baseurl }}{% link docs/Zookeeper_Client_Design.md %}).

### User Defined Test Module

该模块实现实际生成和提交事务的功能。通过这种方式，开发人员可以实现自己的测试逻辑并将其与基准引擎集成。
应该实现和导出三个函数，所有这些函数都应该返回一个Promise对象.  

* `init` - 将在每个测试轮次开始时由客户端调用给定的区块链对象和上下文，以及从基准配置文件中读取的用户定义的参数。应保存区块链对象和context供以后使用，其他初始化工作可在此处实现.
* `run` - 应使用Caliper的区块链API在此处生成和提交实际的事务。客户端将根据工作负载重复调用此函数。建议每次调用只提交一个事务，但这不是必须的。如果每次提交多个事务，则实际工作负载可能与配置的工作负载不同。该函数应以异步方式运行.
* `end` - 将在每轮测试结束时调用，任何清算工作都应在此处实施.
