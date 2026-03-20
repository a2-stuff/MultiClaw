FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig.json .
COPY server/ server/
COPY drizzle.config.ts .
COPY drizzle/ drizzle/

# Build client
COPY client/ client/
RUN cd client && npm install && npm run build

# Build server
RUN npx tsc || true

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/package.json .
COPY --from=builder /app/drizzle/ drizzle/
COPY --from=builder /app/server/ server/
COPY --from=builder /app/client/dist/ client/dist/

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
