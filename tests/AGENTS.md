# Tests Agent Guide

This tree contains repository-level integration test flows and shared fixtures. Package-level unit tests live next to the package under test.

## Test topology

| Test kind | Location | Runner | Purpose |
|---|---|---|---|
| Unit / package contract tests | `packages/<package>/tests/` | package Jest config via `pnpm --filter <pkg> test` | Fast tests for code owned by one package. Keep these close to implementation. |
| Integration / daemon flows | `tests/<surface>/...` | shell flow scripts via `tests/bin/run-flow.sh` | Cross-package ceremonies involving CLI, daemon, disk projection, Automerge state, and golden outputs. |
| Historical chat / HUD behavioral plans | `tests/chats/` | not part of active code CI | Archived Lares prompt-contract plans and exemplar chat outputs. Do not mix these with deterministic code-flow goldens. |

## Active commands

From the repository root:

```sh
pnpm test:unit       # package-local Jest suites
pnpm test:flows      # top-level integration flows; currently TW5 sync/decompose/promote
pnpm test:tw5-flow   # direct TW5 integration flow
```

Package-specific commands remain valid, for example:

```sh
pnpm --filter @lararium/tw5 test
pnpm --filter @lararium/node test
pnpm --filter @lararium/core test
```

## Directory roles

```text
tests/
  bin/                  shared shell helpers and named flow runner
  lararium-tw5/sync/    TW5 + daemon + CLI sync/decompose/promote flows
  src/                  source fixtures copied into isolated test wikis
  expected/             deterministic golden outputs for code-flow diffs
  results/              disposable captured outputs from flow runs
  .lararium/            disposable daemon state when LAR_ROOT=tests
  wikis/                disposable wiki mirror/output tree
  chats/                archived chat/HUD behavioral test plans and exemplars
```

## Isolation law

Integration flows MUST keep mutable runtime state under `tests/` or `/tmp`.

The default flow root is:

```sh
export LAR_ROOT="$REPO_ROOT/tests"
```

That means `.lararium/`, `wikis/`, and projected `packages/` artifacts from flows should appear under `tests/`, not the canonical repo root.

Do not write integration-flow output to top-level `packages/` or `wikis/` unless a test explicitly checks canonical promotion behavior and the operator has asked for it.

## Golden-output law

- Deterministic code-flow expected outputs live in `tests/expected/`.
- Stochastic chat / prompt exemplars live in `tests/chats/expected/`.
- New flow scripts should capture outputs in `tests/results/` first, then compare against `tests/expected/`.

When updating goldens, explain whether the change reflects an intentional behavior change or merely provenance-field drift.

## Flow authoring pattern

A new integration flow should:

1. set or inherit `LAR_ROOT=tests`;
2. reset only isolated test state;
3. start any daemon with logs under `/tmp` or `tests/results/`;
4. wait through `tests/bin/wait-daemon.sh` or equivalent bounded readiness check;
5. run CLI/API ceremony;
6. capture outputs under `tests/results/`;
7. diff against `tests/expected/`;
8. cleanly stop spawned processes on exit.

Prefer adding reusable helpers to `tests/bin/` instead of copying daemon setup code between flows.

## Current primary flow

`tests/lararium-tw5/sync/sync-decompose-promote.sh` exercises:

- isolated reset;
- daemon boot;
- `lares wiki init`;
- fixture meme copy;
- `lares wiki sync`;
- decomposition into parent + child meme files;
- optional `lares promote` into isolated `tests/packages/**`;
- normalized diff against `tests/expected/wikis/**`.
