# Static build served by Caddy. Used by Railway (railway.json) and by any other
# host that runs a container; GitHub Pages builds through deploy.yml instead.

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm install, not npm ci: see the note in .github/workflows/deploy.yml.
RUN npm install --no-audit --no-fund
COPY . .
# Vite bakes these into the bundle, so they are needed here, at build time.
# Railway passes a service variable to the build only when it is declared as ARG.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
