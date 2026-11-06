/**
 * ward-cosign-gate-node — row 7's S3b table under the node vessel's own port (`nodeWardCosignPort`): the loaded face's plane,
 * its signed admission roster and its fleet standing, over the kāpae lower, the house cap and the push go.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-swarm-slices
 */
import { faceIntentVerbs } from "@lararium/mesh";
import { nodeWardCosignPort } from "../src/commands/intent.js";
import { wardCosignTable } from "../../lararium-mesh/tests/ward-cosign-table.js";

wardCosignTable({
  name: "node", acts: ["lower", "cap", "go"],
  port: ({ group, atom, plane, devices, lineage, aside }) => nodeWardCosignPort({ flush: async () => undefined } as never, {
    group, plane, verbs: faceIntentVerbs(), signer: atom,
    projection: { devices, cids: ["admit"], admissions: devices.map((deviceKey) => ({ deviceKey, cid: "admit" })) },
    face: { lineage }, standing: (k: string) => (aside.has(k) ? "aside" : "stands"), heldFrontiers: () => new Set<string>(),
  } as never),
  root: async (key) => ({ key: key.key, signer: async () => key }),
});
