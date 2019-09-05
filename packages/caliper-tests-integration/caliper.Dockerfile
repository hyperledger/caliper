#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

FROM node:10.16-alpine

# require to set these explicitly to avoid mistakes
ARG npm_registry
ARG caliper_version

WORKDIR /hyperledger/caliper

# 1. install packages for grpc compilation
# 2. Create the default workspace directory
# 3. Initialize the working directory
# 4. Install the CLI into the working directory
RUN apk add --no-cache python2 make g++ git \
    && mkdir -p /hyperledger/caliper/workspace \
    && npm init -y \
    && npm install ${npm_registry} --only=prod @hyperledger/caliper-cli@${caliper_version}

ENV CALIPER_WORKSPACE /hyperledger/caliper/workspace
CMD npx caliper bind && npx caliper benchmark run

