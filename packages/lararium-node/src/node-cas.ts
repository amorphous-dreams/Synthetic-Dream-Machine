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
import { type GenesisCasManifest } from "@lararium/mesh";
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
  /** An unreferenced blob younger than this stays (a staged body its verb has not landed yet). */
  readonly graceMs:    number;
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
}

/** Mark-and-sweep the cleartext CAS from the derived references + the genesis protect set. */
export function casSweep(opts: CasSweepOptions): CasSweepResult {
  const now = opts.now ?? Date.now();
  const swept: string[] = [], kept: string[] = [], protectedCids: string[] = [];
  for (const { cid } of listCasBlobs(opts.casDir)) {
    if (opts.protect.has(cid)) { protectedCids.push(cid); continue; }
    if ((opts.references.get(cid)?.size ?? 0) > 0) { kept.push(cid); continue; }
    const path = join(opts.casDir, cid);
    if (now - statSync(path).mtimeMs < opts.graceMs) { kept.push(cid); continue; }
    if (!opts.dryRun) unlinkSync(path);
    swept.push(cid);
  }
  return { swept, kept, protected: protectedCids };
}
