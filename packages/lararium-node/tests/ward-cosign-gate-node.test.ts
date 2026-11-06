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
  port: ({ group, atom, plane, devices, lineage, aside, unknown, frontier, wardKeys }) => nodeWardCosignPort({ flush: async () => undefined } as never, {
    group, plane, verbs: faceIntentVerbs(), signer: atom,
    projection: { devices, cids: ["admit"], get admissions() { return devices.map((deviceKey) => ({ deviceKey, cid: "admit" })); },
      get wardKeys() { return Object.fromEntries(devices.map((d) => [d.toLowerCase(), wardKeys.get(d)!])); } },
    face: { lineage }, standing: (k: string) => (aside.has(k) ? "aside" : unknown.has(k) ? "unknown" : "stands"), heldFrontiers: () => new Set<string>(),
    frontier: () => (frontier.known ? frontier.head : null), stoodAt: (k: string, at: string) => frontier.counted.get(at)?.has(k) === false,
  } as never),
  root: async (key) => ({ key: key.key, signer: async () => key }),
});
