#!/usr/bin/env node
// engine-retention-witness — the automerge engine the workspace pins lets a loaded document's buffers go, and writes the
// same bytes the stock engine writes.
//
// THE FAULT IT HOLDS SHUT. A loaded document's value column starts as one oversize slab; the stock engine splits that
// slab on every edit with `split_off` + `truncate`, and `truncate` keeps the allocation, so each edit left a short slab
// owning a column-sized buffer (automerge/automerge#1738). The house's canon document grew 45 -> 3,694 MB of wasm memory
// on a stock load and stayed at 54 MB on the patched engine. `third-party/automerge/` carries that engine with the one line
// that cures it (`third-party/automerge/README.md`).
//
// THREE READINGS, each through the engine `@automerge/automerge` resolves to from `packages/lararium-mesh`:
//   pin        — the workspace override names the vendored tarball, and the tarball's sha256 matches `SHA256SUMS` beside it;
//   retention  — a document of 4,000 records x 2 KB, saved and loaded, takes 50 overwrites; wasm memory may grow by no
//                more than the bound below (the stock engine grows by hundreds of MB here);
//   bytes      — a fixed op sequence under fixed actors and a zero clock (fresh edits, then edits into a loaded document)
//                yields change and save bytes whose sha256 matches the stock engine's, so swapping back to the stock
//                package stays a plain swap with no format edge.
//
// `--engine <file>` measures another engine entry (a `fullfat_node.cjs`, or any module with the same API) instead of the
// pinned one, and skips the pin reading; the self-test and the red-against-stock reading use it.
//
// Exit 0 = all readings green.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RETENTION_BOUND_MB = 8;
const RECORDS = 4000;
const VALUE_BYTES = 2000;
const OVERWRITES = 50;
// sha256 over the stock engine's change bytes and save bytes for `fixedSequence` below (read off the published package).
const STOCK_BYTES_SHA256 = "c0c82d4c43739ebd3fc90e0626292eda83c14486754342813032b4a0d4e6f469";

// Every wasm instance the engine stands, caught as it stands, so its memory reads directly.
const instances = [];
const RealInstance = WebAssembly.Instance;
WebAssembly.Instance = new Proxy(RealInstance, {
  construct(target, args) { const inst = Reflect.construct(target, args); instances.push(inst); return inst; },
});
const wasmMB = () => instances.reduce((sum, inst) => {
  const mem = Object.values(inst.exports).find((x) => x instanceof WebAssembly.Memory);
  return sum + (mem ? mem.buffer.byteLength : 0);
}, 0) / 1048576;

const args = process.argv.slice(2);
const engineAt = args.indexOf("--engine");
const enginePath = engineAt >= 0 ? resolve(args[engineAt + 1] ?? "") : null;

const problems = [];
const say = (line) => process.stdout.write(`${line}\n`);

function readPin() {
  const ws = readFileSync(join(REPO, "pnpm-workspace.yaml"), "utf8");
  const m = /^\s*"@automerge\/automerge":\s*"([^"]+)"\s*$/m.exec(ws);
  if (!m) { problems.push("pin: pnpm-workspace.yaml carries no `@automerge/automerge` override"); return; }
  const spec = m[1];
  if (!spec.startsWith("file:")) { problems.push(`pin: the override names ${spec}, not a vendored file: tarball`); return; }
  const tarball = join(REPO, spec.slice("file:".length));
  const sums = join(dirname(tarball), "SHA256SUMS");
  if (!existsSync(tarball)) { problems.push(`pin: the override names ${spec}, and no file stands there`); return; }
  if (!existsSync(sums)) { problems.push(`pin: no SHA256SUMS stands beside ${spec}`); return; }
  const want = readFileSync(sums, "utf8").split("\n").map((l) => l.trim().split(/\s+/)).find(([, name]) => name === tarball.split("/").pop())?.[0];
  const got = createHash("sha256").update(readFileSync(tarball)).digest("hex");
  if (want !== got) problems.push(`pin: ${spec} hashes ${got}; SHA256SUMS records ${want ?? "no row for it"}`);
  else say(`[engine-retention] pin: ${spec} sha256 ${got} matches SHA256SUMS`);
}

const body = (i, round) => (`r${i}.${round} `).repeat(VALUE_BYTES).slice(0, VALUE_BYTES);
// A record's text rides as one scalar value (an `ImmutableString`), the way a stored tiddler body lands in the value column.
const scalar = (A, s) => new A.ImmutableString(s);

function readRetention(A) {
  let doc = A.from({ t: {} });
  doc = A.change(doc, (x) => { for (let i = 0; i < RECORDS; i++) x.t[`k${i}`] = { title: `k${i}`, tags: "a b c", text: scalar(A, body(i, 0)) }; });
  doc = A.load(A.save(doc));
  const before = wasmMB();
  for (let k = 1; k <= OVERWRITES; k++) doc = A.change(doc, (x) => { x.t[`k${k % RECORDS}`].text = scalar(A, body(k, k)); });
  const grew = wasmMB() - before;
  const line = `retention: ${RECORDS} records x ${VALUE_BYTES} B loaded, ${OVERWRITES} overwrites: wasm ${before.toFixed(1)} -> ${(before + grew).toFixed(1)} MB (+${grew.toFixed(1)}, bound ${RETENTION_BOUND_MB})`;
  if (instances.length === 0) problems.push("retention: the engine stood no wasm instance this witness could read");
  else if (grew > RETENTION_BOUND_MB) problems.push(line);
  else say(`[engine-retention] ${line}`);
}

function fixedSequence(A) {
  const ACTOR = "a11ce0000000000000000000000000a1";
  const LOADER = "b0b000000000000000000000000000b2";
  let d = A.init({ actor: ACTOR });
  d = A.change(d, { time: 0, message: "seed" }, (x) => {
    x.t = {};
    for (let i = 0; i < 64; i++) x.t[`k${i}`] = { title: `k${i}`, tags: "a b c", text: body(i, 0).slice(0, 300), body: scalar(A, body(i, 0)) };
    x.list = [1, 2, 3];
    x.n = new A.Counter(1);
    x.s = "hello";
  });
  d = A.change(d, { time: 0, message: "turn" }, (x) => {
    x.list.splice(1, 1, "two");
    x.n.increment(4);
    A.splice(x, ["s"], 5, 0, " world");
    delete x.t.k3;
  });
  let e = A.load(A.save(d), { actor: LOADER });
  for (let k = 1; k <= 8; k++) e = A.change(e, { time: 0 }, (x) => {
    x.t[`k${10 + k}`].text = body(k, k).slice(0, 300);
    x.t[`k${20 + k}`].body = scalar(A, body(k, k));
  });
  const h = createHash("sha256");
  for (const c of A.getAllChanges(e)) h.update(c);
  h.update(A.save(e));
  return h.digest("hex");
}

function readBytes(A) {
  const got = fixedSequence(A);
  if (got !== STOCK_BYTES_SHA256) problems.push(`bytes: the fixed sequence hashes ${got}; the stock engine's reads ${STOCK_BYTES_SHA256}`);
  else say(`[engine-retention] bytes: the fixed sequence hashes ${got}, the stock engine's own`);
}

if (enginePath === null) readPin();
const entry = enginePath ?? createRequire(join(REPO, "packages/lararium-mesh/package.json")).resolve("@automerge/automerge");
say(`[engine-retention] engine: ${entry}`);
const mod = await import(pathToFileURL(entry).href);
const A = mod.default && typeof mod.default.change === "function" ? mod.default : mod;
// A reading whose engine throws reads red by name; the next reading still runs.
for (const [name, read] of [["bytes", readBytes], ["retention", readRetention]]) {
  try { read(A); } catch (err) { problems.push(`${name}: the engine threw ${err?.message ?? err}`); }
}

if (problems.length > 0) {
  for (const p of problems) say(`  ✗ ${p}`);
  say(`[engine-retention] RED: ${problems.length} reading(s) at fault`);
  process.exit(1);
}
say("[engine-retention] the pinned engine lets a loaded document go and writes the stock engine's bytes");
