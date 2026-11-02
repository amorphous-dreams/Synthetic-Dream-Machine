/**
 * kahua-promote — classify stage items and carry device-local promotion decisions as verified bytes.
 * A kāpae raise shadows (face, digest) on every device; ledger rows stay untouched and a lower restores them as they stood.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import type { KahuaStageReading } from "./kahua-stage.js";

export type KahuaCodeClass = "module-type" | "executable-type" | "startup-action" | "raw-markup" | "module-gate";
export interface KahuaPromotable { title: string; text: string; fields: Readonly<Record<string, string>> }
const EXECUTABLE_TYPES = new Set(["application/javascript", "text/javascript", "application/x-javascript", "application/ecmascript", "text/ecmascript", "module"]);
const normalizedMimeType = (value: string): string => value.split(";", 1)[0]!.trim().toLowerCase();
const MODULE_COMPONENT = "lar:///ha.ka.ba/lararium/tw5/tw5-module";
const stringList = (value: string): string[] => Array.from(value.matchAll(/\[\[([^\]]*)\]\]|([^\s]+)/g), m => m[1] ?? m[2]!);

export function kahuaCodeClass(item: KahuaPromotable): KahuaCodeClass[] {
  const f = item.fields, tags = stringList(f["tags"] ?? ""), stack = stringList(f["stack"] ?? "");
  const classes: KahuaCodeClass[] = [];
  if (f["module-type"]) classes.push("module-type");
  if (EXECUTABLE_TYPES.has(normalizedMimeType(f["type"] ?? ""))) classes.push("executable-type");
  if (tags.some(t => /^\$:\/tags\/StartupAction(\/.*)?$/.test(t))) classes.push("startup-action");
  if (tags.some(t => /^\$:\/tags\/RawMarkup(Wikified)?(\/.*)?$/.test(t))) classes.push("raw-markup");
  if (Object.hasOwn(f, "source-sha256") || tags.includes(MODULE_COMPONENT) || stack.includes(MODULE_COMPONENT)) classes.push("module-gate");
  return classes;
}
export const kahuaPreloadEntry = (item: KahuaPromotable): Record<string, string> => ({ ...item.fields, title: item.title, text: item.text });
export const kahuaPreloadBytes = (item: KahuaPromotable): Uint8Array => canonicalJsonBytes(kahuaPreloadEntry(item));
export const kahuaPromotionDigest = (item: KahuaPromotable): string => sha256HexBytesSync(kahuaPreloadBytes(item));
export class PromoteRefused extends Error {
  override name = "PromoteRefused";
  constructor(public code: string, detail: string) { super(`${code}: ${detail}`); }
}
export interface PromotionRow { digest: string; title: string; revision: string; hand: string; seq: number; bytes: string; kept?: true }
export interface PrepareEntry { digest: string; title: string; revision: string; classes: readonly KahuaCodeClass[]; why: string; seat: string }
export interface PromotionLedger { seq: number; rows: readonly PromotionRow[]; queue: readonly PrepareEntry[] }
export const EMPTY_LEDGER: PromotionLedger = { seq: 0, rows: [], queue: [] };
export type PromoteWho = { kind: "hand" | "seat"; id: string };
const requireHand = (who: PromoteWho): void => { if (who.kind !== "hand") throw new PromoteRefused("promote-needs-hand", "a hand must decide"); };
export function ledgerPrepare(l: PromotionLedger, entry: PrepareEntry): PromotionLedger {
  if (!entry.why.trim()) throw new PromoteRefused("promote-why-missing", "a preparation needs an explanation");
  return l.queue.some(e => e.digest === entry.digest) ? l : { ...l, queue: [...l.queue, entry] };
}
export function ledgerCommit(l: PromotionLedger, input: { digest: string; item: KahuaPromotable; revision: string }, who: PromoteWho): PromotionLedger {
  requireHand(who);
  if (input.digest !== kahuaPromotionDigest(input.item)) throw new PromoteRefused("promote-digest-mismatch", "the digest does not name the preload");
  const seq = l.seq + 1;
  const row: PromotionRow = { digest: input.digest, title: input.item.title, revision: input.revision, hand: who.id, seq, bytes: new TextDecoder().decode(kahuaPreloadBytes(input.item)) };
  return { seq, rows: [...l.rows.filter(r => r.title !== row.title && r.digest !== row.digest), row], queue: l.queue.filter(e => e.digest !== row.digest) };
}
export function ledgerUnpromote(l: PromotionLedger, digest: string, who: PromoteWho): PromotionLedger {
  requireHand(who);
  if (!l.rows.some(r => r.digest === digest)) throw new PromoteRefused("promote-unknown", "no row carries the digest");
  return { ...l, rows: l.rows.filter(r => r.digest !== digest) };
}
export function ledgerDecideOrphan(l: PromotionLedger, digest: string, decision: "keep" | "drop", who: PromoteWho): PromotionLedger {
  requireHand(who);
  if (!l.rows.some(r => r.digest === digest)) throw new PromoteRefused("promote-unknown", "no row carries the digest");
  return { ...l, rows: decision === "drop" ? l.rows.filter(r => r.digest !== digest) : l.rows.map(r => r.digest === digest ? { ...r, kept: true } : r) };
}
export const encodeLedger = (l: PromotionLedger): Uint8Array => canonicalJsonBytes(l);
const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const keys = (x: Record<string, unknown>, required: string[], optional: string[] = []): boolean => required.every(k => Object.hasOwn(x, k)) && Object.keys(x).every(k => required.includes(k) || optional.includes(k));
const hex64 = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);
const str = (x: unknown): x is string => typeof x === "string";
export class KapaeRefused extends Error {
  override name = "KapaeRefused";
  constructor(public code: string, detail: string) { super(`${code}: ${detail}`); }
}
export function assertKapaeHand(action: "raise" | "lower", who: PromoteWho): void {
  if (who.kind !== "hand") throw new KapaeRefused("kapae-needs-hand", `a hand must ${action}`);
}
export interface KapaePrepare { digest: string; why: string; seat: string }
export interface KapaeLocal { shadowed: readonly string[]; queue: readonly KapaePrepare[] }
export const EMPTY_KAPAE_LOCAL: KapaeLocal = { shadowed: [], queue: [] };
export function kapaePrepare(local: KapaeLocal, entry: KapaePrepare): KapaeLocal {
  if (!hex64(entry.digest)) throw new KapaeRefused("kapae-digest-malformed", "the digest must carry 64 hex digits");
  if (!entry.why.trim()) throw new KapaeRefused("kapae-why-missing", "a preparation needs an explanation");
  return local.queue.some(e => e.digest === entry.digest) ? local : { ...local, queue: [...local.queue, entry] };
}
export const encodeKapaeLocal = (local: KapaeLocal): Uint8Array => canonicalJsonBytes(local);
export function decodeKapaeLocal(bytes: Uint8Array): KapaeLocal {
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!object(value) || !keys(value, ["shadowed", "queue"]) || !Array.isArray(value.shadowed) || !value.shadowed.every(hex64) || !Array.isArray(value.queue)) throw 0;
    if (!value.queue.every((e: unknown) => object(e) && keys(e, ["digest", "why", "seat"]) && hex64(e.digest) && str(e.why) && e.why.trim().length > 0 && str(e.seat))) throw 0;
    const shadowed: string[] = value.shadowed;
    if (new Set(shadowed).size !== shadowed.length || shadowed.some((d, i) => i > 0 && shadowed[i - 1]! >= d)) throw 0;
    if (new Set(value.queue.map((e: KapaePrepare) => e.digest)).size !== value.queue.length) throw 0;
    return value as unknown as KapaeLocal;
  } catch { throw new KapaeRefused("kapae-local-malformed", "the local cache has an invalid shape"); }
}
export function kapaeNoteArrival(local: KapaeLocal, shadowed: ReadonlySet<string>, loaded: ReadonlySet<string>): { local: KapaeLocal; restart: boolean } {
  const previous = new Set(local.shadowed);
  return { local: { shadowed: [...shadowed].sort(), queue: local.queue.filter(e => !shadowed.has(e.digest)) },
    restart: [...shadowed].some(digest => !previous.has(digest) && loaded.has(digest)) };
}
export function kapaeBootSet(local: KapaeLocal, readable: ReadonlySet<string> | null): ReadonlySet<string> {
  return readable ?? new Set(local.shadowed);
}
const integer = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x);
const codeClasses: readonly string[] = ["module-type", "executable-type", "startup-action", "raw-markup", "module-gate"];
export function decodeLedger(bytes: Uint8Array): PromotionLedger {
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!object(value) || !keys(value, ["seq", "rows", "queue"]) || !integer(value["seq"]) || !Array.isArray(value["rows"]) || !Array.isArray(value["queue"])) throw 0;
    if (!value["rows"].every((r: unknown) => object(r) && keys(r, ["digest", "title", "revision", "hand", "seq", "bytes"], ["kept"]) && hex64(r["digest"]) && str(r["title"]) && str(r["revision"]) && str(r["hand"]) && integer(r["seq"]) && str(r["bytes"]) && (!Object.hasOwn(r, "kept") || r["kept"] === true))) throw 0;
    if (!value["queue"].every((e: unknown) => object(e) && keys(e, ["digest", "title", "revision", "classes", "why", "seat"]) && hex64(e["digest"]) && str(e["title"]) && str(e["revision"]) && str(e["why"]) && str(e["seat"]) && Array.isArray(e["classes"]) && e["classes"].every((c: unknown) => str(c) && codeClasses.includes(c)))) throw 0;
    return value as unknown as PromotionLedger;
  } catch { throw new PromoteRefused("ledger-malformed", "the ledger has an invalid shape"); }
}
export function verifyPromotionRows(rows: readonly PromotionRow[]): { verified: PromotionRow[]; voided: { digest: string; reason: "digest-mismatch" | "bytes-malformed" }[] } {
  const verified: PromotionRow[] = [], voided: { digest: string; reason: "digest-mismatch" | "bytes-malformed" }[] = [];
  for (const row of rows) {
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
export function reconcilePromotions(rows: readonly PromotionRow[], reading: KahuaStageReading): PromotionState[] {
  return rows.map(row => {
    const rev = reading.revision(row.revision);
    if (!rev || rev.withdrawn || !rev.standing) return { row, state: row.kept ? "kept" : "orphaned" };
    const item = reading.get(row.title), head = item?.heads[0]?.cid;
    if (item?.status === "standing" && head === row.revision) return { row, state: "standing" };
    return { row, state: "update-waits", ...(head === undefined ? {} : { head }) };
  });
}
export const promotedPreloads = (verified: readonly PromotionRow[], shadowed?: ReadonlySet<string>): Record<string, unknown>[] => verified.filter(r => !shadowed?.has(r.digest)).map(r => JSON.parse(r.bytes) as Record<string, unknown>);
