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

if [ $# -eq 0 ] ; then
    echo "ERROR: PUML file path argument is missing! Usage: generate-figure.sh <path-to-puml-file>"
    exit 1
fi

if [ ! -f "$1" ]; then
    echo "ERROR: Input file not found: $1"
    exit 1
fi

if ! which docker; then
    echo "ERROR: Docker must be installed to generate figures!"
    exit 1
fi

DIR_NAME=`dirname "$1"`
FILE_NAME_NO_EXT=`basename "$1" .puml`

cat "$1" | docker run --rm -i think/plantuml -tpng > ${DIR_NAME}/${FILE_NAME_NO_EXT}.png