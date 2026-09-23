# Self HD DevOps Pipeline

This repository contains a small Express service prepared for the SIT223 7.3HD Jenkins DevOps pipeline task.

## Project

- Runtime: Node.js and Express
- Tests: Jest and Supertest
- Code quality: ESLint
- Security: npm audit and Trivy image scanning
- Deployment: Docker containers for staging and production
- Monitoring: Prometheus scraping `/metrics`
- Jenkins pipeline: `Jenkinsfile`

## Run locally

```bash
npm install
npm test
npm run lint
npm run build
npm start
```

The service runs at `http://localhost:3000`.

## Run with Docker

```bash
docker compose up --build -d staging
curl http://localhost:3001/health
```

To run the release profile with production and monitoring:

```bash
APP_VERSION=demo docker compose --profile release up --build -d
curl http://localhost:3002/health
open http://localhost:9091
```

## Run Jenkins for the assessment demo

```bash
export JENKINS_ADMIN_PASSWORD='choose-a-strong-password'
docker compose -f docker-compose.jenkins.yml up --build -d
```

Open Jenkins at `http://localhost:8090`.

- Username: `admin`, unless you also set `JENKINS_ADMIN_ID`
- Password: the value you set in `JENKINS_ADMIN_PASSWORD`
- Seeded job: `self-hd-pipeline`

The seeded Jenkins job reads this repository's `Jenkinsfile` from `https://github.com/cpj-cpj/self-hd.git`.

## Pipeline stages

1. Build - creates `dist/build-info.json` and a Docker image.
2. Test - runs Jest/Supertest API tests and archives coverage.
3. Code Quality - runs ESLint.
4. Security - runs `npm audit` and Trivy Docker image scanning.
5. Deploy - deploys the app to a staging Docker container on port `3001`.
6. Release - tags the image and deploys production on port `3002`.
7. Monitoring - starts Prometheus on port `9091` and checks the app's metrics endpoint.
