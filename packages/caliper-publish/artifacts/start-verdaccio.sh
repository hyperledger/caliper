#!/bin/bash
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

# Exit on first error, print all commands.
set -ev
set -o pipefail

# Set ARCH
ARCH=`uname -m`

# Verdaccio server requires a dummy user if publishing via npm
echo "//${BIND}/:_authToken=\"foo\"" > ${HOME}/.npmrc
echo fetch-retries=10 >> ${HOME}/.npmrc
export npm_config_registry=http://${BIND}

# Start npm server
PM2_HOME=.pm2 npx pm2 start verdaccio -- -l ${BIND} -c artifacts/verdaccio-config.yaml
