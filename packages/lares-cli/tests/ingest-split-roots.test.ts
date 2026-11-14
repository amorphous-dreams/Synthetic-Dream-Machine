/**
 * ingest-split-roots (B.c2) — the container contract stands LAR_ROOT=/state, LAR_BAGS=/workspace/bags,
 * LAR_WIKIS=/workspace/wikis. The scan derives against the mirror dirs the vessel reads, not `<root>/bags`.
 * A scan that skipped every carrier reports no success (the command test below).
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanSource } from "../src/ingest-core.js";
import { fileToUriForSource, faceFolderOfSource, faceFolderRefusal } from "../src/ingest-core.js";
import { cmdIngest } from "../src/commands/ingest.js";
import { SyncedTree } from "@lararium/node";

const TO = "lar:///ha.ka.ba/bags/x/notes";
let tmp = "";
afterEach(() => { if (tmp) { rmSync(tmp, { recursive: true, force: true }); tmp = ""; } });

function carrier(dir: string): string {
  const d = join(dir, "x", "ha.ka.ba", "x");
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "y.mem"), "# y\n");
  return join(dir, "x");
}

describe("the gesture reads a face's folder only while the vessel wears that face", () => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
  test("a source at or beneath `<projections>/wikis/<slug>-<F>` names its face; another face worn refuses by name", () => {
    const of = faceFolderOfSource(`/lar/projections/wikis/lares-${A}/ha.ka.ba/lares/ref/x.mem`, "/lar/projections");
    expect(of).toEqual({ slug: "lares", relation: A, folder: `/lar/projections/wikis/lares-${A}` });
    expect(faceFolderOfSource(`/lar/projections/wikis/lares-${A}`, "/lar/projections")?.relation).toBe(A);
    expect(faceFolderRefusal(of!, B)).toMatch(new RegExp(`^ingest-face-folder: .*mirrors the lares wiki of the face ${A}, and this vessel wears ${B}`));
    expect(faceFolderRefusal(of!, null)).toMatch(/wears no face the gesture could read/);
  });
  test("CONTROL: the face's own wear passes; a folder that names no face, a bags source and an absent projections root name none", () => {
    const of = faceFolderOfSource(`/lar/projections/wikis/lares-${A}`, "/lar/projections")!;
    expect(faceFolderRefusal(of, A)).toBeNull();
    expect(faceFolderOfSource("/lar/projections/wikis/lares/ha.ka.ba/x.mem", "/lar/projections")).toBeNull();
    expect(faceFolderOfSource(`/lar/projections/bags/lares-${A}/x.mem`, "/lar/projections")).toBeNull();
    expect(faceFolderOfSource(`/checkout/wikis/lares-${A}/x.mem`, "/lar/projections")).toBeNull();
    expect(faceFolderOfSource(`/lar/projections/wikis/lares-${A}`, undefined)).toBeNull();
  });
});

describe("ingest scan against split mirror roots", () => {
  test("RED-then-GREEN: bags dir outside the root scans 1 (default derivation skips it)", () => {
    tmp = mkdtempSync(join(tmpdir(), "split-"));
    const src = carrier(join(tmp, "workspace", "bags"));
    const tree = new SyncedTree(join(tmp, "synced.json"));
    const state = join(tmp, "state");
    const old = scanSource(state, src, TO, tree)!;
    expect(old.rows.length).toBe(0); expect(old.skipped.length).toBe(1);          // today's defect
    const dirs = { bags: join(tmp, "workspace", "bags"), wikis: join(tmp, "workspace", "wikis") };
    const now = scanSource(state, src, TO, tree, fileToUriForSource(state, src, dirs))!;
    expect(now.rows.map((r) => r.uri)).toEqual(["lar:///ha.ka.ba/x/y"]);
  });

  test("CONTROL: the classic single-root layout still scans", () => {
    tmp = mkdtempSync(join(tmpdir(), "split-"));
    const src = carrier(join(tmp, "bags"));
    const tree = new SyncedTree(join(tmp, "synced.json"));
    expect(scanSource(tmp, src, TO, tree)!.rows.length).toBe(1);
  });

  test("lares ingest exits non-zero and names the dirs when every carrier skipped", async () => {
    tmp = mkdtempSync(join(tmpdir(), "split-"));
    const src = carrier(join(tmp, "elsewhere"));
    const saved = { r: process.env["LAR_ROOT"], b: process.env["LAR_BAGS"], w: process.env["LAR_WIKIS"] };
    process.env["LAR_ROOT"] = join(tmp, "state"); process.env["LAR_BAGS"] = join(tmp, "ws", "bags"); process.env["LAR_WIKIS"] = join(tmp, "ws", "wikis");
    const lines: string[] = []; const origLog = console.log, origErr = console.error, origOut = process.stderr.write.bind(process.stderr), origSo = process.stdout.write.bind(process.stdout);
    process.stderr.write = ((c: unknown) => { lines.push(String(c)); return true; }) as never; process.stdout.write = ((c: unknown) => { lines.push(String(c)); return true; }) as never;
    console.log = (...a) => { lines.push(a.join(" ")); }; console.error = (...a) => { lines.push(a.join(" ")); };
    try {
      const rc = await cmdIngest({ command: "ingest", positional: [], options: { source: src, to: TO }, flags: {} } as never);
      expect(rc).not.toBe(0);
      expect(lines.join("\n")).toContain(join(tmp, "ws", "bags"));
    } finally {
      console.log = origLog; console.error = origErr; process.stderr.write = origOut as never; process.stdout.write = origSo as never;
      for (const [k, v] of [["LAR_ROOT", saved.r], ["LAR_BAGS", saved.b], ["LAR_WIKIS", saved.w]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
  });
});
