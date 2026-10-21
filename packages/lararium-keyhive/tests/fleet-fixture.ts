/**
 * fleet-fixture — a fleet founded the way a founding founds it: the root's persona KEL, its lineage, and the signed
 * genesis frontier on the fleet board; raises register into the root's next frontier the way the edge command does.
 */
import type { DocHandle } from "@automerge/automerge-repo";
import {
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, guardianRecoveryRegistrationCard, landFleetFrontier, landFleetGenesis,
  nextFleetFrontier, personaLineageFromKel, provisionThresholdRecoveryAtFounding, type LarDoc,
} from "@lararium/mesh";

export async function fleetFixture(rootSeed: Uint8Array) {
  const root = await ed25519VerifyingKeyFromSeed(rootSeed);
  const keys = await Promise.all([1, 2, 3].map((n) => ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n))));
  const prov = provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid: `0x${root}`,
    guardians: keys.map((k, i) => guardianRecoveryRegistrationCard((["mine", "guardian-a", "guardian-b"] as const)[i]!, k, null)),
    recoveryThreshold: 2,
  });
  const chain = [prov.inception];
  const lineage = personaLineageFromKel(chain)!;
  const signer = { key: root, sign: ed25519SignerFromSeed(rootSeed) };
  return {
    root, chain, lineage, prefix: prov.inception.prefix,
    /** Found the fleet: land the signed empty genesis. */
    found: async (board: DocHandle<LarDoc>): Promise<void> => {
      const draft = { tiddlers: {} } as unknown as LarDoc;
      await landFleetGenesis(draft, root, lineage, signer);
      board.change((d) => { Object.assign(d.tiddlers, draft.tiddlers); });
    },
    /** Register raises into the root's next frontier, counting every raise given. */
    register: async (board: DocHandle<LarDoc>, counted: readonly string[]): Promise<void> => {
      const next = await nextFleetFrontier({ fleetRoot: root, board: board.doc(), lineage, counted, signer });
      if (!next) throw new Error("fleet-fixture: no verified head to extend");
      const draft = { tiddlers: {} } as unknown as LarDoc;
      landFleetFrontier(draft, next);
      board.change((d) => { Object.assign(d.tiddlers, draft.tiddlers); });
    },
  };
}
