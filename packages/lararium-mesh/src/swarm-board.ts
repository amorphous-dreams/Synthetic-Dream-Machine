/**
 * swarm-board — the house cap and the lane shares, a sibling record family on the face-private promote board doc.
 *
 * The cap and the shares cross devices (the whole swarm answers to one cap), so they ride the face's synced board and not the
 * device-local daemon wiki. The face's GRANT signs each act (the hand; a controller under a cap the hand granted joins at the ward
 * slice). The family has its own prefix and its own `swarm-act` signing domain, so a promote act never reads as a swarm act nor the reverse.
 *
 * Each LINE (the cap, one lane's share) folds by causal heads. Concurrent heads take the MINIMUM, so a fork can only tighten the swarm;
 * a line that cites a parent it lacks, or has no head, reads zero and UNAVAILABLE with its reason (`parent-missing`, `no-head`); shares
 * that sum past the cap close every share to zero. The reading names why (`refusal`, `unavailable`), and a reader that cannot fold
 * spends nothing. A write onto an unavailable line refuses by name (`swarm-door`); only a hand's SUPERSEDE starts the line again: an
 * act marked `supersede` cites the line's dangling heads, needs no parent to stand, and the fold drops every act it descends from.
 * A record whose bytes do not parse rides out as a TORN entry and enters `refused`, never silence.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { SWARM_ACT_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { storedLarRecord } from "./stored-record.js";
import { wardActRefusal, type WardActRefusal, type WardActWitness } from "./ward-cosign.js";

export const SWARM_BOARD_PREFIX = "lar:///ha.ka.ba/dreamnet/swarm-act/";
interface Base { readonly kind: typeof SWARM_ACT_DOMAIN; readonly group: string; readonly epoch: number; readonly value: number; readonly parents: readonly string[]; readonly supersede?: true }
export interface SwarmCapBody extends Base { readonly act: "cap" }
export interface SwarmShareBody extends Base { readonly act: "share"; readonly lane: string }
export type SwarmBoardBody = SwarmCapBody | SwarmShareBody;
export interface SignedSwarmBoardAct { readonly body: SwarmBoardBody; readonly signer: string; readonly sig: string }
type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
/**
 * The face the board reads under. `ward` holds every reader to the co-sign: the house cap is a ward act, so on a face of two
 * devices a cap stands only beside its spent co-sign (seat-harness#/the-swarm-slices), and one the root signed outside the door
 * refuses `ward-act-uncosigned`. A lane share rides the fresh unlock alone.
 */
export interface SwarmBoardFace { readonly group: string; readonly grant: (key: string) => boolean; readonly ward: WardActWitness }
export type SwarmBoardRefusal = "torn" | "shape" | "domain" | "group" | "signature" | "grant" | WardActRefusal;
/** Why a line folds to nothing. */
export type SwarmLineUnavailable = "parent-missing" | "no-head";
/** The entry a torn board record rides as, so the reader names it among the refused. */
export interface SwarmBoardTorn { readonly torn: true; readonly key: string }

const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): x is string => typeof x === "string";
const hex = (x: unknown): x is string => str(x) && /^[0-9a-f]{64}$/.test(x);
/** The refusals only the ward witness names: the act's bytes, signature, group and grant all read true. */
const WARD_REFUSALS: ReadonlySet<SwarmBoardRefusal> = new Set<WardActRefusal>(["ward-act-uncosigned", "ward-issuer-aside", "ward-issuer-unknown"]);

function shape(b: Record<string, unknown>): boolean {
  if (!str(b["group"]) || !Number.isSafeInteger(b["epoch"]) || (b["epoch"] as number) < 0) return false;
  if (!Number.isSafeInteger(b["value"]) || (b["value"] as number) < 0) return false;
  if (!Array.isArray(b["parents"]) || !b["parents"].every(hex) || new Set(b["parents"]).size !== b["parents"].length) return false;
  if (Object.hasOwn(b, "supersede") && b["supersede"] !== true) return false;
  if (b["act"] === "cap") return true;
  return b["act"] === "share" && str(b["lane"]) && (b["lane"] as string).length > 0;
}

export const swarmBoardActCid = (act: { readonly body: SwarmBoardBody; readonly signer: string }): string => sha256HexBytesSync(canonicalJsonBytes({ body: act.body, signer: act.signer }));

async function sign(body: SwarmBoardBody, signer: Signer): Promise<SignedSwarmBoardAct> {
  if (!shape(body as unknown as Record<string, unknown>)) throw new Error("swarm-board: shape");
  return { body, signer: signer.key.toLowerCase(), sig: await signer.sign(canonicalJsonBytes(body)) };
}
export const signSwarmCap = (parts: Omit<SwarmCapBody, "kind" | "act">, signer: Signer): Promise<SignedSwarmBoardAct> =>
  sign({ ...parts, parents: Array.isArray(parts.parents) ? [...parts.parents] : parts.parents, kind: SWARM_ACT_DOMAIN, act: "cap" }, signer);
export const signSwarmShare = (parts: Omit<SwarmShareBody, "kind" | "act">, signer: Signer): Promise<SignedSwarmBoardAct> =>
  sign({ ...parts, parents: Array.isArray(parts.parents) ? [...parts.parents] : parts.parents, kind: SWARM_ACT_DOMAIN, act: "share" }, signer);

export function readSwarmBoardAct(raw: unknown, face: SwarmBoardFace): { ok: true; act: SignedSwarmBoardAct; cid: string } | { ok: false; refusal: SwarmBoardRefusal } {
  if (object(raw) && raw["torn"] === true && !Object.hasOwn(raw, "body")) return { ok: false, refusal: "torn" };
  if (!object(raw) || !object(raw["body"]) || !hex(raw["signer"]) || !str(raw["sig"]) || !shape(raw["body"])) return { ok: false, refusal: "shape" };
  if (raw["body"]["kind"] !== SWARM_ACT_DOMAIN) return { ok: false, refusal: "domain" };
  if (raw["body"]["group"] !== face.group) return { ok: false, refusal: "group" };
  try { if (!verifyEd25519(raw["sig"], canonicalJsonBytes(raw["body"]), raw["signer"])) return { ok: false, refusal: "signature" }; } catch { return { ok: false, refusal: "signature" }; }
  if (!face.grant(raw["signer"])) return { ok: false, refusal: "grant" };
  const act = raw as unknown as SignedSwarmBoardAct;
  if (act.body.act === "cap") {
    const ward = wardActRefusal(face.ward, { verb: "ward-house-cap", wiki: "daemon", head: swarmCapHead(act.body) });
    if (ward) return { ok: false, refusal: ward };
  }
  return { ok: true, act, cid: swarmBoardActCid(act) };
}

/** The head a cap's co-sign names: its value and the line it extends (the parents, sorted, and whether it supersedes). */
export const swarmCapHead = (body: { readonly value: number; readonly parents: readonly string[]; readonly supersede?: true | boolean }): string =>
  sha256HexBytesSync(canonicalJsonBytes({ value: body.value, parents: [...body.parents].sort(), supersede: body.supersede === true }));

export const swarmBoardKey = (group: string, cid: string): string => `${SWARM_BOARD_PREFIX}${encodeURIComponent(group)}/${cid}`;
export function writeSwarmBoardAct(draft: LarDoc, act: SignedSwarmBoardAct): void {
  const cid = swarmBoardActCid(act), key = swarmBoardKey(act.body.group, cid);
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(act) }, cid);
}
export function swarmBoardRecords(doc: LarDoc | undefined | null, group: string): unknown[] {
  const prefix = `${SWARM_BOARD_PREFIX}${encodeURIComponent(group)}/`, out: unknown[] = [];
  for (const [title, record] of Object.entries(doc?.tiddlers ?? {})) {
    if (!title.startsWith(prefix)) continue;
    const text = tiddlerText(record);
    if (text === null) continue;
    try { out.push(JSON.parse(text)); } catch { out.push({ torn: true, key: title } satisfies SwarmBoardTorn); }
  }
  return out;
}

interface LineAct { readonly cid: string; readonly value: number; readonly parents: readonly string[]; readonly supersede: boolean }
interface Line { readonly acts: LineAct[] }
type Fold = { value: number; heads: string[]; dangling: string[]; state: "settled" | "concurrent" | "unavailable"; unavailable?: SwarmLineUnavailable; braked?: true };
/**
 * One line's reading: the heads' minimum, 0 where the line cannot fold, the heads a next act cites as its parents, and the DANGLING
 * heads (acts no other act cites) a supersede cites when the line cannot fold. A supersede act roots the line again: every act it
 * descends from leaves the fold, and its own parents need not stand.
 *
 * REFUSED acts (`refused`: signed by the grant, refused by the ward witness alone) never stand as heads. Where one stands as a tip
 * (no standing act cites it, and no supersede drops it), the line reads BRAKED: its value reads the TIGHTEST of every act the line
 * holds, the refused among them, never an older looser act the refusal uncovers. A supersede that cites the refused tip roots the
 * line again, as it does any line.
 */
function foldLine(line: Line, refused: readonly LineAct[] = []): Fold {
  const byCid = new Map([...refused, ...line.acts].map((a) => [a.cid, a] as const));
  const dropped = new Set<string>();
  const drop = (cid: string): void => { if (dropped.has(cid)) return; dropped.add(cid); for (const p of byCid.get(cid)?.parents ?? []) drop(p); };
  for (const a of line.acts) if (a.supersede) for (const p of a.parents) drop(p);
  const live = line.acts.filter((a) => !dropped.has(a.cid));
  const allCited = new Set([...line.acts, ...refused].flatMap((a) => a.parents));
  const dangling = [...line.acts, ...refused].filter((a) => !allCited.has(a.cid)).map((a) => a.cid).sort();
  const ids = new Set(live.map((a) => a.cid));
  if (live.some((a) => !a.supersede && a.parents.some((p) => !ids.has(p)))) return { value: 0, heads: [], dangling, state: "unavailable", unavailable: "parent-missing" };
  const cited = new Set(live.flatMap((a) => a.parents));
  const heads = live.filter((a) => !cited.has(a.cid));
  if (heads.length === 0) return { value: 0, heads: [], dangling, state: "unavailable", unavailable: "no-head" };
  const shadow = refused.filter((r) => !dropped.has(r.cid));
  const braked = shadow.some((r) => !cited.has(r.cid));
  const value = braked ? Math.min(...[...live, ...shadow].map((a) => a.value)) : Math.min(...heads.map((h) => h.value));
  return { value, heads: heads.map((h) => h.cid).sort(), dangling, state: heads.length > 1 ? "concurrent" : "settled", ...(braked ? { braked: true as const } : {}) };
}

export function readSwarmBoard(records: readonly unknown[], face: SwarmBoardFace) {
  const refused: { cid: string | null; refusal: SwarmBoardRefusal }[] = [], acts = new Map<string, SignedSwarmBoardAct>();
  /** The caps the grant signed that the ward witness alone refused: they brake the cap line, and never stand on it. */
  const wardRefusedCaps = new Map<string, LineAct>();
  for (const raw of records) {
    const r = readSwarmBoardAct(raw, face);
    if (r.ok) acts.set(r.cid, r.act);
    else if (r.refusal === "torn") refused.push({ cid: null, refusal: "torn" });
    else {
      let cid: string | null = null;
      try { if (object(raw) && object(raw["body"]) && str(raw["signer"])) cid = swarmBoardActCid(raw as unknown as SignedSwarmBoardAct); } catch { /* shape refused */ }
      refused.push({ cid, refusal: r.refusal });
      if (cid !== null && WARD_REFUSALS.has(r.refusal)) {
        const body = (raw as unknown as SignedSwarmBoardAct).body;
        wardRefusedCaps.set(cid, { cid, value: body.value, parents: body.parents, supersede: body.supersede === true });
      }
    }
  }
  refused.sort((a, b) => (a.cid ?? "").localeCompare(b.cid ?? "") || a.refusal.localeCompare(b.refusal));
  const capLine: Line = { acts: [] }, laneLines = new Map<string, Line>();
  for (const [cid, act] of [...acts].sort(([a], [b]) => a.localeCompare(b))) {
    const entry = { cid, value: act.body.value, parents: act.body.parents, supersede: act.body.supersede === true };
    if (act.body.act === "cap") capLine.acts.push(entry);
    else { const line = laneLines.get(act.body.lane) ?? { acts: [] }; line.acts.push(entry); laneLines.set(act.body.lane, line); }
  }
  // A REFUSED CAP TIP BRAKES THE LINE: the cap reads the tightest cap the line ever held, never an older looser one (it fails toward
  // the brake, as a lower and a go do). A line with no standing cap reads none, so a refused cap alone opens nothing.
  const capRead = capLine.acts.length > 0 ? foldLine(capLine, [...wardRefusedCaps.values()].sort((a, b) => a.cid.localeCompare(b.cid))) : null;
  const cap = capRead === null ? null : capRead.value;
  const lanes = new Map([...laneLines].map(([lane, line]) => [lane, foldLine(line)] as const));
  const sum = [...lanes.values()].reduce((total, l) => total + l.value, 0);
  const over = cap !== null && sum > cap;
  const ok = !over && capRead?.unavailable === undefined && [...lanes.values()].every((l) => l.unavailable === undefined);
  const shares = new Map([...lanes].map(([lane, l]) => [lane, over || cap === null ? 0 : l.value] as const));
  return {
    cap, ok, ...(over ? { refusal: "swarm-shares-over-cap" as const } : {}),
    shares: shares as ReadonlyMap<string, number>,
    /** Each lane's folded value before the sum law closes it: what a writer checks a next act against. */
    raw: new Map([...lanes].map(([lane, l]) => [lane, l.value] as const)) as ReadonlyMap<string, number>,
    /** A lane's share: 0 for an unknown lane, an unset cap, a line that cannot fold, or a board whose shares sum past the cap. */
    shareOf: (lane: string): number => (cap === null ? 0 : shares.get(lane) ?? 0),
    /** The heads a next act on this line cites as its parents (`"cap"` or a lane name for a share). */
    capHeads: (): string[] => capRead?.heads ?? [],
    shareHeads: (lane: string): string[] => lanes.get(lane)?.heads ?? [],
    /** The acts no other act cites: what a hand's supersede cites when the line cannot fold. */
    capDangling: (): string[] => capRead?.dangling ?? [],
    /** Whether a cap the ward refused stands as the line's tip: the cap reads the line's tightest, and a hand's supersede roots it again. */
    capBraked: capRead?.braked === true,
    shareDangling: (lane: string): string[] => lanes.get(lane)?.dangling ?? [],
    /** Each line that cannot fold, by its reason: a writer refuses onto it, a reader names it. */
    unavailable: {
      ...(capRead?.unavailable ? { cap: capRead.unavailable } : {}),
      shares: new Map([...lanes].flatMap(([lane, l]) => (l.unavailable ? [[lane, l.unavailable] as const] : []))) as ReadonlyMap<string, SwarmLineUnavailable>,
    },
    state: { cap: capRead?.state ?? null, shares: new Map([...lanes].map(([lane, l]) => [lane, l.state] as const)) },
    refused,
  };
}
export type SwarmBoardReading = ReturnType<typeof readSwarmBoard>;
