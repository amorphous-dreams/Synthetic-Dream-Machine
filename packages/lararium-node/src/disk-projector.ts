/**
 * LarDiskProjector — bag-aware unidirectional projection: store → disk.
 *
 * Co-projection model: the operator's mind
 * originates; the disk carrier and the CRDT record-set both PROJECT that
 * origin, each in its native grain — disk holds whole markdown memes, the
 * doc holds tid-sized records, the VM decomposes for transclusion. Merge
 * authority routes through the CRDT alone; this projector renders the disk
 * co-projection and NEVER reads from disk — that direction belongs to the
 * ingest path (file watcher → store.put).
 *
 * Bag-aware: each writable bag may opt into a filesystem mirror via
 * BagMirrorConfig. Bags without a mirror config never write to disk. The two
 * projection surfaces split by bag role (see api/lararium/disk-projection):
 *   - wiki content (@<slug>)      → `wikis/{slug}/...`   (projection / output)
 *   - seed/canon bags (lares/lararium/sdm) → `bags/NAME/...` (seed / canon)
 * State/runtime bags (personal/draft/temp/daemon) carry no mirror.
 * A residency MOVE (the canon ACTION verb)
 * that relocates a tiddler between bags has the disk side effect of a file move
 * between surfaces; the git diff IS the operator's signature on the change.
 *
 * Projection law (Fontany-Fuller-Zelenka):
 *   Disk projection RENDERS, never string-copies. The ONE render shore
 *   (`carrierFileFn`, the VM's `exportCarrierFile`) hands back the carrier's own
 *   filetype: a memetic carrier recomposes to `.mem` (expandMemeRefs over its
 *   group), any other TW5 filetype rides the file-info cascade to its native
 *   file (+ a `.meta` sidecar where the type needs one). The VM registry decides
 *   type + extension + bytes; the projector only sites at `<uri-path><ext>`.
 *
 * Group routing (carrier-whole at rest, disk-projection#projection-routing):
 *   memetic-wikitext records form a tiddler-group keyed by the carrier root.
 *   A child change climbs `$fragment-parent` to the root; debounce keys per
 *   (bag, root); the flush renders the ROOT — one carrier, one file. A
 *   fragment URI never owns a disk path (bag-paths returns null for them).
 *
 * Echo suppression ranks (Confluence): the CONTENT-HASH gates carry the law —
 * ingest drops disk-hash == synced-hash; projection consults `projection-gate`
 * over the same three streams. The `writing` Set survives beneath them as a
 * latency optimization only (skip re-statting our own in-flight writes); no
 * correctness rests on it.
 *
 * BOTH LEGS RECONCILE (the operator's ruling). `flush` decides through
 * `decideProjection` before it writes: a byte-identical carrier noops, a carrier
 * whose disk file stands where the last projection left it projects, a disk edit
 * with the records unmoved stands down (the INGEST leg adopts that one), and a
 * carrier whose file AND records both moved since the merge base surfaces a
 * CONFLICT on the disk-ward's alert rail — no write, no merge, no winner picked
 * by timestamp. The operator talks it out.
 */

import { writeFileSync, mkdirSync, unlinkSync, existsSync, readFileSync, readdirSync, renameSync } from "fs";
import { dirname, basename } from "path";
import { confineMirrorWrite, carrierBaseRelPath } from "./bag-paths.js";
import { syncedTreeKey, type SyncedTree } from "./synced-tree.js";
import { decideProjection } from "./projection-gate.js";
import { isEffectRecordUri, isBagManifestUri, KeyedCoalesceGate, carrierHash, sha256HexBytesSync } from "@lararium/mesh";
import { ORIGINAL_TIDDLER_PATHS, parseProvenance, packOfMember } from "@lararium/mesh";
import type { ReadinessMap, WindowServo } from "@lararium/mesh";
import type { TW5Engine, CarrierFile } from "@lararium/tw5";
import type { BagMirrorConfig } from "./bag-paths.js";

export interface LarDiskProjectorOptions {
  /** Bag mirrors. Bags absent from this list never write to disk. */
  readonly mirrors: readonly BagMirrorConfig[];
  /**
   * Render a carrier-root URI to ITS OWN filetype — the ONE render shore. A
   * memetic carrier recomposes to `.mem`; any other TW5 filetype rides the VM's
   * file-info cascade to its native file (+ a `.meta` sidecar where the type
   * needs one). The VM registry decides type + bytes for both; the projector
   * only sites at `<uri-path><ext>` and writes the sidecar. Null skips the write.
   */
  readonly carrierFileFn: (tiddlerUri: string) => Promise<CarrierFile | null>;
  /**
   * Resolve a POINTER's raw bytes from the local cid/ tier (the island's `resolveByCid`). A
   * pointer carrier (`CarrierFile.pointerCid`) projects as the WHOLE FILE beside its `.meta`
   * (THE BLOB LAW): the projector pulls the bytes here, verifies `sha256(bytes) == cid`, and
   * writes them. Absent, or a tier miss, or a verify fault → the `.meta` lands alone and no
   * content file is written or swept.
   */
  readonly resolveByCid?: (cid: string) => Promise<Uint8Array | null>;
  /**
   * Report every bag that currently HOLDS a carrier (`composite.listBagsHolding`).
   * Gates the cross-mirror stale-unlink: a carrier still living in a bag — a
   * working edit SHADOWING its canon copy — keeps its file in that bag's mirror.
   * The stale-unlink fires ONLY where the carrier has genuinely LEFT the bag (a
   * true MOVE/promotion). Absent → the unlink clears every other mirror by path.
   */
  readonly bagsHolding?: (tiddlerUri: string) => Promise<readonly string[]>;
  /** Debounce delay in ms (default 1000). */
  readonly debounceMs?: number;
  /** Fired on every disk-ward refusal — the island routes it to the daemon VM. */
  readonly onRefusal?: (info: { bagId: string; uri: string; reason: string }) => void;
  /** Optional readiness map — lights `disk-projector` after first flush. */
  readonly readinessMap?: ReadinessMap;
  /** Write a .json sidecar next to each .md for peek debugging. */
  readonly debugJson?: boolean;
  /**
   * The Synced tree (Confluence merge base): records the content hash of every
   * projected carrier; arms the projection-side hash gate — a write whose
   * bytes match disk skips silently (no event, no churn).
   */
  readonly syncedTree?: SyncedTree;
  /**
   * Self-regulation for the reconcile gate (the COALESCE servo), OPT-IN. The disk reconcile is
   * variable-cost + bursty with no natural clock — exactly where a window servo pays (unlike a
   * display gate, which stays frame-pinned). When set, the gate self-clocks on each reconcile's
   * completion and grows/shrinks `debounceMs` toward `targetMs` (adaptWindow). `targetMs` is a
   * reconcile-COST set-point (ms above which the window WIDENS) — NOT the window length; `minMs`/
   * `maxMs` bound the window. Absent → fixed debounce (the proven default; the capability ships
   * inert until an operator calibrates a real cost target).
   */
  readonly servo?: WindowServo;
}

/** Read a file and compare it byte-for-byte against `body`; a missing or
 *  unreadable file reads as unequal (the caller then writes). */
function safeReadEquals(path: string, body: string): boolean {
  try { return existsSync(path) && readFileSync(path, "utf-8") === body; }
  catch { return false; }
}

/** Escape a filename stem for a literal match inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolve a carrier's ACTUAL on-disk files from its confined absolute base
 * (extension-less). A carrier owns exactly one content file at `<stem><ext>`
 * plus an optional `<stem><ext>.meta` sidecar — the extension varies by filetype
 * (the ruling), so the deletion/unlink side cannot assume `.mem`. The match binds
 * the WHOLE stem then a single extension segment (+ optional `.meta`), so a
 * sibling carrier whose stem merely shares a prefix never gets swept. Returns
 * absolute paths; a missing directory reads as no files.
 */
export function carrierDiskFiles(absBase: string): string[] {
  const dir  = dirname(absBase);
  const stem = basename(absBase);
  const re   = new RegExp(`^${escapeRegExp(stem)}\\.[^.]+(?:\\.meta)?$`);
  try {
    return readdirSync(dir).filter((n) => re.test(n)).map((n) => `${dir}/${n}`);
  } catch { return []; }
}

/** The per-mirror siting memory's key. */
function sitedKey(bagId: string, uri: string): string {
  return `${bagId}\n${uri}`;
}

export class LarDiskProjector {
  /**
   * URIs currently being written to disk.
   * File watcher MUST check writing.has(uri) before ingesting — skip own writes.
   */
  readonly writing = new Set<string>();

  /** The keyed coalesce gate (mesh/projection-nalu) — debounce per carrier-root URI, so a MOVE's
   *  source-tombstone and destination-add settle into ONE level-triggered reconcile. Born in start(). */
  private gate: KeyedCoalesceGate<string> | null = null;
  private _firstFlushDone = false;

  private _tw5: TW5Engine | null = null;

  /**
   * Where each carrier LAST sited, per mirror (`bagId\nuri` → extension-less mirror-relative base).
   * The stock filesystem adaptor keeps the same memory as `$tw.boot.files`: a delete runs after
   * the tiddler has gone, so the path a `$:/config/FileSystemPaths` rule named can no longer be
   * recomputed — the last siting answers, and a title never flushed this session falls back to
   * the loci law. A rule that moves a carrier unlinks its previous files (`cleanupTiddlerFiles`).
   */
  private readonly sited = new Map<string, string>();

  /**
   * The standoffs already surfaced, per carrier (`syncedTreeKey` → `diskHash\nrecordsHash`).
   * The reconcile runs LEVEL-TRIGGERED, so an unresolved conflict re-decides on
   * every nudge; without this the operator's alert rail would repeat one standoff
   * until they stopped reading it. A standoff that MOVES (either side changes)
   * carries a new stamp and surfaces afresh; a `project` verdict clears the entry.
   * Session-lived and advisory — losing it costs one duplicate alert, never a write.
   */
  private readonly surfaced = new Map<string, string>();

  private readonly mirrors: readonly BagMirrorConfig[];
  private readonly carrierFileFn: (tiddlerUri: string) => Promise<CarrierFile | null>;
  private readonly resolveByCid: ((cid: string) => Promise<Uint8Array | null>) | undefined;
  private readonly bagsHolding: ((tiddlerUri: string) => Promise<readonly string[]>) | undefined;
  private readonly debounceMs: number;
  private readonly onRefusal: ((info: { bagId: string; uri: string; reason: string }) => void) | undefined;
  private readonly readinessMap: ReadinessMap | undefined;
  private readonly debugJson: boolean;
  private readonly syncedTree: SyncedTree | undefined;
  private readonly servo: WindowServo | undefined;

  constructor(opts: LarDiskProjectorOptions) {
    this.mirrors      = opts.mirrors;
    this.carrierFileFn = opts.carrierFileFn;
    this.resolveByCid = opts.resolveByCid;
    this.bagsHolding  = opts.bagsHolding;
    this.debounceMs   = opts.debounceMs ?? 1000;
    this.onRefusal    = opts.onRefusal;
    this.readinessMap = opts.readinessMap;
    this.debugJson    = opts.debugJson ?? false;
    this.syncedTree   = opts.syncedTree;
    // The reconcile gate's COALESCE servo is OPT-IN — absent leaves the proven fixed debounce
    // untouched (no default-on adaptive window; a guessed cost-target would silently mutate the
    // proven path). The capability (self-clock + adaptWindow) is ready when an operator passes a
    // servo with a real reconcile-cost `targetMs`.
    this.servo = opts.servo;
  }

  /**
   * Subscribe to TW5 wiki change events and begin projecting.
   *
   * Architecture law (TW5 VM Primacy): only the IslandAdaptor subscribes
   * to Automerge stores. The disk projector subscribes to TW5 wiki change
   * events — the same surface that drives in-browser render. Bag provenance
   * reaches TW5 as the `$origin-bag` the nalu engine stamps from each change's
   * envelope; the projector reads it from the TW5 tiddler directly. `bag` is the
   * author's field and names nothing here.
   *
   * Returns an unsubscribe fn.
   */
  start(tw5: TW5Engine): () => void {
    this._tw5 = tw5;
    const wiki = tw5.$tw.wiki;
    // Group routing: a fragment record's change belongs to its carrier root.
    // Climb `$fragment-parent` one hop at a time (the field points one level
    // up); for a deleted record the chain is gone, so fall back to the URI
    // fragment-path law (`root#a/b` → `root`).
    const routeToRoot = (title: string): string => {
      let cur = title;
      for (let hops = 0; hops < 32; hops++) {
        const parent = (wiki.getTiddler?.(cur)?.fields as Record<string, unknown> | undefined)?.["$fragment-parent"];
        if (typeof parent !== "string" || parent.length === 0) break;
        cur = parent;
      }
      const hash = cur.indexOf("#");
      return hash > 0 ? cur.slice(0, hash) : cur;
    };

    // LEVEL-TRIGGERED (K8s reconciliation prior-art): every change is a NUDGE to
    // reconcile this carrier root against the CURRENT settled VM state — never an edge that
    // licenses a destructive action off a transient view. The keyed gate debounces per ROOT (not
    // per bag+root) so a MOVE's source-tombstone and destination-add COALESCE into ONE reconcile
    // that sees the final owner — closing the unlink/write race structurally (a per-(bag,root)
    // flush + immediate gone-unlink would not coalesce).
    const gate = new KeyedCoalesceGate<string>({
      debounceMs: this.debounceMs,
      // Return the reconcile PROMISE (not void) so the servo can self-clock on its completion +
      // measure its true async cost (the sync-trigger/async-cost gap, closed Nagle-style).
      onFlush: (rootUri) => this.reconcile(rootUri),
      ...(this.servo ? { servo: this.servo } : {}),
    });
    this.gate = gate;
    const handler = (changes: Record<string, unknown>) => {
      for (const title of Object.keys(changes)) {
        if (!title.startsWith("lar:")) continue;
        gate.mark(routeToRoot(title));
      }
    };
    wiki.addEventListener?.("change", handler);
    return () => { wiki.removeEventListener?.("change", handler); this.stop(); };
  }

  stop(): void {
    this.gate?.dispose();
    this.writing.clear();
    // Shutdown grace: pending coalesced observations land before the
    // island unmounts. (Un-rendered debounced flushes lawfully die — the
    // records hold truth; the next change or the ingest gesture's full
    // scan re-projects. Losing an OBSERVATION costs a fresh-adoption
    // decision; losing a render costs nothing durable.)
    this.syncedTree?.flush();
  }

  /**
   * Level-triggered reconcile of ONE carrier root against the settled VM state
   * (the projector's authoritative view, per VM-Primacy). Live (a `$origin-bag`
   * naming a mirror) → flush that owner (render + write + cross-mirror cleanup).
   * Gone from the resolved view → unlink from every mirror whose bag no longer
   * holds it (a true delete; a bag still holding the carrier keeps its file). A
   * MOVE shows its new owner here, the add having merged within the debounce.
   * Idempotent: a later nudge re-reconciles, so a transient "gone" self-heals
   * when the destination lands — the unlink can never be the final word for a
   * carrier a bag still holds.
   */
  /**
   * A tiddler that belongs to a PACK — its title rides in the pack's aside
   * provenance map (`$:/config/OriginalTiddlerPaths`, the same map INGEST wrote,
   * read here from the settled VM view). A pack member's bytes live INSIDE its
   * pack file (`foo.json`), so the member NEVER owns its own disk file. Reads
   * false when no $tw is mounted or the map is absent/malformed (degrades to "no
   * packs" — a forgotten observation never suppresses a legitimate projection).
   */
  private isPackMember(title: string): boolean {
    const provFields = this._tw5?.$tw.wiki.getTiddler?.(ORIGINAL_TIDDLER_PATHS)?.fields as
      | Record<string, unknown>
      | undefined;
    const provText = provFields?.["text"];
    if (typeof provText !== "string") return false;
    return packOfMember(parseProvenance(provText), title) !== undefined;
  }

  private async reconcile(rootUri: string): Promise<void> {
    // Pack-member projection-suppress — the loop-stopper. A member whose title
    // rides in a pack's aside provenance lives inside its pack file (`foo.json`)
    // and MUST NOT self-project: a per-member file explodes the pack into N files,
    // leaves `foo.json` stale, and the watcher then re-ingests both copies (once
    // from `foo.json`, once from the exploded files) — an unbounded doubling loop.
    // WITH the suppress: the pack file stays the one file on disk; a member edit
    // marks it stale-on-disk, and only a deliberate REPACK re-renders it. The guard
    // rides FIRST so it also holds the gone-branch (a vanished member never owns a
    // file to unlink — its home is the pack).
    if (this.isPackMember(rootUri)) return;
    const tiddler = this._tw5?.$tw.wiki.getTiddler?.(rootUri);
    if (!tiddler) {
      await this._scheduleUnlinkByTitle(rootUri);
      return;
    }
    const fields = tiddler.fields as Record<string, string | string[] | undefined>;
    if (fields["disk-projection"] === "no") return;
    // The host's provenance stamp (nalu-engine) names the mirror; `bag` is the author's field.
    const bagId = typeof fields["$origin-bag"] === "string" ? fields["$origin-bag"] : undefined;
    if (!bagId || !this.mirrors.some((m) => m.bagId === bagId)) return;
    await this.flush(bagId, rootUri);
  }

  /**
   * Resolve a carrier's confined on-disk file(s) within ONE mirror — the
   * native-aware shore globs the actual `<stem><ext>` (+ `.meta`) so a
   * `.tid`/`.md`/`.json` carrier resolves its real files (the ruling: the
   * extension varies); the memetic fallback resolves the single `.mem` path.
   * Returns null to SKIP (unresolvable name, or a ward refusal already surfaced);
   * an empty array means the name resolved but no file sits on disk.
   */
  private mirrorCarrierFiles(mirror: BagMirrorConfig, uri: string): string[] | null {
    const base = this.sited.get(sitedKey(mirror.bagId, uri)) ?? carrierBaseRelPath(uri);
    if (!base) return null;
    const gate = confineMirrorWrite(mirror.mirrorRoot, base, mirror.allowBagsRootFiles);
    if (!gate.ok) {
      console.error(`[disk-ward] unlink refused (${mirror.bagId}): ${gate.reason}`);
      this.onRefusal?.({ bagId: mirror.bagId, uri, reason: gate.reason });
      return null;
    }
    return carrierDiskFiles(gate.path);
  }

  /** Unlink the files a carrier left at a base it no longer sites at (a siting rule moved it). */
  private async _unlinkSited(mirror: BagMirrorConfig, base: string): Promise<void> {
    const gate = confineMirrorWrite(mirror.mirrorRoot, base, mirror.allowBagsRootFiles);
    if (!gate.ok) return;
    for (const f of carrierDiskFiles(gate.path)) {
      try { if (existsSync(f)) unlinkSync(f); } catch { /* best-effort — operator can clean up manually */ }
    }
  }

  /** Unlink by trying all mirrors whose path strategy resolves the URI — but a
   *  mirror whose bag STILL HOLDS the carrier keeps its file (a carrier hidden
   *  from the resolved view by a shadowing tombstone still lives in its lower
   *  bag; each mirror reflects its OWN bag's content, never the resolved view). */
  private async _scheduleUnlinkByTitle(title: string): Promise<void> {
    const holdingBags = this.bagsHolding ? new Set(await this.bagsHolding(title)) : null;
    for (const mirror of this.mirrors) {
      if (holdingBags?.has(mirror.bagId)) continue;
      const files = this.mirrorCarrierFiles(mirror, title);
      if (files === null) continue;
      try {
        for (const f of files) {
          if (existsSync(f)) {
            this.writing.add(title);
            try { unlinkSync(f); } finally { this.writing.delete(title); }
          }
        }
        this.syncedTree?.delete(syncedTreeKey(mirror.bagId, title));   // the observation leaves with the file(s)
        this.sited.delete(sitedKey(mirror.bagId, title));
      } catch { /* best-effort — operator can clean up manually */ }
    }
  }

  /**
   * The whole-carrier hash of what STANDS on disk — the projection gate's third
   * stream, folded exactly as the Synced-tree observation folds it
   * (`carrierHash(body, meta)`), so the three hashes compare like with like.
   *
   * A binary carrier re-encodes its raw bytes to the base64 text form the carrier
   * itself carries (the physical file holds decoded bytes; every hash in the
   * triangle keys on the carrier text). Null names an absent or INCOMPLETE carrier
   * — no content file, or a filetype that declares a `.meta` with no `.meta` beside
   * it — which the gate reads as `absent-on-disk`: no coherent carrier stands there
   * to lose, so the write lands and a deleted sidecar self-heals. An unreadable file
   * reads null too, keeping the old fall-through-to-the-write behavior.
   */
  private diskCarrierHash(candidate: string, metaPath: string | null, isBinary: boolean): string | null {
    try {
      if (!existsSync(candidate)) return null;
      const body = isBinary
        ? readFileSync(candidate).toString("base64")
        : readFileSync(candidate, "utf-8");
      if (metaPath === null) return carrierHash(body);
      if (!existsSync(metaPath)) return null;
      return carrierHash(body, readFileSync(metaPath, "utf-8"));
    } catch { return null; }
  }

  /** Write bytes atomically: a temp file in the SAME dir, then rename over the
   *  target — a watcher or editor never observes a torn file, and a crash leaves
   *  only a stray temp. */
  private atomicWrite(candidate: string, body: string | Buffer): void {
    const tmp = `${candidate}.lar-tmp-${process.pid}`;
    if (typeof body === "string") writeFileSync(tmp, body, "utf-8");
    else writeFileSync(tmp, body);
    renameSync(tmp, candidate);
  }

  private async flush(bagId: string, tiddlerUri: string): Promise<void> {
    const mirror = this.mirrors.find((m) => m.bagId === bagId);
    if (!mirror) return;

    // Projection FILTER ⊥ siting (lar-uri #five-planes): the siting function
    // carries every name; WHAT projects = carriers only. Ledger/observation
    // records (residency effect log) stay off disk — audit data, never
    // carrier surface. (The general type-filter — project only
    // text/memetic-wikitext+tiddlywiki — arrives with the migration wave.)
    if (isEffectRecordUri(tiddlerUri)) return;
    // A bag's manifest is a record ABOUT the bag, never a carrier IN it — `meta.mem` at the bag root
    // belongs to the declare verb. Refused before the render, so no rule can site it either.
    if (isBagManifestUri(tiddlerUri)) return;

    // Site the carrier by its own filetype — ONE render shore. The VM registry
    // hands back the chosen extension + bytes + any `.meta` sidecar, so a
    // memetic carrier sites `.mem` and a `.tid`/`.json`/`.md` record projects
    // back as its OWN file. The VM decides the type; the projector only sites.
    const file = await this.carrierFileFn(tiddlerUri);
    if (file === null) return;
    // A `$:/config/FileSystemPaths` rule in the island wiki names the path first — the same
    // tiddler names it for a stock server's filesystem adaptor, so both doors site one file.
    // No rule: the loci law sites `lar:///w.w.w/…` at its uri-path and a foreign title nowhere
    // (a pack member's home is its pack — disk-projection#/projection-routing rule 2).
    const base = file.relPath !== undefined && file.relPath.endsWith(file.ext)
      ? file.relPath.slice(0, file.relPath.length - file.ext.length)
      : carrierBaseRelPath(tiddlerUri);
    if (!base) return;
    const key = sitedKey(bagId, tiddlerUri);
    const previous = this.sited.get(key);
    if (previous !== undefined && previous !== base) await this._unlinkSited(mirror, previous);
    this.sited.set(key, base);
    const relPath  = base + file.ext;
    const metaBody = file.metaBody;
    const isBinary  = file.encoding === "base64";
    // A POINTER carries no body: its raw bytes come from the local cid/ tier, verified by hash.
    // The whole file lands beside the `.meta`; a miss or a fault lands the `.meta` alone (the
    // content file neither written nor swept — a file the projector did not write is not its own).
    let pointerBytes: Buffer | null = null;
    if (file.pointerCid !== undefined) {
      const got = this.resolveByCid ? await this.resolveByCid(file.pointerCid) : null;
      if (got && sha256HexBytesSync(got) === file.pointerCid) pointerBytes = Buffer.from(got);
      else if (got) console.error(`[disk-projector] pointer ${tiddlerUri}: cid/ bytes fail sha256 == ${file.pointerCid} — writing the .meta alone`);
    }
    const bodyPending = file.pointerCid !== undefined && pointerBytes === null;
    // A binary filetype (image/PDF) carries base64 text in `body` (a pointer's bytes re-encode to
    // it); the raw bytes land on disk. The Synced-tree observation + the ingest gesture BOTH hash
    // the base64 string form (the carrier text), so the echo gate compares like with like; only
    // the physical file holds decoded bytes.
    const output   = pointerBytes ? (isBinary ? pointerBytes.toString("base64") : pointerBytes.toString("utf-8")) : file.body;
    const writeBytes: string | Buffer = pointerBytes ?? (isBinary ? Buffer.from(output, "base64") : output);

    // The disk ward — sovereign-island write confinement (bag-paths). Cascade
    // output counts as untrusted; refusals surface LOUDLY, never silently.
    const gate = confineMirrorWrite(mirror.mirrorRoot, relPath, mirror.allowBagsRootFiles);
    if (!gate.ok) {
      console.error(`[disk-ward] write refused (${mirror.bagId} <- ${tiddlerUri}): ${gate.reason}`);
      this.onRefusal?.({ bagId: mirror.bagId, uri: tiddlerUri, reason: gate.reason });
      return;
    }
    const candidate = gate.path;

    // THE CONFLUENCE, SECOND LEG (projection-gate). Three streams meet here —
    // the records' render, the last-projected anchor, and the bytes standing on
    // disk — and the gate decides among noop · project · conflict. A conflict
    // means the operator's hands moved the FILE and the doc moved the RECORDS
    // since the last projection; the projector then REFUSES the write and
    // surfaces on the disk-ward's alert rail. It never merges, never picks a
    // winner by timestamp: the operator talks it out (the ingest leg's law,
    // read from this shore).
    const obsHash  = carrierHash(output, metaBody);               // whole-carrier, the merge seat's view
    const metaPath = metaBody !== undefined ? candidate + ".meta" : null;
    const syncedKey = syncedTreeKey(bagId, tiddlerUri);
    // A pending pointer body writes no content file at all — nothing to project,
    // nothing to clobber. The `.meta` alone still lands (or already stands).
    if (bodyPending) {
      const metaInSync = metaPath === null || (existsSync(metaPath) && safeReadEquals(metaPath, metaBody!));
      if (metaInSync) return;
    } else {
      const diskHash = this.diskCarrierHash(candidate, metaPath, isBinary);
      const decision = decideProjection({
        diskHash,
        syncedHash:  this.syncedTree?.get(syncedKey) ?? null,
        recordsHash: obsHash,
      });
      if (decision.kind === "noop") {
        // `disk-matches-records` — the bytes already stand there; record the
        // observation so the anchor tracks reality (no write, no mtime churn).
        // `records-unmoved` — the disk moved ALONE and the INGEST leg owns that
        // state; the anchor MUST NOT advance, or the ingest gate goes blind to
        // the very edit it is meant to adopt.
        if (decision.reason === "disk-matches-records") this.syncedTree?.set(syncedKey, obsHash);
        return;
      }
      if (decision.kind === "conflict") {
        // Surface, never overwrite. Once per DISTINCT standoff: a level-triggered
        // reconcile re-fires on every nudge, and an alert rail that repeats itself
        // trains the operator to ignore it. A standoff that MOVES surfaces afresh.
        const stamp = `${diskHash ?? ""}\n${obsHash}`;
        if (this.surfaced.get(syncedKey) !== stamp) {
          this.surfaced.set(syncedKey, stamp);
          const reason = `projection conflict — the file moved on disk AND the records moved since the last projection; nothing written. Talk it out: reconcile ${relPath} against the carrier, then re-project.`;
          console.error(`[disk-ward] write refused (${mirror.bagId} <- ${tiddlerUri}): ${reason}`);
          this.onRefusal?.({ bagId: mirror.bagId, uri: tiddlerUri, reason });
        }
        return;
      }
      // A `project` verdict clears any standing surfaced-conflict memory for this
      // carrier — the standoff resolved, so the next one must surface again.
      this.surfaced.delete(syncedKey);
    }

    this.writing.add(tiddlerUri);
    try {
      mkdirSync(dirname(candidate), { recursive: true });
      // Atomic write (§2 law): temp in the SAME dir + rename — no watcher or
      // editor ever observes a torn carrier; a crash leaves only a temp file.
      // A pointer whose bytes the tier lacks writes no content file at all.
      if (!bodyPending) this.atomicWrite(candidate, writeBytes);
      // The `.meta` sidecar carries the tiddler's fields for a content filetype;
      // it lands beside the body, atomic too, so a reader never pairs a fresh
      // body with a stale sidecar.
      if (metaPath !== null) this.atomicWrite(metaPath, metaBody!);
      // The observation names the WHOLE carrier — a pending body leaves no observation to name.
      if (!bodyPending) this.syncedTree?.set(syncedTreeKey(bagId, tiddlerUri), obsHash);
      if (this.debugJson && this._tw5) {
        const jsonStr = (this._tw5.$tw.wiki as { getTiddlerAsJson?: (t: string) => string })
          .getTiddlerAsJson?.(tiddlerUri);
        if (jsonStr) {
          // Ride as a `.json` AFTER the full filename (`base.mem.json`), not
          // `base.json` — a bare-stem sibling would be a carrier of stem `base`,
          // and the straggler sweep would delete it every flush. The double
          // extension keeps it OUT of `carrierDiskFiles`' single-segment match.
          const jsonPath = candidate + ".json";
          writeFileSync(jsonPath, jsonStr, "utf-8");
        }
      }
      if (!this._firstFlushDone) {
        this._firstFlushDone = true;
        this.readinessMap?.mark("disk-projector");
      }
    } finally {
      this.writing.delete(tiddlerUri);
    }

    // Same-mirror straggler sweep: a FILETYPE change re-sites the carrier at a
    // NEW extension (`.md` → `.tid`), so the old-extension file (+ its `.meta`)
    // would orphan beside the fresh one. Remove any sibling of THIS carrier's
    // base that the current write did not produce — the extension moved, the
    // name did not.
    for (const f of this.mirrorCarrierFiles(mirror, tiddlerUri) ?? []) {
      if (f === candidate || (metaPath !== null && f === metaPath)) continue;
      try {
        if (existsSync(f)) {
          this.writing.add(tiddlerUri);
          try { unlinkSync(f); } finally { this.writing.delete(tiddlerUri); }
        }
      } catch { /* best-effort */ }
    }

    // After writing the current mirror, unlink stale files from OTHER mirrors —
    // but ONLY where the carrier has genuinely LEFT that bag (a true MOVE, e.g.
    // promotion wiki-bag → lares-bag, cleaning the old scratch file). A carrier
    // that STILL LIVES in a bag — a working edit SHADOWING its canon copy — keeps
    // its file there: `bagsHolding` reports every bag holding it, and a bag on
    // that list never gets its file unlinked. Without the callback, the unlink
    // clears every other mirror by path. One gate, one choke-point: the unlink
    // path routes through the ward like every other mirror touch.
    const holdingBags = this.bagsHolding ? new Set(await this.bagsHolding(tiddlerUri)) : null;
    for (const otherMirror of this.mirrors) {
      // The carrier still lives in this bag (shadowed, not moved) → keep its file.
      if (holdingBags?.has(otherMirror.bagId)) continue;
      const staleFiles = this.mirrorCarrierFiles(otherMirror, tiddlerUri);
      if (staleFiles === null) continue;
      for (const stale of staleFiles) {
        // Never unlink what THIS flush just wrote. Path identity — not bag
        // identity — marks the live file: the base derives from the URI alone,
        // so the current bag, AND any mirror sharing this mirrorRoot, resolves to
        // the SAME files. The path guard closes the co-rooted self-deletion
        // structurally — no mirror config can trigger it (the `.meta` sidecar
        // rides beside the body under the same guard).
        if (stale === candidate || (metaPath !== null && stale === metaPath)) continue;
        try {
          if (existsSync(stale)) {
            this.writing.add(tiddlerUri);
            try { unlinkSync(stale); } finally { this.writing.delete(tiddlerUri); }
          }
        } catch { /* best-effort */ }
      }
    }
  }
}
