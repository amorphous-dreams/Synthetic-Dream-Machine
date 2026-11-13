/**
 * signed-act — the ONE image of a signed, hash-linked act, and the ONE fold that reads a log of them.
 *
 * Sync carries; verification decides (stable-founding-road#/rulings). A mutable CRDT carries a face's acts
 * (founding, admission, device edge, lease advance, a plane URL) and decides none of them. Each act rides as
 * ONE signed image: `canonicalJsonBytes({kind, group, seq, prior, ...fields})`, where `kind` is the act's
 * DOMAIN (no manifest indirection; a plane URL rides inside the body as a field). The signer signs those exact
 * bytes. A reader never trusts stored bytes: it re-derives them from the body, verifies the signature, asks
 * the caller whether that signer may sign THIS act (the anchor and the KEL decide, never this module), and folds.
 *
 * THE FOLD names a fork and never picks a winner: two verified acts at one `seq` under one `prior` surface as
 * `fork`, and the log stops there — the way the KEL board's reader stands (persona-kel-board). Platform-blind;
 * the same module serves node and browser. The K17 frontier certificate rides this image under its own domain.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/research/identity-invariants-2026
 */

import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { verifyEd25519 } from "./ed25519-door.js";
import type { QuorumSignature } from "./kapae-antigen.js";

/** The fields every act body carries; a domain's own fields ride beside them. */
export interface ActBody {
  /** The act's DOMAIN (`PERSONA_ACT_DOMAIN`, `EDGE_FRONTIER_DOMAIN`): the separation lives inside the signed bytes. */
  readonly kind: string;
  /** The PersonaGroup (or board) whose log this act extends. */
  readonly group: string;
  /** The act's place in the log, from 0. */
  readonly seq: number;
  /** The previous act's CID, or null at seq 0. */
  readonly prior: string | null;
  readonly [field: string]: unknown;
}

/** One act as it rests and travels: the body, its signer's verifying key (hex) and the signature (hex). */
export interface SignedAct<B extends ActBody = ActBody> {
  readonly body: B;
  readonly signer: string;
  readonly sig: string;
}

/** The exact bytes an act signs. */
export function actBytes(body: ActBody): Uint8Array {
  return canonicalJsonBytes(body);
}

/** The act's content id: sha-256 over the signed bytes. */
export function actCid(body: ActBody): string {
  return sha256HexBytesSync(actBytes(body));
}

/** Mint an act: the caller supplies the signer; this module holds no key and grades no authority. */
export async function signAct<B extends ActBody>(
  body: B,
  signer: { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> },
): Promise<SignedAct<B>> {
  if (!Number.isSafeInteger(body.seq) || body.seq < 0) throw new Error("signed-act: seq reads a non-negative integer");
  if ((body.seq === 0) !== (body.prior === null)) throw new Error("signed-act: prior is null at seq 0 and a cid after it");
  return { body, signer: signer.key.toLowerCase(), sig: await signer.sign(actBytes(body)) };
}

export type ActRefusal = "shape" | "domain" | "group" | "signature" | "unauthorized";

/** Read one act against its domain, its group and its signature. `authorize` is the anchor's / KEL's word on
 *  whether this signer may sign this body. */
export function readAct(
  raw: unknown,
  opts: { readonly domain: string; readonly group: string; readonly authorize: (signer: string, body: ActBody) => boolean },
): { readonly ok: true; readonly act: SignedAct; readonly cid: string } | { readonly ok: false; readonly refusal: ActRefusal } {
  if (typeof raw !== "object" || raw === null) return { ok: false, refusal: "shape" };
  const r = raw as Record<string, unknown>;
  const body = r["body"] as Record<string, unknown> | null;
  if (typeof body !== "object" || body === null) return { ok: false, refusal: "shape" };
  if (typeof r["signer"] !== "string" || typeof r["sig"] !== "string") return { ok: false, refusal: "shape" };
  if (typeof body["kind"] !== "string" || typeof body["group"] !== "string") return { ok: false, refusal: "shape" };
  const seq = body["seq"], prior = body["prior"];
  if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0) return { ok: false, refusal: "shape" };
  if (prior !== null && typeof prior !== "string") return { ok: false, refusal: "shape" };
  if ((seq === 0) !== (prior === null)) return { ok: false, refusal: "shape" };
  if (body["kind"] !== opts.domain) return { ok: false, refusal: "domain" };
  if (body["group"] !== opts.group) return { ok: false, refusal: "group" };
  const act: SignedAct = { body: body as ActBody, signer: r["signer"].toLowerCase(), sig: r["sig"] };
  let ok = false;
  try { ok = verifyEd25519(act.sig, actBytes(act.body), act.signer); } catch { ok = false; }
  if (!ok) return { ok: false, refusal: "signature" };
  if (!opts.authorize(act.signer, act.body)) return { ok: false, refusal: "unauthorized" };
  return { ok: true, act, cid: actCid(act.body) };
}

export interface ActFold<T extends { readonly body: ActBody } = SignedAct> {
  /** The verified lineage from seq 0, each act linked to its predecessor's cid. */
  readonly chain: readonly { readonly act: T; readonly cid: string }[];
  /** Two verified acts at one seq under one prior: the log stops before them and both ride here. */
  readonly fork: { readonly seq: number; readonly cids: readonly string[] } | null;
  /** Each carried record the reader set aside, with the name of its refusal. */
  readonly refused: readonly { readonly refusal: string }[];
}

type Read<T> = (raw: unknown) => { readonly ok: true; readonly act: T; readonly cid: string } | { readonly ok: false; readonly refusal: string };

/** The one fold, over any act form. `link` may veto a candidate against its predecessor (a chain's epochs only rise). */
export function foldLinked<T extends { readonly body: ActBody }>(
  records: readonly unknown[], read: Read<T>, link?: (body: ActBody, prior: ActBody | null) => boolean,
): ActFold<T> {
  const refused: { refusal: string }[] = [];
  const byCid = new Map<string, { act: T; cid: string }>();
  for (const raw of records) {
    const r = read(raw);
    if (!r.ok) { refused.push({ refusal: r.refusal }); continue; }
    byCid.set(r.cid, { act: r.act, cid: r.cid });
  }
  const chain: { act: T; cid: string }[] = [];
  let prior: string | null = null, priorBody: ActBody | null = null;
  for (let seq = 0; ; seq++) {
    const here = [...byCid.values()].filter((e) => e.act.body.seq === seq && e.act.body.prior === prior && (!link || link(e.act.body, priorBody)));
    if (here.length === 0) break;
    if (here.length > 1) return { chain, fork: { seq, cids: here.map((e) => e.cid).sort() }, refused };
    chain.push(here[0]!);
    prior = here[0]!.cid;
    priorBody = here[0]!.act.body;
  }
  return { chain, fork: null, refused };
}

/** Fold a carried set of single-signer records into the verified log. Order of arrival moves nothing. */
export function foldActs(
  records: readonly unknown[],
  opts: { readonly domain: string; readonly group: string; readonly authorize: (signer: string, body: ActBody) => boolean; readonly link?: (body: ActBody, prior: ActBody | null) => boolean },
): ActFold {
  return foldLinked(records, (raw) => readAct(raw, opts), opts.link);
}

// ── THE QUORUM FORM ─────────────────────────────────────────────────────────────────────────────
// A hand that is a charter signs at its quorum: the same canonical bytes carry a threshold of distinct seated
// signatures, in the house's `QuorumSignature` shape and through the one Ed25519 door.

export interface QuorumAct<B extends ActBody = ActBody> {
  readonly body: B;
  readonly signatures: readonly QuorumSignature[];
}

export async function signQuorumAct<B extends ActBody>(
  body: B, signers: readonly { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> }[],
): Promise<QuorumAct<B>> {
  if ((body.seq === 0) !== (body.prior === null)) throw new Error("signed-act: prior is null at seq 0 and a cid after it");
  const bytes = actBytes(body);
  const signatures: QuorumSignature[] = [];
  for (const s of signers) signatures.push({ signer: s.key.toLowerCase(), sig: await s.sign(bytes) });
  return { body, signatures };
}

export type QuorumRefusal = "shape" | "domain" | "group" | "no-roster" | "below-threshold";

/** Read a quorum act. `seatsFor` names the roster the body's own epoch reads under (null: none stood). */
export function readQuorumAct(
  raw: unknown,
  opts: { readonly domain: string; readonly group: string; readonly seatsFor: (body: ActBody) => { readonly signers: readonly string[]; readonly threshold: number } | null },
): { readonly ok: true; readonly act: QuorumAct; readonly cid: string } | { readonly ok: false; readonly refusal: QuorumRefusal } {
  if (typeof raw !== "object" || raw === null) return { ok: false, refusal: "shape" };
  const r = raw as Record<string, unknown>;
  const body = r["body"] as Record<string, unknown> | null;
  if (typeof body !== "object" || body === null || !Array.isArray(r["signatures"])) return { ok: false, refusal: "shape" };
  if (typeof body["kind"] !== "string" || typeof body["group"] !== "string") return { ok: false, refusal: "shape" };
  const seq = body["seq"], prior = body["prior"];
  if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0) return { ok: false, refusal: "shape" };
  if (prior !== null && typeof prior !== "string") return { ok: false, refusal: "shape" };
  if ((seq === 0) !== (prior === null)) return { ok: false, refusal: "shape" };
  if (body["kind"] !== opts.domain) return { ok: false, refusal: "domain" };
  if (body["group"] !== opts.group) return { ok: false, refusal: "group" };
  const seats = opts.seatsFor(body as ActBody);
  if (!seats) return { ok: false, refusal: "no-roster" };
  const bytes = actBytes(body as ActBody);
  const seated = new Set(seats.signers.map((k) => k.toLowerCase()));
  const verified = new Map<string, QuorumSignature>();
  for (const s of r["signatures"] as unknown[]) {
    if (typeof s !== "object" || s === null) continue;
    const { signer, sig } = s as Record<string, unknown>;
    if (typeof signer !== "string" || typeof sig !== "string") continue;
    const key = signer.toLowerCase();
    if (verified.has(key) || !seated.has(key)) continue;
    let ok = false;
    try { ok = verifyEd25519(sig, bytes, key); } catch { ok = false; }
    if (ok) verified.set(key, { signer: key, sig });
  }
  if (seats.threshold < 1 || verified.size < seats.threshold) return { ok: false, refusal: "below-threshold" };
  const act: QuorumAct = { body: body as ActBody, signatures: [...verified.values()] };
  return { ok: true, act, cid: actCid(act.body) };
}
