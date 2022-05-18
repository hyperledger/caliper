#!/bin/sh
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

#
# This script generates an updated CHANGELOG.md file containing all the
# commits from the last release commit hash. It requires manual update
# to include the entries in the Notable section
#

if [ $# -ne 2 ]; then
    echo 'Missing required arguments: lastReleaseCommitHash releaseVersion' >&2
    echo 'ex. ./changelog.sh bf94701285d29fb58806255682237b059b672f66 0.5.0' >&2
    exit 1
fi

echo "## $2 ($(date))\n" >> CHANGELOG.new
echo "### Notable\n\n" >> CHANGELOG.new
echo "### Commits\n" >> CHANGELOG.new
git log $1..HEAD  --oneline | grep -v Merge | sed -e "s/\([0-9|a-z]*\)/* \[\1\](https:\/\/github.com\/hyperledger\/caliper\/commit\/\1)/" >> CHANGELOG.new
echo "" >> CHANGELOG.new
cat CHANGELOG.md >> CHANGELOG.new
mv -f CHANGELOG.new CHANGELOG.md