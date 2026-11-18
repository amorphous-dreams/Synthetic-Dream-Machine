import { afterEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let fixtureFiles: string[] = [];
vi.mock("@lararium/tw5", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lararium/tw5")>();
  return { ...actual, carrierFiles: () => [...fixtureFiles] };
});
import { forgetCarrierFiles } from "@lararium/tw5";
import { cutGenesisFloor } from "../src/genesis-floor.js";
import { openFloorSnapshot } from "@lararium/mesh";

const REPO = new URL("../../..", import.meta.url).pathname;
const opts = (repoRoot: string) => ({ repoRoot, engine: "engine", plugins: "b".repeat(64) });
let root = "";
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = ""; fixtureFiles = []; forgetCarrierFiles(); });

function fixture(lares: string[], lararium: string[], others: Record<string, string[]> = {}) {
  root = mkdtempSync(join(tmpdir(), "genesis-floor-"));
  const files: string[] = [];
  for (const [bag, sources] of [["lares", lares], ["lararium", lararium], ...Object.entries(others)] as const) {
    sources.forEach((source, i) => {
      const titleMatch = /^```toml meta\n[\s\S]*?title\s*=\s*"([^"]+)"/m.exec(source);
      if (!titleMatch) throw new Error("fixture carrier lacks a root title");
      const rel = `bags/${bag}/${titleMatch[1]!.slice("lar:///".length)}.mem`;
      const destination = join(root, rel);
      mkdirSync(join(destination, ".."), { recursive: true });
      writeFileSync(destination, source);
      files.push(rel);
    });
  }
  fixtureFiles = files;
  forgetCarrierFiles(root);
  return files;
}

/** Declare a fixture bag's tier in its own `meta.mem`, the way a checkout's bag declares it (the referee bag's manifest, re-named). */
const refereeMeta = readFileSync(join(new URL("../../..", import.meta.url).pathname, "bags/elyncia-referee/meta.mem"), "utf8");
function declare(bag: string, tier: string): void {
  mkdirSync(join(root, "bags", bag), { recursive: true });
  writeFileSync(join(root, "bags", bag, "meta.mem"), refereeMeta.replaceAll("elyncia-referee", bag).replace('cap-tier   = "contract"', `cap-tier   = "${tier}"`));
}

const realA = readFileSync(join(REPO, "bags/lares/ha.ka.ba/lares/ref/RFC-2119.mem"), "utf8");
const realB = readFileSync(join(REPO, "bags/lares/ha.ka.ba/lares/ref/RFC-3986.mem"), "utf8");
const realC = readFileSync(join(REPO, "bags/lararium/ha.ka.ba/lararium/keyhive/event-store.mem"), "utf8");

describe("genesis floor carrier cut", () => {
  test("repeats bytes and keeps each carrier's declared title", () => {
    fixture([realA, realB], [realC]);
    const first = cutGenesisFloor(opts(root));
    forgetCarrierFiles(root);
    const second = cutGenesisFloor(opts(root));
    const s1 = first.snapshots, s2 = second.snapshots;
    expect([...s1["lares"]!.bytes]).toEqual([...s2["lares"]!.bytes]);
    expect([...s1["lararium"]!.bytes]).toEqual([...s2["lararium"]!.bytes]);
    const laresRows = openFloorSnapshot(s1["lares"]!.bytes, s1["lares"]!.cid);
    const larariumRows = openFloorSnapshot(s1["lararium"]!.bytes, s1["lararium"]!.cid);
    expect("rows" in laresRows && Object.keys(laresRows.rows)).toContain("lar:///ha.ka.ba/lares/ref/RFC-2119");
    expect("rows" in laresRows && Object.keys(laresRows.rows)).toContain("lar:///ha.ka.ba/lares/ref/RFC-3986");
    expect("rows" in larariumRows && Object.keys(larariumRows.rows)).toContain("lar:///ha.ka.ba/lararium/keyhive/event-store");
    expect(first.rows["lares"]).toBeGreaterThan(0);
    expect(first.rows["lararium"]).toBeGreaterThan(0);
  });

  test("V2 — one snapshot per house-canon bag: sdm keys its own, the public board (crossroads) keys none", () => {
    // A carrier moved under bags/sdm (its title follows its path) and one under bags/crossroads.
    const sdmCarrier = realB.replaceAll("lar:///ha.ka.ba/lares/ref/RFC-3986", "lar:///ha.ka.ba/sdm/ref/RFC-3986").replaceAll("ha.ka.ba/lares/ref/RFC-3986", "ha.ka.ba/sdm/ref/RFC-3986");
    const boardCarrier = realB.replaceAll("lar:///ha.ka.ba/lares/ref/RFC-3986", "lar:///ha.ka.ba/crossroads/ref/RFC-3986").replaceAll("ha.ka.ba/lares/ref/RFC-3986", "ha.ka.ba/crossroads/ref/RFC-3986");
    fixture([realA], [realC], { sdm: [sdmCarrier], crossroads: [boardCarrier] });
    declare("sdm", "public"); declare("crossroads", "public");
    const cut = cutGenesisFloor(opts(root));
    expect(Object.keys(cut.manifest.snapshots)).toEqual(["lararium", "lares", "sdm"]);
    expect(cut.manifest.format).toBe("lararium-floor");
    const sdm = openFloorSnapshot(cut.snapshots["sdm"]!.bytes, cut.snapshots["sdm"]!.cid);
    expect("rows" in sdm && Object.keys(sdm.rows)).toContain("lar:///ha.ka.ba/sdm/ref/RFC-3986");
    expect(cut.manifest.snapshots["sdm"]).toBe(cut.snapshots["sdm"]!.cid);
    expect(cut.snapshots).not.toHaveProperty("crossroads");
  });

  /**
   * THE FLOOR CARRIES PUBLIC BAGS ALONE. Every recipe composes the floor read-only by public CID, a faceless browser at the veil
   * among its readers, so a bag whose own `meta.mem` declares a tier under `public` never rides it: its rows reach a reader by
   * its realm document and the cap that tier names, or not at all. The bake reads the declaration; no slug list decides.
   */
  test("the floor manifest keys no snapshot for a contract-tier bag, nor for a bag that declares no tier (CONTROL: a public-tier bag beside them keys one)", () => {
    const move = (to: string) => realB.replaceAll("lar:///ha.ka.ba/lares/ref/RFC-3986", `lar:///ha.ka.ba/${to}/ref/RFC-3986`).replaceAll("ha.ka.ba/lares/ref/RFC-3986", `ha.ka.ba/${to}/ref/RFC-3986`);
    fixture([realA], [realC], { elyncia: [move("elyncia")], "elyncia-referee": [move("elyncia-referee")], undeclared: [move("undeclared")] });
    declare("elyncia", "public"); declare("elyncia-referee", "contract");
    const cut = cutGenesisFloor(opts(root));
    expect(Object.keys(cut.manifest.snapshots)).toEqual(["elyncia", "lararium", "lares"]);
    expect(cut.snapshots).not.toHaveProperty("elyncia-referee");
    expect(cut.snapshots).not.toHaveProperty("undeclared");
    const elyncia = openFloorSnapshot(cut.snapshots["elyncia"]!.bytes, cut.snapshots["elyncia"]!.cid);
    expect("rows" in elyncia && Object.keys(elyncia.rows)).toContain("lar:///ha.ka.ba/elyncia/ref/RFC-3986");
  });

  test("the checkout's own bake keys no referee snapshot (CONTROL: elyncia and sdm, public by their own manifests, key theirs)", async () => {
    const { genesisFloorSlugs } = await import("../src/genesis-floor.js");
    const slugs = genesisFloorSlugs(REPO);
    expect(slugs).not.toContain("elyncia-referee");
    expect(slugs).toEqual(expect.arrayContaining(["elyncia", "lararium", "lares", "sdm"]));
  });

  test("refuses a title carried by both bags while the two-bag control cuts", () => {
    fixture([realA], [realC]);
    expect(() => cutGenesisFloor(opts(root))).not.toThrow();

    rmSync(root, { recursive: true, force: true });
    root = "";
    fixture([realA], [realA]);
    expect(() => cutGenesisFloor(opts(root))).toThrow(
      "[genesis-floor] title lar:///ha.ka.ba/lares/ref/RFC-2119 rides both bags/lararium and bags/lares",
    );
  });

  test("refuses a torn carrier by path", () => {
    // No end-of-text mark: the frame tears (`verdict` reads it torn).
    const torn = realA.replace(/<<\^ code=`&#x0003;`[\s\S]*$/, "");
    const [path] = fixture([torn], []);
    expect(() => cutGenesisFloor(opts(root))).toThrow(`carrier frame torn ${path}`);
  });

  test("refuses a path whose carrier declares another title", () => {
    // The carrier keeps its path and declares another title in its meta.
    fixture([realA], []);
    const path = "bags/lares/ha.ka.ba/lares/ref/RFC-2119.mem";
    writeFileSync(join(root, path), realA.replace('title          = "lar:///ha.ka.ba/lares/ref/RFC-2119"', 'title          = "lar:///ha.ka.ba/lares/ref/other-title"'));
    expect(readFileSync(join(root, path), "utf8")).toContain("other-title");
    forgetCarrierFiles(root);
    expect(() => cutGenesisFloor(opts(root))).toThrow(`carrier title/path disagreement ${path}`);
  });

  test("an empty lararium snapshot remains valid", () => {
    fixture([realA], []);
    const result = cutGenesisFloor(opts(root));
    expect(result.rows["lararium"]).toBe(0);
    expect(result.snapshots["lararium"]!.bytes).toBeInstanceOf(Uint8Array);
    expect(result.manifest.snapshots["lararium"]).toBe(result.snapshots["lararium"]!.cid);
  });
});
