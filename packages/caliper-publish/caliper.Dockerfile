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

FROM node:10.22-alpine

# require to set these explicitly to avoid mistakes
ARG npm_registry
ARG caliper_version

# Install packages for dependency compilation
RUN apk add --no-cache python g++ make git

# execute as the "node" user, created in the base image
USER node:node
WORKDIR /hyperledger/caliper/workspace

# 1 & 2. change the NPM global install directory
# https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally#manually-change-npms-default-directory
# 3. install Caliper globally (also install the core package, so it's bumped to the global root directory, so external modules can access it)
RUN mkdir /home/node/.npm-global \
    && npm config set prefix '/home/node/.npm-global' \
    && npm install ${npm_registry} -g --only=prod @hyperledger/caliper-core@${caliper_version} @hyperledger/caliper-cli@${caliper_version}

# Set NODE_PATH to the global install directory, so the global Caliper core module can be required by external modules
# https://nodejs.org/docs/latest-v10.x/api/modules.html#modules_loading_from_the_global_folders
ENV NODE_PATH /home/node/.npm-global/lib/node_modules
ENV PATH /home/node/.npm-global/bin:$PATH
ENV CALIPER_WORKSPACE /hyperledger/caliper/workspace
ENV CALIPER_BIND_ARGS -g

ENTRYPOINT ["caliper"]
CMD ["--version"]
