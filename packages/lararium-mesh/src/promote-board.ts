/** The face-private board carries signed preparation and edge shadows.
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae
 */
import type { AutomergeUrl } from "@automerge/automerge-repo";
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { PROMOTE_ACT_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { deterministicDocUrl } from "./deterministic-doc.js";
import { storedLarRecord } from "./stored-record.js";
import { foldCausalHeads, type EdgeKapaeVerdict } from "./edge-kapae.js";
import { promoteEdgeKey } from "./promote.js";
export { promoteEdgeKey } from "./promote.js";
export const PROMOTE_ACT_PREFIX = "lar:///ha.ka.ba/dreamnet/promote-act/";
const PROMOTE_BOARD_URI = "lar:///ha.ka.ba/bags/promote-board";
export function promoteBoardDocUrl(group: string): AutomergeUrl { return deterministicDocUrl(`${PROMOTE_BOARD_URI}/${group.trim().toLowerCase()}`); }
interface Base { readonly kind: typeof PROMOTE_ACT_DOMAIN; readonly group: string; readonly epoch: number; readonly wiki: string; readonly digest: string }
export interface PromotePrepareBody extends Base { readonly act: "prepare"; readonly title: string; readonly classes: readonly string[]; readonly why: string }
export interface PromoteKapaeBody extends Base { readonly act: "kapae"; readonly raised: boolean; readonly parents: readonly string[] }
export type PromoteActBody = PromotePrepareBody | PromoteKapaeBody;
export interface SignedPromoteAct { readonly body: PromoteActBody; readonly signer: string; readonly sig: string }
type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
export interface PromoteFace { readonly group: string; readonly grant: (key: string) => boolean; readonly device: (key: string) => boolean }
export type PromoteActRefusal = "shape" | "domain" | "group" | "signature" | "grant" | "device";
const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): x is string => typeof x === "string";
const hex = (x: unknown): x is string => str(x) && /^[0-9a-f]{64}$/.test(x);
function shape(b: Record<string, unknown>): boolean {
 if (!str(b.group) || !Number.isSafeInteger(b.epoch) || (b.epoch as number) < 0 || !str(b.wiki) || !b.wiki.length || !hex(b.digest)) return false;
 if (b.act === "prepare") return str(b.title) && b.title.length > 0 && str(b.why) && b.why.trim().length > 0 && Array.isArray(b.classes) && b.classes.every(str);
 if (b.act === "kapae") return typeof b.raised === "boolean" && Array.isArray(b.parents) && b.parents.every(hex) && new Set(b.parents).size === b.parents.length;
 return false;
}
export function promoteActCid(act: { readonly body: PromoteActBody; readonly signer: string }): string { return sha256HexBytesSync(canonicalJsonBytes({ body: act.body, signer: act.signer })); }
async function sign(body: PromoteActBody, signer: Signer): Promise<SignedPromoteAct> { if (!shape(body as unknown as Record<string, unknown>)) throw new Error("promote-act: shape"); return { body, signer: signer.key.toLowerCase(), sig: await signer.sign(canonicalJsonBytes(body)) }; }
export function signPromotePrepare(parts: Omit<PromotePrepareBody, "kind" | "act">, signer: Signer): Promise<SignedPromoteAct> { return sign({ ...parts, classes: Array.isArray(parts.classes) ? [...parts.classes] : parts.classes, kind: PROMOTE_ACT_DOMAIN, act: "prepare" }, signer); }
export function signPromoteKapae(parts: Omit<PromoteKapaeBody, "kind" | "act">, signer: Signer): Promise<SignedPromoteAct> { return sign({ ...parts, parents: Array.isArray(parts.parents) ? [...parts.parents] : parts.parents, kind: PROMOTE_ACT_DOMAIN, act: "kapae" }, signer); }
export function readPromoteAct(raw: unknown, face: PromoteFace): { ok: true; act: SignedPromoteAct; cid: string } | { ok: false; refusal: PromoteActRefusal } {
 if (!object(raw) || !object(raw.body) || !hex(raw.signer) || !str(raw.sig) || !shape(raw.body)) return { ok: false, refusal: "shape" };
 if (raw.body.kind !== PROMOTE_ACT_DOMAIN) return { ok: false, refusal: "domain" };
 if (raw.body.group !== face.group) return { ok: false, refusal: "group" };
 try { if (!verifyEd25519(raw.sig, canonicalJsonBytes(raw.body), raw.signer)) return { ok: false, refusal: "signature" }; } catch { return { ok: false, refusal: "signature" }; }
 if (raw.body.act === "kapae" && !face.grant(raw.signer)) return { ok: false, refusal: "grant" };
 if (raw.body.act === "prepare" && !face.device(raw.signer)) return { ok: false, refusal: "device" };
 const act = raw as unknown as SignedPromoteAct; return { ok: true, act, cid: promoteActCid(act) };
}
export function promoteActKey(group: string, cid: string): string { return `${PROMOTE_ACT_PREFIX}${encodeURIComponent(group)}/${cid}`; }
export function writePromoteAct(draft: LarDoc, act: SignedPromoteAct): void { const cid = promoteActCid(act), key = promoteActKey(act.body.group, cid); draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(act) }, cid); }
export function promoteActRecords(doc: LarDoc | undefined | null, group: string): unknown[] { const prefix = `${PROMOTE_ACT_PREFIX}${encodeURIComponent(group)}/`, out: unknown[] = []; for (const [title, record] of Object.entries(doc?.tiddlers ?? {})) { if (!title.startsWith(prefix)) continue; const text = tiddlerText(record); if (text !== null) try { out.push(JSON.parse(text)); } catch { /* torn carriage */ } } return out; }
export interface PromotePrepare { wiki: string; digest: string; title: string; classes: readonly string[]; why: string; seat: string }
export function readPromoteBoard(records: readonly unknown[], face: PromoteFace) {
 const acts = new Map<string, SignedPromoteAct>(); const refused: { cid: string | null; refusal: PromoteActRefusal }[] = [];
 for (const raw of records) { const r = readPromoteAct(raw, face); if (r.ok) acts.set(r.cid, r.act); else { let cid: string | null = null; try { if (object(raw) && object(raw.body) && str(raw.signer)) cid = promoteActCid(raw as unknown as SignedPromoteAct); } catch {} refused.push({ cid, refusal: r.refusal }); } }
 refused.sort((a,b) => (a.cid ?? "").localeCompare(b.cid ?? "") || a.refusal.localeCompare(b.refusal));
 const lines = new Map<string, { actCid: string; raised: boolean; parents: readonly string[] }[]>(); const prepares = new Map<string, PromotePrepare>();
 for (const [cid, act] of [...acts].sort(([a], [b]) => a.localeCompare(b))) { const b = act.body, key = promoteEdgeKey(b.wiki, b.digest); if (b.act === "kapae") { const line = lines.get(key) ?? []; line.push({ actCid: cid, raised: b.raised, parents: b.parents }); lines.set(key, line); } else if (!prepares.has(key)) prepares.set(key, { wiki: b.wiki, digest: b.digest, title: b.title, classes: b.classes, why: b.why, seat: act.signer }); }
 const verdict = (wiki: string, digest: string): EdgeKapaeVerdict | undefined => { const line = lines.get(promoteEdgeKey(wiki, digest)); return line ? foldCausalHeads(line) : undefined; };
 const edges = () => new Set([...lines].filter(([, line]) => foldCausalHeads(line) !== "withdrawn").map(([key]) => key).sort());
 return { kapae: verdict, kapaeHeads: (wiki: string, digest: string) => { const line = lines.get(promoteEdgeKey(wiki, digest)) ?? [], cited = new Set(line.flatMap(a => a.parents)); return line.map(a => a.actCid).filter(cid => !cited.has(cid)).sort(); }, shadowed: (wiki: string) => new Set([...edges()].filter(e => e.startsWith(`${wiki}\n`)).map(e => e.slice(wiki.length + 1))), edges, prepared: (wiki: string) => [...prepares.values()].filter(p => p.wiki === wiki), refused };
}
