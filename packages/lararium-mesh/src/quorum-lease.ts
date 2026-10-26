/**
 * quorum-lease — a Nexus or realm lease rises only on a charter quorum's signed advance.
 * Each advance has its own content-addressed slot, so concurrent advances survive and the verified max climbs.
 * The fold is monotone: an advance an older roster signed under its own epoch's keys still counts, and nothing
 * lowers the maximum, so a late sighting never un-stales what a lower epoch once cut. A closed roster's keys can
 * therefore still raise (stale more, never less) until the recovery door closes that window.
 */
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { QUORUM_LEASE_DOMAIN } from "./domains.js";
import { leaseEpochPrefix } from "./epoch-lease.js";
import { currentRoster, rosterAt, type HandLineage } from "./hand-lineage.js";
import { actCid, readQuorumAct, signQuorumAct, type ActBody, type QuorumAct } from "./signed-act.js";
import { storedLarRecord } from "./stored-record.js";

type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
export interface QuorumLeaseBody extends ActBody {
  readonly kind: typeof QUORUM_LEASE_DOMAIN;
  readonly epoch: number;
  readonly handEpoch: number;
  readonly rosterHash: string;
}
export type QuorumLease = QuorumAct<QuorumLeaseBody>;

/** Sign at the current charter roster, with enough distinct seated hands. */
export function signQuorumLease(parts: { resource: string; epoch: number; lineage: HandLineage }, signers: readonly Signer[]): Promise<QuorumLease> {
  if (!Number.isSafeInteger(parts.epoch) || parts.epoch < 0) throw new Error("quorum-lease: epoch reads a non-negative integer");
  const roster = currentRoster(parts.lineage);
  const keys = signers.map((s) => s.key.toLowerCase());
  if (new Set(keys).size < roster.threshold || keys.some((k) => !roster.signers.includes(k))) throw new Error("quorum-lease: signer quorum does not stand");
  return signQuorumAct({ kind: QUORUM_LEASE_DOMAIN, group: parts.resource, seq: 0, prior: null,
    epoch: parts.epoch, handEpoch: roster.epoch, rosterHash: roster.rosterHash }, signers);
}

/** One content id names one advance; face writer slots occupy one encoded segment instead. */
export function quorumLeaseSlotUri(resource: string, cid: string): string {
  return `${leaseEpochPrefix(resource)}quorum/${cid}`;
}

function verified(resource: string, text: unknown, lineage: HandLineage): QuorumLeaseBody | null {
  if (typeof text !== "string") return null;
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const read = readQuorumAct(raw, { domain: QUORUM_LEASE_DOMAIN, group: resource, seatsFor: (body) => {
    const roster = rosterAt(lineage, body["handEpoch"]);
    return roster && roster.rosterHash === body["rosterHash"] ? roster : null;
  } });
  if (!read.ok) return null;
  const body = read.act.body as QuorumLeaseBody;
  return body.seq === 0 && body.prior === null && Number.isSafeInteger(body.epoch) && body.epoch >= 0 ? body : null;
}

/** Verify one carried slot under its own seal epoch's keys. */
export function readQuorumLease(resource: string, text: unknown, lineage: HandLineage): number | null {
  return verified(resource, text, lineage)?.epoch ?? null;
}

/** Fold verified advances: the maximum only climbs, so no later sighting un-stales a grant or an invite a lower epoch once cut. */
export function quorumLeaseEpoch(resource: string, slotTexts: Iterable<unknown>, lineage: HandLineage | null): number {
  if (!lineage) return 0;
  let max = 0;
  for (const text of slotTexts) { const body = verified(resource, text, lineage); if (body && body.epoch > max) max = body.epoch; }
  return max;
}

/** Read only content-addressed quorum slots from a board. */
export function quorumLeaseEpochOnBoard(doc: LarDoc | undefined | null, resource: string, lineage: HandLineage | null): number {
  const prefix = `${leaseEpochPrefix(resource)}quorum/`;
  const texts: string[] = [];
  for (const [title, record] of Object.entries(doc?.tiddlers ?? {})) {
    if (!title.startsWith(prefix)) continue;
    const text = tiddlerText(record);
    if (text === null) continue;
    try { const raw = JSON.parse(text) as { body?: ActBody }; if (raw.body && actCid(raw.body) === title.slice(prefix.length)) texts.push(text); }
    catch { /* an untrusted slot raises nothing */ }
  }
  return quorumLeaseEpoch(resource, texts, lineage);
}

/** Land one advance inside a board change. */
export function landQuorumLease(draft: LarDoc, resource: string, act: QuorumLease): void {
  if (act.body.group !== resource) throw new Error("quorum-lease: wrong resource");
  const cid = actCid(act.body);
  const title = quorumLeaseSlotUri(resource, cid);
  draft.tiddlers[title] = storedLarRecord(title, { text: JSON.stringify({ body: act.body, signatures: act.signatures }) }, cid);
}
