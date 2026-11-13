/**
 * face-root-holdings — the faces whose PersonaGroup root this vessel holds, and the scopes each stands at here.
 *
 * Two readers answer from it: the fleet-join door's OFFER and ANSWER (`commands/fleet-join`), which name and
 * re-read a face's scopes, and the grant ring a gate asks (`gate-rings` `rootHoldings`), which answers the grant
 * the held root would sign for a face key at a scope. Both read the scopes alike: a scope stands at a Nexus this
 * vessel holds a charter for (its own, and each it carries) where the face holds its per-Nexus key. A read mints
 * no key and touches no root seed.
 */
import { primaryNexusAid, readCarriedCharters } from "./carried-set.js";
import { nexusKeyPublicOf, readNexusKey } from "./face-key-custody.js";
import { loadPersonaGroupRootVerifyingKey } from "./node-vessel-identity.js";
import type { FaceScope } from "@lararium/mesh";
import type { GateRootHolding } from "./gate-rings.js";

/** Every (face key, Nexus) scope the face at `face` stands at here, sorted by Nexus. Reads only; mints no key. */
export async function standingFaceScopes(sealHome: string, face: number): Promise<FaceScope[]> {
  const aids = new Set<string>(readCarriedCharters(sealHome).keys());
  const primary = primaryNexusAid(sealHome);
  if (primary !== null) aids.add(primary);
  const scopes: FaceScope[] = [];
  for (const nexus of [...aids].sort()) {
    const seed = await readNexusKey(face, nexus);
    if (seed === null) continue;
    try { scopes.push({ faceKey: nexusKeyPublicOf(seed), nexus } as FaceScope); } finally { seed.fill(0); }
  }
  return scopes;
}

/** The faces among `faces` whose root this vessel holds, each with the scopes it stands at. A face whose root
 *  reads absent holds nothing here. */
export async function heldRootHoldings(args: {
  readonly sealHome: string;
  readonly faces:    readonly { readonly face: number; readonly personaGroup: string }[];
}): Promise<GateRootHolding[]> {
  const out: GateRootHolding[] = [];
  for (const { face, personaGroup } of args.faces) {
    const rootKey = (await loadPersonaGroupRootVerifyingKey(face))?.toLowerCase().replace(/^0x/, "");
    if (!rootKey) continue;
    out.push({ personaGroup, rootKey, scopes: await standingFaceScopes(args.sealHome, face) });
  }
  return out;
}
