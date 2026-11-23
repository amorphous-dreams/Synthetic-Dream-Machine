/**
 * doc-load-probe-child — the disposable boundary (L1). A short-lived child process that
 * attempts to materialize ONE persisted doc through Automerge and reports the verdict on
 * stdout as a single JSON line. It exists because an Automerge WASM `panic=abort` (a torn
 * doc read as a giant allocation) is NOT catchable in-process — it poisons the WASM linear
 * memory and terminates the runtime. Isolating the load in a child means the parent daemon
 * survives the abort: the child dies with a signal / non-zero code, the parent reads that
 * as `aborted` and quarantines the poison doc, and the house boots on.
 *
 * Protocol — argv: <storageDir> <documentId> [--clean-tail]. Output: exactly one JSON line.
 *   { ok: true, heads, chunks }            → exit 0   (loads clean)
 *   { ok: false, reason }                   → exit 2   (catchable load error — malformed but not a WASM abort)
 *   <no line, signal / non-zero exit>       →          (WASM abort — the uncatchable poison; parent infers it)
 *
 * `--clean-tail` (L3) runs the RECOVERY variant: gate each stored record through the L5b
 * framing check, load ONLY the clean prefix (records ahead of the first tear), and report
 * the torn tail files by name so the parent moves exactly those aside. A torn BASE (the
 * first record) leaves an empty prefix → unrecoverable, reported ok:false.
 *   { ok: true, heads, chunks: kept, tornTail: [paths] }   → exit 0   (clean prefix loads)
 *   { ok: false, reason }                                   → exit 2   (base torn / prefix rejects)
 *
 * `--fold <documentId>` runs THE DOUBLE: the parent's durable store pipes one document's records on stdin (each a
 * big-endian u32 length, then its bytes: exactly the records its own listing holds, staged temps excluded and saves in
 * flight included), and this child replays the clear ones in its own engine, saves them as one compacted snapshot, loads
 * that snapshot back and checks it reaches the same heads. The replay's memory lands here and dies with this process.
 *   { ok: true, heads, chunks, sealed?, spentBytes, snapshot: <base64> }   → exit 0
 *   { ok: false, reason }                                                  → exit 2   (no clear record, or heads differ)
 * `spentBytes` reads what the replay grew this child's engine (`memory.buffer.byteLength` across every wasm instance it
 * stands, before the replay and after): the sample the fold gate learns from. The child writes nothing to the store.
 *
 * A RECORD THAT RESTS SEALED NEVER LOADS HERE. A sealed bag's records hold a pointer or a sealed value, no Automerge byte,
 * and this child holds no key. Each record whose envelope reads well-formed (the mesh framing gate) counts in `sealed` and
 * stays out of every load; the clear records alone load, so a clear chunk that would abort still aborts here. A document
 * resting wholly sealed loads nothing and names no heads: `{ ok: true, heads: [], chunks, sealed }`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// THE ENGINE TAP: every wasm instance this process stands, so the fold reads what its replay cost. It stands before any
// engine module loads (the engine instantiates as its module evaluates), hence the dynamic imports below.
const engines: WebAssembly.Instance[] = [];
const NativeInstance = WebAssembly.Instance;
(WebAssembly as { Instance: unknown }).Instance = new Proxy(NativeInstance, {
  construct(target, args, newTarget) {
    const instance = Reflect.construct(target, args, newTarget) as WebAssembly.Instance;
    engines.push(instance);
    return instance;
  },
});
function engineBytes(): number {
  let sum = 0;
  for (const instance of engines) {
    const memory = instance.exports["memory"];
    if (memory instanceof WebAssembly.Memory) sum += memory.buffer.byteLength;
  }
  return sum;
}

const { init, load, loadIncremental, getHeads, save, free } = await import("@automerge/automerge");
const { partitionCleanTail, precheckChunkBytes } = await import("@lararium/mesh");

function listBlobs(dir: string): string[] {
  try {
    return readdirSync(dir)
      .map((name) => join(dir, name))
      .filter((p) => {
        try { return statSync(p).isFile(); } catch { return false; }
      })
      .sort();
  } catch {
    return [];
  }
}

function emit(line: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(line) + "\n");
}

const restsSealed = (data: Uint8Array): boolean => precheckChunkBytes(data).sealed === true;

/** Read every record the parent pipes: each a big-endian u32 length, then its bytes. A cut frame reads as no frames. */
async function readFrames(): Promise<Uint8Array[] | null> {
  const parts: Buffer[] = [];
  for await (const part of process.stdin) parts.push(part as Buffer);
  const all = Buffer.concat(parts);
  const frames: Uint8Array[] = [];
  let off = 0;
  while (off < all.length) {
    if (all.length - off < 4) return null;
    const length = all.readUInt32BE(off);
    off += 4;
    if (all.length - off < length) return null;
    frames.push(all.subarray(off, off + length));
    off += length;
  }
  return frames;
}

async function fold(): Promise<number> {
  const frames = await readFrames();
  if (frames === null) {
    emit({ ok: false, reason: "the records arrived cut short" });
    return 2;
  }
  const sealed = frames.filter(restsSealed).length;
  const clear = frames.filter((data) => !restsSealed(data));
  if (clear.length === 0) {
    emit({ ok: false, chunks: frames.length, reason: "no clear record to fold" });
    return 2;
  }
  // The replay the live engine never runs: below this line a torn record may abort this child, which the parent reads as
  // a fold that failed, never as a verdict on the document.
  const before = engineBytes();
  const doc = loadIncremental(init(), Buffer.concat(clear));
  const spentBytes = engineBytes() - before;
  const heads = getHeads(doc);
  const snapshot = save(doc);
  free(doc);
  const back = getHeads(load(snapshot));
  if (back.length !== heads.length || back.some((h, i) => h !== heads[i])) {
    emit({ ok: false, chunks: frames.length, reason: "the folded snapshot loads to other heads" });
    return 2;
  }
  emit({ ok: true, heads, chunks: frames.length, ...(sealed > 0 ? { sealed } : {}), spentBytes, snapshot: Buffer.from(snapshot).toString("base64") });
  return 0;
}

function main(): number {
  const storageDir = process.argv[2];
  const documentId = process.argv[3];
  const cleanTail = process.argv.includes("--clean-tail");
  if (!storageDir || !documentId) {
    emit({ ok: false, reason: "usage: doc-load-probe-child <storageDir> <documentId> [--clean-tail] | --fold <documentId>" });
    return 2;
  }
  const base = join(storageDir, documentId.slice(0, 2), documentId.slice(2));
  const snapshots = listBlobs(join(base, "snapshot"));
  const incrementals = listBlobs(join(base, "incremental"));
  // Path+bytes pairs in the canonical load order (snapshot(s) then incrementals) — the same
  // order the whole-doc concat below uses, so the clean-tail cut names the true tail.
  const files = [...snapshots, ...incrementals].map((path) => ({ path, data: readFileSync(path) }));
  const chunks = files.length;

  if (chunks === 0) {
    // No stored bytes — a fresh/blank doc materializes empty. Not a tear.
    emit({ ok: true, heads: [], chunks: 0, ...(cleanTail ? { tornTail: [] } : {}) });
    return 0;
  }

  if (cleanTail) {
    // L3 recovery — split records at the first tear (the mesh partition owns the cut law),
    // load ONLY the clean prefix (framing-clean bytes cannot drive the capacity_overflow
    // abort), and name the torn tail for the parent to move aside. The file path rides in
    // `name` so the partition's verdict maps straight back to the file to relocate.
    const { keep, tornTail } = partitionCleanTail(files.map((f) => ({ kind: "incremental" as const, name: f.path, data: f.data })));
    if (keep.length === 0) {
      emit({ ok: false, chunks, reason: "torn base record — no clean prefix to recover" });
      return 2;
    }
    const sealed = keep.filter((b) => restsSealed(b.data)).length;
    try {
      let doc = init();
      for (const blob of keep) if (!restsSealed(blob.data)) doc = loadIncremental(doc, blob.data);
      emit({ ok: true, heads: getHeads(doc), chunks: keep.length, tornTail: tornTail.map((b) => b.name), ...(sealed > 0 ? { sealed } : {}) });
      return 0;
    } catch (e) {
      emit({ ok: false, chunks, reason: `clean prefix rejected: ${(e as Error)?.message ?? e}` });
      return 2;
    }
  }

  const sealed = files.filter((f) => restsSealed(f.data)).length;
  const blobs = files.map((f) => f.data).filter((data) => !restsSealed(data));
  const sealedLine = sealed > 0 ? { sealed } : {};
  if (blobs.length === 0) {
    emit({ ok: true, heads: [], chunks, ...sealedLine });
    return 0;
  }

  // Concatenate snapshot(s)+incrementals and load — the shape automerge-repo persists.
  // Below this line a torn doc may abort the WASM runtime; that abort is the SIGNAL the
  // parent reads. A catchable JS throw is a softer malformed-but-not-poison verdict.
  const merged = Buffer.concat(blobs);
  try {
    const doc = load(merged);
    emit({ ok: true, heads: getHeads(doc), chunks, ...sealedLine });
    return 0;
  } catch (loadErr) {
    // `load` rejected the concatenation — retry progressively (snapshot as base, then each
    // incremental) so a single bad chunk is distinguishable from a whole-doc reject.
    try {
      let doc = init();
      for (const blob of blobs) doc = loadIncremental(doc, blob);
      emit({ ok: true, heads: getHeads(doc), chunks, ...sealedLine });
      return 0;
    } catch (incErr) {
      emit({
        ok: false,
        chunks,
        reason: `load failed: ${(loadErr as Error)?.message ?? loadErr}; incremental: ${(incErr as Error)?.message ?? incErr}`,
      });
      return 2;
    }
  }
}

if (process.argv[2] === "--fold") {
  try { process.exitCode = await fold(); }
  catch (e) {
    emit({ ok: false, reason: `fold rejected: ${(e as Error)?.message ?? e}` });
    process.exitCode = 2;
  }
} else {
  process.exit(main());
}
