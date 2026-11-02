/**
 * kahua-stage — a face's fleet stage: the signed acts that write it and the ONE reader that decides what stands on it.
 *
 * The face mints one stage doc (`lar:///ha.ka.ba/bags/kahua`) and pins its url by a root-signed `plane` act on
 * `@persona` (`KAHUA_PLANE`); a device adopts the url from its verified projection alone (`kahuaPlaneUrl`).
 *
 * TWO RECORDS, TWO QUESTIONS. The lōkahi cap (Keyhive's plane: the face's group holds the stage bag) answers who CAN
 * lift; the act answers that the operator CHOSE to. Each act signs under the operator's grant: a key the face's verified
 * KEL lineage seats in its CURRENT roster (the caller hands `grant`, `FaceReading.currentSigner`). A device atom (the
 * hand an AI seat speaks through) signs proposals on the intents plane and never an act that folds here.
 *
 *   lift      — an item's revision: its title, body and fields, its parent revision (null for a first lift), its
 *               origin {seat, device, session}, its taint list and the daemon sources it distils. Supersede, never edit.
 *   withdraw  — tombstones one named revision: recall drops it on every reader; history keeps it.
 *
 * THE FOLD reads no arrival order and no clock: a descendant replaces its parent; two lifts naming one parent (or two
 * first lifts of one title) stand as siblings, both visible; a parent the reader does not hold reads `orphan`, never a
 * head; a withdrawn revision drops from recall and its parent stays superseded (a re-lift restores an item).
 *
 * WHAT LANDS WHERE. The stage doc carries the acts (under `KAHUA_ACT_PREFIX`) and, beside them, one projected tiddler per
 * standing item (`projectKahuaItems`), so the kahua recipe layer reads items by title. A proposal (`KAHUA_PROPOSE_VERB`)
 * rides the face's intents plane as one signed batch per pass, pinned to the proposing device, naming daemon titles,
 * revisions and digests and never a body; the lift door cites the proposal and answers it with an outcome there.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { KAHUA_ACT_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { buildIntent, IntentRefusal, type IntentSigner } from "./intent-issue.js";
import type { SignedIntentEntry } from "./intent-entry.js";
import type { IntentVerbRegistry } from "./intent-verbs.js";
import { storedLarRecord } from "./stored-record.js";

/** The name a face's `plane` act carries for its stage. */
export const KAHUA_PLANE = "kahua";
/** The intents-plane verb a proposal batch issues under. */
export const KAHUA_PROPOSE_VERB = "kahua-lift";
export const KAHUA_ACT_PREFIX = "lar:///ha.ka.ba/dreamnet/kahua-act/";

export interface KahuaOrigin { readonly seat: string; readonly device: string; readonly session: string }
export interface KahuaSource { readonly title: string; readonly revision: string }
export interface KahuaLiftBody {
  readonly kind: typeof KAHUA_ACT_DOMAIN; readonly group: string; readonly act: "lift"; readonly epoch: number;
  readonly title: string; readonly text: string; readonly fields: Readonly<Record<string, string>>; readonly parent: string | null;
  readonly origin: KahuaOrigin; readonly taint: readonly string[]; readonly sources: readonly KahuaSource[];
  /** The proposal intent this lift answers, when it lifts one. */
  readonly proposal?: string;
}
export interface KahuaWithdrawBody {
  readonly kind: typeof KAHUA_ACT_DOMAIN; readonly group: string; readonly act: "withdraw"; readonly epoch: number; readonly target: string;
}
export type KahuaActBody = KahuaLiftBody | KahuaWithdrawBody;
export interface SignedKahuaAct { readonly body: KahuaActBody; readonly signer: string; readonly sig: string }
export type KahuaActRefusal = "shape" | "domain" | "group" | "signature" | "grant" | "origin" | "taint" | "sources" | "parent";
type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };

const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const string = (x: unknown): x is string => typeof x === "string";
const hex64 = (x: unknown): x is string => string(x) && /^[0-9a-f]{64}$/.test(x);
const RESERVED_FIELDS = new Set(["title", "text", "kahua-cid"]);

/** Which lift field fails its shape, or null; `origin`, `taint` and `sources` refuse by their own names. */
function liftFault(b: Record<string, unknown>): KahuaActRefusal | null {
  if (!object(b.origin) || !hex64(b.origin.seat) || !hex64(b.origin.device) || !string(b.origin.session) || b.origin.session.length === 0) return "origin";
  if (!Array.isArray(b.taint) || !b.taint.every((t) => string(t) && t.length > 0)) return "taint";
  if (!Array.isArray(b.sources) || b.sources.length === 0 || !b.sources.every((s) => object(s) && string(s.title) && s.title.length > 0 && string(s.revision))) return "sources";
  if (!(b.parent === null || hex64(b.parent))) return "parent";
  if (!string(b.title) || b.title.length === 0 || b.title.startsWith(KAHUA_ACT_PREFIX) || !string(b.text) || !object(b.fields)) return "shape";
  if (!Object.entries(b.fields).every(([k, v]) => string(v) && !RESERVED_FIELDS.has(k))) return "shape";
  if (b.proposal !== undefined && !hex64(b.proposal)) return "shape";
  return null;
}
function bodyFault(b: Record<string, unknown>): KahuaActRefusal | null {
  if (!string(b.group) || !Number.isSafeInteger(b.epoch) || (b.epoch as number) < 0) return "shape";
  if (b.act === "lift") return liftFault(b);
  if (b.act === "withdraw") return hex64(b.target) ? null : "shape";
  return "shape";
}

export function kahuaActCid(act: { readonly body: KahuaActBody; readonly signer: string }): string {
  return sha256HexBytesSync(canonicalJsonBytes({ body: act.body, signer: act.signer.toLowerCase() }));
}

async function sign(body: Record<string, unknown>, signer: Signer): Promise<SignedKahuaAct> {
  const fault = bodyFault(body);
  if (fault) throw new Error(`kahua-act: ${fault}`);
  return { body: body as unknown as KahuaActBody, signer: signer.key.toLowerCase(), sig: await signer.sign(canonicalJsonBytes(body)) };
}

export function signKahuaLift(parts: Omit<KahuaLiftBody, "kind" | "act">, signer: Signer): Promise<SignedKahuaAct> {
  return sign({ ...parts, kind: KAHUA_ACT_DOMAIN, act: "lift" }, signer);
}
export function signKahuaWithdraw(parts: Omit<KahuaWithdrawBody, "kind" | "act">, signer: Signer): Promise<SignedKahuaAct> {
  return sign({ ...parts, kind: KAHUA_ACT_DOMAIN, act: "withdraw" }, signer);
}

/** Judge one carried record: shape, domain, face, signature, then the operator's grant over its signer. */
export function readKahuaAct(raw: unknown, opts: { readonly group: string; readonly grant: (signer: string) => boolean }):
  { readonly ok: true; readonly act: SignedKahuaAct; readonly cid: string } | { readonly ok: false; readonly refusal: KahuaActRefusal } {
  if (!object(raw) || !object(raw.body) || !hex64(raw.signer) || !string(raw.sig)) return { ok: false, refusal: "shape" };
  const body = raw.body;
  if (body.kind !== KAHUA_ACT_DOMAIN) return { ok: false, refusal: "domain" };
  if (body.group !== opts.group) return { ok: false, refusal: "group" };
  const fault = bodyFault(body);
  if (fault) return { ok: false, refusal: fault };
  try { if (!verifyEd25519(raw.sig, canonicalJsonBytes(body), raw.signer)) return { ok: false, refusal: "signature" }; }
  catch { return { ok: false, refusal: "signature" }; }
  if (!opts.grant(raw.signer)) return { ok: false, refusal: "grant" };
  const act: SignedKahuaAct = { body: body as unknown as KahuaActBody, signer: raw.signer, sig: raw.sig };
  return { ok: true, act, cid: kahuaActCid(act) };
}

export interface KahuaRevision {
  readonly cid: string; readonly title: string; readonly text: string; readonly fields: Readonly<Record<string, string>>;
  readonly parent: string | null; readonly origin: KahuaOrigin; readonly taint: readonly string[]; readonly sources: readonly KahuaSource[];
  readonly proposal: string | null; readonly signer: string; readonly withdrawn: boolean;
}
export interface KahuaItem { readonly title: string; readonly status: "standing" | "siblings"; readonly heads: readonly KahuaRevision[] }
export interface KahuaStageReading {
  /** Every standing item, by title (sorted). */
  list(): KahuaItem[];
  /** One title's standing item, or null where none stands (never lifted, or every head withdrawn). */
  get(title: string): KahuaItem | null;
  /** Every verified revision of a title, withdrawn ones included. */
  history(title: string): KahuaRevision[];
  /** A verified revision by cid. */
  revision(cid: string): KahuaRevision | null;
  readonly orphans: readonly KahuaRevision[];
  readonly refused: readonly { readonly cid: string | null; readonly refusal: KahuaActRefusal }[];
}

/** Fold a stage's carried records. Pure: the same records read the same on every device, in any order. */
export function readKahuaStage(records: readonly unknown[], opts: { readonly group: string; readonly grant: (signer: string) => boolean }): KahuaStageReading {
  const lifts = new Map<string, { act: SignedKahuaAct; body: KahuaLiftBody }>();
  const withdrawn = new Set<string>();
  const refused: { cid: string | null; refusal: KahuaActRefusal }[] = [];
  const withdraws: string[] = [];
  for (const raw of records) {
    const read = readKahuaAct(raw, opts);
    if (!read.ok) {
      let cid: string | null = null;
      try { cid = object(raw) && object(raw.body) && string(raw.signer) ? kahuaActCid(raw as unknown as SignedKahuaAct) : null; } catch { cid = null; }
      refused.push({ cid, refusal: read.refusal });
      continue;
    }
    if (read.act.body.act === "lift") lifts.set(read.cid, { act: read.act, body: read.act.body });
    else withdraws.push(read.act.body.target);
  }
  for (const target of withdraws) if (lifts.has(target)) withdrawn.add(target);
  const rev = (cid: string): KahuaRevision => {
    const { act, body } = lifts.get(cid)!;
    return { cid, title: body.title, text: body.text, fields: body.fields, parent: body.parent, origin: body.origin, taint: body.taint,
      sources: body.sources, proposal: body.proposal ?? null, signer: act.signer, withdrawn: withdrawn.has(cid) };
  };
  // A parent counts only as a held, verified revision of the SAME title.
  const orphanCids = new Set<string>(), superseded = new Set<string>();
  for (const [cid, { body }] of lifts) {
    if (body.parent === null) continue;
    const parent = lifts.get(body.parent);
    if (!parent || parent.body.title !== body.title) orphanCids.add(cid);
    else superseded.add(body.parent);
  }
  const byTitle = new Map<string, string[]>();
  for (const [cid, { body }] of lifts) byTitle.set(body.title, [...(byTitle.get(body.title) ?? []), cid]);
  const itemOf = (title: string): KahuaItem | null => {
    const heads = (byTitle.get(title) ?? []).filter((cid) => !superseded.has(cid) && !orphanCids.has(cid) && !withdrawn.has(cid)).sort().map(rev);
    if (heads.length === 0) return null;
    return { title, status: heads.length === 1 ? "standing" : "siblings", heads };
  };
  return {
    list: () => [...byTitle.keys()].sort().map(itemOf).filter((i): i is KahuaItem => i !== null),
    get: itemOf,
    history: (title) => (byTitle.get(title) ?? []).sort().map(rev),
    revision: (cid) => (lifts.has(cid) ? rev(cid) : null),
    orphans: [...orphanCids].sort().map(rev),
    refused,
  };
}

export function kahuaActKey(group: string, cid: string): string { return `${KAHUA_ACT_PREFIX}${encodeURIComponent(group)}/${cid}`; }
/** Land an act record on a stage draft. Call INSIDE a `handle.change()`; follow with `projectKahuaItems`. */
export function writeKahuaAct(draft: LarDoc, act: SignedKahuaAct): void {
  const cid = kahuaActCid(act), key = kahuaActKey(act.body.group, cid);
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(act) }, cid);
}
/** Every carried act record of the face, parsed and unjudged. */
export function kahuaActRecords(doc: LarDoc | undefined | null, group: string): unknown[] {
  const prefix = `${KAHUA_ACT_PREFIX}${encodeURIComponent(group)}/`, out: unknown[] = [];
  for (const [title, record] of Object.entries(doc?.tiddlers ?? {})) {
    if (!title.startsWith(prefix)) continue;
    const text = tiddlerText(record);
    if (text !== null) try { out.push(JSON.parse(text)); } catch { /* torn carriage */ }
  }
  return out;
}

/**
 * The tiddlers the recipe layer reads: one per standing item, its fields the head's own plus its provenance. Siblings
 * project under the lowest cid and carry `kahua-siblings` naming every head, so the layer never reads one as settled.
 */
export function kahuaItemTiddlers(reading: KahuaStageReading): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const item of reading.list()) {
    const head = item.heads[0]!;
    out[item.title] = {
      ...head.fields, title: item.title, text: head.text, "kahua-cid": head.cid,
      "kahua-origin-seat": head.origin.seat, "kahua-origin-device": head.origin.device, "kahua-origin-session": head.origin.session,
      "kahua-taint": JSON.stringify(head.taint), "kahua-sources": JSON.stringify(head.sources),
      ...(item.status === "siblings" ? { "kahua-siblings": item.heads.map((h) => h.cid).join(" ") } : {}),
    };
  }
  return out;
}

/** Rewrite a stage draft's item tiddlers to the verified reading: every non-act title the reading does not stand clears. */
export function projectKahuaItems(draft: LarDoc, reading: KahuaStageReading): void {
  const items = kahuaItemTiddlers(reading);
  for (const title of Object.keys(draft.tiddlers)) {
    if (!title.startsWith(KAHUA_ACT_PREFIX) && !(title in items)) delete draft.tiddlers[title];
  }
  for (const [title, fields] of Object.entries(items)) {
    if (tiddlerText(draft.tiddlers[title]) === fields.text && (draft.tiddlers[title] as unknown as { fields?: Record<string, string> })?.fields?.["kahua-cid"] === fields["kahua-cid"]) continue;
    draft.tiddlers[title] = storedLarRecord(title, fields, fields["kahua-cid"]!);
  }
}

/** The stage url the face's verified projection names, or null. A bootstrap, catalog or doc value never answers. */
export function kahuaPlaneUrl(projection: { readonly planes: Readonly<Record<string, string | undefined>> }): string | null {
  return projection.planes[KAHUA_PLANE] ?? null;
}

export interface KahuaProposal { readonly title: string; readonly revision: string; readonly digest: string; readonly taint: readonly string[] }

function proposalsFault(proposals: unknown): string | null {
  if (!Array.isArray(proposals) || proposals.length === 0 || proposals.length > 64) return "proposals";
  for (const p of proposals) {
    if (!object(p) || !string(p.title) || p.title.length === 0 || !string(p.revision) || !hex64(p.digest)) return "proposals";
    if (!Array.isArray(p.taint) || !p.taint.every((t) => string(t) && t.length > 0)) return "taint";
  }
  return null;
}

/** One pass's proposals as ONE intent, pinned to the proposing device (the daemon holding the bodies). */
export async function buildKahuaProposal(input: {
  readonly group: string; readonly signer: IntentSigner; readonly session: string; readonly nonce: string;
  readonly proposals: readonly KahuaProposal[]; readonly verbs: IntentVerbRegistry;
}): Promise<SignedIntentEntry> {
  const fault = proposalsFault(input.proposals);
  if (fault) throw new IntentRefusal(`kahua-proposal-${fault}`);
  if (!string(input.session) || input.session.length === 0) throw new IntentRefusal("kahua-proposal-session");
  const proposals = input.proposals.map((p) => ({ title: p.title, revision: p.revision, digest: p.digest, taint: [...p.taint] }));
  return buildIntent({ group: input.group, signer: input.signer, verb: KAHUA_PROPOSE_VERB, args: { session: input.session, proposals },
    nonce: input.nonce, audience: { mode: "pinned", atom: input.signer.key.toLowerCase() }, verbs: input.verbs });
}

/** A proposal batch's parsed args, or null where the entry names no well-formed batch. The caller verifies the entry first. */
export function readKahuaProposal(entry: SignedIntentEntry): { readonly session: string; readonly proposals: readonly KahuaProposal[] } | null {
  const b = entry.body;
  if (b.entry !== "intent" || b["verb"] !== KAHUA_PROPOSE_VERB || !object(b["args"])) return null;
  const args = b["args"] as Record<string, unknown>;
  if (!string(args.session) || proposalsFault(args.proposals) !== null) return null;
  return { session: args.session, proposals: args.proposals as KahuaProposal[] };
}

/** The sha-256 digest a proposal names for a body. */
export function kahuaBodyDigest(text: string): string { return sha256HexBytesSync(new TextEncoder().encode(text)); }
