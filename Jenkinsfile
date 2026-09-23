pipeline {
  agent any

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  environment {
    APP_NAME = 'self-hd'
    IMAGE_TAG = "${BUILD_NUMBER}"
    STAGING_CONTAINER = 'self-hd-staging'
    PRODUCTION_CONTAINER = 'self-hd-production'
    PROMETHEUS_CONTAINER = 'self-hd-prometheus'
  }

  stages {
    stage('Build') {
      steps {
        sh '''
          mkdir -p dist
          printf '{"name":"%s","version":"%s","commit":"%s","builtAt":"%s"}\\n' \
            "${APP_NAME}" "${IMAGE_TAG}" "${GIT_COMMIT:-local}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            > dist/build-info.json
          docker build -t ${APP_NAME}:${IMAGE_TAG} .
        '''
        archiveArtifacts artifacts: 'dist/build-info.json', fingerprint: true
      }
    }

    stage('Test') {
      steps {
        sh 'docker build --target test -t ${APP_NAME}:test-${IMAGE_TAG} .'
      }
      post {
        always {
          archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true
        }
      }
    }

    stage('Code Quality') {
      steps {
        sh 'docker build --target code-quality -t ${APP_NAME}:quality-${IMAGE_TAG} .'
      }
    }

    stage('Security') {
      steps {
        sh '''
          docker build --target security-audit -t ${APP_NAME}:security-${IMAGE_TAG} .
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --exit-code 0 --severity HIGH,CRITICAL ${APP_NAME}:${IMAGE_TAG}
        '''
      }
    }

    stage('Deploy') {
      steps {
        sh '''
          docker rm -f ${STAGING_CONTAINER} || true
          docker run -d --name ${STAGING_CONTAINER} -p 3001:3000 -e NODE_ENV=staging -e APP_VERSION=${IMAGE_TAG} ${APP_NAME}:${IMAGE_TAG}
          sleep 5
          docker run --rm --network container:${STAGING_CONTAINER} curlimages/curl:8.10.1 -fsS http://127.0.0.1:3000/health
        '''
      }
    }

    stage('Release') {
      steps {
        sh '''
          docker tag ${APP_NAME}:${IMAGE_TAG} ${APP_NAME}:release-${IMAGE_TAG}
          docker rm -f ${PRODUCTION_CONTAINER} || true
          docker run -d --name ${PRODUCTION_CONTAINER} -p 3002:3000 -e NODE_ENV=production -e APP_VERSION=release-${IMAGE_TAG} ${APP_NAME}:release-${IMAGE_TAG}
          sleep 5
          docker run --rm --network container:${PRODUCTION_CONTAINER} curlimages/curl:8.10.1 -fsS http://127.0.0.1:3000/health
        '''
      }
    }

    stage('Monitoring') {
      steps {
        sh '''
          docker rm -f ${PROMETHEUS_CONTAINER} || true
          docker create --name ${PROMETHEUS_CONTAINER} -p 9091:9090 \
            --link ${PRODUCTION_CONTAINER}:production \
            prom/prometheus:v2.55.1 --config.file=/etc/prometheus/prometheus.yml
          docker cp monitoring/prometheus.yml ${PROMETHEUS_CONTAINER}:/etc/prometheus/prometheus.yml
          docker start ${PROMETHEUS_CONTAINER}
          sleep 5
          docker run --rm --network container:${PRODUCTION_CONTAINER} curlimages/curl:8.10.1 -fsS http://127.0.0.1:3000/metrics | head
        '''
      }
    }
  }

  post {
    always {
      sh 'docker ps --filter "name=self-hd" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" || true'
    }
  }
}
