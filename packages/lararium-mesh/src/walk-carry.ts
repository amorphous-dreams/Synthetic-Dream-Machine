/**
 * walk-carry — the WALKER's side of W: hand a hearth its own documents to CARRY, as SEALED VALUES.
 *
 * CARRY ⊥ READ. Each document seals as one sealed value under a key of its own, which the walker's carry secret
 * (`walkCarrySecret`, derived from its per-Nexus leaf seed) and the document's plaintext digest derive: randomized
 * authenticated encryption bound to that document's carriage, the key version, the role `blob` and the digest.
 * The hearth receives the sealed bytes and their address and can never open them. The walker's RECEIPT (the
 * address, the digest and the document's key) rests on the walker's device, written durably BEFORE the sealed
 * value leaves. One exposed receipt opens one document.
 *
 * ONE CARRY AT A TIME PER HEARTH. Carries for one hearth run in turn, so two that start together each keep
 * their receipt, and one document started twice deposits once.
 *
 * THE RECEIPT AUTHORIZES THE ADDRESS. A fetch opens only bytes that hash to an address a receipt holds, under
 * the digest that same receipt names. Bytes a hearth altered, swapped for another carried document, cut short or
 * re-ordered refuse by name and open as nothing; an address the walker never wrote a receipt for opens nothing.
 *
 * REACHED BY PROOF, NEVER BY A HANDED KEY. The hearth files a walker's carriage under its PROVEN per-Nexus leaf,
 * so every carry and fetch rides only the grant the socket already proved, and nothing travels that names the
 * record. A walker that lapsed and walks back in on a fresh invite under the same leaf reaches its carriage again;
 * a fresh leaf is a fresh carriage. What the walker keeps is its own: the receipts, one per carried document.
 *
 * THE PERSONAGROUP IS THE DURABLE COPY. A hearth's carriage is a convenience a walker reaches from any dial; it is
 * reclaimable under the hearth's own pressure, with notice first, and is never presented as backup. The walker's
 * own devices hold its documents. A hearth's `hosting/notice` marks the record at risk — the walker's cue to make
 * sure its own devices hold what the receipts name — and a renewed grant clears the mark.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-walkers-carriage · lar:///ha.ka.ba/lararium/mesh/sealed-store
 */

import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { sealPrivateBody, openPrivateBody, type PrivateBodyKey } from "./ciphertext-cas.js";
import { authorizeAddress, readContentKey, sealedImage } from "./sealed-chunk.js";
import { base64UrlEncode, base64UrlDecode, hex, hexToBytes, sha256HexBytesSync } from "./crypto.js";
import { WALK_CARRY_DOCUMENT_INFO } from "./domains.js";
import { walkCarrySecret } from "./hosting.js";
import type { LarSessionMsg } from "./leaf-presentation.js";
import { tellWalkFault, type WalkStore, type WalkLeaf, type WalkTransport, type CarryReceipt, type WalkFault } from "./walk-client.js";

const REF = /^[0-9a-f]{64}$/;

/** The bag ONE carried document stands as in one Nexus: a bag of one value, named to nobody but its walker. */
export function walkCarriageBagId(nexusAid: string, ref: string): string {
  return `walk-carriage:${nexusAid.trim().toLowerCase()}:${ref}`;
}

/** ONE carried document's key: the walker's carry secret and the document's plaintext digest derive it, so the
 *  leaf seed and a receipt's digest yield it again, and no receipt's key opens another document. */
export function walkCarryDocumentKey(walkerLeafSeed: Uint8Array, nexusAid: string, ref: string): Uint8Array {
  if (!REF.test(ref)) throw new TypeError("walk-carry: a carried document's key derives over its SHA-256 digest");
  return hkdf(sha256, walkCarrySecret(walkerLeafSeed, nexusAid), undefined, sealedImage(WALK_CARRY_DOCUMENT_INFO, hexToBytes(ref)), 32);
}

/** The key a receipt holds, as its document's content key; null for a receipt that reads malformed. */
function receiptKey(receipt: CarryReceipt, nexusAid: string): PrivateBodyKey | null {
  if (typeof receipt.ref !== "string" || !REF.test(receipt.ref) || typeof receipt.key !== "string") return null;
  let bytes: Uint8Array;
  try { bytes = hexToBytes(receipt.key); } catch { return null; }
  const key = readContentKey(bytes);
  return key === null ? null : { bagId: walkCarriageBagId(nexusAid, receipt.ref), key };
}

/** Carries in flight, per store and hearth: each waits for the one before it. */
const carriesInTurn = new WeakMap<WalkStore, Map<string, Promise<unknown>>>();
function inTurn<T>(store: WalkStore, gate: string, act: () => Promise<T>): Promise<T> {
  let gates = carriesInTurn.get(store);
  if (!gates) { gates = new Map(); carriesInTurn.set(store, gates); }
  const run = (gates.get(gate) ?? Promise.resolve()).then(act, act);
  const tail = run.catch(() => undefined);
  gates.set(gate, tail);
  void tail.then(() => { if (gates!.get(gate) === tail) gates!.delete(gate); });
  return run;
}

/** The session kinds of the walker's carriage. */
export const HOSTING_CARRY_SESSION_KIND   = "hosting/carry";
export const HOSTING_CARRIED_SESSION_KIND = "hosting/carried";
export const HOSTING_FETCH_SESSION_KIND   = "hosting/fetch";
export const HOSTING_FETCHED_SESSION_KIND = "hosting/fetched";
export const HOSTING_NOTICE_SESSION_KIND  = "hosting/notice";

type CarryTransport = Pick<WalkTransport, "sendSession" | "onSession">;

/**
 * Wait for the first session frame of `kind` whose body names `cid`, or null after `withinMs`. An `accept` that
 * rejects (a store that refuses its read) rejects the wait, so the refusal reaches the caller that awaits it.
 */
function answerFor(transport: CarryTransport, kind: string, cid: string, withinMs: number, accept: (msg: LarSessionMsg) => Promise<boolean>): Promise<LarSessionMsg | null> {
  return new Promise((resolve, reject) => {
    let off: () => void = () => {};
    const timer = setTimeout(() => { off(); resolve(null); }, withinMs);
    off = transport.onSession((msg) => {
      if (msg.kind !== kind || (msg.body as { cid?: unknown } | null)?.cid !== cid) return;
      void accept(msg).then(
        (ok) => { if (ok) { clearTimeout(timer); off(); resolve(msg); } },
        (error: unknown) => { clearTimeout(timer); off(); reject(error); },
      );
    });
  });
}

/** What a carry came to: held, refused with the hearth's reason, or no answer. */
export type CarryOutcome =
  | { readonly cid: string; readonly held: true }
  | { readonly cid: string; readonly refused: string }
  | null;

/**
 * Hand one document to the hearth to carry. The receipt (its address, its digest and its key) is kept durably
 * first; the sealed value is sent after, on the walker's own proven socket. A document the hearth already serves
 * back under a held receipt answers from that receipt and deposits nothing twice.
 */
export function carryDocument(opts: {
  readonly transport: CarryTransport; readonly store: WalkStore; readonly gatePubKey: string;
  readonly leaf: WalkLeaf; readonly plaintext: Uint8Array; readonly withinMs: number;
}): Promise<CarryOutcome> {
  return inTurn(opts.store, opts.gatePubKey.toLowerCase(), () => carryInTurn(opts));
}

async function carryInTurn(opts: {
  readonly transport: CarryTransport; readonly store: WalkStore; readonly gatePubKey: string;
  readonly leaf: WalkLeaf; readonly plaintext: Uint8Array; readonly withinMs: number;
}): Promise<CarryOutcome> {
  const gate = opts.gatePubKey.toLowerCase();
  const held = await opts.store.read(gate);
  if (!held?.grant) return null;                                                  // carriage rides a grant
  const ref = sha256HexBytesSync(opts.plaintext);
  const standing = held.carried?.find((r) => r.ref === ref);
  if (standing) {
    // Each seal draws fresh, so a second seal would deposit a second value. Ask the hearth for the first.
    const back = await fetchDocument({ transport: opts.transport, store: opts.store, gatePubKey: gate, cid: standing.cid, withinMs: opts.withinMs });
    if (back !== null) return { cid: standing.cid, held: true };
  }
  const key = readContentKey(walkCarryDocumentKey(opts.leaf.seed, held.nexusAid, ref));
  if (key === null) return null;
  const sealed = sealPrivateBody(opts.plaintext, { bagId: walkCarriageBagId(held.nexusAid, ref), key });
  if (!("body" in sealed)) return null;
  const { cid, ciphertext } = sealed.body;
  // The receipt lands over the record as it stands at the write: the fetch above may have waited, and another
  // hand may have moved it. The receipt for a value the hearth no longer serves leaves with the write that names
  // its replacement. A record that left, or lost its grant, meanwhile carries nothing: no earlier reading returns.
  const kept = await opts.store.update(gate, (now) => {
    if (!now?.grant || now.nexusAid !== held.nexusAid) return null;
    const others = (now.carried ?? []).filter((r) => r.ref !== ref);
    return { ...now, carried: [...others, { cid, ref, key: hex(key) }] };
  });
  if (!kept) return null;
  const answered = answerFor(opts.transport, HOSTING_CARRIED_SESSION_KIND, cid, opts.withinMs, async (msg) => {
    const body = msg.body as { held?: unknown; refused?: unknown };
    return body.held === true || typeof body.refused === "string";
  });
  opts.transport.sendSession(HOSTING_CARRY_SESSION_KIND, { cid, ciphertext: base64UrlEncode(ciphertext) });
  const msg = await answered;
  if (!msg) return null;
  const body = msg.body as { held?: unknown; refused?: unknown };
  return body.held === true ? { cid, held: true } : { cid, refused: String(body.refused) };
}

/**
 * Open a `hosting/fetched` answer with the walker's own receipt. Null for an address no receipt holds, and for
 * bytes that refuse: altered, swapped, cut short, re-ordered, or opening to another document than the receipt names.
 */
export async function openCarried(store: WalkStore, gatePubKey: string, body: unknown): Promise<Uint8Array | null> {
  const answer = body as { cid?: unknown; ciphertext?: unknown } | null;
  if (typeof answer?.cid !== "string" || typeof answer.ciphertext !== "string") return null;
  const record = await store.read(gatePubKey.toLowerCase());
  const receipt = record?.carried?.find((r) => r.cid === answer.cid);
  if (!record || !receipt) return null;
  let ciphertext: Uint8Array;
  try { ciphertext = base64UrlDecode(answer.ciphertext); } catch { return null; }
  const under = receiptKey(receipt, record.nexusAid);
  const authorized = authorizeAddress(receipt.cid, "own-receipt");
  if (under === null || authorized === null) return null;
  const opened = openPrivateBody({ ciphertext, under, ref: receipt.ref, authorized });
  return "plaintext" in opened ? opened.plaintext : null;
}

/**
 * Fetch one carried document back from the hearth and open it with the walker's own receipt. Resolves null when
 * the hearth answers nothing within `withinMs` (a hearth that reclaimed it, or never carried it, is silent).
 */
export async function fetchDocument(opts: {
  readonly transport: CarryTransport; readonly store: WalkStore; readonly gatePubKey: string;
  readonly cid: string; readonly withinMs: number;
}): Promise<Uint8Array | null> {
  let opened: Uint8Array | null = null;
  const answered = answerFor(opts.transport, HOSTING_FETCHED_SESSION_KIND, opts.cid, opts.withinMs, async (msg) => {
    opened = await openCarried(opts.store, opts.gatePubKey, msg.body);
    return opened !== null;
  });
  opts.transport.sendSession(HOSTING_FETCH_SESSION_KIND, { cid: opts.cid });
  return (await answered) ? opened : null;
}

/**
 * Keep the hearth's notice: a `hosting/notice` marks the record at risk. (The renewed grant `walkOver` keeps
 * clears the mark in the same write, since a contact in a later epoch is what clears it at the hearth.) A store
 * that refuses the mark drops that one notice and tells `onFault`.
 */
export function watchCarryNotice(
  transport: Pick<WalkTransport, "onSession">, store: WalkStore, gatePubKey: string, onFault: (fault: WalkFault) => void,
): () => void {
  const gate = gatePubKey.toLowerCase();
  return transport.onSession((msg) => {
    if (msg.kind !== HOSTING_NOTICE_SESSION_KIND) return;
    void store.update(gate, (held) => (held && !held.atRisk ? { ...held, atRisk: true } : null))
      .catch((error: unknown) => tellWalkFault(onFault, "notice", error));
  });
}
