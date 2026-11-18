/**
 * The admit's pin names the Nexus a sovereign gate ACTUALLY STANDS AT. The vessel stands its own sync gate at the AID of
 * the charter it keeps (`ownNexusAid`, the primary charter's genesis), whatever its island standing resolves to (an
 * explicit scope, an anchor's gate key, its own key). So the pin a fleet-join answer carries derives there too: a pin
 * derived at an `anchor` or `explicit` scope would name a Nexus no gate stands at, and the joinee would dial silence
 * forever.
 *
 *   P1  RED: the stood pin derives at the primary charter's AID — the pin the vessel's own sync gate answers under
 *   P2  RED: a vessel that keeps no charter stands no sovereign gate, and the stood pin refuses by name
 *   P3  RED: device-admit pins the stood Nexus, never the island standing's scope; and the true name device-admit binds
 *       the edge to (`hearthAid()`) IS the Nexus that pin names, so the edge and the pin name one hearth
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  custodyRootDoor, deriveGateBundle, hex, nexusAidOf, sovereignGateRoot, sovereignRoute, SOVEREIGN_SYNC_ROUTE,
} from "@lararium/mesh";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { NoStoodNexus, stoodSovereignPin } from "../src/hearth-sovereign-pin.js";
import { hearthAid } from "../src/hearth-aid.js";
import { larSealHome } from "../src/vessel-paths.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";

const door = () => custodyRootDoor({ derive: () => new Uint8Array(32).fill(9) });
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const home = (): string => { const d = mkdtempSync(join(tmpdir(), "lares-stood-pin-")); dirs.push(d); return d; };

describe("the admit pins the Nexus a sovereign gate stands at", () => {
  test("P1 RED: the stood pin is the pin the vessel's own sync gate answers under", async () => {
    const sealHome = home();
    const keys = await Promise.all([1, 2, 3].map((n) => ed.getPublicKeyAsync(new Uint8Array(32).fill(n)).then(hex)));
    const doc = heldCharter({ keys, threshold: 2 }).doc({ labels: keys.map((_, i) => `Kahu ${i}`) });
    writeNexusDoc(sealHome, doc);
    const aid = nexusAidOf(doc)!;
    const pin = stoodSovereignPin(sealHome, door());
    // The vessel's sync gate: `deriveGateBundle(sovereignGateRoot(door), ownNexusAid, sovereignRoute("/ws"))`.
    const gate = deriveGateBundle(sovereignGateRoot(door()), new TextEncoder().encode(aid), sovereignRoute(SOVEREIGN_SYNC_ROUTE));
    try { expect(pin).toEqual(gate.pin); } finally { gate.drop(); }
    expect(pin.nexus).toBe(hex(new TextEncoder().encode(aid)));
  });

  test("P2 RED: no charter kept, no sovereign gate stands: the stood pin refuses by name", () => {
    expect(() => stoodSovereignPin(home(), door())).toThrow(NoStoodNexus);
  });

  test("P3 RED: device-admit pins the stood Nexus, never the island standing's scope", () => {
    const src = readFileSync(new URL("../src/commands/device-admit.ts", import.meta.url), "utf8");
    expect(src).toMatch(/gatePin:\s*stoodSovereignPin\(/);
    expect(src).not.toMatch(/hearthSovereignPin\(founderIdentity\.scope/);
    expect(src).toMatch(/hearthTrueName = hearthAid\(\)/);
  });

  test("P3 RED: the edge's true name (hearthAid) is the Nexus the stood pin names", async () => {
    const keys = await Promise.all([4, 5, 6].map((n) => ed.getPublicKeyAsync(new Uint8Array(32).fill(n)).then(hex)));
    const doc = heldCharter({ keys, threshold: 2 }).doc({ labels: keys.map((_, i) => `Kahu ${i}`) });
    await withLarRoot(home(), async () => {
      writeNexusDoc(larSealHome(), doc);
      const name = hearthAid();
      expect(name).toBe(nexusAidOf(doc));
      expect(stoodSovereignPin(larSealHome(), door()).nexus).toBe(hex(new TextEncoder().encode(name!)));
    });
  });
});
