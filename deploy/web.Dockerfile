FROM node:22-alpine AS build
WORKDIR /app
COPY agentid-ui-demo/package*.json ./
RUN npm ci
COPY agentid-ui-demo ./
ARG VITE_AGENTID_API_URL
ENV VITE_AGENTID_API_URL=$VITE_AGENTID_API_URL
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
