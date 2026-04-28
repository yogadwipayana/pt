# syntax=docker/dockerfile:1.7
ARG BUN_IMAGE=oven/bun:1.3.2-alpine
FROM ${BUN_IMAGE} AS base
WORKDIR /app

FROM base AS deps
RUN apk --no-cache add nodejs python3 make g++ linux-headers
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.bun \
  bun install --frozen-lockfile || bun install

FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk --no-cache add nodejs
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate
RUN bun run build

FROM ${BUN_IMAGE} AS runner
WORKDIR /app

LABEL org.opencontainers.image.title="Dwipa AI"

RUN apk --no-cache add nodejs nginx bash wget \
  && rm -f /etc/nginx/http.d/default.conf \
  && mkdir -p /run/nginx /app/data

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4000
ENV HOSTNAME=127.0.0.1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/open-sse ./open-sse
COPY nginx.conf /etc/nginx/nginx.conf
COPY docker-entrypoint.sh /usr/local/bin/start-app.sh

RUN chmod +x /usr/local/bin/start-app.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8000/api/health || exit 1

CMD ["/usr/local/bin/start-app.sh"]
