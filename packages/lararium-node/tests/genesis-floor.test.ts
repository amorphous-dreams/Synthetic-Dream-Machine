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
const opts = (repoRoot: string) => ({ repoRoot, engine: "engine", grammar: "grammar", plugins: "plugins" });
let root = "";
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = ""; fixtureFiles = []; forgetCarrierFiles(); });

function fixture(lares: string[], lararium: string[]) {
  root = mkdtempSync(join(tmpdir(), "genesis-floor-"));
  const files: string[] = [];
  for (const [bag, sources] of [["lares", lares], ["lararium", lararium]] as const) {
    sources.forEach((source, i) => {
      const titleMatch = /^```toml meta\n[\s\S]*?title\s*=\s*"([^"]+)"/m.exec(source);
      if (!titleMatch) throw new Error("fixture carrier lacks a root title");
      const rel = `bags/${bag}/${titleMatch[1].slice("lar:///".length)}.mem`;
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

const realA = readFileSync(join(REPO, "bags/lares/ha.ka.ba/lares/ref/RFC-2119.mem"), "utf8");
const realB = readFileSync(join(REPO, "bags/lares/ha.ka.ba/lares/ref/RFC-3986.mem"), "utf8");
const realC = readFileSync(join(REPO, "bags/lararium/ha.ka.ba/lararium/keyhive/event-store.mem"), "utf8");

describe("genesis floor carrier cut", () => {
  test("repeats bytes and keeps each carrier's declared title", () => {
    fixture([realA, realB], [realC]);
    const first = cutGenesisFloor(opts(root));
    forgetCarrierFiles(root);
    const second = cutGenesisFloor(opts(root));
    expect([...first.lares.bytes]).toEqual([...second.lares.bytes]);
    expect([...first.lararium.bytes]).toEqual([...second.lararium.bytes]);
    const laresRows = openFloorSnapshot(first.lares.bytes, first.lares.cid);
    const larariumRows = openFloorSnapshot(first.lararium.bytes, first.lararium.cid);
    expect("rows" in laresRows && Object.keys(laresRows.rows)).toContain("lar:///ha.ka.ba/lares/ref/RFC-2119");
    expect("rows" in laresRows && Object.keys(laresRows.rows)).toContain("lar:///ha.ka.ba/lares/ref/RFC-3986");
    expect("rows" in larariumRows && Object.keys(larariumRows.rows)).toContain("lar:///ha.ka.ba/lararium/keyhive/event-store");
    expect(first.laresRows).toBeGreaterThan(0);
    expect(first.larariumRows).toBeGreaterThan(0);
  });

  test("refuses a title carried by both bags while the two-bag control cuts", () => {
    fixture([realA], [realC]);
    expect(() => cutGenesisFloor(opts(root))).not.toThrow();

    rmSync(root, { recursive: true, force: true });
    root = "";
    fixture([realA], [realA]);
    expect(() => cutGenesisFloor(opts(root))).toThrow(
      "[genesis-floor] title lar:///ha.ka.ba/lares/ref/RFC-2119 rides both bags/lares and bags/lararium",
    );
  });

  test("refuses a torn carrier by path", () => {
    // No end-of-text mark: the frame tears (`verdict` reads it torn).
    const torn = realA.replace(/<<\^ code="&#x0003;">>[\s\S]*$/, "");
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
    expect(result.larariumRows).toBe(0);
    expect(result.lararium.bytes).toBeInstanceOf(Uint8Array);
    expect(result.manifest.lararium).toBe(result.lararium.cid);
  });
});
