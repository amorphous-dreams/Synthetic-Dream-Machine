# syntax=docker/dockerfile:1
#
# Multi-stage build for lararium-mcp.
# Produces a minimal Node image that runs the stdio MCP server.
#
# Stages:
#   deps     — install workspace deps (layer-cached)
#   build    — tsc compile all packages
#   runtime  — minimal image with only the dist/ artifacts and node_modules
#

ARG NODE_VERSION=24

# ---------------------------------------------------------------------------
# Stage 1: deps
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS deps

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/lararium-core/package.json packages/lararium-core/
COPY packages/lararium-node/package.json packages/lararium-node/
COPY packages/lararium-mcp/package.json packages/lararium-mcp/

RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 2: build
# ---------------------------------------------------------------------------
FROM deps AS build

COPY packages/ packages/

RUN pnpm -r build

# ---------------------------------------------------------------------------
# Stage 3: runtime
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime

WORKDIR /app

# Only copy what the runtime needs
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/lararium-core/dist ./packages/lararium-core/dist
COPY --from=build /app/packages/lararium-core/package.json ./packages/lararium-core/
COPY --from=build /app/packages/lararium-node/dist ./packages/lararium-node/dist
COPY --from=build /app/packages/lararium-node/package.json ./packages/lararium-node/
COPY --from=build /app/packages/lararium-mcp/dist ./packages/lararium-mcp/dist
COPY --from=build /app/packages/lararium-mcp/package.json ./packages/lararium-mcp/
COPY --from=build /app/package.json ./

# lares/ is always mounted at runtime — never baked in.
# dev: volume mount (read-write)
# qa:  volume mount (read-write for session work)
# prod: volume mount (read-only via compose)
VOLUME /app/lares

ENV NODE_ENV=production

# stdio — no exposed ports at this stage
# Streamable HTTP will add EXPOSE when it lands
ENTRYPOINT ["node", "packages/lararium-mcp/dist/stdio.js"]
