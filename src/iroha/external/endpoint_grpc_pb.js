// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var endpoint_pb = require('./endpoint_pb.js');
var block_pb = require('./block_pb.js');
var queries_pb = require('./queries_pb.js');
var google_protobuf_empty_pb = require('google-protobuf/google/protobuf/empty_pb.js');
var responses_pb = require('./responses_pb.js');

function serialize_google_protobuf_Empty(arg) {
  if (!(arg instanceof google_protobuf_empty_pb.Empty)) {
    throw new Error('Expected argument of type google.protobuf.Empty');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_google_protobuf_Empty(buffer_arg) {
  return google_protobuf_empty_pb.Empty.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iroha_protocol_ApplyGenesisBlockResponse(arg) {
  if (!(arg instanceof endpoint_pb.ApplyGenesisBlockResponse)) {
    throw new Error('Expected argument of type iroha.protocol.ApplyGenesisBlockResponse');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_iroha_protocol_ApplyGenesisBlockResponse(buffer_arg) {
  return endpoint_pb.ApplyGenesisBlockResponse.deserializeBinary(new Uint8Array(buffer_arg));
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

function serialize_iroha_protocol_Query(arg) {
  if (!(arg instanceof queries_pb.Query)) {
    throw new Error('Expected argument of type iroha.protocol.Query');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_iroha_protocol_Query(buffer_arg) {
  return queries_pb.Query.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iroha_protocol_QueryResponse(arg) {
  if (!(arg instanceof responses_pb.QueryResponse)) {
    throw new Error('Expected argument of type iroha.protocol.QueryResponse');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_iroha_protocol_QueryResponse(buffer_arg) {
  return responses_pb.QueryResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iroha_protocol_ToriiResponse(arg) {
  if (!(arg instanceof endpoint_pb.ToriiResponse)) {
    throw new Error('Expected argument of type iroha.protocol.ToriiResponse');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_iroha_protocol_ToriiResponse(buffer_arg) {
  return endpoint_pb.ToriiResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iroha_protocol_Transaction(arg) {
  if (!(arg instanceof block_pb.Transaction)) {
    throw new Error('Expected argument of type iroha.protocol.Transaction');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_iroha_protocol_Transaction(buffer_arg) {
  return block_pb.Transaction.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iroha_protocol_TxStatusRequest(arg) {
  if (!(arg instanceof endpoint_pb.TxStatusRequest)) {
    throw new Error('Expected argument of type iroha.protocol.TxStatusRequest');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_iroha_protocol_TxStatusRequest(buffer_arg) {
  return endpoint_pb.TxStatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}


var CommandServiceService = exports.CommandServiceService = {
  torii: {
    path: '/iroha.protocol.CommandService/Torii',
    requestStream: false,
    responseStream: false,
    requestType: block_pb.Transaction,
    responseType: google_protobuf_empty_pb.Empty,
    requestSerialize: serialize_iroha_protocol_Transaction,
    requestDeserialize: deserialize_iroha_protocol_Transaction,
    responseSerialize: serialize_google_protobuf_Empty,
    responseDeserialize: deserialize_google_protobuf_Empty,
  },
  status: {
    path: '/iroha.protocol.CommandService/Status',
    requestStream: false,
    responseStream: false,
    requestType: endpoint_pb.TxStatusRequest,
    responseType: endpoint_pb.ToriiResponse,
    requestSerialize: serialize_iroha_protocol_TxStatusRequest,
    requestDeserialize: deserialize_iroha_protocol_TxStatusRequest,
    responseSerialize: serialize_iroha_protocol_ToriiResponse,
    responseDeserialize: deserialize_iroha_protocol_ToriiResponse,
  },
};

exports.CommandServiceClient = grpc.makeGenericClientConstructor(CommandServiceService);
var QueryServiceService = exports.QueryServiceService = {
  find: {
    path: '/iroha.protocol.QueryService/Find',
    requestStream: false,
    responseStream: false,
    requestType: queries_pb.Query,
    responseType: responses_pb.QueryResponse,
    requestSerialize: serialize_iroha_protocol_Query,
    requestDeserialize: deserialize_iroha_protocol_Query,
    responseSerialize: serialize_iroha_protocol_QueryResponse,
    responseDeserialize: deserialize_iroha_protocol_QueryResponse,
  },
};

exports.QueryServiceClient = grpc.makeGenericClientConstructor(QueryServiceService);
var GenesisBlockServiceService = exports.GenesisBlockServiceService = {
  sendGenesisBlock: {
    path: '/iroha.protocol.GenesisBlockService/SendGenesisBlock',
    requestStream: false,
    responseStream: false,
    requestType: block_pb.Block,
    responseType: endpoint_pb.ApplyGenesisBlockResponse,
    requestSerialize: serialize_iroha_protocol_Block,
    requestDeserialize: deserialize_iroha_protocol_Block,
    responseSerialize: serialize_iroha_protocol_ApplyGenesisBlockResponse,
    responseDeserialize: deserialize_iroha_protocol_ApplyGenesisBlockResponse,
  },
  sendAbortGenesisBlock: {
    path: '/iroha.protocol.GenesisBlockService/SendAbortGenesisBlock',
    requestStream: false,
    responseStream: false,
    requestType: block_pb.Block,
    responseType: google_protobuf_empty_pb.Empty,
    requestSerialize: serialize_iroha_protocol_Block,
    requestDeserialize: deserialize_iroha_protocol_Block,
    responseSerialize: serialize_google_protobuf_Empty,
    responseDeserialize: deserialize_google_protobuf_Empty,
  },
};

exports.GenesisBlockServiceClient = grpc.makeGenericClientConstructor(GenesisBlockServiceService);
