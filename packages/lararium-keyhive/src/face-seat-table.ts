/**
 * face-seat-table — the daemon island's content-key seats, ONE ENTRY PER FACE, and the route a session's ask takes to one.
 *
 * EACH HAT ITS OWN CHAIN (the hats: worn = the default reach · lit = reachable by name · shut = silent). Every face the
 * island holds open owns one entry: its content-key seat (its own holder over its own Keyhive identity), the vessel's
 * verified chain of THAT face and the vessel's fold of THAT face's fleet board. No entry lends another its chain, its
 * holder or its counted raises, and no delegation stands between them: unlocking a face IS the grant.
 *
 *   · A SESSION'S ASK ROUTES BY THE FACE THE VESSEL NAMES. The vessel's book answers the session's chain and names a lit
 *     sibling's `face` beside it (session-sign-book); a reading naming none wears the mounted face. A reading naming a face
 *     this island holds no entry for (shut, never lit, dropped) refuses `face-not-open` on its own; every other face keeps
 *     sealing. Only the entry the session wears takes the reading's chain and fold.
 *   · THE SESSION WEARS ITS ENTRY'S FACE. Its proof subject equals the subject of the vessel's chain at the session's anchor,
 *     or the ask refuses `session-face-foreign`.
 *   · AN OPEN ROUTES BY THE FACE ITS BAG WEARS (the vessel names it); an entry that read no chain yet asks the vessel for
 *     its own (`own(face)`).
 *   · CLOSING A FACE DROPS ITS ENTRY WHOLE: the seat locks (every key overwritten, its roll unsubscribed), and the chain and
 *     fold leave with it.
 *   · A MOUNTED-ONLY VERB (`reach: "mounted"`) never takes a sibling's session: it refuses `content-mounted-only`.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import { answerDocStoreAsks } from "@lararium/mesh/sealed-rest";
import { type RecordSigner } from "@lararium/mesh/sealed-records";
import { type SessionOwnChain } from "@lararium/mesh/island-protocol";
import type { ContentKeySeat } from "./content-key-seat.js";
import { chainSubjectAt, type IslandSessionProof, type SessionAsk } from "./island-session-proof.js";

/** One face's entry: its content-key seat and the vessel's reading of that face (its chain and its fold). */
export interface FaceSeat {
  /** The face's bare atom key; null for the mounted face's entry. */
  readonly face: string | null;
  seat: ContentKeySeat | null;
  chain: SessionOwnChain | null;
  counted: ReadonlySet<string>;
  unanswered: readonly string[];
}

/** Which faces a verb reaches: the document store's door reaches every lit face; a `sealed-*` verb the mounted one alone. */
export type FaceReach = "lit" | "mounted";

export interface FaceSeatTable {
  /** The mounted face's entry. */
  readonly mounted: FaceSeat;
  /** Route the session that placed `ask`: the entry it wears and its signer, or a refusal by name. */
  session(verb: string, ask: SessionAsk | null, reach?: FaceReach): Promise<{ readonly signer: RecordSigner; readonly face: FaceSeat }>;
  /** Read the vessel's own chain and fold of one face (the mounted face's by default) for an act no session asked. */
  own(verb: string, face?: FaceSeat): Promise<void>;
  /** The entry a hydration's open reads: the lit face it names, else the mounted face. */
  openSeat(face?: string): Promise<FaceSeat>;
  /** Light a sibling face's entry beside the mounted one, by its bare atom key, over its own seat. */
  light(face: string, seat: ContentKeySeat | null): FaceSeat;
  /** The lit sibling's entry, or none. */
  lit(face: string): FaceSeat | undefined;
  /** Close a sibling face: its seat locks and its entry leaves with its chain and its fold. */
  drop(face: string): void;
  /** THE DOCUMENT STORE'S DOOR, island side (`answerDocStoreAsks`): the vessel's Repo seals each save under the session that
   *  booked its change, through the entry that session wears, and opens each value through the entry its face names. */
  docStoreHolder(): Parameters<typeof answerDocStoreAsks>[1];
}

const bare = (s: string): string => s.trim().toLowerCase().replace(/^0x/, "");

/** A seat that once rolled refuses where the vessel read no fold (`fold-unread`). */
async function foldOrRefuse(verb: string, entry: FaceSeat, foldRead: boolean): Promise<void> {
  if (foldRead || !entry.seat) return;
  if ((await entry.seat.holder.holdsRemoval()) === false) return;
  throw new VerbRefusal("fold-unread", `[daemon] ${verb}: fold-unread — this vessel read no fold of the face's fleet board, and this seat once rolled; nothing sealed, nothing opened.`);
}

const faceNotOpen = (verb: string, face: string): VerbRefusal =>
  new VerbRefusal("face-not-open", `[daemon] ${verb}: face-not-open — face ${face.slice(0, 12)}… stands shut on this island; nothing sealed, nothing opened.`);

export function faceSeatTable(opts: { readonly proof: () => IslandSessionProof | undefined }): FaceSeatTable {
  const mounted: FaceSeat = { face: null, seat: null, chain: null, counted: new Set(), unanswered: [] };
  const siblings = new Map<string, FaceSeat>();
  const take = (entry: FaceSeat, read: { readonly chain: SessionOwnChain; readonly counted: readonly string[]; readonly unanswered: readonly string[] }): void => {
    entry.chain = read.chain;
    entry.counted = new Set(read.counted);
    entry.unanswered = [...read.unanswered];
  };
  const stands = (entry: FaceSeat): boolean => entry.face === null || siblings.get(entry.face) === entry;
  const own = async (verb: string, entry: FaceSeat = mounted): Promise<void> => {
    const proof = opts.proof();
    const read = entry.face === null ? await proof?.own?.() : await proof?.own?.(entry.face);
    if (!read || "refusal" in read) return;
    // The entry closed while the vessel answered: its reading lands nowhere.
    if (!stands(entry)) return;
    take(entry, read);
    await foldOrRefuse(verb, entry, read.foldRead);
  };
  const table: FaceSeatTable = {
    mounted,
    async session(verb, ask, reach = "mounted") {
      const proof = opts.proof();
      const reading = proof && ask ? await proof.signer(ask) : { refusal: "signer-unavailable" } as const;
      if ("refusal" in reading) throw new VerbRefusal(reading.refusal, `[daemon] ${verb}: ${reading.refusal} — nothing sealed, nothing opened.`);
      let entry = mounted;
      if (reading.face !== undefined) {
        if (reach === "mounted") {
          throw new VerbRefusal("content-mounted-only", `[daemon] ${verb}: this verb runs on the mounted face's content keys; a sibling's session holds none here.`);
        }
        const lit = siblings.get(bare(reading.face));
        if (lit === undefined) throw faceNotOpen(verb, bare(reading.face));
        entry = lit;
      }
      if (reading.subject !== chainSubjectAt(reading.signer.certificate, reading.chain)) {
        throw new VerbRefusal("session-face-foreign", `[daemon] ${verb}: session-face-foreign — the session wears another face than this island holds; nothing sealed, nothing opened.`);
      }
      // The entry closed while the vessel answered: nothing seals through it.
      if (!stands(entry)) throw faceNotOpen(verb, entry.face ?? "");
      take(entry, reading);
      await foldOrRefuse(verb, entry, reading.foldRead);
      return { signer: reading.signer, face: entry };
    },
    own,
    light(face, seat) {
      const key = bare(face);
      const was = siblings.get(key);
      if (was !== undefined && was.seat === seat) return was;
      if (was !== undefined) table.drop(key);
      const entry: FaceSeat = { face: key, seat, chain: null, counted: new Set(), unanswered: [] };
      siblings.set(key, entry);
      return entry;
    },
    lit: (face) => siblings.get(bare(face)),
    drop(face) {
      const key = bare(face);
      const entry = siblings.get(key);
      if (!entry) return;
      siblings.delete(key);
      const seat = entry.seat;
      entry.seat = null; entry.chain = null; entry.counted = new Set(); entry.unanswered = [];
      seat?.lock();
    },
    async openSeat(face) {
      const entry = face === undefined ? mounted : siblings.get(bare(face));
      if (entry === undefined) throw faceNotOpen("docstore-open", bare(face ?? ""));
      if (entry.chain === null) await own("docstore-open", entry);
      return entry;
    },
    docStoreHolder() {
      return {
        // THE MOUNTED HOLDER STANDS FIRST: with none, no face's seat stands (a sibling's seats only beside it), and the ask
        // refuses before any round trip to the vessel.
        seal: async ({ bagId, values, ask, peer }) => {
          if (!mounted.seat) return { refusal: "sealed-store-unavailable" } as never;
          const { signer, face } = await table.session(ask.verb, { requestId: ask.requestId, verb: ask.verb }, "lit");
          if (!face.seat) return { refusal: face === mounted ? "sealed-store-unavailable" : "holder-locked" } as never;
          return face.seat.sealValues({ bagId, values, signer, ...(peer !== undefined ? { peer } : {}) });
        },
        // A hydration's open may come before any session asked: the entry reads the vessel's own chain of its face first.
        open: async ({ face, ...args }) => {
          if (!mounted.seat) return { refusal: "holder-locked" } as never;
          const entry = await table.openSeat(face);
          if (!entry.seat) return { refusal: "holder-locked" } as never;
          return entry.seat.holder.openValue(args);
        },
        // THE VESSEL LOCKED (P2-2): every seat overwrites every content key now, not at the identity's dispose, so no seal
        // and no open answers past the lock; the siblings' entries close with it.
        lock: () => {
          const seat = mounted.seat; mounted.seat = null; seat?.lock();
          for (const face of [...siblings.keys()]) table.drop(face);
        },
      };
    },
  };
  return table;
}

/**
 * A SIBLING'S SEAT STANDS, OR ITS ENTRY LEAVES WITH ITS IDENTITY: the entry lights, the cleanup that drops it registers on the
 * identity, and only then the seat stands. A seat that throws leaves the entry half-made, and the light's catch disposes the
 * identity, which drops it (only while the table still holds that very entry).
 */
export function standSiblingEntry(table: Pick<FaceSeatTable, "light" | "lit" | "drop">, key: string, identity: { whenDisposed(fn: () => void): void }, seatOf: (entry: FaceSeat) => ContentKeySeat): FaceSeat {
  const entry = table.light(key, null);
  identity.whenDisposed(() => { if (table.lit(key) === entry) table.drop(key); });
  entry.seat = seatOf(entry);
  return entry;
}
