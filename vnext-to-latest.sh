#!/bin/bash

rm -rf ./docs/vLatest/*
cp -r ./docs/vNext/* ./docs/vLatest/

# permalink: /vNext/  =>  permalink: /vLatest/
find ./docs/vLatest \( -type d -name .git -prune \) -o -type f -print0 | xargs -0 sed -i 's;permalink: /vNext/;permalink: /vLatest/;g'

# layout: pageNext  => layout: page
find ./docs/vLatest \( -type d -name .git -prune \) -o -type f -print0 | xargs -0 sed -i 's;layout: pageNext;layout: page;g'