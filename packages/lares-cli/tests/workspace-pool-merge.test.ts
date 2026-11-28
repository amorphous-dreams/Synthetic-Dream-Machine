/**
 * workspace-pool-merge — TAKE-DISK MERGES PER SLOT AGAINST A WORKSPACE'S OWN GIT BASE (face-pools; cabal-realm#/the-workbench).
 *
 * A shared wiki bound to a workspace (`lares wiki share notes workspace=notes`) projects its workbench at
 * `<root>/workspaces/notes` (or by default `<projections>/wikis/notes`). Where that folder's git tree stands (`lares surface
 * init`, Lares-Alpha's lane, stubbed here with a plain `git init`), the vessel commits it at each sitting's close
 * (`workspaceCommitSeam`), so a both-moved stand-off there reads its base's words from the folder's own history and merges per
 * slot, as one in a face pool does.
 *
 *   M1 a records edit to #/a and a disk edit to #/b both stand after take-disk, the base read from the workspace's commit
 *   M2 control: a workspace with no tree (a plain mirror) lands the file whole and names "no history"
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carrierHash } from "@lararium/mesh/crypto";
import { VERB_RESULT_KEY } from "@lararium/mesh/verb-tiddler";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { stampCarrier } from "@lararium/memetic-frame";
import * as node from "@lararium/node";
import { SyncedTree, syncedTreeKey } from "@lararium/node";
import { takeDisk, type TakeDiskDeps } from "../src/shore-take-disk.js";
import type { ShoreAnswer } from "../src/shore-core.js";
import type { SubmitIngestOpts } from "../src/ingest-core.js";
import type { SubmitResult } from "../src/verb-result.js";

const BAG = wikiSlotUri("notes", "working");
const URI = "lar:///ha.ka.ba/notes/pond";
const KEY = "c".repeat(24);
let tmp = "";
afterEach(() => { if (tmp) { rmSync(tmp, { recursive: true, force: true }); tmp = ""; } });

const slot = (name: string, line: string): string[] => [`<<~ ahu slot=\`#/${name}\`>>`, "", line, "", "<<~/ahu>>", ""];
const carrier = (a: string, b: string): string => stampCarrier([
  "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>",
  "",
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>`,
  "<<^ code=`&#x0002;`>>",
  "",
  "```toml meta",
  `title = "${URI}"`,
  "type  = \"text/memetic-wikitext+tiddlywiki\"",
  "```",
  "",
  ...slot("a", a),
  ...slot("b", b),
  "<<^ code=`&#x0003;`>>",
  "",
  "<<^ code=`&#x0004;` to=`?`>>",
  "",
].join("\n"));
const BASE = carrier("a holds.", "b holds.");

type WorkspaceSeam = { workspaceCommitSeam(dir: string, close: "lock" | "down"): Promise<{ committed: boolean }> };

/** THE STUB of the tree `lares surface init` founds over a workbench (Lares-Alpha's lane): plain `git init` and a local author. */
function stubTree(dir: string): void {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  for (const args of [["init", "-q"], ["config", "user.name", "workbench"], ["config", "user.email", "workbench@pool.invalid"], ["config", "commit.gpgsign", "false"]]) {
    expect(spawnSync("git", args, { cwd: dir, env, encoding: "utf8" }).status).toBe(0);
  }
}

async function rig(disk: string, records: string, commitBase: boolean): Promise<{ path: string; waves: SubmitIngestOpts[]; deps: TakeDiskDeps }> {
  tmp = mkdtempSync(join(tmpdir(), "workspace-merge-"));
  const ws = join(tmp, "workspaces", "notes");
  const dir = join(ws, "ha.ka.ba", "notes");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "pond.mem");
  const seam = node as unknown as WorkspaceSeam;
  if (commitBase) {
    stubTree(ws);
    writeFileSync(path, BASE);
    expect((await seam.workspaceCommitSeam(ws, "lock")).committed).toBe(true);
  }
  writeFileSync(path, disk);
  const tree = new SyncedTree(join(tmp, "synced"));
  tree.set(syncedTreeKey(BAG, URI), path, carrierHash(BASE), carrierHash(BASE));
  const row = {
    bagId: BAG, uri: URI, standoff: KEY, kind: "sides", reason: "both-moved", path,
    disk: carrierHash(disk), records: carrierHash(records), base: { disk: carrierHash(BASE), records: carrierHash(BASE) },
  };
  const ask = async (a: Readonly<Record<string, unknown>>): Promise<ShoreAnswer> => a["op"] === "render"
    ? { ok: true, refusal: null, why: null, output: { ok: true, op: "render", bag: BAG, uri: URI, key: KEY, records: carrierHash(records), text: records } }
    : { ok: true, refusal: null, why: null, output: { ok: true, standoffs: [row], standoffCount: 1, pending: [], pendingCount: 0, mark: "one-shore", next: null } };
  const waves: SubmitIngestOpts[] = [];
  const submit = async (o: SubmitIngestOpts): Promise<SubmitResult> => {
    waves.push(o);
    return { status: "done", requestId: "req-ws", results: { [VERB_RESULT_KEY]: { ok: true, output: { carriers: o.candidates.map((c) => ({ uri: c.uri, decision: "ingest", grade: "clean", landed: 1 })) } } } } as SubmitResult;
  };
  return { path, waves, deps: { ask, tree, root: tmp, did: "did:test", submit } };
}

describe("take-disk over a workspace merges per slot against the workspace's git base", () => {
  test("M1 — a records edit to #/a and a disk edit to #/b both stand", async () => {
    const r = await rig(carrier("a holds.", "b turns on the disk."), carrier("a turns in the records.", "b holds."), true);
    const taken = await takeDisk({ uri: URI, key: KEY }, r.deps);
    expect(taken).toMatchObject({ ok: true, merge: { kind: "slots" } });
    const onDisk = readFileSync(r.path, "utf8");
    expect(onDisk).toContain("a turns in the records.");
    expect(onDisk).toContain("b turns on the disk.");
  });

  test("M2 — control: a plain mirror (no tree) lands the file whole and names no history", async () => {
    const disk = carrier("a holds.", "b turns on the disk.");
    const r = await rig(disk, carrier("a turns in the records.", "b holds."), false);
    const taken = await takeDisk({ uri: URI, key: KEY }, r.deps);
    expect(taken).toMatchObject({ ok: true, merge: { kind: "whole" } });
    expect((taken as { merge: { why: string } }).merge.why).toMatch(/no git history/);
    expect(r.waves[0]!.candidates[0]!.text).toBe(disk);
  });
});
