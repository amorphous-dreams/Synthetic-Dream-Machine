/**
 * acting-face-fixture — stand a vessel the way a realm's hand needs it: a seated charter (the Nexus the realm stands
 * under) and a face that acts, whose key at that Nexus signs every vouch and every realm holder act
 * (cabal-realm#/the-steward-signer). A vessel wears no face between commands: a test whose vessel holds several faces
 * names the acting one on each act (`face`), as a command names `--face N`.
 *
 *   · `seatOwnCharter(faces, threshold)` stores one seat key per face named and seats a charter of those keys at
 *     the vessel's seal home; it answers the Nexus AID. A suite that seats its own charter calls `presentFace` alone.
 *   · `presentFace(index)` stands a face's root and answers its key at the primary charter's Nexus, minted where none
 *     stands (as a vouch would mint it).
 *   · `faceAt(index)` answers face `index`'s key at the primary charter's Nexus, minting none.
 */
import { nexusAidOf } from "@lararium/mesh";
import { generateOrLoadPersonaGroupRoot } from "../src/node-vessel-identity.js";
import { larSealHome } from "../src/vessel-paths.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { primaryNexusAid } from "../src/carried-set.js";
import { mintNexusLeaf, nexusLeafFor } from "../src/nexus-leaf.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { seatChairs } from "./seat-fixture.js";

/** Seat a charter whose seats this vessel holds (one per face named), at the vessel's own seal home. */
export async function seatOwnCharter(faces: readonly number[] = [0], threshold = 1): Promise<string> {
  for (const face of faces) await generateOrLoadPersonaGroupRoot(face);
  const keys = (await seatChairs(faces)).keys;
  const doc = heldCharter({ keys: [...keys], threshold }).doc();
  writeNexusDoc(larSealHome(), doc);
  return nexusAidOf(doc)!;
}

/** The primary charter's Nexus AID; throws where no charter stands, since no realm stands under nothing. */
export function primaryAid(): string {
  const aid = primaryNexusAid(larSealHome());
  if (aid === null) throw new Error("acting-face-fixture: no charter stands at the seal home");
  return aid;
}

/** Stand face `index` and answer its key at the primary charter's Nexus (minted, as an act there would). */
export async function presentFace(index = 0): Promise<string> {
  await generateOrLoadPersonaGroupRoot(index);
  return (await mintNexusLeaf(index, primaryAid())).verifyingKey.toLowerCase();
}

/** Face `index`'s key at the primary charter's Nexus, or null where none stands. Mints nothing. */
export async function faceAt(index = 0): Promise<string | null> {
  return (await nexusLeafFor(index, primaryAid()))?.verifyingKey.toLowerCase() ?? null;
}
