/**
 * promote — classify what a loader on the island would execute or trust, and carry verified promotion bytes.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { PROMOTE_WARD_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";

export type PromoteClass = "module-type" | "executable-type" | "startup-action" | "raw-markup" | "module-gate" | "plugin" | "wasm";
export interface Promotable { title: string; text: string; fields: Readonly<Record<string, string>> }
const EXECUTABLE_TYPES = new Set(["application/javascript", "text/javascript", "application/x-javascript", "application/ecmascript", "text/ecmascript", "module"]);
const normalizedMimeType = (value: string): string => value.split(";", 1)[0]!.trim().toLowerCase();
const MODULE_COMPONENT = "lar:///ha.ka.ba/lararium/tw5/tw5-module";
const stringList = (value: string): string[] => Array.from(value.matchAll(/\[\[([^\]]*)\]\]|([^\s]+)/g), m => m[1] ?? m[2]!);

export function promoteClass(item: Promotable): PromoteClass[] {
  const f = item.fields, tags = stringList(f["tags"] ?? ""), stack = stringList(f["stack"] ?? "");
  const classes: PromoteClass[] = [];
  if (f["module-type"]) classes.push("module-type");
  if (EXECUTABLE_TYPES.has(normalizedMimeType(f["type"] ?? ""))) classes.push("executable-type");
  if (tags.some(t => /^\$:\/tags\/StartupAction(\/.*)?$/.test(t))) classes.push("startup-action");
  if (tags.some(t => /^\$:\/tags\/RawMarkup(Wikified)?(\/.*)?$/.test(t))) classes.push("raw-markup");
  if (Object.hasOwn(f, "source-sha256") || tags.includes(MODULE_COMPONENT) || stack.includes(MODULE_COMPONENT)) classes.push("module-gate");
  if (f["plugin-type"]) classes.push("plugin");
  if (normalizedMimeType(f["type"] ?? "") === "application/wasm") classes.push("wasm");
  return classes;
}
export const promotePreloadEntry = (item: Promotable): Record<string, string> => ({ ...item.fields, title: item.title, text: item.text });
export const promotePreloadBytes = (item: Promotable): Uint8Array => canonicalJsonBytes(promotePreloadEntry(item));
export const promoteDigest = (item: Promotable): string => sha256HexBytesSync(promotePreloadBytes(item));
export class PromoteRefused extends Error {
  override name = "PromoteRefused";
  constructor(public code: string, detail: string) { super(`${code}: ${detail}`); }
}
export const promoteEdgeKey = (wiki: string, digest: string): string => `${wiki}\n${digest}`;
/**
 * THE WARD BINDS THE DAEMON REALM. Users keep full caps over their own wikis; the daemon wiki and the kahua stage are bound by the
 * ward (operator, 2026-11-04): a promotion there carries the face root's signature (`wardSig`), made under a fresh ward unlock.
 */
export const isWardBoundWiki = (wiki: string): boolean => wiki === "daemon" || wiki === "kahua" || wiki.startsWith("kahua-");
/** The face root's signature over a bound promotion, under a fresh ward unlock: what boot reads before a daemon or kahua row runs. */
export interface PromotionWardSig { key: string; sig: string }
export interface PromotionRow { wiki: string; digest: string; title: string; revision: string; hand: string; seq: number; bytes: string; kept?: true; wardSig?: PromotionWardSig }
/** The bytes a ward signature covers: its own domain, the wiki, the digest and the row's sequence (a row moved to another seq voids). */
export const promotionWardBytes = (row: Pick<PromotionRow, "wiki" | "digest" | "seq">): Uint8Array =>
  canonicalJsonBytes({ kind: PROMOTE_WARD_DOMAIN, wiki: row.wiki, digest: row.digest, seq: row.seq });
/** Sign a bound promotion as the face root (the signer opens under the ward for this one act). */
export async function signPromotionWard(row: Pick<PromotionRow, "wiki" | "digest" | "seq">, signer: { readonly key: string; sign(bytes: Uint8Array): Promise<string> }): Promise<PromotionWardSig> {
  return { key: signer.key.toLowerCase(), sig: await signer.sign(promotionWardBytes(row)) };
}
/** The face a boot reads ward signatures against: the root keys its signed log grants. */
export interface PromotionWardFace { readonly grant: (key: string) => boolean }
export interface PromotionLedger { seq: number; rows: readonly PromotionRow[] }
export const EMPTY_LEDGER: PromotionLedger = { seq: 0, rows: [] };
export type PromoteWho = { kind: "hand" | "seat"; id: string };
const requireHand = (who: PromoteWho): void => { if (who.kind !== "hand") throw new PromoteRefused("promote-needs-hand", "a hand must decide"); };
export function ledgerCommit(l: PromotionLedger, input: { wiki: string; digest: string; item: Promotable; revision: string; wardSig?: PromotionWardSig }, who: PromoteWho): PromotionLedger {
  requireHand(who);
  if (input.digest !== promoteDigest(input.item)) throw new PromoteRefused("promote-digest-mismatch", "the digest does not name the preload");
  const seq = l.seq + 1;
  const row: PromotionRow = { wiki: input.wiki, digest: input.digest, title: input.item.title, revision: input.revision, hand: who.id, seq, bytes: new TextDecoder().decode(promotePreloadBytes(input.item)), ...(input.wardSig ? { wardSig: input.wardSig } : {}) };
  return { seq, rows: [...l.rows.filter(r => r.wiki !== row.wiki || (r.title !== row.title && r.digest !== row.digest)), row] };
}
export function ledgerUnpromote(l: PromotionLedger, edge: { wiki: string; digest: string }, who: PromoteWho): PromotionLedger {
  requireHand(who);
  if (!l.rows.some(r => r.wiki === edge.wiki && r.digest === edge.digest)) throw new PromoteRefused("promote-unknown", "no row carries the edge");
  return { ...l, rows: l.rows.filter(r => r.wiki !== edge.wiki || r.digest !== edge.digest) };
}
export function ledgerDecideOrphan(l: PromotionLedger, edge: { wiki: string; digest: string }, decision: "keep" | "drop", who: PromoteWho): PromotionLedger {
  requireHand(who);
  if (!l.rows.some(r => r.wiki === edge.wiki && r.digest === edge.digest)) throw new PromoteRefused("promote-unknown", "no row carries the edge");
  return { ...l, rows: decision === "drop" ? l.rows.filter(r => r.wiki !== edge.wiki || r.digest !== edge.digest) : l.rows.map(r => r.wiki === edge.wiki && r.digest === edge.digest ? { ...r, kept: true } : r) };
}
export const encodeLedger = (l: PromotionLedger): Uint8Array => canonicalJsonBytes(l);
const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const keys = (x: Record<string, unknown>, required: string[], optional: string[] = []): boolean => required.every(k => Object.hasOwn(x, k)) && Object.keys(x).every(k => required.includes(k) || optional.includes(k));
const hex64 = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);
const str = (x: unknown): x is string => typeof x === "string";
const integer = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x);
export function decodeLedger(bytes: Uint8Array): PromotionLedger {
 try {
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!object(value) || !keys(value, ["seq", "rows"]) || !integer(value.seq) || value.seq < 0 || !Array.isArray(value.rows)) throw 0;
  if (!value.rows.every((r: unknown) => object(r) && keys(r, ["wiki", "digest", "title", "revision", "hand", "seq", "bytes"], ["kept", "wardSig"]) && str(r.wiki) && r.wiki.length > 0 && hex64(r.digest) && str(r.title) && str(r.revision) && str(r.hand) && integer(r.seq) && r.seq >= 0 && str(r.bytes) && (!Object.hasOwn(r, "kept") || r.kept === true)
    && (!Object.hasOwn(r, "wardSig") || (object(r.wardSig) && keys(r.wardSig, ["key", "sig"]) && hex64(r.wardSig.key) && str(r.wardSig.sig))))) throw 0;
  return value as unknown as PromotionLedger;
 } catch { throw new PromoteRefused("ledger-malformed", "the ledger has an invalid shape"); }
}
/** Whether a bound row's ward signature stands: a key the face grants, over this row's own (wiki, digest, seq). */
function wardSigStands(row: PromotionRow, face: PromotionWardFace | undefined): boolean {
  if (!face || !row.wardSig) return false;
  try { return face.grant(row.wardSig.key) && verifyEd25519(row.wardSig.sig, promotionWardBytes(row), row.wardSig.key); } catch { return false; }
}
export type PromotionVoid = "digest-mismatch" | "bytes-malformed" | "ward-unsigned";
/**
 * The rows that may run, and the voided rest by reason. A row of a ward-bound wiki (the daemon wiki, the kahua stage) runs only with
 * a ward signature the face grants, whoever wrote it into the ledger (a write straight into custody included); with no `face` to
 * read against, a bound row voids. A user's own wiki carries none and stands as its digest and bytes do.
 */
export function verifyPromotionRows(rows: readonly PromotionRow[], face?: PromotionWardFace): { verified: PromotionRow[]; voided: { digest: string; reason: PromotionVoid }[] } {
  const verified: PromotionRow[] = [], voided: { digest: string; reason: PromotionVoid }[] = [];
  for (const row of rows) {
    if (isWardBoundWiki(row.wiki) && !wardSigStands(row, face)) { voided.push({ digest: row.digest, reason: "ward-unsigned" }); continue; }
    if (sha256HexBytesSync(new TextEncoder().encode(row.bytes)) !== row.digest) { voided.push({ digest: row.digest, reason: "digest-mismatch" }); continue; }
    try {
      const parsed: unknown = JSON.parse(row.bytes);
      if (!object(parsed) || parsed["title"] !== row.title) throw 0;
      verified.push(row);
    } catch { voided.push({ digest: row.digest, reason: "bytes-malformed" }); }
  }
  return { verified, voided };
}
export type PromotionState = { row: PromotionRow; state: "standing" | "update-waits" | "orphaned" | "kept"; head?: string };
export function reconcilePromotions(rows: readonly PromotionRow[], source: (wiki: string, title: string) => string | null): PromotionState[] {
 return rows.map(row => { const current = source(row.wiki, row.title); return current === null ? { row, state: row.kept ? "kept" : "orphaned" } : current === row.digest ? { row, state: "standing" } : { row, state: "update-waits", head: current }; });
}
export const promotedPreloads = (verified: readonly PromotionRow[], wiki: string, shadowed?: ReadonlySet<string>): Record<string, unknown>[] => verified.filter(r => r.wiki === wiki && !shadowed?.has(promoteEdgeKey(r.wiki, r.digest))).map(r => JSON.parse(r.bytes) as Record<string, unknown>);
