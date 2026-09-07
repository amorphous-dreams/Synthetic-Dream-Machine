/**
 * creator-self-eviction — THE PROBE THAT SCOPES G1 (the veil-born-group arc).
 *
 * The question, exactly: after a vessel-keyed creator seats a veil-keyed agent on its sentinel, can
 * the creator step OFF its own CGKA roster (`revokeSentinelMember` on itself, retain-others)? YES →
 * the veil-born group shrinks to a ceremony epilogue (create · seat the veil · self-evict). NO → the
 * group must be BORN under a veil-keyed provider: the two-identity boot, ceremony + bootDaemonKeyhive
 * + daemon behavior moving together.
 *
 * A probe measures; it does not wish. Whatever this reads, G1 gets its true size.
 */
import { describe, test, expect } from "vitest";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";
import { writeFileSync } from "node:fs";

async function vessel(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  return p;
}

describe("the creator asks to leave its own roster", () => {
  test("★ PROBE: seat the veil, then self-evict — does the roster end veil-only? ★", async () => {
    const creator = await vessel(0x31);
    const creatorId = await creator.vesselIdentifierHex();
    const { docIdHex } = await creator.createSentinelDoc("lar:///probe.self.eviction/sentinel");

    const veil = await vessel(0x32);   // stands in for the veil-keyed agent; the mechanics are identical
    const { id: veilId } = await creator.receiveContactCard(await veil.contactCard());
    await creator.addSentinelMember(veilId, docIdHex);

    const before = await creator.sentinelCgkaMembers(docIdHex);
    expect(before).toContain(veilId);

    let evicted = false; let refusal = "";
    try {
      await creator.revokeSentinelMember(creatorId, docIdHex);
      evicted = true;
    } catch (e) { refusal = e instanceof Error ? e.message : String(e); }

    if (evicted) {
      const after = await creator.sentinelCgkaMembers(docIdHex);
      // The measurement, both halves: the creator gone, the veil standing.
      expect(after, "the veil keeps its seat").toContain(veilId);
      expect(after, "the creator stepped off").not.toContain(creatorId);
      writeFileSync("/tmp/self-eviction-probe.json", JSON.stringify({ verdict: "WORKS", roster: after }));
    } else {
      writeFileSync("/tmp/self-eviction-probe.json", JSON.stringify({ verdict: "REFUSED", refusal }));
      // The refusal is itself the measurement; the probe passes by MEASURING, not by wishing.
      expect(refusal.length).toBeGreaterThan(0);
    }
  });
});
