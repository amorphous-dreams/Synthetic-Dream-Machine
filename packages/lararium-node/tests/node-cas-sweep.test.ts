/**
 * node-cas-sweep.test.ts — PIN and RELEASE on the fs `cid/` tier (tiddler-carriage #/pin-and-release).
 *
 * The law: a blob is RETAINED while any tiddler in a locally-held bag references its CID; an
 * unreferenced blob MAY sweep after a grace; `DROP <bag>` releases that bag's references; a blob the
 * genesis CAS holds (the engine + plugins) NEVER sweeps. The proofs, over a real temp CAS dir:
 *   · land a pointer → referenced 1 → the sweep keeps the blob,
 *   · DROP the bag → referenced 0 → sweep with grace 0 → the file is gone,
 *   · CONTROL: a genesis-manifest blob never sweeps, unreferenced or not,
 *   · CONTROL: a blob referenced by TWO bags survives DROP of one,
 *   · the grace holds: an unreferenced blob younger than the grace stays,
 *   · a name that is not a sha256 hex cid is never touched (the dir may hold sidecars),
 *   · a dry run names what WOULD sweep and deletes nothing.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { casReferences, sha256HexBytesSync, utf8Bytes, GENESIS_CAS_MANIFEST_FORMAT, type CasReferenceEntry, type GenesisCasManifest } from "@lararium/mesh";
import { casSweep, listCasBlobs, writeCasEntriesFs } from "../src/node-cas.js";
import { genesisProtectSet } from "../src/genesis-artifact.js";

let casDir = "";
beforeEach(() => { casDir = mkdtempSync(join(tmpdir(), "lr-cas-sweep-")); });
afterEach(() => { rmSync(casDir, { recursive: true, force: true }); });

const blob = (s: string): { cid: string; bytes: Uint8Array } => {
  const bytes = utf8Bytes(s);
  return { cid: sha256HexBytesSync(bytes), bytes };
};
const pointer = (bagId: string, title: string, cid: string): CasReferenceEntry =>
  ({ title, bagId, record: { tiddler: { title, _is_skinny: "yes", textCid: cid } } });
/** Age a blob file past any grace (mtime a day back). */
const age = (cid: string): void => { const t = (Date.now() - 86_400_000) / 1000; utimesSync(join(casDir, cid), t, t); };

const genesis: GenesisCasManifest = {
  format: "lararium-genesis-cas/v1", engineCid: "", pluginsCid: "",
  blobs: [{ cid: blob("the engine core").cid, id: "tiddlywikicore", mimeType: "application/javascript", version: "1" }],
};

describe("casSweep — retain by reference, release by DROP, never the genesis", () => {
  test("a landed pointer holds its blob; DROP the bag → grace 0 sweeps it", () => {
    const photo = blob("png bytes");
    writeCasEntriesFs([photo], casDir);
    age(photo.cid);
    const held = casSweep({ casDir, references: casReferences([pointer("lares", "lar:///t.w.b/photo", photo.cid)]), protect: new Set(), grace: 0 });
    expect(held.swept).toEqual([]);
    expect(existsSync(join(casDir, photo.cid))).toBe(true);
    // DROP <bag> — the bag's records leave the composite, so the derived count reads zero.
    const dropped = casSweep({ casDir, references: casReferences([]), protect: new Set(), grace: 0 });
    expect(dropped.swept).toEqual([photo.cid]);
    expect(existsSync(join(casDir, photo.cid))).toBe(false);
  });

  test("CONTROL: a genesis blob never sweeps, referenced by nothing", () => {
    const core = blob("the engine core");
    writeCasEntriesFs([core], casDir);
    age(core.cid);
    const r = casSweep({ casDir, references: new Map(), protect: new Set(genesis.blobs.map((b) => b.cid)), grace: 0 });
    expect(r.swept).toEqual([]);
    expect(r.protected).toEqual([core.cid]);
    expect(existsSync(join(casDir, core.cid))).toBe(true);
  });

  test("CONTROL: a blob referenced by TWO bags survives DROP of one", () => {
    const photo = blob("shared png");
    writeCasEntriesFs([photo], casDir);
    age(photo.cid);
    const two = [pointer("lares", "lar:///t.w.b/photo", photo.cid), pointer("crossroads", "lar:///t.w.b/photo", photo.cid)];
    expect(casReferences(two).get(photo.cid)?.size).toBe(2);
    const afterDrop = two.filter((e) => e.bagId !== "lares");
    const r = casSweep({ casDir, references: casReferences(afterDrop), protect: new Set(), grace: 0 });
    expect(r.swept).toEqual([]);
    expect(existsSync(join(casDir, photo.cid))).toBe(true);
  });

  test("the grace holds a young unreferenced blob; a dry run deletes nothing", () => {
    const fresh = blob("just staged, not yet landed");
    writeCasEntriesFs([fresh], casDir);
    const young = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 60_000 });
    expect(young.swept).toEqual([]);
    expect(young.kept).toContain(fresh.cid);
    age(fresh.cid);
    const dry = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, dryRun: true });
    expect(dry.swept).toEqual([fresh.cid]);
    expect(existsSync(join(casDir, fresh.cid))).toBe(true);
  });

  test("a non-cid name in the dir is never touched; listCasBlobs reports cid + size", () => {
    writeFileSync(join(casDir, "bulb-pointer-state.json"), "{}");
    const b = blob("x");
    writeCasEntriesFs([b], casDir);
    age(b.cid);
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0 });
    expect(r.swept).toEqual([b.cid]);
    expect(existsSync(join(casDir, "bulb-pointer-state.json"))).toBe(true);
    writeCasEntriesFs([b], casDir);
    expect(listCasBlobs(casDir)).toEqual([{ cid: b.cid, size: 1 }]);
  });
});

// ── GRACE AND PIN (basket-one #/grace-and-pin, ruled 2026-09-11) ────────────────────────────────────────────
// A PIN `{cid, tier, holder, expiry}` beside the bag's caps holds its blob past any grace; an EXPIRED pin
// releases the blob to the ordinary grace; the grace itself reads PER TIER off the realm's baseline
// (`graceForTier`), so two unreferenced blobs of different tiers sweep at different ages.
import { graceForTier, type PinCap } from "@lararium/mesh";

describe("casSweep — PIN at cid grain, grace per tier", () => {
  test("a pinned unreferenced blob never sweeps while the pin stands", () => {
    const b = blob("a working the Librarian will re-stand");
    writeCasEntriesFs([b], casDir);
    age(b.cid);
    const pins: PinCap[] = [{ cid: b.cid, tier: "veil", holder: "vessel-1", expiry: Date.now() + 86_400_000 }];
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, pins });
    expect(r.swept).toEqual([]);
    expect(r.pinned).toEqual([b.cid]);
    expect(existsSync(join(casDir, b.cid))).toBe(true);
  });

  test("an EXPIRED pin releases the blob to the grace — aged past it, it sweeps", () => {
    const b = blob("a pin whose lifetime ended");
    writeCasEntriesFs([b], casDir);
    age(b.cid);
    const pins: PinCap[] = [{ cid: b.cid, tier: "veil", holder: "vessel-1", expiry: Date.now() - 1 }];
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, pins });
    expect(r.pinned).toEqual([]);
    expect(r.swept).toEqual([b.cid]);
  });

  test("the grace reads PER TIER: a PUBLIC blob sweeps at an age a VEIL blob survives", () => {
    const pub = blob("a public blob, other holders stand");
    const veil = blob("a veil blob, this vessel alone holds it");
    writeCasEntriesFs([pub, veil], casDir);
    // Both aged ONE hour; the baseline unit reads 30 minutes: public (×1) = 30m → sweeps, veil (×8) = 4h → kept.
    const hourAgo = (Date.now() - 3_600_000) / 1000;
    utimesSync(join(casDir, pub.cid), hourAgo, hourAgo);
    utimesSync(join(casDir, veil.cid), hourAgo, hourAgo);
    const baselineMs = 30 * 60_000;
    const tierOf = (cid: string) => (cid === veil.cid ? "veil" : "public") as const;
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0,
                         graceFor: (cid) => graceForTier(tierOf(cid), baselineMs) });
    expect(r.swept).toEqual([pub.cid]);
    expect(r.kept).toContain(veil.cid);
  });
});

// ── THE PRODUCTION CALLER — a sweep TICK on the daemon + the `cas-sweep` verb ─────────────────────────────
// `casSweep` had no caller. The tick reads THE REALM'S OWN CLOCK (`realmPace` over what `realm-clock`
// answers): the cadence and every grace count in ROLLS of the realm's feed, never wall-ms. An OBSERVED
// ms-per-roll is co-driven by the observer's sync — a healed partition lands a season of rolls in a second
// and the grace collapses — so the realm's clock outranks it. No pace (the realm has not said two rolls) →
// no tick fires, ever. The verb reports {swept, pinned, retained, pace}; `dryRun` moves nothing; the genesis
// protect set and standing pins hold as before (CONTROL).
import { vi } from "vitest";
import { sweepCadenceRolls, installCasSweep, type CasSweepVerbResult } from "../src/node-cas.js";

type Handler = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
function fakeRegistry(): { register(name: string, h: Handler): void; verbs: Map<string, Handler> } {
  const verbs = new Map<string, Handler>();
  return { verbs, register: (name, h) => { verbs.set(name, h); } };
}
/** A fake realm clock — what `realm-clock` answers, at a known beat. */
const clockAt = (effectiveEpoch: number) => ({ maintainers: [], maintainerCount: 0, effectiveEpoch, trailingEpoch: 0, spread: 0, leadingCount: 0 });

describe("the sweep tick and the cas-sweep verb", () => {
  test("the cadence = the shortest tier's grace / 4 in ROLLS, never under one roll", () => {
    expect(sweepCadenceRolls()).toBe(Math.max(1, Math.ceil(graceForTier("public", 1) / 4)));
  });

  test("`cas-sweep` sweeps an orphan past its grace IN ROLLS, keeps the genesis and the pinned, reports {swept, pinned, retained, pace}", async () => {
    const orphan = blob("an orphan past its grace");
    const core   = blob("the engine core");
    const kept   = blob("a pinned working");
    writeCasEntriesFs([orphan, core, kept], casDir);
    for (const b of [orphan, core, kept]) age(b.cid);
    const registry = fakeRegistry();
    let epoch = 2;
    const sweep = installCasSweep({
      registry, casDir,
      references: async () => [],
      protect: new Set(genesis.blobs.map((b) => b.cid)),
      pins: () => [{ cid: kept.cid, tier: "veil", holder: "operator", expiry: Date.now() + 86_400_000 }],
      realmClock: () => clockAt(epoch),
      log: () => {},
    });
    try {
      // The first sweep SEES the orphan at roll 2 — age 0 rolls; the floor grace reads the LONGEST tier (8 rolls).
      const seen = (await registry.verbs.get("cas-sweep")!({})) as unknown as CasSweepVerbResult;
      expect(seen.swept).toEqual([]);
      expect(seen.pace).toBe(2);
      epoch = 10;   // eight rolls later on the realm's own clock — a day of wall-time, or one second: the same reading
      // CONTROL: a dry run names the orphan and moves nothing.
      const dry = (await registry.verbs.get("cas-sweep")!({ dryRun: true })) as unknown as CasSweepVerbResult;
      expect(dry.dryRun).toBe(true);
      expect(dry.swept).toEqual([orphan.cid]);
      expect(existsSync(join(casDir, orphan.cid))).toBe(true);
      const live = (await registry.verbs.get("cas-sweep")!({})) as unknown as CasSweepVerbResult;
      expect(live.swept).toEqual([orphan.cid]);
      expect(live.pinned).toEqual([kept.cid]);
      expect(live.retained).toEqual(expect.arrayContaining([core.cid]));
      expect(live.pace).toBe(10);
      expect(existsSync(join(casDir, orphan.cid))).toBe(false);
      expect(existsSync(join(casDir, core.cid))).toBe(true);      // CONTROL: genesis never sweeps
      expect(existsSync(join(casDir, kept.cid))).toBe(true);      // CONTROL: pinned never sweeps
    } finally { sweep.stop(); }
  });

  test("★ the grace reads the REALM'S clock, not the observed roll rate: a burst of rolls in one second ages a blob by rolls; a day of silence ages it by nothing ★", async () => {
    vi.useFakeTimers();
    try {
      const orphan = blob("an orphan the tick finds");
      writeCasEntriesFs([orphan], casDir);
      age(orphan.cid);
      const registry = fakeRegistry();
      let epoch = 2;
      const swept: string[][] = [];
      const sweep = installCasSweep({
        registry, casDir, references: async () => [], protect: new Set(), pins: () => [],
        realmClock: () => clockAt(epoch), log: () => {}, onSweep: (r) => { swept.push(r.swept); },
      });
      try {
        await vi.advanceTimersByTimeAsync(sweep.probeMs + 1);                 // the orphan is SEEN at roll 2
        await vi.advanceTimersByTimeAsync(24 * 3_600_000);                    // a day of wall-clock, the realm still
        expect(swept.flat(), "a still realm ages nothing, however long the wall-clock runs").toEqual([]);
        expect(existsSync(join(casDir, orphan.cid))).toBe(true);
        epoch = 9;                                                             // seven rolls land in one second (a healed partition)
        await vi.advanceTimersByTimeAsync(sweep.probeMs + 1);
        expect(swept.flat(), "seven rolls < the eight-roll floor — kept").toEqual([]);
        epoch = 10;
        await vi.advanceTimersByTimeAsync(sweep.probeMs + 1);
        expect(swept.flat()).toEqual([orphan.cid]);
        expect(existsSync(join(casDir, orphan.cid))).toBe(false);
      } finally { sweep.stop(); }
    } finally { vi.useRealTimers(); }
  });

  test("CONTROL: no pace (under two rolls, or no realm) → no tick fires, however long the clock runs", async () => {
    vi.useFakeTimers();
    try {
      const orphan = blob("an orphan on a realm-less hearth");
      writeCasEntriesFs([orphan], casDir);
      age(orphan.cid);
      const registry = fakeRegistry();
      let clock: ReturnType<typeof clockAt> | null = null;
      const swept: string[][] = [];
      const sweep = installCasSweep({
        registry, casDir, references: async () => [], protect: new Set(), pins: () => [],
        realmClock: () => clock, log: () => {}, onSweep: (r) => { swept.push(r.swept); },
      });
      try {
        await vi.advanceTimersByTimeAsync(24 * 3_600_000);
        clock = clockAt(1);                                                    // one offering — a visit, no beat
        await vi.advanceTimersByTimeAsync(24 * 3_600_000);
        expect(swept).toEqual([]);
        expect(existsSync(join(casDir, orphan.cid))).toBe(true);
        // The verb by hand, with no pace: nothing has aged, nothing sweeps, and the result says which it read.
        const r = (await registry.verbs.get("cas-sweep")!({})) as unknown as CasSweepVerbResult;
        expect(r.swept).toEqual([]);
        expect(r.pace).toBeNull();
      } finally { sweep.stop(); }
    } finally { vi.useRealTimers(); }
  });

  test("CONTROL: a blob that gains a reference leaves the ledger; unreferenced again, its grace starts over", async () => {
    const photo = blob("a png whose pointer came and went");
    writeCasEntriesFs([photo], casDir);
    const registry = fakeRegistry();
    let epoch = 2;
    let refs: CasReferenceEntry[] = [];
    const sweep = installCasSweep({
      registry, casDir, references: async () => refs, protect: new Set(), pins: () => [],
      realmClock: () => clockAt(epoch), log: () => {},
    });
    try {
      const verb = registry.verbs.get("cas-sweep")!;
      await verb({});                                    // seen unreferenced at roll 2
      epoch = 6; refs = [pointer("lares", "lar:///t.w.b/photo", photo.cid)];
      await verb({});                                    // referenced — the ledger forgets it
      epoch = 12; refs = [];
      const again = (await verb({})) as unknown as CasSweepVerbResult;
      expect(again.swept, "unreferenced again at roll 12 — age 0, not 10").toEqual([]);
      epoch = 20;
      expect(((await verb({})) as unknown as CasSweepVerbResult).swept).toEqual([photo.cid]);
    } finally { sweep.stop(); }
  });
});

/**
 * ONE CLOCK FOR EVERY COOLING. The stowage's idle clock reads sync; the realm reading rides async through the
 * sweep tick. The pace cell carries the tick's reading to the stowage, so a bag cools by the same rolls a
 * blob ages by — and reads 0 (ages nothing) until the realm rolls.
 */
import { makeRealmPaceCell } from "../src/node-cas.js";
test("the pace cell reads 0 before any reading, then the last pace, and ignores a null", () => {
  const cell = makeRealmPaceCell();
  expect(cell.read()).toBe(0);
  cell.note(7);
  expect(cell.read()).toBe(7);
  cell.note(null);
  expect(cell.read()).toBe(7);
});

/**
 * A TORN MANIFEST MUST NOT READ AS AN ABSENT ONE — the protect set is a DELETION guard.
 *
 * `readGenesisManifest` answers null for both "no manifest here" and "a manifest here that reads torn",
 * and the sweep's caller folded that null to an empty protect set (`?.blobs ?? []`). An empty protect set
 * does not mean "protect nothing pending" — it means "confirmed: nothing needs protecting", and the sweep
 * acts on it by deleting. So a manifest that will not parse silently strips the engine and plugin blobs of
 * the one guard that keeps them, and the vessel eats its own genesis once they age past the grace.
 *
 * The ABSENT case keeps its empty set: a vessel carrying no manifest protects nothing because it holds no
 * genesis blobs, and refusing there would break a legitimate shape.
 */
describe("the genesis protect set, when the manifest will not read", () => {
  let genesisDir = "";
  beforeEach(() => { genesisDir = mkdtempSync(join(tmpdir(), "lares-genesisdir-")); });
  afterEach(() => { rmSync(genesisDir, { recursive: true, force: true }); });

  test("★ a manifest that STANDS and reads torn answers `unreadable` — never an empty protect set ★", () => {
    writeFileSync(join(genesisDir, "island.manifest.json"), "{ not json at all", "utf8");
    expect(genesisProtectSet(genesisDir)).toBe("unreadable");
  });

  test("★ a manifest carrying the WRONG format reads unreadable too — a shape guard, not a parse guard ★", () => {
    writeFileSync(join(genesisDir, "island.manifest.json"), JSON.stringify({ format: "something-else", blobs: [] }), "utf8");
    expect(genesisProtectSet(genesisDir)).toBe("unreadable");
  });

  test("CONTROL — an ABSENT manifest still answers an empty set: that vessel holds no genesis blobs", () => {
    const set = genesisProtectSet(genesisDir);
    expect(set).not.toBe("unreadable");
    expect([...(set as ReadonlySet<string>)]).toEqual([]);
  });

  test("CONTROL — a WELL-FORMED manifest answers its blob cids, so the guard still guards", () => {
    // The FORMAT rides the constant, never a hand-typed twin — a literal here drifts the day the format moves.
    const manifest = { format: GENESIS_CAS_MANIFEST_FORMAT, engineCid: "e", grammarCid: "g", pluginsCid: "p",
      blobs: [{ cid: "aa", id: "x", mimeType: "application/json", version: "1" }] };
    writeFileSync(join(genesisDir, "island.manifest.json"), JSON.stringify(manifest), "utf8");
    const set = genesisProtectSet(genesisDir);
    expect(set).not.toBe("unreadable");
    expect([...(set as ReadonlySet<string>)]).toEqual(["aa"]);
  });
});
