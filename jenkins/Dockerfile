FROM jenkins/jenkins:lts

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl docker-cli \
  && rm -rf /var/lib/apt/lists/*

COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli -f /usr/share/jenkins/ref/plugins.txt

COPY init.groovy.d/ /usr/share/jenkins/ref/init.groovy.d/

USER root
