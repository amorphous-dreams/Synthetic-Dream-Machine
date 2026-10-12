/**
 * g1-scope probes — three cheaper doors on the veil-born-group arc, opened with both outcomes
 * pre-named. A probe measures; a refusal is a finding equal to a pass. Doors run ISOLATED so one
 * crash cannot eat another's measurement; each writes its verdict to disk.
 *
 *   DOOR 1 — COPARENT AT BIRTH: `generateDocument(coparents: Identifier[], …)` — does seating the veil
 *            Individual as a CO-PARENT put it on the CGKA from birth, and does the creator ride too?
 *   DOOR 2 — READ GRADE: does an agent added at Access "read" appear in `cgkaMembers()` — is ANY
 *            access CGKA membership, or only admin?
 *   DOOR 3 — CARRIAGE: can a vessel-keyed provider INGEST a veil-born group's events and at least
 *            SEE the document without membership — the boot's minimum need?
 */
import { describe, test, expect } from "vitest";
import * as KH from "@keyhive/keyhive/slim";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";

async function vessel(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  return p;
}
const rawKh = (p: KeyhiveProvider): any => (p as unknown as { requireKh: () => unknown }).requireKh();
const hexOf = (b: Uint8Array): string => "0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
const bytesOf = (idHex: string): Uint8Array => Uint8Array.from(Buffer.from(idHex.replace(/^0x/, ""), "hex"));

describe("G1 scope probes", () => {
  test("DOOR 1 — the veil as CO-PARENT at birth", { timeout: 90_000 }, async () => {
    const creator = await vessel(0x41);
    const veil = await vessel(0x42);
    const { id: veilId } = await creator.receiveContactCard(await veil.contactCard());
    const creatorId = await creator.vesselIdentifierHex();
    const kh = rawKh(creator);
    // CONTROL: a document born with no co-parent seats its creator alone.
    const { docIdHex: aloneHex } = await creator.createSentinelDoc("lar:///probe.birth.alone");
    expect(await creator.sentinelCgkaMembers(aloneHex)).toEqual([creatorId]);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("lar:///probe.birth.coparent"));
    const docId = await kh.generateDocument([new KH.Identifier(bytesOf(veilId))], new KH.ChangeId(new Uint8Array(digest)), []);
    const members = await creator.sentinelCgkaMembers(hexOf(docId.toBytes()));
    // CANARY (measured: TRUE): a co-parent named at birth rides the CGKA from the first epoch, beside the
    // creator, with no later `addMember` and so no delegation event of its own. An upstream that seats a
    // co-parent off the tree, or drops the creator, moves what a veil-born group can promise at birth.
    expect(members.sort(), "the co-parent and the creator both ride the CGKA at birth").toEqual([veilId, creatorId].sort());
    expect((await creator.verifySentinelMembership(veilId, hexOf(docId.toBytes()))).ok).toBe(true);
  });

  test("DOOR 2 — read-grade access vs the CGKA enumeration", { timeout: 90_000 }, async () => {
    try {
      const creator = await vessel(0x43);
      const reader = await vessel(0x44);
      const { id: readerId } = await creator.receiveContactCard(await reader.contactCard());
      const { docIdHex } = await creator.createSentinelDoc("lar:///probe.read.grade");
      const kh = rawKh(creator);
      const doc = await kh.getDocument(new KH.DocumentId(bytesOf(docIdHex)));
      const agent = await kh.getAgent(new KH.Identifier(bytesOf(readerId)));
      if (!doc || !agent) throw new Error("read-grade fixture could not resolve its document and agent");
      const access = KH.Access.tryFromString("read");
      if (!access) throw new Error("Access 'read' is not a recognized grade");
      await kh.addMember(agent.id, KH.MemberedId.document(doc.docId), access, []);
      const members = await creator.sentinelCgkaMembers(docIdHex);
      // CANARY (measured 2026-09-08: TRUE): ANY access grade is CGKA membership — no sub-roster
      // grade exists. An upstream that splits reader-grades off the tree loosens the veil-born
      // "no direct grade for the vessel" constraint, and this alarm says so.
      expect(members, "a read-grade member rides the CGKA").toContain(readerId);
    } catch (e) { throw new Error(`door 2 no longer opens: ${String(e).slice(0, 200)}`); }
  });

  test("DOOR 3 — carriage without membership", { timeout: 90_000 }, async () => {
    try {
      const veilBorn = await vessel(0x45);
      const daemon = await vessel(0x46);
      const { docIdHex } = await veilBorn.createSentinelDoc("lar:///probe.carriage.only");
      const { id: daemonId } = await veilBorn.receiveContactCard(await daemon.contactCard());
      const events = await veilBorn.eventsForPeer(daemonId);
      await daemon.ingestPeerEvents(events);
      // CANARY (measured 2026-09-08: refuses): carriage alone materializes nothing — a boot must
      // STAND an identity, never merely replay its events. An upstream that materializes from bare
      // ingest shifts the two-identity boot's necessity, and this alarm says so.
      await expect(daemon.sentinelCgkaMembers(docIdHex)).rejects.toThrow();
      void events;
    } catch (e) { throw e; }
  });
});
