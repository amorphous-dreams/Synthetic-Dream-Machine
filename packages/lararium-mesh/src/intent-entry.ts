/** Signed, content-addressed entries on one face's intent plane. */
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { INTENT_DELEGATION_DOMAIN, INTENT_ENTRY_DOMAIN } from "./domains.js";
import { validDelegateBody, validDelegationRevokeBody } from "./intent-delegation.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { storedLarRecord } from "./stored-record.js";

export type IntentEntryKind = "intent" | "outcome" | "asks" | "answer" | "claim" | "release" | "takeover" | "supersede" | "cancel" | "delegate" | "delegate-revoke";
export type IntentAudience = { readonly mode: "pinned"; readonly atom: string } | { readonly mode: "prefer"; readonly atoms: readonly string[] } | { readonly mode: "class"; readonly capability: string } | { readonly mode: "every" } | { readonly mode: "asks" };
export interface IntentBound { readonly void?: string; readonly through?: string }
export interface IntentEntryBody {
  readonly kind: typeof INTENT_ENTRY_DOMAIN | typeof INTENT_DELEGATION_DOMAIN;
  readonly group: string;
  readonly entry: IntentEntryKind;
  readonly refs: readonly string[];
  readonly epoch?: number;
  readonly [field: string]: unknown;
}
export interface SignedIntentEntry { readonly body: IntentEntryBody; readonly signer: string; readonly sig: string }
export type IntentEntryRefusal = "shape" | "domain" | "group" | "signature" | "unauthorized" | "unknown-entry";
type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const string = (x: unknown): x is string => typeof x === "string";
const atom = (x: unknown): x is string => string(x) && /^[0-9a-f]+$/.test(x) && x.length === 64;
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every(string);
const audience = (x: unknown): x is IntentAudience => object(x) && (
  (x.mode === "pinned" && atom(x.atom)) || (x.mode === "prefer" && Array.isArray(x.atoms) && x.atoms.length > 0 && x.atoms.every(atom)) ||
  (x.mode === "class" && string(x.capability) && x.capability.length > 0) || x.mode === "every" || x.mode === "asks"
);
const bound = (x: unknown): x is IntentBound => object(x) && (x.void === undefined || string(x.void)) && (x.through === undefined || string(x.through));
const json = (x: unknown): boolean => { try { canonicalJsonBytes(x); return true; } catch { return false; } };

/** The invocation identity excludes audience, bounds, and entry references. */
export function intentId(parts: { readonly issuer: string; readonly verb: string; readonly args: unknown; readonly nonce: string }): string {
  return sha256HexBytesSync(canonicalJsonBytes({ domain: INTENT_ENTRY_DOMAIN, issuer: parts.issuer, verb: parts.verb, args: parts.args, nonce: parts.nonce }));
}
/** The CID names the signed entry: the body and its signer, so two devices that sign one body stay two entries. */
export function intentEntryCid(entry: { readonly body: IntentEntryBody; readonly signer: string }): string { return sha256HexBytesSync(canonicalJsonBytes({ body: entry.body, signer: entry.signer.toLowerCase() })); }

/** The caller supplies the face and all entry fields; refs receive canonical set ordering. */
export async function signIntentEntry(parts: Omit<IntentEntryBody, "kind">, signer: Signer): Promise<SignedIntentEntry> {
  const body = { ...parts, kind: parts.entry === "delegate" ? INTENT_DELEGATION_DOMAIN : INTENT_ENTRY_DOMAIN, refs: [...new Set(parts.refs as readonly string[])].sort() } as unknown as IntentEntryBody;
  if (!validBody(body)) throw new Error("intent-entry: shape");
  return { body, signer: signer.key.toLowerCase(), sig: await signer.sign(canonicalJsonBytes(body)) };
}

function validBody(b: Record<string, unknown>): boolean {
  if (!string(b.group) || !strings(b.refs) || b.refs.some((r, i, a) => i > 0 && a[i - 1]! >= r) || "seq" in b || "prior" in b) return false;
  if (b.epoch !== undefined && (!Number.isSafeInteger(b.epoch) || (b.epoch as number) < 0)) return false;
  switch (b.entry) {
    case "intent": return atom(b.issuer) && string(b.verb) && b.verb.length > 0 && string(b.nonce) && audience(b.audience) && (b.bound === undefined || bound(b.bound)) && json(b.args) &&
      (b.delegation === undefined || (atom(b.delegation) && b.refs.includes(b.delegation)));
    case "delegate": return validDelegateBody(b);
    case "delegate-revoke": return validDelegationRevokeBody(b);
    case "outcome": return string(b.cause) && json(b.result) && (b.slot === undefined || string(b.slot));
    case "asks": return string(b.intent) && ["approval", "executor", "capability"].includes(String(b.needs)) && (b.detail === undefined || json(b.detail));
    case "answer": return string(b.ask) && (b.executor === undefined || atom(b.executor)) && (b.verdict === "approve" || b.verdict === "deny");
    case "claim": case "cancel": return string(b.intent);
    case "takeover": return string(b.claim);
    case "release": return string(b.intent) && (b.claim === undefined || string(b.claim));
    case "supersede": return string(b.intent) && (b.by === undefined || string(b.by));
    default: return false;
  }
}

export function readIntentEntry(raw: unknown, opts: { readonly group: string; readonly authorize: (signer: string, body: IntentEntryBody) => boolean }):
  { readonly ok: true; readonly entry: SignedIntentEntry; readonly cid: string } | { readonly ok: false; readonly refusal: IntentEntryRefusal } {
  if (!object(raw) || !object(raw.body) || !string(raw.signer) || !string(raw.sig)) return { ok: false, refusal: "shape" };
  const body = raw.body;
  if (!string(body.kind) || !string(body.group)) return { ok: false, refusal: "shape" };
  if (body.kind !== INTENT_ENTRY_DOMAIN && body.kind !== INTENT_DELEGATION_DOMAIN) return { ok: false, refusal: "domain" };
  if (body.group !== opts.group) return { ok: false, refusal: "group" };
  if (!string(body.entry)) return { ok: false, refusal: "shape" };
  if (!["intent", "outcome", "asks", "answer", "claim", "release", "takeover", "supersede", "cancel", "delegate", "delegate-revoke"].includes(body.entry)) return { ok: false, refusal: "unknown-entry" };
  if (body.kind !== (body.entry === "delegate" ? INTENT_DELEGATION_DOMAIN : INTENT_ENTRY_DOMAIN)) return { ok: false, refusal: "domain" };
  if (!validBody(body)) return { ok: false, refusal: "shape" };
  const entry: SignedIntentEntry = { body: body as unknown as IntentEntryBody, signer: raw.signer.toLowerCase(), sig: raw.sig };
  try { if (!verifyEd25519(entry.sig, canonicalJsonBytes(body), entry.signer)) return { ok: false, refusal: "signature" }; }
  catch { return { ok: false, refusal: "signature" }; }
  if (!opts.authorize(entry.signer, entry.body)) return { ok: false, refusal: "unauthorized" };
  return { ok: true, entry, cid: intentEntryCid(entry) };
}

export const INTENT_ENTRY_PREFIX = "lar:///ha.ka.ba/dreamnet/intent-entry/";
export function intentEntryKey(group: string, cid: string): string { return `${INTENT_ENTRY_PREFIX}${encodeURIComponent(group)}/${cid}`; }
export function writeIntentEntry(draft: LarDoc, entry: SignedIntentEntry): void {
  const cid = intentEntryCid(entry), key = intentEntryKey(entry.body.group, cid);
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(entry) }, cid);
}
export function intentEntryRecordsOfGroup(doc: LarDoc | undefined | null, group: string): unknown[] {
  const prefix = `${INTENT_ENTRY_PREFIX}${encodeURIComponent(group)}/`, out: unknown[] = [];
  for (const [title, record] of Object.entries(doc?.tiddlers ?? {})) {
    if (!title.startsWith(prefix)) continue;
    const text = tiddlerText(record);
    if (text !== null) try { out.push(JSON.parse(text)); } catch { /* torn carriage */ }
  }
  return out;
}
