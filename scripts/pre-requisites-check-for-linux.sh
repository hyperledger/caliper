#!/bin/bash

function version_ge() {
 test "$(echo "$@" | tr " " "\n" | sort -rV | head -n 1)" == "$1"; 
}


###################check the version of node######################
echo "****************node**********************"
flag_node="$(which node)"
node="v8"
node_version_flag="8.x"
#if [ ${version_node%%.*} == $node_version ]
if [ "${flag_node}" != "" ]
then
	node_version="$(node -v)"
	echo "Node.js is installed, version is ${node_version}"
	#compare the two version number and install right version node
	if [ ${node_version%%.*} == $node ]
	then
		echo "Node.js version is right"
	else
		echo "Install the right verson of Node.js"
		echo " Script to install the NodeSource Node.js ${node_version_flag} LTS Boron repo onto a Debian or Ubuntu system."
        echo " curl -sL https://deb.nodesource.com/setup_${node_version_flag} | bash - "
        echo "or"
        echo " wget -qO- https://deb.nodesource.com/setup_${node_version_flag} | bash - "
        echo " sudo apt-get install -y nodejs "
	fi

else 
	echo "Node.js is not installed "
	#install the right version node
	echo " Script to install the NodeSource Node.js ${node_version_flag} LTS Boron repo onto a Debian or Ubuntu system."
    echo " curl -sL https://deb.nodesource.com/setup_${node_version_flag} | bash - "
    echo "or"
    echo " wget -qO- https://deb.nodesource.com/setup_${node_version_flag} | bash - "
    echo " sudo apt-get install -y nodejs "

fi

####################check the version of docker###################
echo -e "\n\n***************docker*******************"
docker_flag="$(which docker)"
docker_version_number_minimum="18.06.1"
if [ "${docker_flag}" != "" ]
then
	docker_version="$(docker -v)"
	version_number=`echo ${docker_version#*version}`;
	version_number=`echo ${version_number%,*}`

	if version_ge ${version_number} ${docker_version_number_minimum}
	then
		echo "Docker is installed, the version is ${version_number}"
		echo "Docker's version is right"
	else
		echo "Docker is installed and current version is ${version_number}. But to keep Caliper running well, please make sure docker's version is higher than ${docker_version_number_minimum}"
		echo "To install the higher version, you can refer to this doc https://docs.docker.com/install/linux/docker-ce/ubuntu/#install-docker-ce"
	fi

else
	echo "Docker is not installed."
	echo "Docker's version should be higher than 18.06.1-ce. To install docker-ce."
	echo "you can refer to this doc https://docs.docker.com/install/linux/docker-ce/ubuntu/#install-docker-ce"

fi

####################check the version of docker-compose############
echo -e "\n\n***************docker-compose*******************"
docker_compose_flag="$(which docker-compose)"
docker_compose_version_number_minimum="1.22.0"
if [ "${docker_compose_flag}" != "" ]
then
	docker_compose_version="$(docker-compose -v)"
	version_number=`echo ${docker_compose_version#*version}`
	version_number=`echo ${version_number%,*}`

	if version_ge ${version_number} ${docker_compose_version_number_minimum}
	then
		echo "Docker-compose is installed, the version is ${version_number}"
		echo "Docker's version is right"
	else
		echo "Docker-compose is installed and current version is ${version_number}. But to keep Caliper running well, please make sure docker-compose's version is higher than ${docker_compose_version_number_minimum}"
		echo "To install the higher version, you can refer to this doc https://docs.docker.com/install/linux/docker-ce/ubuntu/#install-docker-ce"
	fi

else
	echo "Docker-compose is not installed."
	echo "Docker-compose's version should be higher than 1.22.0"
	echo "To install docker-compose, you can refer to this doc https://docs.docker.com/compose/install/"

fi