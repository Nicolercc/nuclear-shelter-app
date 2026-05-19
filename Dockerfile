# syntax=docker/dockerfile:1
# Single-container production image: Express API + built React SPA (same origin, no CORS config required).
FROM node:22-bookworm AS build

WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY artifacts artifacts
COPY lib lib
COPY scripts scripts

RUN pnpm install
RUN pnpm --filter @workspace/nuclear-escape run build
RUN pnpm --filter @workspace/api-server run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV STATIC_DIR=/app/public

COPY --from=build /app/artifacts/nuclear-escape/dist/public /app/public
COPY --from=build /app/artifacts/api-server/dist ./dist

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
