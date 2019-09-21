#!/usr/bin/env bash

# remove currentView file
rm ./library-1.1-beta/config/currentView

# move configurations files to ~/config
cp -rf ./configurations/network/hosts.config ./library-1.1-beta/config/
cp -rf ./configurations/network/system.config ./library-1.1-beta/config/

# need to compile classes (if you modified them) and generate the jar
cd ./library-1.1-beta
ant compile
ant -buildfile build.xml
cd ./..
