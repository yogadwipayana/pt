FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN npm install -g npm@11.8.0

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG BETTER_AUTH_SECRET
ARG BETTER_AUTH_URL
ARG NEXT_PUBLIC_APP_URL
ARG DATABASE_URL
ARG APP_ENCRYPTION_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
  BETTER_AUTH_URL="$BETTER_AUTH_URL" \
  NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL" \
  DATABASE_URL="$DATABASE_URL" \
  APP_ENCRYPTION_KEY="$APP_ENCRYPTION_KEY" \
  npm run build
RUN standalone_root="$(dirname "$(find dist/standalone -name server.js -not -path '*/node_modules/*' -print -quit)")" \
  && test -n "$standalone_root" \
  && mkdir -p /tmp/standalone \
  && cp -R "$standalone_root"/. /tmp/standalone/

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=127.0.0.1

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx \
  && rm -rf /var/lib/apt/lists/* \
  && rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf

COPY --from=builder /app/public ./public
COPY --from=builder /tmp/standalone ./
COPY --from=builder /app/dist/static ./dist/static
COPY nginx.conf /etc/nginx/nginx.conf
COPY docker-entrypoint.sh /usr/local/bin/start-app.sh

RUN chmod +x /usr/local/bin/start-app.sh

EXPOSE 8000

CMD ["/usr/local/bin/start-app.sh"]
