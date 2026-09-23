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
          docker run --rm -v "$PWD":/app -w /app node:22-alpine sh -lc "npm install && npm run build"
          docker build -t ${APP_NAME}:${IMAGE_TAG} .
        '''
        archiveArtifacts artifacts: 'dist/build-info.json', fingerprint: true
      }
    }

    stage('Test') {
      steps {
        sh 'docker run --rm -v "$PWD":/app -w /app node:22-alpine sh -lc "npm test"'
      }
      post {
        always {
          archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true
        }
      }
    }

    stage('Code Quality') {
      steps {
        sh 'docker run --rm -v "$PWD":/app -w /app node:22-alpine sh -lc "npm run lint"'
      }
    }

    stage('Security') {
      steps {
        sh '''
          docker run --rm -v "$PWD":/app -w /app node:22-alpine sh -lc "npm audit --audit-level=high"
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
          docker run -d --name ${PROMETHEUS_CONTAINER} -p 9091:9090 \
            --link ${PRODUCTION_CONTAINER}:production \
            -v "$PWD/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
            prom/prometheus:v2.55.1 --config.file=/etc/prometheus/prometheus.yml
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

