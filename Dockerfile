FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM dependencies AS source

COPY . .

FROM source AS build-check
RUN npm run build

FROM source AS test
RUN npm test -- --coverage=false

FROM source AS code-quality
RUN npx eslint src test scripts --format json --output-file eslint-report.json || true

FROM source AS security-audit
RUN npm audit --audit-level=high

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY --from=build-check /app/dist ./dist

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/server.js"]
