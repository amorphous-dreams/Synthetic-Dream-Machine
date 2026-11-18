/**
 * shore-rig — one scratch vessel shore for the vectors that walk a person's act across the disk shore.
 *
 * The rig stands the REAL legs on a scratch directory: the ingest gesture (`scanSource`, `settleIngest`)
 * against the island's INGEST reactor over a booted wiki, and the disk projector with the congruences the
 * island wires (`mountDiskProjection`). A vessel "rests" when its projector stops and "boots" when a fresh
 * projector starts over the same records; a boot may open a fresh Synced tree, which names no base.
 *
 * Every path the rig writes sits under its own scratch directory. No clock paces it: each step awaits the
 * projector's own idle handshake.
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CompositeStore, VERB_RESULT_KEY, bagUri } from "@lararium/mesh";
import type { CapabilityAccess, CapabilityVerifyResult, Verb, VerbContext } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { VerbTable } from "../../lararium-tw5/src/verb-dispatcher.js";
import { registerActionReactors, makeTw5Deserializer } from "../../lararium-tw5/src/action-handler.js";
import { kahuHand } from "../../lararium-mesh/tests/kahu-reach-fixture.js";
import { TW5Engine } from "../../lararium-tw5/src/tw5-vm.js";
import { exportCarrierFile } from "../../lararium-tw5/src/meme-write.js";
import { canonicalizeCarrierText } from "../../lararium-tw5/src/carrier-canonical.js";
import { canonicalizeNativeCarrierText } from "../../lararium-tw5/src/native-canonical.js";
import LARES_MEMETIC_WIKITEXT_PLUGIN from "../../lararium-tw5/plugins/lares-memetic-wikitext.json" with { type: "json" };
import { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } from "../../lararium-tw5/src/generated-tw5-version.js";
import { candidatesOf, scanSource, settleIngest, type IngestSettlement, type ScanRow, type SubmitIngestOpts } from "../../lares-cli/src/ingest-core.js";
import type { SubmitResult } from "../../lares-cli/src/verb-result.js";
import { boundOutcomeOutput } from "../../lararium-tw5/src/verb-vm.js";
import { LarDiskProjector, type LarDiskProjectorOptions } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";

/** `bags/lares` is system canon: the suite stands as a Kahu hand (a counted admission AND a sentinel membership). */
const KAHU = await kahuHand();

const REPO = new URL("../../..", import.meta.url).pathname;
const CORE = path.join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
export const coreBlobSkip: false | string = existsSync(CORE)
  ? false
  : `TW5 core blob absent at ${CORE} — run: pnpm --filter @lararium/tw5 build:tw5-vendor`;

/** The one bag the rig mirrors. */
export const RIG_BAG = bagUri("lares");

/** The tracked directory whose carriers the rig copies in as its corpus (read only). */
const CORPUS_DIR = "bags/lares/ha.ka.ba/lares/api/pono";

const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });

type WikiShape = {
  Tiddler: new (...f: Array<Record<string, unknown>>) => unknown;
  wiki: {
    addTiddler(t: unknown): void;
    deleteTiddler(title: string): void;
    getTiddler(title: string): { fields: Record<string, unknown> } | undefined;
    allTitles(): string[];
    addEventListener(type: string, listener: (changes: Record<string, unknown>) => void): void;
    removeEventListener(type: string, listener: (changes: Record<string, unknown>) => void): void;
  };
};

export interface Surfaced { bagId: string; uri: string; reason: string; standoff: string }

export class ShoreRig {
  readonly scratch: string;
  readonly bagDir: string;
  readonly store = new MemoryTiddlerStore(RIG_BAG);
  readonly composite = new CompositeStore();
  readonly table = new VerbTable();
  readonly conflicts: Surfaced[] = [];
  readonly resolved: Array<{ bagId: string; uri: string; standoff: string }> = [];
  readonly refusals: string[] = [];
  readonly pendings: Array<Record<string, unknown>> = [];
  readonly pendingsResolved: Array<Record<string, unknown>> = [];
  /** The carrier addresses the rig copied in, smallest file first. */
  readonly uris: string[] = [];
  tree!: SyncedTree;
  projector!: LarDiskProjector;
  private stop: (() => Promise<void>) | null = null;
  private wave = 0;
  private treeNo = 0;

  private constructor(readonly engine: TW5Engine, count: number) {
    this.scratch = mkdtempSync(path.join(tmpdir(), "lar-shore-rig-"));
    this.bagDir = path.join(this.scratch, "bags", "lares");
    const src = path.join(REPO, CORPUS_DIR);
    const files = readdirSync(src).filter((f) => f.endsWith(".mem"))
      .sort((a, b) => statSync(path.join(src, a)).size - statSync(path.join(src, b)).size || a.localeCompare(b))
      .slice(0, count);
    for (const f of files) {
      const dest = path.join(this.bagDir, "ha.ka.ba/lares/api/pono", f);
      mkdirSync(path.dirname(dest), { recursive: true });
      cpSync(path.join(src, f), dest);
      this.uris.push(`lar:///ha.ka.ba/lares/api/pono/${f.slice(0, -".mem".length)}`);
    }
    this.composite.addLayer({ bagId: RIG_BAG, store: this.store, writable: true, defaultWritable: false });
    registerActionReactors(this.table, { kahuReach: KAHU, composite: this.composite, tw5: makeTw5Deserializer(engine) });
    this.newTree();
  }

  /** A rig over `count` tracked carriers, its wiki booted with the grammar plugin. */
  static async stand(count = 3): Promise<ShoreRig> {
    const engine = new TW5Engine();
    await engine.boot(new Uint8Array(readFileSync(CORE)), [LARES_MEMETIC_WIKITEXT_PLUGIN as unknown as Record<string, unknown>]);
    return new ShoreRig(engine, count);
  }

  private get $tw(): WikiShape { return this.engine.$tw as unknown as WikiShape; }

  /** A Synced tree that names no base: a fresh vessel's. */
  newTree(): SyncedTree {
    this.tree = new SyncedTree(path.join(this.scratch, "state", `synced-tree-${++this.treeNo}.json`));
    return this.tree;
  }

  fileOf(uri: string): string { return path.join(this.bagDir, `${uri.slice("lar:///".length)}.mem`); }
  read(uri: string): string { return readFileSync(this.fileOf(uri), "utf8"); }
  write(uri: string, text: string): void { mkdirSync(path.dirname(this.fileOf(uri)), { recursive: true }); writeFileSync(this.fileOf(uri), text, "utf8"); }
  remove(uri: string): void { rmSync(this.fileOf(uri), { force: true }); }
  stands(uri: string): boolean { return existsSync(this.fileOf(uri)); }

  /** Every file under the mirror, relative to it, sorted. */
  files(): string[] {
    return (readdirSync(this.bagDir, { recursive: true }) as string[])
      .filter((f) => statSync(path.join(this.bagDir, f)).isFile())
      .map((f) => f.split(path.sep).join("/")).sort();
  }

  /**
   * ONE WAVE AGAINST THE ISLAND'S INGEST REACTOR, as the daemon answers it: the args the gesture sends, the
   * reactor's own decision per carrier, and the outcome's row cap over the answer.
   */
  readonly submitWave = async (o: SubmitIngestOpts): Promise<SubmitResult> => {
    const requestId = `req-rig-${++this.wave}`;
    const args: Record<string, unknown> = {
      "source-uri": `file://${o.source}`, "to-bag": o.toBag, "change-id": `rig-${this.wave}`,
      carriers: o.candidates.map((r) => ({
        uri: r.uri, file: r.file, size: Buffer.byteLength(r.text, "utf8"), diskHash: r.diskHash, syncedHash: r.syncedHash,
        ...(r.syncedRecordsHash !== undefined ? { syncedRecordsHash: r.syncedRecordsHash } : {}),
        ext: r.ext, text: r.text, ...(r.meta !== undefined ? { meta: r.meta } : {}),
      })),
      ...(o.deletions && o.deletions.length > 0 ? { deletions: o.deletions.map((d) => ({ uri: d.uri, syncedHash: d.syncedHash })) } : {}),
      ...(o.unattended === true ? { unattended: true } : {}),
    };
    const invocation: Verb = {
      requestId, title: `lar:///lararium.local.vm/verbs/${requestId}`, action: "INGEST", args, targets: [], batchMode: "best-effort",
      status: "pending", requestedBy: "operator-test", requestedAt: "2026-10-13T00:00:00Z",
    };
    const ctx: VerbContext = { daemon: this.composite, invocation, cap: allowCap };
    const result = await this.table.get("INGEST")!(args, ctx) as Record<string, unknown>;
    return { status: "done", requestId, results: { [VERB_RESULT_KEY]: { ok: true, output: boundOutcomeOutput(result) } } } as SubmitResult;
  };

  /**
   * THE INGEST GESTURE over the whole mirror (or one file), against the island's reactor; then the wave
   * lands in the wiki. `unattended` sends it as a watcher's wave: no person stands behind it.
   */
  async ingest(source: string = this.bagDir, opts: { readonly unattended?: boolean } = {}): Promise<IngestSettlement & { scanned: ScanRow[] }> {
    const scan = scanSource(this.scratch, source, RIG_BAG, this.tree)!;
    const candidates = candidatesOf(scan.rows);
    const settled = await settleIngest({
      source, toBag: RIG_BAG, candidates, did: "did:test",
      ...(scan.renameDeletions && scan.renameDeletions.length > 0 ? { deletions: scan.renameDeletions } : {}),
      ...(opts.unattended === true ? { unattended: true } : {}),
    }, this.tree, this.submitWave);
    await this.land();
    return { ...settled, scanned: scan.rows };
  }

  /**
   * THE WIKI'S OWN CHANGE HANDSHAKE. TW5 dispatches `change` in a later turn than the write. The rig arms
   * a listener BEFORE it writes and waits for that dispatch, so the projector's queue holds the marks
   * before the rig asks it for idle. No span of time stands in for the dispatch.
   */
  private async written(write: () => number | void | Promise<number | void>): Promise<void> {
    const $tw = this.$tw;
    let seen!: () => void;
    const dispatched = new Promise<void>((resolve) => { seen = resolve; });
    const listener = (): void => { seen(); };
    $tw.wiki.addEventListener("change", listener);
    try {
      const writes = await write();
      if (writes !== 0) await dispatched;
    } finally {
      $tw.wiki.removeEventListener("change", listener);
    }
    await this.idle();
  }

  /** A WAVE LANDS: the wiki comes to hold what the bag's store holds, each record stamped with its bag. */
  async land(): Promise<void> {
    const $tw = this.$tw;
    await this.written(async () => {
      let writes = 0;
      const live = new Set(await this.store.listVisible());
      for (const title of $tw.wiki.allTitles()) {
        if ($tw.wiki.getTiddler(title)?.fields["$origin-bag"] === RIG_BAG && !live.has(title)) { $tw.wiki.deleteTiddler(title); writes++; }
      }
      for (const title of live) {
        const rec = await this.store.get(title);
        if (!rec || rec.meta?.deleted) continue;
        $tw.wiki.addTiddler(new $tw.Tiddler(rec.tiddler as Record<string, unknown>, { "$origin-bag": RIG_BAG }));
        writes++;
      }
      return writes;
    });
  }

  /** A HAND IN THE WIKI: replace one tiddler's text. */
  async save(title: string, text: string): Promise<void> {
    const $tw = this.$tw;
    const held = $tw.wiki.getTiddler(title);
    if (!held) throw new Error(`rig: the wiki holds no ${title}`);
    await this.written(() => { $tw.wiki.addTiddler(new $tw.Tiddler(held.fields, { text })); });
  }

  titlesOf(uri: string): string[] {
    return this.$tw.wiki.allTitles().filter((t) => t === uri || t.startsWith(`${uri}#`));
  }

  /** THE VESSEL BOOTS: a fresh projector starts over the records the wiki holds, wired as the island wires it. */
  async boot(opts: { freshTree?: boolean; extra?: Partial<LarDiskProjectorOptions> } = {}): Promise<void> {
    if (this.stop) throw new Error("rig: the vessel already stands");
    if (opts.freshTree) this.newTree();
    const deserializer = makeTw5Deserializer(this.engine);
    this.projector = new LarDiskProjector({
      mirrors: [{ bagId: RIG_BAG, mirrorRoot: this.bagDir }],
      carrierFileFn: (uri) => { try { return Promise.resolve(exportCarrierFile(this.engine, uri)); } catch { return Promise.resolve(null); } },
      canonicalizeFn: canonicalizeCarrierText,
      canonicalizeNativeFn: (uri, ext, body, meta) => canonicalizeNativeCarrierText(deserializer, uri, ext, body, meta),
      syncedTree: this.tree,
      onConflict: (info) => { this.conflicts.push(info as Surfaced); },
      onConflictResolved: (info) => { this.resolved.push(info); },
      onRefusal: (info) => { this.refusals.push(`${info.uri}: ${info.reason}`); },
      ...({
        onPendingRemoval: (info: Record<string, unknown>) => { this.pendings.push(info); },
        onPendingRemovalResolved: (info: Record<string, unknown>) => { this.pendingsResolved.push(info); },
        removeCarrier: (uri: string) => this.wikiDelete(uri),
      } as Partial<LarDiskProjectorOptions>),
      ...(opts.extra ?? {}),
    });
    this.stop = this.projector.start(this.engine);
    await this.idle();
  }

  async idle(): Promise<void> {
    if (!this.stop) return;
    await this.projector.idle();
  }

  /**
   * A HAND'S DELETE IN THE WIKI, as the wiki shore carries it: the root leaves the wiki, the shore's adaptor
   * removes its slot children and lands each tombstone. The rig holds one bag and no working layer, so the
   * tombstones land in that bag; the layer a tombstone lands in belongs to the adaptor's own vectors.
   */
  readonly removed: string[] = [];
  async wikiDelete(uri: string): Promise<void> {
    this.removed.push(uri);
    // The dispatch alone gets awaited here: the projector calls this door from inside its own answer, and
    // that answer waits for the queue itself.
    const $tw = this.$tw;
    let seen!: () => void;
    const dispatched = new Promise<void>((resolve) => { seen = resolve; });
    const listener = (): void => { seen(); };
    $tw.wiki.addEventListener("change", listener);
    try {
      const titles = this.titlesOf(uri);
      for (const title of titles) {
        $tw.wiki.deleteTiddler(title);
        await this.store.tombstone(title, { kind: "lares-verb", requestId: `rig-delete-${this.removed.length}` });
      }
      if (titles.length > 0) await dispatched;
    } finally {
      $tw.wiki.removeEventListener("change", listener);
    }
  }

  /** THE VESSEL RESTS: its projector stops; the disk and the records stay as they stand. */
  async rest(): Promise<void> {
    if (!this.stop) return;
    const stop = this.stop;
    this.stop = null;
    await stop();
  }

  async close(): Promise<void> {
    await this.rest();
    rmSync(this.scratch, { recursive: true, force: true });
  }
}
