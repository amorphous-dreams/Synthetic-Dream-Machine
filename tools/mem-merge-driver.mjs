#!/usr/bin/env node
// mem-merge-driver — git's low-level merge driver for `.mem` carriers: a conflict on the seal alone re-seals
// (lar:///ha.ka.ba/lares/api/pono/working-procedures#/the-seal-merge).
//
//   git calls:  node tools/mem-merge-driver.mjs %O %A %B %P %L
//               (base, ours — the file the result lands in —, theirs, the path in the tree, the marker size)
//
// A CARRIER'S SEAL MOVES WITH EVERY BODY EDIT. The ETX mark's `bcc=` slot checks the span it closes, so two branches
// that edit the body far apart and each re-seal both rewrite that one line, and git's text merge stops there though
// the bodies merge clean. The driver reads the three sides with that one seal line set bare and runs git's own
// three-way merge over them. A clean merge there means the seal alone conflicted: the driver takes the merged body,
// runs the normalize law `lares meme normalize` runs (frame canonical, then the block check minted over the body it
// follows) and writes the sealed carrier, exit 0. Anything else (a body hunk that conflicts, a frame normalize names
// a fault in, a span no check can cover, a shore that does not answer) writes git's own conflict over the original
// three sides, markers and all, and exits non-zero, so the merge stops exactly as it would without the driver.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEAL = /^<<\^ code=`&#x0003;` bcc=`[^`]*`>>$/;
const BARE = "<<^ code=`&#x0003;`>>";

/** The carrier with its ETX seal set bare: the LAST seal-shaped line, since a body may quote the mark in a fence. */
export function bareSeal(text) {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (SEAL.test(lines[i])) { lines[i] = BARE; return lines.join("\n"); }
  }
  return text;
}

/** git's own three-way merge over three texts: `{ text, conflicts }`, conflicts counted as `git merge-file` counts them. */
export function mergeTexts({ base, ours, theirs, path = "carrier", markerSize = 7 }) {
  const dir = mkdtempSync(join(tmpdir(), "mem-merge-"));
  try {
    for (const [name, text] of [["O", base], ["A", ours], ["B", theirs]]) writeFileSync(join(dir, name), text);
    const r = spawnSync("git", [
      "merge-file", "-p", `--marker-size=${markerSize}`,
      "-L", path, "-L", `${path} (base)`, "-L", `${path} (theirs)`,
      join(dir, "A"), join(dir, "O"), join(dir, "B"),
    ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.status === null || r.status < 0 || r.error) throw new Error(`git merge-file did not answer: ${r.error ?? r.stderr}`);
    return { text: r.stdout, conflicts: r.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

/**
 * One merge. `{ resolved: true, text }` when the seal alone conflicted and the merged body re-sealed; otherwise
 * `{ resolved: false, text, why }`, the text being git's own conflict over the original three sides.
 */
export function mergeCarrier({ base, ours, theirs, path, markerSize, seal }) {
  const plain = mergeTexts({ base, ours, theirs, path, markerSize });
  if (plain.conflicts === 0) return { resolved: true, text: plain.text };
  const leave = (why) => ({ resolved: false, text: plain.text, why });
  const bare = mergeTexts({ base: bareSeal(base), ours: bareSeal(ours), theirs: bareSeal(theirs), path, markerSize });
  if (bare.conflicts !== 0) return leave(`${bare.conflicts} conflict(s) beyond the seal`);
  if (!seal) return leave("the normalize shore does not answer");
  const sealed = seal(bare.text);
  return sealed.ok ? { resolved: true, text: sealed.text } : leave(sealed.why);
}

async function main(argv) {
  const [o, a, b, path = "carrier", size] = argv;
  if (!o || !a || !b) {
    process.stderr.write("usage: mem-merge-driver.mjs %O %A %B [%P] [%L]\n");
    return 2;
  }
  const markerSize = Number.parseInt(size ?? "7", 10) || 7;
  let seal = null;
  let shoreWhy = "";
  try { seal = await loadSealer(); } catch (err) { shoreWhy = String(err.message ?? err); }
  const out = mergeCarrier({
    base: readFileSync(o, "utf8"), ours: readFileSync(a, "utf8"), theirs: readFileSync(b, "utf8"),
    path, markerSize, seal,
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
