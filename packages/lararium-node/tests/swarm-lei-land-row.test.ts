/**
 * swarm-lei-land-row — the vessel's lei rows land a hand record (road 4b, backlog-awakens Wave 4b lane B).
 *
 * A `swarm-lei-kui` or `swarm-lei-unstring` row that carries `signed` (a record the hand signed at the pūlama's hand door) opens
 * no ward: the record's own signature stands in for the root, and the row lands it through the swarm door's `lei-land`. So the
 * CLI parks no route for it and asks none. Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { expect, test } from "vitest";
import { storeVerbNeedsWard } from "../src/ward-credential.js";
import { storeDoorReactors, type StoreDoorDeps } from "../src/store-door-verbs.js";

const SIGNED = { body: { act: "lei" }, signer: "a".repeat(64), sig: "s" };

test("RED: a kui or an unstring row carrying a hand record asks no ward route; CONTROL: the same rows with no record, and a restring, stay ward acts", () => {
  expect(storeVerbNeedsWard("swarm-lei-kui", { rite: "kukulu", branch: "main", signed: SIGNED })).toBe(false);
  expect(storeVerbNeedsWard("swarm-lei-unstring", { rite: "kukulu", branch: "main", signed: SIGNED })).toBe(false);
  expect(storeVerbNeedsWard("swarm-lei-kui", { rite: "kukulu", branch: "main", returns: 2, after: null })).toBe(true);
  expect(storeVerbNeedsWard("swarm-lei-unstring", { rite: "kukulu", branch: "main", lei: "c".repeat(64) })).toBe(true);
  // A restring the vessel would sign itself stays a ward act; a hand-signed restring lands by the kui row.
  expect(storeVerbNeedsWard("swarm-lei-restring", { rite: "kukulu", branch: "main", signed: SIGNED })).toBe(true);
  expect(storeVerbNeedsWard("swarm-cap-set", { value: 1, signed: SIGNED })).toBe(true);
});

test("CONTROL: with no standing daemon wiki a row carrying a hand record still refuses by name before it loads a face", async () => {
  const rows = storeDoorReactors({ storageDir: "/tmp/unused", sealHome: "/tmp/unused-seal", repo: {} as StoreDoorDeps["repo"] });
  const out = await rows["swarm-lei-kui"]({ signed: SIGNED }, { worn: { ordinal: 0 } } as never);
  expect(out["refused"]).toContain("no standing daemon: swarm controls need the founded wiki");
});
