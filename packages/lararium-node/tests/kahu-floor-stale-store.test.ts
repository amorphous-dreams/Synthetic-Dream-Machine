/**
 * kahu-floor-stale-store — T22's floor-on-a-stale-store clause, MEASURED (test-recut-road, wave 0).
 *
 * The clause: a floor booting on a store an earlier sovereign run left reads the old Kahu documents unclassed, so the share
 * verdict, with empty protected ids, hands a dialed peer the Kahu canon. Measured here at the holder the composer stands in
 * `systemCanon`, over a seal home that holds a charter, with no custody seated (the floor):
 *   · the derivation under persona zero's keys cannot read at a locked floor, the recount names that failure, and the
 *     holder reads INCOMPLETE, so the guard (wired as the composer wires it) withholds every document from every wire peer;
 *   · CONTROL: a seal home with no charter runs no derivation, reads whole, and withholds nothing it never classed.
 * Both stood GREEN on the span: the clause found no hole, and this file pins the closed state it measured. Under the suite
 * harness the key read refuses as `ScratchCustodyRefused`; a locked vessel refuses `CustodyLocked` (`face-key-custody.ts`,
 * `readNexusKey`). Either throw reaches the one catch that names the failure, so the measure reads the same path.
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { hex, protectedDocGuard } from "@lararium/mesh";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { kahuProtectedHolder } from "../src/kahu-realm.js";
import { writeNexusDoc } from "../src/nexus-doc.js";

const roots: string[] = [];
afterAll(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });
const scratch = (): string => { const r = mkdtempSync(join(tmpdir(), "lar-kahu-floor-")); roots.push(r); return r; };

const KAHU_CANON_ID = "4NMNnkMhL8jXrdJ9jamS58PAVdXu";   // any id: an incomplete count withholds every document

const guardOver = (holder: ReturnType<typeof kahuProtectedHolder>) => protectedDocGuard({
  ids: () => holder.ids(),
  settled: () => holder.settled(),
  pending: () => holder.pending(),
  incomplete: () => holder.incomplete(),
  decide: { "kahu-canon": () => false, "vessel-private": () => false },
} as Parameters<typeof protectedDocGuard>[0]);

describe("T22 measure: a floor on a store a sovereign run left", () => {
  test("a charter at the seal home and no custody seated: the count reads incomplete and the canon withholds from a dialed peer", async () => {
    const sealHome = scratch();
    const keys = await Promise.all([71, 72].map((b) => ed.getPublicKeyAsync(new Uint8Array(32).fill(b)).then(hex)));
    writeNexusDoc(sealHome, heldCharter({ keys, threshold: 2 }).doc());
    const holder = kahuProtectedHolder({ sealHome, canon: () => ({}) });
    const said = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await holder.recount();
      expect(holder.incomplete(), "the locked derivation names its failure").toBe(true);
      // The one failure the count names is the key read under persona zero, no other throw (the cold read's SHOULD 1).
      const lines = said.mock.calls.map((c) => c.map(String).join(" "));
      expect(lines.some((l) => /\(1 read failure\(s\): persona zero's keys at /.test(l)), lines.join("\n")).toBe(true);
      expect(await guardOver(holder).withholds("dialed-hearth", KAHU_CANON_ID)).toBe(true);
    } finally { said.mockRestore(); holder.close(); }
  });

  test("CONTROL: a seal home with no charter reads whole and withholds an unclassed document from nobody", async () => {
    const holder = kahuProtectedHolder({ sealHome: scratch(), canon: () => ({}) });
    try {
      await holder.recount();
      expect(holder.incomplete()).toBe(false);
      expect(await guardOver(holder).withholds("dialed-hearth", KAHU_CANON_ID)).toBe(false);
    } finally { holder.close(); }
  });
});
