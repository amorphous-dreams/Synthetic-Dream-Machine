/**
 * g1-scope probes — three cheaper doors on the veil-born-group arc, opened with both outcomes
 * pre-named. A probe measures; a refusal is a finding equal to a pass. Doors run ISOLATED so one
 * crash cannot eat another's measurement; each writes its verdict to disk.
 *
 *   DOOR 1 — COPARENT AT BIRTH: `generateDocument(coparents: Peer[], …)` — does seating the veil
 *            Individual as a CO-PARENT put it on the CGKA from birth, and does the creator ride too?
 *   DOOR 2 — READ GRADE: does an agent added at Access "read" appear in `cgkaMembers()` — is ANY
 *            access CGKA membership, or only admin?
 *   DOOR 3 — CARRIAGE: can a vessel-keyed provider INGEST a veil-born group's events and at least
 *            SEE the document without membership — the boot's minimum need?
 */
import { describe, test, expect } from "vitest";
import { writeFileSync } from "node:fs";
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
const verdict = (door: string, v: unknown): void =>
  writeFileSync(`/tmp/g1-probe-${door}.json`, JSON.stringify(v, null, 2));

describe("G1 scope probes", () => {
  // MEASURED 2026-09-07 — UNMEASURABLE AT THIS SURFACE: passing a `toPeer()` handle back into
  // `generateDocument(coparents, …)` throws an UNHANDLED wasm marshaling error
  // ("arg0.__wasm_refgen_toJsPeer is not a function") from inside the binding — the exception fires
  // async, outside any catch, so the door cannot even record its own refusal from JS. The
  // coparent-at-birth question moves to the G1 arc's design (a provider-level door, or an upstream
  // binding fix — the donation ledger carries it beside alpha.8's "Redelagation" spelling).
  test.skip("DOOR 1 — the veil as CO-PARENT at birth", { timeout: 90_000 }, async () => {
    try {
      const creator = await vessel(0x41);
      const veil = await vessel(0x42);
      const { id: veilId } = await creator.receiveContactCard(await veil.contactCard());
      const kh = rawKh(creator);
      const veilIndividual = await kh.getIndividual(new KH.IndividualId(new KH.Identifier(bytesOf(veilId))));
      if (!veilIndividual) throw new Error("veil Individual unreachable after contact-card receive");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("lar:///probe.birth.coparent"));
      const gen = kh.generateDocument([veilIndividual.toPeer()], new KH.ChangeId(new Uint8Array(digest)), []);
      const doc = await Promise.race([
        gen,
        new Promise((_r, rej) => setTimeout(() => rej(new Error("HUNG — generateDocument with a coparent never resolved (60s)")), 60_000)),
      ]) as { doc_id: { toBytes(): Uint8Array } };
      const docIdHex = hexOf(doc.doc_id.toBytes());
      const members = await creator.sentinelCgkaMembers(docIdHex);
      const creatorId = await creator.vesselIdentifierHex();
      verdict("door1", {
        verdict: "OPENED",
        veilOnCgkaAtBirth: members.includes(veilId),
        creatorOnCgka: members.includes(creatorId),
        rosterSize: members.length,
      });
    } catch (e) { verdict("door1", { verdict: "REFUSED", refusal: String(e).slice(0, 300) }); }
    expect(true).toBe(true);
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
      const access = KH.Access.tryFromString("read");
      if (!access) throw new Error("Access 'read' is not a recognized grade");
      await kh.addMember(agent, doc.toMembered(), access, []);
      const members = await creator.sentinelCgkaMembers(docIdHex);
      verdict("door2", { verdict: "OPENED", readGradeExists: true, readerOnCgka: members.includes(readerId) });
    } catch (e) { verdict("door2", { verdict: "REFUSED", refusal: String(e).slice(0, 300) }); }
    expect(true).toBe(true);
  });

  test("DOOR 3 — carriage without membership", { timeout: 90_000 }, async () => {
    try {
      const veilBorn = await vessel(0x45);
      const daemon = await vessel(0x46);
      const { docIdHex } = await veilBorn.createSentinelDoc("lar:///probe.carriage.only");
      const { id: daemonId } = await veilBorn.receiveContactCard(await daemon.contactCard());
      const events = await veilBorn.eventsForPeer(daemonId);
      await daemon.ingestPeerEvents(events);
      let sees = false;
      try { await daemon.sentinelCgkaMembers(docIdHex); sees = true; } catch { sees = false; }
      verdict("door3", { verdict: "OPENED", eventsCarried: events.length, daemonSeesDoc: sees });
    } catch (e) { verdict("door3", { verdict: "REFUSED", refusal: String(e).slice(0, 300) }); }
    expect(true).toBe(true);
  });
});
