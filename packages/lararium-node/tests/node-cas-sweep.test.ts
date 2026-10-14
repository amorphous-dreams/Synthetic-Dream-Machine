/**
 * node-cas-sweep.test.ts — PIN and RELEASE on the fs `cid/` tier (tiddler-carriage #/pin-and-release).
 *
 * The law: a blob is RETAINED while any tiddler in a locally-held bag references its CID; an
 * unreferenced blob MAY sweep after a grace; `DROP <bag>` releases that bag's references; a blob the
 * genesis CAS holds (the engine + plugins) NEVER sweeps. NO GLOBAL NOW (P2.5, lean 3): `casSweep` takes
 * its age from an explicit, caller-supplied `ageOf` (a CAUSAL reading — rolls of the realm's own clock
 * in production, `installCasSweep`) — there is no mtime-vs-`Date.now()` fallback to fall into, and a pin
 * stands by PRESENCE in the set passed in, never by comparing `expiry` against now. The proofs, over a
 * real temp CAS dir:
 *   · land a pointer → referenced 1 → the sweep keeps the blob,
 *   · DROP the bag → referenced 0 → sweep with grace 0 → the file is gone,
 *   · CONTROL: a seed-derived genesis blob never sweeps, unreferenced or not,
 *   · CONTROL: a blob referenced by TWO bags survives DROP of one,
 *   · the grace holds: an unreferenced blob younger than the grace stays,
 *   · a name that is not a sha256 hex cid is never touched (the dir may hold sidecars),
 *   · a dry run names what WOULD sweep and deletes nothing,
 *   · a pin holds by presence, releases by explicit `releaseCas`, and a SET-BACK / SET-FORWARD wall
 *     clock moves neither verdict.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { casReferences, sha256HexBytesSync, utf8Bytes, GENESIS_CAS_MANIFEST_FORMAT, type CasReferenceEntry, type GenesisCasManifest } from "@lararium/mesh";
import { casSweep, listCasBlobs, writeCasEntriesFs, readCasPins, pinCas, releaseCas } from "../src/node-cas.js";
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
/** A CAUSAL age reading, supplied by the caller — never a file's mtime, never `Date.now()`. */
const OLD = 999_999;
const YOUNG = 0;
/** Still used by the `installCasSweep` tests below, whose own `ageOf` reads rolls off a fake realm
 *  clock and ignores mtime entirely — the file's mtime carries no meaning there either way. */
const age = (_cid: string): void => { /* vestigial — age is supplied, not read from the fs */ };

const genesis: GenesisCasManifest = {
  format: "lararium-genesis-cas/v1", engineCid: "", pluginsCid: "",
  blobs: [{ cid: blob("the engine core").cid, id: "tiddlywikicore", mimeType: "application/javascript", version: "1" }],
};

describe("casSweep — retain by reference, release by DROP, never the genesis", () => {
  test("a landed pointer holds its blob; DROP the bag → grace 0 sweeps it", () => {
    const photo = blob("png bytes");
    writeCasEntriesFs([photo], casDir);
    const held = casSweep({ casDir, references: casReferences([pointer("lares", "lar:///t.w.b/photo", photo.cid)]), protect: new Set(), grace: 0, ageOf: () => OLD, currentFence: 0 });
    expect(held.swept).toEqual([]);
    expect(existsSync(join(casDir, photo.cid))).toBe(true);
    // DROP <bag> — the bag's records leave the composite, so the derived count reads zero.
    const dropped = casSweep({ casDir, references: casReferences([]), protect: new Set(), grace: 0, ageOf: () => OLD, currentFence: 0 });
    expect(dropped.swept).toEqual([photo.cid]);
    expect(existsSync(join(casDir, photo.cid))).toBe(false);
  });

  test("CONTROL: a genesis blob never sweeps, referenced by nothing", () => {
    const core = blob("the engine core");
    writeCasEntriesFs([core], casDir);
    const r = casSweep({ casDir, references: new Map(), protect: new Set(genesis.blobs.map((b) => b.cid)), grace: 0, ageOf: () => OLD, currentFence: 0 });
    expect(r.swept).toEqual([]);
    expect(r.protected).toEqual([core.cid]);
    expect(existsSync(join(casDir, core.cid))).toBe(true);
  });

  test("CONTROL: a blob referenced by TWO bags survives DROP of one", () => {
    const photo = blob("shared png");
    writeCasEntriesFs([photo], casDir);
    const two = [pointer("lares", "lar:///t.w.b/photo", photo.cid), pointer("crossroads", "lar:///t.w.b/photo", photo.cid)];
    expect(casReferences(two).get(photo.cid)?.size).toBe(2);
    const afterDrop = two.filter((e) => e.bagId !== "lares");
    const r = casSweep({ casDir, references: casReferences(afterDrop), protect: new Set(), grace: 0, ageOf: () => OLD, currentFence: 0 });
    expect(r.swept).toEqual([]);
    expect(existsSync(join(casDir, photo.cid))).toBe(true);
  });

  test("the grace holds a young unreferenced blob; a dry run deletes nothing", () => {
    const fresh = blob("just staged, not yet landed");
    writeCasEntriesFs([fresh], casDir);
    const young = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 60_000, ageOf: () => YOUNG, currentFence: 0 });
    expect(young.swept).toEqual([]);
    expect(young.kept).toContain(fresh.cid);
    const dry = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, dryRun: true, ageOf: () => OLD, currentFence: 0 });
    expect(dry.swept).toEqual([fresh.cid]);
    expect(existsSync(join(casDir, fresh.cid))).toBe(true);
  });

  test("a non-cid name in the dir is never touched; listCasBlobs reports cid + size", () => {
    writeFileSync(join(casDir, "operator-sidecar.txt"), "{}");
    const b = blob("x");
    writeCasEntriesFs([b], casDir);
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, ageOf: () => OLD, currentFence: 0 });
    expect(r.swept).toEqual([b.cid]);
    expect(existsSync(join(casDir, "operator-sidecar.txt"))).toBe(true);
    writeCasEntriesFs([b], casDir);
    expect(listCasBlobs(casDir)).toEqual([{ cid: b.cid, size: 1 }]);
  });
});

// ── GRACE AND PIN, NO GLOBAL NOW (basket-one #/grace-and-pin, ruled 2026-09-11; retired 2026-10-10) ──────────
// A PIN `{cid, tier, holder, fence?}` beside the bag's caps holds its blob past any grace; the grace itself
// reads PER TIER off the realm's baseline (`graceForTier`), so two unreferenced blobs of different tiers
// sweep at different ages. A pin stands by PRESENCE in the array `casSweep` is handed — never by comparing
// a clock. `PinCap` (mesh) carries NO `expiry` field at all (M7); this suite proves `casSweep` never reads
// even the OPTIONAL `fence` to decide a sweep, with a pin that carries one a far-forward clock would have
// no bearing on still holding, and one absent from the array sweeping the instant its sidecar entry is
// withdrawn.
import { graceForTier, type PinCap } from "@lararium/mesh";

describe("casSweep — PIN at cid grain, grace per tier, NO GLOBAL NOW", () => {
  test("a pinned unreferenced blob never sweeps while the pin stands (present)", () => {
    const b = blob("a working the Librarian will re-stand");
    writeCasEntriesFs([b], casDir);
    const pins: PinCap[] = [{ cid: b.cid, tier: "veil", holder: "vessel-1" }];
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, ageOf: () => OLD, pins, currentFence: 0 });
    expect(r.swept).toEqual([]);
    expect(r.pinned).toEqual([b.cid]);
    expect(existsSync(join(casDir, b.cid))).toBe(true);
  });

  test("a RELEASED pin (absent from the array) no longer holds — the blob sweeps past the grace", () => {
    const b = blob("a pin that was withdrawn");
    writeCasEntriesFs([b], casDir);
    // `releaseCas` would have dropped it from the sidecar before this array was read — the production
    // caller never passes a withdrawn pin, so an absent pin is exactly what a release looks like here.
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, ageOf: () => OLD, pins: [], currentFence: 0 });
    expect(r.pinned).toEqual([]);
    expect(r.swept).toEqual([b.cid]);
  });

  test("CONTROL — SET-BACK and SET-FORWARD: a mocked wall clock changes NEITHER verdict — only presence\n" +
       "        in `pins` decides, whether or not a `fence` rides along", () => {
    const standing = blob("a pin whose optional fence a forward jump would have no bearing on");
    const released = blob("an unpinned blob a backward jump would 'revive'");
    writeCasEntriesFs([standing, released], casDir);
    const realNow = Date.now();
    const pins: PinCap[] = [{ cid: standing.cid, tier: "veil", holder: "vessel-1", fence: realNow - 1 }];
    for (const skew of [-10 * 365 * 86_400_000, 10 * 365 * 86_400_000]) {   // 10y back, 10y forward
      vi.spyOn(Date, "now").mockReturnValue(realNow + skew);
      try {
        // dryRun: the same two files must still be standing for the NEXT skew's reading too.
        const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, ageOf: () => OLD, pins, dryRun: true, currentFence: 0 });
        expect(r.pinned, `skew ${skew}`).toEqual([standing.cid]);     // present → still stands
        expect(r.swept, `skew ${skew}`).toEqual([released.cid]);      // absent → still sweeps, every time
      } finally { vi.restoreAllMocks(); }
    }
  });

  test("the grace reads PER TIER: a PUBLIC blob sweeps at an age a VEIL blob survives", () => {
    const pub = blob("a public blob, other holders stand");
    const veil = blob("a veil blob, this vessel alone holds it");
    writeCasEntriesFs([pub, veil], casDir);
    // Both read as "two rolls old"; baseline 1 roll: public (×1) = 1 roll → sweeps, veil (×8) = 8 rolls → kept.
    const rollsOld = 2;
    const tierOf = (cid: string) => (cid === veil.cid ? "veil" : "public") as const;
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0,
                         ageOf: () => rollsOld, currentFence: 0,
                         graceFor: (cid) => graceForTier(tierOf(cid), 1) });
    expect(r.swept).toEqual([pub.cid]);
    expect(r.kept).toContain(veil.cid);
  });
});

// ── M7′: the boot-epoch FENCE a `--held` pin reads against, and fail-toward-KEEPING on a torn sidecar ──────
// Spec: a `--held` pin stamps a `fence` (this vessel's own boot epoch at pin time); `casSweep`'s new
// `currentFence` option — when a caller supplies this vessel's CURRENT epoch — holds the pin only while
// the epoch has not yet rolled past the stamp (the SAME law `cas-caps.ts`'s `pinnedCids` states). No
// `currentFence` → every pin reads presence-only, exactly as before. A torn PER-RECORD field (a mistyped
// `fence`) must still hold its cid (fail toward KEEPING); a torn WHOLE sidecar must REFUSE the read outright
// (never silently "no pins"), so the sweep that depends on it refuses its run rather than un-pinning
// everything the sidecar could not prove was ever un-pinned.
describe("casSweep — M7′ the boot-epoch FENCE a `--held` pin reads against", () => {
  test("a `--held` pin (fence stamped) KEEPS while the current epoch has not yet rolled past it", () => {
    const b = blob("a held pin, boot epoch 3");
    writeCasEntriesFs([b], casDir);
    const pins: PinCap[] = [{ cid: b.cid, tier: "veil", holder: "vessel-1", fence: 3 }];
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, ageOf: () => OLD, pins, currentFence: 3 });
    expect(r.pinned).toEqual([b.cid]);
    expect(r.swept).toEqual([]);
  });

  test("a `--held` pin SWEEPS once a later boot moves the current epoch past the stamped fence", () => {
    const b = blob("a held pin, superseded by the next boot");
    writeCasEntriesFs([b], casDir);
    const pins: PinCap[] = [{ cid: b.cid, tier: "veil", holder: "vessel-1", fence: 3 }];
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, ageOf: () => OLD, pins, currentFence: 4 });
    expect(r.pinned).toEqual([]);
    expect(r.swept).toEqual([b.cid]);
  });

  test("CONTROL: a bare pin (no `fence` at all) keeps regardless of `currentFence` — the operator's own explicit pin", () => {
    const b = blob("an operator pin, no fence, standing across any boot");
    writeCasEntriesFs([b], casDir);
    const pins: PinCap[] = [{ cid: b.cid, tier: "veil", holder: "operator" }];
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, ageOf: () => OLD, pins, currentFence: 1_000_000 });
    expect(r.pinned).toEqual([b.cid]);
    expect(r.swept).toEqual([]);
  });

  // `CasSweepOptions.currentFence` is now REQUIRED (M7″ closed, G3 c4) — there is no more "omit it" escape to
  // prove here; TypeScript itself refuses a `casSweep` call with no `currentFence` at every call site above.
});

describe("readCasPins — M7′ fails toward KEEPING, never toward deleting", () => {
  test("a torn PER-RECORD fence (wrong type) still holds that cid — presence-only, not dropped whole", () => {
    const held = blob("torn fence, should still pin");
    writeFileSync(join(casDir, held.cid), "bytes");
    writeFileSync(join(casDir, ".pins.json"), JSON.stringify([{ cid: held.cid, tier: "veil", holder: "x", fence: "7" }]));
    const pins = readCasPins(casDir);
    expect(pins).toHaveLength(1);
    expect(pins[0]!.cid).toBe(held.cid);
    expect(pins[0]!.fence).toBeUndefined();   // the torn fence read as ABSENT, never as 0, never dropped
  });

  test("a record missing holder/tier still holds by cid alone", () => {
    const cid = "b".repeat(64);
    writeFileSync(join(casDir, ".pins.json"), JSON.stringify([{ cid }]));
    expect(readCasPins(casDir).map((p) => p.cid)).toEqual([cid]);
  });

  test("RED: a WHOLE sidecar that fails to parse REFUSES the read — never silently \"no pins\"", () => {
    writeFileSync(join(casDir, ".pins.json"), "{ not json at all, torn mid-write");
    expect(() => readCasPins(casDir)).toThrow(/pin sidecar/);
  });

  test("MUTATION PROOF: the retired shape (`catch { return [] }`) would have read the torn sidecar as \"no pins\"", () => {
    writeFileSync(join(casDir, ".pins.json"), "{ not json at all, torn mid-write");
    let legacy: unknown[];
    try { legacy = JSON.parse(readFileSync(join(casDir, ".pins.json"), "utf8")) as unknown[]; }
    catch { legacy = []; }   // the retired fallback this fix removed
    expect(legacy).toEqual([]);   // every pinned blob would have read unprotected under the retired shape
  });

  test("CONTROL: an ABSENT sidecar reads as no pins — never a refusal (a vessel that never pinned is not corrupt)", () => {
    expect(readCasPins(casDir)).toEqual([]);
  });

  test("`pinCas`/`releaseCas` refuse rather than silently clobber a corrupt sidecar", () => {
    writeFileSync(join(casDir, ".pins.json"), "{ torn");
    expect(() => pinCas(casDir, { cid: "c".repeat(64), tier: "veil", holder: "operator" })).toThrow(/pin sidecar/);
    expect(() => releaseCas(casDir, "c".repeat(64))).toThrow(/pin sidecar/);
  });
});

// ── evergreen sweep (gp25-SW2): a retired `expiry` field (or any unknown field) REFUSES the whole sidecar ──
// Spec: `.pins.json` is not a legacy-acceptance surface. A record carrying the retired `expiry` field, or
// any field `PinCap` never named, is malformed — the WHOLE read refuses by name (never "ignore the stray
// field and keep going"), so the sweep that depends on it fails toward KEEPING every blob.
describe("readCasPins — evergreen sweep retires old-shape acceptance (gp25-SW2)", () => {
  test("RED: a record carrying the retired `expiry` field REFUSES the whole sidecar", () => {
    const cid = "d".repeat(64);
    writeFileSync(join(casDir, ".pins.json"), JSON.stringify([{ cid, tier: "veil", holder: "x", expiry: 123 }]));
    expect(() => readCasPins(casDir)).toThrow(/unknown field "expiry"/);
  });

  test("RED: a record carrying ANY field `PinCap` never named (not just `expiry`) also refuses", () => {
    const cid = "e".repeat(64);
    writeFileSync(join(casDir, ".pins.json"), JSON.stringify([{ cid, tier: "veil", holder: "x", notes: "hi" }]));
    expect(() => readCasPins(casDir)).toThrow(/unknown field "notes"/);
  });

  test("CONTROL: a record with ONLY PinCap's own fields (cid/tier/holder/fence) reads clean, no refusal", () => {
    const cid = "f".repeat(64);
    writeFileSync(join(casDir, ".pins.json"), JSON.stringify([{ cid, tier: "veil", holder: "x", fence: 2 }]));
    expect(readCasPins(casDir)).toEqual([{ cid, tier: "veil", holder: "x", fence: 2 }]);
  });

  test("MUTATION PROOF: the retired shape (silently drop the stray field, keep the record) would have let `expiry` back in", () => {
    // Reproduces exactly what the OLD reader did — pick only the known fields off the record, dropping
    // anything else without complaint. That shape is what this fix removes: it never saw the stray
    // `expiry`, so it never refused.
    const cid = "a1".repeat(32);
    const record = { cid, tier: "veil", holder: "x", expiry: 999_999_999_999 } as Record<string, unknown>;
    const legacyRead = (p: Record<string, unknown>) => ({
      cid: p["cid"] as string,
      holder: typeof p["holder"] === "string" ? p["holder"] : "unknown",
      tier: typeof p["tier"] === "string" ? p["tier"] : "veil",
    });
    expect(legacyRead(record)).toEqual({ cid, holder: "x", tier: "veil" });   // the old reader never balked
    // The REAL reader, fed the exact same on-disk shape, refuses instead.
    writeFileSync(join(casDir, ".pins.json"), JSON.stringify([record]));
    expect(() => readCasPins(casDir)).toThrow(/unknown field "expiry"/);
  });

  test("installCasSweep: an `expiry`-bearing sidecar faults the production tick's own `pins()` reader — the sweep run refuses, nothing deletes", async () => {
    const orphan = blob("an orphan beside an expiry-bearing pin sidecar (evergreen)");
    writeCasEntriesFs([orphan], casDir);
    writeFileSync(join(casDir, ".pins.json"), JSON.stringify([{ cid: "b2".repeat(32), tier: "veil", holder: "x", expiry: 1 }]));
    const logs: string[] = [];
    const installed = installCasSweep({
      registry: { register: () => {} },
      casDir,
      references: () => [],
      protect: new Set(),
      pins: () => readCasPins(casDir),   // THROWS on the expiry-bearing sidecar — the production wiring shape
      realmClock: () => clockAt(5),
      currentFence: () => 0,
      log: (line) => logs.push(line),
    });
    await expect(installed.sweep(false)).rejects.toThrow(/unknown field "expiry"/);
    expect(existsSync(join(casDir, orphan.cid))).toBe(true);   // nothing swept — the run never got there
    installed.stop();
  });
});

describe("installCasSweep — M7′ a corrupt sidecar REFUSES the tick's sweep run, logged by name — never deletes", () => {
  test("RED: a torn `.pins.json` faults the tick, which logs it by name and sweeps NOTHING", async () => {
    const orphan = blob("an orphan beside a torn pin sidecar");
    writeCasEntriesFs([orphan], casDir);
    writeFileSync(join(casDir, ".pins.json"), "{ torn beyond parsing");
    const registry = fakeRegistry();
    const logs: string[] = [];
    const sweep = installCasSweep({
      registry, casDir, references: async () => [], protect: new Set(),
      pins: () => readCasPins(casDir),   // THROWS on the torn sidecar — exactly the production wiring shape
      currentFence: () => 0,
      realmClock: () => clockAt(20), log: (line) => { logs.push(line); },
    });
    try {
      await expect(registry.verbs.get("cas-sweep")!({})).rejects.toThrow(/pin sidecar/);
      // Nothing swept: the orphan is still there, because the refusal happened BEFORE casSweep ever ran.
      expect(existsSync(join(casDir, orphan.cid))).toBe(true);
    } finally { sweep.stop(); }
  });

  test("CONTROL: the periodic tick (not the verb by hand) catches the same fault and logs it by name, never throwing out", async () => {
    vi.useFakeTimers();
    try {
      const orphan = blob("an orphan the ticking sweep must not eat over a torn sidecar");
      writeCasEntriesFs([orphan], casDir);
      writeFileSync(join(casDir, ".pins.json"), "{ torn beyond parsing");
      const registry = fakeRegistry();
      const logs: string[] = [];
      const sweep = installCasSweep({
        registry, casDir, references: async () => [], protect: new Set(),
        pins: () => readCasPins(casDir),
        currentFence: () => 0,
        realmClock: () => clockAt(20), log: (line) => { logs.push(line); },
      });
      try {
        await vi.advanceTimersByTimeAsync(sweep.probeMs + 1);
        expect(logs.some((l) => l.includes("tick faulted") && l.includes("pin sidecar"))).toBe(true);
        expect(existsSync(join(casDir, orphan.cid))).toBe(true);   // never swept — the refusal came first
      } finally { sweep.stop(); }
    } finally { vi.useRealTimers(); }
  });
});

// ── THE PRODUCTION CALLER — a sweep TICK on the daemon + the `cas-sweep` verb ─────────────────────────────
// `casSweep` had no caller. The tick reads THE REALM'S OWN CLOCK (`realmPace` over what `realm-clock`
// answers): the cadence and every grace count in ROLLS of the realm's feed, never wall-ms. An OBSERVED
// ms-per-roll is co-driven by the observer's sync — a healed partition lands a season of rolls in a second
// and the grace collapses — so the realm's clock outranks it. No pace (the realm has not said two rolls) →
// no tick fires, ever. The verb reports {swept, pinned, retained, pace}; `dryRun` moves nothing; the genesis
// protect set and standing pins hold as before (CONTROL).
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
      pins: () => [{ cid: kept.cid, tier: "veil", holder: "operator" }],
      currentFence: () => 0,
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
        currentFence: () => 0,
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
        currentFence: () => 0,
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
      currentFence: () => 0,
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
 * A TORN SEED MUST NOT READ AS AN ABSENT ONE — the protect set is a DELETION guard.
 *
 * `readGenesisSeed` answers null for both "no seed here" and "a seed here that reads torn",
 * and the sweep's caller folded that null to an empty protect set (`?.blobs ?? []`). An empty protect set
 * does not mean "protect nothing pending" — it means "confirmed: nothing needs protecting", and the sweep
 * acts on it by deleting. So a seed that will not parse silently strips the engine and plugin blobs of
 * the one guard that keeps them, and the vessel eats its own genesis once they age past the grace.
 *
 * The ABSENT case keeps its empty set: a vessel carrying no seed protects nothing because it holds no
 * genesis blobs, and refusing there would break a legitimate shape.
 */
describe("the genesis protect set, when the seed will not read", () => {
  let genesisDir = "";
  beforeEach(() => { genesisDir = mkdtempSync(join(tmpdir(), "lares-genesisdir-")); });
  afterEach(() => { rmSync(genesisDir, { recursive: true, force: true }); });

  test("★ a seed that STANDS and reads torn answers `unreadable` — never an empty protect set ★", () => {
    writeFileSync(join(genesisDir, "seed.json"), "{ not json at all", "utf8");
    expect(genesisProtectSet(genesisDir)).toBe("unreadable");
  });

  test("★ a seed carrying the WRONG format reads unreadable too — a shape guard, not a parse guard ★", () => {
    writeFileSync(join(genesisDir, "seed.json"), JSON.stringify({ format: "something-else", blobs: [] }), "utf8");
    expect(genesisProtectSet(genesisDir)).toBe("unreadable");
  });

  test("CONTROL — an ABSENT seed still answers an empty set: that vessel holds no genesis blobs", () => {
    const set = genesisProtectSet(genesisDir);
    expect(set).not.toBe("unreadable");
    expect([...(set as ReadonlySet<string>)]).toEqual([]);
  });

  test("CONTROL — a WELL-FORMED seed answers its blob cids, so the guard still guards", () => {
    const cid = "a".repeat(64);
    const seed = { format: "lararium-genesis-seed/v1", actorSeed: "actor",
      blobs: { x: { id: "x", sha256: cid, mimeType: "application/json", version: "1" } },
      tiddlers: {
        "lar:///ha.ka.ba/bags/oracle/genesis-cid-engine": { tiddler: { cid: "e" } },
        "lar:///ha.ka.ba/bags/oracle/genesis-cid-grammar": { tiddler: { cid: "g" } },
        "lar:///ha.ka.ba/bags/oracle/genesis-cid-plugins": { tiddler: { cid: "p" } },
      } };
    writeFileSync(join(genesisDir, "seed.json"), JSON.stringify(seed), "utf8");
    const set = genesisProtectSet(genesisDir);
    expect(set).not.toBe("unreadable");
    expect([...(set as ReadonlySet<string>)]).toEqual([cid]);
  });
});

// ── M7′: THE BOOT EPOCH — bumped ONLY on a VESSEL's own claim, never a one-shot direct act ─────────────────
// `owned-store.ts`'s `claimStore` bumps `<storageDir>/.boot-epoch` inline with the claim it already
// serializes through one bound socket name. The single writer is whoever takes the claim; here that is
// this one test process, in series, each claim released before the next opens — no second claimant ever
// stands beside it, so a bump here races nothing. Proofs: a vessel claim bumps the epoch by exactly one
// each time; a DIRECT (one-shot CLI) claim bumps nothing — the churn of unrelated `lares` commands must
// never retire a `--held` pin; `readBootEpoch` answers 0 for a vessel that has never booted, never missing.
import { claimStore, readBootEpoch, bootEpochPath } from "../src/owned-store.js";

describe("owned-store — M7′ the boot epoch bumps on a VESSEL claim only", () => {
  let storeDir = "";
  beforeEach(() => { storeDir = mkdtempSync(join(tmpdir(), "lr-boot-epoch-")); });
  afterEach(() => { rmSync(storeDir, { recursive: true, force: true }); });

  test("a vessel that has never claimed reads epoch 0 — never missing, never a made-up high one", () => {
    expect(readBootEpoch(storeDir)).toBe(0);
  });

  test("a VESSEL claim bumps the epoch by exactly one; a second vessel claim (the next boot) bumps it again", async () => {
    const first = await claimStore(storeDir, { holder: "vessel" });
    expect(readBootEpoch(storeDir)).toBe(1);
    await first.release();
    const second = await claimStore(storeDir, { holder: "vessel" });
    expect(readBootEpoch(storeDir)).toBe(2);
    await second.release();
  });

  test("CONTROL: a DIRECT (one-shot) claim bumps NOTHING — unrelated `lares` commands never retire a `--held` pin", async () => {
    const claim = await claimStore(storeDir, { holder: "direct" });
    expect(readBootEpoch(storeDir)).toBe(0);
    await claim.release();
    expect(readBootEpoch(storeDir)).toBe(0);
  });

  test("the bump is ATOMIC (temp + rename) — a reader never observes a torn counter", async () => {
    const claim = await claimStore(storeDir, { holder: "vessel" });
    try {
      const raw = readFileSync(bootEpochPath(storeDir), "utf8");
      expect(raw.trim()).toBe("1");
      expect(existsSync(`${bootEpochPath(storeDir)}.${process.pid}.tmp`)).toBe(false);   // no stranded temp
    } finally { await claim.release(); }
  });

  test("a torn `.boot-epoch` file reads as 0 — fail toward the OLDEST epoch, never a made-up high one", () => {
    writeFileSync(bootEpochPath(storeDir), "not-a-number\n");
    expect(readBootEpoch(storeDir)).toBe(0);
  });

  test("`claimStore`'s own StoreClaim carries the bumped epoch on `bootEpoch` — vessel holder only", async () => {
    const vessel = await claimStore(storeDir, { holder: "vessel" });
    try { expect(vessel.bootEpoch).toBe(1); } finally { await vessel.release(); }
    const direct = await claimStore(storeDir, { holder: "direct" });
    try { expect(direct.bootEpoch).toBeUndefined(); } finally { await direct.release(); }
  });
});

// ── M7″: `InstallCasSweepOptions.currentFence` WIRED into the production sweep — the last wire ────────────
// M7′ left `casSweep`'s own `currentFence` option built but UNREACHED by any caller. M7″ closes that gap at
// exactly the production boundary: `InstallCasSweepOptions.currentFence` is now REQUIRED, and the install
// threads it straight into every `casSweep` call the tick and the verb make — never a cached boot-time
// reading, read fresh every sweep. The live wiring (`open-node-vessel.ts:2299`) supplies `() => storeClaim.bootEpoch`,
// the epoch THIS boot's own `claimStore({holder:"vessel"})` call bumped — never a second re-read of the
// `.boot-epoch` sidecar file, which could race a concurrent bump. Proven here at the `installCasSweep` grain
// (a real epoch cell standing in for the live `StoreClaim`); proven end to end over a real UDS vessel across
// a real reboot in `probe-m7.sh` (ep4 shape).
describe("installCasSweep — M7″ the production sweep threads a live `currentFence` through to `casSweep`", () => {
  test("a `--held` pin (fence stamped at boot 1) sweeps once `currentFence` reports boot 2 — the live-reboot shape", async () => {
    const held = blob("a held pin, fenced at boot 1");
    writeCasEntriesFs([held], casDir);
    const registry = fakeRegistry();
    let epoch = 1;                                            // this boot's own epoch, as `claimStore` would hand it
    let pace = 2;                                              // the realm's own roll — independent of the boot epoch (realmPace reads < 2 as "no pace yet")
    const sweep = installCasSweep({
      registry, casDir, references: async () => [], protect: new Set(),
      pins: () => [{ cid: held.cid, tier: "veil", holder: "import-job", fence: 1 }],
      currentFence: () => epoch,                               // the LIVE wire under test
      realmClock: () => clockAt(pace), log: () => {},
    });
    try {
      // Boot 1: currentFence (1) has not moved past the stamped fence (1) — the held pin still stands.
      // (This call also seeds the ledger: `held` is first seen unreferenced at roll 1.)
      const bootOne = (await registry.verbs.get("cas-sweep")!({ dryRun: true })) as unknown as CasSweepVerbResult;
      expect(bootOne.pinned).toEqual([held.cid]);
      expect(bootOne.swept).toEqual([]);
      // Boot 2 (a real reboot bumps the epoch) — and the realm has rolled past the floor grace too, so the
      // pin law alone decides: the SAME sidecar entry now reads superseded and the blob is old enough to go.
      epoch = 2;
      pace = 11;                                               // 9 rolls past the first-seen roll (2) — past the 8-roll floor
      const bootTwo = (await registry.verbs.get("cas-sweep")!({ dryRun: true })) as unknown as CasSweepVerbResult;
      expect(bootTwo.pinned).toEqual([]);
      expect(bootTwo.swept).toEqual([held.cid]);
    } finally { sweep.stop(); }
  });

  test("CONTROL: a bare pin (no `fence`) keeps standing across every reboot, however `currentFence` moves", async () => {
    const operatorPin = blob("the operator's own standing pin, no fence");
    writeCasEntriesFs([operatorPin], casDir);
    const registry = fakeRegistry();
    let epoch = 1;
    const sweep = installCasSweep({
      registry, casDir, references: async () => [], protect: new Set(),
      pins: () => [{ cid: operatorPin.cid, tier: "veil", holder: "operator" }],
      currentFence: () => epoch,
      realmClock: () => clockAt(20), log: () => {},
    });
    try {
      for (const nextEpoch of [1, 2, 7]) {
        epoch = nextEpoch;
        const r = (await registry.verbs.get("cas-sweep")!({ dryRun: true })) as unknown as CasSweepVerbResult;
        expect(r.pinned, `epoch ${nextEpoch}`).toEqual([operatorPin.cid]);
        expect(r.swept, `epoch ${nextEpoch}`).toEqual([]);
      }
    } finally { sweep.stop(); }
  });

  test("MUTATION: a caller that never advances `currentFence` past the stamped boot (the 'drop the live wire' shape) leaves a superseded held pin standing", async () => {
    const held = blob("a held pin a frozen fence wrongly keeps");
    writeCasEntriesFs([held], casDir);
    const registry = fakeRegistry();
    const sweep = installCasSweep({
      registry, casDir, references: async () => [], protect: new Set(),
      pins: () => [{ cid: held.cid, tier: "veil", holder: "import-job", fence: 1 }],
      currentFence: () => 1,                                   // MUTATION: frozen at boot 1 forever — never re-reads the live claim
      realmClock: () => clockAt(20), log: () => {},
    });
    try {
      // A real reboot happened (boot 2 is the live fact), but this caller's frozen `currentFence` never
      // learns it — exactly the fault `open-node-vessel.ts`'s live `() => storeClaim.bootEpoch` wiring closes.
      const r = (await registry.verbs.get("cas-sweep")!({ dryRun: true })) as unknown as CasSweepVerbResult;
      expect(r.pinned, "the held pin WRONGLY still stands — the mutation this proof names").toEqual([held.cid]);
      expect(r.swept).toEqual([]);
    } finally { sweep.stop(); }
  });
});

