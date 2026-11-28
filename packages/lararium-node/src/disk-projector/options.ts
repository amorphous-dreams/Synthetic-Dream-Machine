/**
 * The projector's construction surface: every port the island hands a `LarDiskProjector`. Types alone; the class
 * re-exports this name, so callers keep importing it from `disk-projector.js`.
 * Heleuma ha: see lararium/mesh/disk-projector-options.
 */

import type { ReadinessMap } from "@lararium/mesh/readiness";
import type { VesselJournal } from "@lararium/mesh/vessel-journal";
import type { LarTiddlerStore } from "@lararium/mesh/tiddler-store";
import type { CarrierFile } from "@lararium/tw5";
import type { BagMirrorConfig } from "../bag-paths.js";
import type { SyncedTree } from "../synced-tree.js";
import type { BaseFromGit } from "../pool-head.js";
import type { CarrierTracking } from "../checkout-carriers.js";

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
  /** One bag's own store: a recovery grant reads its records here, and with `recordFileFn` so does every ordinary mirror. */
  readonly recoveryStore?: (bagId: string) => LarTiddlerStore | null;
  /**
   * THE DOCUMENT A BAG'S RECORDS REST IN, in this composition (null: none named). Several documents may serve one bag
   * id over one mirror root (each face of a vessel mounts its own workbench document for an unshared wiki), so every
   * base this projector pins names the document it read, and a base that names another document vouches for nothing
   * here: its file stays, its row stays, and nothing writes over it (`otherDocument`).
   */
  readonly documentOf?: (bagId: string) => string | null;
  /**
   * THE HISTORY A BAG'S DOCUMENT HOLDS, in this composition (null: its store carries none). `heads` names where the
   * document stands now, and every base this projector pins carries them; `holds` answers whether the document still
   * holds a base's heads. A document that lacks them fell behind that agreement (`pastRecords`).
   */
  readonly lineageOf?: (bagId: string) => {
    readonly heads: readonly string[] | null;
    holds(heads: readonly string[]): boolean;
    /** No write landed in the document since it mounted: it reads exactly as it loaded. Absent reads false. */
    readonly quiet?: boolean;
  } | null;
  readonly recoveryFileFn?: (fields: Record<string, unknown>) => Promise<CarrierFile | null>;
  /**
   * Render a mirrored bag's OWN record of a carrier root — off that bag's records, never the resolved view. Present, an
   * ordinary mirror projects its own record where a higher layer shadows it (a same-title draft or personal row), and a
   * fresh start enumerates each mirror's own records, so a record whose change notice never reached the view (a crash
   * between its sealed write and the notification) still lands on disk. Absent, each mirror follows the resolved view.
   */
  readonly recordFileFn?: (bagId: string, tiddlerUri: string) => Promise<CarrierFile | null>;
  /**
   * The highest record of a carrier root across the composition, a tombstone included (`CompositeStore.get`). The own-record
   * pass reads it so a DELIBERATE deletion above a mirrored bag (a person's `shore remove`, a hand's delete) stays a
   * deletion: a tombstone on top shadows by intent, where a live draft or personal row shadows by accident.
   */
  readonly topRecordFn?: (tiddlerUri: string) => Promise<{ readonly meta?: { readonly deleted?: boolean } } | null>;
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
  /**
   * Where a bag stands in the island's composition (`composite.layerIndexOf`): higher answers higher, `-1` names
   * a bag the composition does not mount. The settle word reads it to tell a carrier a higher bag shadows from
   * one whose records have not reached the view yet. Absent, the word reads every other origin as not arrived.
   */
  readonly layerIndexOf?: (bagId: string) => number;
  /**
   * THE VIEW FOLLOWS HEADS. True where the wiki's view of `uri` has landed a record of `bagId` whose causal
   * heads include every head in `heads` (the island's landed ledger, read against the bag's document). A
   * settle word that names the heads its gesture landed reads the arrival here and not in the bytes alone, so
   * a view that moved past the named records still settles the word. Absent, the word follows the render
   * hash alone.
   */
  readonly viewHolds?: (bagId: string, uri: string, heads: readonly string[]) => boolean;
  /**
   * THE FAR SIDE CLOSES. A watch that resolves once the bag's document can receive nothing more from where
   * the named heads would come from (the island's last sync peer disconnected). A settle word that names
   * heads and waits for them ends on this event, naming the carriers that never arrived. `cancel` drops the
   * watch when the word ends first. Absent, only the arrival of the records, a later word or a stop ends a word.
   */
  readonly farSideClosed?: (bagId: string) => { readonly promise: Promise<void>; readonly cancel: () => void };
  /**
   * True where the island's own replica of the bag's document holds every named head. Heads the replica holds
   * reach the view through the island's own pipeline, whatever the link does, so a close never ends a word for
   * a carrier whose heads the replica holds: only heads the replica lacks fail to arrive. Absent, a close
   * reads every named head as absent.
   */
  readonly docHolds?: (bagId: string, heads: readonly string[]) => boolean;
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
  /** Fired once when a surfaced pending-removal set stops standing: it emptied, or its membership moved. */
  readonly onPendingRemovalResolved?: (info: { bagId: string; key: string }) => void;
  /**
   * THE `remove` ANSWER'S DOOR: the carrier family leaves the bag whose mirror lost its file (`bagId`), in that
   * bag's own layer (`shore-remove-door.ts`): a plain retract where no layer beneath holds the title, a kāpae in
   * that bag where one does. Absent → a `remove` answer refuses by name: this projector holds no delete door.
   */
  readonly removeCarrier?: (uri: string, bagId: string) => void | Promise<void>;
  /**
   * The layers beneath `bagId` in the composition that hold a live record of `uri` (`an unread layer` where one
   * stands unread), or null where the composition mounts no such bag. A `remove` over a title a lower layer holds
   * raises a kāpae, and asks a person's approval first. Absent → no layer beneath reads as holding anything.
   */
  readonly layersBeneath?: (bagId: string, uri: string) => Promise<readonly string[] | null>;
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
  /**
   * HEAD'S WORDS WHERE NO SYNCED BASE STANDS (`facePoolHeads`, face-pools A5). A re-found clears the Synced tree; a face
   * pool keeps its git history. For a carrier these records render and no base covers, HEAD's blob names the base: its
   * bytes the disk side, its canonical render the records side. Read only for records this projector renders, so a
   * record the house does not hold never gains a base. Absent → no history stands in for a base.
   */
  readonly baseFromGit?: BaseFromGit;
  /**
   * THE FILES A CHECKOUT NEVER TRACKED (`checkoutTracking`). Where the records drop a carrier whose file rests untracked
   * in a canon-sourced tree, that file holds the only copy: it stays, and an alert names its path and the cure (commit
   * it, or remove it by hand). A checkout git cannot read keeps the file too. The census reads the same port. Absent →
   * no file reads as an owed commit.
   */
  readonly untrackedAt?: CarrierTracking;
  /**
   * Vessel journal writer. When present, the projector appends one `bag-projected` entry per bag after
   * that bag's mirror first gains a carrier file on disk.
   */
  readonly journal?: VesselJournal;
  /**
   * Optional relay for bag-projected events when the writer sits outside this island.
   * Fired once per bag after the first carrier file stands on disk.
   */
  readonly onBagProjected?: (info: { bagId: string; path: string }) => void;
}
