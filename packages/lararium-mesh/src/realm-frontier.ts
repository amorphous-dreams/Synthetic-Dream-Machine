/** A realm board's charter quorum commits its raises through the shared K17 hand frontier. */
import type { LarDoc } from "./base-doc.js";
import type { EdgeKapae } from "./edge-kapae.js";
import { foldHandFrontiers, signGenesisFrontier, signNextFrontier, type EdgeFrontier, type WideningRead } from "./edge-frontier.js";
import { edgeFrontierRecords, frontierSnapshots, writeEdgeFrontier, writeFrontierSnapshot } from "./edge-frontier-board.js";
import { landHandFrontier, landHandGenesis, nextHandFrontier, readHandFrontier, handFrontierCarriage, type HandFrontierCarriage, type RegisteredFrontier } from "./fleet-frontier.js";
import { currentRoster, makeHandLineage, type HandLineage } from "./hand-lineage.js";

export const REALM_HAND = "quorum" as const;
type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
const bare = (realm: string): string => realm.toLowerCase();

export function realmRaiseCids(counted: readonly Pick<EdgeKapae, "actCid" | "raised" | "hand">[]): string[] {
  return counted.filter((a) => a.raised && a.hand === REALM_HAND).map((a) => a.actCid).sort();
}

export function readRealmFrontier(input: {
  readonly realm: string; readonly board: LarDoc | undefined | null; readonly lineage: HandLineage;
  readonly seenRaises: readonly string[]; readonly pinned: { readonly seq: number; readonly cid: string } | null;
  readonly carried?: readonly HandFrontierCarriage[];
}): WideningRead {
  return readHandFrontier({ ...input, boardId: bare(input.realm), hand: REALM_HAND });
}

export function landRealmGenesis(draft: LarDoc, realm: string, lineage: HandLineage, signers: readonly Signer[]): Promise<EdgeFrontier> {
  return landHandGenesis(draft, bare(realm), REALM_HAND, lineage, signers);
}

export function nextRealmFrontier(input: {
  readonly realm: string; readonly board: LarDoc | undefined | null; readonly lineage: HandLineage;
  readonly counted: readonly string[]; readonly signers: readonly Signer[];
}): Promise<RegisteredFrontier | null> {
  return nextHandFrontier({ ...input, boardId: bare(input.realm), hand: REALM_HAND });
}

export function landRealmFrontier(draft: LarDoc, registered: RegisteredFrontier): void { landHandFrontier(draft, registered); }
export function realmFrontierCarriage(board: LarDoc | undefined | null, realm: string) {
  return handFrontierCarriage(board, bare(realm), REALM_HAND);
}

/** Choose the one frontier a writer needs to land for this board sighting. */
export async function ensureHandFrontier(input: {
  readonly boardId: string; readonly hand: string; readonly board: LarDoc | undefined | null; readonly lineage: HandLineage;
  readonly counted: readonly string[]; readonly signers: readonly Signer[];
}): Promise<{ readonly kind: "genesis"; readonly frontier: EdgeFrontier; readonly raises: readonly string[] } |
  { readonly kind: "next"; readonly frontier: EdgeFrontier; readonly raises: readonly string[] } |
  { readonly kind: "none" } | null> {
  const boardId = bare(input.boardId);
  const fold = foldHandFrontiers(boardId, { hand: input.hand, lineage: input.lineage }, edgeFrontierRecords(input.board, boardId, input.hand));
  if (fold.fork) return null;
  const head = fold.chain[fold.chain.length - 1];
  if (!head) {
    const roster = currentRoster(input.lineage);
    const frontier = await signGenesisFrontier({ board: boardId, hand: input.hand, epoch: roster.epoch, rosterHash: roster.rosterHash }, input.signers);
    return { kind: "genesis", frontier, raises: [] };
  }
  const held = frontierSnapshots(input.board).get(head.act.body.snapshot);
  if (!held) return null;
  if (head.act.body.epoch === currentRoster(input.lineage).epoch && input.counted.every((c) => held.includes(c))) return { kind: "none" };
  const next = await nextHandFrontier({ ...input, boardId });
  return next ? { kind: "next", ...next } : null;
}

export const ensureRealmFrontier = (input: { readonly realm: string; readonly board: LarDoc | undefined | null; readonly lineage: HandLineage; readonly counted: readonly string[]; readonly signers: readonly Signer[] }) =>
  ensureHandFrontier({ ...input, boardId: input.realm, hand: REALM_HAND });

type Ensured = NonNullable<Awaited<ReturnType<typeof ensureHandFrontier>>>;
/** What a writer lands in its board change: a head, or a founded genesis with the first raises already counted. */
export type PreparedHandFrontier = Ensured | {
  readonly kind: "genesis-and-next"; readonly genesis: EdgeFrontier; readonly next: EdgeFrontier; readonly raises: readonly string[];
};

/** Sign every head a writer needs BEFORE its synchronous board change; a fork or unusable head refuses. */
export type PreparedRealmFrontier = PreparedHandFrontier;
export async function prepareHandFrontier(input: {
  readonly boardId: string; readonly hand: string; readonly board: LarDoc | undefined | null; readonly lineage: HandLineage;
  readonly counted: readonly string[]; readonly signers: readonly Signer[];
}): Promise<PreparedHandFrontier> {
  const prepared = await ensureHandFrontier(input);
  if (!prepared) throw new Error("realm-frontier: fork-or-unusable-head");
  if (prepared.kind === "genesis" && input.counted.length > 0) {
    const roster = currentRoster(input.lineage);
    const raises = [...new Set(input.counted)].sort();
    const next = await signNextFrontier(prepared.frontier, raises, { epoch: roster.epoch, rosterHash: roster.rosterHash }, input.signers);
    return { kind: "genesis-and-next", genesis: prepared.frontier, next, raises };
  }
  return prepared;
}

export const prepareRealmFrontier = (input: { readonly realm: string; readonly board: LarDoc | undefined | null; readonly lineage: HandLineage; readonly counted: readonly string[]; readonly signers: readonly Signer[] }) =>
  prepareHandFrontier({ ...input, boardId: input.realm, hand: REALM_HAND });

/** Land a prepared head and its snapshot inside the caller's board change. */
export function registerHandFrontierInto(draft: LarDoc, prepared: PreparedHandFrontier): void {
  if (prepared.kind === "genesis") {
    writeFrontierSnapshot(draft, []);
    writeEdgeFrontier(draft, prepared.frontier);
  } else if (prepared.kind === "genesis-and-next") {
    writeFrontierSnapshot(draft, []);
    writeEdgeFrontier(draft, prepared.genesis);
    landRealmFrontier(draft, { frontier: prepared.next, raises: prepared.raises });
  } else if (prepared.kind === "next") landRealmFrontier(draft, prepared);
}
export const registerRealmFrontierInto = registerHandFrontierInto;

/** One voucher signs its own frontier stream on the realm board. */
export function holderHand(voucherDid: string): string {
  const did = voucherDid.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(did)) throw new Error("realm-frontier: voucher key must be 64 hex digits");
  return `holder:${did}`;
}

export function holderLineage(voucherDid: string): HandLineage {
  const did = holderHand(voucherDid).slice("holder:".length);
  const lineage = makeHandLineage([{ epoch: 0, signers: [did], threshold: 1 }]);
  if (!lineage) throw new Error("realm-frontier: holder lineage refused");
  return lineage;
}

export function holderRaiseCids(counted: readonly Pick<EdgeKapae, "actCid" | "raised" | "hand" | "edgeId">[], edgeIds: ReadonlySet<string>): string[] {
  return counted.filter((a) => a.raised && a.hand === "holder" && edgeIds.has(a.edgeId)).map((a) => a.actCid).sort();
}

export function readHolderFrontier(input: { readonly realm: string; readonly board: LarDoc | undefined | null; readonly voucher: string; readonly edgeIds: ReadonlySet<string>; readonly counted: readonly Pick<EdgeKapae, "actCid" | "raised" | "hand" | "edgeId">[]; readonly pinned: { readonly seq: number; readonly cid: string } | null; readonly carried?: readonly HandFrontierCarriage[] }): WideningRead {
  return readHandFrontier({ boardId: bare(input.realm), board: input.board, hand: holderHand(input.voucher), lineage: holderLineage(input.voucher), seenRaises: holderRaiseCids(input.counted, input.edgeIds), pinned: input.pinned, ...(input.carried ? { carried: input.carried } : {}) });
}

export function prepareHolderFrontier(input: { readonly realm: string; readonly board: LarDoc | undefined | null; readonly voucher: string; readonly counted: readonly string[]; readonly signer: Signer }): Promise<PreparedHandFrontier> {
  if (input.signer.key.toLowerCase().replace(/^0x/, "") !== holderHand(input.voucher).slice(7)) throw new Error("realm-frontier: signer does not hold voucher key");
  return prepareHandFrontier({ boardId: input.realm, hand: holderHand(input.voucher), board: input.board, lineage: holderLineage(input.voucher), counted: input.counted, signers: [input.signer] });
}

export function readRealmBoardFrontiers(input: { readonly realm: string; readonly board: LarDoc | undefined | null; readonly quorumLineage: HandLineage | null; readonly vouchers: ReadonlyMap<string, ReadonlySet<string>>; readonly counted: readonly Pick<EdgeKapae, "actCid" | "raised" | "hand" | "edgeId">[]; readonly pins: Readonly<Record<string, { seq: number; cid: string }>>; readonly carried?: readonly HandFrontierCarriage[] }): { quorum: WideningRead; holders: ReadonlyMap<string, WideningRead> } {
  const quorum = input.quorumLineage ? readRealmFrontier({ realm: input.realm, board: input.board, lineage: input.quorumLineage, seenRaises: realmRaiseCids(input.counted), pinned: input.pins[REALM_HAND] ?? null, ...(input.carried ? { carried: input.carried } : {}) }) : { status: "unknown" as const, missing: [{ hand: REALM_HAND, why: "no-frontier" as const }] };
  const holders = new Map<string, WideningRead>();
  for (const [voucher, edgeIds] of input.vouchers) holders.set(voucher, readHolderFrontier({ realm: input.realm, board: input.board, voucher, edgeIds, counted: input.counted, pinned: input.pins[holderHand(voucher)] ?? null, ...(input.carried ? { carried: input.carried } : {}) }));
  return { quorum, holders };
}

export function waitingVouchers(read: ReturnType<typeof readRealmBoardFrontiers>): string[] {
  return [...read.holders].filter(([, result]) => result.status !== "known").map(([voucher]) => voucher).sort();
}
