/**
 * host-enumeration-surface — WHICH artifact does a colluding host actually enumerate?
 *
 * The veil-born-group brief assumed the CGKA roster (`cgkaMembers`) is the correlator a host reads.
 * This probe tests the assumption at the only honest grain: THE BYTES A PEER RECEIVES. A "host" is
 * whatever carries events — so the probe shares a group's events to a third peer and scans the raw
 * event bytes for the members' identifier hex. Both outcomes pre-named:
 *   · identifiers IN CLEARTEXT → the EVENT LOG is the enumeration surface (wider than the roster),
 *     and the veil must govern every identifier that ever enters a group's log — which the veil-born
 *     design already does, since a veil-born group's log carries only veil ids;
 *   · identifiers ABSENT → the CGKA-roster reading stood, and the log leaks structure only.
 */
import { describe, test, expect } from "vitest";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";

async function vessel(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  return p;
}
const strip = (id: string): string => id.replace(/^0x/, "").toLowerCase();

// MEASURED 2026-09-08: memberIdInCleartext FALSE · creatorIdInCleartext TRUE · groupDocId FALSE
// (7 events, 983 bytes). THE CREATOR'S IDENTIFIER RIDES EVERY CARRIED EVENT IN CLEARTEXT — the
// byte-level cross-group correlator is the EVENT LOG a host holds, not the CGKA roster a member
// reads. The veil-born design covers the true surface exactly: the veil becomes the creator, and a
// per-group veil in cleartext correlates nothing. (Nuance kept: the admitted member's id stayed out
// of THIS bystander stream — group-scoped ops may only ship to group peers; the creator leaked
// through what ships to ANYONE.)
describe("what a carrier can read", () => {
  test("★ THE BYTES ANSWER — do peer-shared events carry member identifiers in cleartext? ★", { timeout: 90_000 }, async () => {
    const creator = await vessel(0x51);
    const member  = await vessel(0x52);
    const host    = await vessel(0x53);

    const creatorId = strip(await creator.vesselIdentifierHex());
    const { id: memberIdRaw } = await creator.receiveContactCard(await member.contactCard());
    const memberId = strip(memberIdRaw);
    const { docIdHex } = await creator.createSentinelDoc("lar:///probe.host.reads");
    await creator.addSentinelMember(memberIdRaw, docIdHex);

    const { id: hostIdRaw } = await creator.receiveContactCard(await host.contactCard());
    const events = await creator.eventsForPeer(hostIdRaw);

    // The whole event stream as one hex string — what a byte-level reader (a host, a subpoena, a
    // disk image) can grep with no keys at all.
    const streamHex = events.map((e) => Array.from(e).map((b) => b.toString(16).padStart(2, "0")).join("")).join("|");

    // CANARY (measured 2026-09-08): the CREATOR's id rides carried events in cleartext — the leak
    // the veil-born design covers (a per-group veil in cleartext correlates nothing). An upstream
    // that ciphers the creator out of the log shifts the design's cost, and this alarm says so.
    // The admitted member's id stays out of a bystander stream (also pinned).
    expect(events.length).toBeGreaterThan(0);
    expect(streamHex.includes(creatorId), "the creator still spells in carried events (upstream)").toBe(true);
    expect(streamHex.includes(memberId), "a member's id stays out of a bystander stream").toBe(false);
    void docIdHex;
  });
});
