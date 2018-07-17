# Copyright 2017 Intel Corporation
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ------------------------------------------------------------------------------

# Description:
#   Builds an image with the Hyperledger Sawtooth TP Simple installed from
#   local debs.
#
# Build:
#   This image should be built using `build_all installed`.
#
# Run:
#   $ docker run sawtooth-simple-tp-python

FROM ubuntu:xenial

ARG DEBIAN_FRONTEND=noninteractive

RUN echo "deb http://repo.sawtooth.me/ubuntu/ci xenial universe" >> /etc/apt/sources.list \
 && (apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 8AA7AF1F1091A5FD \
 || apt-key adv --keyserver hkp://p80.pool.sks-keyservers.net:80 --recv-keys 8AA7AF1F1091A5FD)
RUN apt-get update \
 && apt-get install -y -q --allow-downgrades \
    git \
    python3 \
    python3-stdeb \
    python3-pip
RUN pip3 install --upgrade pip
RUN pip3 install grpcio \
 && pip3 install grpcio-tools \
 && pip3 install protobuf \
 && pip3 install sawtooth-sdk \
 && pip3 install sawtooth-signing \
 && apt-get install -y -q --allow-downgrades \
    python3-cbor \
    python3-colorlog \
    python3-toml \
    python3-yaml \
    python3-zmq \
    software-properties-common \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /project/src/contract/sawtooth/simple/simple_python

ENV PATH "$PATH:/project/:/project/src/contract/sawtooth/simple/simple_python:."

RUN echo "$PATH"
RUN echo "`pwd`"
EXPOSE 4004/tcp

CMD unset PYTHONPATH && python3 setup.py clean --all && python3 setup.py build
