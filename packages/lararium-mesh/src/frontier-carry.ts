/** A partial carries the signatures of the frontier it asks a second seat to complete. */
import type { LarDoc } from "./base-doc.js";
import { EDGE_FRONTIER_DOMAIN } from "./domains.js";
import { foldHandFrontiers, frontierSnapshotCid, type EdgeFrontier } from "./edge-frontier.js";
import { edgeFrontierRecords, writeEdgeFrontier, writeFrontierSnapshot } from "./edge-frontier-board.js";
import type { HandLineage } from "./hand-lineage.js";
import { actBytes, actCid } from "./signed-act.js";
import type { PreparedHandFrontier } from "./realm-frontier.js";

export interface FrontierCarry { readonly records: readonly EdgeFrontier[]; readonly raises: readonly string[] }
type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
const record = (v: unknown): Record<string, unknown> | null => typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
const keys = (r: Record<string, unknown>, expected: readonly string[]): boolean => Object.keys(r).length === expected.length && expected.every((k) => Object.hasOwn(r, k));

export function carryOfPrepared(prepared: PreparedHandFrontier): FrontierCarry | null {
  if (prepared.kind === "none") return null;
  return prepared.kind === "genesis-and-next"
    ? { records: [prepared.genesis, prepared.next], raises: prepared.raises }
    : { records: [prepared.frontier], raises: prepared.raises };
}

export function landFrontierCarry(draft: LarDoc, carry: FrontierCarry): void {
  if (carry.records.length === 2) { writeFrontierSnapshot(draft, []); writeEdgeFrontier(draft, carry.records[0]!); }
  writeFrontierSnapshot(draft, carry.raises);
  writeEdgeFrontier(draft, carry.records[carry.records.length - 1]!);
}

/** Parse transport shape only. Lineage and signatures receive their verdict at the landing board. */
export function readFrontierCarry(parsed: unknown): FrontierCarry | null {
  const p = record(parsed);
  if (!p || !keys(p, ["records", "raises"]) || !Array.isArray(p["records"]) || p["records"].length < 1 || p["records"].length > 2) return null;
  if (!Array.isArray(p["raises"]) || p["raises"].length > 4096 || p["raises"].some((x) => typeof x !== "string")) return null;
  const records: EdgeFrontier[] = [];
  for (const raw of p["records"] as unknown[]) {
    const r = record(raw), b = r && record(r["body"]);
    if (!r || !b || !keys(r, ["body", "signatures"]) || !keys(b, ["kind", "group", "seq", "prior", "hand", "snapshot", "epoch", "rosterHash"])) return null;
    if (b["kind"] !== EDGE_FRONTIER_DOMAIN || typeof b["group"] !== "string" || typeof b["hand"] !== "string" || typeof b["snapshot"] !== "string" || typeof b["rosterHash"] !== "string") return null;
    if (!Number.isSafeInteger(b["seq"]) || (b["seq"] as number) < 0 || !Number.isSafeInteger(b["epoch"]) || (b["epoch"] as number) < 0) return null;
    if ((b["seq"] === 0) !== (b["prior"] === null) || (b["prior"] !== null && typeof b["prior"] !== "string")) return null;
    if (!Array.isArray(r["signatures"]) || r["signatures"].length > 256) return null;
    for (const s of r["signatures"] as unknown[]) { const sig = record(s); if (!sig || !keys(sig, ["signer", "sig"]) || typeof sig["signer"] !== "string" || typeof sig["sig"] !== "string") return null; }
    records.push(raw as EdgeFrontier);
  }
  if (records.length === 2 && (records[0]!.body.seq !== 0 || records[1]!.body.seq !== 1 || records[1]!.body.prior !== actCid(records[0]!.body))) return null;
  if (records[records.length - 1]!.body.snapshot !== frontierSnapshotCid(p["raises"] as string[])) return null;
  if (records.length === 2 && records[0]!.body.snapshot !== frontierSnapshotCid([])) return null;
  return { records, raises: p["raises"] as string[] };
}

export async function cosignFrontierCarry(carry: FrontierCarry, signers: readonly Signer[]): Promise<FrontierCarry> {
  return { raises: carry.raises, records: await Promise.all(carry.records.map(async (frontier) => {
    const signatures: { signer: string; sig: string }[] = [];
    const seen = new Set<string>();
    for (const signature of frontier.signatures) {
      const key = signature.signer.toLowerCase();
      if (seen.has(key)) continue;
      signatures.push({ signer: key, sig: signature.sig });
      seen.add(key);
    }
    for (const signer of signers) {
      const key = signer.key.toLowerCase();
      if (seen.has(key)) continue;
      signatures.push({ signer: key, sig: await signer.sign(actBytes(frontier.body)) });
      seen.add(key);
    }
    return { body: frontier.body, signatures };
  })) };
}

export function frontierCarryAgrees(carry: FrontierCarry, prepared: PreparedHandFrontier): boolean {
  const own = carryOfPrepared(prepared);
  return own !== null && own.records.length === carry.records.length && own.raises.length === carry.raises.length &&
    own.raises.every((raise, i) => raise === carry.raises[i]) && own.records.every((r, i) => actCid(r.body) === actCid(carry.records[i]!.body));
}

/** Union signatures by cid before the hand's lineage fold judges the proposed head. */
export function frontierCarryStands(input: { readonly carry: FrontierCarry; readonly board: LarDoc | undefined | null; readonly boardId: string; readonly hand: string; readonly lineage: HandLineage }): boolean {
  if (!readFrontierCarry(input.carry)) return false;
  const merged = new Map<string, EdgeFrontier>();
  for (const raw of [...edgeFrontierRecords(input.board, input.boardId, input.hand), ...input.carry.records]) {
    const r = record(raw), b = r && record(r["body"]);
    if (!r || !b || !Array.isArray(r["signatures"])) continue;
    const frontier = raw as EdgeFrontier, cid = actCid(frontier.body), prior = merged.get(cid);
    merged.set(cid, prior ? { body: prior.body, signatures: [...prior.signatures, ...frontier.signatures] } : frontier);
  }
  const fold = foldHandFrontiers(input.boardId, { hand: input.hand, lineage: input.lineage }, [...merged.values()]);
  const last = input.carry.records[input.carry.records.length - 1];
  return !fold.fork && !!last && fold.chain[fold.chain.length - 1]?.cid === actCid(last.body);
}
