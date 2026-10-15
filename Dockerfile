# syntax=docker/dockerfile:1
#
# Multi-stage build for Lararium.
#
# Stages:
#   deps         — install workspace deps (layer-cached)
#   build        — compile the Node runtime dependency graph + Vite web surface
#   serve        — the product image: daemon + CLI + genesis + web; state and corpus arrive as mounts
#   mcp-runtime  — minimal stdio MCP server
#
# Auth env vars (all optional — graceful fallback to local-dev):
#   GITHUB_CLIENT_ID      GitHub OAuth App client id (web flow for browser users)
#   GITHUB_CLIENT_SECRET  GitHub OAuth App client secret
#   NODE_ENV              development | qa | production

ARG NODE_IMAGE=node:24-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20

# Python and Node both ride Debian Bookworm in the combined serve image. Pin
# the Python image digest so a mutable tag cannot silently change its ABI.
FROM python:3.12-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258 AS sensorium-python-seat
WORKDIR /app
COPY mempalace/pyproject.toml mempalace/README.md ./mempalace/
COPY mempalace/mempalace/ ./mempalace/mempalace/
COPY packages/lararium-sensorium/requirements-image.lock ./sensorium-requirements.lock
RUN pip install --no-cache-dir --no-deps -r sensorium-requirements.lock ./mempalace && pip check

# ---------------------------------------------------------------------------
# Stage 1: deps
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps

WORKDIR /app

# The exact pnpm package.json `packageManager` names; any other pnpm writes a different lock.
RUN npm install -g pnpm@11.28.5

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY TiddlyWiki5/package.json                         TiddlyWiki5/
COPY packages/lararium-browser/package.json            packages/lararium-browser/
COPY packages/lares-cli/package.json                   packages/lares-cli/
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
RUN pnpm --filter @lares/cli build

# ---------------------------------------------------------------------------
# Stage 3: serve — lararium-node WS server with an optional explicit Pronaos shore
#
# The image carries the built web artifact and its finite Pronaos receipt beside the
# Automerge meme-sync WebSocket. A profile must opt into the shore with the two exact
# LAR_PRONAOS_* paths; copying bytes alone never widens Node's route ownership.
# lares/ is always mounted at runtime — never baked in.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS serve

WORKDIR /app

# The Node slim base omits Python's runtime libraries even though both images
# use Bookworm. Install the shared libraries explicitly before probing imports.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libsqlite3-0 libbz2-1.0 liblzma5 libffi8 libexpat1 libgomp1 libssl3 \
    && rm -rf /var/lib/apt/lists/*

# One explicit Python interpreter and installed dependency closure live beside
# Node. Python's Debian release matches Node's; scripts and vendored source
# stay in /app while every writable cache/store belongs beneath /state.
COPY --from=sensorium-python-seat /usr/local /usr/local
COPY --from=sensorium-python-seat /app/mempalace/mempalace ./mempalace/mempalace
COPY --from=build /app/packages/lararium-sensorium/scripts ./packages/lararium-sensorium/scripts
COPY --from=build /app/packages/lararium-sensorium/model-assets.json ./packages/lararium-sensorium/model-assets.json
ENV LARES_PYTHON=/usr/local/bin/python3 \
    PYTHONPATH=/app/mempalace \
    XDG_CACHE_HOME=/state/cache \
    HF_HOME=/state/cache/huggingface
RUN PYTHONPATH=/app/mempalace python3 /app/packages/lararium-sensorium/scripts/content_io.py --help >/dev/null && \
    PYTHONPATH=/app/mempalace python3 /app/packages/lararium-sensorium/scripts/trial_project.py --help >/dev/null && \
    PYTHONPATH=/app/mempalace python3 /app/packages/lararium-sensorium/scripts/trial_owned_content.py --help >/dev/null && \
    PYTHONPATH=/app/mempalace python3 /app/packages/lararium-sensorium/scripts/trial_owned_li.py --help >/dev/null && \
    PYTHONPATH=/app/mempalace python3 /app/packages/lararium-sensorium/scripts/trial_model_check.py --help >/dev/null && \
    PYTHONPATH=/app/mempalace python3 -c 'import chromadb, mempalace; from mcp.server.mcpserver import MCPServer'

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
COPY --from=build /app/.pronaos-build/pronaos-artifact.json ./pronaos-build/pronaos-artifact.json
COPY --from=build /app/genesis                             ./genesis

# THE CLI RIDES THE IMAGE. A host-installed CLI would resolve HOST paths; this one shares the daemon's /tmp
# (the UDS rendezvous), uid and environment when reached through `docker compose exec`.
COPY --from=build /app/packages/lararium-memetic-frame/node_modules ./packages/lararium-memetic-frame/node_modules
COPY --from=build /app/packages/lararium-memetic-frame/dist         ./packages/lararium-memetic-frame/dist
COPY --from=build /app/packages/lararium-memetic-frame/package.json ./packages/lararium-memetic-frame/package.json
COPY --from=build /app/packages/lares-cli/node_modules      ./packages/lares-cli/node_modules
COPY --from=build /app/packages/lares-cli/dist              ./packages/lares-cli/dist
COPY --from=build /app/packages/lares-cli/bin               ./packages/lares-cli/bin
COPY --from=build /app/packages/lares-cli/package.json      ./packages/lares-cli/package.json

# THE TWO MOUNTS (the deployment contract; docker-compose.surface.yml wires them):
#   /state      one durable per-vessel directory — vessel homes AND custody (keys). Never in a layer.
#   /workspace  the editable corpus — bags/ and wikis/ the projection reads and writes.
# The image declares them so an unmounted run lands in an anonymous volume, never in the image layers.
# Created and chowned BEFORE the VOLUME lines: an anonymous volume copies its mount point's ownership from the
# image, so an unmounted run reads node:node here, never root-owned.
RUN mkdir -p /state /workspace && chown node:node /state /workspace
VOLUME /state
VOLUME /workspace

ENV NODE_ENV=production
# EXPLICIT ROOTS. LAR_BAGS alone does not isolate the projection mirrors; the daemon also takes
# `--root /workspace` (see CMD). LAR_ROOT moves the vessel's XDG homes under /state.
ENV LAR_ROOT=/state \
    LAR_BAGS=/workspace/bags \
    LAR_WIKIS=/workspace/wikis \
    LAR_GENESIS=/app/genesis
# A HOME for an arbitrary runtime uid (`user:` in compose) with no passwd entry.
# Chroma's MiniLM cache derives from HOME rather than XDG_CACHE_HOME; keeping
# HOME under the mounted state makes model bytes survive holder restarts.
ENV HOME=/state
# THE HOST HOLDS THE ENGINE. The daemon runs as this container's main process, so the CLI inside reports a
# standing verdict and never stops or spawns a daemon; the host shim restarts the container.
ENV LAR_ENGINE=host
# Peer port — single surface: WS /ws + GET /api/health
ENV LAR_PORT=4321
# Auth env vars — set via docker compose or -e flags
# GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are optional
# gh CLI is NOT available in the container; server falls back to local-dev receipt
# when neither gh CLI nor GitHub OAuth env vars are present

EXPOSE 4321

# THE ONE-HOLDER LAW rides the store itself. The store takes a claim at /state/.holder (a socket on the state
# mount) before it opens, so a second holder on the same /state refuses with StoreHeld whichever container,
# namespace or entrypoint it came through. The image wraps nothing: `docker run --entrypoint node` meets the
# same refusal as the default entrypoint. Exec'd CLI calls share the holder's container.

# NON-ROOT. The uid/gid come from the environment at RUN time (compose `user: "${LARES_UID}:${LARES_GID}"`),
# so a bind-mounted /state and /workspace stay editable by the host operator. Nothing here pins one.
USER node

# The daemon's flags (`--root /x` and `--root=/x` read alike; main.js and the CLI refuse a flag nobody reads).
ENTRYPOINT ["node", "packages/lararium-node/dist/src/main.js"]
CMD ["--root", "/workspace", "--genesis", "/app/genesis"]

# ---------------------------------------------------------------------------
# Stage 4: mcp-runtime — minimal stdio MCP server (unchanged)
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS mcp-runtime

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

# Bounded custody witness. This stdlib-only trial seat is separate from the
# product holder until the pinned Python/MemPalace dependency closure lands.
FROM python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1 AS sensorium-trial
WORKDIR /app/packages/lararium-sensorium/scripts
COPY packages/lararium-sensorium/scripts/trial_inventory.py ./
COPY packages/lararium-sensorium/scripts/trial_intake.py ./
RUN mkdir -p /handoff /state
USER 65532:65532
ENTRYPOINT ["python", "trial_intake.py"]
