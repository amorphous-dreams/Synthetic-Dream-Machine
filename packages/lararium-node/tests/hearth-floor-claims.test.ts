/**
 * hearth-floor-claims — a hearth's floor pin claims, signed through the node's own place KEL (W14).
 *
 *   H1  CONTROL: a founded place claims its flow pin at the inception head; a reader anchored to its AID files the claim, and the
 *       card the banner prints verifies against that anchor and against no other.
 *   H2  POSITIVE: after a read-back rotation the NEXT claim names the new head and the new signer, replaces the older one in a
 *       reader's index with no restart, and the older claim then refuses as a rollback; the old signer's claim at the new head
 *       does not exist (the node signs with the key the KEL seats now).
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, fileHearthFloorCard, hearthFloorCardText, hearthPinIndex, readHearthFloorCard,
  verifyHearthFloorCard, verifyPlaceKel, hex, type RandomProvider,
} from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { foundDirect } from "./found-route.js";
import { loadPlaceAid, loadVesselVerifyingKey, rotatePlace } from "../src/node-vessel-identity.js";
import { hearthFloorProof } from "../src/hearth-floor-claims.js";

vi.setConfig({ testTimeout: 240_000 });
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
function root() {
  const r = mkdtempSync(join(tmpdir(), "lar-hearth-claims-"));
  cpSync(join(import.meta.dirname, "../../../genesis"), join(r, "genesis"), { recursive: true, filter: (s) => !s.endsWith("social-bootstrap.json") });
  roots.push(r); return r;
}
function entropy(start: number): RandomProvider {
  let n = start;
  return { getRandomValues<T extends Uint8Array<ArrayBuffer>>(a: T): T { for (let i = 0; i < a.length; i++) a[i] = n++ & 255; return a; }, randomUUID: () => "deterministic" };
}
const at = (r: string) => ({ storageDir: join(r, "data", "lares", "vessel"), genesisDir: join(r, "genesis") });
const NEXUS = "nexus-hearth-claims.synthetic";
const flowPin = (fill: number) => {
  const b = deriveGateBundle(floorGateRoot(floorKeyDoor({ derive: () => new Uint8Array(32).fill(fill) })), new TextEncoder().encode(NEXUS), floorRoute("/flow"));
  try { return b.pin; } finally { b.drop(); }
};
const key = { hearth: "http://hearth:8080", nexus: hex(new TextEncoder().encode(NEXUS)), route: "/flow", tier: "floor" as const };

describe("a hearth claims its floor pin through its own place KEL", () => {
  test("H1 — a founded place's claim and card verify against its AID and against no other", async () => {
    const r = root(); let card = new Uint8Array();
    await withLarRoot(r, async () => {
      await foundDirect({ ...at(r), entropy: entropy(1), placeFoundingCard: { readBack: async (c) => { card = new Uint8Array(c.seed); } } });
      const aid = await loadPlaceAid();
      const proof = await hearthFloorProof([flowPin(11)]);
      expect(proof).not.toBeNull();
      const text = hearthFloorCardText({ claim: proof!.claims[0]!, kel: [...proof!.kel] });
      const read = readHearthFloorCard(text)!;
      expect(verifyHearthFloorCard(read, { aid, via: "genesis" })).toHaveProperty("publisher", await loadVesselVerifyingKey());
      expect(verifyHearthFloorCard(read, { aid: "ab".repeat(32), via: "transfer" })).toEqual({ refusal: "place-unanchored" });
      expect(verifyHearthFloorCard(read, null)).toEqual({ refusal: "place-unanchored" });
      expect(card.length).toBe(32);
    });
  });

  test("H2 — after a rotation the next claim names the new head and replaces the older one live; the older refuses as a rollback", async () => {
    const r = root(); let card = new Uint8Array();
    await withLarRoot(r, async () => {
      await foundDirect({ ...at(r), entropy: entropy(1), placeFoundingCard: { readBack: async (c) => { card = new Uint8Array(c.seed); } } });
      const aid = await loadPlaceAid();
      const before = (await hearthFloorProof([flowPin(11)]))!;
      const oldKey = await loadVesselVerifyingKey();
      await rotatePlace({ card, entropy: entropy(90), placeFoundingCard: { readBack: async () => {} } });
      const after = (await hearthFloorProof([flowPin(12)]))!;
      const newKey = await loadVesselVerifyingKey();
      expect(newKey).not.toBe(oldKey);
      expect(after.claims[0]!.seq).toBe(1);
      expect((verifyPlaceKel(after.kel as never) as { signerKey: string }).signerKey).toBe(newKey);
      const index = hearthPinIndex();
      const anchor = { aid, via: "admit" as const };
      const card0 = { claim: before.claims[0]!, kel: [...before.kel.slice(0, 1)] }, card1 = { claim: after.claims[0]!, kel: [...after.kel] };
      expect(fileHearthFloorCard(index, key.hearth, card0, anchor)).toMatchObject({ filed: true, moved: "first", publisher: oldKey });
      expect(fileHearthFloorCard(index, key.hearth, card1, anchor)).toMatchObject({ filed: true, moved: "replaced", publisher: newKey });
      expect(index.get(key)).toEqual(flowPin(12));
      expect(fileHearthFloorCard(index, key.hearth, card0, anchor)).toMatchObject({ filed: false, refusal: "rollback" });
      expect(index.get(key)).toEqual(flowPin(12));
    });
  });
});
