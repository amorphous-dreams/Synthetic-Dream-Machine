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
}): Promise<{ readonly held: boolean; readonly reason?: string }> {
  if (!input.door) return { held: false, reason: "the island wears no seated face, so no group holds the stage" };
  // The door's ledger adopts a mint that stands: a second ask grants and writes nothing.
  await input.door.mint(KAHUA_BAG, "admin");
  const proof = await input.verify({ presenter: input.presenter, bagUrl: KAHUA_BAG, access: "admin" });
  return proof.ok ? { held: true } : { held: false, reason: proof.reason ?? "no grant" };
}
