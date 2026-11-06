/**
 * sealed-doc-store — the document store's own rest for a sealed bag: every value the engine hands to storage rests as
 * a sealed `change` or `checkpoint` value, and every read answers to the session's face.
 *
 * ONE FORMAT SEALS IT. An incremental save seals as a `change`, a snapshot as a `checkpoint`, each under the logical
 * reference its storage key names, through the content-key holder's own seal (`sealValues`), so one save signs one
 * manifest. A change names, as its parents, the addresses of the values this store already held for its document;
 * a checkpoint names them as its cover. The inner adapter rests a pointer that names the sealed address and nothing
 * of the body, so no clear byte of a sealed bag reaches rest. A sync state carries peers' heads in the clear, so a
 * sealed bag rests none.
 *
 * HYDRATION ANSWERS TO THE SESSION'S FACE. A key alone grants no read: before any byte or name moves, the session
 * must wear the face the bag belongs to (`session-face-foreign`, `session-absent`), and an opened value whose
 * manifest another face's session signed refuses (`writer-face-foreign`). A value that does not open reads as its
 * named refusal, never as an absent value.
 *
 * THE FRESH BASE. A from-now admission opens a span on a document of present values alone. `cutFreshBase` founds
 * one from the live document, so its opened document holds its own founding change and no other, and
 * `readsAsFreshBase` refuses a base that holds more. `freshBasePort` hands the holder that cut.
 *
 * Platform-blind: the inner adapter, the bag map, the session's face and the holder's seal and open ride ports.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed (step three) · lar:///ha.ka.ba/lares/api/pono/session-contract#/the-document-view
 */
import * as A from "@automerge/automerge";
import type { Chunk, StorageAdapterInterface, StorageKey } from "@automerge/automerge-repo";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, utf8Bytes } from "./crypto.js";
import type { BagLocator } from "./sealed-records.js";
import { readSealedAddress, type KeyVersionId, type SealedAddress } from "./sealed-chunk.js";
import type { DocumentValue, FreshBase, HolderRefusal, OpenedValue, SealedValues } from "./content-key-holder.js";

export const SEALED_DOCUMENT_REFUSALS = [
  "session-absent",          // no session stands behind the read
  "session-face-foreign",    // the session wears another face than the bag belongs to
  "writer-face-foreign",     // the value opened, and another face's session signed the manifest that authorized it
  "pointer-malformed",       // the inner rest holds no pointer this store wrote
] as const;
export type SealedDocumentRefusalName = (typeof SEALED_DOCUMENT_REFUSALS)[number];

/** A refusal by name: this store's own (`SEALED_DOCUMENT_REFUSALS`) or the holder's, passed through. */
export class SealedDocumentRefusal extends Error {
  override readonly name = "SealedDocumentRefusal";
  constructor(readonly refusal: string, readonly why?: string) {
    super(`sealed document store: ${refusal}${why ? ` (${why})` : ""} — no byte and no name moved`);
  }
}

export interface SealedDocumentPorts {
  /** The engine-facing rest this store wraps: an unsealed bag's values pass straight to it. */
  readonly inner: StorageAdapterInterface;
  /** The bag a document belongs to and that bag's face (`faceProofSubjectRef`); null: the bag rests unsealed. */
  bagOf(documentId: string): { readonly bagId: string; readonly face: string } | null;
  /** The face the session wears (`faceProofSubjectRef`); null where no session stands. */
  sessionFace(): string | null;
  /** The holder's seal of one write batch, under the acting session's signer. */
  seal(args: { readonly bagId: string; readonly values: readonly DocumentValue[] }): Promise<SealedValues | HolderRefusal>;
  /** The holder's open of one value by its role and logical reference. */
  open(args: { readonly bagId: string; readonly role: DocumentValue["role"]; readonly ref: string }): Promise<OpenedValue | HolderRefusal>;
}

const ROLES: Readonly<Record<string, DocumentValue["role"]>> = { incremental: "change", snapshot: "checkpoint" };
const POINTER = "lares-sealed-value:";
const nameOf = (key: StorageKey): string => key.join("\u0000");

/** The logical reference a storage key names inside its bag. */
export function logicalRefOf(key: StorageKey): string {
  return hex(sha256(utf8Bytes(["lares-document-value", ...key].join("\u0000"))));
}
function readPointer(bytes: Uint8Array): SealedAddress | null {
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return null; }
  return text.startsWith(POINTER) ? readSealedAddress(text.slice(POINTER.length)) : null;
}
function frontierOf(saved: Uint8Array): string[] {
  try { return [...A.getHeads(A.load(saved))].sort(); } catch { return []; }
}

export class SealedDocumentStore implements StorageAdapterInterface {
  readonly #ports: SealedDocumentPorts;
  /** The sealed address of each value this store holds, by document and storage key: a change's parents, a checkpoint's cover. */
  readonly #held = new Map<string, Map<string, SealedAddress>>();

  constructor(ports: SealedDocumentPorts) { this.#ports = ports; }

  #bagOf(key: StorageKey): { readonly bagId: string; readonly face: string } | null {
    return key.length >= 1 && typeof key[0] === "string" ? this.#ports.bagOf(key[0]) : null;
  }
  #heldOf(documentId: string): Map<string, SealedAddress> {
    let held = this.#held.get(documentId);
    if (!held) { held = new Map(); this.#held.set(documentId, held); }
    return held;
  }
  /** The face gate, before any byte or name moves. */
  #face(bag: { readonly face: string }): string {
    const face = this.#ports.sessionFace();
    if (face === null) throw new SealedDocumentRefusal("session-absent");
    if (face !== bag.face) throw new SealedDocumentRefusal("session-face-foreign");
    return face;
  }

  async save(key: StorageKey, data: Uint8Array): Promise<void> {
    const bag = this.#bagOf(key);
    if (bag === null) return this.#ports.inner.save(key, data);
    this.#face(bag);
    const role = ROLES[key[1] ?? ""];
    if (role === undefined) return;
    const held = this.#heldOf(key[0]!);
    const parents = [...new Set(held.values())].sort();
    const value: DocumentValue = { role, ref: logicalRefOf(key), parents, plaintext: data, ...(role === "checkpoint" ? { frontier: frontierOf(data) } : {}) };
    const sealed = await this.#ports.seal({ bagId: bag.bagId, values: [value] });
    if ("refusal" in sealed) throw new SealedDocumentRefusal(sealed.refusal, sealed.cause);
    const address = sealed.values[0]!.address;
    await this.#ports.inner.save(key, utf8Bytes(POINTER + address));
    held.set(nameOf(key), address);
  }

  async load(key: StorageKey): Promise<Uint8Array | undefined> {
    const bag = this.#bagOf(key);
    if (bag === null) return this.#ports.inner.load(key);
    return this.#open(bag, key, this.#face(bag));
  }

  async #open(bag: { readonly bagId: string }, key: StorageKey, face: string, pointer?: Uint8Array): Promise<Uint8Array | undefined> {
    const role = ROLES[key[1] ?? ""];
    if (role === undefined) return undefined;
    const rested = pointer ?? (await this.#ports.inner.load(key));
    if (rested === undefined) return undefined;
    if (readPointer(rested) === null) throw new SealedDocumentRefusal("pointer-malformed");
    const opened = await this.#ports.open({ bagId: bag.bagId, role, ref: logicalRefOf(key) });
    if ("refusal" in opened) throw new SealedDocumentRefusal(opened.refusal, opened.cause);
    if (opened.writer !== face) { opened.plaintext.fill(0); throw new SealedDocumentRefusal("writer-face-foreign"); }
    this.#heldOf(key[0]!).set(nameOf(key), opened.address);
    return opened.plaintext;
  }

  async loadRange(prefix: StorageKey): Promise<Chunk[]> {
    const whole = this.#bagOf(prefix);
    const face = whole === null ? null : this.#face(whole);
    const out: Chunk[] = [];
    for (const chunk of await this.#ports.inner.loadRange(prefix)) {
      const bag = this.#bagOf(chunk.key);
      if (bag === null) { out.push(chunk); continue; }
      const data = await this.#open(bag, chunk.key, face ?? this.#face(bag), chunk.data);
      if (data !== undefined) out.push({ key: chunk.key, data });
    }
    return out;
  }

  async remove(key: StorageKey): Promise<void> {
    if (key.length >= 1) this.#held.get(key[0]!)?.delete(nameOf(key));
    await this.#ports.inner.remove(key);
  }

  async removeRange(prefix: StorageKey): Promise<void> {
    if (prefix.length >= 1) {
      const held = this.#held.get(prefix[0]!);
      for (const name of [...(held?.keys() ?? [])]) if (name.split("\u0000").slice(0, prefix.length).join("\u0000") === nameOf(prefix)) held!.delete(name);
    }
    await this.#ports.inner.removeRange(prefix);
  }

  close(): void | Promise<void> { return this.#ports.inner.close?.(); }
}

// ── The fresh base ──────────────────────────────────────────────────────────────────────────────
/** Found a new document from the live document's present values: one founding change, no earlier operation. */
export function cutFreshBase(live: Uint8Array): FreshBase | null {
  try {
    const present = A.toJS(A.load(live)) as Record<string, unknown>;
    const fresh = A.from(present);
    const frontier = [...A.getHeads(fresh)].sort();
    return { plaintext: A.save(fresh), ref: hex(sha256(utf8Bytes(["lares-fresh-base", ...frontier].join("\u0000")))), frontier };
  } catch { return null; }
}

/** Does `bytes` open to a fresh base: a whole document holding no change but its own founding one? */
export function readsAsFreshBase(bytes: Uint8Array): boolean {
  try { return A.getAllChanges(A.load(bytes)).length <= 1; } catch { return false; }
}

/** The holder's `freshBase` port over the live document of each bag, as the document store holds it in memory. */
export function freshBasePort(liveOf: (bagId: string) => Uint8Array | null | Promise<Uint8Array | null>):
  (args: { readonly bagId: string; readonly founding: BagLocator; readonly keyVersion: KeyVersionId }) => Promise<FreshBase | null> {
  return async ({ bagId }) => {
    const live = await liveOf(bagId);
    return live === null ? null : cutFreshBase(live);
  };
}
