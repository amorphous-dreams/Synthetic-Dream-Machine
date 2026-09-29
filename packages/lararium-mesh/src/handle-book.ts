/** Private local recognition memory for causal Handle publications. */
import {
  foldHandleCardsDetailed, verifyHandleCard, type HandleCard, type CardVerdict,
} from "./handle-card.js";

export interface HandleRecord {
  readonly nym: string;
  /** A settled projection, or null while the local frontier is unsettled. */
  readonly card: HandleCard | null;
  readonly heads: readonly string[];
  /** Accepted causal closure retained so later forks cannot hide behind pruning. */
  readonly accepted: readonly HandleCard[];
  readonly petname: string | null;
}

/** Explicit early-alpha snapshot era; old scalar books are dropped on load. */
export const HANDLE_BOOK_SNAPSHOT_ERA = "causal-handle-book-1" as const;

export interface HandleBookSnapshot {
  readonly era?: string;
  readonly records: readonly HandleRecord[];
}

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
  static async restore(snapshot: HandleBookSnapshot | unknown): Promise<HandleBook> {
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
      const folded = await foldHandleCardsDetailed(accepted);
      if (folded.status === "rejected" || folded.status === "unavailable") continue;
      book.records.set(record.nym, {
        nym: record.nym,
        card: folded.card,
        heads: folded.heads,
        accepted: folded.cards,
        petname: typeof record.petname === "string" || record.petname === null ? record.petname : null,
      });
    }
    return book;
  }

  /** Alias for callers that name the persistence boundary `hydrate`. */
  static hydrate(snapshot: HandleBookSnapshot | unknown): Promise<HandleBook> {
    return HandleBook.restore(snapshot);
  }

  async ingest(card: HandleCard): Promise<CardVerdict> {
    const held = this.records.get(card.nym);
    const self = await verifyHandleCard(card);
    if (!self.ok) return self;
    const accepted = [...(held?.accepted ?? []), card];
    const folded = await foldHandleCardsDetailed(accepted);
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
  setPetname(nym: string, petname: string | null): boolean {
    const r = this.records.get(nym);
    if (!r) return false;
    this.records.set(nym, { ...r, petname });
    return true;
  }
  nyms(): string[] { return [...this.records.keys()]; }
  snapshot(): HandleBookSnapshot { return { era: HANDLE_BOOK_SNAPSHOT_ERA, records: [...this.records.values()] }; }
}
