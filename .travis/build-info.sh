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

echo "TRAVIS_BRANCH: ${TRAVIS_BRANCH}"
echo "TRAVIS_COMMIT: ${TRAVIS_COMMIT}"
echo "TRAVIS_COMMIT_MESSAGE: ${TRAVIS_COMMIT_MESSAGE}"
echo "TRAVIS_COMMIT_RANGE: ${TRAVIS_COMMIT_RANGE}"
echo "TRAVIS_EVENT_TYPE: ${TRAVIS_EVENT_TYPE}"
echo "TRAVIS_PULL_REQUEST: ${TRAVIS_PULL_REQUEST}"
echo "TRAVIS_PULL_REQUEST_BRANCH: ${TRAVIS_PULL_REQUEST_BRANCH}"
echo "TRAVIS_PULL_REQUEST_SLUG: ${TRAVIS_PULL_REQUEST_SLUG}"
echo "TRAVIS_REPO_SLUG: ${TRAVIS_REPO_SLUG}"
# this is just a boolean var
echo "TRAVIS_SECURE_ENV_VARS: ${TRAVIS_SECURE_ENV_VARS}"

if [[ -z "${NPM_TOKEN}" ]]
then
      echo "NPM_TOKEN is not set"
else
      echo "NPM_TOKEN is decrypted"
fi

if [[ -z "${DOCKER_TOKEN}" ]]
then
      echo "DOCKER_TOKEN is not set"
else
      echo "DOCKER_TOKEN is decrypted"
fi

exit 0
