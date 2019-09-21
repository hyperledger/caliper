#!/usr/bin/env bash

kill $(lsof -t -i:11000)
kill $(lsof -t -i:11010)
kill $(lsof -t -i:11020)
kill $(lsof -t -i:11030)
