# Lares Test Flows

This directory now carries repository-level integration flows and their golden outputs.
The older Lares HUD / memes / chats behavioral test plans moved to `tests/chats/`.

## Active layout

```text
tests/
  bin/                         shared shell helpers and flow runner
  lararium-tw5/sync/            TW5 + daemon + CLI integration flows
  src/                          source fixtures copied into isolated test wikis
  expected/                     deterministic golden outputs for flow diffs
  results/                      disposable run captures
  .lararium/                    disposable daemon state when LAR_ROOT=tests
  chats/                        archived behavioral/chat plans and exemplars
```

Package-local Jest tests remain beside the package under test:

```text
packages/lararium-mesh/tests/
packages/lararium-tw5/tests/
packages/lararium-node/tests/
```

Fixture-backed full-stack tests that share the isolated `tests/` Lararium now live under `tests/lararium-tw5/` rather than package-local test folders.

## Commands

```sh
pnpm test:unit       # package-local Jest suites
pnpm test:tw5-fixture # fixture-backed TW5 tests under tests/lararium-tw5/
pnpm test:flows      # top-level integration flows; currently TW5 sync/decompose/promote
pnpm test:tw5-flow   # direct TW5 integration flow
```

The flow scripts set `LAR_ROOT=tests` by default. That keeps `.lararium/`, `wikis/`,
isolated canonical `bags/`, and disposable run captures under `tests/results/` instead
of touching the canonical repo tree.

## Flow: lararium-tw5 sync/decompose/promote

```sh
bash tests/lararium-tw5/sync/sync-decompose-promote.sh decompose
bash tests/lararium-tw5/sync/sync-decompose-promote.sh promote
bash tests/lararium-tw5/sync/sync-decompose-promote.sh both
```

This flow:

1. resets an isolated test lararium root;
2. boots `lares serve --wiki scratch --root tests`;
3. initializes a test wiki;
4. copies `tests/src/the-lares-protocols.md` into `tests/wikis/@<slug>/memes/**` for ingest;
5. runs `lares wiki sync`;
6. verifies child meme decomposition against `tests/expected/wikis/**`;
7. captures decompose and promote outputs under `tests/results/**`;
8. optionally promotes to the isolated canonical `tests/bags/**` tree and diffs again.

## Adding new flows

- Put slow daemon/CLI flows under `tests/<package-or-surface>/<domain>/`.
- Put package-local fast tests under `packages/<package>/tests/`.
- Use `tests/bin/run-flow.sh` to expose named flows.
- Keep all mutable state under `tests/` or `/tmp`.
- Store deterministic golden outputs under `tests/expected/`; store stochastic behavioral exemplars under `tests/chats/expected/`.
