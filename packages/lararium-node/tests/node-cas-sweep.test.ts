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
import { casReferences, sha256HexBytesSync, utf8Bytes, type CasReferenceEntry, type GenesisCasManifest } from "@lararium/mesh";
import { casSweep, listCasBlobs, writeCasEntriesFs } from "../src/node-cas.js";

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
    const held = casSweep({ casDir, references: casReferences([pointer("lares", "lar:///t.w.b/photo", photo.cid)]), protect: new Set(), graceMs: 0 });
    expect(held.swept).toEqual([]);
    expect(existsSync(join(casDir, photo.cid))).toBe(true);
    // DROP <bag> — the bag's records leave the composite, so the derived count reads zero.
    const dropped = casSweep({ casDir, references: casReferences([]), protect: new Set(), graceMs: 0 });
    expect(dropped.swept).toEqual([photo.cid]);
    expect(existsSync(join(casDir, photo.cid))).toBe(false);
  });

  test("CONTROL: a genesis blob never sweeps, referenced by nothing", () => {
    const core = blob("the engine core");
    writeCasEntriesFs([core], casDir);
    age(core.cid);
    const r = casSweep({ casDir, references: new Map(), protect: new Set(genesis.blobs.map((b) => b.cid)), graceMs: 0 });
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
    const r = casSweep({ casDir, references: casReferences(afterDrop), protect: new Set(), graceMs: 0 });
    expect(r.swept).toEqual([]);
    expect(existsSync(join(casDir, photo.cid))).toBe(true);
  });

  test("the grace holds a young unreferenced blob; a dry run deletes nothing", () => {
    const fresh = blob("just staged, not yet landed");
    writeCasEntriesFs([fresh], casDir);
    const young = casSweep({ casDir, references: new Map(), protect: new Set(), graceMs: 60_000 });
    expect(young.swept).toEqual([]);
    expect(young.kept).toContain(fresh.cid);
    age(fresh.cid);
    const dry = casSweep({ casDir, references: new Map(), protect: new Set(), graceMs: 0, dryRun: true });
    expect(dry.swept).toEqual([fresh.cid]);
    expect(existsSync(join(casDir, fresh.cid))).toBe(true);
  });

  test("a non-cid name in the dir is never touched; listCasBlobs reports cid + size", () => {
    writeFileSync(join(casDir, "bulb-pointer-state.json"), "{}");
    const b = blob("x");
    writeCasEntriesFs([b], casDir);
    age(b.cid);
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), graceMs: 0 });
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
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), graceMs: 0, pins });
    expect(r.swept).toEqual([]);
    expect(r.pinned).toEqual([b.cid]);
    expect(existsSync(join(casDir, b.cid))).toBe(true);
  });

  test("an EXPIRED pin releases the blob to the grace — aged past it, it sweeps", () => {
    const b = blob("a pin whose lifetime ended");
    writeCasEntriesFs([b], casDir);
    age(b.cid);
    const pins: PinCap[] = [{ cid: b.cid, tier: "veil", holder: "vessel-1", expiry: Date.now() - 1 }];
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), graceMs: 0, pins });
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
    const r = casSweep({ casDir, references: new Map(), protect: new Set(), graceMs: 0,
                         graceMsFor: (cid) => graceForTier(tierOf(cid), baselineMs) });
    expect(r.swept).toEqual([pub.cid]);
    expect(r.kept).toContain(veil.cid);
  });
});

// ── THE PRODUCTION CALLER — a sweep TICK on the daemon + the `cas-sweep` verb ─────────────────────────────
// `casSweep` had no caller. The tick's cadence reads off the realm's own baseline: the SHORTEST tier's grace
// over four (a blob past its grace waits at most a quarter-grace for the sweep), never a wall-clock constant;
// no baseline (the realm has not said its pace) → no tick fires, ever. The verb reports {swept, pinned,
// retained}; `dryRun` moves nothing; the genesis protect set and standing pins hold as before (CONTROL).
import { vi } from "vitest";
import { sweepCadenceMs, installCasSweep, realmPaceReader, type CasSweepVerbResult } from "../src/node-cas.js";

type Handler = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
function fakeRegistry(): { register(name: string, h: Handler): void; verbs: Map<string, Handler> } {
  const verbs = new Map<string, Handler>();
  return { verbs, register: (name, h) => { verbs.set(name, h); } };
}

describe("the sweep tick and the cas-sweep verb", () => {
  test("the cadence = the shortest tier's grace / 4 against the realm baseline; no baseline → null", () => {
    const baselineMs = 40 * 60_000;
    expect(sweepCadenceMs(baselineMs)).toBe(graceForTier("public", baselineMs) / 4);
    expect(sweepCadenceMs(null)).toBeNull();
    expect(sweepCadenceMs(0)).toBeNull();
    expect(sweepCadenceMs(Number.NaN)).toBeNull();
  });

  test("`cas-sweep` sweeps an aged orphan, keeps the genesis and the pinned, reports {swept, pinned, retained}", async () => {
    const orphan = blob("an orphan past its grace");
    const core   = blob("the engine core");
    const kept   = blob("a pinned working");
    writeCasEntriesFs([orphan, core, kept], casDir);
    for (const b of [orphan, core, kept]) age(b.cid);
    const registry = fakeRegistry();
    const sweep = installCasSweep({
      registry, casDir,
      references: async () => [],
      protect: new Set(genesis.blobs.map((b) => b.cid)),
      pins: () => [{ cid: kept.cid, tier: "veil", holder: "operator", expiry: Date.now() + 86_400_000 }],
      baselineMs: () => 60_000,   // one-minute rolls: public grace 1m, an hour-old orphan is past it
      log: () => {},
    });
    try {
      // CONTROL: a dry run names the orphan and moves nothing.
      const dry = (await registry.verbs.get("cas-sweep")!({ dryRun: true })) as unknown as CasSweepVerbResult;
      expect(dry.dryRun).toBe(true);
      expect(dry.swept).toEqual([orphan.cid]);
      expect(existsSync(join(casDir, orphan.cid))).toBe(true);
      const live = (await registry.verbs.get("cas-sweep")!({})) as unknown as CasSweepVerbResult;
      expect(live.swept).toEqual([orphan.cid]);
      expect(live.pinned).toEqual([kept.cid]);
      expect(live.retained).toEqual(expect.arrayContaining([core.cid]));
      expect(existsSync(join(casDir, orphan.cid))).toBe(false);
      expect(existsSync(join(casDir, core.cid))).toBe(true);      // CONTROL: genesis never sweeps
      expect(existsSync(join(casDir, kept.cid))).toBe(true);      // CONTROL: pinned never sweeps
    } finally { sweep.stop(); }
  });

  test("the TICK fires at the cadence under a baseline, and never without one (CONTROL)", async () => {
    vi.useFakeTimers();
    try {
      const orphan = blob("an orphan the tick finds");
      writeCasEntriesFs([orphan], casDir);
      age(orphan.cid);
      const registry = fakeRegistry();
      let baseline: number | null = null;
      const swept: string[][] = [];
      const sweep = installCasSweep({
        registry, casDir, references: async () => [], protect: new Set(), pins: () => [],
        baselineMs: () => baseline, log: () => {}, onSweep: (r) => { swept.push(r.swept); },
      });
      try {
        await vi.advanceTimersByTimeAsync(24 * 3_600_000);
        expect(swept, "no baseline → no sweep, however long the wall-clock runs").toEqual([]);
        expect(existsSync(join(casDir, orphan.cid))).toBe(true);
        baseline = 60_000;                       // the realm now says its pace: one roll a minute
        await vi.advanceTimersByTimeAsync(sweepCadenceMs(baseline)! + sweep.probeMs + 1);
        expect(swept.flat()).toEqual([orphan.cid]);
        expect(existsSync(join(casDir, orphan.cid))).toBe(false);
      } finally { sweep.stop(); }
    } finally { vi.useRealTimers(); }
  });

  test("realmPaceReader abstains until two rolls stand, then answers ms-per-roll off the feed (never a calendar)", async () => {
    let t = 1_000_000; let epoch = 5;
    const pace = realmPaceReader({ epoch: () => epoch, now: () => t });
    expect(await pace()).toBeNull();                 // first sample — no interval yet
    t += 3_600_000;
    expect(await pace(), "no roll → no pace, however long the clock runs").toBeNull();
    epoch = 6; t += 60_000;
    expect(await pace(), "one roll → no interval").toBeNull();
    epoch = 7; t += 60_000;
    expect(await pace()).toBe((3_600_000 + 120_000) / 2);
  });
});
