/**
 * kahua-cap — the lōkahi cap: whether a presenter of the face CAN lift onto the face's kahua stage.
 *
 * Capability lives in Keyhive's plane: the face's door mints the stage bag (`KAHUA_BAG`) and grants the face's group the
 * one Keyhive power a face holds over its own bags (`admin`: seat and unseat within it). A member of the group holds the
 * cap; a stranger, or a face that stands unseated, holds none. The cap answers CAN; the operator's signed lift answers
 * CHOSE (`kahua-stage`), and a held cap never stands in for that choice.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage#/caps
 */
import { KAHUA_BAG, type CapabilityVerifyArgs, type CapabilityVerifyResult } from "@lararium/mesh";
import type { FaceBagDoor } from "./face-bag-door.js";

export async function answerKahuaCap(input: {
  /** The seated face's bag door; null where the island wears no face whose group Keyhive knows. */
  readonly door: FaceBagDoor | null;
  readonly verify: (args: CapabilityVerifyArgs) => Promise<CapabilityVerifyResult>;
  readonly presenter: string;
  /** A write path's ask (lift, withdraw, carry): where the verify misses, mint the stage bag to the face's group, then verify again. */
  readonly ensure?: boolean;
}): Promise<{ readonly held: boolean; readonly reason?: string }> {
  if (!input.door) return { held: false, reason: "the island wears no seated face, so no group holds the stage" };
  // THE READ VERIFIES FIRST AND WRITES NOTHING: a held cap answers at once; only a write path's ensure mints, and only
  // where the verify missed (the door's ledger adopts a mint that stands).
  const ask = () => input.verify({ presenter: input.presenter, bagUrl: KAHUA_BAG, access: "admin" });
  let proof = await ask();
  if (!proof.ok && input.ensure === true) {
    await input.door.mint(KAHUA_BAG, "admin");
    proof = await ask();
  }
  return proof.ok ? { held: true } : { held: false, reason: proof.reason ?? "no grant" };
}
