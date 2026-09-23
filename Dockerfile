FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package*.json ./
RUN npm install

FROM dependencies AS quality

COPY . .
RUN npm run build
RUN npm test -- --coverage=false
RUN npm run lint

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
COPY --from=quality /app/dist ./dist

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/server.js"]

