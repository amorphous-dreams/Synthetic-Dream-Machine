/**
 * walk-carry — the WALKER's side of W: hand a hearth its own documents to CARRY, as SEALED CIPHERTEXT.
 *
 * CARRY ⊥ READ. Each document is sealed under the walker's own carry secret (`walkCarrySecret`, derived from its
 * per-Nexus leaf seed) and handed over as ciphertext and its content address. The read-cap stays on the walker's
 * device in its receipt, written durably BEFORE the ciphertext leaves; the hearth holds bytes it can never open.
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
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-walkers-carriage
 */

import { sealBodyOnCas, openBodyOnCas, verifyCiphertextCid } from "./ciphertext-cas.js";
import { base64UrlEncode, base64UrlDecode, hex, hexToBytes } from "./crypto.js";
import { walkCarrySecret } from "./hosting.js";
import type { LarSessionMsg } from "./auth-wire.js";
import type { WalkStore, WalkLeaf, WalkTransport } from "./walk-client.js";

/** The session kinds of the walker's carriage. */
export const HOSTING_CARRY_SESSION_KIND   = "hosting/carry";
export const HOSTING_CARRIED_SESSION_KIND = "hosting/carried";
export const HOSTING_FETCH_SESSION_KIND   = "hosting/fetch";
export const HOSTING_FETCHED_SESSION_KIND = "hosting/fetched";
export const HOSTING_NOTICE_SESSION_KIND  = "hosting/notice";

type CarryTransport = Pick<WalkTransport, "sendSession" | "onSession">;

/** Wait for the first session frame of `kind` whose body names `cid`, or null after `withinMs`. */
function answerFor(transport: CarryTransport, kind: string, cid: string, withinMs: number, accept: (msg: LarSessionMsg) => Promise<boolean>): Promise<LarSessionMsg | null> {
  return new Promise((resolve) => {
    let off: () => void = () => {};
    const timer = setTimeout(() => { off(); resolve(null); }, withinMs);
    off = transport.onSession((msg) => {
      if (msg.kind !== kind || (msg.body as { cid?: unknown } | null)?.cid !== cid) return;
      void accept(msg).then((ok) => { if (ok) { clearTimeout(timer); off(); resolve(msg); } });
    });
  });
}

/** What a carry came to: held, refused with the hearth's reason, or no answer. */
export type CarryOutcome =
  | { readonly cid: string; readonly held: true }
  | { readonly cid: string; readonly refused: string }
  | null;

/**
 * Hand one document to the hearth to carry. The receipt (its cid and read-cap) is kept durably first; the
 * ciphertext is sent after, on the walker's own proven socket.
 */
export async function carryDocument(opts: {
  readonly transport: CarryTransport; readonly store: WalkStore; readonly gatePubKey: string;
  readonly leaf: WalkLeaf; readonly plaintext: Uint8Array; readonly withinMs: number;
}): Promise<CarryOutcome> {
  const gate = opts.gatePubKey.toLowerCase();
  const held = await opts.store.read(gate);
  if (!held?.grant) return null;                                                  // carriage rides a grant
  const sealed = sealBodyOnCas(opts.plaintext, walkCarrySecret(opts.leaf.seed, held.nexusAid));
  if (!held.carried?.some((r) => r.cid === sealed.cid)) {
    await opts.store.write(gate, { ...held, carried: [...(held.carried ?? []), { cid: sealed.cid, readCap: hex(sealed.readCap) }] });
  }
  const answered = answerFor(opts.transport, HOSTING_CARRIED_SESSION_KIND, sealed.cid, opts.withinMs, async (msg) => {
    const body = msg.body as { held?: unknown; refused?: unknown };
    return body.held === true || typeof body.refused === "string";
  });
  opts.transport.sendSession(HOSTING_CARRY_SESSION_KIND, { cid: sealed.cid, ciphertext: base64UrlEncode(sealed.ciphertext) });
  const msg = await answered;
  if (!msg) return null;
  const body = msg.body as { held?: unknown; refused?: unknown };
  return body.held === true ? { cid: sealed.cid, held: true } : { cid: sealed.cid, refused: String(body.refused) };
}

/** Open a `hosting/fetched` answer with the walker's own receipt: null for bytes that do not match the address. */
export async function openCarried(store: WalkStore, gatePubKey: string, body: unknown): Promise<Uint8Array | null> {
  const answer = body as { cid?: unknown; ciphertext?: unknown } | null;
  if (typeof answer?.cid !== "string" || typeof answer.ciphertext !== "string") return null;
  const receipt = (await store.read(gatePubKey.toLowerCase()))?.carried?.find((r) => r.cid === answer.cid);
  if (!receipt) return null;
  let ciphertext: Uint8Array;
  try { ciphertext = base64UrlDecode(answer.ciphertext); } catch { return null; }
  if (!verifyCiphertextCid(ciphertext, receipt.cid)) return null;
  return openBodyOnCas(ciphertext, hexToBytes(receipt.readCap));
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
 * clears the mark in the same write, since a contact in a later epoch is what clears it at the hearth.)
 */
export function watchCarryNotice(transport: Pick<WalkTransport, "onSession">, store: WalkStore, gatePubKey: string): () => void {
  const gate = gatePubKey.toLowerCase();
  return transport.onSession((msg) => {
    if (msg.kind !== HOSTING_NOTICE_SESSION_KIND) return;
    void (async () => {
      const held = await store.read(gate);
      if (held && !held.atRisk) await store.write(gate, { ...held, atRisk: true });
    })();
  });
}
