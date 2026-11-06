/**
 * sealed-rest — the composer that sets the document store's sealed rest under a vessel's Repo, the book of which
 * session wrote each document's change, and the door between the vessel's thread and its daemon island.
 *
 * WHICH BAGS REST SEALED (sealed-store#/owed, R1). Every wiki content store rests sealed: a private bag under its bag's
 * content key. Cleartext rests only in the disk projection and in the live wiki in memory. The vessel's bag map names
 * each document's bag and that bag's face; a document the map names no bag for passes to the inner rest unchanged.
 *
 * WHO SIGNS A SAVE THE REPO MAKES ON ITS OWN TIMER (R2): "a session signs or nothing mints". Every change books the
 * session that wrote it (`SaveBook.book`), and the store's save signs under that booked session. A lock flushes the
 * Repo and the store (every pending save lands sealed) before it drops any booking, any signer or any key
 * (`SealedRest.lock`). A save no session booked refuses `save-unbooked` and stays in memory; the next session that
 * books its document seals it (`SealedRest.rebook`).
 *
 * THE DOOR CARRIES A BODY AND A SEALED VALUE, NEVER A KEY. The Repo stands on the vessel's thread and the content-key
 * holder in its daemon island. A seal crosses as `docstore:seal` (the values, and the ask the vessel booked in its
 * session sign book so the island signs through that session) and answers addresses; an open crosses as
 * `docstore:open` and answers the body and the face whose session signed its manifest. The island asks the vessel
 * for a bag's live document (`docstore:live`) to cut a from-now admission's fresh base. These messages answer on the
 * port alone: no outcome rests in any document.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import * as A from "@automerge/automerge";
import type { Chunk, Repo, StorageAdapterInterface } from "@automerge/automerge-repo";
import type { DocumentValue, HolderRefusal, OpenedValue } from "./content-key-holder.js";
import { readSealedAddress } from "./sealed-chunk.js";
import { SealedDocumentStore, type SaveSession, type SealedValueAddresses } from "./sealed-doc-store.js";
import type { CompositeStore } from "./composite-store.js";
import type { LarTiddlerStore } from "./tiddler-store.js";
import type { LarDoc } from "./base-doc.js";
import { catalogRowHalf } from "./catalog-view.js";
import { isBagId } from "./lar-uris.js";

// ── The book ────────────────────────────────────────────────────────────────────────────────────
/** What a booking reads: the session whose seal a document's next save signs under, and who wrote its latest change. */
export interface BookedSave<S extends SaveSession = SaveSession> {
  /** The session the next save signs under; null: none stands to seal it, and the save waits `save-unbooked`. */
  readonly session: S | null;
  /** The change's own writer: `session:<id>` for a change this vessel's session made, `peer:<actor>` for one that synced
   *  in from a peer's replica (the actor its own change carries). A peer's change never books to the local session. */
  readonly writer: string;
}

/** Which session wrote each document's latest change, and who wrote it. A booking lasts until its session drops. */
export class SaveBook<S extends SaveSession = SaveSession> {
  readonly #by = new Map<string, BookedSave<S>>();
  /** A session of this vessel wrote a change to `documentId`: its next save signs under that session. */
  book(documentId: string, session: S): void { this.#by.set(documentId, { session, writer: `session:${session.id}` }); }
  /** A peer's change synced in: it carries its writer, and its save rests as received under the session that holds the
   *  rest (`custodian`), never booked as that session's own change. */
  receive(documentId: string, actor: string, custodian: S | null): void {
    this.#by.set(documentId, { session: custodian, writer: `peer:${actor}` });
  }
  /** A waiting save's document takes `session` as the one that seals it; its writer stays as booked. */
  seal(documentId: string, session: S): void {
    const was = this.#by.get(documentId);
    this.#by.set(documentId, { session, writer: was?.writer ?? `session:${session.id}` });
  }
  of(documentId: string): S | null { return this.#by.get(documentId)?.session ?? null; }
  /** Who wrote a document's latest change, as booked; null: no booking stands. */
  writerOf(documentId: string): string | null { return this.#by.get(documentId)?.writer ?? null; }
  /** Drop every booking of one session (by id), or of every session. */
  drop(sessionId?: string): void {
    for (const [doc, b] of [...this.#by]) if (sessionId === undefined || b.session?.id === sessionId) this.#by.delete(doc);
  }
  get size(): number { return this.#by.size; }
}

/**
 * THE CHANGE'S OWN WRITER (sealed-store#/owed, T4). Every change the engine hands to storage carries the actor of the
 * replica that made it, inside its own bytes. An incremental save holds whole change chunks, and a snapshot one
 * document chunk over its whole history: this reads the actor of every change either holds.
 */
export function chunkActors(data: Uint8Array): readonly string[] | null {
  const actors = new Set<string>();
  let at = 0;
  while (at < data.length) {
    if (!MAGIC.every((b, i) => data[at + i] === b) || at + 9 >= data.length) return null;
    const type = data[at + 8]!;
    let len = 0, shift = 0, p = at + 9;
    for (;;) {
      if (p >= data.length || shift > 28) return null;
      const byte = data[p++]!;
      len |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    const end = p + len;
    if (end > data.length) return null;
    try {
      if (type === 0) for (const meta of A.getChangesMetaSince(A.load(data.subarray(at, end)), [])) actors.add(meta.actor);
      else actors.add(A.decodeChange(data.subarray(at, end) as A.Change).actor);
    } catch { return null; }
    at = end;
  }
  return actors.size > 0 ? [...actors].sort() : null;
}
const MAGIC = [0x85, 0x6f, 0x4a, 0x83] as const;

// ── The door's messages ───────────────────────────────────────────────────────────────────────────
export interface DocStoreMsg_Seal {
  readonly type: "docstore:seal"; readonly requestId: string;
  /** The ask the vessel booked for this seal in its session sign book, under `verb`. */
  readonly ask: string; readonly verb: typeof DOCSTORE_SEAL_VERB;
  readonly bagId: string; readonly values: readonly DocumentValue[];
  /** The actor of a peer's change the batch rests as received (U3); absent: the booked session wrote it. */
  readonly peer?: string;
}
export interface DocStoreMsg_Sealed {
  readonly type: "docstore:sealed"; readonly requestId: string;
  readonly values?: SealedValueAddresses["values"]; readonly refusal?: string; readonly cause?: string;
}
export interface DocStoreMsg_Open {
  readonly type: "docstore:open"; readonly requestId: string;
  readonly bagId: string; readonly role: DocumentValue["role"]; readonly ref: string;
}
export interface DocStoreMsg_Opened {
  readonly type: "docstore:opened"; readonly requestId: string;
  readonly plaintext?: Uint8Array; readonly keyVersion?: string; readonly address?: string; readonly writer?: string; readonly changeWriter?: string;
  readonly refusal?: string; readonly cause?: string;
}
export interface DocStoreMsg_Live { readonly type: "docstore:live"; readonly requestId: string; readonly bagId: string }
/** The vessel locked (P2-2): the island's holder overwrites every content key at once, and seals and opens nothing more. */
export interface DocStoreMsg_Lock { readonly type: "docstore:lock" }
export interface DocStoreMsg_Lived { readonly type: "docstore:lived"; readonly requestId: string; readonly bytes: Uint8Array | null }

/** The verb a document store's seal books in the session sign book. */
export const DOCSTORE_SEAL_VERB = "docstore-seal";

interface Port { post(msg: unknown): void; listen(cb: (msg: unknown) => void): () => void }

/** One request/answer pair over a port, with a patience past which the answer reads as `null`. */
function asker<A extends { requestId: string }>(port: Port, answerType: string, opts: { readonly patienceMs: number; readonly idPrefix: string }) {
  const pending = new Map<string, (answer: A | null) => void>();
  port.listen((raw) => {
    const m = raw as { type?: unknown; requestId?: unknown } | null;
    if (!m || m.type !== answerType || typeof m.requestId !== "string") return;
    const settle = pending.get(m.requestId);
    if (!settle) return;
    pending.delete(m.requestId);
    settle(m as unknown as A);
  });
  let seq = 0;
  return (msg: Record<string, unknown>): Promise<A | null> => new Promise((resolve) => {
    const requestId = `${opts.idPrefix}-${++seq}`;
    const timer = setTimeout(() => { pending.delete(requestId); resolve(null); }, opts.patienceMs);
    (timer as { unref?: () => void }).unref?.();
    pending.set(requestId, (answer) => { clearTimeout(timer); resolve(answer); });
    try { port.post({ ...msg, requestId }); } catch { pending.delete(requestId); clearTimeout(timer); resolve(null); }
  });
}

/**
 * The vessel's side of the door: the store's seal and open, each asking the daemon island across `port()` (read at
 * ask time, since an island may restart). `book` holds one ask in the vessel's session sign book under the session
 * that booked the change, and answers its release; the island signs through that ask and no other.
 */
export function vesselDocStoreDoor<S extends SaveSession>(port: () => Port | null, opts: {
  readonly book: (ask: string, verb: string, session: S) => () => void;
  readonly patienceMs: number; readonly idPrefix: string;
}): Pick<ConstructorParameters<typeof SealedDocumentStore>[0], "seal" | "open"> & { lock(): void } {
  let bound: Port | null = null;
  let seal: ReturnType<typeof asker<DocStoreMsg_Sealed>> | null = null;
  let open: ReturnType<typeof asker<DocStoreMsg_Opened>> | null = null;
  const ready = (): boolean => {
    const p = port();
    if (p === null) return false;
    if (p !== bound) {
      bound = p;
      seal = asker<DocStoreMsg_Sealed>(p, "docstore:sealed", { patienceMs: opts.patienceMs, idPrefix: `${opts.idPrefix}-seal` });
      open = asker<DocStoreMsg_Opened>(p, "docstore:opened", { patienceMs: opts.patienceMs, idPrefix: `${opts.idPrefix}-open` });
    }
    return true;
  };
  let asks = 0;
  return {
    /** Tell the island's holder the vessel locked: it drops every content key it holds, at once. */
    lock() { try { port()?.post({ type: "docstore:lock" } satisfies DocStoreMsg_Lock); } catch { /* the island went away, and its keys with it */ } },
    async seal({ bagId, values, session, peer }): Promise<SealedValueAddresses | HolderRefusal> {
      if (!ready()) return { refusal: "signer-unavailable", cause: "no daemon island answers the document store's door" } as HolderRefusal;
      const ask = `${opts.idPrefix}-ask-${++asks}`;
      const release = opts.book(ask, DOCSTORE_SEAL_VERB, session as S);
      try {
        const answer = await seal!({ type: "docstore:seal", ask, verb: DOCSTORE_SEAL_VERB, bagId, values, ...(peer !== undefined ? { peer } : {}) });
        if (answer === null) return { refusal: "signer-unavailable", cause: "the daemon island did not answer the seal" } as HolderRefusal;
        if (typeof answer.refusal === "string") return { refusal: answer.refusal, ...(answer.cause ? { cause: answer.cause } : {}) } as HolderRefusal;
        const sealed = (answer.values ?? []).map((v) => ({ role: v.role, ref: v.ref, address: readSealedAddress(v.address) }));
        if (sealed.length !== values.length || sealed.some((v) => v.address === null)) return { refusal: "seal-refused", cause: "the island answered no address" } as HolderRefusal;
        return { values: sealed as SealedValueAddresses["values"] };
      } finally { release(); }
    },
    async open({ bagId, role, ref }): Promise<OpenedValue | HolderRefusal> {
      if (!ready()) return { refusal: "holder-locked", cause: "no daemon island answers the document store's door" } as HolderRefusal;
      const answer = await open!({ type: "docstore:open", bagId, role, ref });
      if (answer === null) return { refusal: "holder-locked", cause: "the daemon island did not answer the open" } as HolderRefusal;
      if (typeof answer.refusal === "string") return { refusal: answer.refusal, ...(answer.cause ? { cause: answer.cause } : {}) } as HolderRefusal;
      const address = readSealedAddress(answer.address);
      if (!(answer.plaintext instanceof Uint8Array) || address === null || typeof answer.writer !== "string" || typeof answer.changeWriter !== "string" || typeof answer.keyVersion !== "string") {
        return { refusal: "open-refused", cause: "the island answered no body" } as HolderRefusal;
      }
      return { plaintext: answer.plaintext, address, writer: answer.writer, changeWriter: answer.changeWriter, keyVersion: answer.keyVersion as OpenedValue["keyVersion"] };
    },
  };
}

/** The island's side of the door: the holder's seal (signed through the booked ask) and open. Returns the unsubscribe. */
export function answerDocStoreAsks(port: Port, holder: {
  seal(args: { readonly bagId: string; readonly values: readonly DocumentValue[]; readonly ask: { readonly requestId: string; readonly verb: string }; readonly peer?: string }): Promise<SealedValueAddresses | HolderRefusal>;
  open(args: { readonly bagId: string; readonly role: DocumentValue["role"]; readonly ref: string }): Promise<OpenedValue | HolderRefusal>;
  /** The vessel locked: overwrite every content key now. */
  lock?(): void;
}): () => void {
  const reply = (msg: unknown): void => { try { port.post(msg); } catch { /* the vessel went away */ } };
  const refusal = (e: unknown): { refusal: string; cause?: string } => {
    const r = e as { reason?: unknown; refusal?: unknown; message?: unknown };
    const name = typeof r?.reason === "string" ? r.reason : typeof r?.refusal === "string" ? r.refusal : "seal-refused";
    return { refusal: name, ...(typeof r?.message === "string" ? { cause: r.message } : {}) };
  };
  return port.listen((raw) => {
    const m = raw as { type?: unknown; requestId?: unknown; bagId?: unknown; ask?: unknown; verb?: unknown; values?: unknown; role?: unknown; ref?: unknown; peer?: unknown } | null;
    if (m?.type === "docstore:lock") { holder.lock?.(); return; }
    if (!m || typeof m.requestId !== "string" || typeof m.bagId !== "string") return;
    const requestId = m.requestId;
    if (m.type === "docstore:seal") {
      if (typeof m.ask !== "string" || m.verb !== DOCSTORE_SEAL_VERB || !Array.isArray(m.values)) { reply({ type: "docstore:sealed", requestId, refusal: "values-malformed" }); return; }
      if (m.peer !== undefined && typeof m.peer !== "string") { reply({ type: "docstore:sealed", requestId, refusal: "values-malformed" }); return; }
      void holder.seal({ bagId: m.bagId, values: m.values as DocumentValue[], ask: { requestId: m.ask, verb: DOCSTORE_SEAL_VERB }, ...(typeof m.peer === "string" ? { peer: m.peer } : {}) }).then(
        (out) => reply("refusal" in out ? { type: "docstore:sealed", requestId, refusal: out.refusal, ...(out.cause ? { cause: out.cause } : {}) }
          : { type: "docstore:sealed", requestId, values: out.values.map((v) => ({ role: v.role, ref: v.ref, address: v.address })) } satisfies DocStoreMsg_Sealed),
        (e) => reply({ type: "docstore:sealed", requestId, ...refusal(e) }));
      return;
    }
    if (m.type === "docstore:open") {
      void holder.open({ bagId: m.bagId, role: m.role as DocumentValue["role"], ref: typeof m.ref === "string" ? m.ref : "" }).then(
        (out) => reply("refusal" in out ? { type: "docstore:opened", requestId, refusal: out.refusal, ...(out.cause ? { cause: out.cause } : {}) }
          : { type: "docstore:opened", requestId, plaintext: out.plaintext, keyVersion: out.keyVersion, address: out.address, writer: out.writer, changeWriter: out.changeWriter } satisfies DocStoreMsg_Opened),
        (e) => reply({ type: "docstore:opened", requestId, ...refusal(e) }));
    }
  });
}

/** The island asks the vessel for a bag's live document, as the vessel's Repo holds it in memory (the fresh base's cut). */
export function islandLiveDocDoor(port: Port, opts: { readonly patienceMs: number; readonly idPrefix: string }): (bagId: string) => Promise<Uint8Array | null> {
  const ask = asker<DocStoreMsg_Lived>(port, "docstore:lived", opts);
  return async (bagId) => {
    const answer = await ask({ type: "docstore:live", bagId });
    return answer !== null && answer.bytes instanceof Uint8Array ? answer.bytes : null;
  };
}

/** The vessel answers `docstore:live` from its Repo. Returns the unsubscribe. */
export function answerLiveDocAsks(port: Port, liveOf: (bagId: string) => Promise<Uint8Array | null>): () => void {
  return port.listen((raw) => {
    const m = raw as Partial<DocStoreMsg_Live> | null;
    if (!m || m.type !== "docstore:live" || typeof m.requestId !== "string" || typeof m.bagId !== "string") return;
    const requestId = m.requestId;
    const reply = (bytes: Uint8Array | null): void => { try { port.post({ type: "docstore:lived", requestId, bytes } satisfies DocStoreMsg_Lived); } catch { /* gone */ } };
    liveOf(m.bagId).then(reply, () => reply(null));
  });
}

/**
 * The vessel's cell for its daemon island's port: the record's `docStore` member attaches each daemon island's port as
 * it spawns (the latest stands; an island that goes leaves none), and the door reads the port at ask time. The vessel
 * answers the island's `docstore:live` over the same port.
 */
export function docStorePortCell(liveOf: (bagId: string) => Promise<Uint8Array | null>, opts: {
  /** V3: the island's slot resolver named `documentId` as `bagId`'s document (`announceSlotDoc`). */
  readonly onSlot?: (bagId: string, documentId: string) => void;
} = {}): {
  readonly port: () => Port | null;
  readonly attach: (port: Port) => () => void;
} {
  let current: Port | null = null;
  return {
    port: () => current,
    attach(port) {
      current = port;
      const stop = answerLiveDocAsks(port, liveOf);
      const stopSlots = opts.onSlot ? answerSlotNotices(port, opts.onSlot) : () => {};
      return () => { stop(); stopSlots(); if (current === port) current = null; };
    },
  };
}

/** Island → vessel (V3): the slot resolver named `documentId` as the document of the wiki slot `bagId`. */
export interface DocStoreMsg_Slot { readonly type: "docstore:slot"; readonly bagId: string; readonly documentId: string }

/**
 * THE SLOT RESOLVER NAMES EACH DOCUMENT IT ANSWERS (V3). A wiki's working and draft documents resolve in the daemon
 * island (the face's derived address, a binding record), and the seat that lands moves a slot to a new document; no
 * catalog row names either. So the island tells the vessel each slot document it answers, before any write into it, and
 * the vessel's bag map names it sealed with its bag.
 */
export function announceSlotDoc(port: Pick<Port, "post">, bagId: string, documentId: string): void {
  try { port.post({ type: "docstore:slot", bagId, documentId } satisfies DocStoreMsg_Slot); } catch { /* the vessel went away */ }
}

/** The vessel hears each slot notice. Returns the unsubscribe. */
export function answerSlotNotices(port: Port, onSlot: (bagId: string, documentId: string) => void): () => void {
  return port.listen((raw) => {
    const m = raw as Partial<DocStoreMsg_Slot> | null;
    if (!m || m.type !== "docstore:slot" || typeof m.bagId !== "string" || typeof m.documentId !== "string") return;
    try { onSlot(m.bagId, m.documentId); } catch { /* a listener's fault never reaches the island */ }
  });
}

// ── The composer ──────────────────────────────────────────────────────────────────────────────────
/** A bag a document belongs to, and that bag's face (`faceProofSubjectRef`); a null face: the bag rests sealed and no face
 *  that could wear it has lit, so its document opens for no one and its save waits in memory. */
export interface SealedBag { readonly bagId: string; readonly face: string | null }

export interface SealedRest<S extends SaveSession = SaveSession> {
  /** The storage adapter the Repo stands on. */
  readonly store: SealedDocumentStore;
  readonly book: SaveBook<S>;
  /** A session wrote a change to `documentId`: book it. */
  wrote(documentId: string, session: S): void;
  /** Book every save of a sealed bag's document in `repo` by its change's own writer (T4), read off the save's bytes: a
   *  change this replica made books the session standing (`standing`); a peer's change books its peer writer, its save
   *  resting under the standing session as the rest's custodian. Returns the unsubscribe. */
  watch(repo: Repo, standing: () => S | null): () => void;
  /** A session stands (an unlock, a session's open): book every waiting save of its face and seal them. */
  rebook(session: S): Promise<number>;
  /** The lock ritual's first move: flush the Repo and the store, so every pending save lands sealed, then drop the
   *  bookings of one session (or all). The caller drops signers and overwrites keys only after this resolves. */
  lock(sessionId?: string): Promise<void>;
  /** The stand-down's flush (T3), exactly as the lock's: every waiting save whose face `standing` still wears books it,
   *  the Repo and the store flush while the island still answers, and the bookings drop. Answers how many saves still
   *  wait unbooked: those rest nowhere new, and their changes come back by sync from the replica that holds them. */
  standDown(standing: readonly S[]): Promise<number>;
  /** V2: does this rest hold `documentId` sealed (mapped now, mapped this process, or a sealed value at rest)? An island
   *  asks before its own store rests a byte of it (`islandRestGuard`). */
  restsSealed(documentId: string): Promise<boolean>;
  /** V3: a document's bag mapped sealed after its rest took clear chunks (a slot the map learned late): book it under
   *  `session` and seal those chunks now, so they leave rest. Answers whether any clear chunk sealed. */
  sealMapped(documentId: string, session: S): Promise<boolean>;
}

/**
 * Compose the sealed rest under a vessel's Repo. `bagOf` names a document's sealed bag (null: the inner rest holds it
 * unchanged); `sessionFace` the face the vessel's standing session wears; `flushRepo` the Repo's own flush, read
 * late since the Repo stands on this store.
 */
export function composeSealedRest<S extends SaveSession>(input: {
  readonly inner: StorageAdapterInterface;
  readonly bagOf: (documentId: string) => SealedBag | null;
  readonly sessionFace: () => string | null;
  readonly door: Pick<ConstructorParameters<typeof SealedDocumentStore>[0], "seal" | "open"> & { lock?(): void };
  readonly flushRepo: () => Promise<void>;
  readonly onHeld?: (held: { readonly refusal: "save-unbooked" | "save-unmapped" | "save-unsealed"; readonly documentId: string }) => void;
  /** A restart's hydration: how long a sealed document's load waits for its map (`SealedDocumentStore.mapMoved`). */
  readonly hydrationPatienceMs?: number;
}): SealedRest<S> {
  const book = new SaveBook<S>();
  let watched: { readonly standing: () => S | null; readonly actorOf: (documentId: string) => string | null } | null = null;
  // T4: the save reads its change's own writer off its bytes. A change this replica made books the session standing; a
  // peer's change books its peer writer, and its save rests as received under the session that holds the rest.
  const sessionOf = (documentId: string, data?: Uint8Array): S | null => {
    if (watched !== null && data !== undefined) {
      const actors = chunkActors(data);
      const own = watched.actorOf(documentId);
      const session = watched.standing();
      // A handle not ready yet holds no change of this replica's own: what it saves arrived from a peer.
      if (actors !== null && (own === null || !actors.includes(own))) book.receive(documentId, actors.join(","), session ?? book.of(documentId));
      else if (actors !== null && session !== null) book.book(documentId, session);
      else if (session !== null && book.of(documentId) === null) book.seal(documentId, session);
    }
    return book.of(documentId);
  };
  const store = new SealedDocumentStore({
    inner: input.inner, bagOf: input.bagOf, sessionFace: input.sessionFace,
    sessionOf,
    writerOf: (documentId) => book.writerOf(documentId),
    // P1: a vessel's rest keeps a document's sealed class across a map that drops; its save waits, never clear.
    waitOverSealed: true,
    seal: input.door.seal, open: input.door.open,
    ...(input.onHeld ? { onHeld: input.onHeld } : {}),
    ...(input.hydrationPatienceMs !== undefined ? { hydrationPatienceMs: input.hydrationPatienceMs } : {}),
  });
  return {
    store, book,
    wrote(documentId, session) { if (input.bagOf(documentId) !== null) book.book(documentId, session); },
    watch(repo, standing) {
      // The Repo's handle table reads fresh at each ask: the getter answers a new record each time.
      const handleOf = (documentId: string) => (repo.handles as Record<string, { isReady(): boolean; doc(): unknown } | undefined>)[documentId];
      watched = {
        standing,
        actorOf: (documentId) => {
          const handle = handleOf(documentId);
          try { return handle?.isReady() ? A.getActorId(handle.doc() as A.Doc<unknown>) : null; } catch { return null; }
        },
      };
      return () => { watched = null; };
    },
    async rebook(session) {
      for (const id of store.waitingDocuments()) {
        const bag = input.bagOf(id);
        if (bag !== null && bag.face === session.subject) book.seal(id, session);
      }
      return store.reseal();
    },
    async lock(sessionId) {
      try { await input.flushRepo(); } catch { /* a save that refused keeps its change in the store's memory */ }
      await store.flush();
      book.drop(sessionId);
    },
    async standDown(standing) {
      for (const id of store.waitingDocuments()) {
        const face = input.bagOf(id)?.face;
        const session = standing.find((s) => s.subject === face);
        if (session) book.seal(id, session);
      }
      try { await input.flushRepo(); } catch { /* a save that refused keeps its change in the store's memory */ }
      await store.flush();
      try { await store.reseal(); } catch { /* it keeps waiting */ }
      book.drop();
      return store.waiting();
    },
    restsSealed: (documentId) => store.holdsSealed(documentId),
    async sealMapped(documentId, session) {
      const bag = input.bagOf(documentId);
      if (bag === null || bag.face !== session.subject) return false;
      if (book.of(documentId) === null) book.seal(documentId, session);
      return store.sealClearRest(documentId);
    },
  };
}

// ── The bag map (V3) ──────────────────────────────────────────────────────────────────────────────
/**
 * THE MAP OF A VESSEL'S SEALED BAGS, read off every name a bag's document carries. A wiki's canon bag stands as a catalog
 * row, but its working and draft slots resolve through the slot-doc resolver (the face's derived address, a binding
 * record) and no catalog row names them: the map reads the document each bag's mounted layer holds first, then the
 * catalog's row. `docsOf` answers a bag's candidate document ids in that order; an absent one reads null.
 *
 * BEFORE A FACE LIGHTS (the sealing scope, stable-founding-road #/rulings, 2026-11-06): every wiki content store rests
 * sealed and the floor catalog names public bags alone, so with no face lit every bag row of `catalog` that rests on a
 * face's half (`catalogRowHalf`: a user bag, a wiki, a slot binding) names a sealed bag whose face has not lit
 * (`face: null`): its document neither loads nor rests clear. A public row (`cap-tier = public`) and the floor's own rows
 * map no bag, and read as the engine wrote them.
 */
export function sealedBagMap(input: {
  readonly face: () => string | null;
  readonly bags: () => readonly string[];
  readonly docsOf: (bagId: string) => readonly (string | null | undefined)[];
  /** The catalog the vessel reads (the floor's, with a lit face's laid over it), or undefined before it stands. */
  readonly catalog?: () => LarDoc | undefined;
}): { bagOf(documentId: string): SealedBag | null; docOf(bagId: string): string | null } {
  const ids = (bagId: string): string[] => input.docsOf(bagId).filter((id): id is string => typeof id === "string" && id.length > 0);
  return {
    bagOf(documentId) {
      const face = input.face();
      if (face !== null) {
        for (const bagId of input.bags()) if (ids(bagId).includes(documentId)) return { bagId, face };
        return null;
      }
      for (const [title, row] of Object.entries(input.catalog?.()?.tiddlers ?? {})) {
        if (isBagId(title) && catalogRowHalf(title, row) === "face" && ids(title).includes(documentId)) return { bagId: title, face: null };
      }
      return null;
    },
    docOf: (bagId) => ids(bagId)[0] ?? null,
  };
}

/** The document a mounted layer's store stands on (an `AutomergeDocStore`), or null for a store that names none. */
export function mountedDocumentId(store: unknown): string | null {
  const id = (store as { documentId?: unknown } | null | undefined)?.documentId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * A WORKING SLOT'S DOCUMENT MOVES WHERE IT STANDS: swap `bagId`'s layer onto `store` at the same priority, writable and the
 * default writable, so the cascade above and beneath it reads as before. The anon-veil lift moves a working slot from the
 * floor's document to the face's derived one (`anon-lift`); every composite that mounts the slot follows, or one side
 * writes where the other never reads. False when no layer for `bagId` stands, or it stands on that document already.
 */
export function rebindWorkingLayer(composite: CompositeStore, bagId: string, store: LarTiddlerStore & { readonly documentId?: string }): boolean {
  const at = composite.layerIndexOf(bagId);
  if (at < 0) return false;
  const current = mountedDocumentId(composite.storeForBag(bagId));
  if (current !== null && current === mountedDocumentId(store)) return false;
  composite.removeLayer(bagId);
  composite.addLayer({ bagId, store, writable: true, defaultWritable: true }, at);
  return true;
}

/** A catalog row's document id (`automerge:<id>`), or null. */
export function documentIdOfUrl(url: string | null | undefined): string | null {
  return typeof url === "string" && url.startsWith("automerge:") ? url.slice("automerge:".length) : null;
}

// ── An island's own rest (V2) ─────────────────────────────────────────────────────────────────────
/**
 * AN ISLAND'S OWN STORE RESTS NO DOCUMENT THE VESSEL'S REST SEALS. The vessel's Repo holds one sealed rest per document,
 * under the session that booked each change; an island Repo (the wiki island, the daemon island's owned store) syncs with
 * it. So an island asks the vessel before it rests a byte of a document, and a document the vessel holds sealed rests in
 * the island's memory alone: its change reaches the vessel by sync and seals there, and a restarted island finds it by
 * sync. The first answer that names a document sealed sweeps every clear chunk the island's store held of it (a copy
 * written before the document mapped sealed). A sealed answer holds for the island's life; an ask the vessel cannot
 * answer reads unsealed, as a vessel that names no sealed bag does.
 */
export function islandRestGuard(inner: StorageAdapterInterface, restsAtVessel: (documentId: string) => Promise<boolean>): StorageAdapterInterface {
  const sealed = new Set<string>();
  const sweeps = new Map<string, Promise<void>>();
  const isSealed = async (documentId: unknown): Promise<boolean> => {
    if (typeof documentId !== "string" || documentId.length === 0) return false;
    if (!sealed.has(documentId)) {
      let answer = false;
      try { answer = await restsAtVessel(documentId); } catch { answer = false; }
      if (!answer) return false;
      sealed.add(documentId);
    }
    let sweep = sweeps.get(documentId);
    if (sweep === undefined) { sweep = Promise.resolve(inner.removeRange([documentId])); sweeps.set(documentId, sweep); }
    await sweep;
    return true;
  };
  return {
    async load(key) { return (await isSealed(key[0])) ? undefined : inner.load(key); },
    async save(key, data) { if (!(await isSealed(key[0]))) await inner.save(key, data); },
    async remove(key) { if (!(await isSealed(key[0]))) await inner.remove(key); },
    async loadRange(prefix): Promise<Chunk[]> {
      if (prefix.length >= 1) return (await isSealed(prefix[0])) ? [] : inner.loadRange(prefix);
      const out: Chunk[] = [];
      for (const chunk of await inner.loadRange(prefix)) if (!(await isSealed(chunk.key[0]))) out.push(chunk);
      return out;
    },
    async removeRange(prefix) { await inner.removeRange(prefix); },
  };
}

/** The island's side of the rest ask: post `rest:ask` over the island's port to its vessel and read `rest:answer` on the
 *  same request id. Silence past `patienceMs` reads unsealed, as a vessel that names no sealed bag does. */
export function vesselRestAsker(port: { post(msg: unknown): void; listen(cb: (msg: unknown) => void): () => void }, opts: { readonly patienceMs: number; readonly idPrefix: string }): (documentId: string) => Promise<boolean> {
  const pending = new Map<string, (sealed: boolean) => void>();
  port.listen((raw) => {
    const m = raw as { type?: unknown; requestId?: unknown; sealed?: unknown } | null;
    if (!m || m.type !== "rest:answer" || typeof m.requestId !== "string") return;
    const settle = pending.get(m.requestId);
    if (!settle) return;
    pending.delete(m.requestId);
    settle(m.sealed === true);
  });
  let seq = 0;
  return (documentId) => new Promise<boolean>((resolve) => {
    const requestId = `${opts.idPrefix}-rest-${++seq}`;
    const timer = setTimeout(() => { pending.delete(requestId); resolve(false); }, opts.patienceMs);
    (timer as { unref?: () => void }).unref?.();
    pending.set(requestId, (sealed) => { clearTimeout(timer); resolve(sealed); });
    try { port.post({ type: "rest:ask", requestId, documentId }); } catch { pending.delete(requestId); clearTimeout(timer); resolve(false); }
  });
}
