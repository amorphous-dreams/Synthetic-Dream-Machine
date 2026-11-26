/**
 * rite-keep-cold — THE KEEP WAKES COLD WIKIS (K1). A page a face put into a wiki no island mounts rests in its layer and
 * projects nowhere, and the cut reads disk; so the keep's vessel half activates each cold wiki the house lists in turn (the
 * daemon aside) before it cuts. A wake takes no keep: no face's keep list and no keep budget moves, so no page escapes the backup.
 *
 *   C1  a lei standing: every cold listed wiki wakes, in slug order, AFTER the line reads and BEFORE the cut; the cut hears the
 *       slugs that woke, and the walk takes no keep;
 *   C2  a wake that never lands (the grain would not activate) leaves that wiki out of the woken set, so the cut still names it
 *       cold; the walk goes on to the next;
 *   C3  a cut that throws leaves the keep list as it stood;
 *   C4  no lei standing: no wiki wakes, and no wiki list reads.
 */
import { closeScratch, openScratch, type Scratch } from "../../lararium-node/tests/support/scratch-fixture.js";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BUNDLE_SCHEMA, MANIFEST_FILE, REDECLARE_FILE, bundleIdOf, sha256Hex, zeroCounts, type BundleFile, type BundleManifest } from "../src/bundle-manifest.js";
import { KeepRefused, riteKeep, type KeepPorts } from "../src/rite-keep.js";

let house: Scratch;
let root: string;
const workspace = (): string => join(root, "workspaces", "backup");

function writeBundle(dest: string): BundleManifest {
  const files: BundleFile[] = [];
  const put = (rel: string, text: string): void => {
    const abs = join(dest, ...rel.split("/"));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
    files.push({ path: rel, sha256: sha256Hex(text), bytes: Buffer.byteLength(text) });
  };
  put(REDECLARE_FILE, `${JSON.stringify({ schema: BUNDLE_SCHEMA, faces: [] })}\n`);
  const manifest: BundleManifest = { schema: BUNDLE_SCHEMA, bundleId: bundleIdOf(files), faces: [], files, rows: [], counts: zeroCounts(), tempBytes: {}, omissions: [] };
  writeFileSync(join(dest, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/** A vessel with `listed` wikis and `active` ones running now; `kept` stands for a face's keep list, which a wake never moves. */
function rig(over: { listed?: string[]; active?: string[]; kept?: string[]; refuse?: string[]; lei?: boolean; cutThrows?: boolean } = {}) {
  const calls: string[] = [];
  const state = { kept: [...(over.kept ?? [])], active: new Set(over.active ?? []) };
  const listed = over.listed ?? ["daemon", "alpha", "bravo", "charlie", "delta"];
  const ports: KeepPorts = {
    row: async (verb) => {
      calls.push(verb);
      if (verb === "swarm-show") return { ok: true, output: { lei: over.lei === false ? { standing: false, refusal: "absent" } : { standing: true } } };
      return { ok: true, output: { tessera: "e".repeat(64), lei: "d".repeat(64), n: 1 } };
    },
    cut: async (dest, opts) => {
      calls.push(`cut woken=${(opts.woken ?? []).join(",")}`);
      if (over.cutThrows === true) throw new Error("the cut fell over");
      mkdirSync(dest, { recursive: true });
      return writeBundle(dest);
    },
    wikis: {
      read: async () => { calls.push("read"); return { listed: [...listed], active: [...state.active] }; },
      wake: async (slug) => {
        calls.push(`wake ${slug}`);
        if ((over.refuse ?? []).includes(slug)) return false;
        state.active.add(slug);
        return true;
      },
    },
  };
  return { calls, ports, state };
}

beforeEach(() => {
  house = openScratch();
  root = house.root;
  writeFileSync(join(root, ".lar-test-scratch"), "keep cold suite\n");
  mkdirSync(join(root, "hearth"), { recursive: true });
  mkdirSync(join(workspace(), ".git"), { recursive: true });
});
afterEach(() => { closeScratch(house); });

describe("the keep wakes cold wikis", () => {
  test("C1 RED: each cold listed wiki wakes in turn after the line and before the cut, and the cut hears the woken slugs; CONTROL: the daemon and a running wiki take no wake, and no keep moves", async () => {
    const r = rig({ active: ["bravo"], kept: ["bravo"] });
    const out = await riteKeep(r.ports, { workspace: "backup" });
    expect(out.kept).toBe(true);
    expect(r.calls.slice(0, 6)).toEqual(["swarm-show", "read", "wake alpha", "wake charlie", "wake delta", "cut woken=alpha,charlie,delta"]);
    expect(r.calls).not.toContain("wake daemon");
    expect(r.calls.slice(6)).toEqual(["rite-begin"]);
    expect(r.state.kept).toEqual(["bravo"]);
  });

  test("C2 RED: a wake that never lands stays out of the woken set, and the walk goes on", async () => {
    const r = rig({ active: ["alpha", "bravo"], refuse: ["charlie"] });
    await riteKeep(r.ports, { workspace: "backup" });
    expect(r.calls).toContain("cut woken=delta");
  });

  test("C3 RED: a cut that throws moves no keep", async () => {
    const r = rig({ kept: ["alpha"], active: ["alpha"], cutThrows: true });
    await expect(riteKeep(r.ports, { workspace: "backup" })).rejects.toThrow("the cut fell over");
    expect(r.state.kept).toEqual(["alpha"]);
  });

  test("C4 RED: with no lei standing no wiki wakes and no wiki list reads", async () => {
    const r = rig({ lei: false });
    await expect(riteKeep(r.ports, { workspace: "backup" })).rejects.toBeInstanceOf(KeepRefused);
    expect(r.calls).toEqual(["swarm-show"]);
  });
});
