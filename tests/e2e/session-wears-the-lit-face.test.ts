/**
 * e2e/session-wears-the-lit-face — the operator's CLI session over the 0600 rendezvous wears the face the island
 * mounts, and nothing else.
 *
 * The CLI names the PLACE as `requestedBy` (it holds no atom: the atom's seed rests sealed under the vessel key). A
 * founded hearth mints every bag on its face, so a verb that presents as the place reaches nothing the face owns.
 * Authority on the presence channel therefore comes from the CHANNEL: with a face lit, a local verb that names the
 * place presents as the mounted face's atom. The claim never decides:
 *
 *   S1 RED  the place's own CLI reads its face's wiki (cap-denied on the cut's parent)
 *   S2      CONTROL: a claim naming a stranger's DID stays that stranger, and the verifier refuses it
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { targetInstance, awaitRendezvous, vesselStorageDir, type LarInstance } from "../harness/instance.js";
import { invokeLocal } from "../../packages/lares-cli/src/local-connector.js";

const URI = "lar:///ha.ka.ba/t/session/absent";
let lar: LarInstance;

beforeAll(async () => {
  lar = await targetInstance();
  if (!(await awaitRendezvous(lar))) throw new Error(`the staged daemon bound no rendezvous:\n${lar.bootLog().slice(-800)}`);
}, 150_000);
afterAll(async () => { await lar?.stop(); });

describe("e2e/session-wears-the-lit-face", () => {
  test("S1 RED: the CLI, naming the place, reads its lit face's wiki as the face", async () => {
    const got = await lar.cli(["meme", "get", URI, "--recipe", "lares", "--json"]);
    expect(JSON.stringify(got.json), "the wiki answers not-found, never cap-denied").toContain("not-found");
    expect(JSON.stringify(got.json)).not.toContain("cap-denied");
  });

  test("S2 CONTROL: a claim naming a stranger's DID presents as that stranger and is refused", async () => {
    const stranger = `0x${"11".repeat(32)}`;
    const r = await invokeLocal("meme-get", { uri: URI, recipe: "lares" }, stranger,
      { dataDir: vesselStorageDir(lar), timeoutMs: 60_000 }).catch((e: unknown) => ({ thrown: String(e) }));
    expect(JSON.stringify(r)).toContain("cap-denied");
  }, 90_000);
});
