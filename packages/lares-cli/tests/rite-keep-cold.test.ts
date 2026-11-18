/**
 * rite-keep-cold — THE KEEP WAKES COLD WIKIS (K1). A page a face put into a wiki no island mounts rests in its layer and
 * projects nowhere, and the cut reads disk; so the keep's vessel half holds each cold wiki the house lists in turn (the daemon
 * aside) before it cuts, then hands the pins back to what stood held before.
 *
 *   C1  a lei standing: every cold listed wiki holds, in slug order, AFTER the line reads and BEFORE the cut; the cut hears the
 *       slugs that woke; after the cut the pins the walk added release and the pins that stood re-hold in their own order;
 *   C2  a hold that never lands (the grain would not activate, or the row refused) leaves that wiki out of the woken set, so
 *       the cut still names it cold; the walk goes on to the next;
 *   C3  a cut that throws still hands the pins back;
 *   C4  no lei standing: no pin moves, and no wiki list reads.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CARRY_SCHEMA, MANIFEST_FILE, REDECLARE_FILE, bundleIdOf, sha256Hex, zeroCounts, type CarryFile, type CarryManifest } from "../src/carry-manifest.js";
import { KeepRefused, riteKeep, type KeepPorts } from "../src/rite-keep.js";

let root: string;
const workspace = (): string => join(root, "workspaces", "backup");

function writeBundle(dest: string): CarryManifest {
  const files: CarryFile[] = [];
  const put = (rel: string, text: string): void => {
    const abs = join(dest, ...rel.split("/"));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
    files.push({ path: rel, sha256: sha256Hex(text), bytes: Buffer.byteLength(text) });
  };
  put(REDECLARE_FILE, `${JSON.stringify({ schema: CARRY_SCHEMA, faces: [] })}\n`);
  const manifest: CarryManifest = { schema: CARRY_SCHEMA, bundleId: bundleIdOf(files), faces: [], files, rows: [], counts: zeroCounts(), tempBytes: {}, omissions: [] };
  writeFileSync(join(dest, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/** A vessel with a pin budget of `budget`: `listed` wikis, `active` running now, `held` its rotatable pins (oldest first). */
function rig(over: { listed?: string[]; active?: string[]; held?: string[]; budget?: number; refuse?: string[]; lei?: boolean; cutThrows?: boolean } = {}) {
  const calls: string[] = [];
  const state = { held: [...(over.held ?? [])], active: new Set(over.active ?? []), budget: over.budget ?? 2 };
  const listed = over.listed ?? ["daemon", "alpha", "bravo", "charlie", "delta"];
  const ports: KeepPorts = {
    row: async (verb) => {
      calls.push(verb);
      if (verb === "swarm-show") return { ok: true, output: { lei: over.lei === false ? { standing: false, refusal: "absent" } : { standing: true } } };
      if (verb === "rite-receipt") return { ok: true, output: {} };
      return { ok: true, output: { tessera: "e".repeat(64), lei: "d".repeat(64), n: 1 } };
    },
    cut: async (dest, opts) => {
      calls.push(`cut woken=${(opts.woken ?? []).join(",")} held=${state.held.join(",")}`);
      if (over.cutThrows === true) throw new Error("the cut fell over");
      mkdirSync(dest, { recursive: true });
      return writeBundle(dest);
    },
    wikis: {
      read: async () => { calls.push("read"); return { listed: [...listed], active: [...state.active], held: [...state.held] }; },
      hold: async (slug) => {
        calls.push(`hold ${slug}`);
        if ((over.refuse ?? []).includes(slug)) return false;
        state.held = state.held.filter((s) => s !== slug);
        while (state.held.length >= state.budget) state.held.shift();
        state.held.push(slug);
        state.active.add(slug);
        return true;
      },
      release: async (slug) => { calls.push(`release ${slug}`); state.held = state.held.filter((s) => s !== slug); },
    },
  };
  return { calls, ports, state };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lar-keep-cold-"));
  writeFileSync(join(root, ".lar-test-scratch"), "keep cold suite\n");
  process.env["LAR_ROOT"] = root;
  mkdirSync(join(root, "hearth"), { recursive: true });
  mkdirSync(join(workspace(), ".git"), { recursive: true });
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe("the keep wakes cold wikis", () => {
  test("C1 RED: each cold listed wiki holds in turn after the line and before the cut, the cut hears the woken slugs, and the pins that stood come back; CONTROL: the daemon and a running wiki take no hold", async () => {
    const r = rig({ active: ["bravo"], held: ["bravo"] });
    const out = await riteKeep(r.ports, { workspace: "backup" });
    expect(out.kept).toBe(true);
    expect(r.calls.slice(0, 6)).toEqual(["swarm-show", "read", "hold alpha", "hold charlie", "hold delta", "cut woken=alpha,charlie,delta held=charlie,delta"]);
    expect(r.calls).not.toContain("hold daemon");
    // The walk's own pins release, and bravo, held before, holds again.
    expect(r.calls.slice(6, 10)).toEqual(["read", "release charlie", "release delta", "hold bravo"]);
    expect(r.state.held).toEqual(["bravo"]);
    expect(r.calls.slice(10)).toEqual(["rite-receipt", "rite-begin"]);
  });

  test("C2 RED: a hold that never lands stays out of the woken set, and the walk goes on; CONTROL: the pins still come back", async () => {
    const r = rig({ held: ["alpha", "bravo"], active: ["alpha", "bravo"], refuse: ["charlie"] });
    await riteKeep(r.ports, { workspace: "backup" });
    expect(r.calls).toContain("cut woken=delta held=bravo,delta");
    expect(r.state.held).toEqual(["alpha", "bravo"]);
  });

  test("C3 RED: a cut that throws still hands the pins back", async () => {
    const r = rig({ held: ["alpha"], active: ["alpha"], cutThrows: true });
    await expect(riteKeep(r.ports, { workspace: "backup" })).rejects.toThrow("the cut fell over");
    expect(r.state.held).toEqual(["alpha"]);
    expect(r.calls.filter((c) => c.startsWith("release"))).toEqual(["release charlie", "release delta"]);
  });

  test("C4 RED: with no lei standing no pin moves and no wiki list reads", async () => {
    const r = rig({ lei: false });
    await expect(riteKeep(r.ports, { workspace: "backup" })).rejects.toBeInstanceOf(KeepRefused);
    expect(r.calls).toEqual(["swarm-show"]);
  });
});
