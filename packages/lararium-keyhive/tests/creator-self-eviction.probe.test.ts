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

    // CANARY (measured 2026-09-07: REFUSED, "Redelagation error"). The two-identity boot rests on
    // this refusal — an upstream keyhive that ever ALLOWS a creator to leave its roster re-scopes
    // the whole veil-born architecture, and this assertion is the alarm that says so.
    await expect(creator.revokeSentinelMember(creatorId, docIdHex)).rejects.toThrow();
    void veilId;
  });
});
