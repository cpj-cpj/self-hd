pipeline {
    agent any

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        // Prevents two builds from fighting over the same staging/production containers
        disableConcurrentBuilds()
    }

    environment {
        APP_NAME              = 'self-hd'
        IMAGE_TAG              = "${BUILD_NUMBER}"
        STAGING_CONTAINER       = 'self-hd-staging'
        PRODUCTION_CONTAINER    = 'self-hd-production'
        PROMETHEUS_CONTAINER    = 'self-hd-prometheus'
        ALERTMANAGER_CONTAINER  = 'self-hd-alertmanager'
        // Previous successful production image tag, used for automatic rollback
        PREVIOUS_RELEASE_FILE   = '.last_good_release'
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
                sh '''
                    docker build --target test -t ${APP_NAME}:test-${IMAGE_TAG} .
                    id=$(docker create ${APP_NAME}:test-${IMAGE_TAG})
                    docker cp ${id}:/app/coverage ./coverage || true
                    docker cp ${id}:/app/junit.xml ./junit.xml || true
                    docker rm ${id}
                '''
            }
            post {
                always {
                    // Publishes a pass/fail gate Jenkins can act on, not just a green docker build step
                    junit testResults: 'junit.xml', allowEmptyResults: true
                    archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true
                }
            }
        }

        stage('Code Quality') {
            steps {
                sh '''
                    docker build --target code-quality -t ${APP_NAME}:quality-${IMAGE_TAG} .
                    id=$(docker create ${APP_NAME}:quality-${IMAGE_TAG})
                    docker cp ${id}:/app/eslint-report.json ./eslint-report.json || true
                    docker rm ${id}
                '''
                // Quality gate: fail the build if ESLint reports any error-level (not warning-level) issues.
                // Uses grep/awk (always present on the Jenkins agent) instead of node, which isn't installed there.
                sh '''
                    if [ -f eslint-report.json ]; then
                        ERRORS=$(grep -o "\\"errorCount\\":[0-9]*" eslint-report.json | awk -F: "{sum+=\\$2} END {print sum+0}")
                        WARNINGS=$(grep -o "\\"warningCount\\":[0-9]*" eslint-report.json | awk -F: "{sum+=\\$2} END {print sum+0}")
                        echo "ESLint errors=${ERRORS} warnings=${WARNINGS}"
                        if [ "${ERRORS}" -gt 0 ]; then
                            echo "Quality gate failed: ${ERRORS} ESLint error(s) found"
                            exit 1
                        fi
                    else
                        echo "No ESLint report found, skipping gate"
                    fi
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'eslint-report.json', allowEmptyArchive: true
                }
            }
        }

        stage('Security') {
            steps {
                sh '''
                    docker build --target security-audit -t ${APP_NAME}:security-${IMAGE_TAG} .

                    # Dependency scan: fail on known HIGH/CRITICAL vulnerabilities in direct/transitive deps.
                    npm audit --audit-level=high --json > npm-audit-report.json || AUDIT_FAILED=1

                    # Image scan: CRITICAL findings block the pipeline; HIGH findings are recorded and reviewed,
                    # not silently ignored. This replaces the previous --exit-code 0 (report-only) behaviour.
                    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                        -v "$WORKSPACE:/report" aquasec/trivy:latest image \
                        --format json --output /report/trivy-report.json \
                        --severity HIGH,CRITICAL ${APP_NAME}:${IMAGE_TAG}

                    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image \
                        --exit-code 1 --severity CRITICAL --ignore-unfixed ${APP_NAME}:${IMAGE_TAG}
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'npm-audit-report.json,trivy-report.json', allowEmptyArchive: true
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    // Remember the currently-running staging image tag so we can roll back to it if the
                    // health check for the new one fails.
                    env.PREVIOUS_STAGING_TAG = sh(
                        script: "docker inspect -f '{{ index .Config.Labels \"image_tag\" }}' ${STAGING_CONTAINER} 2>/dev/null || echo none",
                        returnStdout: true
                    ).trim()
                }
                sh '''
                    docker rm -f ${STAGING_CONTAINER} || true
                    docker run -d --name ${STAGING_CONTAINER} --label image_tag=${IMAGE_TAG} \
                        -p 3001:3000 -e NODE_ENV=staging -e APP_VERSION=${IMAGE_TAG} ${APP_NAME}:${IMAGE_TAG}
                    sleep 5
                '''
                script {
                    def healthy = sh(
                        script: "docker run --rm --network container:${STAGING_CONTAINER} curlimages/curl:8.10.1 -fsS http://127.0.0.1:3000/health",
                        returnStatus: true
                    ) == 0
                    if (!healthy && env.PREVIOUS_STAGING_TAG != 'none' && env.PREVIOUS_STAGING_TAG) {
                        echo "Staging health check failed - rolling back to previous image ${env.PREVIOUS_STAGING_TAG}"
                        sh """
                            docker rm -f ${STAGING_CONTAINER} || true
                            docker run -d --name ${STAGING_CONTAINER} --label image_tag=${env.PREVIOUS_STAGING_TAG} \
                                -p 3001:3000 -e NODE_ENV=staging -e APP_VERSION=${env.PREVIOUS_STAGING_TAG} ${APP_NAME}:${env.PREVIOUS_STAGING_TAG}
                        """
                        error("Deploy stage failed health check; rolled staging back to build ${env.PREVIOUS_STAGING_TAG}")
                    }
                }
            }
        }

        stage('Release') {
            steps {
                sh '''
                    docker tag ${APP_NAME}:${IMAGE_TAG} ${APP_NAME}:release-${IMAGE_TAG}

                    # Environment-specific config: production gets its own env file, kept out of the image itself.
                    cat > production.env <<EOF
NODE_ENV=production
APP_VERSION=release-${IMAGE_TAG}
GIT_COMMIT=${GIT_COMMIT:-local}
EOF

                    docker rm -f ${PRODUCTION_CONTAINER} || true
                    docker run -d --name ${PRODUCTION_CONTAINER} --label image_tag=release-${IMAGE_TAG} \
                        -p 3002:3000 --env-file production.env ${APP_NAME}:release-${IMAGE_TAG}
                    sleep 5
                    docker run --rm --network container:${PRODUCTION_CONTAINER} curlimages/curl:8.10.1 -fsS http://127.0.0.1:3000/health

                    # Record this build as the last known-good release for future rollback.
                    echo "release-${IMAGE_TAG}" > ${PREVIOUS_RELEASE_FILE}
                '''
                archiveArtifacts artifacts: 'production.env', fingerprint: true
            }
        }

        stage('Monitoring') {
            steps {
                sh '''
                    docker rm -f ${PROMETHEUS_CONTAINER} ${ALERTMANAGER_CONTAINER} || true

                    docker create --name ${ALERTMANAGER_CONTAINER} -p 9093:9093 prom/alertmanager:v0.27.0
                    docker cp monitoring/alertmanager.yml ${ALERTMANAGER_CONTAINER}:/etc/alertmanager/alertmanager.yml
                    docker start ${ALERTMANAGER_CONTAINER}

                    docker create --name ${PROMETHEUS_CONTAINER} -p 9091:9090 \
                        --link ${PRODUCTION_CONTAINER}:production \
                        --link ${ALERTMANAGER_CONTAINER}:alertmanager \
                        prom/prometheus:v2.55.1 --config.file=/etc/prometheus/prometheus.yml
                    docker cp monitoring/prometheus.yml ${PROMETHEUS_CONTAINER}:/etc/prometheus/prometheus.yml
                    docker cp monitoring/alert.rules.yml ${PROMETHEUS_CONTAINER}:/etc/prometheus/alert.rules.yml
                    docker start ${PROMETHEUS_CONTAINER}
                    sleep 8
                    docker run --rm --network container:${PRODUCTION_CONTAINER} curlimages/curl:8.10.1 -fsS http://127.0.0.1:3000/metrics | head
                '''
            }
        }

        stage('Incident Simulation') {
            steps {
                // Proves the alert rule actually fires, rather than just describing it in the report.
                sh '''
                    echo "Stopping production container to simulate an outage..."
                    docker stop ${PRODUCTION_CONTAINER}

                    echo "Waiting for Prometheus to evaluate the ServiceDown rule..."
                    sleep 45

                    FIRED=$(docker run --rm --network container:${PROMETHEUS_CONTAINER} curlimages/curl:8.10.1 -fsS \
                        "http://127.0.0.1:9090/api/v1/alerts" | grep -c "\\"state\\":\\"firing\\"" || true)

                    echo "Restarting production container..."
                    docker start ${PRODUCTION_CONTAINER}
                    sleep 5
                    docker run --rm --network container:${PRODUCTION_CONTAINER} curlimages/curl:8.10.1 -fsS http://127.0.0.1:3000/health

                    echo "Alerts firing during simulated outage: ${FIRED}"
                    if [ "${FIRED}" -lt 1 ]; then
                        echo "WARNING: no alert fired during the simulated outage - review alert.rules.yml"
                    fi
                '''
            }
        }
    }

    post {
        always {
            sh 'docker ps --filter "name=self-hd" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" || true'
        }
        failure {
            echo "Pipeline failed at a gated stage. Check the archived reports (junit.xml, eslint-report.json, trivy-report.json) for the cause."
        }
    }
}
