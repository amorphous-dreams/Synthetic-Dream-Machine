/** Private local recognition memory for causal Handle publications. */
import {
  foldHandleCardsDetailed, verifyHandleCard, type HandleCard, type CardVerdict,
} from "./handle-card.js";
import type { OwnerHeadResolver } from "./handle-kel.js";

export interface HandleRecord {
  readonly nym: string;
  /** A settled projection, or null while the local frontier is unsettled. */
  readonly card: HandleCard | null;
  readonly heads: readonly string[];
  /** Accepted causal closure retained so later forks cannot hide behind pruning. */
  readonly accepted: readonly HandleCard[];
  readonly petname: string | null;
  /**
   * The faces of this vessel that recognised the nym, each beside that face's own label. A face's backup bundle
   * carries the records its own key tags here, each under that face's label, and nothing of another face's. A
   * record that names no face stays on its vessel and enters no bundle (custody#/the-table).
   */
  readonly recognisedBy?: readonly HandleRecognition[];
}

/** One face's recognition of a nym: the face's root key (64 lower hex) and that face's own label for the nym. */
export interface HandleRecognition { readonly face: string; readonly petname: string | null }

const FACE_KEY = /^[0-9a-f]{64}$/;
/** Read a face's key as a tag: lower hex, 64 characters, with or without a leading `0x`. Throws on any other spelling. */
function faceTag(face: string): string {
  const key = face.trim().toLowerCase().replace(/^0x/, "");
  if (!FACE_KEY.test(key)) throw new TypeError("handle-book: a recognising face reads as a 64-hex root key");
  return key;
}
/** The recognitions an untrusted record carries, each read for shape; a record with none answers undefined. */
function readRecognitions(raw: unknown): HandleRecognition[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: HandleRecognition[] = [];
  for (const one of raw as unknown[]) {
    const r = one as Partial<HandleRecognition> | null;
    if (!r || typeof r !== "object" || typeof r.face !== "string" || !FACE_KEY.test(r.face)) continue;
    if (out.some((kept) => kept.face === r.face)) continue;
    out.push({ face: r.face, petname: typeof r.petname === "string" ? r.petname : null });
  }
  return out.length > 0 ? out : undefined;
}
/** `held`'s recognitions with `face` among them: a face already named keeps its label. */
function tagged(held: readonly HandleRecognition[] | undefined, face: string): HandleRecognition[] {
  const all = [...(held ?? [])];
  if (!all.some((r) => r.face === face)) all.push({ face, petname: null });
  return all;
}

/** Explicit early-alpha snapshot era; old scalar books are dropped on load. */
export const HANDLE_BOOK_SNAPSHOT_ERA = "causal-handle-book-1" as const;

export interface HandleBookSnapshot {
  readonly era?: string;
  readonly records: readonly HandleRecord[];
}

/** The `recognisedBy` field of a record, present only where a face tagged it. */
const withRecognitions = (all: readonly HandleRecognition[] | undefined): { recognisedBy?: readonly HandleRecognition[] } =>
  (all && all.length > 0 ? { recognisedBy: all } : {});

export class HandleBook {
  private readonly records = new Map<string, HandleRecord>();

  /**
   * A snapshot is untrusted input. The synchronous constructor intentionally ignores it so a parsed JSON
   * object can never mint recognition merely by being passed to `new HandleBook(snapshot)`. Use `restore` or
   * `hydrate` after crossing the asynchronous verification boundary.
   */
  constructor(snapshot?: HandleBookSnapshot) {
    void snapshot;
  }

  /** Rehydrate only records whose accepted closure and projection verify afresh. */
  static async restore(snapshot: HandleBookSnapshot | unknown, ownerHeadResolver?: OwnerHeadResolver): Promise<HandleBook> {
    const book = new HandleBook();
    if (!snapshot || typeof snapshot !== "object") return book;
    const candidate = snapshot as Partial<HandleBookSnapshot>;
    if (candidate.era !== HANDLE_BOOK_SNAPSHOT_ERA || !Array.isArray(candidate.records)) return book;

    for (const raw of candidate.records) {
      if (!raw || typeof raw !== "object") continue;
      const record = raw as HandleRecord;
      if (typeof record.nym !== "string" || !Array.isArray(record.accepted)) continue;
      const accepted = record.accepted.filter((card): card is HandleCard =>
        !!card && typeof card === "object" && (card as HandleCard).nym === record.nym);
      if (accepted.length !== record.accepted.length) continue;
      const folded = await foldHandleCardsDetailed(accepted, ownerHeadResolver);
      if (folded.status === "rejected" || folded.status === "unavailable") continue;
      book.records.set(record.nym, {
        nym: record.nym,
        card: folded.card,
        heads: folded.heads,
        accepted: folded.cards,
        petname: typeof record.petname === "string" || record.petname === null ? record.petname : null,
        ...withRecognitions(readRecognitions((record as { recognisedBy?: unknown }).recognisedBy)),
      });
    }
    return book;
  }

  /**
   * Take a card into the book. `ownerHeadResolver` names the owners' heads: without it the book trusts a
   * chain's inception alone, and a card over a chain carrying any later step answers
   * `handle-rotation-unverified` (a stranger's appended rotation reads structurally whole, so structure proves nothing).
   *
   * `by` names the face that recognises: its root key tags the record once the card lands. A card that refuses
   * tags nothing.
   */
  async ingest(card: HandleCard, ownerHeadResolver?: OwnerHeadResolver, by?: string): Promise<CardVerdict> {
    const face = by === undefined ? undefined : faceTag(by);
    const held = this.records.get(card.nym);
    const self = await verifyHandleCard(card, ownerHeadResolver);
    if (!self.ok) return self;
    const accepted = [...(held?.accepted ?? []), card];
    const folded = await foldHandleCardsDetailed(accepted, ownerHeadResolver);
    if (folded.status === "rejected") return { ok: false, reject: "rejected" };
    // A descendant with an absent ancestor must not be retained as if it were recognition. The caller can
    // retry it after the missing parent arrives; this keeps persistence and arrival order equivalent.
    if (folded.status === "unavailable") return { ok: false, reject: "unavailable" };
    this.records.set(card.nym, {
      nym: card.nym,
      card: folded.card,
      heads: folded.heads,
      accepted: folded.cards,
      petname: held?.petname ?? null,
      ...withRecognitions(face === undefined ? held?.recognisedBy : tagged(held?.recognisedBy, face)),
    });
    return folded.status === "held"
      ? { ok: true, nym: card.nym }
      : { ok: false, reject: "unsettled" };
  }

  get(nym: string): HandleRecord | undefined { return this.records.get(nym); }
  /** Recognition requires a verified, uniquely settled projection, not merely a remembered nym. */
  isRecognized(nym: string): boolean {
    const record = this.records.get(nym);
    return record?.card !== null && record?.card !== undefined && record.heads.length === 1 &&
      record.heads[0] === record.card.actCid && record.accepted.some((card) => card.actCid === record.card!.actCid);
  }
  /** Label a nym. `by` names the face that labels: the label also rests under that face's own tag. */
  setPetname(nym: string, petname: string | null, by?: string): boolean {
    const r = this.records.get(nym);
    if (!r) return false;
    const face = by === undefined ? undefined : faceTag(by);
    const recognisedBy = face === undefined ? r.recognisedBy
      : tagged(r.recognisedBy, face).map((one) => (one.face === face ? { face, petname } : one));
    this.records.set(nym, { nym: r.nym, card: r.card, heads: r.heads, accepted: r.accepted, petname, ...withRecognitions(recognisedBy) });
    return true;
  }
  nyms(): string[] { return [...this.records.keys()]; }
  snapshot(): HandleBookSnapshot { return { era: HANDLE_BOOK_SNAPSHOT_ERA, records: [...this.records.values()] }; }
  /**
   * ONE FACE'S OWN RECORDS: every record `face` recognised, each under that face's own label and naming no
   * other face. A record no face tagged enters no such snapshot.
   */
  snapshotFor(face: string): HandleBookSnapshot {
    const key = faceTag(face);
    const records: HandleRecord[] = [];
    for (const r of this.records.values()) {
      const mine = r.recognisedBy?.find((one) => one.face === key);
      if (mine) records.push({ nym: r.nym, card: r.card, heads: r.heads, accepted: r.accepted, petname: mine.petname, recognisedBy: [mine] });
    }
    return { era: HANDLE_BOOK_SNAPSHOT_ERA, records };
  }
  /**
   * LAND ONE FACE'S RECORDS ADDITIVELY (a restore). Each record verifies afresh, as a restored snapshot does. A
   * nym this book holds keeps its cards, its heads and its label, and gains `face`'s tag where it carried none;
   * a nym it lacks lands under `face`'s tag and label. Answers how many records landed new and how many it kept.
   */
  async landFor(face: string, snapshot: HandleBookSnapshot | unknown, ownerHeadResolver?: OwnerHeadResolver): Promise<{ readonly landed: number; readonly kept: number }> {
    const key = faceTag(face);
    const carried = await HandleBook.restore(snapshot, ownerHeadResolver);
    let landed = 0, kept = 0;
    for (const r of carried.records.values()) {
      const label = r.recognisedBy?.find((one) => one.face === key)?.petname ?? r.petname;
      const held = this.records.get(r.nym);
      if (held) {
        kept++;
        if (!held.recognisedBy?.some((one) => one.face === key)) this.records.set(r.nym, { ...held, recognisedBy: [...(held.recognisedBy ?? []), { face: key, petname: label }] });
        continue;
      }
      landed++;
      this.records.set(r.nym, { nym: r.nym, card: r.card, heads: r.heads, accepted: r.accepted, petname: label, recognisedBy: [{ face: key, petname: label }] });
    }
    return { landed, kept };
  }
}
