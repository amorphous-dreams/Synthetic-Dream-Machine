import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { INTENT_ADMISSION_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { intentId, readIntentEntry, type SignedIntentEntry } from "./intent-entry.js";
import { readIntentPlane, type IntentReadInput } from "./intent-read.js";
import type { IntentRelayRefusal } from "./intent-relay-door.js";
import { storedLarRecord } from "./stored-record.js";

export interface SignedIntentAdmission { readonly body: { readonly kind: typeof INTENT_ADMISSION_DOMAIN; readonly group: string; readonly relay: string; readonly entry: string; readonly delegation: string; readonly heads: readonly string[] }; readonly sig: string }
type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
const hex = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export async function signIntentAdmission(parts: { readonly group: string; readonly entry: string; readonly delegation: string; readonly heads: readonly string[] }, signer: Signer): Promise<SignedIntentAdmission> {
  const body = { kind: INTENT_ADMISSION_DOMAIN, group: parts.group, relay: signer.key.toLowerCase(), entry: parts.entry, delegation: parts.delegation, heads: [...new Set(parts.heads)].sort() };
  return { body, sig: await signer.sign(canonicalJsonBytes(body)) };
}
export function intentAdmissionCid(admission: SignedIntentAdmission): string { return sha256HexBytesSync(canonicalJsonBytes(admission.body)); }
export function readIntentAdmission(raw: unknown, opts: { readonly group: string }): { ok: true; admission: SignedIntentAdmission; cid: string } | { ok: false; refusal: "shape" | "domain" | "group" | "signature" } {
  if (!obj(raw) || !obj(raw.body) || typeof raw.sig !== "string" || typeof raw.body.kind !== "string" || typeof raw.body.group !== "string") return { ok: false, refusal: "shape" };
  const b = raw.body;
  if (b.kind !== INTENT_ADMISSION_DOMAIN) return { ok: false, refusal: "domain" };
  if (b.group !== opts.group) return { ok: false, refusal: "group" };
  if (!hex(b.relay) || !hex(b.entry) || !hex(b.delegation) || !Array.isArray(b.heads) || !b.heads.every(hex) || b.heads.some((v, i, a) => i > 0 && a[i-1]! >= v)) return { ok: false, refusal: "shape" };
  try { if (!verifyEd25519(raw.sig, canonicalJsonBytes(b), b.relay)) return { ok: false, refusal: "signature" }; } catch { return { ok: false, refusal: "signature" }; }
  const admission = raw as unknown as SignedIntentAdmission;
  return { ok: true, admission, cid: intentAdmissionCid(admission) };
}
export const INTENT_ADMISSION_PREFIX = "lar:///ha.ka.ba/dreamnet/intent-admission/";
export function intentAdmissionKey(group: string, cid: string): string { return `${INTENT_ADMISSION_PREFIX}${encodeURIComponent(group)}/${cid}`; }
export function writeIntentAdmission(draft: LarDoc, admission: SignedIntentAdmission): void { const cid = intentAdmissionCid(admission), key = intentAdmissionKey(admission.body.group, cid); draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(admission) }, cid); }
export function intentAdmissionRecordsOfGroup(doc: LarDoc | undefined | null, group: string): unknown[] { const prefix = `${INTENT_ADMISSION_PREFIX}${encodeURIComponent(group)}/`, out: unknown[] = []; for (const [key, record] of Object.entries(doc?.tiddlers ?? {})) { if (!key.startsWith(prefix)) continue; const text = tiddlerText(record); if (text !== null) try { out.push(JSON.parse(text)); } catch { /* torn carriage */ } } return out; }
export function localIntentHeads(records: readonly unknown[]): readonly string[] { const all = new Map<string, SignedIntentEntry>(); for (const raw of records) { if (!obj(raw) || !obj(raw.body) || typeof raw.body.group !== "string") continue; const r = readIntentEntry(raw, { group: raw.body.group, authorize: () => true }); if (r.ok) all.set(r.cid, r.entry); } const refs = new Set([...all.values()].flatMap(e => [...e.body.refs])); return [...all.keys()].filter(cid => !refs.has(cid)).sort(); }
export function decideAdmission(input: { readonly group: string; readonly raw: unknown; readonly read: Omit<IntentReadInput, "records">; readonly records: readonly unknown[] }): { ok: true; entry: SignedIntentEntry; cid: string; delegation: string; duplicate: boolean } | { ok: false; refusal: IntentRelayRefusal } {
  if (obj(input.raw) && typeof input.raw.signer === "string" && input.raw.signer !== input.raw.signer.toLowerCase()) return { ok: false, refusal: "entry-refused" };
  const r = readIntentEntry(input.raw, { group: input.group, authorize: () => true });
  if (!r.ok) return { ok: false, refusal: r.refusal === "group" ? "group" : ["shape", "domain", "unknown-entry"].includes(r.refusal) ? "malformed" : "entry-refused" };
  if (r.entry.body.entry !== "intent" || typeof r.entry.body.delegation !== "string") return { ok: false, refusal: "entry-refused" };
  const id = intentId(r.entry.body as unknown as Parameters<typeof intentId>[0]);
  // A copy under this id that the fold itself accepts (signer, issuer and delegation checks pass) with another cid makes a
  // collision, never a fresh intent; an entry the fold refuses establishes none, so a planted forgery poisons no id.
  const existing = readIntentPlane({ ...input.read, records: input.records });
  if (existing.collisions.some(c => c.id === id) || existing.intents.some(i => i.id === id && i.cid !== r.cid)) return { ok: false, refusal: "id-collision" };
  const others = input.records.filter(raw => {
    const entry = readIntentEntry(raw, { group: input.group, authorize: () => true });
    return !entry.ok || entry.entry.body.entry !== "intent" || intentId(entry.entry.body as unknown as Parameters<typeof intentId>[0]) !== id;
  });
  const before = readIntentPlane({ ...input.read, records: others }), after = readIntentPlane({ ...input.read, records: [...others, r.entry] });
  const counts = new Map<string, number>(); for (const x of before.refused) counts.set(x.refusal, (counts.get(x.refusal) ?? 0) + 1);
  for (const x of after.refused) { const n = counts.get(x.refusal) ?? 0; if (n) counts.set(x.refusal, n - 1); else return { ok: false, refusal: (["delegation-unknown", "agent-key", "verb-outside-prefix", "args-outside-policy"].includes(x.refusal) ? x.refusal : "entry-refused") as IntentRelayRefusal }; }
  const status = after.intents.find(i => i.id === id)?.agent?.status;
  if (status !== "live") return { ok: false, refusal: status === "revoked" ? "delegation-revoked" : status === "closed" ? "delegation-closed" : status === "awaiting" ? "unknown-frontier" : "entry-refused" };
  const duplicate = input.records.some(raw => { const e = readIntentEntry(raw, { group: input.group, authorize: () => true }); return e.ok && e.cid === r.cid; });
  return { ok: true, entry: r.entry, cid: r.cid, delegation: r.entry.body.delegation, duplicate };
}
