import { describe, test, expect } from "vitest";
import * as KH from "@keyhive/keyhive/slim";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";
import { ensureKeyhiveWasm } from "../src/keyhive-provider.js";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);
ensureKeyhiveWasm();
const events: Record<string, { variant: string; bytes: Uint8Array }[]> = {};
const raw = async (fill: number, name = String(fill), archive?: Uint8Array) => {
  const signer = KH.Signer.memorySignerFromBytes(new Uint8Array(32).fill(fill));
  events[name] ??= [];
  const h = (e: KH.Event) => { events[name]!.push({ variant: e.variant, bytes: e.toBytes() }); };
  return archive ? new KH.Archive(archive).tryToKeyhive(KH.CiphertextStore.newInMemory(), signer, h) : KH.Keyhive.init(signer, KH.CiphertextStore.newInMemory(), h);
};
const cid = (n: number) => new KH.ChangeId(new Uint8Array(32).fill(n));
const read = KH.Access.tryFromString("read")!;
const ship = async (from: KH.Keyhive, to: KH.Keyhive) => {
  const agent = (await from.getAgent((await to.individual()).id))!;
  const m = await from.eventsForAgent(agent) as Map<unknown, Uint8Array>;
  await to.ingestEventsBytes([...m.values()]);
  return m.size;
};
const opens = (p: KH.Keyhive, doc: KH.DocumentId, ct: Uint8Array) => p.tryDecrypt(doc, KH.Encrypted.fromBytes(ct)).then((b) => dec(b), (e) => `REFUSED:${String(e?.message ?? e).slice(0, 60)}`);

describe("wrap-document probes", () => {
  test("W1 fresh doc: added individuals open, outsider and later-added do not", async () => {
    const f = await raw(1), a = await raw(2), b = await raw(3), x = await raw(4);
    for (const p of [a, b, x]) { await f.receiveContactCard(await p.contactCard()); await p.receiveContactCard(await f.contactCard()); }
    const idOf = async (p: KH.Keyhive) => (await p.individual()).id;
    const doc = await f.generateDocument([], cid(9), []);
    const n0 = events["1"]!.length;
    await f.addMember(await idOf(a), KH.MemberedId.document(doc), read, []);
    await f.addMember(await idOf(b), KH.MemberedId.document(doc), read, []);
    const r = await f.tryEncrypt(doc, cid(10), [], enc("the key"));
    const ct = r.encryptedContent().toBytes();
    console.log("W1 events during wrap:", events["1"]!.slice(n0).map((e) => e.variant), "ct bytes", ct.length, "updateOp", !!r.updateOp());
    console.log("shipped a:", await ship(f, a), "b:", await ship(f, b), "x:", await ship(f, x));
    console.log("a:", await opens(a, doc, ct), "| b:", await opens(b, doc, ct), "| x:", await opens(x, doc, ct), "| f:", await opens(f, doc, ct));
    // later add of x: does x open the EARLIER ciphertext?
    await f.addMember(await idOf(x), KH.MemberedId.document(doc), read, []);
    await ship(f, x);
    console.log("x after late add, earlier ct:", await opens(x, doc, ct));
    const r2 = await f.tryEncrypt(doc, cid(11), [], enc("second"));
    await ship(f, x);
    console.log("x after late add, later ct:", await opens(x, doc, r2.encryptedContent().toBytes()));
    // with predecessor
    const r3 = await f.tryEncrypt(doc, cid(12), [cid(10)], enc("third cites first"));
    await ship(f, x);
    console.log("x opens third:", await opens(x, doc, r3.encryptedContent().toBytes()), "then first:", await opens(x, doc, ct));
    const e = KH.Encrypted.fromBytes(ct);
    console.log("Encrypted fields: contentRef", e.contentRef().length, "predRefs", e.predRefs.length, "nonce", e.nonce.length, "pcs", e.pcsKeyHash.length);
  });

  test("W2 coparents at generation", async () => {
    const f = await raw(11), a = await raw(12);
    await f.receiveContactCard(await a.contactCard()); await a.receiveContactCard(await f.contactCard());
    const aId = (await a.individual()).id;
    let doc: KH.DocumentId;
    try { doc = await f.generateDocument([aId], cid(9), []); } catch (e) { console.log("W2 coparent generate refused:", String(e)); return; }
    const ct = (await f.tryEncrypt(doc, cid(10), [], enc("k"))).encryptedContent().toBytes();
    await ship(f, a);
    console.log("W2 coparent a opens:", await opens(a, doc, ct), "access:", String(await f.accessForDoc(aId, doc)));
  });

  test("W3 a member that never got the reader's card: can it wrap to a reader known only through group events?", async () => {
    const f = await raw(21), b = await raw(22), c = await raw(23);
    for (const p of [b, c]) { await f.receiveContactCard(await p.contactCard()); await p.receiveContactCard(await f.contactCard()); }
    const idOf = async (p: KH.Keyhive) => (await p.individual()).id;
    const g = await f.generateDocument([], cid(1), []);
    const admin = KH.Access.tryFromString("admin")!;
    await f.addMember(await idOf(b), KH.MemberedId.document(g), admin, []);
    await f.addMember(await idOf(c), KH.MemberedId.document(g), admin, []);
    await ship(f, b); await ship(f, c);
    const gb = await b.getDocument(g);
    console.log("W3 b reads cgka members:", (await gb!.cgkaMembers()).length, "b knows c agent:", !!(await b.getAgent(await idOf(c))));
    try {
      const w = await b.generateDocument([], cid(2), []);
      await b.addMember(await idOf(c), KH.MemberedId.document(w), read, []);
      await b.addMember(await idOf(f), KH.MemberedId.document(w), read, []);
      const ct = (await b.tryEncrypt(w, cid(3), [], enc("from b"))).encryptedContent().toBytes();
      // b never had c's card; ship b->c requires b to know c as agent
      const n = await ship(b, c);
      console.log("W3 shipped b->c", n, "c opens:", await opens(c, w, ct));
      await ship(b, f);
      console.log("W3 f opens:", await opens(f, w, ct));
    } catch (e) { console.log("W3 refused:", String(e)); }
  });

  test("W4 archive restore: wrapper and reader each reopen from an archive, with and without events", async () => {
    const f = await raw(31, "31"), a = await raw(32, "32");
    await f.receiveContactCard(await a.contactCard()); await a.receiveContactCard(await f.contactCard());
    const aId = (await a.individual()).id;
    const doc = await f.generateDocument([], cid(9), []);
    await f.addMember(aId, KH.MemberedId.document(doc), read, []);
    const ct = (await f.tryEncrypt(doc, cid(10), [], enc("k"))).encryptedContent().toBytes();
    await ship(f, a);
    console.log("W4 live a:", await opens(a, doc, ct));
    const fa = (await f.toArchive()).toBytes(), aa = (await a.toArchive()).toBytes();
    console.log("W4 archive sizes f", fa.length, "a", aa.length);
    const f2 = await raw(31, "31b", fa), a2 = await raw(32, "32b", aa);
    console.log("W4 restored (archive only) f:", await opens(f2, doc, ct), "| a:", await opens(a2, doc, ct));
    // archive taken BEFORE the wrap, then events re-ingested
    const g = await raw(41, "41"), h = await raw(42, "42");
    await g.receiveContactCard(await h.contactCard()); await h.receiveContactCard(await g.contactCard());
    const hEarly = (await h.toArchive()).toBytes(), gEarly = (await g.toArchive()).toBytes();
    const hId = (await h.individual()).id;
    const d2 = await g.generateDocument([], cid(9), []);
    await g.addMember(hId, KH.MemberedId.document(d2), read, []);
    const ct2 = (await g.tryEncrypt(d2, cid(10), [], enc("k2"))).encryptedContent().toBytes();
    const agent = (await g.getAgent(hId))!;
    const evs = [...(await g.eventsForAgent(agent) as Map<unknown, Uint8Array>).values()];
    const h2 = await raw(42, "42b", hEarly);
    console.log("W4 early-archive reader before ingest:", await opens(h2, d2, ct2));
    await h2.ingestEventsBytes(evs);
    console.log("W4 early-archive reader after ingest:", await opens(h2, d2, ct2));
    const g2 = await raw(41, "41b", gEarly);
    await g2.ingestEventsBytes(events["41"]!.map((e) => e.bytes));
    console.log("W4 early-archive WRAPPER after replaying own events:", await opens(g2, d2, ct2));
    const h3 = await raw(42, "42c");
    await h3.receiveContactCard(await g.contactCard());
    await h3.ingestEventsBytes(evs);
    console.log("W4 FRESH-init reader (no archive) after ingest:", await opens(h3, d2, ct2));
  });

  test("W5 a holder of every public byte and no seat", async () => {
    const f = await raw(51, "51"), a = await raw(52), blind = await raw(53);
    await f.receiveContactCard(await a.contactCard());
    const aId = (await a.individual()).id;
    const doc = await f.generateDocument([], cid(9), []);
    await f.addMember(aId, KH.MemberedId.document(doc), read, []);
    const ct = (await f.tryEncrypt(doc, cid(10), [], enc("k"))).encryptedContent().toBytes();
    await blind.ingestEventsBytes(events["51"]!.map((e) => e.bytes));
    console.log("W5 blind holder with every event:", await opens(blind, doc, ct), "hasDoc", await blind.hasDocument(doc));
  });
});
