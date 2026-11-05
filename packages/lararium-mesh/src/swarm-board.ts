/**
 * swarm-board — the house cap and the lane shares, a sibling record family on the face-private promote board doc.
 *
 * The cap and the shares cross devices (the whole swarm answers to one cap), so they ride the face's synced board and not the
 * device-local daemon wiki. The face's GRANT signs each act (the hand; a controller under a cap the hand granted joins at the ward
 * slice). The family has its own prefix and its own `swarm-act` signing domain, so a promote act never reads as a swarm act nor the reverse.
 *
 * Each LINE (the cap, one lane's share) folds by causal heads. Concurrent heads take the MINIMUM, so a fork can only tighten the swarm;
 * a line that cites a parent it lacks, or has no head, reads zero; shares that sum past the cap close every share to zero. The reading
 * names why (`refusal`), and a reader that cannot fold spends nothing.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { SWARM_ACT_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { storedLarRecord } from "./stored-record.js";

export const SWARM_BOARD_PREFIX = "lar:///ha.ka.ba/dreamnet/swarm-act/";
interface Base { readonly kind: typeof SWARM_ACT_DOMAIN; readonly group: string; readonly epoch: number; readonly value: number; readonly parents: readonly string[] }
export interface SwarmCapBody extends Base { readonly act: "cap" }
export interface SwarmShareBody extends Base { readonly act: "share"; readonly lane: string }
export type SwarmBoardBody = SwarmCapBody | SwarmShareBody;
export interface SignedSwarmBoardAct { readonly body: SwarmBoardBody; readonly signer: string; readonly sig: string }
type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
export interface SwarmBoardFace { readonly group: string; readonly grant: (key: string) => boolean }
export type SwarmBoardRefusal = "shape" | "domain" | "group" | "signature" | "grant";

const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): x is string => typeof x === "string";
const hex = (x: unknown): x is string => str(x) && /^[0-9a-f]{64}$/.test(x);

function shape(b: Record<string, unknown>): boolean {
  if (!str(b["group"]) || !Number.isSafeInteger(b["epoch"]) || (b["epoch"] as number) < 0) return false;
  if (!Number.isSafeInteger(b["value"]) || (b["value"] as number) < 0) return false;
  if (!Array.isArray(b["parents"]) || !b["parents"].every(hex) || new Set(b["parents"]).size !== b["parents"].length) return false;
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
  if (!object(raw) || !object(raw["body"]) || !hex(raw["signer"]) || !str(raw["sig"]) || !shape(raw["body"])) return { ok: false, refusal: "shape" };
  if (raw["body"]["kind"] !== SWARM_ACT_DOMAIN) return { ok: false, refusal: "domain" };
  if (raw["body"]["group"] !== face.group) return { ok: false, refusal: "group" };
  try { if (!verifyEd25519(raw["sig"], canonicalJsonBytes(raw["body"]), raw["signer"])) return { ok: false, refusal: "signature" }; } catch { return { ok: false, refusal: "signature" }; }
  if (!face.grant(raw["signer"])) return { ok: false, refusal: "grant" };
  const act = raw as unknown as SignedSwarmBoardAct;
  return { ok: true, act, cid: swarmBoardActCid(act) };
}

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
    if (text !== null) try { out.push(JSON.parse(text)); } catch { /* torn carriage */ }
  }
  return out;
}

interface Line { readonly acts: { readonly cid: string; readonly value: number; readonly parents: readonly string[] }[] }
/** One line's reading: the heads' minimum, 0 where the line cannot fold, and the heads a next act cites as its parents. */
function foldLine(line: Line): { value: number; heads: string[]; state: "settled" | "concurrent" | "unavailable" } {
  const ids = new Set(line.acts.map((a) => a.cid));
  if (line.acts.some((a) => a.parents.some((p) => !ids.has(p)))) return { value: 0, heads: [], state: "unavailable" };
  const cited = new Set(line.acts.flatMap((a) => a.parents));
  const heads = line.acts.filter((a) => !cited.has(a.cid));
  if (heads.length === 0) return { value: 0, heads: [], state: "unavailable" };
  return { value: Math.min(...heads.map((h) => h.value)), heads: heads.map((h) => h.cid).sort(), state: heads.length > 1 ? "concurrent" : "settled" };
}

export function readSwarmBoard(records: readonly unknown[], face: SwarmBoardFace) {
  const refused: { cid: string | null; refusal: SwarmBoardRefusal }[] = [], acts = new Map<string, SignedSwarmBoardAct>();
  for (const raw of records) {
    const r = readSwarmBoardAct(raw, face);
    if (r.ok) acts.set(r.cid, r.act);
    else {
      let cid: string | null = null;
      try { if (object(raw) && object(raw["body"]) && str(raw["signer"])) cid = swarmBoardActCid(raw as unknown as SignedSwarmBoardAct); } catch { /* shape refused */ }
      refused.push({ cid, refusal: r.refusal });
    }
  }
  refused.sort((a, b) => (a.cid ?? "").localeCompare(b.cid ?? "") || a.refusal.localeCompare(b.refusal));
  const capLine: Line = { acts: [] }, laneLines = new Map<string, Line>();
  for (const [cid, act] of [...acts].sort(([a], [b]) => a.localeCompare(b))) {
    const entry = { cid, value: act.body.value, parents: act.body.parents };
    if (act.body.act === "cap") capLine.acts.push(entry);
    else { const line = laneLines.get(act.body.lane) ?? { acts: [] }; line.acts.push(entry); laneLines.set(act.body.lane, line); }
  }
  const capRead = capLine.acts.length > 0 ? foldLine(capLine) : null;
  const cap = capRead === null ? null : capRead.value;
  const lanes = new Map([...laneLines].map(([lane, line]) => [lane, foldLine(line)] as const));
  const sum = [...lanes.values()].reduce((total, l) => total + l.value, 0);
  const over = cap !== null && sum > cap;
  const ok = !over;
  const shares = new Map([...lanes].map(([lane, l]) => [lane, over || cap === null ? 0 : l.value] as const));
  return {
    cap, ok, ...(over ? { refusal: "swarm-shares-over-cap" as const } : {}),
    shares: shares as ReadonlyMap<string, number>,
    /** A lane's share: 0 for an unknown lane, an unset cap, a line that cannot fold, or a board whose shares sum past the cap. */
    shareOf: (lane: string): number => (cap === null ? 0 : shares.get(lane) ?? 0),
    /** The heads a next act on this line cites as its parents (`"cap"` or a lane name for a share). */
    capHeads: (): string[] => capRead?.heads ?? [],
    shareHeads: (lane: string): string[] => lanes.get(lane)?.heads ?? [],
    state: { cap: capRead?.state ?? null, shares: new Map([...lanes].map(([lane, l]) => [lane, l.state] as const)) },
    refused,
  };
}
export type SwarmBoardReading = ReturnType<typeof readSwarmBoard>;
