# 1. Base dependencies stage - INSTALL ALL DEPENDENCIES (including dev)
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
# Use npm install instead of npm ci to ensure devDependencies are fully written
RUN npm install

# 2. Source stage
FROM dependencies AS source
COPY . .

# 3. Build check stage
FROM source AS build-check
RUN npm run build

# 4. Test stage - RUN JEST DIRECTLY VIA NPX TO BYPASS SHELL ALIASES
FROM source AS test
RUN npx jest --runInBand --coverage --watchAll=false --passWithNoTests

# 5. Code quality stage
FROM source AS code-quality
RUN npx eslint src test scripts --format json --output-file eslint-report.json || true

# 6. Security audit stage
FROM source AS security-audit
RUN npm audit --audit-level=high

# 7. Production runtime stage (removes dev dependencies for size)
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY --from=build-check /app/dist ./dist

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0 || exit 1

CMD ["node", "src/server.js"]
