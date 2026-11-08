/** The face-private board carries signed preparation, edge shadows and the drop floor.
 * A flag carries a seat request for a kāpae; it shadows nothing. A drop names one bound ledger row (wiki, digest, seq) that left the
 * ledger of the device that signed it, so its old ward signature never runs again there, whatever a custody write does to that ledger
 * (road `L23`, seat-harness#/the-ward).
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae
 */
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { getHistory, type Doc } from "@automerge/automerge";
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { PROMOTE_ACT_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { deterministicDocUrl, materializeSharedLarDoc } from "./deterministic-doc.js";
import { storedLarRecord } from "./stored-record.js";
import { foldCausalHeads, type EdgeKapaeVerdict } from "./edge-kapae.js";
import { promoteEdgeKey } from "./promote.js";
import { KapaeRefused } from "./promote-kapae.js";
import { wardActRefusal, type WardActRefusal, type WardActWitness } from "./ward-cosign.js";
export { promoteEdgeKey } from "./promote.js";
export const PROMOTE_ACT_PREFIX = "lar:///ha.ka.ba/dreamnet/promote-act/";
const PROMOTE_BOARD_URI = "lar:///ha.ka.ba/bags/promote-board";
export function promoteBoardDocUrl(group: string): AutomergeUrl { return deterministicDocUrl(`${PROMOTE_BOARD_URI}/${group.trim().toLowerCase()}`); }
interface Base { readonly kind: typeof PROMOTE_ACT_DOMAIN; readonly group: string; readonly epoch: number; readonly wiki: string; readonly digest: string }
export interface PromotePrepareBody extends Base { readonly act: "prepare"; readonly title: string; readonly classes: readonly string[]; readonly why: string; readonly intent?: "promote" | "kapae" }
export interface PromoteKapaeBody extends Base { readonly act: "kapae"; readonly raised: boolean; readonly parents: readonly string[] }
/**
 * A bound row that left its device's ledger: names the very (wiki, digest, seq) its ward signature covers, and the signer names the
 * ledger (the device atom the ward bytes bind as owner). No act lifts it; a fresh commit lands at a seq no drop of that edge names.
 */
export interface PromoteDropBody extends Base { readonly act: "drop"; readonly seq: number }
export type PromoteActBody = PromotePrepareBody | PromoteKapaeBody | PromoteDropBody;
export interface SignedPromoteAct { readonly body: PromoteActBody; readonly signer: string; readonly sig: string }
type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
/**
 * The face a board reads under. `ward` holds every reader to the co-sign: a lower releases a brake, so on a face of two devices it
 * stands only beside its spent co-sign (seat-harness#/the-swarm-slices), and one the root signed outside the door refuses
 * `ward-act-uncosigned`.
 */
export interface PromoteFace { readonly group: string; readonly grant: (key: string) => boolean; readonly device: (key: string) => boolean; readonly ward: WardActWitness }
export type PromoteActRefusal = "shape" | "domain" | "group" | "signature" | "grant" | "device" | WardActRefusal;
const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): x is string => typeof x === "string";
const hex = (x: unknown): x is string => str(x) && /^[0-9a-f]{64}$/.test(x);
function shape(b: Record<string, unknown>): boolean {
 if (!str(b.group) || !Number.isSafeInteger(b.epoch) || (b.epoch as number) < 0 || !str(b.wiki) || !b.wiki.length || !hex(b.digest)) return false;
 if (b.act === "prepare") return (b.intent === undefined || b.intent === "promote" || b.intent === "kapae") && str(b.title) && b.title.length > 0 && str(b.why) && b.why.trim().length > 0 && Array.isArray(b.classes) && b.classes.every(str);
 if (b.act === "kapae") return typeof b.raised === "boolean" && Array.isArray(b.parents) && b.parents.every(hex) && new Set(b.parents).size === b.parents.length;
 if (b.act === "drop") return Number.isSafeInteger(b.seq) && (b.seq as number) >= 0;
 return false;
}
export function promoteActCid(act: { readonly body: PromoteActBody; readonly signer: string }): string { return sha256HexBytesSync(canonicalJsonBytes({ body: act.body, signer: act.signer })); }
async function sign(body: PromoteActBody, signer: Signer): Promise<SignedPromoteAct> { if (!shape(body as unknown as Record<string, unknown>)) throw new Error("promote-act: shape"); return { body, signer: signer.key.toLowerCase(), sig: await signer.sign(canonicalJsonBytes(body)) }; }
export function signPromotePrepare(parts: Omit<PromotePrepareBody, "kind" | "act">, signer: Signer): Promise<SignedPromoteAct> { return sign({ ...parts, classes: Array.isArray(parts.classes) ? [...parts.classes] : parts.classes, kind: PROMOTE_ACT_DOMAIN, act: "prepare" }, signer); }
export function signPromoteDrop(parts: Omit<PromoteDropBody, "kind" | "act">, signer: Signer): Promise<SignedPromoteAct> { return sign({ ...parts, kind: PROMOTE_ACT_DOMAIN, act: "drop" }, signer); }
export function signPromoteKapae(parts: Omit<PromoteKapaeBody, "kind" | "act">, signer: Signer): Promise<SignedPromoteAct> { return sign({ ...parts, parents: Array.isArray(parts.parents) ? [...parts.parents] : parts.parents, kind: PROMOTE_ACT_DOMAIN, act: "kapae" }, signer); }
export function readPromoteAct(raw: unknown, face: PromoteFace): { ok: true; act: SignedPromoteAct; cid: string } | { ok: false; refusal: PromoteActRefusal } {
 if (!object(raw) || !object(raw.body) || !hex(raw.signer) || !str(raw.sig) || !shape(raw.body)) return { ok: false, refusal: "shape" };
 if (raw.body.kind !== PROMOTE_ACT_DOMAIN) return { ok: false, refusal: "domain" };
 if (raw.body.group !== face.group) return { ok: false, refusal: "group" };
 try { if (!verifyEd25519(raw.sig, canonicalJsonBytes(raw.body), raw.signer)) return { ok: false, refusal: "signature" }; } catch { return { ok: false, refusal: "signature" }; }
 // A RAISE ONLY ADDS A BRAKE, so an enrolled device's atom may sign one (it fails safe); a LOWER releases one, and only the grant signs it.
 if (raw.body.act === "kapae" && !(face.grant(raw.signer) || (raw.body.raised && face.device(raw.signer)))) return { ok: false, refusal: "grant" };
 // A DROP ONLY ADDS A BRAKE, and only to its signer's own ledger (the reader counts the drops its own atom signed), so no enrolment
 // gates it: a drop outlives its signer leaving the device set, and a stranger's drop brakes no ledger but the stranger's.
 if (raw.body.act === "prepare" && !face.device(raw.signer)) return { ok: false, refusal: "device" };
 if (raw.body.act === "kapae" && !raw.body.raised) {
  const ward = wardActRefusal(face.ward, { verb: "ward-kapae-lower", wiki: raw.body.wiki as string, head: kapaeLowerHead(raw.body.digest as string, raw.body.parents as string[]) });
  if (ward) return { ok: false, refusal: ward };
 }
 const act = raw as unknown as SignedPromoteAct; return { ok: true, act, cid: promoteActCid(act) };
}
/** The key a drop floors in its signer's ledger: the (wiki, digest, seq) a bound row's ward signature covers. */
export const promoteDropKey = (wiki: string, digest: string, seq: number): string => `${wiki}\n${digest}\n${seq}`;
/** The head a lower's co-sign names: the shadowed digest and the edge heads it releases. */
export function kapaeLowerHead(digest: string, parents: readonly string[]): string {
 return sha256HexBytesSync(canonicalJsonBytes({ digest, heads: [...parents].sort() }));
}
export function promoteActKey(group: string, cid: string): string { return `${PROMOTE_ACT_PREFIX}${encodeURIComponent(group)}/${cid}`; }
export function writePromoteAct(draft: LarDoc, act: SignedPromoteAct): void { const cid = promoteActCid(act), key = promoteActKey(act.body.group, cid); draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(act) }, cid); }
export function promoteActRecords(doc: LarDoc | undefined | null, group: string): unknown[] { const prefix = `${PROMOTE_ACT_PREFIX}${encodeURIComponent(group)}/`, out: unknown[] = []; for (const [title, record] of Object.entries(doc?.tiddlers ?? {})) { if (!title.startsWith(prefix)) continue; const text = tiddlerText(record); if (text !== null) try { out.push(JSON.parse(text)); } catch { /* torn carriage */ } } return out; }
/**
 * THE DROPS A DELETE OR AN OVERWRITE TOOK (road `L23`): a board holds documents any writer may edit, so a plain delete, a put over an
 * act's key or an edit of its text would lift a drop from the current map. A drop rides the board's change history as well; each change
 * that deletes or overwrites anything (an op with a `del` action or a predecessor; an honest `writePromoteAct` only inserts new keys)
 * hands back the drops standing just before it, so only a rollback of the board's own storage loses one. Each drop comes back once, and
 * none the current map still holds, so a flood of tiny deletes costs one verify per drop. It reads a real Automerge document (an absent
 * one holds none) and throws on anything else.
 */
export function promoteDropHistory(doc: LarDoc | undefined | null, group: string): unknown[] {
 if (!doc) return [];
 const cidOf = (raw: unknown): string | null => { try { return object(raw) && object(raw.body) && raw.body.act === "drop" && str(raw.signer) ? promoteActCid(raw as unknown as SignedPromoteAct) : null; } catch { return null; } };
 const seen = new Set(promoteActRecords(doc, group).map(cidOf).filter((cid): cid is string => cid !== null));
 const history = getHistory(doc as Doc<LarDoc>), out: unknown[] = [];
 for (let i = 1; i < history.length; i++) {
  if (!history[i]!.change.ops.some((op) => op.action === "del" || op.pred.length > 0)) continue;
  for (const raw of promoteActRecords(history[i - 1]!.snapshot, group)) {
   const cid = cidOf(raw);
   if (cid === null || seen.has(cid)) continue;
   seen.add(cid); out.push(raw);
  }
 }
 return out;
}
/** The face board's records as a reader counts them: the current map, and every drop its history holds. */
export const promoteBoardRecords = (doc: LarDoc | undefined | null, group: string): unknown[] => [...promoteActRecords(doc, group), ...promoteDropHistory(doc, group)];
export interface PromotePrepare { wiki: string; digest: string; title: string; classes: readonly string[]; why: string; seat: string }
export function readPromoteBoard(records: readonly unknown[], face: PromoteFace) {
 const acts = new Map<string, SignedPromoteAct>(); const refused: { cid: string | null; refusal: PromoteActRefusal }[] = [];
 for (const raw of records) { const r = readPromoteAct(raw, face); if (r.ok) acts.set(r.cid, r.act); else { let cid: string | null = null; try { if (object(raw) && object(raw.body) && str(raw.signer)) cid = promoteActCid(raw as unknown as SignedPromoteAct); } catch {} refused.push({ cid, refusal: r.refusal }); } }
 refused.sort((a,b) => (a.cid ?? "").localeCompare(b.cid ?? "") || a.refusal.localeCompare(b.refusal));
 const lines = new Map<string, { actCid: string; raised: boolean; parents: readonly string[] }[]>(); const drops = new Map<string, Set<string>>(); const prepares = new Map<string, PromotePrepare>(), flags = new Map<string, PromotePrepare>();
 for (const [cid, act] of [...acts].sort(([a], [b]) => a.localeCompare(b))) { const b = act.body, key = promoteEdgeKey(b.wiki, b.digest); if (b.act === "drop") { const own = drops.get(act.signer) ?? new Set<string>(); own.add(promoteDropKey(b.wiki, b.digest, b.seq)); drops.set(act.signer, own); continue; } if (b.act === "kapae") { const line = lines.get(key) ?? []; line.push({ actCid: cid, raised: b.raised, parents: b.parents }); lines.set(key, line); } else { const queue = b.intent === "kapae" ? flags : prepares; if (!queue.has(key)) queue.set(key, { wiki: b.wiki, digest: b.digest, title: b.title, classes: b.classes, why: b.why, seat: act.signer }); } }
 const verdict = (wiki: string, digest: string): EdgeKapaeVerdict | undefined => { const line = lines.get(promoteEdgeKey(wiki, digest)); return line ? foldCausalHeads(line) : undefined; };
 const edges = () => new Set([...lines].filter(([, line]) => foldCausalHeads(line) !== "withdrawn").map(([key]) => key).sort());
 return { kapae: verdict, kapaeHeads: (wiki: string, digest: string) => { const line = lines.get(promoteEdgeKey(wiki, digest)) ?? [], cited = new Set(line.flatMap(a => a.parents)); return line.map(a => a.actCid).filter(cid => !cited.has(cid)).sort(); }, shadowed: (wiki: string) => new Set([...edges()].filter(e => e.startsWith(`${wiki}\n`)).map(e => e.slice(wiki.length + 1))), edges, lowered: () => new Set([...lines].filter(([, line]) => foldCausalHeads(line) === "withdrawn").map(([key]) => key).sort()), droppedBy: (owner: string): ReadonlySet<string> => new Set([...(drops.get(owner.toLowerCase()) ?? [])].sort()), prepared: (wiki: string) => [...prepares.values()].filter(p => p.wiki === wiki), flagged: (wiki: string) => [...flags.values()].filter(p => p.wiki === wiki), refused };
}

export type PromoteBoardReading = ReturnType<typeof readPromoteBoard>;
export const PROMOTE_PLANE = "promote";
/** Read only the face's derived board url from its verified plane projection. */
export function promotePlaneUrl(projection: { readonly planes: Readonly<Record<string, string | undefined>> }, group: string): string | null {
 const url = promoteBoardDocUrl(group);
 return projection.planes[PROMOTE_PLANE] === url ? url : null;
}

export type PromoteAdoption = { readonly mount: string } | { readonly absent: "promote-unpinned" };
/** Mount the verified pin alone; an unpinned face names its absence without a catalog row. */
export function adoptPromotePlane(projection: { readonly planes: Readonly<Record<string, string | undefined>> }, group: string): PromoteAdoption {
 const url = promotePlaneUrl(projection, group);
 return url ? { mount: url } : { absent: "promote-unpinned" };
}
/** Return the mounted url, or null when the pin stands absent. */
export function adoptedPromoteUrl(adoption: PromoteAdoption): string | null { return "mount" in adoption ? adoption.mount : null; }
/** Materialize the verified pinned board in the repo, or return null without mounting anything. */
export async function adoptPromoteBoard(input: { readonly repo: Repo; readonly group: string; readonly projection: { readonly planes: Readonly<Record<string, string | undefined>> } }): Promise<AutomergeUrl | null> {
 const url = promotePlaneUrl(input.projection, input.group);
 if (!url) return null;
 const handle = await materializeSharedLarDoc(input.repo, url as AutomergeUrl, "promote:board");
 return handle.url;
}
/** Return the founding pin; refuse any attempt to mint outside founding. */
export function promoteBoardMint(projection: { readonly planes: Readonly<Record<string, string | undefined>> }, group: string): string {
 const url = promotePlaneUrl(projection, group);
 if (url === null) throw new KapaeRefused("promote-mint-outside-founding", "the face's founding act pins the board");
 return url;
}
