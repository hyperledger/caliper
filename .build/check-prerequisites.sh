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
set -e
set -o pipefail

CLEAR="$(tput sgr0)"
RED="$(tput setaf 1)"
GREEN="$(tput setaf 2)"

check_npm_version() {
    required_version="7.24.2"
    installed_version=$(npm --version)
    versions="$required_version\n$installed_version"
    if echo -e $versions | sort -rV | head -n 1 | grep -q "$installed_version"; then
        echo "$GREEN npm version $installed_version is >= $required_version $CLEAR"
        return 0
    else
        echo "$RED npm version $installed_version < $required_version $CLEAR"
        echo "$RED Please update npm to the latest version: https://docs.npmjs.com/try-the-latest-stable-version-of-npm $CLEAR"
        return 1
    fi
}

check_node_version() {
    required_version="18.19.0"
    installed_version=$(node --version | cut -c2-)
    versions="$required_version\n$installed_version"
    if echo -e $versions | sort -rV | head -n 1 | grep -q "$installed_version"; then
        echo "$GREEN node version $installed_version is >= $required_version $CLEAR"
        return 0
    else
        echo "$RED node version $installed_version < $required_version $CLEAR"
        echo "$RED Please update node to the latest version: https://nodejs.org/en/download/ $CLEAR"
        return 1
    fi
}

check_node_version
rc=$?
check_npm_version
rc=$?||$rc
if [ $rc -ne 0 ]; then
    exit $rc
fi
