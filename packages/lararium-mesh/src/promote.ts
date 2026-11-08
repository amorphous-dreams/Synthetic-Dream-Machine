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
/** The ledger a bound row belongs to: its device's atom key. A ward signature names it, so a row copied into another device's ledger voids. */
export interface PromotionOwner { readonly owner: string }
/**
 * The bytes a ward signature covers: its own domain, the wiki, the digest, the row's sequence (a row moved to another seq voids) and the
 * owner, the device whose ledger holds the row (a row moved to another device's ledger voids, and a drop names only its own device's row).
 */
export const promotionWardBytes = (row: Pick<PromotionRow, "wiki" | "digest" | "seq"> & PromotionOwner): Uint8Array =>
  canonicalJsonBytes({ kind: PROMOTE_WARD_DOMAIN, wiki: row.wiki, digest: row.digest, seq: row.seq, owner: row.owner.toLowerCase() });
/** Sign a bound promotion as the face root (the signer opens under the ward for this one act). */
export async function signPromotionWard(row: Pick<PromotionRow, "wiki" | "digest" | "seq"> & PromotionOwner, signer: { readonly key: string; sign(bytes: Uint8Array): Promise<string> }): Promise<PromotionWardSig> {
  return { key: signer.key.toLowerCase(), sig: await signer.sign(promotionWardBytes(row)) };
}
/** The face a boot reads ward signatures against: the root keys its signed log grants. */
export interface PromotionWardFace { readonly grant: (key: string) => boolean }
/** A bound row that left the ledger (dropped, or replaced by a newer commit): its old ward signature never runs again. */
export interface PromotionTombstone { wiki: string; digest: string; seq: number }
export interface PromotionLedger { seq: number; rows: readonly PromotionRow[]; dropped?: readonly PromotionTombstone[] }
/** Tombstone every bound row of `gone`: a ward signature names its (wiki, digest, seq), so a replay of it reads dropped. */
const entomb = (l: PromotionLedger, gone: readonly PromotionRow[]): readonly PromotionTombstone[] | undefined => {
  const bound = gone.filter((r) => isWardBoundWiki(r.wiki)).map((r) => ({ wiki: r.wiki, digest: r.digest, seq: r.seq }));
  return bound.length === 0 ? l.dropped : [...(l.dropped ?? []), ...bound];
};
const withDropped = (l: PromotionLedger, dropped: readonly PromotionTombstone[] | undefined): PromotionLedger => (dropped && dropped.length > 0 ? { ...l, dropped } : l);
export const EMPTY_LEDGER: PromotionLedger = { seq: 0, rows: [] };
export type PromoteWho = { kind: "hand" | "seat"; id: string };
const requireHand = (who: PromoteWho): void => { if (who.kind !== "hand") throw new PromoteRefused("promote-needs-hand", "a hand must decide"); };
export function ledgerCommit(l: PromotionLedger, input: { wiki: string; digest: string; item: Promotable; revision: string; wardSig?: PromotionWardSig }, who: PromoteWho): PromotionLedger {
  requireHand(who);
  if (input.digest !== promoteDigest(input.item)) throw new PromoteRefused("promote-digest-mismatch", "the digest does not name the preload");
  const seq = l.seq + 1;
  if (!Number.isSafeInteger(seq)) throw new PromoteRefused("promote-seq-exhausted", "the ledger's next seq leaves the safe integers");
  const row: PromotionRow = { wiki: input.wiki, digest: input.digest, title: input.item.title, revision: input.revision, hand: who.id, seq, bytes: new TextDecoder().decode(promotePreloadBytes(input.item)), ...(input.wardSig ? { wardSig: input.wardSig } : {}) };
  const replaced = l.rows.filter(r => r.wiki === row.wiki && (r.title === row.title || r.digest === row.digest));
  return withDropped({ seq, rows: [...l.rows.filter(r => !replaced.includes(r)), row] }, entomb(l, replaced));
}
export function ledgerUnpromote(l: PromotionLedger, edge: { wiki: string; digest: string }, who: PromoteWho): PromotionLedger {
  requireHand(who);
  if (!l.rows.some(r => r.wiki === edge.wiki && r.digest === edge.digest)) throw new PromoteRefused("promote-unknown", "no row carries the edge");
  const gone = l.rows.filter(r => r.wiki === edge.wiki && r.digest === edge.digest);
  return withDropped({ ...l, rows: l.rows.filter(r => !gone.includes(r)) }, entomb(l, gone));
}
export function ledgerDecideOrphan(l: PromotionLedger, edge: { wiki: string; digest: string }, decision: "keep" | "drop", who: PromoteWho): PromotionLedger {
  requireHand(who);
  if (!l.rows.some(r => r.wiki === edge.wiki && r.digest === edge.digest)) throw new PromoteRefused("promote-unknown", "no row carries the edge");
  const gone = decision === "drop" ? l.rows.filter(r => r.wiki === edge.wiki && r.digest === edge.digest) : [];
  return withDropped({ ...l, rows: decision === "drop" ? l.rows.filter(r => !gone.includes(r)) : l.rows.map(r => r.wiki === edge.wiki && r.digest === edge.digest ? { ...r, kept: true } : r) }, entomb(l, gone));
}
/** The codec refuses on the way in what it refuses on the way out: a ledger that would not read back never reaches its row. */
export const encodeLedger = (l: PromotionLedger): Uint8Array => { const bytes = canonicalJsonBytes(l); decodeLedger(bytes); return bytes; };
const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const keys = (x: Record<string, unknown>, required: string[], optional: string[] = []): boolean => required.every(k => Object.hasOwn(x, k)) && Object.keys(x).every(k => required.includes(k) || optional.includes(k));
const hex64 = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);
const str = (x: unknown): x is string => typeof x === "string";
const integer = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x);
export function decodeLedger(bytes: Uint8Array): PromotionLedger {
 try {
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!object(value) || !keys(value, ["seq", "rows"], ["dropped"]) || !integer(value.seq) || value.seq < 0 || !Array.isArray(value.rows)) throw 0;
  if (Object.hasOwn(value, "dropped") && !(Array.isArray(value.dropped) && value.dropped.every((t: unknown) => object(t) && keys(t, ["wiki", "digest", "seq"]) && str(t.wiki) && hex64(t.digest) && integer(t.seq)))) throw 0;
  if (!value.rows.every((r: unknown) => object(r) && keys(r, ["wiki", "digest", "title", "revision", "hand", "seq", "bytes"], ["kept", "wardSig"]) && str(r.wiki) && r.wiki.length > 0 && hex64(r.digest) && str(r.title) && str(r.revision) && str(r.hand) && integer(r.seq) && r.seq >= 0 && str(r.bytes) && (!Object.hasOwn(r, "kept") || r.kept === true)
    && (!Object.hasOwn(r, "wardSig") || (object(r.wardSig) && keys(r.wardSig, ["key", "sig"]) && hex64(r.wardSig.key) && str(r.wardSig.sig))))) throw 0;
  return value as unknown as PromotionLedger;
 } catch { throw new PromoteRefused("ledger-malformed", "the ledger has an invalid shape"); }
}
/** Whether a bound row's ward signature stands: a key the face grants, over this row's own (wiki, digest, seq) in this device's ledger. */
function wardSigStands(row: PromotionRow, face: PromotionWardFace | undefined, owner: string): boolean {
  if (!face || !row.wardSig) return false;
  try { return face.grant(row.wardSig.key) && verifyEd25519(row.wardSig.sig, promotionWardBytes({ ...row, owner }), row.wardSig.key); } catch { return false; }
}
export type PromotionVoid = "digest-mismatch" | "bytes-malformed" | "ward-unsigned" | "ward-dropped" | "ward-floor-unread";
/**
 * THE DROP FLOOR (road `L23`): the bound rows this device (`owner`) dropped, as its own drops on the face-private board name them, keyed
 * `wiki\ndigest\nseq`. The ledger rests in a custody row any writer of unlocked custody can rewrite; a custody write never reaches the
 * board, and the board's history keeps a drop a later change deleted, so a stripped tombstone strips no drop. A rollback of the board's
 * own storage on a face with no sibling device stays the named limit (seat-harness#/the-ward).
 */
export interface PromotionDropFloor extends PromotionOwner { readonly dropped: () => ReadonlySet<string> }
/**
 * The rows that may run, and the voided rest by reason. A row of a ward-bound wiki (the daemon wiki, the kahua stage) runs only with
 * a ward signature the face grants, whoever wrote it into the ledger (a write straight into custody included); with no `face` to
 * read against, a bound row voids. It runs only where `floor` (the board's drops) could be read and neither the floor nor the
 * ledger's own tombstones name it; with no floor (an unread board, or none handed), a bound row voids `ward-floor-unread`. A user's
 * own wiki carries none and stands as its digest and bytes do.
 */
export function verifyPromotionRows(rows: readonly PromotionRow[], face?: PromotionWardFace, ledger?: Pick<PromotionLedger, "dropped">, floor?: PromotionDropFloor | null): { verified: PromotionRow[]; voided: { digest: string; reason: PromotionVoid }[] } {
  const verified: PromotionRow[] = [], voided: { digest: string; reason: PromotionVoid }[] = [];
  const tomb = new Set([...(ledger?.dropped ?? []).map((t) => `${t.wiki}\n${t.digest}\n${t.seq}`), ...(floor?.dropped() ?? [])]);
  for (const row of rows) {
    // A bound row that left the ledger never runs again under its old ward signature: a replay reads dropped, the board's drop
    // standing where a custody write stripped the ledger's tombstone.
    if (isWardBoundWiki(row.wiki) && !floor) { voided.push({ digest: row.digest, reason: "ward-floor-unread" }); continue; }
    if (isWardBoundWiki(row.wiki) && tomb.has(`${row.wiki}\n${row.digest}\n${row.seq}`)) { voided.push({ digest: row.digest, reason: "ward-dropped" }); continue; }
    if (isWardBoundWiki(row.wiki) && !wardSigStands(row, face, floor!.owner)) { voided.push({ digest: row.digest, reason: "ward-unsigned" }); continue; }
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
