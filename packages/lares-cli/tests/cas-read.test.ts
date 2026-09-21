/**
 * cas-read.test.ts — `lares bag cas`, the inspection read over the cleartext `cid/` tier.
 *
 * Pure local inspection, no daemon: it lists the CAS dir's blobs and DERIVES which of them the disk
 * projection references (a `.tid` / `.meta` under bags/ or wikis/ carrying `textCid`, or a
 * `lar:///…/cid/<hash>` `_canonical_uri`), then reports blobs · referenced · unreferenced · bytes,
 * naming the genesis-seed-derived blobs as protected. It never sweeps — the sweep runs where the
 * composite stands (the daemon), off the authoritative `casReferences(composite.entries())`.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

const ROOT = mkdtempSync(join(tmpdir(), "lr-cas-read-"));
const CAS  = join(ROOT, "cas");
const cidOf = (s: string): string => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
const seedFor = (cid: string): object => ({
  format: "lararium-genesis-seed/v1", actorSeed: "actor", schemaVersion: "1",
  blobs: { tiddlywikicore: { id: "tiddlywikicore", sha256: cid, mimeType: "application/javascript", version: "1" } },
  tiddlers: {
    "lar:///ha.ka.ba/bags/oracle/genesis-cid-engine": { tiddler: { cid: "e" } },
    "lar:///ha.ka.ba/bags/oracle/genesis-cid-grammar": { tiddler: { cid: "g" } },
    "lar:///ha.ka.ba/bags/oracle/genesis-cid-plugins": { tiddler: { cid: "p" } },
  },
});

interface CasReadLike {
  blobs: number; referenced: number; unreferenced: number; pending: number; bytes: number;
  /** false when the seed STANDS and will not read — the third answer, never folded into zero. */
  protectionKnown: boolean;
  protected: string[];
  entries: { cid: string; size: number; refs: string[]; protected: boolean | "unknown" }[];
}
type CasOpts = { casDir: string; bagsDir: string; wikisDir: string; genesisDir: string };

let readCas: (opts: CasOpts) => CasReadLike;
let casSummaryLine: (r: CasReadLike) => string;

/** Every scratch root this file makes — torn down together. */
const dirs: string[] = [ROOT];

beforeAll(async () => {
  mkdirSync(CAS, { recursive: true });
  const mod = await import("../src/commands/cas.js");
  readCas = mod.readCas as unknown as (opts: CasOpts) => CasReadLike;
  casSummaryLine = mod.casSummaryLine as unknown as (r: CasReadLike) => string;
});
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

describe("lares bag cas — blobs · referenced · unreferenced · bytes, references derived from the projection", () => {
  test("a projected pointer references its blob; an orphan reads unreferenced; a genesis cid reads protected", () => {
    const held = "held png bytes", orphan = "orphan bytes", core = "engine core";
    for (const s of [held, orphan, core]) writeFileSync(join(CAS, cidOf(s)), s);
    const bagDir = join(ROOT, "bags/lares/t.w.b");
    mkdirSync(bagDir, { recursive: true });
    writeFileSync(join(bagDir, "photo.tid"), `_is_skinny: yes\ntextCid: ${cidOf(held)}\ntitle: lar:///t.w.b/photo\ntype: image/png\n\n`);
    const genesisDir = join(ROOT, "genesis");
    mkdirSync(genesisDir, { recursive: true });
    writeFileSync(join(genesisDir, "seed.json"), JSON.stringify(seedFor(cidOf(core))));
    const r = readCas({ casDir: CAS, bagsDir: join(ROOT, "bags"), wikisDir: join(ROOT, "wikis"), genesisDir });
    expect(r.blobs).toBe(3);
    expect(r.referenced).toBe(1);
    expect(r.unreferenced).toBe(2);
    expect(r.pending).toBe(0);
    expect(r.bytes).toBe(held.length + orphan.length + core.length);
    expect(r.protected).toEqual([cidOf(core)]);
    const heldRow = r.entries.find((e) => e.cid === cidOf(held));
    expect(heldRow?.refs).toEqual(["bags/lares/t.w.b/photo.tid"]);
    expect(r.entries.find((e) => e.cid === cidOf(orphan))?.refs).toEqual([]);
    expect(r.entries.find((e) => e.cid === cidOf(core))?.protected).toBe(true);
  });
});

/**
 * ★ A TORN SEED READS AS UNKNOWN, NEVER AS UNPROTECTED ★
 *
 * `readGenesisCasManifest` answers `null` for TWO unlike facts: "no seed stands here" and "a seed
 * stands here and will not read". A caller defaulting BOTH to an empty set inverts fail-closed into
 * fail-open — every genesis blob renders `protected: false`, so an operator reads a report saying their
 * engine and plugin blobs stand unguarded when the truth is that the vessel CANNOT TELL. The report
 * misleads rather than deletes, which lowers the severity and not the shape.
 *
 * The cure asks of any default: does it STATE a fact or LOSE one? `genesisProtectSet` (@lararium/node)
 * answers three ways — absent → an empty set (a fact), well-formed → its cids, standing-but-torn →
 * "unreadable" — and this read carries that third answer through to the reader.
 */
describe("★ the genesis seed's three answers reach the report ★", () => {
  const mk = (name: string): { casDir: string; bagsDir: string; wikisDir: string; genesisDir: string; core: string } => {
    const root = mkdtempSync(join(tmpdir(), `lr-cas-${name}-`));
    dirs.push(root);
    const casDir = join(root, "cas");
    mkdirSync(casDir, { recursive: true });
    const core = "engine core bytes";
    writeFileSync(join(casDir, cidOf(core)), core);
    const genesisDir = join(root, "genesis");
    mkdirSync(genesisDir, { recursive: true });
    return { casDir, bagsDir: join(root, "bags"), wikisDir: join(root, "wikis"), genesisDir, core };
  };

  test("SEED ABSENT — an empty protect set STATES a fact: this vessel holds no genesis blobs", () => {
    const f = mk("absent");
    const r = readCas(f);
    expect(r.protectionKnown, "absence reads as knowledge, not as doubt").toBe(true);
    expect(r.protected).toEqual([]);
    expect(r.entries.find((e) => e.cid === cidOf(f.core))?.protected).toBe(false);
  });

  test("CONTROL — a WELL-FORMED seed still marks its blobs protected", () => {
    const f = mk("wellformed");
    writeFileSync(join(f.genesisDir, "seed.json"), JSON.stringify(seedFor(cidOf(f.core))));
    const r = readCas(f);
    expect(r.protectionKnown).toBe(true);
    expect(r.protected).toEqual([cidOf(f.core)]);
    expect(r.entries.find((e) => e.cid === cidOf(f.core))?.protected).toBe(true);
  });

  test("★ SEED STANDS AND WILL NOT READ — protection reads UNKNOWN, never false ★", () => {
    const f = mk("torn");
    writeFileSync(join(f.genesisDir, "seed.json"), "{ this is not json");
    const r = readCas(f);
    expect(r.protectionKnown, "the vessel cannot tell, and says so").toBe(false);
    expect(r.entries.find((e) => e.cid === cidOf(f.core))?.protected).toBe("unknown");
    expect(r.protected, "nothing gets CLAIMED protected off a seed that will not read").toEqual([]);
  });

  test("the human report names the unknown instead of printing a protected count of zero", () => {
    const f = mk("torn-render");
    writeFileSync(join(f.genesisDir, "seed.json"), "{ torn");
    const r = readCas(f);
    const line = casSummaryLine(r);
    expect(line).toMatch(/protected \(genesis\) UNKNOWN/);
    expect(line, "and it says WHY").toMatch(/will not read/i);
  });

  test("CONTROL — a readable seed's summary line still carries the count", () => {
    const f = mk("count-render");
    writeFileSync(join(f.genesisDir, "seed.json"), JSON.stringify(seedFor(cidOf(f.core))));
    const line = casSummaryLine(readCas(f));
    expect(line).toMatch(/protected \(genesis\) 1/);
    expect(line).not.toMatch(/UNKNOWN/);
  });
});
