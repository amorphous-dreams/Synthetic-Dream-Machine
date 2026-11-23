# The vendored automerge engine

The workspace runs one automerge engine for node, browser and keyhive. The `overrides` entry in `pnpm-workspace.yaml`
points `@automerge/automerge` at the tarball here, so every package that names the engine installs these bytes.

## What it carries

The published `@automerge/automerge` package at the upstream tag `js/automerge-3.5.0`, rebuilt with one patch:
`0001-hexane-release-the-pre-split-capacity-when-splitting.patch`.

A loaded document's value column starts as one oversize slab. The engine splits that slab on each edit with
`split_off` + `truncate`, and `truncate` keeps the allocation, so every edit leaves a short slab still owning a
column-sized buffer. The patch adds `slab.data.shrink_to_fit()` after the split, plus a unit test.

- Upstream issue: https://github.com/automerge/automerge/issues/1738
- Upstream pull request: https://github.com/automerge/automerge/pull/1739

Measured on the house's lares canon document (a snapshot and 429 changes): wasm memory 45 -> 3,694 MB on the stock
engine, 54 MB on this build, with the same heads and the same content.

The rebuilt package differs from the published one only in the wasm bytes (and the base64 copies of them) and in the
`JS_GIT_HEAD` string the build stamps (`9590cde8db3cf6ac32f5a4ffa496a8415a1c218e`, the patch commit on top of the tag).
Every JavaScript and type file reads the same. The published tarball also carries a stray `dist/mjs/index.d.ts` that a
clean build does not emit; the package's `types` entry names `dist/index.d.ts`, which both carry.

`tools/engine-retention-witness.sh` holds the pin: it checks the tarball against `SHA256SUMS`, reads the
resolved engine's wasm against `WASM_SHA256`, reads that a loaded
document's wasm memory holds steady across overwrites, and reads that a fixed op sequence yields the stock engine's
change and save bytes, so swapping back to the published package changes no stored byte.

## Files

- `automerge-3.5.0-split-capacity.tgz` — the `npm pack` output of the rebuilt package (about 15 MB).
- `SHA256SUMS` — its sha256.
- `WASM_SHA256` — the sha256 of `package/dist/cjs/automerge_wasm_bg.wasm` inside the tarball.
- `0001-hexane-release-the-pre-split-capacity-when-splitting.patch` — the patch, in `git format-patch` form.
- `Cargo.lock` — the crate set the build resolved (the upstream tag carries no lock).

## Rebuild

Toolchain the tarball was built with: rustup `nightly-2026-11-23` (default toolchain directory name), carrying `rustc 1.102.0-nightly (137d1d494 2026-11-22)` with the `rust-src`
component and the `wasm32-unknown-unknown` target; `wasm-bindgen-cli 0.2.127` (it must match the `wasm-bindgen` crate in
`Cargo.lock`); node `v24.15.0` with npm. No `wasm-opt` step runs.

```sh
git clone https://github.com/automerge/automerge.git && cd automerge
git checkout -b split-capacity js/automerge-3.5.0
GIT_COMMITTER_DATE="Mon, 23 Nov 2026 04:37:04 -0800" git -c user.name=local -c user.email=local@localhost \
  am --committer-date-is-author-date <repo>/third-party/automerge/0001-hexane-release-the-pre-split-capacity-when-splitting.patch
cp <repo>/third-party/automerge/Cargo.lock rust/Cargo.lock
cd javascript && npm install
RUSTFLAGS="--remap-path-prefix=$CARGO_HOME=/cargo --remap-path-prefix=$RUSTUP_HOME=/rustup --remap-path-prefix=$PWD/..=/build" \
  WASM_TOOLCHAIN=nightly-2026-11-23 npm run build && npm pack
```

The fixed committer date reproduces the patch commit `9590cde8`, so the stamped `JS_GIT_HEAD` matches. A different
nightly can emit different wasm bytes; the witness's byte and retention readings say whether such a build still holds.

### Clean-runner rebuild

`rebuild/` holds a Dockerfile and `rebuild.sh` that run the recipe above in a fresh `debian:bookworm` container and
compare the packed tarball, its wasm and the `JS_GIT_HEAD` stamp against the pins (non-zero exit on any mismatch):

```sh
docker build -t kiln-automerge third-party/automerge/rebuild
mkdir -p /tmp/kiln-work
docker run --rm -v "$PWD/third-party/automerge:/vendor:ro" -v /tmp/kiln-work:/work kiln-automerge
```

Two details the recipe above leaves out. Upstream carries no `javascript/package-lock.json`, so the build runs
`npm install`, which resolves floating devDependency ranges: the 2026-11-23 run still matched byte for byte, and a
later run may drift in the JS files while the wasm holds. The wasm embeds
absolute toolchain, registry and build-directory paths in its panic locations. `rebuild.sh` passes
`RUSTFLAGS="--remap-path-prefix=$CARGO_HOME=/cargo --remap-path-prefix=$RUSTUP_HOME=/rustup --remap-path-prefix=<build dir>=/build"`
(`javascript/scripts/build.mjs` prepends `$RUSTFLAGS` to its own flags, so they reach the wasm build), and the Dockerfile
seats the toolchain at `/opt/rustup` and `/opt/cargo`. The bytes then carry no home path and match across runs and
across build homes that keep the same remaps; a build without the remaps yields a wasm of the same behavior and different bytes.

## Dropping it

When an upstream release carries the fix, set the override in `pnpm-workspace.yaml` back to that published version,
run `pnpm install`, delete this directory, and point the witness's pin reading at the published version (or retire the
pin reading and keep the retention and byte readings). `STOCK_BYTES_SHA256` pins the byte reading to 3.5.0 encoding;
re-baseline it against the new upstream release when that release changes the encoding.
