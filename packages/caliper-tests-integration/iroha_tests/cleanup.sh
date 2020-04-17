docker-compose down
docker volume rm $(docker volume ls -q | grep iroha_tests)
docker network rm $(docker network ls | grep iroha-net | cut -d' ' -f1)
