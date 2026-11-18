#!/usr/bin/env node
// mem-merge-driver — git's low-level merge driver for `.mem` carriers: a conflict on the seal alone re-seals
// (lar:///ha.ka.ba/lares/api/pono/working-procedures#/the-seal-merge).
//
//   git calls:  node tools/mem-merge-driver.mjs %O %A %B %P %L
//               (base, ours — the file the result lands in —, theirs, the path in the tree, the marker size)
//
// A CARRIER'S SEAL MOVES WITH EVERY BODY EDIT. The ETX mark's `bcc=` slot checks the span it closes, so two branches
// that edit the body far apart and each re-seal both rewrite that one line, and git's text merge stops there though
// the bodies merge clean. The merge itself lives in ONE module, `@lararium/mesh/meme-merge` (git's line merge at
// `@lararium/mesh/meme-merge-git`), which the vessel's own carrier merge reads too; this driver shells over it for git
// (weld: tools/mem-merge-weld.test.mjs). The module reads the three sides with the seal line set bare and merges them,
// whole and then slot by slot; a clean merge there means the seal alone stood in the way: the driver hands the merged
// body to the normalize law `lares meme normalize` runs (frame canonical, then the block check minted over the body it
// follows) and writes the sealed carrier, exit 0. Anything else (a hunk that conflicts within one slot, a frame
// normalize names a fault in, a span no check can cover, a shore that does not answer) writes git's own conflict over
// the original three sides, markers and all, and exits non-zero, so the merge stops exactly as it would without the
// driver. A checkout whose mesh build stands absent runs `git merge-file` in place: git's own conflict, nothing more.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The one merge module from this checkout's build: `{ mergeCarrier, mergeTexts }`. */
export async function loadMerge(repo = REPO) {
  const merge = join(repo, "packages/lararium-mesh/dist/meme-merge.js");
  const git = join(repo, "packages/lararium-mesh/dist/meme-merge-git.js");
  for (const at of [merge, git]) {
    if (!existsSync(at)) throw new Error(`no built shore at ${at} (cure: pnpm --filter @lararium/mesh build)`);
  }
  const { mergeCarrier } = await import(pathToFileURL(merge).href);
  const { mergeTexts } = await import(pathToFileURL(git).href);
  return { mergeCarrier, mergeTexts };
}

/** The normalize law's shore: the frame package's check and the tw5 package's normalize, from this checkout's build. */
export async function loadSealer(repo = REPO) {
  const frame = join(repo, "packages/lararium-memetic-frame/dist/index.js");
  const normalize = join(repo, "packages/lararium-tw5/dist/meme-normalize.js");
  for (const at of [frame, normalize]) {
    if (!existsSync(at)) throw new Error(`no built shore at ${at} (cure: pnpm -r build)`);
  }
  const { stampCarrier, verifyBcc } = await import(pathToFileURL(frame).href);
  const { normalizeMemeSource } = await import(pathToFileURL(normalize).href);
  return (text) => {
    const res = normalizeMemeSource(text, { grammar: false });
    if (res.faults.length > 0) return { ok: false, why: res.faults.map((f) => `${f.code}: ${f.message}`).join("; ") };
    const sealed = stampCarrier(res.text);
    const verdict = verifyBcc(sealed);
    return verdict === "ok" || verdict === "head-unbound"
      ? { ok: true, text: sealed }
      : { ok: false, why: `the merged carrier reads ${verdict}; no check can seal it` };
  };
}

async function main(argv) {
  const [o, a, b, path = "carrier", size] = argv;
  if (!o || !a || !b) {
    process.stderr.write("usage: mem-merge-driver.mjs %O %A %B [%P] [%L]\n");
    return 2;
  }
  const markerSize = Number.parseInt(size ?? "7", 10) || 7;
  let merge;
  try { merge = await loadMerge(); } catch (err) {
    // No module to merge with: git's own text merge in place over ours, markers and all.
    spawnSync("git", ["merge-file", `--marker-size=${markerSize}`, "-L", path, "-L", `${path} (base)`, "-L", `${path} (theirs)`, a, o, b]);
    process.stderr.write(`mem-merge-driver: ${path} stays conflicted — ${err?.message ?? err}\n`);
    return 1;
  }
  let seal = null;
  let shoreWhy = "";
  try { seal = await loadSealer(); } catch (err) { shoreWhy = String(err.message ?? err); }
  const out = merge.mergeCarrier({
    base: readFileSync(o, "utf8"), ours: readFileSync(a, "utf8"), theirs: readFileSync(b, "utf8"),
    path, markerSize, lineMerge: merge.mergeTexts, seal,
  });
  writeFileSync(a, out.text);
  if (out.resolved) return 0;
  process.stderr.write(`mem-merge-driver: ${path} stays conflicted — ${shoreWhy || out.why}\n`);
  return 1;
}

// The entry test reads real paths: node runs a linked script at its target, while argv keeps the link.
if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    process.stderr.write(`mem-merge-driver: ${err?.stack ?? err}\n`);
    process.exit(1);
  });
}
