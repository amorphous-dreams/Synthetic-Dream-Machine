/**
 * kahu-reach-fixture — the hands a write-door suite tries against system canon: a Kahu hand (a counted 1-of-1
 * admission AND a sentinel membership) and the strangers that each lack a fact the predicate reads.
 */
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import type { KahuQuorumSeats } from "../src/kapae-antigen.js";
import { openKahuCabalAct, signKahuCabalAct, kahuCabalActCid } from "../src/kahu-cabal-admission.js";
import type { KahuReachSource } from "../src/kahu-canon-reach.js";

export const REACH_NEXUS = "nexus-" + "ab".repeat(32);
export const REACH_GROUP = "cd".repeat(32);
const SEAT_SEED = new Uint8Array(32).fill(7);

async function roster(): Promise<KahuQuorumSeats> {
  return { keys: [hex(await ed.getPublicKeyAsync(SEAT_SEED))], threshold: 1, sealEpochCid: "epoch-cid-reach-1" };
}

async function admission(seats: KahuQuorumSeats, action: "admit" | "remove" = "admit", parents: string[] = []) {
  const open = openKahuCabalAct({ nexus: REACH_NEXUS, group: REACH_GROUP, action, parents, roster: seats });
  const signer = hex(await ed.getPublicKeyAsync(SEAT_SEED));
  return signKahuCabalAct(open, [{ signer, sign: (b: Uint8Array) => ed.signAsync(b, SEAT_SEED).then(hex) }], seats);
}

/** The Kahu hand: a counted 1-of-1 admission for the group, and its sentinel membership read. */
export async function kahuHand(): Promise<KahuReachSource> {
  const seats = await roster();
  const acts = [await admission(seats)];
  return () => ({ group: REACH_GROUP, nexus: REACH_NEXUS, roster: seats, acts, sentinelMember: true });
}

/** A stranger of one kind: the sentinel member nobody admitted, the admitted group outside the sentinel, a removed one, or no cabal at all. */
export async function strangerHand(kind: "joined-without-admission" | "admitted-not-joined" | "removed" | "no-cabal"): Promise<KahuReachSource> {
  if (kind === "no-cabal") return () => null;
  const seats = await roster();
  if (kind === "joined-without-admission") return () => ({ group: REACH_GROUP, nexus: REACH_NEXUS, roster: seats, acts: [], sentinelMember: true });
  const admit = await admission(seats);
  if (kind === "admitted-not-joined") return () => ({ group: REACH_GROUP, nexus: REACH_NEXUS, roster: seats, acts: [admit], sentinelMember: false });
  const remove = await admission(seats, "remove", [kahuCabalActCid(admit)]);
  return () => ({ group: REACH_GROUP, nexus: REACH_NEXUS, roster: seats, acts: [admit, remove], sentinelMember: true });
}
