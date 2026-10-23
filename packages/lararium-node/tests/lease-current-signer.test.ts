/**
 * lease-current-signer — one predicate answers "may this key sign a lease now": the KEL's CURRENT roster (`currentSignerOf`).
 * Reds: a key the KEL rotated past raises no lease at the roll writer (and cannot launder a forged high slot into a current
 * signer's effective+1); every lease consumer asks the one door and none flattens the lineage to "any epoch". Control: an honest
 * current-epoch advance still lands and rolls.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { describe, expect, test } from "vitest";
import {
  currentSignerOf, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, emptyLarDoc, leaseEpochSlotUri,
  makeHandLineage, personaLineageFromKel, signLeaseAdvance, storedLarRecord, type LarDoc,
} from "@lararium/mesh";
import { realKel } from "../../lararium-mesh/tests/kel-fixture.js";
import { rollSignedLeaseEpochOnBoard } from "../src/lease-rekey.js";

const mk = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const GROUP = "g1";

describe("the one current-signer predicate", () => {
  test("RED: the lineage's earlier epochs are not current; CONTROL: its newest roster is", async () => {
    const oldK = await mk(1), newK = await mk(2);
    const lineage = makeHandLineage([{ epoch: 0, signers: [oldK.key], threshold: 1 }, { epoch: 1, signers: [newK.key], threshold: 1 }])!;
    expect(currentSignerOf(lineage)(oldK.key)).toBe(false);
    expect(currentSignerOf(lineage)(newK.key)).toBe(true);
    expect(currentSignerOf(null)(newK.key), "no lineage reads no signer").toBe(false);
  });

  test("RED (laundering): a current signer reads a forged high slot from a retired key and does NOT sign effective+1 of it; CONTROL: an honest current advance rolls", async () => {
    const oldK = await mk(1), newK = await mk(2);
    const kel = (await realKel([oldK.key, newK.key])).chain;
    const seated = currentSignerOf(personaLineageFromKel(kel));
    const repo = new Repo({});
    const handle = repo.create<LarDoc>(emptyLarDoc() as LarDoc);
    const retiredSlot = leaseEpochSlotUri(GROUP, oldK.key);
    handle.change((doc) => { doc.tiddlers[retiredSlot] = storedLarRecord(retiredSlot, { text: "" }, "test"); });
    const forged = await signLeaseAdvance({ resource: GROUP, epoch: 900 }, oldK);
    handle.change((doc) => { doc.tiddlers[retiredSlot] = storedLarRecord(retiredSlot, { text: forged }, "test"); });
    const first = await rollSignedLeaseEpochOnBoard(handle, GROUP, newK, seated);
    expect(first.effective, "the retired key's 900 is not read").toBe(0);
    expect(first.rolled).toBe(1);
    const second = await rollSignedLeaseEpochOnBoard(handle, GROUP, newK, seated);
    expect(second.effective, "the honest current advance lands").toBe(1);
    await expect(rollSignedLeaseEpochOnBoard(handle, GROUP, oldK, seated)).rejects.toThrow(/no PersonaGroup KEL seat/);
  });

  test("RED: every lease consumer asks the one door and none flattens the lineage to any epoch", () => {
    const root = join(import.meta.dirname, "..", "..");
    const sites = [
      "lararium-keyhive/src/operator-daemon-behavior.ts", "lararium-node/src/commands/device-admit.ts", "lararium-node/src/commands/persona-lease.ts",
      "lararium-node/src/open-node-vessel.ts", "lararium-browser/src/open-browser-vessel.ts", "lararium-node/src/lease-observation.ts",
    ];
    for (const rel of sites) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src, rel).toContain("currentSignerOf(");
      expect(src, `${rel} must not read any epoch of the lineage as a lease signer`).not.toMatch(/\.some\(\(epoch\) => epoch\.signers\.includes|flatMap\(\(e\) => e\.signers\)/);
    }
  });
});
