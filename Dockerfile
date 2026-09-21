# syntax=docker/dockerfile:1
#
# Multi-stage build for Lararium.
#
# Stages:
#   deps         — install workspace deps (layer-cached)
#   build        — compile the Node runtime dependency graph + Vite web surface
#   serve        — lararium-node WS server (web artifact copied for a held static-route decision)
#   mcp-runtime  — minimal stdio MCP server
#
# Auth env vars (all optional — graceful fallback to local-dev):
#   GITHUB_CLIENT_ID      GitHub OAuth App client id (web flow for browser users)
#   GITHUB_CLIENT_SECRET  GitHub OAuth App client secret
#   NODE_ENV              development | qa | production

ARG NODE_VERSION=24

# ---------------------------------------------------------------------------
# Stage 1: deps
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS deps

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY TiddlyWiki5/package.json                         TiddlyWiki5/
COPY packages/lararium-browser/package.json            packages/lararium-browser/
COPY packages/lararium-keyhive/package.json            packages/lararium-keyhive/
COPY packages/lararium-mempalace/package.json          packages/lararium-mempalace/
COPY packages/lararium-mesh/package.json    packages/lararium-mesh/
COPY packages/lararium-sensorium/package.json           packages/lararium-sensorium/
COPY packages/lararium-tw5/package.json     packages/lararium-tw5/
COPY packages/lararium-node/package.json    packages/lararium-node/
COPY packages/lararium-web/package.json     packages/lararium-web/

RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 2: build
# ---------------------------------------------------------------------------
FROM deps AS build

COPY packages/ packages/
COPY TiddlyWiki5/ TiddlyWiki5/
COPY bags/       bags/
COPY genesis/    genesis/

# Build only the current Node host and its transitive workspace dependencies, then the web surface.
# The deferred mcp-runtime stays outside this target's build graph.
RUN pnpm --filter @lararium/node... build
RUN pnpm --filter @lararium/web... build

# ---------------------------------------------------------------------------
# Stage 3: serve — lararium-node WS server; static web serving remains unproven
#
# The image carries the built web artifact beside the Automerge meme-sync WebSocket.
# `packages/lararium-node/src/main.ts` currently exposes WS/oracle behavior without a
# general static HTTP handler, so this copy does not claim to serve `/`.
# lares/ is always mounted at runtime — never baked in.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS serve

WORKDIR /app

COPY --from=build /app/node_modules                         ./node_modules
COPY --from=build /app/package.json                         ./package.json
COPY --from=build /app/pnpm-workspace.yaml                  ./pnpm-workspace.yaml
COPY --from=build /app/packages/lararium-mesh/node_modules ./packages/lararium-mesh/node_modules
COPY --from=build /app/packages/lararium-mesh/dist          ./packages/lararium-mesh/dist
COPY --from=build /app/packages/lararium-mesh/package.json  ./packages/lararium-mesh/package.json
COPY --from=build /app/packages/lararium-tw5/node_modules  ./packages/lararium-tw5/node_modules
COPY --from=build /app/packages/lararium-tw5/dist           ./packages/lararium-tw5/dist
COPY --from=build /app/packages/lararium-tw5/package.json   ./packages/lararium-tw5/package.json
COPY --from=build /app/packages/lararium-keyhive/node_modules ./packages/lararium-keyhive/node_modules
COPY --from=build /app/packages/lararium-keyhive/dist       ./packages/lararium-keyhive/dist
COPY --from=build /app/packages/lararium-keyhive/package.json ./packages/lararium-keyhive/package.json
COPY --from=build /app/packages/lararium-mempalace/node_modules ./packages/lararium-mempalace/node_modules
COPY --from=build /app/packages/lararium-mempalace/dist     ./packages/lararium-mempalace/dist
COPY --from=build /app/packages/lararium-mempalace/package.json ./packages/lararium-mempalace/package.json
COPY --from=build /app/packages/lararium-node/node_modules ./packages/lararium-node/node_modules
COPY --from=build /app/packages/lararium-node/dist          ./packages/lararium-node/dist
COPY --from=build /app/packages/lararium-node/package.json  ./packages/lararium-node/package.json
COPY --from=build /app/packages/lararium-sensorium/node_modules ./packages/lararium-sensorium/node_modules
COPY --from=build /app/packages/lararium-sensorium/dist    ./packages/lararium-sensorium/dist
COPY --from=build /app/packages/lararium-sensorium/package.json ./packages/lararium-sensorium/package.json
COPY --from=build /app/packages/lararium-web/dist           ./packages/lararium-web/dist
COPY --from=build /app/packages/lararium-web/public         ./packages/lararium-web/public
COPY --from=build /app/genesis                             ./genesis

# lares/ mounted at runtime — never baked in
VOLUME /app/lares

# Automerge island persistence — mount a named volume in production
VOLUME /app/.lararium-data

ENV NODE_ENV=production
# Peer port — single surface: WS /ws + GET /api/health
ENV LAR_PORT=4321
# Auth env vars — set via docker compose or -e flags
# GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are optional
# gh CLI is NOT available in the container; server falls back to local-dev receipt
# when neither gh CLI nor GitHub OAuth env vars are present

EXPOSE 4321

ENTRYPOINT ["node", "packages/lararium-node/dist/src/main.js"]

# ---------------------------------------------------------------------------
# Stage 4: mcp-runtime — minimal stdio MCP server (unchanged)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS mcp-runtime

WORKDIR /app

COPY --from=build /app/node_modules                        ./node_modules
COPY --from=build /app/packages/lararium-mesh/dist         ./packages/lararium-mesh/dist
COPY --from=build /app/packages/lararium-mesh/package.json ./packages/lararium-mesh/package.json
COPY --from=build /app/packages/lararium-node/dist         ./packages/lararium-node/dist
COPY --from=build /app/packages/lararium-node/package.json ./packages/lararium-node/package.json
COPY --from=build /app/packages/lararium-mcp/dist          ./packages/lararium-mcp/dist
COPY --from=build /app/packages/lararium-mcp/package.json  ./packages/lararium-mcp/package.json
COPY --from=build /app/package.json                        ./

VOLUME /app/lares

ENV NODE_ENV=production

ENTRYPOINT ["node", "packages/lararium-mcp/dist/stdio.js"]
