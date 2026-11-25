import { afterEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let fixtureFiles: string[] = [];
vi.mock("@lararium/tw5", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lararium/tw5")>();
  return { ...actual, carrierFiles: () => [...fixtureFiles] };
});
import { forgetCarrierFiles, rootMetaFields, storeMemeSink } from "@lararium/tw5";
// The one placement function every INGEST door lays through (the tw5 barrel keeps it host-internal).
import { placeMeme } from "../../lararium-tw5/src/place-meme.js";
import { carryGenesisFloor, cutGenesisFloor } from "../src/genesis-floor.js";
import { AutomergeDocStore, bagUri, emptyLarDoc, openFloorSnapshot, readFloorDriftReading, type LarDoc, type LarTiddlerRecord } from "@lararium/mesh";
import { Repo } from "@automerge/automerge-repo";

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

/**
 * THE FLOOR RIDES RELEASES (lar:///ha.ka.ba/lararium/node/genesis-island#/the-floor-rides-releases). A develop bake carries the
 * standing seed's snapshots forward byte for byte and re-stamps the manifest's code fields; only a release bake re-cuts from canon.
 * The fixture stands a genesis dir the way a bake leaves one: seed.json naming the floor rows, each row's bytes at cas/<sha256>.
 */
describe("genesis floor carry", () => {
  let genesisDir = "";
  afterEach(() => { if (genesisDir) rmSync(genesisDir, { recursive: true, force: true }); genesisDir = ""; });

  function standGenesis(cut: ReturnType<typeof cutGenesisFloor>): string {
    genesisDir = mkdtempSync(join(tmpdir(), "genesis-floor-carry-"));
    mkdirSync(join(genesisDir, "cas"));
    const blobs: Record<string, unknown> = {
      "floor-manifest": { id: "floor-manifest", version: "1", sha256: cut.manifestCid, mimeType: "application/vnd.lararium.floor-manifest+json", kind: "floor" },
    };
    writeFileSync(join(genesisDir, "cas", cut.manifestCid), cut.manifestBytes);
    for (const [slug, snap] of Object.entries(cut.snapshots)) {
      blobs[`floor-${slug}`] = { id: `floor-${slug}`, version: "1", sha256: snap.cid, mimeType: "application/vnd.lararium.floor-snapshot", kind: "floor" };
      writeFileSync(join(genesisDir, "cas", snap.cid), snap.bytes);
    }
    writeFileSync(join(genesisDir, "seed.json"), JSON.stringify({ format: "lararium-genesis-seed", actorSeed: "a".repeat(64), blobs, tiddlers: {} }));
    return genesisDir;
  }

  test("a canon edit after the release moves no carried snapshot (CONTROL: a fresh cut of the edited tree moves lares)", () => {
    const [laresPath] = fixture([realA], [realC]);
    const released = cutGenesisFloor(opts(root));
    const dir = standGenesis(released);
    writeFileSync(join(root, laresPath!), realA.replace("! RFC 2119 — Key Words", "! RFC 2119 (edited on develop) — Key Words"));
    forgetCarrierFiles(root);

    const carried = carryGenesisFloor({ genesisDir: dir, engine: "engine", plugins: "b".repeat(64) });
    expect(carried.manifest.snapshots).toEqual(released.manifest.snapshots);
    for (const slug of Object.keys(released.snapshots)) expect([...carried.snapshots[slug]!.bytes]).toEqual([...released.snapshots[slug]!.bytes]);
    expect(carried.rows).toEqual(released.rows);
    expect(carried.manifestCid).toBe(released.manifestCid);

    const recut = cutGenesisFloor(opts(root));
    expect(recut.manifest.snapshots["lares"]).not.toBe(released.manifest.snapshots["lares"]);
  });

  test("a code move re-stamps the manifest's engine and plugins over the carried snapshots", () => {
    fixture([realA], [realC]);
    const released = cutGenesisFloor(opts(root));
    const dir = standGenesis(released);
    const carried = carryGenesisFloor({ genesisDir: dir, engine: "engine-two", plugins: "c".repeat(64) });
    expect(carried.manifest).toEqual({ format: "lararium-floor", engine: "engine-two", plugins: "c".repeat(64), snapshots: released.manifest.snapshots });
    expect(carried.manifestCid).not.toBe(released.manifestCid);
  });

  test("refuses by name a snapshot whose bytes fail their CID, and a genesis that stands no floor", () => {
    fixture([realA], [realC]);
    const released = cutGenesisFloor(opts(root));
    const dir = standGenesis(released);
    writeFileSync(join(dir, "cas", released.snapshots["lares"]!.cid), "torn");
    expect(() => carryGenesisFloor({ genesisDir: dir, engine: "engine", plugins: "b".repeat(64) })).toThrow(/genesis-floor-uncarried.*floor-lares/);
    rmSync(join(dir, "seed.json"));
    expect(() => carryGenesisFloor({ genesisDir: dir, engine: "engine", plugins: "b".repeat(64) })).toThrow(/genesis-floor-uncarried.*build:genesis-release/);
  });

  test("the checkout's tracked genesis carries the floor its seed names", () => {
    const carried = carryGenesisFloor({ genesisDir: join(REPO, "genesis"), engine: "engine", plugins: "b".repeat(64) });
    const seed = JSON.parse(readFileSync(join(REPO, "genesis", "seed.json"), "utf8")) as { blobs: Record<string, { sha256: string }> };
    for (const [slug, cid] of Object.entries(carried.manifest.snapshots)) expect(seed.blobs[`floor-${slug}`]!.sha256).toBe(cid);
  });
});

describe("the genesis floor against live canon INGEST laid from the same carriers", () => {
  const crest = readFileSync(join(REPO, "bags/lararium/ha.ka.ba/lararium/mesh/wave-crest.mem"), "utf8");
  const CREST = "lar:///ha.ka.ba/lararium/mesh/wave-crest";

  /** One slug's live canon: its own canon document, each carrier laid through the Confluence gate into the bag's store skin. */
  async function layLive(repo: Repo, slug: string, texts: readonly string[]): Promise<AutomergeDocStore> {
    const bag = bagUri(slug);
    const store = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), bag);
    const sink = storeMemeSink(store, bag, { kind: "lares-verb", requestId: `lay-${slug}` });
    for (const text of texts) expect((await placeMeme({ uri: String(rootMetaFields(text).title), text }, sink)).decision).toBe("ingest");
    return store;
  }
  async function rowsOf(store: AutomergeDocStore): Promise<Record<string, LarTiddlerRecord>> {
    const rows: Record<string, LarTiddlerRecord> = {};
    for (const title of await store.listVisible()) { const r = await store.get(title); if (r) rows[title] = r; }
    return rows;
  }

  test("CONTROL: live canon laid from the carriers the genesis floor was baked from reads drift 0, a code-meme among them; RED: a moved slot reads older", async () => {
    fixture([realA], [crest, realC]);
    const cut = cutGenesisFloor(opts(root));
    const blobs = new Map<string, Uint8Array>([[cut.manifestCid, cut.manifestBytes], ...Object.values(cut.snapshots).map((s) => [s.cid, s.bytes] as [string, Uint8Array])]);
    const blob = async (cid: string) => blobs.get(cid) ?? null;
    const repo = new Repo({ network: [] });
    try {
      const lares = await layLive(repo, "lares", [realA]);
      const lararium = await layLive(repo, "lararium", [crest, realC]);
      const level = await readFloorDriftReading({ manifestCid: cut.manifestCid, blob, canonRows: async (slug) => slug === "lares" ? rowsOf(lares) : slug === "lararium" ? rowsOf(lararium) : null });
      expect(level.why).toBeUndefined();
      expect(level.drift).toMatchObject({ count: 0, carriers: [], unread: [] });
      // RED: the crest's purpose slot moves in live canon after the bake; the floor now serves it older, the carrier counted once.
      const moved = crest.replace("`takeCrest` removes whole families", "`takeCrest` lifts whole families");
      expect(moved).not.toBe(crest);
      const relaid = await layLive(repo, "lararium", [moved, realC]);
      const drifted = await readFloorDriftReading({ manifestCid: cut.manifestCid, blob, canonRows: async (slug) => slug === "lares" ? rowsOf(lares) : slug === "lararium" ? rowsOf(relaid) : null });
      expect(drifted.drift).toMatchObject({ count: 1, carriers: [CREST] });
      expect(drifted.drift!.slugs.find((s) => s.slug === "lararium")).toEqual({ slug: "lararium", missing: [], older: [CREST] });
    } finally { await repo.shutdown(); }
  });
});
