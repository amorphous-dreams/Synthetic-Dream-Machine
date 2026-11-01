/** fold-trial-06 probe (MEASUREMENT, never lands): keyhive 0.6.0 readings for the empty-CGKA fault and the 0.3 archive. */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type * as KH from "@keyhive/keyhive/slim";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";

const CREATOR = new Uint8Array(32).fill(0x51);
const FIX = "/home/joshu/.lares-scratch/fold-trial/fixtures";
const rawKh = (p: KeyhiveProvider): KH.Keyhive => (p as unknown as { requireKh: () => KH.Keyhive }).requireKh();
const tryIt = async <T>(f: () => Promise<T>) => { try { return { ok: true, v: await f() } as const; } catch (e) { return { ok: false, err: String((e as Error).message ?? e).slice(0, 160) } as const; } };

async function founded() {
  const store = new InMemoryEventStore();
  const creator = new KeyhiveProvider();
  await creator.init({ seed: CREATOR, eventStore: store });
  const sentinel = await creator.createSentinelDoc("lar:///probe.restand.sentinel");
  const bagUrl = "lar:///probe.restand.bag";
  const { docId } = await creator.registerBag(bagUrl);
  const sealed = await creator.encryptContent(bagUrl, new TextEncoder().encode("sealed at the founding"));
  await creator.settleEvents();
  const events = await store.list();
  const archive = await creator.exportArchive();
  await creator.dispose();
  return { sentinel, bagUrl, docId, sealed, events, archive };
}

async function guestSeat(p: KeyhiveProvider, docIdHex: string, fill: number) {
  const guest = new KeyhiveProvider();
  await guest.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  const { id } = await p.receiveContactCard(await guest.contactCard());
  const r = await tryIt(async () => { await p.addSentinelMember(id, docIdHex); return (await p.sentinelCgkaMembers(docIdHex)).includes(id); });
  await guest.dispose();
  return r;
}

describe("fold trial: keyhive 0.6.0", () => {
  test("SEED + REPLAYED EVENTS (no prekey secrets): what stands", async () => {
    const f = await founded();
    const store = new InMemoryEventStore();
    const p = new KeyhiveProvider();
    await p.init({ seed: CREATOR, eventStore: store });
    for (const r of f.events) await store.put(r);
    const replay = await p.hydrateFromEventStore();
    const kh = rawKh(p);
    const docKnown = !!(await kh.getDocument(new (await import("@keyhive/keyhive/slim")).DocumentId(Buffer.from(f.sentinel.docIdHex.slice(2), "hex"))));
    const members = await tryIt(() => p.sentinelCgkaMembers(f.sentinel.docIdHex));
    const seat = await guestSeat(p, f.sentinel.docIdHex, 0x61);
    p.adoptBag(f.bagUrl, f.docId);
    const seal = await tryIt(async () => (await p.encryptContent(f.bagUrl, new Uint8Array([1]))).byteLength);
    const open = await tryIt(async () => new TextDecoder().decode(await p.decryptContent(f.bagUrl, f.sealed)));
    const docs = await tryIt(async () => (await kh.documents()).length);
    console.log("READING seed+events:", JSON.stringify({ events: f.events.length, variants: f.events.map((e) => e.variant), replay, docKnown, docs, members, seat, seal, open }));
    await p.dispose();
  });

  test("ARCHIVE (0.6-minted): seat, seal, open", async () => {
    const f = await founded();
    const p = new KeyhiveProvider();
    await p.init({ seed: CREATOR, eventStore: new InMemoryEventStore(), archiveBytes: f.archive });
    const seat = await guestSeat(p, f.sentinel.docIdHex, 0x63);
    p.adoptBag(f.bagUrl, f.docId);
    const open = await tryIt(async () => new TextDecoder().decode(await p.decryptContent(f.bagUrl, f.sealed)));
    const seal = await tryIt(async () => (await p.encryptContent(f.bagUrl, new Uint8Array([1]))).byteLength);
    console.log("READING archive-0.6:", JSON.stringify({ archiveBytes: f.archive.byteLength, seat, open, seal }));
    expect(seat).toEqual({ ok: true, v: true });
    expect(open).toEqual({ ok: true, v: "sealed at the founding" });
    expect(seal.ok).toBe(true);
    await p.dispose();
  });

  test("0.3.0-alpha.1 ARCHIVE opened on 0.6", async () => {
    const archive = new Uint8Array(readFileSync(`${FIX}/archive-0.3.bin`));
    const sealed = new Uint8Array(readFileSync(`${FIX}/sealed-0.3.bin`));
    const meta = JSON.parse(readFileSync(`${FIX}/meta-0.3.json`, "utf8"));
    const p = new KeyhiveProvider();
    const init = await tryIt(() => p.init({ seed: CREATOR, eventStore: new InMemoryEventStore(), archiveBytes: archive }));
    let open: unknown = "n/a";
    if (init.ok) { p.adoptBag(meta.bagUrl, meta.docId); open = await tryIt(async () => new TextDecoder().decode(await p.decryptContent(meta.bagUrl, sealed))); }
    const S = await import("@keyhive/keyhive/slim");
    const rawArchive = await tryIt(async () => { new S.Archive(archive); return "parsed"; });
    console.log("READING archive-0.3-on-0.6:", JSON.stringify({ bytes: archive.byteLength, init, rawArchive, open }));
  });

  test("0.3.0-alpha.1 EVENTS replayed on 0.6", async () => {
    const raw = JSON.parse(readFileSync(`${FIX}/events-0.3.json`, "utf8"), (_k, v) => v && v.$b64 ? new Uint8Array(Buffer.from(v.$b64, "base64")) : v);
    const store = new InMemoryEventStore();
    const p = new KeyhiveProvider();
    await p.init({ seed: CREATOR, eventStore: store });
    for (const r of raw) await store.put(r);
    const replay = await tryIt(() => p.hydrateFromEventStore());
    console.log("READING events-0.3-on-0.6:", JSON.stringify({ events: raw.length, replay }));
    await p.dispose();
  });
});
