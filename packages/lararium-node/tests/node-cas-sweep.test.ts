/**
 * node-cas-sweep.test.ts — PIN and RELEASE on the fs `cid/` tier (tiddler-carriage #/pin-and-release).
 *
 * The law: a blob is RETAINED while any tiddler in a locally-held bag references its CID; an
 * unreferenced blob MAY sweep after a grace; `DROP <bag>` releases that bag's references; a blob the
 * genesis CAS holds (the engine + plugins) NEVER sweeps. NO GLOBAL NOW (P2.5, lean 3): `casSweep` takes
 * its age from an explicit, caller-supplied `ageOf` (a CAUSAL reading — rolls of the realm's own clock
 * in production, `installCasSweep`) — there is no mtime-vs-`Date.now()` fallback to fall into, and a pin
 * stands by PRESENCE in the set passed in, never by comparing a clock against now. The proofs, over a
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
import { mkdtempSync, mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { casReferences, sha256HexBytesSync, utf8Bytes, GENESIS_CAS_MANIFEST_FORMAT, ENGINE_CORE_ID, type CasReferenceEntry, type GenesisCasManifest, type LarDoc } from "@lararium/mesh";
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
/** This vessel's life, as its store claim would mint it; another life spelled beside it. */
const LIFE = "a".repeat(32);
const NEXT_LIFE = "b".repeat(32);
const YOUNG = 0;
/** Still used by the `installCasSweep` tests below, whose own `ageOf` reads rolls off a fake realm
 *  clock and ignores mtime entirely — the file's mtime carries no meaning there either way. */
const age = (_cid: string): void => { /* vestigial — age is supplied, not read from the fs */ };

const genesis: GenesisCasManifest = {
  format: "lararium-genesis-cas", engineCid: "", pluginsCid: "",
  blobs: [{ cid: blob("the engine core").cid, id: "tiddlywikicore", mimeType: "application/javascript", version: "1" }],
};

describe("casSweep — retain by reference, release by DROP, never the genesis", () => {
  test("a landed pointer holds its blob; DROP the bag → grace 0 sweeps it", () => {
    const photo = blob("png bytes");
    writeCasEntriesFs([photo], casDir);
    const held = casSweep({ casDir, references: casReferences([pointer("lares", "lar:///t.w.b/photo", photo.cid)]), protect: new Set(), grace: 0, ageOf: () => OLD, currentLife: LIFE });
    expect(held.swept).toEqual([]);
    expect(existsSync(join(casDir, photo.cid))).toBe(true);
    // DROP <bag> — the bag's records leave the composite, so the derived count reads zero.
    const dropped = casSweep({ casDir, references: casReferences([]), protect: new Set(), grace: 0, ageOf: () => OLD, currentLife: LIFE });
    expect(dropped.swept).toEqual([photo.cid]);
    expect(existsSync(join(casDir, photo.cid))).toBe(false);
  });

  test("CONTROL: a genesis blob never sweeps, referenced by nothing", () => {
    const core = blob("the engine core");
    writeCasEntriesFs([core], casDir);
    const r = casSweep({ casDir, references: new Map(), protect: new Set(genesis.blobs.map((b) => b.cid)), grace: 0, ageOf: () => OLD, currentLife: LIFE });
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
    const r = casSweep({ casDir, references: casReferences(afterDrop), protect: new Set(), grace: 0, ageOf: () => OLD, currentLife: LIFE });
    expect(r.swept).toEqual([]);
    expect(existsSync(join(casDir, photo.cid))).toBe(true);
  });

  test("the grace holds a young unreferenced blob; a dry run deletes nothing", () => {
    const fresh = blob("just staged, not yet landed");
    writeCasEntriesFs([fresh], casDir);
    const young = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 60_000, ageOf: () => YOUNG, currentLife: LIFE });
    expect(young.swept).toEqual([]);
    expect(young.kept).toContain(fresh.cid);
    const dry = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, dryRun: true, ageOf: () => OLD, currentLife: LIFE });
    expect(dry.swept).toEqual([fresh.cid]);
    expect(existsSync(join(casDir, fresh.cid))).toBe(true);
  });

  test("a non-cid name in the dir is never touched; listCasBlobs reports cid + size", () => {
    writeFileSync(join(casDir, "operator-sidecar.txt"), "{}");
    const b = blob("x");
    writeCasEntriesFs([b], casDir);
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, ageOf: () => OLD, currentLife: LIFE });
    expect(r.swept).toEqual([b.cid]);
    expect(existsSync(join(casDir, "operator-sidecar.txt"))).toBe(true);
    writeCasEntriesFs([b], casDir);
    expect(listCasBlobs(casDir)).toEqual([{ cid: b.cid, size: 1 }]);
  });
});

// ── GRACE AND PIN, NO GLOBAL NOW (basket-one #/grace-and-pin, ruled 2026-09-11) ──────────
// A PIN `{cid, tier, holder, life?}` beside the bag's caps holds its blob past any grace; the grace itself
// reads PER TIER off the realm's baseline (`graceForTier`), so two unreferenced blobs of different tiers
// sweep at different ages. A pin stands by PRESENCE in the array `casSweep` is handed — never by comparing
// a clock. `PinCap` (mesh) carries NO clock field at all (M7); this suite proves `casSweep` never reads
// a clock to decide a sweep, even through the OPTIONAL `life`, with a pin that carries one a far-forward clock would have
// no bearing on still holding, and one absent from the array sweeping the instant its sidecar entry is
// withdrawn.
import { graceForTier, type PinCap } from "@lararium/mesh";

describe("casSweep — PIN at cid grain, grace per tier, NO GLOBAL NOW", () => {
  test("a pinned unreferenced blob never sweeps while the pin stands (present)", () => {
    const b = blob("a working the Librarian will re-stand");
    writeCasEntriesFs([b], casDir);
    const pins: PinCap[] = [{ cid: b.cid, tier: "veil", holder: "vessel-1" }];
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, ageOf: () => OLD, pins, currentLife: LIFE });
    expect(r.swept).toEqual([]);
    expect(r.pinned).toEqual([b.cid]);
    expect(existsSync(join(casDir, b.cid))).toBe(true);
  });

  test("a RELEASED pin (absent from the array) no longer holds — the blob sweeps past the grace", () => {
    const b = blob("a pin that was withdrawn");
    writeCasEntriesFs([b], casDir);
    // `releaseCas` would have dropped it from the sidecar before this array was read — the production
    // caller never passes a withdrawn pin, so an absent pin is exactly what a release looks like here.
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, ageOf: () => OLD, pins: [], currentLife: LIFE });
    expect(r.pinned).toEqual([]);
    expect(r.swept).toEqual([b.cid]);
  });

  test("CONTROL — SET-BACK and SET-FORWARD: a mocked wall clock changes NEITHER verdict — only presence\n" +
       "        in `pins` decides, whether or not a `life` rides along", () => {
    const standing = blob("a pin whose optional life a forward jump would have no bearing on");
    const released = blob("an unpinned blob a backward jump would 'revive'");
    writeCasEntriesFs([standing, released], casDir);
    const realNow = Date.now();
    const pins: PinCap[] = [{ cid: standing.cid, tier: "veil", holder: "vessel-1", life: LIFE }];
    for (const skew of [-10 * 365 * 86_400_000, 10 * 365 * 86_400_000]) {   // 10y back, 10y forward
      vi.spyOn(Date, "now").mockReturnValue(realNow + skew);
      try {
        // dryRun: the same two files must still be standing for the NEXT skew's reading too.
        const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, ageOf: () => OLD, pins, dryRun: true, currentLife: LIFE });
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
                         ageOf: () => rollsOld, currentLife: LIFE,
                         graceFor: (cid) => graceForTier(tierOf(cid), 1) });
    expect(r.swept).toEqual([pub.cid]);
    expect(r.kept).toContain(veil.cid);
  });
});

// ── M7′: the vessel LIFE a `--held` pin reads against, and fail-toward-KEEPING on a torn sidecar ──────────
// Spec: a `--held` pin stamps a `life` (this vessel's own life at pin time); `casSweep`'s REQUIRED `currentLife`
// holds the pin only while that life IS the current one (the SAME law `cas-caps.ts`'s `pinnedCids` states):
// equality alone, never an order. A torn PER-RECORD field (a mistyped `life`) must still hold its cid (fail
// toward KEEPING); a torn WHOLE sidecar must REFUSE the read outright (never silently "no pins"), so the sweep
// that depends on it refuses its run rather than un-pinning everything the sidecar could not prove un-pinned.
describe("casSweep — M7′ the vessel LIFE a `--held` pin reads against", () => {
  test("a `--held` pin (life stamped) KEEPS while that life stands", () => {
    const b = blob("a held pin, this life");
    writeCasEntriesFs([b], casDir);
    const pins: PinCap[] = [{ cid: b.cid, tier: "veil", holder: "vessel-1", life: LIFE }];
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, ageOf: () => OLD, pins, currentLife: LIFE });
    expect(r.pinned).toEqual([b.cid]);
    expect(r.swept).toEqual([]);
  });

  test("a `--held` pin SWEEPS once another life holds the store, whichever way the two ids would sort", () => {
    for (const [stamped, now] of [[LIFE, NEXT_LIFE], [NEXT_LIFE, LIFE]] as const) {
      const b = blob(`a held pin of ${stamped}, another life standing`);
      writeCasEntriesFs([b], casDir);
      const pins: PinCap[] = [{ cid: b.cid, tier: "veil", holder: "vessel-1", life: stamped }];
      const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, ageOf: () => OLD, pins, currentLife: now, dryRun: true });
      expect(r.pinned).toEqual([]);
      expect(r.swept).toContain(b.cid);
    }
  });

  test("CONTROL: a bare pin (no `life` at all) keeps regardless of `currentLife` — the operator's own explicit pin", () => {
    const b = blob("an operator pin, no life, standing across every life");
    writeCasEntriesFs([b], casDir);
    const pins: PinCap[] = [{ cid: b.cid, tier: "veil", holder: "operator" }];
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), grace: 0, ageOf: () => OLD, pins, currentLife: NEXT_LIFE });
    expect(r.pinned).toEqual([b.cid]);
    expect(r.swept).toEqual([]);
  });

  // `CasSweepOptions.currentLife` stands REQUIRED — TypeScript itself refuses a `casSweep` call without it.
});

describe("readCasPins — M7′ fails toward KEEPING, never toward deleting", () => {
  test("a torn PER-RECORD life (a counter where a life name stands, or an empty one) still holds that cid — presence-only, not dropped whole", () => {
    for (const torn of [7, ""]) {
      const held = blob(`torn life ${String(torn)}, should still pin`);
      writeFileSync(join(casDir, held.cid), "bytes");
      writeFileSync(join(casDir, ".pins.json"), JSON.stringify([{ cid: held.cid, tier: "veil", holder: "x", life: torn }]));
      const pins = readCasPins(casDir);
      expect(pins).toHaveLength(1);
      expect(pins[0]!.cid).toBe(held.cid);
      expect(pins[0]!.life).toBeUndefined();   // the torn life read as ABSENT, never dropped
    }
  });

  test("RED: a sidecar record that carries a `fence` (a pin stamped under the retired boot count) and no `life` reads as a pin of an ended life: released, never a refusal; the next write rests the sidecar clean", () => {
    const kept = "c".repeat(64), ended = "d".repeat(64), both = "e".repeat(64);
    writeFileSync(join(casDir, ".pins.json"), JSON.stringify([
      { cid: kept, tier: "veil", holder: "operator" },
      { cid: ended, tier: "veil", holder: "import-job", fence: 3 },
      { cid: both, tier: "veil", holder: "import-job", fence: 3, life: LIFE },
    ]));
    expect(readCasPins(casDir)).toEqual([
      { cid: kept, tier: "veil", holder: "operator" },
      { cid: both, tier: "veil", holder: "import-job", life: LIFE },
    ]);
    pinCas(casDir, { cid: "f".repeat(64), tier: "veil", holder: "operator" });
    const rested = JSON.parse(readFileSync(join(casDir, ".pins.json"), "utf8")) as Array<Record<string, unknown>>;
    expect(rested.map((p) => p["cid"])).toEqual([kept, both, "f".repeat(64)]);
    expect(rested.some((p) => "fence" in p), "the rewrite carries no fence").toBe(false);
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

  test("MUTATION PROOF: a reader shaped `catch { return [] }` reads the torn sidecar as \"no pins\"", () => {
    writeFileSync(join(casDir, ".pins.json"), "{ not json at all, torn mid-write");
    let swallowed: unknown[];
    try { swallowed = JSON.parse(readFileSync(join(casDir, ".pins.json"), "utf8")) as unknown[]; }
    catch { swallowed = []; }   // the fallback `readCasPins` refuses to be
    expect(swallowed).toEqual([]);   // every pinned blob would read unprotected under that shape
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

// ── an unknown field REFUSES the whole sidecar ──
// Spec: `.pins.json` holds `PinCap`'s own fields and nothing else. A record carrying a clock-shaped field, or
// any field `PinCap` never named, is malformed — the WHOLE read refuses by name (never "ignore the stray
// field and keep going"), so the sweep that depends on it fails toward KEEPING every blob.
describe("readCasPins — a record shape PinCap never named refuses the read", () => {
  test("RED: a record carrying a clock field (`until`) REFUSES the whole sidecar, and the refusal names that field alone", () => {
    const cid = "d".repeat(64);
    writeFileSync(join(casDir, ".pins.json"), JSON.stringify([{ cid, tier: "veil", holder: "x", until: 123 }]));
    expect(() => readCasPins(casDir)).toThrow(/unknown field "until" — refusing to read it as "no pins"/);
  });

  test("RED: a record carrying ANY field `PinCap` never named (not just a clock) also refuses", () => {
    const cid = "e".repeat(64);
    writeFileSync(join(casDir, ".pins.json"), JSON.stringify([{ cid, tier: "veil", holder: "x", notes: "hi" }]));
    expect(() => readCasPins(casDir)).toThrow(/unknown field "notes"/);
  });

  test("CONTROL: a record with ONLY PinCap's own fields (cid/tier/holder/life) reads clean, no refusal", () => {
    const cid = "f".repeat(64);
    writeFileSync(join(casDir, ".pins.json"), JSON.stringify([{ cid, tier: "veil", holder: "x", life: LIFE }]));
    expect(readCasPins(casDir)).toEqual([{ cid, tier: "veil", holder: "x", life: LIFE }]);
  });

  test("MUTATION PROOF: a reader that silently drops the stray field and keeps the record lets a clock field in", () => {
    // A picking reader — only the known fields off the record, anything else dropped without complaint —
    // never sees the stray `until`, so it never refuses. `readCasPins` is not that reader.
    const cid = "a1".repeat(32);
    const record = { cid, tier: "veil", holder: "x", until: 999_999_999_999 } as Record<string, unknown>;
    const pickingRead = (p: Record<string, unknown>) => ({
      cid: p["cid"] as string,
      holder: typeof p["holder"] === "string" ? p["holder"] : "unknown",
      tier: typeof p["tier"] === "string" ? p["tier"] : "veil",
    });
    expect(pickingRead(record)).toEqual({ cid, holder: "x", tier: "veil" });   // the picking reader never balks
    // The REAL reader, fed the exact same on-disk shape, refuses instead.
    writeFileSync(join(casDir, ".pins.json"), JSON.stringify([record]));
    expect(() => readCasPins(casDir)).toThrow(/unknown field "until"/);
  });

  test("installCasSweep: a clock-field sidecar faults the production tick's own `pins()` reader — the sweep run refuses, nothing deletes", async () => {
    const orphan = blob("an orphan beside a clock-field pin sidecar");
    writeCasEntriesFs([orphan], casDir);
    writeFileSync(join(casDir, ".pins.json"), JSON.stringify([{ cid: "b2".repeat(32), tier: "veil", holder: "x", until: 1 }]));
    const logs: string[] = [];
    const installed = installCasSweep({
      registry: { register: () => {} },
      casDir,
      references: () => [],
      protect: new Set(),
      pins: () => readCasPins(casDir),   // THROWS on the clock-field sidecar — the production wiring shape
      realmClock: () => clockAt(5),
      currentLife: () => LIFE,
      log: (line) => logs.push(line),
    });
    await expect(installed.sweep(false)).rejects.toThrow(/unknown field "until"/);
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
      currentLife: () => LIFE,
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
        currentLife: () => LIFE,
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
      currentLife: () => LIFE,
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
        currentLife: () => LIFE,
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
        currentLife: () => LIFE,
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
      currentLife: () => LIFE,
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
    const seed = { format: "lararium-genesis-seed", actorSeed: "actor",
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

/**
 * THE STORED ISLAND OUTLIVES THE SEED IT WAS BORN FROM. A vessel founded on an explicit genesis reloads its
 * persisted oracle island at every boot under the fixed doc id, so after a rebuild that declares a new seed it
 * still serves its grammar and canon floor from the blobs that island names. The sweep must keep those bytes:
 * a protect set drawn from the declared seed alone leaves the stored island's own blobs (its grammar, its floor
 * manifest, its floor snapshots) unguarded, and a realm clock that ages them out leaves the mounts reading
 * bytes that are gone. The protect set reads the UNION of the declared seed and the stored island.
 */
describe("the genesis protect set, when the stored island names blobs the declared seed does not", () => {
  let genesisDir = "";
  beforeEach(() => { genesisDir = mkdtempSync(join(tmpdir(), "lares-genesisdir-")); });
  afterEach(() => { rmSync(genesisDir, { recursive: true, force: true }); });

  const seedCid = "a".repeat(64), oldCore = "b".repeat(64), oldFloor = "c".repeat(64);
  const writeSeed = (): void => {
    const seed = { format: "lararium-genesis-seed", actorSeed: "actor",
      blobs: { x: { id: "x", sha256: seedCid, mimeType: "application/json", version: "1" } },
      tiddlers: {
        "lar:///ha.ka.ba/bags/oracle/genesis-cid-engine": { tiddler: { cid: "e" } },
        "lar:///ha.ka.ba/bags/oracle/genesis-cid-grammar": { tiddler: { cid: "g" } },
        "lar:///ha.ka.ba/bags/oracle/genesis-cid-plugins": { tiddler: { cid: "p" } },
      } };
    writeFileSync(join(genesisDir, "seed.json"), JSON.stringify(seed), "utf8");
  };
  const storedIsland = (): LarDoc => ({
    blobs: {
      [ENGINE_CORE_ID]: { id: ENGINE_CORE_ID, version: "1", sha256: oldCore, mimeType: "application/javascript" },
      "floor-lares":    { id: "floor-lares", version: "1", sha256: oldFloor, mimeType: "application/json", kind: "floor" },
    },
  }) as unknown as LarDoc;

  test("★ the stored island's blobs stand protected beside the declared seed's ★", () => {
    writeSeed();
    const set = genesisProtectSet(genesisDir, storedIsland());
    expect(set).not.toBe("unreadable");
    expect([...(set as ReadonlySet<string>)].sort()).toEqual([seedCid, oldCore, oldFloor]);
  });

  test("★ a stored island with no declared seed still protects its own blobs ★", () => {
    const set = genesisProtectSet(genesisDir, storedIsland());
    expect(set).not.toBe("unreadable");
    expect([...(set as ReadonlySet<string>)].sort()).toEqual([oldCore, oldFloor]);
  });

  test("★ a stored island whose blob metadata will not read withholds the sweep ★", () => {
    writeSeed();
    const torn = { blobs: { "floor-lares": { id: "floor-lares", version: "1", sha256: "not-a-cid", mimeType: "application/json" } } } as unknown as LarDoc;
    expect(genesisProtectSet(genesisDir, torn)).toBe("unreadable");
  });
});

// ── THE VESSEL LIFE — minted ONLY on a VESSEL's own claim, never a one-shot direct act ──────────────────────
// `owned-store.ts`'s `claimStore` mints `<storageDir>/.life` inside the claim it already serializes through one
// bound socket name. Proofs: each vessel claim mints a fresh life, never the one at rest; a DIRECT (one-shot CLI)
// claim mints none — the churn of unrelated `lares` commands never ends a `--held` pin; a store that names no
// life, or a torn one, reads null; a life record restored or reused from an earlier life never comes back as the
// claim's own life.
import { claimStore, readVesselLife, vesselLifePath } from "../src/owned-store.js";

describe("owned-store — a VESSEL claim mints a fresh life", () => {
  let storeDir = "";
  beforeEach(() => { storeDir = mkdtempSync(join(tmpdir(), "lr-vessel-life-")); });
  afterEach(() => { rmSync(storeDir, { recursive: true, force: true }); });

  test("a store no vessel ever claimed names no life", () => {
    expect(readVesselLife(storeDir)).toBeNull();
  });

  test("each VESSEL claim mints its own life and rides it on the claim; the next claim names another", async () => {
    const first = await claimStore(storeDir, { holder: "vessel" });
    expect(readVesselLife(storeDir)).toBe(first.life);
    await first.release();
    const second = await claimStore(storeDir, { holder: "vessel" });
    expect(readVesselLife(storeDir)).toBe(second.life);
    expect(second.life).not.toBe(first.life);
    await second.release();
  });

  test("CONTROL: a DIRECT (one-shot) claim mints no life and moves none — unrelated `lares` commands never end a `--held` pin", async () => {
    const vessel = await claimStore(storeDir, { holder: "vessel" });
    const life = vessel.life;
    await vessel.release();
    const direct = await claimStore(storeDir, { holder: "direct" });
    try { expect(direct.life).toBeUndefined(); } finally { await direct.release(); }
    expect(readVesselLife(storeDir)).toBe(life);
  });

  test("the mint is ATOMIC (temp + rename) — a reader never observes a torn id", async () => {
    const claim = await claimStore(storeDir, { holder: "vessel" });
    try {
      expect(readFileSync(vesselLifePath(storeDir), "utf8").trim()).toBe(claim.life);
      expect(existsSync(`${vesselLifePath(storeDir)}.${process.pid}.tmp`)).toBe(false);   // no stranded temp
    } finally { await claim.release(); }
  });

  test("a torn life record names no life — never a made-up one", () => {
    for (const torn of ["not-a-life\n", "7\n", `${"a".repeat(31)}\n`, ""]) {
      writeFileSync(vesselLifePath(storeDir), torn);
      expect(readVesselLife(storeDir), JSON.stringify(torn)).toBeNull();
    }
  });

  test("RED: a mint that throws releases the claim it bound, so the next claim stands", async () => {
    const dir = join(storeDir, "life-unwritable");
    mkdirSync(join(dir, ".life"), { recursive: true });   // a directory where the life file rests: the atomic rename refuses
    await expect(claimStore(dir, { holder: "vessel" })).rejects.toThrow();
    rmSync(join(dir, ".life"), { recursive: true, force: true });
    const next = await claimStore(dir, { holder: "vessel" });
    try { expect(readVesselLife(dir)).toBe(next.life); } finally { await next.release(); }
  });

  test("RED: a life record restored or reused from an earlier life never revives it — the next claim mints past it", async () => {
    const first = await claimStore(storeDir, { holder: "vessel" });
    const earlier = first.life;
    await first.release();
    const second = await claimStore(storeDir, { holder: "vessel" });
    await second.release();
    writeFileSync(vesselLifePath(storeDir), `${earlier}\n`);   // a backup restored over the record
    const third = await claimStore(storeDir, { holder: "vessel" });
    try {
      expect(third.life).not.toBe(earlier);
      expect(readVesselLife(storeDir)).toBe(third.life);
    } finally { await third.release(); }
  });
});

// ── `InstallCasSweepOptions.currentLife` WIRED into the production sweep ────────────────────────────────────
// The install threads `currentLife` straight into every `casSweep` call the tick and the verb make, read fresh
// every sweep. The live wiring (`open-node-vessel.ts`) supplies `() => storeClaim.life`, the life THIS vessel's
// own `claimStore({holder:"vessel"})` minted. Proven here at the `installCasSweep` grain (a life cell standing in
// for the live `StoreClaim`).
describe("installCasSweep — the production sweep threads a live `currentLife` through to `casSweep`", () => {
  test("a `--held` pin (life stamped in life one) sweeps once `currentLife` reports another life — the live-reboot shape", async () => {
    const held = blob("a held pin, stamped in life one");
    writeCasEntriesFs([held], casDir);
    const registry = fakeRegistry();
    let life = LIFE;                                           // this life's own id, as `claimStore` would hand it
    let pace = 2;                                              // the realm's own roll — independent of the life (realmPace reads < 2 as "no pace yet")
    const sweep = installCasSweep({
      registry, casDir, references: async () => [], protect: new Set(),
      pins: () => [{ cid: held.cid, tier: "veil", holder: "import-job", life: LIFE }],
      currentLife: () => life,                                 // the LIVE wire under test
      realmClock: () => clockAt(pace), log: () => {},
    });
    try {
      // Life one: the stamped life stands — the held pin still stands.
      // (This call also seeds the ledger: `held` is first seen unreferenced at roll 1.)
      const lifeOne = (await registry.verbs.get("cas-sweep")!({ dryRun: true })) as unknown as CasSweepVerbResult;
      expect(lifeOne.pinned).toEqual([held.cid]);
      expect(lifeOne.swept).toEqual([]);
      // Another life (a real reboot mints one) — and the realm has rolled past the floor grace too, so the pin
      // law alone decides: the SAME sidecar entry now reads ended and the blob has aged enough to go.
      life = NEXT_LIFE;
      pace = 11;                                               // 9 rolls past the first-seen roll (2) — past the 8-roll floor
      const lifeTwo = (await registry.verbs.get("cas-sweep")!({ dryRun: true })) as unknown as CasSweepVerbResult;
      expect(lifeTwo.pinned).toEqual([]);
      expect(lifeTwo.swept).toEqual([held.cid]);
    } finally { sweep.stop(); }
  });

  test("CONTROL: a bare pin (no `life`) keeps standing across every life", async () => {
    const operatorPin = blob("the operator's own standing pin, no life");
    writeCasEntriesFs([operatorPin], casDir);
    const registry = fakeRegistry();
    let life = LIFE;
    const sweep = installCasSweep({
      registry, casDir, references: async () => [], protect: new Set(),
      pins: () => [{ cid: operatorPin.cid, tier: "veil", holder: "operator" }],
      currentLife: () => life,
      realmClock: () => clockAt(20), log: () => {},
    });
    try {
      for (const next of [LIFE, NEXT_LIFE, "c".repeat(32)]) {
        life = next;
        const r = (await registry.verbs.get("cas-sweep")!({ dryRun: true })) as unknown as CasSweepVerbResult;
        expect(r.pinned, `life ${next}`).toEqual([operatorPin.cid]);
        expect(r.swept, `life ${next}`).toEqual([]);
      }
    } finally { sweep.stop(); }
  });

  test("MUTATION: a caller that never re-reads `currentLife` (the 'drop the live wire' shape) leaves an ended held pin standing", async () => {
    const held = blob("a held pin a frozen life wrongly keeps");
    writeCasEntriesFs([held], casDir);
    const registry = fakeRegistry();
    const sweep = installCasSweep({
      registry, casDir, references: async () => [], protect: new Set(),
      pins: () => [{ cid: held.cid, tier: "veil", holder: "import-job", life: LIFE }],
      currentLife: () => LIFE,                                 // MUTATION: frozen at life one forever — never re-reads the live claim
      realmClock: () => clockAt(20), log: () => {},
    });
    try {
      // Another life stands (the live fact), but this caller's frozen `currentLife` never learns it — exactly the
      // fault `open-node-vessel.ts`'s live `() => storeClaim.life` wiring closes.
      const r = (await registry.verbs.get("cas-sweep")!({ dryRun: true })) as unknown as CasSweepVerbResult;
      expect(r.pinned, "the held pin WRONGLY still stands — the mutation this proof names").toEqual([held.cid]);
      expect(r.swept).toEqual([]);
    } finally { sweep.stop(); }
  });
});


describe("installCasSweep — the daemon names its protect set to a reader (the one union, never re-derived)", () => {
  test("the `cas-protect` verb answers the exact set the sweep guards: seed blobs and the stored island's together", async () => {
    const seedBlob = blob("a seed-named engine blob"), islandBlob = blob("a blob only the stored island names");
    const verbs = new Map<string, (a: Record<string, unknown>) => Promise<Record<string, unknown>>>();
    const installed = installCasSweep({
      registry: { register: (name, handler) => { verbs.set(name, handler); } },
      casDir, references: () => [], protect: new Set([seedBlob.cid, islandBlob.cid]),
      pins: () => [], realmClock: () => clockAt(5), currentLife: () => LIFE, log: () => {},
    });
    const answer = await verbs.get("cas-protect")?.({});
    expect(answer?.["protect"]).toEqual([islandBlob.cid, seedBlob.cid].sort());
    installed.stop();
  });
});
