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
import type { StorageAdapterInterface } from "@automerge/automerge-repo";
import type { DocumentValue, HolderRefusal, OpenedValue } from "./content-key-holder.js";
import { readSealedAddress } from "./sealed-chunk.js";
import { SealedDocumentStore, type SaveSession, type SealedValueAddresses } from "./sealed-doc-store.js";

// ── The book ────────────────────────────────────────────────────────────────────────────────────
/** Which session wrote each document's latest change. A booking lasts until its session drops. */
export class SaveBook<S extends SaveSession = SaveSession> {
  readonly #by = new Map<string, S>();
  /** A session wrote a change to `documentId`: its next save signs under that session. */
  book(documentId: string, session: S): void { this.#by.set(documentId, session); }
  of(documentId: string): S | null { return this.#by.get(documentId) ?? null; }
  /** Drop every booking of one session (by id), or of every session. */
  drop(sessionId?: string): void {
    for (const [doc, s] of [...this.#by]) if (sessionId === undefined || s.id === sessionId) this.#by.delete(doc);
  }
  get size(): number { return this.#by.size; }
}

// ── The door's messages ───────────────────────────────────────────────────────────────────────────
export interface DocStoreMsg_Seal {
  readonly type: "docstore:seal"; readonly requestId: string;
  /** The ask the vessel booked for this seal in its session sign book, under `verb`. */
  readonly ask: string; readonly verb: typeof DOCSTORE_SEAL_VERB;
  readonly bagId: string; readonly values: readonly DocumentValue[];
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
  readonly plaintext?: Uint8Array; readonly keyVersion?: string; readonly address?: string; readonly writer?: string;
  readonly refusal?: string; readonly cause?: string;
}
export interface DocStoreMsg_Live { readonly type: "docstore:live"; readonly requestId: string; readonly bagId: string }
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
}): Pick<ConstructorParameters<typeof SealedDocumentStore>[0], "seal" | "open"> {
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
    async seal({ bagId, values, session }): Promise<SealedValueAddresses | HolderRefusal> {
      if (!ready()) return { refusal: "signer-unavailable", cause: "no daemon island answers the document store's door" } as HolderRefusal;
      const ask = `${opts.idPrefix}-ask-${++asks}`;
      const release = opts.book(ask, DOCSTORE_SEAL_VERB, session as S);
      try {
        const answer = await seal!({ type: "docstore:seal", ask, verb: DOCSTORE_SEAL_VERB, bagId, values });
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
      if (!(answer.plaintext instanceof Uint8Array) || address === null || typeof answer.writer !== "string" || typeof answer.keyVersion !== "string") {
        return { refusal: "open-refused", cause: "the island answered no body" } as HolderRefusal;
      }
      return { plaintext: answer.plaintext, address, writer: answer.writer, keyVersion: answer.keyVersion as OpenedValue["keyVersion"] };
    },
  };
}

/** The island's side of the door: the holder's seal (signed through the booked ask) and open. Returns the unsubscribe. */
export function answerDocStoreAsks(port: Port, holder: {
  seal(args: { readonly bagId: string; readonly values: readonly DocumentValue[]; readonly ask: { readonly requestId: string; readonly verb: string } }): Promise<SealedValueAddresses | HolderRefusal>;
  open(args: { readonly bagId: string; readonly role: DocumentValue["role"]; readonly ref: string }): Promise<OpenedValue | HolderRefusal>;
}): () => void {
  const reply = (msg: unknown): void => { try { port.post(msg); } catch { /* the vessel went away */ } };
  const refusal = (e: unknown): { refusal: string; cause?: string } => {
    const r = e as { reason?: unknown; refusal?: unknown; message?: unknown };
    const name = typeof r?.reason === "string" ? r.reason : typeof r?.refusal === "string" ? r.refusal : "seal-refused";
    return { refusal: name, ...(typeof r?.message === "string" ? { cause: r.message } : {}) };
  };
  return port.listen((raw) => {
    const m = raw as { type?: unknown; requestId?: unknown; bagId?: unknown; ask?: unknown; verb?: unknown; values?: unknown; role?: unknown; ref?: unknown } | null;
    if (!m || typeof m.requestId !== "string" || typeof m.bagId !== "string") return;
    const requestId = m.requestId;
    if (m.type === "docstore:seal") {
      if (typeof m.ask !== "string" || m.verb !== DOCSTORE_SEAL_VERB || !Array.isArray(m.values)) { reply({ type: "docstore:sealed", requestId, refusal: "values-malformed" }); return; }
      void holder.seal({ bagId: m.bagId, values: m.values as DocumentValue[], ask: { requestId: m.ask, verb: DOCSTORE_SEAL_VERB } }).then(
        (out) => reply("refusal" in out ? { type: "docstore:sealed", requestId, refusal: out.refusal, ...(out.cause ? { cause: out.cause } : {}) }
          : { type: "docstore:sealed", requestId, values: out.values.map((v) => ({ role: v.role, ref: v.ref, address: v.address })) } satisfies DocStoreMsg_Sealed),
        (e) => reply({ type: "docstore:sealed", requestId, ...refusal(e) }));
      return;
    }
    if (m.type === "docstore:open") {
      void holder.open({ bagId: m.bagId, role: m.role as DocumentValue["role"], ref: typeof m.ref === "string" ? m.ref : "" }).then(
        (out) => reply("refusal" in out ? { type: "docstore:opened", requestId, refusal: out.refusal, ...(out.cause ? { cause: out.cause } : {}) }
          : { type: "docstore:opened", requestId, plaintext: out.plaintext, keyVersion: out.keyVersion, address: out.address, writer: out.writer } satisfies DocStoreMsg_Opened),
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
export function docStorePortCell(liveOf: (bagId: string) => Promise<Uint8Array | null>): {
  readonly port: () => Port | null;
  readonly attach: (port: Port) => () => void;
} {
  let current: Port | null = null;
  return {
    port: () => current,
    attach(port) {
      current = port;
      const stop = answerLiveDocAsks(port, liveOf);
      return () => { stop(); if (current === port) current = null; };
    },
  };
}

// ── The composer ──────────────────────────────────────────────────────────────────────────────────
/** A bag a document belongs to, and that bag's face (`faceProofSubjectRef`). */
export interface SealedBag { readonly bagId: string; readonly face: string }

export interface SealedRest<S extends SaveSession = SaveSession> {
  /** The storage adapter the Repo stands on. */
  readonly store: SealedDocumentStore;
  readonly book: SaveBook<S>;
  /** A session wrote a change to `documentId`: book it. */
  wrote(documentId: string, session: S): void;
  /** A session stands (an unlock, a session's open): book every waiting save of its face and seal them. */
  rebook(session: S): Promise<number>;
  /** The lock ritual's first move: flush the Repo and the store, so every pending save lands sealed, then drop the
   *  bookings of one session (or all). The caller drops signers and overwrites keys only after this resolves. */
  lock(sessionId?: string): Promise<void>;
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
  readonly door: Pick<ConstructorParameters<typeof SealedDocumentStore>[0], "seal" | "open">;
  readonly flushRepo: () => Promise<void>;
  readonly onHeld?: (held: { readonly refusal: "save-unbooked"; readonly documentId: string }) => void;
}): SealedRest<S> {
  const book = new SaveBook<S>();
  const store = new SealedDocumentStore({
    inner: input.inner, bagOf: input.bagOf, sessionFace: input.sessionFace,
    sessionOf: (documentId) => book.of(documentId),
    seal: input.door.seal, open: input.door.open,
    ...(input.onHeld ? { onHeld: input.onHeld } : {}),
  });
  return {
    store, book,
    wrote(documentId, session) { if (input.bagOf(documentId) !== null) book.book(documentId, session); },
    async rebook(session) {
      for (const id of store.waitingDocuments()) {
        const bag = input.bagOf(id);
        if (bag !== null && bag.face === session.subject) book.book(id, session);
      }
      return store.reseal();
    },
    async lock(sessionId) {
      try { await input.flushRepo(); } catch { /* a save that refused keeps its change in the store's memory */ }
      await store.flush();
      book.drop(sessionId);
    },
  };
}
