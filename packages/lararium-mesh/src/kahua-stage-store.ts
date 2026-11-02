/**
 * kahua-stage-store — the store a recipe layer mounts for a face's kahua stage: it reads the FOLD, never the doc's titles.
 *
 * Every member of the face syncs the stage doc and any of them can write any tiddler into it. So this store reads no
 * tiddler by title: on every read it folds the doc's act records through `readKahuaStage` under the face's grant and
 * serves the standing items (`kahuaItemTiddlers`) and nothing else. A plain tiddler, a hand edit over a lifted title, a
 * projected item another device wrote, an act another face signed or an act no grant holds reads as absent. Siblings
 * read as siblings on every device, since the fold, never a CRDT pick over one title, decides them.
 *
 * Two fences sit before the fold. The doc must stand at the face's derived stage url (`kahuaStageDocUrl`): a catalog row
 * names where to mount, never what to trust, so a row pointing at a copy that drops a withdraw reads nothing. And the
 * face must read (`face()` answers its group and grant): no face, no stage.
 *
 * The store takes no write: a lift lands through the kahua door alone, as a signed act.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import type { DocHandle } from "@automerge/automerge-repo";
import type { LarDoc } from "./base-doc.js";
import { kahuaActRecords, kahuaItemTiddlers, kahuaStageDocUrl, readKahuaStage, type KahuaFoldFace } from "./kahua-stage.js";
import type { ChangeOrigin, LarTiddlerChange, LarTiddlerRecord, LarTiddlerStore } from "./tiddler-store.js";

/** The face a stage reads under: its group, the current roster every standing act's signer holds, the epoch rosters history reads. */
export type KahuaStageFace = KahuaFoldFace;

export class KahuaStageWriteRefusal extends Error {
  override name = "KahuaStageWriteRefusal";
  constructor(title: string) { super(`kahua-stage-read-only: "${title}" lands on the kahua stage only by a signed lift through the kahua door`); }
}

export interface KahuaStageStore extends LarTiddlerStore {
  /** Tell every subscriber each standing item, once. */
  emitInitialReplay(): void;
  markSyncComplete(): void;
}

type Items = ReadonlyMap<string, LarTiddlerRecord>;

const sameRecord = (a: LarTiddlerRecord | undefined, b: LarTiddlerRecord | undefined): boolean =>
  JSON.stringify(a?.tiddler ?? null) === JSON.stringify(b?.tiddler ?? null);

export function kahuaStageStore(opts: {
  readonly handle: DocHandle<LarDoc>;
  readonly bagId?: string;
  /** The face this stage reads under, read at each fold; null where no face stands. */
  readonly face: () => KahuaStageFace | null;
}): KahuaStageStore {
  const { handle } = opts;
  const items = (): Items => {
    const face = opts.face();
    if (!face || handle.url !== kahuaStageDocUrl(face.group)) return new Map();
    const reading = readKahuaStage(kahuaActRecords(handle.doc(), face.group), face);
    const out = new Map<string, LarTiddlerRecord>();
    for (const [title, fields] of Object.entries(kahuaItemTiddlers(reading))) {
      out.set(title, Object.freeze({ tiddler: Object.freeze({ ...fields, title }) }) as LarTiddlerRecord);
    }
    return out;
  };
  const listeners = new Set<(change: LarTiddlerChange) => void>();
  const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: opts.bagId ?? "kahua" };
  const tell = (title: string, record: LarTiddlerRecord | null): void => {
    const change: LarTiddlerChange = { title, record, origin, ...(opts.bagId !== undefined ? { bag: opts.bagId } : {}) };
    for (const fn of listeners) fn(change);
  };
  // Each doc change re-folds; subscribers hear the items whose verified reading moved, and nothing a raw write alone touched.
  let told: Items = items();
  const onChange = (): void => {
    if (listeners.size === 0) { told = items(); return; }
    const next = items();
    for (const [title, record] of next) if (!sameRecord(told.get(title), record)) tell(title, record);
    for (const title of told.keys()) if (!next.has(title)) tell(title, null);
    told = next;
  };
  handle.on("change", onChange);
  const refuse = async (title: string): Promise<never> => { throw new KahuaStageWriteRefusal(title); };

  return {
    async listVisible() { return [...items().keys()]; },
    async get(title) { return items().get(title) ?? null; },
    async getHeads() { return null; },
    put: (record) => refuse(record.tiddler.title),
    tombstone: (title) => refuse(title),
    remove: (title) => refuse(title),
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    emitInitialReplay() {
      told = items();
      for (const [title, record] of told) tell(title, record);
    },
    markSyncComplete() { /* the fold reads the doc as it stands; no pending wave to settle */ },
  };
}
