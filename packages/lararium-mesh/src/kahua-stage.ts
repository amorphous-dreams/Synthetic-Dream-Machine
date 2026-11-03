/**
 * kahua-stage — a face's fleet stage: the signed acts that write it and the ONE reader that decides what stands on it.
 *
 * The face stands one stage doc (`lar:///ha.ka.ba/bags/kahua`) at an address every device of the face derives alike
 * (`kahuaStageDocUrl(group)`), so two hearths that mint at once mint the same doc and sign the same pin; the face pins it
 * by a root-signed `plane` act on `@persona` (`KAHUA_PLANE`), and a device adopts it from its verified projection alone
 * (`kahuaPlaneUrl`, which answers the derived url and nothing else).
 *
 * TWO RECORDS, TWO QUESTIONS. The lōkahi cap (Keyhive's plane: the face's group holds the stage bag) answers who CAN
 * lift; the act answers that the operator CHOSE to. Each act signs under the operator's grant: a key the face's verified
 * KEL lineage seats in its CURRENT roster (the caller hands `grant`, `FaceReading.currentSigner`). A device atom (the
 * hand an AI seat speaks through) signs proposals on the intents plane and never an act that folds here.
 *
 *   lift      — an item's revision: its title, body and fields, its parent revision (null for a first lift), its
 *               origin {seat, device, session}, its taint list and the daemon sources it distils. Supersede, never edit.
 *   withdraw  — tombstones one named revision: recall drops it on every reader; history keeps it.
 *   carry     — names earlier acts (by cid) that keep standing under the current root: a batch re-lift after a rotation.
 *
 * STANDING READS CURRENT-ONLY. Acts carry no sequence, so a root the KEL rotated past could sign an act naming its own old
 * epoch at any later time, and no reader could tell it from one signed before the rotation. So an act STANDS where its
 * signer sits in the current roster (`grant`), or where a carry the current root signed names its cid; a carry stands by
 * the same rule, so each rotation drops the earlier items until the new root carries them again. An act whose signer sat
 * in the roster of the epoch it names (`signedAt`) but stands no more reads in HISTORY (`history`, `revision`), never as a
 * head and never deleted; an act no roster of its epoch seats refuses at `grant`.
 *
 * THE FOLD reads no arrival order and no clock: a descendant replaces its parent; two lifts naming one parent (or two
 * first lifts of one title) stand as siblings, both visible; a parent the reader does not hold reads `orphan`, never a
 * head; a withdrawn revision drops from recall and its parent stays superseded (a re-lift restores an item).
 *
 * WHAT LANDS WHERE. The stage doc carries the acts (under `KAHUA_ACT_PREFIX`) and nothing a reader trusts beside them: any
 * member of the face can write any tiddler into it, so every reader folds the acts at READ (`kahua-stage-store`, the recipe
 * layer; `kahuaItemTiddlers`, the item fields) and a plain tiddler counts for nothing. A proposal (`KAHUA_PROPOSE_VERB`)
 * rides the face's intents plane as one signed batch per pass, pinned to the proposing device, naming daemon titles,
 * revisions and digests and never a body; the lift door cites the proposal and answers it with an outcome there.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { isControlPlaneUri } from "./lar-uris.js";
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { KAHUA_ACT_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { buildIntent, IntentRefusal, type IntentSigner } from "./intent-issue.js";
import { deterministicDocUrl, materializeSharedLarDoc } from "./deterministic-doc.js";
import { KAHUA_DOC_URI } from "./lar-uris.js";
import { intentEntryRecordsOfGroup, intentId, readIntentEntry, type SignedIntentEntry } from "./intent-entry.js";
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
export interface KahuaCarryBody {
  readonly kind: typeof KAHUA_ACT_DOMAIN; readonly group: string; readonly act: "carry"; readonly epoch: number;
  /** The earlier acts' cids that keep standing, each named once. */
  readonly carries: readonly string[];
}
export type KahuaActBody = KahuaLiftBody | KahuaWithdrawBody | KahuaCarryBody;
/** The most cids one carry names; a larger stage carries in several acts. */
export const KAHUA_CARRY_MAX = 4096;
/**
 * The face a fold reads under: its group, the CURRENT roster (`grant`), and, where the caller holds the lineage, the roster
 * of each earlier epoch (`signedAt`), which seats an earlier act in history. Without `signedAt` history holds what stands.
 */
export interface KahuaFoldFace {
  readonly group: string;
  readonly grant: (signer: string) => boolean;
  readonly signedAt?: (epoch: number, signer: string) => boolean;
}
export interface SignedKahuaAct { readonly body: KahuaActBody; readonly signer: string; readonly sig: string }
export type KahuaActRefusal = "shape" | "domain" | "group" | "signature" | "grant" | "origin" | "taint" | "sources" | "parent" | "control-plane-title";
type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };

const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const string = (x: unknown): x is string => typeof x === "string";
const hex64 = (x: unknown): x is string => string(x) && /^[0-9a-f]{64}$/.test(x);
const RESERVED_FIELDS = new Set(["title", "text"]);
/** A field the stage may carry: no reserved name and no `kahua-*` stamp. */
const liftField = (k: string, v: unknown): boolean =>
  string(v) && !RESERVED_FIELDS.has(k) && !k.startsWith("kahua-");

/** Which lift field fails its shape, or null; `origin`, `taint` and `sources` refuse by their own names. */
function liftFault(b: Record<string, unknown>): KahuaActRefusal | null {
  if (!object(b.origin) || !hex64(b.origin.seat) || !hex64(b.origin.device) || !string(b.origin.session) || b.origin.session.length === 0) return "origin";
  if (!Array.isArray(b.taint) || !b.taint.every((t) => string(t) && t.length > 0)) return "taint";
  if (!Array.isArray(b.sources) || b.sources.length === 0 || !b.sources.every((s) => object(s) && string(s.title) && s.title.length > 0 && string(s.revision))) return "sources";
  if (!(b.parent === null || hex64(b.parent))) return "parent";
  if (!string(b.title) || b.title.length === 0 || b.title.startsWith(KAHUA_ACT_PREFIX) || !string(b.text) || !object(b.fields)) return "shape";
  // A lift title names its path plainly: a `.` or `..` segment refuses, so no spelling resolves elsewhere than it reads.
  if (b.title.split("/").some((segment) => segment === "." || segment === "..")) return "shape";
  // No control record rides the fleet-synced stage: a title the daemon's control plane owns never lifts.
  if (isControlPlaneUri(b.title)) return "control-plane-title";
  if (!Object.entries(b.fields).every(([k, v]) => liftField(k, v))) return "shape";
  if (b.proposal !== undefined && !hex64(b.proposal)) return "shape";
  return null;
}
function bodyFault(b: Record<string, unknown>): KahuaActRefusal | null {
  if (!string(b.group) || !Number.isSafeInteger(b.epoch) || (b.epoch as number) < 0) return "shape";
  if (b.act === "lift") return liftFault(b);
  if (b.act === "withdraw") return hex64(b.target) ? null : "shape";
  if (b.act === "carry") {
    const c = b.carries;
    return Array.isArray(c) && c.length > 0 && c.length <= KAHUA_CARRY_MAX && c.every(hex64) && new Set(c).size === c.length ? null : "shape";
  }
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

export function signKahuaCarry(parts: Omit<KahuaCarryBody, "kind" | "act">, signer: Signer): Promise<SignedKahuaAct> {
  return sign({ ...parts, carries: [...parts.carries], kind: KAHUA_ACT_DOMAIN, act: "carry" }, signer);
}

type Judged = { readonly ok: true; readonly act: SignedKahuaAct; readonly cid: string; readonly current: boolean } | { readonly ok: false; readonly refusal: KahuaActRefusal };

/** Judge one record against the face: shape, domain, group, signature, then which roster seats its signer. */
function judgeKahuaAct(raw: unknown, face: KahuaFoldFace): Judged {
  if (!object(raw) || !object(raw.body) || !hex64(raw.signer) || !string(raw.sig)) return { ok: false, refusal: "shape" };
  const body = raw.body;
  if (body.kind !== KAHUA_ACT_DOMAIN) return { ok: false, refusal: "domain" };
  if (body.group !== face.group) return { ok: false, refusal: "group" };
  const fault = bodyFault(body);
  if (fault) return { ok: false, refusal: fault };
  try { if (!verifyEd25519(raw.sig, canonicalJsonBytes(body), raw.signer)) return { ok: false, refusal: "signature" }; }
  catch { return { ok: false, refusal: "signature" }; }
  // Where the lineage reads, the signer must sit in the roster of the epoch the act names; the current roster decides standing.
  const seatedAtEpoch = face.signedAt ? face.signedAt(body.epoch as number, raw.signer) : null;
  const current = face.grant(raw.signer) && seatedAtEpoch !== false;
  if (!current && seatedAtEpoch !== true) return { ok: false, refusal: "grant" };
  const act: SignedKahuaAct = { body: body as unknown as KahuaActBody, signer: raw.signer, sig: raw.sig };
  return { ok: true, act, cid: kahuaActCid(act), current };
}

/** Judge one carried record for landing: shape, domain, face, signature, then the operator's CURRENT grant over its signer. */
export function readKahuaAct(raw: unknown, opts: KahuaFoldFace):
  { readonly ok: true; readonly act: SignedKahuaAct; readonly cid: string } | { readonly ok: false; readonly refusal: KahuaActRefusal } {
  const read = judgeKahuaAct(raw, opts);
  if (!read.ok) return read;
  if (!read.current) return { ok: false, refusal: "grant" };
  return { ok: true, act: read.act, cid: read.cid };
}

export interface KahuaRevision {
  readonly cid: string; readonly title: string; readonly text: string; readonly fields: Readonly<Record<string, string>>;
  readonly parent: string | null; readonly origin: KahuaOrigin; readonly taint: readonly string[]; readonly sources: readonly KahuaSource[];
  readonly proposal: string | null; readonly signer: string; readonly withdrawn: boolean;
  /** The root epoch the lift names. */
  readonly epoch: number;
  /** Whether the revision stands under the current root (its own signer, or a standing carry); false: history alone. */
  readonly standing: boolean;
}
export interface KahuaItem { readonly title: string; readonly status: "standing" | "siblings"; readonly heads: readonly KahuaRevision[] }
export interface KahuaStageReading {
  /** Every standing item, by title (sorted). */
  list(): KahuaItem[];
  /** One title's standing item, or null where none stands (never lifted, or every head withdrawn). */
  get(title: string): KahuaItem | null;
  /** Every verified revision of a title, withdrawn ones and those no current root stands behind included. */
  history(title: string): KahuaRevision[];
  /** A verified revision by cid. */
  revision(cid: string): KahuaRevision | null;
  readonly orphans: readonly KahuaRevision[];
  readonly refused: readonly { readonly cid: string | null; readonly refusal: KahuaActRefusal }[];
}

/** Fold a stage's carried records. Pure: the same records read the same on every device, in any order. */
export function readKahuaStage(records: readonly unknown[], opts: KahuaFoldFace): KahuaStageReading {
  const acts = new Map<string, { act: SignedKahuaAct; current: boolean }>();
  const refused: { cid: string | null; refusal: KahuaActRefusal }[] = [];
  for (const raw of records) {
    const read = judgeKahuaAct(raw, opts);
    if (!read.ok) {
      let cid: string | null = null;
      try { cid = object(raw) && object(raw.body) && string(raw.signer) ? kahuaActCid(raw as unknown as SignedKahuaAct) : null; } catch { cid = null; }
      refused.push({ cid, refusal: read.refusal });
      continue;
    }
    acts.set(read.cid, { act: read.act, current: read.current });
  }
  // STANDING: a current act, or one a current carry names. Carries never chain: only a carry the current roster signed names.
  const standing = new Set<string>();
  for (const [cid, { current }] of acts) if (current) standing.add(cid);
  for (const cid of [...standing]) {
    const body = acts.get(cid)!.act.body;
    if (body.act === "carry") for (const named of body.carries) if (acts.has(named)) standing.add(named);
  }
  const lifts = new Map<string, { act: SignedKahuaAct; body: KahuaLiftBody }>();
  for (const [cid, { act }] of acts) if (act.body.act === "lift") lifts.set(cid, { act, body: act.body });
  const withdrawn = new Set<string>();
  for (const cid of standing) {
    const body = acts.get(cid)!.act.body;
    if (body.act === "withdraw" && lifts.has(body.target)) withdrawn.add(body.target);
  }
  const rev = (cid: string): KahuaRevision => {
    const { act, body } = lifts.get(cid)!;
    return { cid, title: body.title, text: body.text, fields: body.fields, parent: body.parent, origin: body.origin, taint: body.taint,
      sources: body.sources, proposal: body.proposal ?? null, signer: act.signer, withdrawn: withdrawn.has(cid), epoch: body.epoch, standing: standing.has(cid) };
  };
  // A parent counts only as a held, verified revision of the SAME title; only a standing child supersedes it.
  const orphanCids = new Set<string>(), superseded = new Set<string>();
  for (const [cid, { body }] of lifts) {
    if (body.parent === null || !standing.has(cid)) continue;
    const parent = lifts.get(body.parent);
    if (!parent || parent.body.title !== body.title) orphanCids.add(cid);
    else superseded.add(body.parent);
  }
  const byTitle = new Map<string, string[]>();
  for (const [cid, { body }] of lifts) byTitle.set(body.title, [...(byTitle.get(body.title) ?? []), cid]);
  const itemOf = (title: string): KahuaItem | null => {
    const heads = (byTitle.get(title) ?? []).filter((cid) => standing.has(cid) && !superseded.has(cid) && !orphanCids.has(cid) && !withdrawn.has(cid)).sort().map(rev);
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

/**
 * The cids a `carry` restores when the operator carries the whole stage: each title's head as the history would read had
 * every earlier root kept standing (a revision a later verified lift superseded, or a verified withdraw tombstoned, stays
 * down), less what already stands. The operator's hand signs the carry; this names what it would carry.
 */
export function kahuaCarryCandidates(records: readonly unknown[], face: KahuaFoldFace): string[] {
  if (!face.signedAt) return [];
  const now = readKahuaStage(records, face);
  const kept = readKahuaStage(records, { group: face.group, grant: () => true, signedAt: face.signedAt });
  return kept.list().flatMap((item) => item.heads.map((h) => h.cid)).filter((cid) => now.revision(cid)?.standing !== true).sort();
}

export function kahuaActKey(group: string, cid: string): string { return `${KAHUA_ACT_PREFIX}${encodeURIComponent(group)}/${cid}`; }
/** Land an act record on a stage draft. Call INSIDE a `handle.change()`. */
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

/** The address family of a face's stage: one doc per face, derived from its group. */
const KAHUA_STAGE_URI = "lar:///ha.ka.ba/dreamnet/kahua-stage" as const;

/** The face's ONE stage doc url, every device of the face computing it alike: no mint race, no second stage. */
export function kahuaStageDocUrl(group: string): AutomergeUrl {
  return deterministicDocUrl(`${KAHUA_STAGE_URI}/${group.trim().toLowerCase()}`);
}

/**
 * The stage url the face's verified projection pins, or null. It answers only the face's derived stage: a pin naming any
 * other doc, a bootstrap, catalog or doc value never answers.
 */
export function kahuaPlaneUrl(projection: { readonly planes: Readonly<Record<string, string | undefined>> }, group: string): string | null {
  const url = kahuaStageDocUrl(group);
  return projection.planes[KAHUA_PLANE] === url ? url : null;
}

/**
 * A device of the face ADOPTS its stage at boot: where the face's verified projection pins the derived stage, the doc stands
 * in this repo (a blank under the derived id merges with every replica) and the catalog row names it, so the recipe knows
 * where to mount. The row stays a mount hint: the layer trusts the fold, never the row. An unpinned face adopts nothing.
 */
export async function adoptKahuaStage(input: {
  readonly repo: Repo;
  readonly group: string;
  /** The face's VERIFIED projection (the boot's face proof). */
  readonly projection: { readonly planes: Readonly<Record<string, string | undefined>> };
  readonly register: (bagId: string, url: string) => void;
}): Promise<AutomergeUrl | null> {
  if (kahuaPlaneUrl(input.projection, input.group) === null) return null;
  const handle = await materializeSharedLarDoc(input.repo, kahuaStageDocUrl(input.group), "kahua:stage");
  input.register(KAHUA_DOC_URI, handle.url);
  return handle.url;
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

/**
 * THE ONE PROPOSAL READER, for the node's lift door and a browser reader alike: the verified kahua proposal batch with
 * intent id `id` on a face's intents plane, signed by a device the face's verified projection admits, or null. A
 * stranger's well-formed batch reads null whatever digest it names.
 */
export function findKahuaProposal(intents: LarDoc | undefined | null, group: string, devices: readonly string[], id: string):
  { readonly batch: { readonly session: string; readonly proposals: readonly KahuaProposal[] }; readonly issuer: string; readonly cid: string } | null {
  const admitted = new Set(devices);
  for (const raw of intentEntryRecordsOfGroup(intents, group)) {
    const read = readIntentEntry(raw, { group, authorize: (signer) => admitted.has(signer) });
    if (!read.ok || read.entry.body.entry !== "intent") continue;
    const body = read.entry.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string };
    if (intentId(body) !== id) continue;
    const batch = readKahuaProposal(read.entry);
    if (batch) return { batch, issuer: body.issuer, cid: read.cid };
  }
  return null;
}

/** The sha-256 digest a proposal names for a body. */
export function kahuaBodyDigest(text: string): string { return sha256HexBytesSync(new TextEncoder().encode(text)); }
