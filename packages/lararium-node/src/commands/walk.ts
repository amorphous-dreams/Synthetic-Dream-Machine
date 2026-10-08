/**
 * walk — a node vessel's walking doors behind `lares walk`: read where it walks, take a carried invite, and hand
 * one invite out of its wallet.
 *
 *   · `runWalkState`  — per hearth this vessel walks at: the Nexus, whether its invite still waits to settle, the
 *     grant it holds (its epoch, how many rolls it survived, its class), and how many invites its wallet holds —
 *     counts and its own records, never anyone else's.
 *   · `runWalkTake`   — take a carried `lar-invite:` string: kept durably before any dial, under the leaf of the
 *     face this vessel WEARS in the invite's Nexus. The vessel's hearth dial then walks in on it.
 *   · `runWalkInvite` — hand the newest invite out of the wallet, carried with the hearth's gate key, its Nexus and
 *     where its relay answers. Removed before it is returned.
 *
 * ONE HEARTH. A vessel holds one hearth dial, so it walks at one hearth: taking an invite for a second hearth —
 * beside a walk or a join dial that already stands — refuses aloud and writes nothing. Walking at several hearths
 * at once waits for one dial per (hearth, Nexus). A node carries no documents at a hearth: carriage is a
 * convenience for a vessel with no durable store of its own, and a node is one.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { decodeInvite, takeInvite, popInvite } from "@lararium/mesh";
import { larDataDir } from "../vessel-paths.js";
import { nodeWalkStore, listWalkRecords } from "../node-walk-store.js";
import { wornNexusLeaf } from "../nexus-leaf.js";

/** A refusal a walking door names, with nothing written. */
export class WalkRefusal extends Error {}

/** One hearth this vessel walks at, as `lares walk` reads it. */
export interface WalkReading {
  readonly gatePubKey: string;
  readonly nexusAid:   string;
  readonly relay:      string | null;
  /** True while the carried invite waits for a grant-bearing dial to settle it. */
  readonly redeeming:  boolean;
  readonly grant:      { readonly epoch: string; readonly survived: number; readonly from: "host" | "walker" } | null;
  /** Unspent invites in the wallet. */
  readonly wallet:     number;
}

/** Every hearth this vessel walks at. */
export function runWalkState(opts: { readonly storageDir?: string } = {}): readonly WalkReading[] {
  return listWalkRecords(opts.storageDir ?? larDataDir()).map(({ gatePubKey, record }) => ({
    gatePubKey, nexusAid: record.nexusAid, relay: record.relay ?? null, redeeming: record.invite !== undefined,
    grant: record.grant ? { epoch: record.grant.epoch, survived: record.grant.survived, from: record.grant.from } : null,
    wallet: record.wallet?.length ?? 0,
  }));
}

/**
 * Take a carried invite. Refuses — writing nothing — a torn invite, an invite whose Nexus this vessel wears no face
 * in, and an invite for a second hearth beside the one this vessel already walks at or dials (`dialGate`, the gate
 * key a standing join dial pins).
 */
export async function runWalkTake(opts: {
  readonly carried: string; readonly storageDir?: string; readonly dialGate?: string | null;
}): Promise<{ readonly gatePubKey: string; readonly nexusAid: string; readonly relay: string | null; readonly leaf: string }> {
  const storageDir = opts.storageDir ?? larDataDir();
  const invite = decodeInvite(opts.carried);
  if (!invite) throw new WalkRefusal("that is not a carried invite — it opens on `lar-invite:`");
  const gate = invite.gatePubKey.toLowerCase();
  const other = listWalkRecords(storageDir).find((w) => w.gatePubKey !== gate);
  if (other) {
    throw new WalkRefusal(`this vessel already walks at the hearth ${other.gatePubKey.slice(0, 16)}… — a vessel walks at one hearth, and a second waits for one dial per hearth`);
  }
  const dialGate = opts.dialGate?.toLowerCase();
  if (dialGate && dialGate !== gate) {
    throw new WalkRefusal(`this vessel's dial stands to the hearth ${dialGate.slice(0, 16)}… — a vessel dials one hearth, and a walk elsewhere waits for one dial per hearth`);
  }
  if (!invite.relay && !(await nodeWalkStore(storageDir).read(gate))?.relay) {
    throw new WalkRefusal("the invite names no relay to dial — ask its giver for one that carries where the hearth answers");
  }
  const leaf = await wornNexusLeaf(invite.nexusAid);
  if (!leaf) throw new WalkRefusal("this vessel wears no face — a walker walks as a person: `lares persona wear <N>` first");
  const taken = await takeInvite(nodeWalkStore(storageDir), opts.carried);
  if (!taken) throw new WalkRefusal("the invite could not be kept");
  return { gatePubKey: taken.gatePubKey, nexusAid: taken.record.nexusAid, relay: taken.record.relay ?? null, leaf: leaf.verifyingKey };
}

/** Hand the newest invite out of the wallet of the hearth this vessel walks at. Refuses an empty wallet. */
export async function runWalkInvite(opts: { readonly storageDir?: string } = {}): Promise<{ readonly gatePubKey: string; readonly invite: string; readonly left: number }> {
  const storageDir = opts.storageDir ?? larDataDir();
  const walks = listWalkRecords(storageDir);
  const at = walks[0];
  if (!at) throw new WalkRefusal("this vessel walks nowhere — take an invite first (`lares walk take <lar-invite:…>`)");
  const store = nodeWalkStore(storageDir);
  const invite = await popInvite(store, at.gatePubKey, at.record.relay);
  if (!invite) throw new WalkRefusal("the wallet holds no invite — it fills at the next dial that stands on a grant this epoch");
  return { gatePubKey: at.gatePubKey, invite, left: (await store.read(at.gatePubKey))?.wallet?.length ?? 0 };
}
