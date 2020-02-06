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

# Exit on first error
set -e

if [[ -z "${DOCKER_TOKEN}" ]]
then
      echo "ERROR: No DOCKER_TOKEN variable detected"
      exit 1
fi

# login to docker with secret token
echo ${DOCKER_TOKEN} | docker login -u ${DOCKER_USER} --password-stdin
docker push ${IMAGE}:${TAG}
