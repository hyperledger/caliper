// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var yac_pb = require('./yac_pb.js');
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

function serialize_iroha_consensus_yac_proto_Commit(arg) {
  if (!(arg instanceof yac_pb.Commit)) {
    throw new Error('Expected argument of type iroha.consensus.yac.proto.Commit');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_iroha_consensus_yac_proto_Commit(buffer_arg) {
  return yac_pb.Commit.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iroha_consensus_yac_proto_Reject(arg) {
  if (!(arg instanceof yac_pb.Reject)) {
    throw new Error('Expected argument of type iroha.consensus.yac.proto.Reject');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_iroha_consensus_yac_proto_Reject(buffer_arg) {
  return yac_pb.Reject.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iroha_consensus_yac_proto_Vote(arg) {
  if (!(arg instanceof yac_pb.Vote)) {
    throw new Error('Expected argument of type iroha.consensus.yac.proto.Vote');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_iroha_consensus_yac_proto_Vote(buffer_arg) {
  return yac_pb.Vote.deserializeBinary(new Uint8Array(buffer_arg));
}


var YacService = exports.YacService = {
  sendVote: {
    path: '/iroha.consensus.yac.proto.Yac/SendVote',
    requestStream: false,
    responseStream: false,
    requestType: yac_pb.Vote,
    responseType: google_protobuf_empty_pb.Empty,
    requestSerialize: serialize_iroha_consensus_yac_proto_Vote,
    requestDeserialize: deserialize_iroha_consensus_yac_proto_Vote,
    responseSerialize: serialize_google_protobuf_Empty,
    responseDeserialize: deserialize_google_protobuf_Empty,
  },
  sendCommit: {
    path: '/iroha.consensus.yac.proto.Yac/SendCommit',
    requestStream: false,
    responseStream: false,
    requestType: yac_pb.Commit,
    responseType: google_protobuf_empty_pb.Empty,
    requestSerialize: serialize_iroha_consensus_yac_proto_Commit,
    requestDeserialize: deserialize_iroha_consensus_yac_proto_Commit,
    responseSerialize: serialize_google_protobuf_Empty,
    responseDeserialize: deserialize_google_protobuf_Empty,
  },
  sendReject: {
    path: '/iroha.consensus.yac.proto.Yac/SendReject',
    requestStream: false,
    responseStream: false,
    requestType: yac_pb.Reject,
    responseType: google_protobuf_empty_pb.Empty,
    requestSerialize: serialize_iroha_consensus_yac_proto_Reject,
    requestDeserialize: deserialize_iroha_consensus_yac_proto_Reject,
    responseSerialize: serialize_google_protobuf_Empty,
    responseDeserialize: deserialize_google_protobuf_Empty,
  },
};

exports.YacClient = grpc.makeGenericClientConstructor(YacService);
