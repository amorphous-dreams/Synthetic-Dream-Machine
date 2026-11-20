/**
 * exec-lei-door — the node vessel's main-thread half of the exec-lei port (backlog-awakens "The executable-record lei").
 *
 * The daemon island routes `exec-lei-spend` to main; main spends one return of the standing exec lei under the vessel's own
 * signer, over the control document's swarm wiki and the mounted face's trust (`makeExecLeiSpendReactor`). The vessel registers
 * the reactor on its main registry beside the store's other rows. Every red pairs with a CONTROL.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, emptyLarDoc, execLeiBranch, swarmCommand, type LarDoc, type SwarmDoorDeps, type WardCosignPort } from "@lararium/mesh";
import { controlSwarmWiki } from "../src/swarm-wiki.js";
import { makeExecLeiSpendReactor } from "../src/exec-lei-door.js";

const GROUP = "face-group";
const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

test("RED: main spends the standing exec lei's return under the vessel's signer, and past its returns refuses by the lei's code; CONTROL: a lei for another wiki spends nothing here", async () => {
  const hand = await keyed(1), vessel = await keyed(2);
  const handle = new Repo().create<LarDoc>(emptyLarDoc());
  const wiki = controlSwarmWiki(async () => handle);
  const trust = { hand: (k: string) => k === hand.key, vessel: (k: string) => k === vessel.key, place: () => false, lead: () => false };
  const deps: SwarmDoorDeps = { group: GROUP, face: { grant: (k: string) => k === hand.key, group: GROUP }, signer: hand, trust, epoch: () => 1,
    board: { records: async () => [], land: async () => {} }, wiki, who: { kind: "hand", id: "operator" }, cosign: () => ({}) as WardCosignPort };
  await swarmCommand({ action: "lei-kui", rite: "exec", branch: execLeiBranch("garden"), after: null, reach: "wide", returns: 1, scope: { wiki: "garden", writer: "seat" } }, deps);
  const spend = makeExecLeiSpendReactor({ wiki, face: async () => ({ group: GROUP, trust, spender: vessel }) });
  const args = { wiki: "garden", title: "Boot", fields: { tags: "$:/tags/StartupAction" }, writer: "seat" };
  await expect(spend(args)).resolves.toMatchObject({ n: 1 });
  await expect(spend(args)).rejects.toThrow(/^swarm-lei-returns-spent: /);
  await expect(spend({ ...args, wiki: "works" })).rejects.toThrow(/^swarm-lei-absent: /);
});

test("RED: the vessel registers the spend on its main registry over the control document's swarm wiki; CONTROL: the residency row stands beside it", () => {
  const src = readFileSync(join(import.meta.dirname, "..", "src", "open-node-vessel.ts"), "utf8");
  expect(src).toMatch(/registry\.register\(EXEC_LEI_SPEND_VERB, makeExecLeiSpendReactor\(/);
  expect(src).toMatch(/registry\.register\("residency"/);
});
