#!/usr/bin/env bash
# Rebuild the vendored automerge tarball in a clean runner and compare against the pins.
# Expects /vendor (read-only copy of third-party/automerge/) and /work (scratch). Exits non-zero on any mismatch.
set -euo pipefail
V=/vendor; W=/work
rustc -V; wasm-bindgen -V; node -v
rm -rf "$W/automerge" "$W/out"; mkdir -p "$W/out"
git clone https://github.com/automerge/automerge.git "$W/automerge"
cd "$W/automerge"
git checkout -b split-capacity js/automerge-3.5.0
GIT_COMMITTER_DATE="Mon, 23 Nov 2026 04:37:04 -0800" git -c user.name=local -c user.email=local@localhost \
  am --committer-date-is-author-date "$V/0001-hexane-release-the-pre-split-capacity-when-splitting.patch"
cp "$V/Cargo.lock" rust/Cargo.lock
cd javascript
# upstream carries no javascript/package-lock.json, so `npm ci` refuses; install resolves the devDependency ranges
npm install --no-audit --no-fund
# javascript/scripts/build.mjs prepends $RUSTFLAGS to its own flags, so the remaps reach the wasm build
RUSTFLAGS="--remap-path-prefix=$CARGO_HOME=/cargo --remap-path-prefix=$RUSTUP_HOME=/rustup --remap-path-prefix=$W/automerge=/build" \
  WASM_TOOLCHAIN=nightly-2026-11-23 npm run build
npm pack --pack-destination "$W/out"
cd "$W/out"
tgz=$(ls ./*.tgz); mkdir x && tar -xzf "$tgz" -C x
got_tgz=$(sha256sum "$tgz" | cut -d' ' -f1)
got_wasm=$(sha256sum x/package/dist/cjs/automerge_wasm_bg.wasm | cut -d' ' -f1)
if strings x/package/dist/cjs/automerge_wasm_bg.wasm | grep -q '/home/'; then echo "HOME PATH in wasm"; strings x/package/dist/cjs/automerge_wasm_bg.wasm | grep '/home/' | head; fi
want_tgz=$(cut -d' ' -f1 "$V/SHA256SUMS"); want_wasm=$(tr -d ' \n' < "$V/WASM_SHA256" | cut -c1-64)
head=$(sed -n 's/.*JS_GIT_HEAD = "\([0-9a-f]*\)".*/\1/p' x/package/dist/mjs/generated/release-info.js)
echo "tgz   got $got_tgz"; echo "tgz   pin $want_tgz"
echo "wasm  got $got_wasm"; echo "wasm  pin $want_wasm"
echo "head  got ${head:-<absent>}"
rc=0
[ "$got_tgz" = "$want_tgz" ] || { echo "MISMATCH tgz"; rc=1; }
[ "$got_wasm" = "$want_wasm" ] || { echo "MISMATCH wasm"; rc=1; }
[ "$head" = 9590cde8db3cf6ac32f5a4ffa496a8415a1c218e ] || { echo "MISMATCH JS_GIT_HEAD"; rc=1; }
[ $rc = 0 ] && echo "REPRODUCED"
exit $rc
