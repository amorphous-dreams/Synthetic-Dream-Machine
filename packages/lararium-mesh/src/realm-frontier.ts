/** A realm board's charter quorum commits its raises through the shared K17 hand frontier. */
import type { LarDoc } from "./base-doc.js";
import type { EdgeKapae } from "./edge-kapae.js";
import { foldHandFrontiers, signGenesisFrontier, signNextFrontier, type EdgeFrontier, type WideningRead } from "./edge-frontier.js";
import { edgeFrontierRecords, frontierSnapshots, writeEdgeFrontier, writeFrontierSnapshot } from "./edge-frontier-board.js";
import { landHandFrontier, landHandGenesis, nextHandFrontier, readHandFrontier, handFrontierCarriage, type RegisteredFrontier } from "./fleet-frontier.js";
import { currentRoster, type HandLineage } from "./hand-lineage.js";

export const REALM_HAND = "quorum" as const;
type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
const bare = (realm: string): string => realm.toLowerCase();

export function realmRaiseCids(counted: readonly Pick<EdgeKapae, "actCid" | "raised" | "hand">[]): string[] {
  return counted.filter((a) => a.raised && a.hand === REALM_HAND).map((a) => a.actCid).sort();
}

export function readRealmFrontier(input: {
  readonly realm: string; readonly board: LarDoc | undefined | null; readonly lineage: HandLineage;
  readonly seenRaises: readonly string[]; readonly pinned: { readonly seq: number; readonly cid: string } | null;
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
export async function ensureRealmFrontier(input: {
  readonly realm: string; readonly board: LarDoc | undefined | null; readonly lineage: HandLineage;
  readonly counted: readonly string[]; readonly signers: readonly Signer[];
}): Promise<{ readonly kind: "genesis"; readonly frontier: EdgeFrontier; readonly raises: readonly string[] } |
  { readonly kind: "next"; readonly frontier: EdgeFrontier; readonly raises: readonly string[] } |
  { readonly kind: "none" } | null> {
  const realm = bare(input.realm);
  const fold = foldHandFrontiers(realm, { hand: REALM_HAND, lineage: input.lineage }, edgeFrontierRecords(input.board, realm, REALM_HAND));
  if (fold.fork) return null;
  const head = fold.chain[fold.chain.length - 1];
  if (!head) {
    const roster = currentRoster(input.lineage);
    const frontier = await signGenesisFrontier({ board: realm, hand: REALM_HAND, epoch: roster.epoch, rosterHash: roster.rosterHash }, input.signers);
    return { kind: "genesis", frontier, raises: [] };
  }
  const held = frontierSnapshots(input.board).get(head.act.body.snapshot);
  if (!held) return null;
  if (head.act.body.epoch === currentRoster(input.lineage).epoch && input.counted.every((c) => held.includes(c))) return { kind: "none" };
  const next = await nextRealmFrontier(input);
  return next ? { kind: "next", ...next } : null;
}

type Ensured = NonNullable<Awaited<ReturnType<typeof ensureRealmFrontier>>>;
/** What a writer lands in its board change: a head, or a founded genesis with the first raises already counted. */
export type PreparedRealmFrontier = Ensured | {
  readonly kind: "genesis-and-next"; readonly genesis: EdgeFrontier; readonly next: EdgeFrontier; readonly raises: readonly string[];
};

/** Sign every head a writer needs BEFORE its synchronous board change; a fork or unusable head refuses. */
export async function prepareRealmFrontier(input: {
  readonly realm: string; readonly board: LarDoc | undefined | null; readonly lineage: HandLineage;
  readonly counted: readonly string[]; readonly signers: readonly Signer[];
}): Promise<PreparedRealmFrontier> {
  const prepared = await ensureRealmFrontier(input);
  if (!prepared) throw new Error("realm-frontier: fork-or-unusable-head");
  if (prepared.kind === "genesis" && input.counted.length > 0) {
    const roster = currentRoster(input.lineage);
    const raises = [...new Set(input.counted)].sort();
    const next = await signNextFrontier(prepared.frontier, raises, { epoch: roster.epoch, rosterHash: roster.rosterHash }, input.signers);
    return { kind: "genesis-and-next", genesis: prepared.frontier, next, raises };
  }
  return prepared;
}

/** Land a prepared head and its snapshot inside the caller's board change. */
export function registerRealmFrontierInto(draft: LarDoc, prepared: PreparedRealmFrontier): void {
  if (prepared.kind === "genesis") {
    writeFrontierSnapshot(draft, []);
    writeEdgeFrontier(draft, prepared.frontier);
  } else if (prepared.kind === "genesis-and-next") {
    writeFrontierSnapshot(draft, []);
    writeEdgeFrontier(draft, prepared.genesis);
    landRealmFrontier(draft, { frontier: prepared.next, raises: prepared.raises });
  } else if (prepared.kind === "next") landRealmFrontier(draft, prepared);
}
