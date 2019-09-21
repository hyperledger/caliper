#!/bin/sh

# If variable not present use default values
: ${CORDA_HOME:=/opt/corda}
: ${JAVA_OPTIONS:=-Xmx512m}

export CORDA_HOME JAVA_OPTIONS

cd ${CORDA_HOME}
java $JAVA_OPTIONS -jar ${CORDA_HOME}/corda.jar --sshd --sshd-port 2222 2>&1
