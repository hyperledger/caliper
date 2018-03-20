// GENERATED CODE -- DO NOT EDIT!

// Original file comments:
//
// Copyright Soramitsu Co., Ltd. 2017 All Rights Reserved.
// http://soramitsu.co.jp
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//        http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
//
'use strict';
var grpc = require('grpc');
var loader_pb = require('./loader_pb.js');
var block_pb = require('./block_pb.js');

function serialize_iroha_network_proto_BlockRequest(arg) {
  if (!(arg instanceof loader_pb.BlockRequest)) {
    throw new Error('Expected argument of type iroha.network.proto.BlockRequest');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_iroha_network_proto_BlockRequest(buffer_arg) {
  return loader_pb.BlockRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iroha_network_proto_BlocksRequest(arg) {
  if (!(arg instanceof loader_pb.BlocksRequest)) {
    throw new Error('Expected argument of type iroha.network.proto.BlocksRequest');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_iroha_network_proto_BlocksRequest(buffer_arg) {
  return loader_pb.BlocksRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iroha_protocol_Block(arg) {
  if (!(arg instanceof block_pb.Block)) {
    throw new Error('Expected argument of type iroha.protocol.Block');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_iroha_protocol_Block(buffer_arg) {
  return block_pb.Block.deserializeBinary(new Uint8Array(buffer_arg));
}


var LoaderService = exports.LoaderService = {
  retrieveBlocks: {
    path: '/iroha.network.proto.Loader/retrieveBlocks',
    requestStream: false,
    responseStream: true,
    requestType: loader_pb.BlocksRequest,
    responseType: block_pb.Block,
    requestSerialize: serialize_iroha_network_proto_BlocksRequest,
    requestDeserialize: deserialize_iroha_network_proto_BlocksRequest,
    responseSerialize: serialize_iroha_protocol_Block,
    responseDeserialize: deserialize_iroha_protocol_Block,
  },
  retrieveBlock: {
    path: '/iroha.network.proto.Loader/retrieveBlock',
    requestStream: false,
    responseStream: false,
    requestType: loader_pb.BlockRequest,
    responseType: block_pb.Block,
    requestSerialize: serialize_iroha_network_proto_BlockRequest,
    requestDeserialize: deserialize_iroha_network_proto_BlockRequest,
    responseSerialize: serialize_iroha_protocol_Block,
    responseDeserialize: deserialize_iroha_protocol_Block,
  },
};

exports.LoaderClient = grpc.makeGenericClientConstructor(LoaderService);
