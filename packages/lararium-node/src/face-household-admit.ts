/**
 * face-household-admit — the root holder's face, admitted at its own household Nexus, so a fleet-join answer can carry it.
 *
 * A joinee dials its hearth's sovereign gate with the face's ADMIT at the hearth's Nexus beside its own certificate: the
 * gate sorts same-operator only on an admit read held and a grant for that very face. The face holds no such admit until
 * one is minted, and nothing else mints one at a founder's own household. So the root holder makes sure of it when it
 * answers a join:
 *
 *   · THE LEAF. The face's per-Nexus key at the household Nexus (the primary charter's AID) is minted where none stands
 *     (`mintNexusLeaf`). The offer makes sure of it, so the scope rides the offer and the joinee asks a certificate there.
 *   · THE ADMIT. The face's leaf is admitted at the household Nexus through the SAME checked door `lares nexus contract`
 *     uses (`runNexusContract`): the held seats sign, the leaf self-signs its carriage consent, the act must COUNT before
 *     the board takes it, and its carriage commits to this hearth's STOOD sovereign pin. The founder holds that Nexus's
 *     root, so no CLI step stands between.
 *   · ONCE. The bundle is kept at `<sealHome>/nexus/face-admit/<aid>/<nym>.json`, and every later answer reuses it while it
 *     still reads held at the charter and still commits to the pin the gate stands under. A kept bundle that fails either
 *     is minted again.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-gate-exchange · lar:///ha.ka.ba/lararium/mesh/membership-doctrine
 *
 * Meme: lar:///ha.ka.ba/lararium/node/face-household-admit
 */
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Repo } from "@automerge/automerge-repo";
import {
  gateBundleDigest, heldNexusRoot, makeMultiSigQuorumVerifier, verifySignedAdmitBundle, type CustodyRootDoor,
} from "@lararium/mesh";
import { admitBundlePathFor, isAdmitBundle, type AdmitBundle } from "./admit-bundle.js";
import { primaryNexusAid } from "./carried-set.js";
import { runNexusContract } from "./commands/nexus-contract.js";
import { atomicWriteFileSync } from "./fs-atomic.js";
import { hearthSovereignPin } from "./hearth-sovereign-pin.js";
import { mintNexusLeaf, type NexusLeaf } from "./nexus-leaf.js";
import { readNexusDoc } from "./nexus-doc.js";

/** No household admit stands, and none can be minted, for the reason the message names. */
export class FaceHouseholdAdmitRefused extends Error {
  override readonly name = "FaceHouseholdAdmitRefused";
  constructor(readonly refusal: "no-household-nexus" | "admit-unminted", detail: string) {
    super(`[face household admit] ${refusal}: ${detail}`);
  }
}

/** The household Nexus: the primary charter's AID, where this vessel's sovereign gate stands. */
function householdAid(sealHome: string): string {
  const aid = primaryNexusAid(sealHome);
  if (aid === null) throw new FaceHouseholdAdmitRefused("no-household-nexus", "this vessel keeps no charter, so its face has no household Nexus to be admitted at; found the hearth first.");
  return aid;
}

/** Where the root holder keeps face `nym`'s admit at `aid`. */
export function faceHouseholdAdmitPath(sealHome: string, aid: string, nym: string): string {
  if (!/^[0-9a-f]{64}$/.test(nym)) throw new FaceHouseholdAdmitRefused("admit-unminted", "the face's leaf reads as no key.");
  return join(dirname(admitBundlePathFor(sealHome, aid)), "..", "face-admit", aid, `${nym}.json`);
}

/** The face's leaf at its household Nexus, minted where none stands. The caller zero-fills its seed. */
export async function ensureFaceHouseholdLeaf(sealHome: string, face: number): Promise<NexusLeaf> {
  return mintNexusLeaf(face, householdAid(sealHome));
}

/** A kept bundle that still reads held at the household charter and still commits to the pin the gate stands under. */
async function stillStands(bundle: AdmitBundle, sealHome: string, aid: string, pinDigest: string): Promise<boolean> {
  if (!bundle.opening || gateBundleDigest(bundle.opening.carriage.gatePin) !== pinDigest) return false;
  const root = heldNexusRoot({ nexus: aid, charter: readNexusDoc(sealHome), denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() });
  if ("absent" in root) return false;
  return "carriage" in (await verifySignedAdmitBundle(bundle, root));
}

/**
 * The face's admit at its household Nexus, with its opening: the kept one where it still stands, else one minted now
 * through the checked contract door and kept.
 */
export async function ensureFaceHouseholdAdmit(opts: {
  readonly repo:      Repo;
  readonly catalogUrl?: string | undefined;
  readonly sealHome:  string;
  readonly face:      number;
  readonly syncUrl?:  string;
  readonly gateDoor?: CustodyRootDoor;
}): Promise<AdmitBundle & { readonly opening: NonNullable<AdmitBundle["opening"]> }> {
  const aid = householdAid(opts.sealHome);
  const leaf = await ensureFaceHouseholdLeaf(opts.sealHome, opts.face);
  const nym = leaf.verifyingKey;
  leaf.seed.fill(0);
  const pinDigest = gateBundleDigest(hearthSovereignPin(aid, opts.gateDoor));
  const path = faceHouseholdAdmitPath(opts.sealHome, aid, nym);
  let kept: unknown = null;
  try { kept = JSON.parse(readFileSync(path, "utf8")); } catch { kept = null; }
  if (isAdmitBundle(kept) && kept.aid === aid && kept.admit.nym.toLowerCase() === nym && kept.opening && await stillStands(kept, opts.sealHome, aid, pinDigest)) {
    return kept as AdmitBundle & { readonly opening: NonNullable<AdmitBundle["opening"]> };
  }
  const result = await runNexusContract({
    action: "admit", nym, sealHome: opts.sealHome, repo: opts.repo, catalogUrl: opts.catalogUrl,
    ...(opts.gateDoor ? { gateDoor: opts.gateDoor } : {}), ...(opts.syncUrl ? { syncUrl: opts.syncUrl } : {}),
  });
  const bundle = result.bundle;
  if (bundle === null || !bundle.opening || gateBundleDigest(bundle.opening.carriage.gatePin) !== pinDigest) {
    throw new FaceHouseholdAdmitRefused("admit-unminted", "the contract door signed the face's admit, yet its board presents no admit committed to this hearth's pin.");
  }
  mkdirSync(dirname(path), { recursive: true });
  atomicWriteFileSync(path, JSON.stringify(bundle, null, 2));
  return bundle as AdmitBundle & { readonly opening: NonNullable<AdmitBundle["opening"]> };
}
