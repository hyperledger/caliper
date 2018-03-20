// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var ordering_pb = require('./ordering_pb.js');
var block_pb = require('./block_pb.js');
var google_protobuf_empty_pb = require('google-protobuf/google/protobuf/empty_pb.js');

function serialize_google_protobuf_Empty(arg) {
  if (!(arg instanceof google_protobuf_empty_pb.Empty)) {
    throw new Error('Expected argument of type google.protobuf.Empty');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_google_protobuf_Empty(buffer_arg) {
  return google_protobuf_empty_pb.Empty.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iroha_ordering_proto_Proposal(arg) {
  if (!(arg instanceof ordering_pb.Proposal)) {
    throw new Error('Expected argument of type iroha.ordering.proto.Proposal');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_iroha_ordering_proto_Proposal(buffer_arg) {
  return ordering_pb.Proposal.deserializeBinary(new Uint8Array(buffer_arg));
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


var OrderingGateTransportGrpcService = exports.OrderingGateTransportGrpcService = {
  onProposal: {
    path: '/iroha.ordering.proto.OrderingGateTransportGrpc/onProposal',
    requestStream: false,
    responseStream: false,
    requestType: ordering_pb.Proposal,
    responseType: google_protobuf_empty_pb.Empty,
    requestSerialize: serialize_iroha_ordering_proto_Proposal,
    requestDeserialize: deserialize_iroha_ordering_proto_Proposal,
    responseSerialize: serialize_google_protobuf_Empty,
    responseDeserialize: deserialize_google_protobuf_Empty,
  },
};

exports.OrderingGateTransportGrpcClient = grpc.makeGenericClientConstructor(OrderingGateTransportGrpcService);
var OrderingServiceTransportGrpcService = exports.OrderingServiceTransportGrpcService = {
  onTransaction: {
    path: '/iroha.ordering.proto.OrderingServiceTransportGrpc/onTransaction',
    requestStream: false,
    responseStream: false,
    requestType: block_pb.Transaction,
    responseType: google_protobuf_empty_pb.Empty,
    requestSerialize: serialize_iroha_protocol_Transaction,
    requestDeserialize: deserialize_iroha_protocol_Transaction,
    responseSerialize: serialize_google_protobuf_Empty,
    responseDeserialize: deserialize_google_protobuf_Empty,
  },
};

exports.OrderingServiceTransportGrpcClient = grpc.makeGenericClientConstructor(OrderingServiceTransportGrpcService);
