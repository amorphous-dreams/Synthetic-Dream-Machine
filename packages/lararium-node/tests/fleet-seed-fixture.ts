/**
 * fleet-seed-fixture — stand a fleet the way a founding stands it, in the current store: the root's persona KEL on the
 * island board, the anchors that name its prefix and device edge, and the signed empty genesis frontier on the fleet's
 * board. A suite whose subject raises, folds or widens on a fleet board calls this after its custody, root and atom
 * stand; a fleet without it reads `unknown` by law.
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  buildDeviceDelegation, guardianRecoveryRegistrationCard, landFleetGenesis, fleetEdgeBoardDocUrl, materializeSharedLarDoc,
  mintFaceAnchor, personaKelBoardDocUrl, personaLineageFromKel, provisionThresholdRecoveryAtFounding, writePersonaKelEvent,
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, type HandLineage, type LarDoc,
} from "@lararium/mesh";
import { loadPersonaGroupRootSeed, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { loadIdentityAnchors, persistIdentityAnchors } from "../src/identity-anchors.js";
import { keepFaceAnchorOfGroup } from "../src/face-anchor-store.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { larDataDir } from "../src/vessel-paths.js";
import { restingRepo } from "./resting-repo.js";
import { atomSeedOf } from "./atom-fixture.js";

export async function seedFleet(handleIndex = 0, opts: { genesis?: boolean; repo?: Repo } = {}): Promise<{ root: string; lineage: HandLineage; prefix: string }> {
  const rootSeed = await loadPersonaGroupRootSeed(handleIndex);
  const root = await ed25519VerifyingKeyFromSeed(rootSeed);
  const guardianKeys = await Promise.all([1, 2, 3].map((n) => ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n))));
  const prov = provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid: `0x${root}`,
    guardians: guardianKeys.map((k, i) => guardianRecoveryRegistrationCard((["mine", "guardian-a", "guardian-b"] as const)[i]!, k, null)),
    recoveryThreshold: 2,
  });
  const lineage = personaLineageFromKel([prov.inception])!;
  const island = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey() });
  const prior = await loadIdentityAnchors(handleIndex);
  if (!prior) throw new Error("seedFleet: stand the face's atom and anchors first (seedFaceAtom)");
  const deviceEdge = await buildDeviceDelegation({ personaRootSeed: rootSeed, atomSeed: await atomSeedOf(handleIndex),
    hearthTrueName: "fixture-hearth", boundEpoch: 0 });
  await persistIdentityAnchors({ ...prior, signerDid: deviceEdge.personaRootDid, personaKelPrefix: prov.inception.prefix, deviceEdge }, handleIndex);
  await keepFaceAnchorOfGroup(mintFaceAnchor({ personaGroup: prior.personaGroupId, personaKelPrefix: prov.inception.prefix,
    personaRootDid: deviceEdge.personaRootDid, edge: deviceEdge, leaseEpoch: 0 }));
  const repo = opts.repo ?? restingRepo(larDataDir());
  try {
    const kelBoard = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(island), "board:persona-kel");
    kelBoard.change((d) => writePersonaKelEvent(d, prov.inception));
    if (opts.genesis !== false) {
      const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(root), "board:edge-kapae");
      const draft = { tiddlers: {} } as unknown as LarDoc;
      await landFleetGenesis(draft, root, lineage, { key: root, sign: ed25519SignerFromSeed(rootSeed) });
      board.change((d) => { Object.assign(d.tiddlers, draft.tiddlers); });
    }
    await repo.flush();
  } finally { if (!opts.repo) await (repo as ReturnType<typeof restingRepo>).rest(); }
  return { root, lineage, prefix: prov.inception.prefix };
}
