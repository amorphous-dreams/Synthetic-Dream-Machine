/**
 * node-cas — the Node.js filesystem content-addressed store (the breath path).
 *
 * The node face of the shared CAS contract (@lararium/mesh `cas`): heavy immutable
 * engine bytes (TW5 core + plugin tiddlers + every large blob) live on disk keyed by
 * sha256 (CID), written by the vessel on genesis-load and pulled by each island worker
 * via `resolveByCid`, off the sync port. The filesystem is process-shared, so a worker
 * reads what the main thread wrote — the nodefs face of the origin-shared OPFS CAS,
 * isomorphic by composition (vessels-as-#has-caps).
 *
 * Meme: lar:///ha.ka.ba/lararium/node/node-cas
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  pinnedCids, casReferences, graceForTier, tiersByGraceDescending,
  type GenesisCasManifest, type PinCap, type CasReferenceEntry,
} from "@lararium/mesh";
import { runtimeCasOverride } from "./lares-config.js";

/** The CAS dir for a vessel rooted at `storageDir` (`<lares>/vessel` → `<lares>/vessel/cas`). The
 *  runtime-cas OVERRIDE (`LAR_CAS` → `config.vessel.cas`) wins when sited — the SAME lever the CLI stager
 *  (`larCasDir`) honors, so ONE dir holds the blob the CLI stages and the blob a worker resolveByCid-reads.
 *  Absent → the storage-rooted default. A lever moving only one side diverges the two silently. */
export function casDirForStorage(storageDir: string): string {
  return runtimeCasOverride() ?? join(storageDir, "cas");
}

/**
 * The CAS dir an island WORKER derives from its own manifest storage dir. Every
 * island's nodefs storage dir is a direct child of the vessel storage root
 * (…/daemon, …/<wikiSlug>), so the sibling `cas` dir is one level up — the same
 * dir the main thread wrote via `casDirForStorage(storageDir)`.
 */
export function casDirFromIslandStorageDir(islandStorageDir: string): string {
  return join(dirname(islandStorageDir), "cas");
}

/**
 * Write each {cid, bytes} CAS entry as a content-addressed file under `casDir`.
 * Idempotent (content-addressed, immutable → skip if present). The build sink calls
 * this to lay down `genesis/cas/<cid>` from the artifact's casEntries. Returns count.
 */
export function writeCasEntriesFs(
  entries: readonly { readonly cid: string; readonly bytes: Uint8Array }[],
  casDir:  string,
): number {
  mkdirSync(casDir, { recursive: true });
  let written = 0;
  for (const { cid, bytes } of entries) {
    const path = join(casDir, cid);
    if (existsSync(path)) continue;
    writeFileSync(path, bytes);
    written += 1;
  }
  return written;
}

/**
 * Mirror a genesis artifact's CAS files (genesis/cas/<cid>) into a runtime CAS dir,
 * driven by the manifest — the node face of the byte SOURCE. The manifest names
 * genesis/cas/ files as the byte source; the CID a worker later requests stays the
 * same regardless of source. Idempotent (content-addressed). Returns
 * count copied; throws if a manifest-named source file is absent (corrupt genesis).
 */
export function mirrorGenesisCasFs(
  manifest:      GenesisCasManifest,
  genesisCasDir: string,
  runtimeCasDir: string,
): number {
  mkdirSync(runtimeCasDir, { recursive: true });
  let copied = 0;
  for (const { cid } of manifest.blobs) {
    const dst = join(runtimeCasDir, cid);
    if (existsSync(dst)) continue;
    const src = join(genesisCasDir, cid);
    if (!existsSync(src)) {
      throw new Error(`[node-cas] genesis CAS file absent for cid ${cid} at ${src} — re-run build:genesis`);
    }
    copyFileSync(src, dst);
    copied += 1;
  }
  return copied;
}

/** Read content-addressed bytes by CID from the fs CAS. Null if absent. This IS
 *  the worker's `resolveByCid` shore (filesystem process-shared, no IPC). */
export function readCasBlobFromFs(cid: string, casDir: string): Uint8Array | null {
  try {
    const path = join(casDir, cid);
    if (!existsSync(path)) return null;
    return new Uint8Array(readFileSync(path));
  } catch {
    return null;
  }
}

// ── PIN and RELEASE (tiddler-carriage #/pin-and-release) ─────────────────────
//
// A blob is RETAINED while any locally-held record references its cid (`casReferences`, derived —
// never stored) or the genesis CAS names it (the engine + plugins the bulb ships); an unreferenced,
// unprotected blob MAY sweep once older than the grace. `DROP <bag>` releases by taking the bag's
// records out of the derived count — the sweep reads the count, it never reads the verb.

/** A cleartext CAS file name — hex sha256. Anything else in the dir (a sidecar) is never a blob. */
const CAS_CID_RE = /^[0-9a-f]{64}$/;

/** List the blobs a CAS dir holds — cid + byte size, sorted by cid. An absent dir lists nothing. */
export function listCasBlobs(casDir: string): { cid: string; size: number }[] {
  let names: string[];
  try { names = readdirSync(casDir); } catch { return []; }
  return names
    .filter((n) => CAS_CID_RE.test(n))
    .sort()
    .map((cid) => ({ cid, size: statSync(join(casDir, cid)).size }));
}

export interface CasSweepOptions {
  readonly casDir:     string;
  /** The derived reference count — `casReferences(composite.entries())`. */
  readonly references: ReadonlyMap<string, ReadonlySet<string>>;
  /** The cids the genesis CAS holds (the manifest's blobs) — never swept, referenced or not. */
  readonly protect:    ReadonlySet<string>;
  /** An unreferenced blob younger than this stays (a staged body its verb has not landed yet). The floor
   *  every blob gets; `graceMsFor` reads a longer one per tier. */
  readonly graceMs:    number;
  /** GRACE PER TIER (basket-one #/grace-and-pin): the grace for THIS cid, read off the tier of the bag whose
   *  pointer named it against the realm's own baseline — `graceForTier(tier, baselineMs)` (@lararium/mesh).
   *  Absent → `graceMs` for every blob. A reading below `graceMs` never shortens the floor. */
  readonly graceMsFor?: (cid: string) => number;
  /** PIN at cid grain: the pins beside the bag's caps. A standing pin (now < expiry) holds its blob past any
   *  grace; an expired pin holds nothing and the blob rides the ordinary grace. */
  readonly pins?:      readonly PinCap[];
  /** Name what would sweep; delete nothing. */
  readonly dryRun?:    boolean;
  readonly now?:       number;
}

export interface CasSweepResult {
  /** Deleted (or, dry, would delete) — unreferenced · unprotected · older than the grace. */
  readonly swept:     string[];
  /** Held by a reference or the grace. */
  readonly kept:      string[];
  /** Held by the genesis manifest. */
  readonly protected: string[];
  /** Held by a STANDING pin (unreferenced or not) — the Librarian's forty. */
  readonly pinned:    string[];
}

/** Mark-and-sweep the cleartext CAS from the derived references + the genesis protect set. */
export function casSweep(opts: CasSweepOptions): CasSweepResult {
  const now = opts.now ?? Date.now();
  const standing = pinnedCids(opts.pins ?? [], now);   // expired pins fall out here — they hold nothing
  const swept: string[] = [], kept: string[] = [], protectedCids: string[] = [], pinned: string[] = [];
  for (const { cid } of listCasBlobs(opts.casDir)) {
    if (opts.protect.has(cid)) { protectedCids.push(cid); continue; }
    if (standing.has(cid)) { pinned.push(cid); continue; }
    if ((opts.references.get(cid)?.size ?? 0) > 0) { kept.push(cid); continue; }
    const path = join(opts.casDir, cid);
    const grace = Math.max(opts.graceMs, opts.graceMsFor?.(cid) ?? opts.graceMs);
    if (now - statSync(path).mtimeMs < grace) { kept.push(cid); continue; }
    if (!opts.dryRun) unlinkSync(path);
    swept.push(cid);
  }
  return { swept, kept, protected: protectedCids, pinned };
}

// ── The PIN sidecar — the pins a vessel holds beside its cleartext CAS ─────────────────────────────
//
// `.pins.json` in the CAS dir: a non-hex name, so `listCasBlobs` never reads it as a blob and the sweep
// never touches it. Read whole, written whole (a small file; a pin per re-standable working).

const PINS_FILE = ".pins.json";

/** The pins a CAS dir holds — an absent or torn sidecar reads as no pins. */
export function readCasPins(casDir: string): PinCap[] {
  try {
    const raw = JSON.parse(readFileSync(join(casDir, PINS_FILE), "utf8")) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((p): p is PinCap =>
      !!p && typeof p === "object" && typeof (p as PinCap).cid === "string" && typeof (p as PinCap).expiry === "number"
      && typeof (p as PinCap).holder === "string" && typeof (p as PinCap).tier === "string");
  } catch { return []; }
}

/** Write the pins whole. */
export function writeCasPins(casDir: string, pins: readonly PinCap[]): void {
  mkdirSync(casDir, { recursive: true });
  writeFileSync(join(casDir, PINS_FILE), JSON.stringify(pins, null, 2) + "\n");
}

/** Add (or replace, by cid) one pin. Returns the standing set. */
export function pinCas(casDir: string, pin: PinCap): PinCap[] {
  const next = [...readCasPins(casDir).filter((p) => p.cid !== pin.cid), pin];
  writeCasPins(casDir, next);
  return next;
}

/** Release a pin by cid. Returns the standing set. */
export function releaseCas(casDir: string, cid: string): PinCap[] {
  const next = readCasPins(casDir).filter((p) => p.cid !== cid);
  writeCasPins(casDir, next);
  return next;
}

// ── THE SWEEP TICK — the production caller (basket-one #/grace-and-pin) ─────────────────────────────
//
// "A clock sweeps by the calendar; a grace sweeps by the realm's own pace." The tick's cadence therefore
// reads off the realm's baseline, never a wall-clock constant: the SHORTEST tier's grace over four, so a
// blob past its grace waits at most a quarter of that grace for the sweep while the daemon never walks
// the dir more often than the pace warrants. A realm that has not said its pace (no baseline) fires no
// sweep at all — a quiet hearth keeps every blob, exactly as a centuries-old realm goes cold only by
// true abandonment. The floor grace for a blob whose tier no pointer names any more reads the LONGEST
// tier (an unreferenced blob's tier is unknowable; the fail-safe reads private).

/** The tick cadence in ms for a realm baseline — the shortest tier's grace / 4; null without a baseline. */
export function sweepCadenceMs(baselineMs: number | null): number | null {
  if (baselineMs === null || !Number.isFinite(baselineMs) || baselineMs <= 0) return null;
  const tiers = tiersByGraceDescending();
  const shortest = tiers[tiers.length - 1]!;
  return graceForTier(shortest, baselineMs) / 4;
}

/** What `cas-sweep` answers: the cids swept (or, dry, that would sweep), the cids a standing pin held, and
 *  every cid retained by a reference, the grace or the genesis protect set. */
export interface CasSweepVerbResult {
  readonly verb:     "cas-sweep";
  readonly dryRun:   boolean;
  readonly swept:    string[];
  readonly pinned:   string[];
  readonly retained: string[];
  /** The baseline the sweep read (null → the floor grace alone, never a shorter one). */
  readonly baselineMs: number | null;
}

export interface InstallCasSweepOptions {
  readonly registry:   { register(name: string, handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>): void };
  readonly casDir:     string;
  /** The live records the composite holds — `composite.entries()`; the reference count derives from them. */
  readonly references: () => Promise<Iterable<CasReferenceEntry>>;
  /** The genesis manifest's cids — never swept. */
  readonly protect:    ReadonlySet<string>;
  /** The standing pins beside the CAS (`readCasPins`) — read at each sweep, never cached. */
  readonly pins:       () => readonly PinCap[];
  /** The realm's own pace: the ms one expected roll takes, or null while the realm has not said it
   *  (`realmPaceReader` observes it off the realm's feed). */
  readonly baselineMs: () => number | null | Promise<number | null>;
  readonly log:        (line: string) => void;
  /** Observes each tick's result (a witness hook; the verb's caller reads the result directly). */
  readonly onSweep?:   (r: CasSweepVerbResult) => void;
  readonly now?:       () => number;
}

export interface CasSweepInstalled {
  /** Run one sweep now (the verb's own body). */
  readonly sweep: (dryRun: boolean) => Promise<CasSweepVerbResult>;
  /** How often the tick re-reads the baseline to learn whether a cadence stands yet. */
  readonly probeMs: number;
  readonly stop: () => void;
}

/**
 * Install the sweep: register the `cas-sweep` verb (`{ dryRun?: boolean }`) and start the tick. The tick
 * probes the baseline once a minute (a cheap read); the FIRST sweep after a cadence stands runs one cadence
 * later, and every later sweep one cadence after the last — so a baseline that lengthens slows the tick
 * and one that shortens quickens it, without a restart. The interval is unref'd: it never holds the
 * process open.
 */
export function installCasSweep(opts: InstallCasSweepOptions): CasSweepInstalled {
  const now = opts.now ?? (() => Date.now());
  const probeMs = 60_000;
  const sweep = async (dryRun: boolean): Promise<CasSweepVerbResult> => {
    const baselineMs = await opts.baselineMs();
    const tiers = tiersByGraceDescending();
    const longest = tiers[0]!;
    // The floor: the longest tier's grace under the baseline; without a baseline, ONE unit (graceForTier's
    // own reading) — the tick never reaches here without a baseline, and the verb says which it read.
    const graceMs = graceForTier(longest, baselineMs ?? Number.NaN);
    const r = casSweep({
      casDir: opts.casDir,
      references: casReferences(await opts.references()),
      protect: opts.protect,
      pins: opts.pins(),
      graceMs,
      dryRun,
      now: now(),
    });
    const out: CasSweepVerbResult = {
      verb: "cas-sweep", dryRun, swept: r.swept, pinned: r.pinned,
      retained: [...r.kept, ...r.protected], baselineMs,
    };
    opts.onSweep?.(out);
    return out;
  };
  opts.registry.register("cas-sweep", async (args) => {
    const r = await sweep(args["dryRun"] === true);
    return r as unknown as Record<string, unknown>;
  });

  let lastSweepAt = now();
  let stopped = false;
  let inFlight = false;
  const probe = async (): Promise<void> => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const cadence = sweepCadenceMs(await opts.baselineMs());
      if (cadence === null) { lastSweepAt = now(); return; }   // no pace yet — the clock does not run
      if (now() - lastSweepAt < cadence) return;
      lastSweepAt = now();
      const r = await sweep(false);
      if (r.swept.length > 0) opts.log(`[cas-sweep] swept ${r.swept.length} blob(s) past the grace · pinned ${r.pinned.length} · retained ${r.retained.length}`);
    } catch (err) {
      opts.log(`[cas-sweep] tick faulted: ${(err as Error)?.message ?? err}`);
    } finally { inFlight = false; }
  };
  const timer = setInterval(() => { void probe(); }, probeMs);
  timer.unref?.();
  return { sweep, probeMs, stop: () => { stopped = true; clearInterval(timer); } };
}

/**
 * THE REALM'S OWN PACE, observed: the ms one roll of the realm's maintenance feed takes, read off the
 * max-register epoch this vessel's board folds (`realmMaintenanceFromBoard(...).effectiveEpoch`). The reader
 * samples the epoch at first ask and answers `(elapsed) / (rolls since)` once at least `minRolls` rolls
 * stand behind it — one roll yields no interval, so it abstains (null) until then, and a realm nobody feeds
 * abstains forever: the sweep never runs against a calendar. The sample never persists; a reboot re-learns
 * the pace from the rolls it sees.
 */
export function realmPaceReader(opts: {
  readonly epoch:    () => number | Promise<number>;
  readonly now?:     () => number;
  readonly minRolls?: number;
}): () => Promise<number | null> {
  const now = opts.now ?? (() => Date.now());
  const minRolls = opts.minRolls ?? 2;
  let first: { at: number; epoch: number } | null = null;
  return async () => {
    const epoch = await opts.epoch();
    if (!Number.isFinite(epoch)) return null;
    if (!first) { first = { at: now(), epoch }; return null; }
    const rolls = epoch - first.epoch;
    if (rolls < minRolls) return null;
    const elapsed = now() - first.at;
    return elapsed > 0 ? elapsed / rolls : null;
  };
}
