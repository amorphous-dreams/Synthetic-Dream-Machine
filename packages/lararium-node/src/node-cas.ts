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
  casReferences, graceForTier, tiersByGraceDescending, realmPace, pinnedCids,
  sha256HexBytesSync, verifyCidBytes,
  type GenesisCasManifest, type PinCap, type CasReferenceEntry, type CabalRealmMaintenanceProvenance, type CasTransitTransport,
} from "@lararium/mesh";
import { runtimeCasOverride } from "./lares-config.js";
import { atomicWriteFileSync } from "./fs-atomic.js";

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
 * Idempotent (content-addressed, immutable → a sound file stays as it stands). The build sink calls
 * this to lay down `genesis/cas/<cid>` from the artifact's casEntries. Returns count.
 *
 * A FILE ALTERED AT REST GETS REPLACED, AND ONLY BY BYTES THAT PROVE THEMSELVES. Where a file already stands
 * under the address and no longer recomputes to it, bytes that do recompute to it take its place by an atomic
 * write, so a holder that fetched a block again keeps it. Bytes that fail the address replace nothing.
 */
export function writeCasEntriesFs(
  entries: readonly { readonly cid: string; readonly bytes: Uint8Array }[],
  casDir:  string,
): number {
  mkdirSync(casDir, { recursive: true });
  let written = 0;
  for (const { cid, bytes } of entries) {
    const path = join(casDir, cid);
    if (existsSync(path)) {
      if (!verifyCidBytes(bytes, cid) || readVerifiedCasBlobFromFs(cid, casDir) !== null) continue;
      atomicWriteFileSync(path, bytes);
      written += 1;
      continue;
    }
    writeFileSync(path, bytes);
    written += 1;
  }
  return written;
}

/**
 * Mirror a genesis artifact's CAS files (genesis/cas/<cid>) into a runtime CAS dir,
 * driven by the seed-derived inventory — the node face of the byte SOURCE. The inventory names
 * genesis/cas/ files as the byte source; the CID a worker later requests stays the
 * same regardless of source. Idempotent (content-addressed). Returns
 * count copied; throws if a seed-named source file is absent (corrupt genesis).
 */
export function mirrorGenesisCasFs(
  manifest:      GenesisCasManifest,
  genesisCasDir: string,
  runtimeCasDir: string,
): number {
  mkdirSync(runtimeCasDir, { recursive: true });
  let copied = 0;
  for (const { cid } of manifest.blobs) {
    const src = join(genesisCasDir, cid);
    if (!existsSync(src)) {
      throw new Error(`[node-cas] genesis CAS file absent for cid ${cid} at ${src} — re-run build:genesis`);
    }
    const sourceBytes = new Uint8Array(readFileSync(src));
    if (sha256HexBytesSync(sourceBytes) !== cid) {
      throw new Error(`[node-cas] genesis CAS file failed content-address verification for cid ${cid} at ${src}`);
    }
    const dst = join(runtimeCasDir, cid);
    if (existsSync(dst)) {
      const localBytes = new Uint8Array(readFileSync(dst));
      if (sha256HexBytesSync(localBytes) !== cid) {
        throw new Error(`[node-cas] runtime CAS file failed content-address verification for cid ${cid} at ${dst}`);
      }
      continue;
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

/**
 * Read content-addressed bytes and hand them on ONLY where they still recompute to their address: `blake3:` over
 * the bytes for a sealed value, SHA-256 for a clear blob (`verifyCidBytes`). Bytes altered at rest answer null,
 * exactly as an absent blob does, so a holder never serves or opens bytes its own disk changed. The check needs
 * no key. It proves the bytes match the address and nothing about where the address belongs: a reader of a
 * sealed value still opens it under an authorized address.
 */
export function readVerifiedCasBlobFromFs(cid: string, casDir: string): Uint8Array | null {
  const bytes = readCasBlobFromFs(cid, casDir);
  return bytes !== null && verifyCidBytes(bytes, cid) ? bytes : null;
}

// ── THE HERM SHORE AS A TRANSIT LEG (basket-one #/the-fetch-door) ────────────────────────────────────
//
// "A public blob travels to a Herm before any hearth serves it." The fetch door composes local → transit →
// verify → write-through (`makeCidResolver`); the Herm's public read-face `GET /cas/<cid>` (bulb-read-face) is
// ONE MORE HOLDER on the transit leg, asked after the fleet: a same-operator peer that went dark costs a miss,
// and the bytes it staged public still arrive by the crossroads. The resolver's own verify gates the answer —
// a shore answering wrong bytes under a cid is skipped, never cached — so the Herm holds no trust the bytes
// do not prove themselves. Carry ⊥ read holds: only a PUBLIC-tier cid ever answers there (the shore's gate).

/** The holder handle the Herm leg answers `discover` with — the read-face URL itself (no key stands behind
 *  a public GET; the bytes prove themselves). */
const HERM_HOLDER_PREFIX = "herm:";

/** The Herm's public read-face (`http://host:port`) as a transit leg: one holder, one GET `/cas/<cid>`. A
 *  404 (a cid the Herm withholds — private, contract, or unnamed) and any transport fault read as dont-have. */
export function hermCasTransit(readFaceUrl: string): CasTransitTransport {
  const base = readFaceUrl.replace(/\/+$/, "");
  const holder = `${HERM_HOLDER_PREFIX}${base}`;
  return {
    discover: async () => [holder],
    fetchBlock: async (cid, h) => {
      if (h !== holder) return null;
      try {
        const res = await fetch(`${base}/cas/${cid}`);
        if (!res.ok) return null;
        return new Uint8Array(await res.arrayBuffer());
      } catch { return null; }
    },
  };
}

/** The fleet leg FIRST, the Herm leg after (null → the fleet leg alone, unchanged). Holders concatenate in that
 *  order and each block ask routes to the leg whose holder it names. */
export function composeCasTransits(fleet: CasTransitTransport, herm: CasTransitTransport | null): CasTransitTransport {
  if (!herm) return fleet;
  return {
    discover: async (cid) => [...(await fleet.discover(cid)), ...(await herm.discover(cid))],
    fetchBlock: (cid, holder) => (holder.startsWith(HERM_HOLDER_PREFIX) ? herm.fetchBlock(cid, holder) : fleet.fetchBlock(cid, holder)),
  };
}

/** The Herm shore a vessel dials for public bytes — `LAR_HERM_SHORE` (`http://host:port`, the Herm's read-face);
 *  unset → no leg (the fleet alone, exactly as before). */
export function hermCasTransitFromEnv(env: NodeJS.ProcessEnv = process.env): CasTransitTransport | null {
  const url = env["LAR_HERM_SHORE"];
  return url && url.length > 0 ? hermCasTransit(url) : null;
}

// ── PIN and RELEASE (tiddler-carriage #/pin-and-release) ─────────────────────
//
// A blob is RETAINED while any locally-held record references its cid (`casReferences`, derived —
// never stored) or the genesis CAS names it (the engine + plugins the bulb ships); an unreferenced,
// unprotected blob MAY sweep once older than the grace. `DROP <bag>` releases by taking the bag's
// records out of the derived count — the sweep reads the count, it never reads the verb.
//
// A PIN CARRIES NO CLOCK — EVER. A pin stands exactly as long as its sidecar entry stands: `pinCas` writes
// it, `releaseCas` removes it. `PinCap` (@lararium/mesh) carries NO `expiry` field at all (M7 — the field
// left the record entirely, never merely unread). Its OPTIONAL `fence` names a holder's OWN boot epoch
// at pin time (M7′): PRESENCE in the sidecar still decides by default (a bare `--pin` carries no `fence` —
// the operator's own explicit, standing-forever pin), but a pin that DOES carry a `fence` (a `--held`
// pin) is a CAUSAL supersession, never a span — `casSweep`'s REQUIRED `currentFence` option, this vessel's
// OWN current boot epoch, reads it through the mesh-level `pinnedCids` (the SAME law `cas-caps.ts` states):
// held while `currentFence <= fence`, superseded the moment a later boot moves past it; a bare pin with no
// `fence` of its own still reads presence-only regardless of `currentFence`, exactly as before the fence
// ever existed. Ending a pin is always one of: an
// EXPLICIT `releaseCas`, the next pin for the same cid superseding the one it replaces (`pinCas`'s
// replace-by-cid), or — for a `--held` pin alone — this vessel's own next boot.

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
   *  every blob gets; `graceFor` reads a longer one per tier. IN THE UNIT `ageOf` SPEAKS — rolls of the
   *  realm's own clock, never wall-ms. */
  readonly grace:      number;
  /** GRACE PER TIER (basket-one #/grace-and-pin): the grace for THIS cid, read off the tier of the bag whose
   *  pointer named it — `graceForTier(tier, unit)` (@lararium/mesh). Absent → `grace` for every blob. A reading
   *  below `grace` never shortens the floor. */
  readonly graceFor?:  (cid: string) => number;
  /** A blob's AGE in the grace's unit — CAUSAL, supplied by the caller (rolls-since-first-seen-unreferenced
   *  off the realm's own clock; see `installCasSweep`). Mandatory: a wall clock never decides a sweep
   *  verdict, so this file carries no mtime-vs-`Date.now()` fallback for it. */
  readonly ageOf:      (cid: string) => number;
  /** PIN at cid grain: the pins beside the bag's caps. A pin's PRESENCE here holds its blob past any grace —
   *  no clock comparison. `releaseCas` drops a pin from the sidecar before this array is ever read, so
   *  "released" and "absent from `pins`" are the same fact. */
  readonly pins?:      readonly PinCap[];
  /**
   * This vessel's CURRENT boot epoch (M7′/M7″, `owned-store.ts`'s `StoreClaim.bootEpoch`) — the fence a
   * `--held` pin's own stamped `fence` is read against (`pinnedCids` — the SAME law `cas-caps.ts` states:
   * absent `fence` on a pin holds regardless, i.e. presence-only; a pin WITH a `fence` holds only while
   * `currentFence` has not yet moved past it). REQUIRED (alpha line, no back-compat — M7″ G3): every caller,
   * production or test, threads its own epoch through — never guessed. `0` is the fence law's OWN floor
   * ("no boot has happened yet"): every `--held` pin reads as still standing against it (`0 <= fence` for
   * any non-negative fence), so a caller with no real epoch to give is never safe passing `0` AS IF it were
   * a genuine epoch — it must withhold the sweep instead (`open-node-vessel.ts`'s shape beside
   * `genesisProtect === "unreadable"`). Only the ABSENCE of a pin's own `fence` field reads as a
   * standing-forever pin; the absence of THIS option is no longer representable at all.
   */
  readonly currentFence: number;
  /** Name what would sweep; delete nothing. */
  readonly dryRun?:    boolean;
}

export interface CasSweepResult {
  /** Deleted (or, dry, would delete) — unreferenced · unprotected · older than the grace. */
  readonly swept:     string[];
  /** Held by a reference or the grace. */
  readonly kept:      string[];
  /** Held by the seed-derived genesis inventory. */
  readonly protected: string[];
  /** Held by a STANDING pin (unreferenced or not) — the Librarian's forty. */
  readonly pinned:    string[];
}

/** Mark-and-sweep the cleartext CAS from the derived references + the genesis protect set. */
export function casSweep(opts: CasSweepOptions): CasSweepResult {
  // M7″: a `--held` pin (one stamped with a `fence`) holds only while this vessel's current epoch has not
  // yet moved past it (`pinnedCids`); a presence-only pin (no `fence`) still holds regardless, same as
  // always. `currentFence` is REQUIRED — there is no more caller-side fallback that reads every pin as
  // presence-only regardless of its own stamped fence.
  const standing = pinnedCids(opts.pins ?? [], opts.currentFence);
  const swept: string[] = [], kept: string[] = [], protectedCids: string[] = [], pinned: string[] = [];
  for (const { cid } of listCasBlobs(opts.casDir)) {
    if (opts.protect.has(cid)) { protectedCids.push(cid); continue; }
    if (standing.has(cid)) { pinned.push(cid); continue; }
    if ((opts.references.get(cid)?.size ?? 0) > 0) { kept.push(cid); continue; }
    const grace = Math.max(opts.grace, opts.graceFor?.(cid) ?? opts.grace);
    const age = opts.ageOf(cid);
    if (age < grace) { kept.push(cid); continue; }
    if (!opts.dryRun) unlinkSync(join(opts.casDir, cid));
    swept.push(cid);
  }
  return { swept, kept, protected: protectedCids, pinned };
}

// ── The PIN sidecar — the pins a vessel holds beside its cleartext CAS ─────────────────────────────
//
// `.pins.json` in the CAS dir: a non-hex name, so `listCasBlobs` never reads it as a blob and the sweep
// never touches it. Read whole, written whole (a small file; a pin per re-standable working).

const PINS_FILE = ".pins.json";

/** `PinCap`'s own fields (`cas-caps.ts`) — the only keys a record may ever carry. Any other key (the retired
 *  `expiry` chief among them) reads the WHOLE sidecar as malformed (evergreen sweep, gp25): a record shape
 *  this reader does not recognize might carry a clock-driven verdict this house no longer honors, so it
 *  refuses rather than silently accepting an old shape back in. */
const PIN_RECORD_FIELDS = new Set(["cid", "holder", "tier", "fence"]);

/** The pins a CAS dir holds — an ABSENT sidecar reads as no pins (a vessel that never pinned anything is
 *  not corrupt); a sidecar that EXISTS but fails to parse (torn JSON, not an array) THROWS rather than
 *  reading as no pins (M7′: the sweep's own caller must REFUSE its run on this, never silently un-pin
 *  everything). A per-record `cid` string is the only load-bearing field: a record missing/mistyping its
 *  `holder`/`tier`/`fence` still holds that cid (presence-only, if its `fence` reads as absent) rather than
 *  being dropped whole — dropping a torn record is exactly the "fails open toward deletion" fault M7′
 *  closes. A record carrying the retired `expiry` field, or ANY field outside `PIN_RECORD_FIELDS`, is NOT
 *  silently ignored (the old shape): it REFUSES the whole read (evergreen sweep, gp25-SW2) — fail toward
 *  KEEPING every blob, never toward deleting over a shape this reader no longer recognizes. */
export function readCasPins(casDir: string): PinCap[] {
  const path = join(casDir, PINS_FILE);
  let raw: string;
  try { raw = readFileSync(path, "utf8"); }
  catch (err) {
    // No sidecar at all reads as no pins — a vessel that has never pinned anything is not "corrupt".
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw new Error(`[node-cas] pin sidecar ${path} could not be read (${(err as Error)?.message ?? err}) — refusing to read it as "no pins" (M7′: fail toward KEEPING, never toward deleting)`);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch (err) {
    throw new Error(`[node-cas] pin sidecar ${path} failed to parse (${(err as Error)?.message ?? err}) — refusing to read it as "no pins" (M7′: fail toward KEEPING, never toward deleting)`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`[node-cas] pin sidecar ${path} is not a JSON array — refusing to read it as "no pins" (M7′: fail toward KEEPING, never toward deleting)`);
  }
  // ANY record carrying a field outside PIN_RECORD_FIELDS (the retired `expiry` chief among them) REFUSES
  // the WHOLE read — an old or unknown shape might carry a clock-driven verdict this house no longer
  // honors; the run stops here, logged by name, rather than silently accepting it back in (evergreen
  // sweep, gp25-SW2).
  for (const p of parsed) {
    if (!p || typeof p !== "object") continue;
    for (const key of Object.keys(p as Record<string, unknown>)) {
      if (!PIN_RECORD_FIELDS.has(key)) {
        throw new Error(`[node-cas] pin sidecar ${path} carries a record with unknown field "${key}" (e.g. the retired \`expiry\`) — refusing to read it as "no pins" (evergreen sweep: fail toward KEEPING, never toward deleting)`);
      }
    }
  }
  // A TORN RECORD THAT STILL NAMES A CID STRING STILL HOLDS THAT CID (M7′): only `cid` is load-bearing here.
  // A missing/mistyped `holder`/`tier` or `fence` (the probed `fence: "7"` case) never drops the WHOLE
  // record — that would un-pin a blob over a cosmetic field, exactly the "fails open toward deletion" fault
  // this closes. A mistyped `fence` reads as ABSENT (presence-only — holds forever), never as zero and never
  // as dropped.
  return parsed
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object" && typeof (p as Record<string, unknown>)["cid"] === "string")
    .map((p) => {
      const cid    = p["cid"] as string;
      const holder = typeof p["holder"] === "string" ? (p["holder"] as string) : "unknown";
      const tier   = typeof p["tier"]   === "string" ? (p["tier"]   as string) : "veil";
      const fence  = typeof p["fence"]  === "number" ? (p["fence"]  as number) : undefined;
      return { cid, holder, tier, ...(fence !== undefined ? { fence } : {}) } as PinCap;
    });
}

/** Write the pins whole — temp + rename (M7), never a bare `writeFileSync`: a reader mid-write (another
 *  CLI invocation, the sweep's own read) must never observe a torn `.pins.json`. */
export function writeCasPins(casDir: string, pins: readonly PinCap[]): void {
  mkdirSync(casDir, { recursive: true });
  atomicWriteFileSync(join(casDir, PINS_FILE), JSON.stringify(pins, null, 2) + "\n");
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
// "A clock sweeps by the calendar; a grace sweeps by the realm's own pace." The tick reads THE REALM'S OWN
// CLOCK — `realmPace` (@lararium/mesh) over the reading the `realm-clock` verb answers — and counts everything
// in ROLLS of that clock: the cadence is the SHORTEST tier's grace over four (never under one roll), each
// tier's grace is `graceForTier(tier, 1)` rolls, and a blob's age is the rolls since this daemon first saw it
// unreferenced. Why the realm's clock and never an observed rate: `realmPace`'s own comment carries it — an
// elapsed-over-rolls sample is co-driven by the observer's sync, and a healed partition collapses every grace.
// A realm that has not said two rolls (or a hearth outside every realm) fires no sweep at all — a quiet hearth
// keeps every blob, exactly as a centuries-old realm goes cold only by true abandonment. The floor grace for a
// blob whose tier no pointer names any more reads the LONGEST tier (an unreferenced blob's tier is unknowable;
// the fail-safe reads private).
//
// THE LEDGER. "First seen unreferenced" lives in memory, per daemon: a reboot forgets it and every orphan's
// grace starts over — the fail-safe direction (a blob is only ever kept LONGER), and the price of never writing
// a sidecar the sweep itself would have to read. A blob that regains a reference leaves the ledger; unreferenced
// again, its grace starts over.

/** The tick cadence in ROLLS of the realm's clock — the shortest tier's grace / 4, never under one roll. */
export function sweepCadenceRolls(): number {
  const tiers = tiersByGraceDescending();
  const shortest = tiers[tiers.length - 1]!;
  return Math.max(1, Math.ceil(graceForTier(shortest, 1) / 4));
}

/** What `cas-sweep` answers: the cids swept (or, dry, that would sweep), the cids a standing pin held, and
 *  every cid retained by a reference, the grace or the genesis protect set. */
export interface CasSweepVerbResult {
  readonly verb:     "cas-sweep";
  readonly dryRun:   boolean;
  readonly swept:    string[];
  readonly pinned:   string[];
  readonly retained: string[];
  /** The realm's own now the sweep read, in rolls (null → no pace: nothing aged, nothing swept). */
  readonly pace:     number | null;
}

export interface InstallCasSweepOptions {
  readonly registry:   { register(name: string, handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>): void };
  readonly casDir:     string;
  /** The live records the composite holds — `composite.entries()`; the reference count derives from them. */
  readonly references: () => Promise<Iterable<CasReferenceEntry>> | Iterable<CasReferenceEntry>;
  /** The seed-derived genesis cids — never swept. */
  readonly protect:    ReadonlySet<string>;
  /** The standing pins beside the CAS (`readCasPins`) — read at each sweep, never cached. */
  readonly pins:       () => readonly PinCap[];
  /** The realm's own clock — the reading `realm-clock` answers (`realmMaintenanceFromBoard`), or null on a
   *  hearth outside every realm. Read at each probe; `realmPace` turns it into rolls. */
  readonly realmClock: () => CabalRealmMaintenanceProvenance | null | Promise<CabalRealmMaintenanceProvenance | null>;
  /** This vessel's CURRENT boot epoch (M7″) — read fresh at EVERY sweep, never cached, so a `--held` pin is
   *  judged against the epoch THIS boot owns. REQUIRED (alpha line, no back-compat): the production sweep
   *  threads it straight into `casSweep`'s own `currentFence`, closing the gap `CasSweepOptions.currentFence`'s
   *  doc comment named ("no caller YET threads a live epoch here") — a caller with no epoch to give supplies
   *  `() => 0`, which the fence law already reads as "no boot has happened yet" (every `--held` pin superseded). */
  readonly currentFence: () => number;
  readonly log:        (line: string) => void;
  /** Observes each tick's result (a witness hook; the verb's caller reads the result directly). */
  readonly onSweep?:   (r: CasSweepVerbResult) => void;
  /** A cell the tick fills with the realm's pace, so a SYNC reader (the stowage's idle clock) rides the same
   *  reading the sweep does — one clock for every cooling on the vessel. */
  readonly paceCell?:  RealmPaceCell;
}

export interface CasSweepInstalled {
  /** Run one sweep now (the verb's own body). */
  readonly sweep: (dryRun: boolean) => Promise<CasSweepVerbResult>;
  /** How often the tick re-reads the realm's clock. */
  readonly probeMs: number;
  readonly stop: () => void;
}

/**
 * Install the sweep: register the `cas-sweep` verb (`{ dryRun?: boolean }`) and start the tick. The tick
 * probes the realm's clock once a minute (a cheap board read) and sweeps once the clock has advanced a cadence
 * of rolls past the last sweep — so the daemon never walks the dir more often than the realm's own pace
 * warrants, and a still realm never triggers a walk. The interval is unref'd: it never holds the process open.
 */
/**
 * THE PACE CELL — the last realm pace the sweep tick read, held for sync readers. `read()` answers 0 before
 * the first reading and while the vessel stands outside every realm: a stowage clocked on it ages nothing
 * until the realm rolls, which reads as the lamplighters' law (a realm nobody feeds never cools a bag), while
 * the hot-cap still bounds residency by LRU order. Never a wall clock.
 */
export interface RealmPaceCell {
  readonly read: () => number;
  readonly note: (pace: number | null) => void;
}
export function makeRealmPaceCell(): RealmPaceCell {
  let last = 0;
  return { read: () => last, note: (pace) => { if (pace !== null) last = pace; } };
}

export function installCasSweep(opts: InstallCasSweepOptions): CasSweepInstalled {
  const probeMs = 60_000;
  const tiers = tiersByGraceDescending();
  const longest = tiers[0]!;
  /** cid → the roll this daemon first saw it unreferenced (the ledger; see the section comment). */
  const firstSeen = new Map<string, number>();

  const sweep = async (dryRun: boolean): Promise<CasSweepVerbResult> => {
    const pace = realmPace(await opts.realmClock());
    opts.paceCell?.note(pace);
    const references = casReferences([...(await opts.references())]);
    // Fold the ledger: a referenced blob leaves it; an unreferenced one enters at this roll (age 0) if unseen.
    for (const { cid } of listCasBlobs(opts.casDir)) {
      if ((references.get(cid)?.size ?? 0) > 0) { firstSeen.delete(cid); continue; }
      if (pace !== null && !firstSeen.has(cid)) firstSeen.set(cid, pace);
    }
    const r = casSweep({
      casDir: opts.casDir,
      references,
      protect: opts.protect,
      pins: opts.pins(),
      // M7″: read fresh at EVERY sweep — the production fence a `--held` pin's own stamped `fence` is judged
      // against, never a cached boot-time reading (a held pin outlives many ticks within the SAME boot).
      currentFence: opts.currentFence(),
      // The floor: the longest tier's grace in rolls. No pace → no age (every blob reads 0) → nothing sweeps.
      grace: graceForTier(longest, 1),
      ageOf: (cid) => (pace === null ? 0 : pace - (firstSeen.get(cid) ?? pace)),
      dryRun,
    });
    if (!dryRun) for (const cid of r.swept) firstSeen.delete(cid);
    const out: CasSweepVerbResult = {
      verb: "cas-sweep", dryRun, swept: r.swept, pinned: r.pinned,
      retained: [...r.kept, ...r.protected], pace,
    };
    opts.onSweep?.(out);
    return out;
  };
  opts.registry.register("cas-sweep", async (args) => {
    const r = await sweep(args["dryRun"] === true);
    return r as unknown as Record<string, unknown>;
  });

  const cadence = sweepCadenceRolls();
  let lastSweepRoll: number | null = null;
  let stopped = false;
  let inFlight = false;
  const probe = async (): Promise<void> => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const pace = realmPace(await opts.realmClock());
      if (pace === null) return;                                   // no pace yet — the clock does not run
      if (lastSweepRoll !== null && pace - lastSweepRoll < cadence) return;
      lastSweepRoll = pace;
      const r = await sweep(false);
      if (r.swept.length > 0) opts.log(`[cas-sweep] roll ${pace}: swept ${r.swept.length} blob(s) past the grace · pinned ${r.pinned.length} · retained ${r.retained.length}`);
    } catch (err) {
      opts.log(`[cas-sweep] tick faulted: ${(err as Error)?.message ?? err}`);
    } finally { inFlight = false; }
  };
  const timer = setInterval(() => { void probe(); }, probeMs);
  timer.unref?.();
  return { sweep, probeMs, stop: () => { stopped = true; clearInterval(timer); } };
}
