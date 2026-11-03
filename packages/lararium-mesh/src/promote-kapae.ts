/** Device-local shadow cache. Meme: lar:///ha.ka.ba/lares/api/pono/kapae */
import { canonicalJsonBytes } from "./crypto.js";
import type { PromoteWho } from "./promote.js";
export class KapaeRefused extends Error { override name = "KapaeRefused"; constructor(public code: string, detail: string) { super(`${code}: ${detail}`); } }
export function assertKapaeHand(action: "raise" | "lower", who: PromoteWho): void { if (who.kind !== "hand") throw new KapaeRefused("kapae-needs-hand", `a hand must ${action}`); }
export interface KapaeLocal { shadowed: readonly string[] }
export const EMPTY_KAPAE_LOCAL: KapaeLocal = { shadowed: [] };
export const encodeKapaeLocal = (local: KapaeLocal): Uint8Array => canonicalJsonBytes(local);
export function decodeKapaeLocal(bytes: Uint8Array): KapaeLocal {
 try { const v: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).length !== 1 || !("shadowed" in v) || !Array.isArray(v.shadowed) || !v.shadowed.every((s: unknown) => typeof s === "string" && /^[^\n]+\n[0-9a-f]{64}$/.test(s)) || v.shadowed.some((s: string, i: number) => i > 0 && (v.shadowed as string[])[i-1]! >= s)) throw 0;
  return v as KapaeLocal;
 } catch { throw new KapaeRefused("kapae-local-malformed", "the local cache has an invalid shape"); }
}
export function kapaeNoteArrival(local: KapaeLocal, shadowed: ReadonlySet<string>, loaded: ReadonlySet<string>): { local: KapaeLocal; restart: boolean } { const previous = new Set(local.shadowed); return { local: { shadowed: [...shadowed].sort() }, restart: [...shadowed].some(e => !previous.has(e) && loaded.has(e)) }; }
/** The edges that STAND on this device: what the cache holds and the board counts, less only what a counted signed LOWER withdrew. The cache never
 * shrinks without a lower, so a raise that vanished from the board (a rotation of the grant, a deleted or corrupted record) keeps its shadow. */
export function kapaeStanding(local: KapaeLocal, board: { readonly edges: () => ReadonlySet<string>; readonly lowered: () => ReadonlySet<string> }): ReadonlySet<string> {
 const lowered = board.lowered();
 return new Set([...local.shadowed, ...board.edges()].filter(edge => !lowered.has(edge)));
}
export function kapaeBootSet(local: KapaeLocal, board: { readonly edges: () => ReadonlySet<string>; readonly lowered: () => ReadonlySet<string> } | null): ReadonlySet<string> { return board ? kapaeStanding(local, board) : new Set(local.shadowed); }
