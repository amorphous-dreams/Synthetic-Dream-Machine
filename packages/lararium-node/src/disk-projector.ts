/**
 * LarDiskProjector — bag-aware unidirectional projection: store → disk.
 *
 * Co-projection model: the operator's mind
 * originates; the disk carrier and the CRDT record-set both PROJECT that
 * origin, each in its native grain — disk holds whole markdown memes, the
 * doc holds tid-sized records, the VM decomposes for transclusion. Merge
 * authority routes through the CRDT alone; this projector renders the disk
 * co-projection and never INGESTS from disk — that direction belongs to the
 * ingest path (file watcher → store.put). It does READ disk, for one purpose
 * only: the Confluence gate below needs to know what the operator's hands left
 * there before it is allowed to write over it. A read that decides whether to
 * write is not an ingest — no disk byte ever reaches a record through here.
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
 * Siting precedence (every title, not only the `lar:` family): a `$:/config/FileSystemPaths` RULE,
 * else the LOCI law for a `lar:///w.w.w/…` name, else TW5's FLATTENED default — the file a stock
 * folder wiki would write for a title that owns no uri-path (`My Notes`, `$:/config/Foo`). Only the
 * flattened branch can collide, so only it walks `uniquifyBase`'s free-or-mine uniquifier.
 *
 * Group routing (carrier-whole at rest, disk-projection#projection-routing):
 *   memetic-wikitext records form a tiddler-group keyed by the carrier root.
 *   A child change climbs `$fragment-parent` to the root; the gate queues each
 *   root once across bags; reconcile renders the ROOT — one carrier, one file. A
 *   fragment URI never owns a disk path (bag-paths returns null for them).
 *
 * Echo suppression ranks (Confluence): the CONTENT-HASH gates carry the law —
 * ingest drops disk-hash == synced-hash; projection skips byte-identical
 * writes. The `writing` Set survives beneath them as a latency
 * optimization only (skip re-statting our own in-flight writes); no
 * correctness rests on it.
 *
 * THE CONFLUENCE, PROJECTING LEG (`projection-gate.decideProjection`): every flush the
 * byte-identity skip does not answer meets the three-way gate — the records' render, the
 * merge base, and what stands on disk — before a single byte is written. `project`
 * writes; `noop` stands down silently (the ingest leg owns that state); `conflict`
 * stands down LOUDLY on the ward-alert rail (`onConflict`). Both legs of the round trip
 * reconcile and neither overwrites (the operator's ruling: conflict-surfacing in BOTH
 * legs). The gate decides and never writes; this file owns every I/O and every alert.
 *
 * A PERSON ANSWERS A STANDOFF BY ITS KEY (`takeRecords`): the answer admits one write of the
 * records' render over the very states the key names, and no other.
 *
 * AN UNLINK READS THE FILE FIRST (`judgeHome`). The projector removes a file only where its bytes
 * equal the disk side of the base that stands at that path, or say what the records render. A file
 * that fails the proof stays where a hand left it, and the carrier stands off under a key that names
 * the paths. One judge serves every unlink: a carrier's earlier siting, a sibling at an earlier
 * extension, a mirror the carrier left, and the file of a carrier the records dropped.
 */

import { writeFileSync, mkdirSync, unlinkSync, existsSync, readFileSync, readdirSync, renameSync } from "fs";
import { dirname, basename, extname, relative as relativePath, resolve as resolvePath } from "path";
import { confineMirrorWrite, carrierBaseRelPath } from "./bag-paths.js";
import { contentHash, syncedTreeKey, SyncedTree } from "./synced-tree.js";
import { decideProjection } from "./projection-gate.js";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { isEffectRecordUri, isBagManifestUri, isVolatileVmUri, isNexusHandlesUri, KeyedReconcileGate, carrierHash, sha256HexBytesSync, digestsEqual } from "@lararium/mesh";
import { ORIGINAL_TIDDLER_PATHS, parseProvenance, packOfMember } from "@lararium/mesh";
import type { ReadinessMap } from "@lararium/mesh";
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
  /** Fired on every disk-ward refusal — the island routes it to the daemon VM. */
  readonly onRefusal?: (info: { bagId: string; uri: string; reason: string }) => void;
  /**
   * Fired whenever the Confluence's projecting leg reads a STANDOFF (`decideProjection`
   * → `conflict`): the disk and the records BOTH moved past the merge base, so no write
   * happens and the divergence SURFACES instead (the operator's ruling — conflict-surfacing
   * in both legs; Unison's law: surface, never overwrite).
   *
   * A SEPARATE callback from `onRefusal` on purpose. A ward refusal says "this write was
   * not allowed"; a conflict says "this write would have drowned an edit". Routing both
   * through one callback would send an operator to the wrong mechanism — the same reason
   * `fileWardRefusal` takes a `wardKind` and names the ward that actually refused.
   * Absent → the conflict still suppresses the write (fail-closed) and logs; the operator
   * simply learns of it from the console rather than the daemon ledger.
   *
   * ONCE PER STANDOFF. A standoff names one carrier in one bag at one pair of states (the disk's
   * hash and the records' hash); `standoff` carries that key. The reconcile runs level-triggered
   * and meets a standing standoff at every nudge: this fires on ENTERING one and stays quiet while
   * it stands. A standoff whose states moved reads as a new one.
   */
  readonly onConflict?: (info: { bagId: string; uri: string; reason: string; standoff: string }) => void;
  /**
   * Fired once when a reconcile finds a surfaced standoff gone: the streams agree again, one leg
   * owns the state, or the carrier left. Carries the key `onConflict` carried, so the alert that
   * key raised can clear.
   */
  readonly onConflictResolved?: (info: { bagId: string; uri: string; standoff: string }) => void;
  /**
   * Fired when the set of this bag's PENDING REMOVALS settles at a new membership: carriers whose file
   * vanished from the path their base names. The projector writes none of them back and tombstones none;
   * a person answers (`answerRemovals`). ONE CALL PER SETTLED SET: the projector raises it when its
   * reconcile queue drains, so a branch switch that removes five hundred files reads as one call naming
   * the count. `key` names the set (the bag and its sorted members); a set that changed reads as a new one.
   */
  readonly onPendingRemoval?: (info: { bagId: string; key: string; count: number; uris: readonly string[]; reason: string }) => void;
  /** Fired once when a surfaced pending-removal set stands no longer: it emptied, or its membership moved. */
  readonly onPendingRemovalResolved?: (info: { bagId: string; key: string }) => void;
  /**
   * A HAND'S DELETE IN THE WIKI, for the `remove` answer: delete the carrier root where the wiki shore
   * sees it, so the shore's own router lands the tombstone (the working layer, shadowing canon) and
   * removes the slot children. Absent → a `remove` answer refuses by name: this projector holds no
   * delete door.
   */
  readonly removeCarrier?: (uri: string) => void | Promise<void>;
  /**
   * WHAT THE DISK BYTES SAY — `render(parse(diskText))` for the memetic-wikitext family
   * (`@lararium/tw5/carrier-canonical`, the ONE door; the pure subpath, no wasm). Feeds
   * `decideProjection`'s canonical-equivalence clause, which is what tells the ORDINARY
   * post-ingest round trip apart from a genuine standoff.
   *
   * Null from the function, or the option ABSENT, both mean "no trustworthy canonical view"
   * — and the gate reads that as the standoff, never as equivalence. So a projector mounted
   * without this stays fail-closed: it surfaces conflicts it cannot resolve rather than
   * writing through them.
   */
  readonly canonicalizeFn?: (uri: string, diskText: string) => string | null;
  /**
   * WHAT THE DISK BYTES SAY, for a NATIVE (non-memetic) carrier — `render(parse(diskBody,
   * diskMeta))` through TW5's own deserializer/renderer, mirroring `canonicalizeFn` onto
   * the family `action-handler.ts`'s LOAD leg already trusts (its `nativeRender`
   * congruence). Feeds the SAME `decideProjection` canonical-equivalence clause
   * `canonicalizeFn` feeds; the two never run on the same carrier (one keys on
   * `file.ext === MEME_EXT`, the other on every other extension).
   *
   * Returns `null` for anything this shore cannot trustworthily canonicalize — a bundle
   * (more than one deserialized member, or a foreign-titled member), a malformed disk
   * file, an unregistered filetype. Null reads as the standoff here exactly as it does
   * for the memetic clause (the null-as-default inversion: absence is never equivalence).
   *
   * Absent, OR the carrier is binary (base64-encoded) → no native congruence is asked —
   * a binary round trip carries no reformatting to normalize, only a byte-for-byte
   * identity the echo gate above already answers.
   */
  readonly canonicalizeNativeFn?: (
    uri: string,
    ext: string,
    diskBody: string,
    diskMeta: string | undefined,
  ) => { readonly body: string; readonly metaBody?: string } | null;
  /** Optional readiness map — lights `disk-projector` after first flush. */
  readonly readinessMap?: ReadinessMap;
  /** Write a `.json` peek beside each carrier for debugging. Off unless asked. The peek stands as the
   *  projector's own artifact, rewritten whole at every write: it carries no hand's words and meets no gate. */
  readonly debugJson?: boolean;
  /**
   * The Synced tree (Confluence merge base): records the content hash of every
   * projected carrier; arms the projection-side hash gate — a write whose
   * bytes match disk skips silently (no event, no churn). Absent → the projector holds
   * its bases in memory for its own life: a base still names every agreement it reached,
   * and a restart reads every carrier as never agreed.
   */
  readonly syncedTree?: SyncedTree;
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

/**
 * The `title:` a TW5 field block names. Reads the block the way TW5's own `.tid` parser does —
 * `name: value` lines until the first blank line — and stops at the first line that is not one.
 */
function fieldBlockTitle(text: string): string | undefined {
  for (const line of text.split("\n")) {
    if (line.trim() === "") break;
    const m = /^([^:\s]+)\s*:\s*(.*)$/.exec(line);
    if (!m) break;
    if (m[1] === "title") return m[2]!.trim();
  }
  return undefined;
}

/**
 * WHO OWNS a candidate path — read FROM DISK ALONE, no registry, no memory.
 *
 * The projector reconciles statelessly per carrier root through the keyed queue, so it holds nothing like
 * TW5's `$tw.boot.files` title→path map. Its uniquifier's free-path test must therefore read
 * "absent OR ALREADY MINE" — a plain `existsSync` test would write `title.tid` on the first boot
 * and `title_1.tid` on the second, growing one file per boot, which clobbers worse than the
 * collision it prevents.
 *
 * MINE is provable because every native projection writes its own title: a `.tid` body opens with
 * the field block (`getFieldStringBlock` excludes only `text` and the unpersisted stamps), a
 * `.json` file carries the field object, and a content filetype's `.meta` sidecar carries the
 * fields whole. Returns:
 *   a title  — the file at this path projects that title
 *   null     — no file sits there (free)
 *   undefined— a file sits there and its format proves nothing (a flattened `.mem`, a body whose
 *              sidecar has gone). The caller must neither clobber it nor grow past it.
 */
export function projectedFileTitle(contentPath: string, ext: string, hasMeta: boolean): string | null | undefined {
  const metaPath = `${contentPath}.meta`;
  try {
    if (hasMeta) {
      if (existsSync(metaPath)) return fieldBlockTitle(readFileSync(metaPath, "utf-8"));
      return existsSync(contentPath) ? undefined : null;
    }
    if (!existsSync(contentPath)) return existsSync(metaPath) ? undefined : null;
    if (ext === ".tid") return fieldBlockTitle(readFileSync(contentPath, "utf-8"));
    if (ext === ".json") {
      const parsed: unknown = JSON.parse(readFileSync(contentPath, "utf-8"));
      const first = Array.isArray(parsed) ? (parsed[0] as unknown) : parsed;
      const t = (first as { title?: unknown } | null | undefined)?.title;
      return typeof t === "string" ? t : undefined;
    }
    return undefined;
  } catch { return undefined; }
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

  /** Reconcile queue keyed by carrier-root URI. Born in start(). */
  private gate: KeyedReconcileGate<string> | null = null;
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

  private readonly mirrors: readonly BagMirrorConfig[];
  private readonly carrierFileFn: (tiddlerUri: string) => Promise<CarrierFile | null>;
  private readonly resolveByCid: ((cid: string) => Promise<Uint8Array | null>) | undefined;
  private readonly bagsHolding: ((tiddlerUri: string) => Promise<readonly string[]>) | undefined;
  private readonly onRefusal: ((info: { bagId: string; uri: string; reason: string }) => void) | undefined;
  private readonly onConflict: ((info: { bagId: string; uri: string; reason: string; standoff: string }) => void) | undefined;
  private readonly onConflictResolved: ((info: { bagId: string; uri: string; standoff: string }) => void) | undefined;
  /**
   * The standoff each (bag, carrier) stands in right now, by key. Memory only: a fresh boot enters anew.
   * `sides` names a standoff between the disk and the records at the carrier's own path; `home` names a
   * file at a path the carrier left (or of a carrier the records dropped) that holds bytes no agreement covers.
   */
  private readonly standoffs = new Map<string, { readonly standoff: string; readonly kind: "sides" | "home" }>();
  /** The standoff a person answered for each (bag, carrier), by the key they named. Read once, by the reconcile the answer starts. */
  private readonly answered = new Map<string, string>();
  /** Every carrier whose file vanished from the path its base names, by (bag, carrier). Memory only: a boot's mount scan finds each anew. */
  private readonly pending = new Map<string, { readonly bagId: string; readonly uri: string; readonly path: string }>();
  /** The pending removals a person answered `restore` for. Read once, by the reconcile the answer starts. */
  private readonly restoreAsked = new Set<string>();
  /** The pending-removal set surfaced for each bag, by its key. */
  private readonly pendingSurfaced = new Map<string, string>();
  /** True while a pending set moved and its surfacing waits for the reconcile queue to drain. */
  private pendingMoved = false;
  private readonly onPendingRemoval: LarDiskProjectorOptions["onPendingRemoval"];
  private readonly onPendingRemovalResolved: LarDiskProjectorOptions["onPendingRemovalResolved"];
  private readonly removeCarrier: LarDiskProjectorOptions["removeCarrier"];
  private readonly canonicalizeFn: ((uri: string, diskText: string) => string | null) | undefined;
  private readonly canonicalizeNativeFn:
    | ((uri: string, ext: string, diskBody: string, diskMeta: string | undefined) => { readonly body: string; readonly metaBody?: string } | null)
    | undefined;
  private readonly readinessMap: ReadinessMap | undefined;
  private readonly debugJson: boolean;
  private readonly syncedTree: SyncedTree;

  constructor(opts: LarDiskProjectorOptions) {
    this.mirrors      = opts.mirrors;
    this.carrierFileFn = opts.carrierFileFn;
    this.resolveByCid = opts.resolveByCid;
    this.bagsHolding  = opts.bagsHolding;
    this.onRefusal    = opts.onRefusal;
    this.onConflict   = opts.onConflict;
    this.onConflictResolved = opts.onConflictResolved;
    this.onPendingRemoval = opts.onPendingRemoval;
    this.onPendingRemovalResolved = opts.onPendingRemovalResolved;
    this.removeCarrier = opts.removeCarrier;
    this.canonicalizeFn = opts.canonicalizeFn;
    this.canonicalizeNativeFn = opts.canonicalizeNativeFn;
    this.readinessMap = opts.readinessMap;
    this.debugJson    = opts.debugJson ?? false;
    this.syncedTree   = opts.syncedTree ?? new SyncedTree(null);
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
   * Returns an async unsubscribe that completes the running reconcile.
   */
  start(tw5: TW5Engine): () => Promise<void> {
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
    // licenses a destructive action off a transient view. A MOVE's source-tombstone and
    // destination-add mark one root. Reconcile reads settled VM state, so the last owner is visible;
    // a mark during that read sets dirty and causes one more read when it completes.
    const gate = new KeyedReconcileGate<string>({
      reconcile: (rootUri) => this.reconcile(rootUri),
    });
    this.gate = gate;
    // NO FORM CUT. Every changed title reaches the gate — a `lar:` URI, `My Notes`, `$:/config/Foo`
    // alike. A `!title.startsWith("lar:")` filter here withheld a tiddler by the SHAPE OF ITS NAME,
    // which is the move canon already refused for hostful URIs, and it stood against the sync law:
    // what is allowed to sync by NOT sitting in a volatile layer shall sync, and what syncs into a
    // MIRRORED bag shall land on disk. THE RESIDENCY BAR IS THE ONLY BAR, and it lives one step
    // down in `reconcile`: a title whose `$origin-bag` names no mirror drops there. That covers the
    // volatile plane (never persisted, so never stamped), `$:/state/`, `$:/temp/`, `$:/boot/` and
    // drafts (the in-wiki cascade routes them to unmirrored bags), and `$:/core` (named withholding).
    // Each title change is one queue mark and a `getTiddler` + one field read — the reconcile is
    // level-triggered and idempotent, so a nudge that resolves to no mirror costs exactly that.
    const handler = (changes: Record<string, unknown>) => {
      this.measure.changeEvents++;
      this.measure.lastChangeAt = performance.now();
      this.measure.holdsSinceChange = 0;
      this.measure.wroteSinceChange = false;
      for (const title of Object.keys(changes)) gate.mark(routeToRoot(title));
    };
    wiki.addEventListener?.("change", handler);
    // The scan follows subscription in this synchronous turn. The gate starts in a microtask and
    // yields between roots, so a mounted seed receives a complete, paced projection pass.
    // Every title, system titles included: the residency bar below is the only bar (`getTiddlers`
    // answers non-system titles alone).
    const titles = (wiki as unknown as { allTitles?: () => string[] }).allTitles?.() ?? [];
    const roots = new Set<string>();
    for (const title of titles) roots.add(routeToRoot(title));
    for (const rootUri of roots) {
      const fields = wiki.getTiddler?.(rootUri)?.fields as Record<string, unknown> | undefined;
      const bagId = fields?.["$origin-bag"];
      if (typeof bagId === "string" && this.mirrors.some((mirror) => mirror.bagId === bagId)) gate.mark(rootUri);
    }
    return async () => { wiki.removeEventListener?.("change", handler); await this.stop(); };
  }

  /** Resolve when no reconcile runs and no root waits in the queue, and every pending-removal set that moved has surfaced. */
  async idle(): Promise<void> {
    await (this.gate?.idle() ?? Promise.resolve());
    this._surfacePending();
  }

  async stop(): Promise<void> {
    await this.gate?.settle();
    this.writing.clear();
    this.syncedTree.flush();
  }

  /**
   * Level-triggered reconcile of ONE carrier root against the settled VM state
   * (the projector's authoritative view, per VM-Primacy). Live (a `$origin-bag`
   * naming a mirror) → flush that owner (render + write + cross-mirror cleanup).
   * Gone from the resolved view → unlink from every mirror whose bag no longer
   * holds it (a true delete; a bag still holding the carrier keeps its file). A
   * MOVE shows its new owner here because this read observes settled VM state.
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

  /** Every standoff this projector stands in right now: the bag, the carrier and the key a person answers by. */
  standing(): Array<{ readonly bagId: string; readonly uri: string; readonly standoff: string }> {
    return [...this.standoffs].map(([key, entry]) => {
      const cut = key.indexOf("\n");
      return { bagId: key.slice(0, cut), uri: key.slice(cut + 1), standoff: entry.standoff };
    });
  }

  /**
   * A PERSON TAKES THE RECORDS' SIDE of one standoff, named by its key. The answer admits one reconcile:
   * where the carrier still stands in the standoff the key names, the records' render writes over the
   * file and the base pins there. Where the states moved since the person read the key, the answer
   * takes nothing, and the standoff that stands keeps its own key.
   */
  async takeRecords(bagId: string, uri: string, standoff: string): Promise<{ readonly took: boolean; readonly why?: string }> {
    const key = sitedKey(bagId, uri);
    const stands = this.standoffs.get(key)?.standoff;
    if (stands === undefined) return { took: false, why: `no standoff stands for ${uri} in ${bagId}` };
    if (stands !== standoff) return { took: false, why: `the standoff for ${uri} stands under key ${stands}; the answer names ${standoff}` };
    this.answered.set(key, standoff);
    try {
      await this.reconcileNow(uri);
    } finally {
      this.answered.delete(key);
    }
    const after = this.standoffs.get(key)?.standoff;
    return after === undefined ? { took: true } : { took: false, why: `the states moved while the answer travelled; the standoff stands under key ${after}` };
  }

  /** Reconcile one carrier root through the queue where it runs, and wait for the queue to drain. */
  private async reconcileNow(rootUri: string): Promise<void> {
    if (this.gate === null) { await this.reconcile(rootUri); return; }
    this.gate.mark(rootUri);
    await this.gate.idle();
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
    // THE VOLATILE PLANE NEVER PROJECTS — a RESIDENCY bar, not a form one: `lararium.local.vm` is a
    // reserved root whose whole meaning is "this vessel's own scratch, never persisted, never synced"
    // (lar-uris). Nothing there carries a mirrored `$origin-bag` today, because the island adaptor
    // refuses it before the store; stating it here too keeps the bar readable at the shore that now
    // admits every title, and no cascade edit can lift it.
    if (isVolatileVmUri(rootUri)) return;
    const tiddler = this._tw5?.$tw.wiki.getTiddler?.(rootUri);
    if (!tiddler) {
      // The resolved view holds no such carrier: nothing stands to write back, so no removal stays pending.
      this._leavePendingExcept(rootUri);
      await this._scheduleUnlinkByTitle(rootUri);
      return;
    }
    const fields = tiddler.fields as Record<string, string | string[] | undefined>;
    // A carrier that stopped projecting, or left for another bag, leaves every standoff it stood in
    // where it no longer projects: the alert names a conflict this projector no longer weighs.
    if (fields["disk-projection"] === "no") { this._leaveStandoffsExcept(rootUri); this._leavePendingExcept(rootUri); return; }
    // The host's provenance stamp (nalu-engine) names the mirror; `bag` is the author's field.
    const bagId = typeof fields["$origin-bag"] === "string" ? fields["$origin-bag"] : undefined;
    if (!bagId || !this.mirrors.some((m) => m.bagId === bagId)) { this._leaveStandoffsExcept(rootUri); this._leavePendingExcept(rootUri); return; }
    this._leaveStandoffsExcept(rootUri, bagId);
    this._leavePendingExcept(rootUri, bagId);
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

  /** The carrier files standing at one extension-less mirror-relative base, or null where the ward refuses it. */
  private mirrorCarrierFilesAt(mirror: BagMirrorConfig, base: string): string[] | null {
    const gate = confineMirrorWrite(mirror.mirrorRoot, base, mirror.allowBagsRootFiles);
    return gate.ok ? carrierDiskFiles(gate.path) : null;
  }

  /**
   * THE UNIQUIFIER — TW5's `title`, `title_1`, `title_2` … walk (filesystem.js:382-390), with its
   * one memory-bound step replaced.
   *
   * TW5 breaks its loop on `oldPath == fullPath`, where `oldPath` comes from `$tw.boot.files` — the
   * in-memory title→path assignment its process holds for life. This projector holds none, so the
   * break condition reads off the DISK instead: a candidate is free when nothing sits there, and
   * MINE when what sits there names this very title (`projectedFileTitle`). Same walk, same
   * assignment, and it survives a restart because the evidence never left the filesystem.
   *
   * Where the format proves nothing, this REFUSES rather than clobber a stranger's bytes or grow a
   * `_1` per boot. Applied ONLY to the flattened default — a ruled path and a loci path both keep
   * exactly the siting they had (the loci path is injective by construction, and a `.mem` carries
   * no `title:` to read back, so uniquifying there could only misfire).
   */
  private uniquifyBase(
    mirror: BagMirrorConfig,
    base: string,
    ext: string,
    hasMeta: boolean,
    title: string,
  ): { readonly base: string } | { readonly reason: string } {
    for (let count = 0; count < 1000; count++) {
      const candidate = count === 0 ? base : `${base}_${count}`;
      const gate = confineMirrorWrite(mirror.mirrorRoot, candidate + ext, mirror.allowBagsRootFiles);
      if (!gate.ok) return { reason: gate.reason };
      const owner = projectedFileTitle(gate.path, ext, hasMeta);
      if (owner === null || owner === title) return { base: candidate };   // free, or already mine
      if (owner === undefined) {
        return { reason: `${candidate}${ext} is occupied and its format proves no ownership — refusing to clobber or to grow a copy per boot (${title})` };
      }
    }
    return { reason: `no free-or-mine path for "${title}" within 1000 tries at ${base}${ext}` };
  }

  /** Unlink by trying all mirrors whose path strategy resolves the URI — but a
   *  mirror whose bag STILL HOLDS the carrier keeps its file (a carrier hidden
   *  from the resolved view by a shadowing tombstone still lives in its lower
   *  bag; each mirror reflects its OWN bag's content, never the resolved view). */
  /** A reconcile found no standoff for this carrier: clear the one it surfaced, if any, and say so once. */
  private _leaveStandoff(bagId: string, uri: string, kind?: "sides" | "home"): void {
    const key = sitedKey(bagId, uri);
    const entry = this.standoffs.get(key);
    if (entry === undefined || (kind !== undefined && entry.kind !== kind)) return;
    this.standoffs.delete(key);
    this.onConflictResolved?.({ bagId, uri, standoff: entry.standoff });
  }

  /**
   * Enter a standoff, once per key: a reconcile that meets the standoff it already raised stays quiet. A
   * standoff whose states moved ends (its alert clears) and the new one enters under its own key.
   */
  private _enterStandoff(bagId: string, uri: string, standoff: string, kind: "sides" | "home", reason: string): void {
    const key = sitedKey(bagId, uri);
    if (this.standoffs.get(key)?.standoff === standoff) return;
    this._leaveStandoff(bagId, uri);
    this.standoffs.set(key, { standoff, kind });
    console.error(`[confluence] projection conflict (${bagId} <- ${uri}): ${reason}`);
    this.onConflict?.({ bagId, uri, reason, standoff });
  }

  /**
   * Leave the SIDES standoff this carrier stands in under every mirror but `keepBag` (none kept when
   * absent): a carrier that stopped projecting there leaves a conflict nobody weighs. A HOME standoff
   * names a file that still stands on disk, so it leaves only when that file settles.
   */
  private _leaveStandoffsExcept(uri: string, keepBag?: string): void {
    if (this.standoffs.size === 0) return;
    for (const mirror of this.mirrors) if (mirror.bagId !== keepBag) this._leaveStandoff(mirror.bagId, uri, "sides");
  }

  /** The content file a listed carrier file belongs to: a `.meta` sidecar names the file it rides beside. */
  private static contentOf(file: string): string {
    return file.endsWith(".meta") ? file.slice(0, -".meta".length) : file;
  }

  /**
   * THE HOME A BASE NAMES, WHERE THIS MIRROR HOLDS IT. A base names the file its agreement stood at, and
   * the ingest gesture pins one at whatever source it read: a holding directory beside the mirror included.
   * A path this mirror's own ward would refuse to write names no home of the mirror, so no unlink weighs it
   * and the file there stays its person's.
   */
  private basedHome(mirror: BagMirrorConfig, uri: string): string | undefined {
    const basedAt = this.syncedTree.base(syncedTreeKey(mirror.bagId, uri))?.path;
    if (basedAt === undefined) return undefined;
    const within = confineMirrorWrite(mirror.mirrorRoot, relativePath(resolvePath(mirror.mirrorRoot), basedAt), mirror.allowBagsRootFiles);
    return within.ok ? basedAt : undefined;
  }

  /**
   * THE ONE JUDGE EVERY UNLINK ASKS. Reads the carrier standing at `contentPath` (body plus its `.meta`
   * where one sits beside it) and answers whether the projector may remove it:
   *
   *   absent   no content file stands there (a sidecar may, alone and unproven: it stays);
   *   agreed   its bytes equal the disk side of the base standing AT THAT PATH, or say what the records
   *            render: byte for byte, or through the family's congruence. Nothing a hand added rests there;
   *   held     anything else, with the hash of what stands. The file stays.
   *
   * `recordsHash` names the render the records carry, or null where the records hold no such carrier:
   * then the base alone can vouch.
   */
  private judgeHome(bagId: string, uri: string, contentPath: string, recordsHash: string | null): "absent" | "agreed" | { readonly held: string } {
    let body: string, meta: string | undefined, binary: boolean;
    try {
      if (!existsSync(contentPath)) {
        // A SIDECAR ALONE. Where the base (or the records, under a pending pointer) names exactly that state,
        // the empty body beside these very sidecar bytes, the projector wrote it and may take it back.
        const sidecar = `${contentPath}.meta`;
        if (existsSync(sidecar)) {
          const lone = carrierHash("", readFileSync(sidecar, "utf-8"));
          const stood = this.syncedTree.baseAt(syncedTreeKey(bagId, uri), contentPath);
          if ((stood !== null && digestsEqual(lone, stood.disk)) || (recordsHash !== null && digestsEqual(lone, recordsHash))) return "agreed";
        }
        return "absent";
      }
      const bytes = readFileSync(contentPath);
      const text = bytes.toString("utf8");
      binary = !Buffer.from(text, "utf8").equals(bytes);
      body = binary ? bytes.toString("base64") : text;
      meta = existsSync(`${contentPath}.meta`) ? readFileSync(`${contentPath}.meta`, "utf-8") : undefined;
    } catch { return { held: "unreadable" }; }
    const hash = carrierHash(body, meta);
    const base = this.syncedTree.baseAt(syncedTreeKey(bagId, uri), contentPath);
    if (base !== null && digestsEqual(hash, base.disk)) return "agreed";
    if (recordsHash !== null) {
      if (digestsEqual(hash, recordsHash)) return "agreed";
      const ext = extname(contentPath);
      let canonical: string | null = null;
      if (ext === MEME_EXT) {
        const text = this.canonicalizeFn ? this.canonicalizeFn(uri, body) : null;
        canonical = text === null ? null : carrierHash(text, meta);
      } else if (!binary && this.canonicalizeNativeFn) {
        const view = this.canonicalizeNativeFn(uri, ext, body, meta);
        canonical = view === null ? null : carrierHash(view.body, view.metaBody);
      }
      if (canonical !== null && digestsEqual(canonical, recordsHash)) return "agreed";
    }
    return { held: hash };
  }

  /** Remove one carrier home the judge agreed to: the content file and its sidecar; the base that stood there leaves with it. */
  private unlinkHome(bagId: string, uri: string, contentPath: string): void {
    this.writing.add(uri);
    try {
      for (const f of [contentPath, `${contentPath}.meta`]) {
        try { if (existsSync(f)) unlinkSync(f); } catch { /* best-effort — a hand can clean up */ }
      }
    } finally { this.writing.delete(uri); }
    const key = syncedTreeKey(bagId, uri);
    if (this.syncedTree.baseAt(key, contentPath) !== null) this.syncedTree.delete(key);
  }

  /**
   * SETTLE THE HOMES A CARRIER LEFT, reading each before anything unlinks. Agreed homes leave. Where one
   * holds bytes no agreement covers, nothing unlinks and nothing writes: the carrier stands off under a key
   * that names every held path (and `toward`, the path the carrier would take), and this answers false.
   * A person who named that key and took the records' side removes the held files. The caller leaves the
   * standoff once every home it weighs has settled. A sidecar standing with no body beside it stays: its
   * bytes alone match no base, so nothing can prove it holds no hand's edit.
   */
  private settleHomes(bagId: string, uri: string, homes: readonly string[], recordsHash: string | null, toward: string | null, why: string): boolean {
    const agreed: string[] = [];
    const held: Array<{ readonly path: string; readonly hash: string }> = [];
    for (const home of [...new Set(homes)].sort()) {
      const verdict = this.judgeHome(bagId, uri, home, recordsHash);
      if (verdict === "agreed") agreed.push(home);
      else if (verdict === "absent") continue;   // no body stands there; a sidecar left alone proves nothing and stays
      else held.push({ path: home, hash: verdict.held });
    }
    if (held.length > 0) {
      const standoff = sha256HexBytesSync(new TextEncoder().encode([bagId, uri, "home", toward ?? "", ...held.map((h) => `${h.path}\n${h.hash}`), recordsHash ?? ""].join("\n"))).slice(0, 24);
      if (this.answered.get(sitedKey(bagId, uri)) !== standoff) {
        const where = held.map((h) => h.path).join(", ");
        this._enterStandoff(bagId, uri, standoff, "home",
          `${why}: the file at ${where} holds bytes no agreement covers, so it stays${toward !== null ? ` and nothing writes at ${toward}` : ""}. Ingest that file, or take the records' side under key ${standoff} (the file then leaves)`);
        return false;
      }
      // The person named this very state and took the records' side: the held files give way.
      for (const h of held) agreed.push(h.path);
    }
    for (const home of agreed) this.unlinkHome(bagId, uri, home);
    return true;
  }

  /** This carrier's file vanished from the path its base names: it stands pending until a person answers or the file returns. */
  private _enterPending(bagId: string, uri: string, path: string): void {
    const key = sitedKey(bagId, uri);
    if (this.pending.get(key)?.path === path) return;
    this.pending.set(key, { bagId, uri, path });
    this._pendingSetMoved();
  }

  private _leavePending(bagId: string, uri: string): void {
    if (this.pending.delete(sitedKey(bagId, uri))) this._pendingSetMoved();
  }

  /** Leave the pending removal this carrier stands in under every mirror but `keepBag` (none kept when absent). */
  private _leavePendingExcept(uri: string, keepBag?: string): void {
    if (this.pending.size === 0) return;
    for (const mirror of this.mirrors) if (mirror.bagId !== keepBag) this._leavePending(mirror.bagId, uri);
  }

  /**
   * A pending set moved. ITS SURFACING WAITS FOR THE QUEUE TO DRAIN, by the queue's own idle handshake
   * and no timer: a mount scan that finds five hundred vanished files raises one alert naming the count.
   */
  private _pendingSetMoved(): void {
    if (this.pendingMoved) return;
    this.pendingMoved = true;
    void (this.gate?.idle() ?? Promise.resolve()).then(() => { this._surfacePending(); });
  }

  /** Surface each bag's pending-removal set where its membership moved since the last surfacing. */
  private _surfacePending(): void {
    if (!this.pendingMoved) return;
    this.pendingMoved = false;
    const byBag = new Map<string, string[]>();
    for (const p of this.pending.values()) byBag.set(p.bagId, [...(byBag.get(p.bagId) ?? []), p.uri]);
    for (const bagId of new Set([...this.pendingSurfaced.keys(), ...byBag.keys()])) {
      const uris = (byBag.get(bagId) ?? []).sort();
      const key = uris.length === 0 ? undefined
        : sha256HexBytesSync(new TextEncoder().encode([bagId, "pending-removal", ...uris].join("\n"))).slice(0, 24);
      const surfaced = this.pendingSurfaced.get(bagId);
      if (surfaced === key) continue;
      if (surfaced !== undefined) { this.pendingSurfaced.delete(bagId); this.onPendingRemovalResolved?.({ bagId, key: surfaced }); }
      if (key === undefined) continue;
      this.pendingSurfaced.set(bagId, key);
      const named = uris.slice(0, 5);
      const reason = `${uris.length} carrier(s) vanished from disk where a base stands (${named.join(", ")}${uris.length > named.length ? ", …" : ""}); nothing writes back and nothing tombstones until a person answers: \`lares shore remove\` or \`lares shore restore\``;
      console.error(`[confluence] pending removal (${bagId}): ${reason}`);
      this.onPendingRemoval?.({ bagId, key, count: uris.length, uris: named, reason });
    }
  }

  /** Every carrier that stands pending right now: its bag, its address and the path its file left. */
  pendingRemovals(): Array<{ readonly bagId: string; readonly uri: string; readonly path: string }> {
    return [...this.pending.values()].sort((a, b) => a.bagId.localeCompare(b.bagId) || a.uri.localeCompare(b.uri));
  }

  /**
   * LOOK AT THE DISK NOW. The projector reads the disk only when a reconcile runs, and a file a hand
   * moved raises no change in the wiki. `sense` reconciles the named carrier roots (every root this
   * projector mirrors, when none get named) and returns once the queue drains: a vanished file enters the
   * pending set, a returned one leaves it, and every standoff reads against the bytes that stand.
   */
  async sense(uris?: readonly string[]): Promise<void> {
    const roots = uris ?? this.mirroredRoots();
    if (this.gate === null) { for (const uri of roots) await this.reconcile(uri); this._surfacePending(); return; }
    for (const uri of roots) this.gate.mark(uri);
    await this.idle();
  }

  /** Every carrier root in the wiki whose `$origin-bag` names one of this projector's mirrors. */
  private mirroredRoots(): string[] {
    const wiki = this._tw5?.$tw.wiki as unknown as { allTitles?: () => string[]; getTiddler?: (t: string) => { fields: Record<string, unknown> } | undefined } | undefined;
    const roots: string[] = [];
    for (const title of wiki?.allTitles?.() ?? []) {
      if (title.includes("#")) continue;
      const bagId = wiki?.getTiddler?.(title)?.fields["$origin-bag"];
      if (typeof bagId === "string" && this.mirrors.some((m) => m.bagId === bagId)) roots.push(title);
    }
    return roots;
  }

  /**
   * A PERSON ANSWERS PENDING REMOVALS in one bag: `restore` writes each file back from the records and
   * pins its base; `remove` deletes each carrier in the wiki through the wiki shore's own delete door
   * (`removeCarrier`), so the tombstone lands where a hand's delete lands. `remove` leaves the base in
   * the tree: a carrier that later returns from beneath its tombstone reads as pending again and asks its
   * person afresh.
   *
   * THE COUNT REPLACES A FRACTION. An answer over more than one carrier, or over `all`, names how many
   * carriers its giver read as pending in the bag. A count that moved refuses and changes nothing, so no
   * answer ever sweeps a carrier its giver never saw.
   */
  async answerRemovals(
    act: "remove" | "restore", bagId: string,
    sel: { readonly uris?: readonly string[]; readonly all?: boolean; readonly count?: number },
  ): Promise<
    | { readonly ok: true; readonly done: readonly string[]; readonly left: readonly string[] }
    | { readonly ok: false; readonly refusal: "not-pending" | "pending-count-moved" | "no-delete-door" | "answer-names-nothing"; readonly why: string; readonly count?: number }
  > {
    const inBag = this.pendingRemovals().filter((p) => p.bagId === bagId).map((p) => p.uri);
    const asked = sel.all ? inBag : [...new Set(sel.uris ?? [])];
    if (asked.length === 0) {
      return sel.all
        ? { ok: false, refusal: "not-pending", why: `no carrier of ${bagId} stands pending`, count: 0 }
        : { ok: false, refusal: "answer-names-nothing", why: "the answer names a carrier, or `all` with the count" };
    }
    const stray = asked.filter((uri) => !inBag.includes(uri));
    if (stray.length > 0) return { ok: false, refusal: "not-pending", why: `${stray.join(", ")} stand(s) in no pending removal of ${bagId}`, count: inBag.length };
    if ((sel.all || asked.length > 1) && sel.count !== inBag.length) {
      return { ok: false, refusal: "pending-count-moved", why: `${inBag.length} carrier(s) of ${bagId} stand pending; the answer names ${sel.count ?? "no count"}`, count: inBag.length };
    }
    if (act === "remove") {
      if (!this.removeCarrier) return { ok: false, refusal: "no-delete-door", why: "this projector holds no wiki delete door" };
      for (const uri of asked) {
        await this.removeCarrier(uri);
        // The carrier left the resolved view by a hand's delete: nothing stands to write back.
        this._leavePending(bagId, uri);
      }
    } else {
      for (const uri of asked) this.restoreAsked.add(sitedKey(bagId, uri));
      try {
        await this.sense(asked);
      } finally {
        for (const uri of asked) this.restoreAsked.delete(sitedKey(bagId, uri));
      }
    }
    await this.idle();
    const still = new Set(this.pendingRemovals().filter((p) => p.bagId === bagId).map((p) => p.uri));
    return { ok: true, done: asked.filter((uri) => !still.has(uri)), left: asked.filter((uri) => still.has(uri)) };
  }

  private async _scheduleUnlinkByTitle(title: string): Promise<void> {
    if (this.bagsHolding) this.measure.holdsSinceChange++;
    const holdingBags = this.bagsHolding ? new Set(await this.bagsHolding(title)) : null;
    // A MIRROR ROOT A HOLDING BAG SHARES STAYS WHOLE. Two mirrors over one root resolve one carrier to one
    // file; the bag that dropped the carrier proves nothing about a file its neighbour still owns.
    const keptRoots = new Set<string>();
    for (const mirror of this.mirrors) {
      if (!holdingBags?.has(mirror.bagId)) continue;
      // A carrier shadowed from the resolved view no longer projects here: the standoff between its sides
      // names a conflict nobody weighs.
      this._leaveStandoff(mirror.bagId, title, "sides");
      keptRoots.add(resolvePath(mirror.mirrorRoot));
    }
    for (const mirror of this.mirrors) {
      if (holdingBags?.has(mirror.bagId)) continue;
      this._leaveStandoff(mirror.bagId, title, "sides");
      if (keptRoots.has(resolvePath(mirror.mirrorRoot))) continue;
      // A title the loci law sites nowhere (a foreign title) names no file by itself; the base still may.
      const homes = (this.mirrorCarrierFiles(mirror, title) ?? []).map((f) => LarDiskProjector.contentOf(f));
      // The base names the content file its agreement stood at, across a restart: a carrier a siting rule
      // or the flattened default placed elsewhere gets read there too.
      const basedAt = this.basedHome(mirror, title);
      if (basedAt !== undefined) homes.push(basedAt);
      // The records hold no such carrier, so the base alone can vouch for a file. A held one stays.
      if (!this.settleHomes(mirror.bagId, title, homes, null, null, `the records dropped ${title}`)) continue;
      this._leaveStandoff(mirror.bagId, title);
      this.syncedTree.delete(syncedTreeKey(mirror.bagId, title));   // the observation leaves with the file(s)
      this.sited.delete(sitedKey(mirror.bagId, title));
    }
  }

  /**
   * A MEASURE, NEVER A DECISION. Counts what stands between the last wiki change event and the first file
   * write after it: the elapsed time and the `bagsHolding` lookups made in that window. A window of a
   * second or longer prints one diagnostic line; nothing reads these numbers to pace, order or drop work.
   */
  private readonly measure = { changeEvents: 0, lastChangeAt: -1, holdsSinceChange: 0, wroteSinceChange: true, writes: 0 };

  private noteFirstWrite(): void {
    const m = this.measure;
    m.writes++;
    if (m.wroteSinceChange || m.lastChangeAt < 0) return;
    m.wroteSinceChange = true;
    const gapMs = Math.round(performance.now() - m.lastChangeAt);
    if (gapMs >= 1_000) {
      console.error(`[disk-projector] MEASURE last change event to first file write ${gapMs}ms · bagsHolding calls in that window ${m.holdsSinceChange} · change events so far ${m.changeEvents} · file writes so far ${m.writes}`);
    }
  }

  /** Write bytes atomically: a temp file in the SAME dir, then rename over the
   *  target — a watcher or editor never observes a torn file, and a crash leaves
   *  only a stray temp. */
  private atomicWrite(candidate: string, body: string | Buffer): void {
    this.noteFirstWrite();
    const tmp = `${candidate}.lar-tmp-${process.pid}`;
    if (typeof body === "string") writeFileSync(tmp, body, "utf-8");
    else writeFileSync(tmp, body);
    renameSync(tmp, candidate);
  }

  /**
   * WHAT STANDS ON DISK, in the CARRIER'S OWN TEXT FORM — the one shape the Confluence
   * hashes on both legs. A binary filetype reads its raw bytes and re-encodes to base64,
   * because the Synced-tree observation and the ingest gesture both hash that base64 text
   * (the carrier text), never the decoded bytes; only the physical file holds those.
   *
   * Returns null where NO CONTENT FILE stands: the gate's clause 2 (a first projection, or a
   * vanished file where a base stands). A content file whose declared `.meta` left reads as a
   * disk state of its own: the body alone, `sidecarGone` set. That state equals no render and no
   * canonical view, so the base clauses decide it and a hand's body never gives way on the
   * strength of a missing sidecar. An unreadable content file reads as absent.
   */
  private diskCarrierText(
    candidate: string,
    metaPath: string | null,
    isBinary: boolean,
  ): { readonly body: string; readonly meta: string | undefined; readonly sidecarGone: boolean } | null {
    try {
      if (!existsSync(candidate)) return null;
      const body = isBinary ? readFileSync(candidate).toString("base64") : readFileSync(candidate, "utf-8");
      if (metaPath === null) return { body, meta: undefined, sidecarGone: false };
      if (!existsSync(metaPath)) return { body, meta: undefined, sidecarGone: true };
      return { body, meta: readFileSync(metaPath, "utf-8"), sidecarGone: false };
    } catch { return null; }
  }

  private async flush(bagId: string, tiddlerUri: string): Promise<void> {
    const mirror = this.mirrors.find((m) => m.bagId === bagId);
    if (!mirror) return;

    // THE CHARTER-ONLY MIRROR GUARD (crossroads WHO-board leak, 2026-09-20): a per-Nexus WHO-face
    // pointer never projects through a mirror grant baked from a NON-charter `nexusIdentity().kind`
    // (own / anchor). The flag rides the grant (resolved once, at boot, on the main thread — never
    // re-derived from the tiddler, which carries no kind of its own); this shore only tests the
    // URI's SHAPE. Curated crossroads library content carries no such shape and always projects.
    if (mirror.guardNexusHandles && isNexusHandlesUri(tiddlerUri)) return;

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
    // Three sitings, one precedence, each reading off the shape of what the shore handed back:
    //   ① a `$:/config/FileSystemPaths` RULE (`relPath`) — the operator's own word, and the same
    //      word a stock server's filesystem adaptor obeys, so both doors site one file.
    //   ② the LOCI law — `lar:///w.w.w/…` at its uri-path. Injective, so it needs no uniquifier.
    //   ③ TW5's FLATTENED default (`defaultRelPath`) — the ONLY thing that sites a foreign title
    //      (`My Notes`, `$:/config/Foo`), which owns no uri-path. Two titles may flatten alike, so
    //      this one — and only this one — walks the free-or-mine uniquifier.
    const ruledBase = file.relPath !== undefined && file.relPath.endsWith(file.ext)
      ? file.relPath.slice(0, file.relPath.length - file.ext.length)
      : null;
    let base = ruledBase ?? carrierBaseRelPath(tiddlerUri);
    // The flatten reaches ONLY a name the loci law does not govern. Inside the `lar:` family a null
    // base is a DELIBERATE refusal (a fragment owns no file — its carrier root does; a bag manifest
    // belongs to the declare verb), never a name left un-sited for want of a path, so flattening one
    // would resurrect exactly what those refusals withhold.
    if (base === null && !tiddlerUri.startsWith("lar:")
        && file.defaultRelPath !== undefined && file.defaultRelPath.endsWith(file.ext)) {
      const flat = file.defaultRelPath.slice(0, file.defaultRelPath.length - file.ext.length);
      const sited = this.uniquifyBase(mirror, flat, file.ext, file.metaBody !== undefined, tiddlerUri);
      if ("reason" in sited) {
        console.error(`[disk-ward] siting refused (${mirror.bagId} <- ${tiddlerUri}): ${sited.reason}`);
        this.onRefusal?.({ bagId: mirror.bagId, uri: tiddlerUri, reason: sited.reason });
        return;
      }
      base = sited.base;
    }
    if (!base) return;
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

    // Projection-side hash gate (Confluence): bytes already on disk == would-write
    // bytes → skip the write entirely (no event for any watcher, no mtime
    // churn) — but still record the observation in the Synced tree. The gate
    // reads the MAIN body per-file; the Synced-tree OBSERVATION folds the `.meta`
    // in (the echo gate keys on the whole carrier, body + live metadata).
    const outputHash = contentHash(output);                       // body-only, for the per-file skip
    const obsHash    = carrierHash(output, metaBody);             // whole-carrier, for the Synced tree
    const metaPath   = metaBody !== undefined ? candidate + ".meta" : null;
    const metaInSync = metaPath === null || (existsSync(metaPath) && safeReadEquals(metaPath, metaBody!));

    // ── THE HOMES THIS CARRIER LEFT ─────────────────────────────────────────
    // A siting rule that moved the carrier leaves its files at the earlier path. Two memories name that
    // path: this session's own siting, and the base, which stands at the content file its agreement held
    // and so remembers across a restart. Each earlier home gets READ before anything unlinks or writes.
    const earlier: string[] = [];
    const previous = this.sited.get(sitedKey(bagId, tiddlerUri));
    if (previous !== undefined && previous !== base) {
      const was = confineMirrorWrite(mirror.mirrorRoot, previous, mirror.allowBagsRootFiles);
      if (was.ok) for (const f of carrierDiskFiles(was.path)) earlier.push(LarDiskProjector.contentOf(f));
    }
    const basedAt = this.basedHome(mirror, tiddlerUri);
    if (basedAt !== undefined) earlier.push(basedAt);
    const left = earlier.filter((home) => home !== candidate);
    if (left.length > 0 && !this.settleHomes(bagId, tiddlerUri, left, bodyPending ? null : obsHash, candidate, `a siting moves ${tiddlerUri}`)) return;
    this.sited.set(sitedKey(bagId, tiddlerUri), base);
    try {
      // The body-skip reads BYTES for a binary file (a utf8 read would mangle the
      // raw bytes and never match), else hashes the utf8 text against the carrier.
      // A pending pointer body never compares — nothing to write, nothing to skip.
      const bodyInSync = !bodyPending && existsSync(candidate) && (isBinary
        ? readFileSync(candidate).equals(writeBytes as Buffer)
        : contentHash(readFileSync(candidate, "utf-8")) === outputHash);
      if (bodyInSync && metaInSync) {
        this.syncedTree.set(syncedTreeKey(bagId, tiddlerUri), candidate, obsHash);
        this._leaveStandoff(bagId, tiddlerUri);
        this._leavePending(bagId, tiddlerUri);
        return;
      }
    } catch { /* unreadable existing file — fall through to the gate */ }
    // A pointer whose bytes the tier lacks, and which declares no sidecar, holds nothing to write.
    if (bodyPending && metaPath === null) return;

    // ── THE CONFLUENCE, PROJECTING LEG ──────────────────────────────────────
    // The byte-skip above answers only the cheap identity (disk bytes == would-write
    // bytes). Everything it did not answer now meets the three-way gate: the records'
    // render, the merge base, and WHAT THE OPERATOR'S HANDS LEFT. The gate decides and
    // never writes; this shore owns every I/O and every alert (projection-gate's law).
    // A POINTER WHOSE BYTES THE TIER LACKS projects its sidecar alone, and that sidecar meets the same gate:
    // the carrier it weighs holds an empty body beside the `.meta`, on both sides. So a hand's edit to that
    // sidecar stands off like any other, and no sidecar gets replaced unread.
    const gateRecords = bodyPending ? carrierHash("", metaBody) : obsHash;
    {
      const onDisk  = bodyPending ? null : this.diskCarrierText(candidate, metaPath, isBinary);
      // A SIDECAR STANDING WITH NO BODY BESIDE IT. It names a disk state of its own (the empty body and the
      // sidecar's bytes) in two places: under a pending pointer, and where the base itself names such a
      // state, or none stands. Where the base names a carrier that held a body, the body vanished.
      const loneHash = (() => {
        if (onDisk !== null || metaPath === null) return null;
        try { return existsSync(metaPath) ? carrierHash("", readFileSync(metaPath, "utf-8")) : null; } catch { return null; }
      })();
      // WHAT THE DISK SAYS, folded exactly as `obsHash` folds the render — so the gate's
      // `≈` compares like with like. TWO congruences, ONE clause: a `.mem` carrier reads
      // through the MEMETIC family's view (`canonicalizeFn`); every other TEXT filetype
      // reads through the NATIVE view (`canonicalizeNativeFn`, mirroring the ingest leg's
      // `nativeRender`) — a binary (base64) carrier asks neither, since a byte-for-byte
      // round trip carries no reformatting to normalize (only the identity the echo gate
      // above already answers). Absent from either door hands the gate null, which reads
      // as the standoff, never as equivalence.
      const diskCanonicalHash = (() => {
        if (onDisk === null || onDisk.sidecarGone) return null;
        if (file.ext === MEME_EXT) {
          const canonicalText = this.canonicalizeFn ? this.canonicalizeFn(tiddlerUri, onDisk.body) : null;
          return canonicalText === null ? null : carrierHash(canonicalText, onDisk.meta);
        }
        if (!isBinary && this.canonicalizeNativeFn) {
          const canonical = this.canonicalizeNativeFn(tiddlerUri, file.ext, onDisk.body, onDisk.meta);
          return canonical === null ? null : carrierHash(canonical.body, canonical.metaBody);
        }
        return null;
      })();
      const key = sitedKey(mirror.bagId, tiddlerUri);
      // A BASE STANDS AT ONE PATH: an agreement this carrier reached at another path names no base here.
      let base = this.syncedTree.baseAt(syncedTreeKey(bagId, tiddlerUri), candidate);
      /** Weigh the carrier against the base as it stands: the disk's hash, the standoff those states fold to, and the gate's answer. */
      const weigh = (): { diskHash: string | null; standoff: string; decision: ReturnType<typeof decideProjection> } => {
        const diskHash = onDisk !== null ? carrierHash(onDisk.body, onDisk.meta)
          : loneHash !== null && (bodyPending || base === null || digestsEqual(base.disk, loneHash)) ? loneHash
          : null;
        // ONE STANDOFF, ONE KEY: the bag, the carrier, the path, the two states and the base they stand
        // against. A person's answer names this key, and the gate hears the answer only where everything
        // that stands now folds to the key the person named.
        const standoff = sha256HexBytesSync(new TextEncoder().encode(
          [mirror.bagId, tiddlerUri, candidate, diskHash ?? "", gateRecords, base?.disk ?? "", base?.records ?? ""].join("\n"))).slice(0, 24);
        const decision = decideProjection({
          diskHash,
          syncedHash:        base?.disk ?? null,
          syncedRecordsHash: base?.records ?? null,
          recordsHash:       gateRecords,
          diskCanonicalHash,
          ...(this.answered.get(key) === standoff ? { answer: "take-records" as const }
            : this.restoreAsked.has(key) ? { answer: "restore" as const } : {}),
        });
        return { diskHash, standoff, decision };
      };
      let weighed = weigh();
      // A SIBLING MAY HAVE MOVED THE BASE since this projector loaded the tree (another island, the ingest
      // gesture). Before the carrier's own files write, surface or pend, the tree reads afresh and the gate
      // decides again.
      if (weighed.decision.kind !== "noop") {
        this.syncedTree.reread();
        base = this.syncedTree.baseAt(syncedTreeKey(bagId, tiddlerUri), candidate);
        weighed = weigh();
      }
      const { diskHash, standoff, decision } = weighed;
      if (decision.kind === "pending-removal") {
        // THE FILE VANISHED WHERE A BASE STANDS. Nothing writes back and nothing tombstones; the base stays,
        // and the carrier stands pending until a person answers or the file returns.
        this._leaveStandoff(bagId, tiddlerUri);
        this._enterPending(bagId, tiddlerUri, candidate);
        return;
      }
      this._leavePending(bagId, tiddlerUri);
      if (decision.kind === "noop") {
        // THE DISK AND THE RECORDS SAY THE SAME THING IN TWO FRAMINGS: the carrier stands unchanged, so
        // no byte writes. The base pins at this agreement, the disk's bytes on one side and the records'
        // render on the other, so the ingest scan reads the file `unchanged` and each gate still tells a
        // later disk edit from a later record edit. A base that already names this agreement stays put.
        if (decision.reason === "canonical-equivalent" && diskHash !== null
            && !(base !== null && base.disk === diskHash && base.records === gateRecords)) {
          this.syncedTree.set(syncedTreeKey(bagId, tiddlerUri), candidate, diskHash, gateRecords);
        }
        // A PENDING POINTER'S SIDECAR STANDS AS THE RECORDS RENDER IT, and no base stands here: that
        // agreement holds a sidecar alone, and its base says so. A base that already stands stays: where
        // it names a body, that body vanished, and the carrier pends once its bytes resolve.
        if (bodyPending && base === null && diskHash !== null && decision.reason === "disk-matches-records") {
          this.syncedTree.set(syncedTreeKey(bagId, tiddlerUri), candidate, diskHash);
        }
        this._leaveStandoff(bagId, tiddlerUri);
        return;
      }
      if (decision.kind === "conflict") {
        // SURFACE, never overwrite. The write stops here; the divergence goes out on the
        // ward-alert rail (a durable ledger record + an alert in the operator's pinned VM),
        // named for the mechanism that actually stood down — never as a disk-ward refusal.
        const reason = decision.reason === "no-base"
          ? `the file at ${candidate} and the records say different things, and no base names a last agreement (${decision.reason}); nothing writes. Ingest the file, save in the wiki until both say the same, or take the records' side under key ${standoff}`
          : `the disk and the records both moved past the last projection (${decision.reason}) — the write stands down so neither edit is drowned (key ${standoff})`;
        // ONE SURFACING PER STANDOFF: the key names the bag, the carrier and the two states. A reconcile
        // that meets the standoff it already raised stays quiet; the write still stands down.
        this._enterStandoff(mirror.bagId, tiddlerUri, standoff, "sides", reason);
        return;
      }
    }

    // ── A SIBLING AT AN EARLIER EXTENSION ───────────────────────────────────
    // A filetype change re-sites the carrier at a new extension (`.md` → `.tid`), and the file at the
    // earlier one would orphan beside the fresh write. It gets READ before this write lands: agreed, it
    // leaves; holding a hand's bytes, it stays, nothing writes, and the carrier stands off.
    const siblings = (this.mirrorCarrierFilesAt(mirror, base) ?? []).map((f) => LarDiskProjector.contentOf(f)).filter((home) => home !== candidate);
    if (siblings.length > 0 && !this.settleHomes(bagId, tiddlerUri, siblings, bodyPending ? null : obsHash, candidate, `a filetype change moves ${tiddlerUri}`)) return;
    this._leaveStandoff(bagId, tiddlerUri);

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
      // The observation names the WHOLE carrier; under a pending body it names the sidecar alone.
      this.syncedTree.set(syncedTreeKey(bagId, tiddlerUri), candidate, gateRecords);
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

    // After writing the current mirror, unlink stale files from OTHER mirrors —
    // but ONLY where the carrier has genuinely LEFT that bag (a true MOVE, e.g.
    // promotion wiki-bag → lares-bag, cleaning the old scratch file). A carrier
    // that STILL LIVES in a bag — a working edit SHADOWING its canon copy — keeps
    // its file there: `bagsHolding` reports every bag holding it, and a bag on
    // that list never gets its file unlinked. Without the callback, the unlink
    // clears every other mirror by path. One gate, one choke-point: the unlink
    // path routes through the ward like every other mirror touch.
    if (this.bagsHolding) this.measure.holdsSinceChange++;
    const holdingBags = this.bagsHolding ? new Set(await this.bagsHolding(tiddlerUri)) : null;
    for (const otherMirror of this.mirrors) {
      // This flush's own mirror settled its homes above.
      if (otherMirror.bagId === bagId) continue;
      // The carrier still lives in this bag (shadowed, not moved) → keep its file.
      if (holdingBags?.has(otherMirror.bagId)) continue;
      const staleFiles = this.mirrorCarrierFiles(otherMirror, tiddlerUri);
      if (staleFiles === null) continue;
      // Never unlink what THIS flush just wrote. Path identity — not bag
      // identity — marks the live file: the base derives from the URI alone,
      // so the current bag, AND any mirror sharing this mirrorRoot, resolves to
      // the SAME files. The path guard closes the co-rooted self-deletion
      // structurally — no mirror config can trigger it (the `.meta` sidecar
      // rides beside the body under the same guard).
      const homes = staleFiles.map((f) => LarDiskProjector.contentOf(f)).filter((home) => home !== candidate);
      // The carrier left this mirror's bag: each file it left there gets read first. One that says what the
      // records render (or stands where its base left it) leaves; one a hand edited stays and stands off.
      if (this.settleHomes(otherMirror.bagId, tiddlerUri, homes, bodyPending ? null : obsHash, null, `${tiddlerUri} left ${otherMirror.bagId} for ${bagId}`)) {
        this.sited.delete(sitedKey(otherMirror.bagId, tiddlerUri));
        this._leaveStandoff(otherMirror.bagId, tiddlerUri, "home");
      }
    }
  }
}
