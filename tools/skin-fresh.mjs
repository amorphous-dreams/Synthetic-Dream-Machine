#!/usr/bin/env node
/**
 * skin-fresh — the tracked skin bundles answer to a fresh build of the tree's sources.
 *
 * THE GAP: `genesis-parity-witness` compares the TRACKED bundles (`packages/lararium-tw5/plugins`) with genesis, never with
 * a build, so a skin module that moved without a re-pack left stale bundles reading green. CI's "Generated artifacts must be
 * fresh" step reads this seam after `pnpm build`; this witness reads it locally and in one command, before a push.
 *
 * WHAT IT DOES: snapshots the tracked bytes the pipeline writes (the skins' `plugins/<stem>.json`, the `$:/` standalone
 * `.tid` and `.attestation.json`, `src/plugin-tiddler.generated.ts`, and the tracked island `.tid` sources the build
 * rewrites), runs the pipeline (`pnpm --filter @lararium/tw5 build:plugin`, the one CI runs inside `pnpm build`), compares
 * sha256 per file, then RESTORES every tracked byte it snapshotted, so the witness leaves the tree as it found it.
 * Red names each differing file with both digests and the cure line. `--root` names the tree; `--build` names another
 * command (the self-test's fixture builder).
 *
 * Exit 0 = every tracked bundle equals the fresh build. Exit 1 = drift (or an unreadable tree or a failed build).
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";

const TAG = "[skin-fresh]";
const CURE = "re-pack: pnpm --filter @lararium/tw5 build:plugin, then commit the bundles";
const DEFAULT_BUILD = "pnpm --filter @lararium/tw5 build:plugin";
const TW5 = "packages/lararium-tw5";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const root = resolve(flag("--root") ?? new URL("..", import.meta.url).pathname);
const build = flag("--build") ?? DEFAULT_BUILD;

const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const git = (...a) => spawnSync("git", ["-C", root, ...a], { encoding: "utf8" });
const red = (msg) => { console.log(`${TAG} RED  ${msg}`); process.exit(1); };

const ls = git("ls-files", "--", `${TW5}/plugins`, `${TW5}/src/plugin-tiddler.generated.ts`, `${TW5}/tiddlers`, `${TW5}/tiddlers-lararium`);
if (ls.status !== 0) red(`${root} reads as no git tree: ${ls.stderr.trim()}`);
const tracked = ls.stdout.split("\n").filter(Boolean);
// The bundles the pipeline emits: the skins' packed json, the standalone distribution, the generated module.
const isBundle = (f) =>
  f.startsWith(`${TW5}/plugins/standalone/`) || f === `${TW5}/src/plugin-tiddler.generated.ts` ||
  (f.startsWith(`${TW5}/plugins/`) && f.endsWith(".json") && !f.slice(`${TW5}/plugins/`.length).includes("/"));
if (!tracked.some(isBundle)) red(`no tracked skin bundle under ${TW5}/plugins: nothing to compare`);

const held = new Map(tracked.map((f) => [f, readFileSync(join(root, f))]));
const untrackedList = () => git("ls-files", "--others", "--exclude-standard", "--", `${TW5}/plugins`, `${TW5}/src`).stdout.split("\n").filter(Boolean);
const untrackedBefore = new Set(untrackedList());
let ran;
let freshUntracked = [];
try {
  ran = spawnSync("bash", ["-c", build], { cwd: root, encoding: "utf8" });
  if (ran.status !== 0) {
    red(`the pipeline failed (${build}, exit ${ran.status}); a build that did not run proves nothing.\n${(ran.stdout + ran.stderr).split("\n").slice(-15).join("\n")}`);
  }
  const drift = [];
  for (const [f, before] of held) {
    const at = join(root, f);
    const after = existsSync(at) ? readFileSync(at) : null;
    if (after === null || !after.equals(before)) {
      drift.push({ f, tracked: sha(before), fresh: after === null ? "(the build removed it)" : sha(after), bundle: isBundle(f) });
    }
  }
  // A fresh file the build wrote that git does not track also reads red: the bundle is missing from the commit.
  const untracked = untrackedList().filter((u) => !untrackedBefore.has(u));
  freshUntracked = untracked;
  if (drift.length === 0 && untracked.length === 0) {
    console.log(`${TAG} ${held.size} tracked file(s) equal the fresh build; ${[...held.keys()].filter(isBundle).length} bundle(s) compared`);
    for (const f of [...held.keys()].filter(isBundle)) console.log(`  ok  ${sha(held.get(f)).slice(0, 16)}…  ${f}`);
  } else {
    console.log(`${TAG} ${drift.length + untracked.length} RED:`);
    for (const d of drift) console.log(`  STALE${d.bundle ? " BUNDLE" : " SOURCE"}  ${d.f}\n        tracked  ${d.tracked}\n        fresh    ${d.fresh}`);
    for (const u of untracked) console.log(`  UNTRACKED  ${u} (the build wrote it and git does not track it)`);
    console.log(`  ${CURE}`);
    process.exitCode = 1;
  }
} finally {
  for (const u of freshUntracked) { try { unlinkSync(join(root, u)); } catch { /* already gone */ } }
  for (const [f, before] of held) {
    const at = join(root, f);
    if (!existsSync(at) || !readFileSync(at).equals(before)) writeFileSync(at, before);
  }
}
