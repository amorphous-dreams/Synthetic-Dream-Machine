/**
 * content-key-holder — the one place a vessel holds bare content keys: what makes a key exist, persist and
 * reach its readers, and what a locked vessel, a removed reader and a newcomer each read.
 *
 * The key shore here models the measured substrate (`content-key-fixture`); `@lararium/keyhive`
 * `tests/content-key-vessel.test.ts` runs the same acts over real Keyhive providers.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, it } from "vitest";
import { hex, utf8Bytes } from "../src/crypto.js";
import { contentKeyRollSink, type RollOutcome } from "../src/content-key-lineage.js";
import { HOLDER_REFUSALS, type SealedBlob } from "../src/content-key-holder.js";
import { keyVersionIdOf, mintContentKey, type KeyVersionId } from "../src/sealed-chunk.js";
import { bagLocatorOf, readRecord, signRecord, type KeyVersionBody, type KeyVersionPrivate, type RecordSigner } from "../src/sealed-records.js";
import type { SeatRoll } from "../src/seat-duties.js";
import { carry, counts, introduce, said, setsAside, text, verifies, vessel, world, type Vessel, type World } from "./content-key-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/garden-notes";
const OTHER = "lar:///ha.ka.ba/@test/bags/kitchen-notes";
const SCOPE = "fleet:test-scope";
const body = (s: string): Uint8Array => utf8Bytes(s);

async function seal(v: Vessel, plaintext: string, bagId = BAG, over: { history?: "shareable" | "closed"; signer?: RecordSigner | null } = {}): Promise<SealedBlob> {
  const r = await v.holder.sealBlob({ bagId, plaintext: body(plaintext), signer: over.signer === undefined ? v.signer : over.signer, ...(over.history ? { founding: { history: over.history } } : {}) });
  if ("refusal" in r) throw new Error(`setup: seal refused ${said(r)}`);
  return r;
}
async function opens(v: Vessel, ref: string, bagId = BAG): Promise<string> {
  const r = await v.holder.openBlob({ bagId, ref });
  return "plaintext" in r ? text(r.plaintext) : `REFUSED:${said(r)}`;
}
const roll = (raiseCids: string[], seat?: Vessel, how: SeatRoll["how"] = "revoked"): SeatRoll =>
  ({ kind: "seat-roll", scope: SCOPE, edgeId: "edge-1", ...(seat ? { seat: { group: "0xgroup", member: `0x${seat.id}` } } : {}), raiseCids, how });
/** Run one seat roll through the vessel's own content-key roll. */
async function rolls(v: Vessel, r: SeatRoll, bags: string[] = [BAG], signer: RecordSigner | null = v.signer): Promise<RollOutcome[]> {
  const reports: RollOutcome[] = [];
  await contentKeyRollSink(v.holder.rollerPorts({ bagsOf: (scope) => (scope === SCOPE ? bags : []), signer: () => signer, report: (o) => { reports.push(o); } }))(r);
  return reports;
}
async function fleet(...names: string[]): Promise<{ w: World; v: Vessel[] }> {
  const w = world();
  const v: Vessel[] = [];
  for (const name of names) v.push(await vessel(w, name));
  introduce(...v);
  return { w, v };
}
const heads = async (v: Vessel, bagId = BAG) => { const r = await v.holder.reading(bagId); if ("refusal" in r) throw new Error(said(r)); return r; };

describe("a key exists: the first private value founds its bag", () => {
  it("a body seals, opens again by its digest, and its bag stands founded under one version", async () => {
    const { v: [a] } = await fleet("a");
    const sealed = await seal(a!, "the first private note");
    expect(sealed.founded?.keyVersion).toBe(sealed.body.keyVersion);
    expect(await opens(a!, sealed.body.ref)).toBe("the first private note");
    const reading = await heads(a!);
    expect(reading.foundings.map((f) => f.heads)).toEqual([[sealed.body.keyVersion]]);
    expect(reading.rival).toBe(false);
    // CONTROL: a second body founds nothing and rides the same version.
    const second = await seal(a!, "a second note");
    expect(second.founded).toBeUndefined();
    expect(second.body.keyVersion).toBe(sealed.body.keyVersion);
    expect(await opens(a!, second.body.ref)).toBe("a second note");
  });

  it("a founding with no declaration stands closed; a declared one stands shareable", async () => {
    const { v: [a, b] } = await fleet("a", "b");
    await seal(a!, "closed by default");
    await seal(a!, "declared shareable", OTHER, { history: "shareable" });
    expect(said(await a!.holder.handOver({ bagId: BAG, reader: b!.id, signer: a!.signer }))).toBe("history-closed");
    expect(said(await a!.holder.handOver({ bagId: OTHER, reader: b!.id, signer: a!.signer }))).toBe("OK");
  });

  it("A SESSION SIGNS, OR NOTHING MINTS: with no signer the seal refuses by name and nothing reaches rest", async () => {
    const { v: [a] } = await fleet("a");
    const refused = await a!.holder.sealBlob({ bagId: BAG, plaintext: body("unsigned"), signer: null });
    expect(refused).toEqual({ refusal: "signer-unavailable" });
    expect([...a!.rest.values.keys()]).toEqual([]);
    expect(a!.values.size).toBe(0);
    // CONTROL: the same call with a signer rests a lockbox, a key version record, a manifest and a row.
    await seal(a!, "signed");
    expect([...new Set([...a!.rest.values.keys()].map((k) => k.split("/")[0]))].sort()).toEqual(["index", "key-version", "lockbox", "manifest", "own"]);
  });

  it("a signer whose face holds no write standing mints nothing: the record never reads back", async () => {
    const w = world();
    const a = await vessel(w, "a", { standing: { holdsWrite: () => false } });
    const refused = await a.holder.sealBlob({ bagId: BAG, plaintext: body("no standing"), signer: a.signer });
    expect(refused).toEqual({ refusal: "record-refused", cause: "writer-not-capable" });
    expect([...a.rest.values.keys()].filter((k) => !k.startsWith("lockbox/"))).toEqual([]);   // the orphan lockbox alone
  });

  it("a malformed bag id and a malformed reference refuse by name", async () => {
    const { v: [a] } = await fleet("a");
    expect(said(await a!.holder.sealBlob({ bagId: "", plaintext: body("x"), signer: a!.signer }))).toBe("bag-malformed");
    expect(said(await a!.holder.sealBlob({ bagId: "bag-\ud800", plaintext: body("x"), signer: a!.signer }))).toBe("bag-malformed");
    await seal(a!, "x");
    expect(said(await a!.holder.openBlob({ bagId: BAG, ref: "not-a-digest" }))).toBe("open-refused:reference-malformed");
    expect(said(await a!.holder.openBlob({ bagId: BAG, ref: "ab".repeat(32) }))).toBe("reference-unknown");
    expect(said(await a!.holder.openBlob({ bagId: OTHER, ref: "ab".repeat(32) }))).toBe("bag-unfounded");
  });
});

describe("a key persists: nothing private rests, and a restart finds what the vessel held", () => {
  it("a restarted holder opens what the earlier one sealed, from its lockboxes alone", async () => {
    const { v: [a] } = await fleet("a");
    const sealed = await seal(a!, "kept across a restart");
    a!.holder.lock();
    a!.restart();
    expect(await opens(a!, sealed.body.ref)).toBe("kept across a restart");
    // The restart minted nothing: one lockbox, one key version record.
    expect([...a!.rest.values.keys()].filter((k) => k.startsWith("lockbox/") || k.startsWith("key-version/")).length).toBe(2);
    // And it writes on under the same version.
    expect((await seal(a!, "after the restart")).body.keyVersion).toBe(sealed.body.keyVersion);
  });

  it("NO BARE KEY REACHES REST: no stored value and no sealed value holds a content key's bytes, and no rest value names the bag", async () => {
    const { w, v: [a] } = await fleet("a");
    const sealed = await seal(a!, "find my key");
    // The model shore keeps each payload in the clear, so the key reads off it: the probe knows what to hunt.
    const payload = [...w.docs.values()][0]!.payload;
    const key = payload.slice(payload.length - 32);
    expect(keyVersionIdOf(key as never, BAG)).toBe(sealed.body.keyVersion);   // the probe holds the true key
    const needle = hex(key), name = hex(utf8Bytes(BAG));
    const stored = [...a!.rest.values.values(), ...a!.values.values()].map((bytes) => hex(bytes));
    expect(stored.length).toBeGreaterThan(4);
    expect(stored.some((h) => h.includes(needle))).toBe(false);
    expect(stored.some((h) => h.includes(name))).toBe(false);
    expect([...a!.rest.values.keys()].some((k) => k.includes(needle))).toBe(false);
    // CONTROL: the same hunt finds the key in the payload it came from.
    expect(hex(payload).includes(needle)).toBe(true);
  });

  it("no answer and no refusal carries a key", async () => {
    const { w, v: [a, b] } = await fleet("a", "b");
    const sealed = await seal(a!, "answers", BAG, { history: "shareable" });
    const key = hex([...w.docs.values()][0]!.payload.slice(-32));
    const answers = [
      sealed, await a!.holder.reading(BAG), await a!.holder.openBlob({ bagId: BAG, ref: "cd".repeat(32) }),
      await a!.holder.handOver({ bagId: BAG, reader: b!.id, signer: a!.signer }), await a!.holder.parcelsFor({ bagId: BAG, reader: b!.id }),
      await a!.holder.serveUnserved(), await a!.holder.chooseHead({ bagId: BAG, head: "ab".repeat(32) as KeyVersionId }),
    ];
    const spelled = JSON.stringify(answers, (_k, value) => (value instanceof Uint8Array ? hex(value) : value));
    expect(spelled.length).toBeGreaterThan(500);
    expect(spelled.includes(key)).toBe(false);
  });

  it("A LOCKED VESSEL REFUSES BY NAME AND READS NOTHING: every ask answers `holder-locked`", async () => {
    const { v: [a, b] } = await fleet("a", "b");
    const sealed = await seal(a!, "before the lock");
    a!.holder.lock();
    expect(a!.holder.locked).toBe(true);
    const calls = a!.rest.calls.length;
    expect(await opens(a!, sealed.body.ref)).toBe("REFUSED:holder-locked");
    expect(said(await a!.holder.sealBlob({ bagId: BAG, plaintext: body("x"), signer: a!.signer }))).toBe("holder-locked");
    expect(said(await a!.holder.reading(BAG))).toBe("holder-locked");
    expect(said(await a!.holder.handOver({ bagId: BAG, reader: b!.id, signer: a!.signer }))).toBe("holder-locked");
    expect(said(await a!.holder.admitFromNow({ bagId: BAG, act: "admit-1", history: "closed", signer: a!.signer }))).toBe("holder-locked");
    expect(said(await a!.holder.receive({ parcels: [] }))).toBe("holder-locked");
    expect(said(await a!.holder.serveUnserved())).toBe("holder-locked");
    expect(said(await a!.holder.parcelsFor({ bagId: BAG, reader: b!.id }))).toBe("holder-locked");
    expect(a!.rest.calls.length).toBe(calls);                     // a locked holder asks rest nothing
    await expect(rolls(a!, roll(["raise-1"]))).rejects.toThrow(/unknown-bag/);   // and a roll stays owed
    expect(HOLDER_REFUSALS).toContain("holder-locked");
  });

  it("A KEY REACHES REST BEFORE ANY VALUE SEALS UNDER IT: a stop after the lockbox leaves an orphan that delivers nothing, and the next mint draws a fresh key", async () => {
    const { v: [a] } = await fleet("a");
    a!.rest.failOn = (kind) => kind === "key-version";
    const stopped = await a!.holder.sealBlob({ bagId: BAG, plaintext: body("never sealed"), signer: a!.signer });
    expect(said(stopped)).toBe("store-failed:the rest refused the write");
    expect(a!.values.size).toBe(0);                                // no value sealed under a key no record names
    expect([...a!.rest.values.keys()].map((k) => k.split("/")[0])).toEqual(["lockbox"]);
    a!.rest.failOn = null;
    a!.restart();
    expect((await heads(a!)).foundings.map((f) => f.heads)).toEqual([[]]);          // the orphan founds nothing
    expect((await heads(a!)).foundings[0]!.held).toEqual([]);
    const sealed = await seal(a!, "sealed after the stop");
    expect(sealed.founded).toBeDefined();
    a!.restart();
    expect(await opens(a!, sealed.body.ref)).toBe("sealed after the stop");
    // Exactly one counted version stands, and two lockboxes rest (the orphan and the true one).
    expect((await heads(a!)).foundings.filter((f) => f.heads.length > 0).map((f) => f.held.length)).toEqual([1]);
    expect([...a!.rest.values.keys()].filter((k) => k.startsWith("lockbox/")).length).toBe(2);
    expect([...a!.rest.values.keys()].filter((k) => k.startsWith("key-version/")).length).toBe(1);
  });

  it("a sealed value rests before the manifest that names it: a stop at the manifest leaves no row and no name for the value", async () => {
    const { v: [a] } = await fleet("a");
    await seal(a!, "first");
    a!.rest.failOn = (kind) => kind === "manifest";
    const stopped = await a!.holder.sealBlob({ bagId: BAG, plaintext: body("second"), signer: a!.signer });
    expect(said(stopped)).toBe("store-failed:the rest refused the write");
    expect([...a!.rest.values.keys()].filter((k) => k.startsWith("index/")).length).toBe(1);
    expect(a!.values.size).toBe(2);                                // the value rests; nothing names it
    a!.rest.failOn = null;
    expect((await seal(a!, "second")).body.ref).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("a value opens only through a verified manifest", () => {
  it("a missing value answers `value-absent`; an altered value refuses by the opener's own name", async () => {
    const { v: [a] } = await fleet("a");
    const sealed = await seal(a!, "to be altered");
    const kept = a!.values.get(sealed.body.cid)!;
    a!.values.delete(sealed.body.cid);
    expect(await opens(a!, sealed.body.ref)).toBe("REFUSED:value-absent");
    const altered = Uint8Array.from(kept);
    altered[altered.length - 1] = altered[altered.length - 1]! ^ 1;
    expect(hex(altered)).not.toBe(hex(kept));
    a!.values.set(sealed.body.cid, altered);
    expect(await opens(a!, sealed.body.ref)).toBe("REFUSED:open-refused:address-mismatch");
    a!.values.set(sealed.body.cid, kept);
    expect(await opens(a!, sealed.body.ref)).toBe("to be altered");
  });

  it("A ROW AUTHORIZES NOTHING: a row pointed at another value finds no manifest entry and opens no byte", async () => {
    const { w, v: [a] } = await fleet("a");
    const one = await seal(a!, "value one");
    const two = await seal(a!, "value two");
    const rows = await a!.store.rowsOf(one.founding);
    const forged = { ...rows.find((r) => r.address === one.body.cid)!, address: two.body.cid };
    await a!.store.putIndexRows([forged]);
    expect((await a!.store.rowsOf(one.founding)).length).toBe(3);   // the forged row rests
    a!.restart();
    // The honest row still opens value one; the forged row names an address its manifest never listed there.
    expect(await opens(a!, one.body.ref)).toBe("value one");
    expect(await opens(a!, two.body.ref)).toBe("value two");
    // A row forged for a reference NOBODY sealed, pointed at a value that rests: the row stands alone at its
    // entry locator, the manifest it names lists no such entry, and nothing opens.
    const { entryLocatorOf } = await import("../src/sealed-records.js");
    const { hexToBytes } = await import("../src/crypto.js");
    const key = [...w.docs.values()][0]!.payload.slice(-32);
    const ghost = "ee".repeat(32);
    const locator = entryLocatorOf(key as never, { bagId: BAG, keyVersion: one.body.keyVersion, role: "blob", logicalRef: hexToBytes(ghost) });
    await a!.store.putIndexRows([{ ...rows.find((r) => r.address === one.body.cid)!, locator }]);
    expect((await a!.store.rowsAt(one.founding, one.body.keyVersion, locator)).length).toBe(1);   // the forged row rests where the holder looks
    expect(await opens(a!, ghost)).toBe("REFUSED:reference-unknown");
  });

  it("a vessel that holds the lockbox and no manifest reads `reference-unknown`", async () => {
    const { v: [a, b] } = await fleet("a", "b");
    const sealed = await seal(a!, "no manifest travelled");
    const parcels = await a!.holder.parcelsFor({ bagId: BAG, reader: b!.id });
    expect(said(await b!.holder.receive({ parcels: parcels as never }))).toBe("OK");
    expect(await opens(b!, sealed.body.ref)).toBe("REFUSED:reference-unknown");
    await carry(a!, b!, BAG);                                      // manifest, rows and value arrive
    expect(await opens(b!, sealed.body.ref)).toBe("no manifest travelled");
  });
});

describe("a key reaches its readers, and only them", () => {
  it("a seated reader opens what the founder sealed; a vessel outside the wrap opens nothing and counts nothing", async () => {
    const { w, v: [a, b] } = await fleet("a", "b");
    const outsider = await vessel(w, "outsider");
    w.group.delete(outsider.id);                                    // never seated in the key group
    const sealed = await seal(a!, "for the group");
    await carry(a!, b!, BAG);
    expect(await opens(b!, sealed.body.ref)).toBe("for the group");
    // The outsider holds every lockbox, record, manifest, row and value, and no seat.
    await carry(a!, outsider, BAG);
    expect([...outsider.rest.values.keys()].some((k) => k.startsWith("lockbox/"))).toBe(true);
    expect(await opens(outsider, sealed.body.ref)).toBe("REFUSED:bag-unfounded");
    expect((await heads(outsider)).foundings).toEqual([]);
  });

  it("A REMOVED READER OPENS NOTHING SEALED AFTER ITS REMOVAL, and keeps what it read", async () => {
    const { w, v: [a, b, c] } = await fleet("a", "b", "c");
    const before = await seal(a!, "sealed while c stood");
    await carry(a!, b!, BAG); await carry(a!, c!, BAG);
    expect(await opens(c!, before.body.ref)).toBe("sealed while c stood");
    counts(w, a!, "raise-1"); counts(w, b!, "raise-1"); counts(w, c!, "raise-1");
    w.group.delete(c!.id);                                          // the key group answered `revoked`
    const reports = await rolls(a!, roll(["raise-1"], c!));
    expect(reports.map((r) => r.result)).toEqual(["rolled"]);
    const after = await seal(a!, "sealed after c left");
    expect(after.body.keyVersion).toBe(reports[0]!.keyVersion);
    await carry(a!, b!, BAG); await carry(a!, c!, BAG);            // c receives every byte a carrier holds, and the parcels
    expect(await opens(b!, after.body.ref)).toBe("sealed after c left");
    expect(await opens(c!, after.body.ref)).toBe("REFUSED:reference-unknown");
    expect(await opens(c!, before.body.ref)).toBe("sealed while c stood");   // forward only
    expect((await heads(c!)).foundings[0]!.held).toEqual([before.body.keyVersion]);
  });

  it("a seat no hand could revoke (`no-authority`) still gets left out: the roll names it", async () => {
    const { w, v: [a, b, c] } = await fleet("a", "b", "c");
    await seal(a!, "v1");
    // Every vessel's board carries the raise, c's included: only the wrap's own exclusion keeps c out.
    counts(w, a!, "raise-1"); counts(w, b!, "raise-1"); counts(w, c!, "raise-1");
    // The key group still seats c: nothing here revoked it.
    expect(w.group.has(c!.id)).toBe(true);
    const docsBefore = new Set(w.docs.keys());
    await rolls(a!, roll(["raise-1"], c!, "no-authority"));
    const minted = [...w.docs].filter(([id]) => !docsBefore.has(id));
    expect(minted.length).toBe(1);
    expect([...minted[0]![1].seats].sort()).toEqual([a!.id, b!.id].sort());   // the successor's wrap seats a and b, and not c
    const after = await seal(a!, "after the roll");
    await carry(a!, b!, BAG); await carry(a!, c!, BAG);
    expect(await opens(b!, after.body.ref)).toBe("after the roll");
    expect(await opens(c!, after.body.ref)).toBe("REFUSED:reference-unknown");
    // CONTROL: a roll that names no seat (the party left before any vessel could name it) serves whoever still sits.
    const { w: w2, v: [a2, , c2] } = await fleet("a", "b", "c");
    await seal(a2!, "v1");
    counts(w2, a2!, "raise-1"); counts(w2, c2!, "raise-1");
    await rolls(a2!, roll(["raise-1"], undefined, "gone"));
    const after2 = await seal(a2!, "after the roll");
    await carry(a2!, c2!, BAG);
    expect(await opens(c2!, after2.body.ref)).toBe("after the roll");
  });

  it("a party this vessel's edge reading sets aside gets left out of every wrap, whatever the key group says", async () => {
    const { w, v: [a, b, c] } = await fleet("a", "b", "c");
    setsAside(w, a!, c!);
    const sealed = await seal(a!, "c stands aside");
    await carry(a!, b!, BAG); await carry(a!, c!, BAG);
    expect(await opens(b!, sealed.body.ref)).toBe("c stands aside");
    expect(await opens(c!, sealed.body.ref)).toBe("REFUSED:bag-unfounded");
  });

  it("the roll leaves a raise owed while no session signs, and settles it once one does", async () => {
    const { w, v: [a] } = await fleet("a");
    const v1 = await seal(a!, "v1");
    counts(w, a!, "raise-1");
    await expect(rolls(a!, roll(["raise-1"]), [BAG], null)).rejects.toThrow(/mint-failed/);
    expect((await heads(a!)).foundings[0]!.heads).toEqual([v1.body.keyVersion]);
    const done = await rolls(a!, roll(["raise-1"]));
    expect(done.map((r) => r.result)).toEqual(["rolled"]);
    expect((await rolls(a!, roll(["raise-1"]))).map((r) => r.result)).toEqual(["not-owed"]);   // a repeat mints nothing
    expect([...a!.rest.values.keys()].filter((k) => k.startsWith("key-version/")).length).toBe(2);
  });

  it("a raise this vessel's own ledger does not count mints nothing; a bag no key ever served owes no roll; a vessel under its own shadow performs no key act", async () => {
    const { w, v: [a] } = await fleet("a");
    await seal(a!, "v1");
    await expect(rolls(a!, roll(["raise-uncounted"]))).rejects.toThrow(/mint-failed/);          // the lineage refuses the cause
    expect((await rolls(a!, roll(["raise-uncounted"]), [OTHER])).map((r) => r.result)).toEqual(["bag-unfounded"]);
    counts(w, a!, "raise-1");
    a!.shadowed = true;
    expect((await rolls(a!, roll(["raise-1"]))).map((r) => r.result)).toEqual(["own-edge-shadowed"]);
    a!.shadowed = false;
    expect((await rolls(a!, roll(["raise-1"]))).map((r) => r.result)).toEqual(["rolled"]);
  });
});

describe("a reader the mint could not serve stays owed, by name, inside the record", () => {
  it("an unserved reader opens nothing; the record names it sealed; a holder that gains its card serves it once", async () => {
    const w = world();
    const a = await vessel(w, "a"), b = await vessel(w, "b"), c = await vessel(w, "c");
    introduce(a, b);                                                // a holds no card for c
    const sealed = await seal(a, "c went unserved");
    expect(sealed.founded!.unserved).toEqual([c.id]);
    expect((await heads(a)).foundings[0]!.unserved).toEqual([c.id]);
    await carry(a, c, BAG);
    expect(await opens(c, sealed.body.ref)).toBe("REFUSED:bag-unfounded");
    // No carrier reads the debt: the reader's id rests nowhere in the clear.
    expect([...a.rest.values.values()].some((bytes) => hex(bytes).includes(hex(utf8Bytes(c.id))))).toBe(false);
    expect(await a.holder.serveUnserved()).toEqual({ parcels: [], owed: 1 });
    a.cards.add(c.id);                                              // the card arrives
    const served = await a.holder.serveUnserved();
    if ("refusal" in served) throw new Error(said(served));
    expect(served.parcels.length).toBe(1);
    expect(served.owed).toBe(0);
    await carry(a, c, BAG);
    expect(await opens(c, sealed.body.ref)).toBe("c went unserved");
    // A repeat wraps nothing twice, across a restart too.
    const lockboxes = [...a.rest.values.keys()].filter((k) => k.startsWith("lockbox/")).length;
    a.restart();
    expect(await a.holder.serveUnserved()).toEqual({ parcels: [], owed: 0 });
    expect([...a.rest.values.keys()].filter((k) => k.startsWith("lockbox/")).length).toBe(lockboxes);
  });

  it("an unserved reader that left its seat, or stands set aside, gets served nothing", async () => {
    const w = world();
    const a = await vessel(w, "a"), c = await vessel(w, "c"), d = await vessel(w, "d");
    await seal(a, "two unserved");
    a.cards.add(c.id); a.cards.add(d.id);
    w.group.delete(c.id);                                           // c left
    setsAside(w, a, d);                                             // d stands set aside
    expect(await a.holder.serveUnserved()).toEqual({ parcels: [], owed: 0 });
  });
});

describe("sibling successors both stand until a capable writer joins them", () => {
  it("two vessels that roll one raise mint siblings; each keeps its own head; a writer that holds both joins them", async () => {
    const { w, v: [a, b, c] } = await fleet("a", "b", "c");
    await seal(a!, "v1");
    await carry(a!, b!, BAG); await carry(a!, c!, BAG);
    for (const one of [a!, b!, c!]) counts(w, one, "raise-1");
    const ra = await rolls(a!, roll(["raise-1"])), rb = await rolls(b!, roll(["raise-1"]));
    expect(ra[0]!.keyVersion).not.toBe(rb[0]!.keyVersion);
    await carry(a!, b!, BAG); await carry(b!, a!, BAG);
    const fork = (await heads(a!)).foundings[0]!;
    expect(fork.forked).toBe(true);
    expect([...fork.heads].sort()).toEqual([ra[0]!.keyVersion, rb[0]!.keyVersion].sort());
    // Each vessel wrote under none of the two yet, and holds both: the next seal joins them.
    const joined = await seal(a!, "sealed under the join");
    expect(joined.joined).toBeDefined();
    expect((await heads(a!)).foundings[0]!.heads).toEqual([joined.joined!.keyVersion]);
    await carry(a!, b!, BAG); await carry(a!, c!, BAG); await carry(b!, c!, BAG);
    expect(await opens(b!, joined.body.ref)).toBe("sealed under the join");
    expect((await heads(b!)).foundings[0]!.forked).toBe(false);
    expect(await opens(c!, joined.body.ref)).toBe("sealed under the join");
  });

  it("A VESSEL UNDER ITS OWN SHADOW PERFORMS NO KEY ACT: it founds nothing and serves no reader, so no wrap of its own seats it", async () => {
    const w = world();
    const a = await vessel(w, "a"), c = await vessel(w, "c");
    a.shadowed = true;
    expect(said(await a.holder.sealBlob({ bagId: BAG, plaintext: body("x"), signer: a.signer }))).toBe("own-edge-shadowed");
    expect([...a.rest.values.keys()]).toEqual([]);                  // no lockbox wrapped for its own seat
    a.shadowed = false;
    await seal(a, "founded while clear");                           // c went unserved (no card)
    a.cards.add(c.id);
    a.shadowed = true;
    expect(await a.holder.serveUnserved()).toEqual({ parcels: [], owed: 0 });
    a.shadowed = false;
    const served = await a.holder.serveUnserved();                   // CONTROL: clear again, the debt gets served
    expect("parcels" in served && served.parcels.length).toBe(1);
  });

  it("HEADS OF UNLIKE SPANS: a writer that holds both refuses the join by name, and the fork keeps showing", async () => {
    const { w, v: [a, b] } = await fleet("a", "b");
    await seal(a!, "v1");
    await carry(a!, b!, BAG);
    // a admits from now (a new span) while b answers a raise (the earlier span runs on): neither read the other.
    verifies(w, a!, "admit-1"); verifies(w, b!, "admit-1");
    counts(w, a!, "raise-1"); counts(w, b!, "raise-1");
    const admitted = await a!.holder.admitFromNow({ bagId: BAG, act: "admit-1", history: "closed", signer: a!.signer });
    if ("refusal" in admitted) throw new Error(said(admitted));
    await rolls(b!, roll(["raise-1"]));
    await carry(b!, a!, BAG);
    const fork = (await heads(a!)).foundings[0]!;
    expect(fork.forked).toBe(true);
    expect(fork.held.length).toBe(3);
    // a wrote under neither head since they parted: with both in hand the seal asks for a join, and that join refuses.
    expect(said(await a!.holder.sealBlob({ bagId: BAG, plaintext: body("x"), signer: a!.signer }))).toBe("join-across-spans");
    expect((await heads(a!)).foundings[0]!.forked).toBe(true);
    // CONTROL: b holds one head of the two and writes on under it.
    expect(said(await b!.holder.sealBlob({ bagId: BAG, plaintext: body("b writes on"), signer: b!.signer }))).toBe("OK");
  });

  it("a writer under its own shadow joins nothing", async () => {
    const { w, v: [a, b] } = await fleet("a", "b");
    await seal(a!, "v1");
    await carry(a!, b!, BAG);
    counts(w, a!, "raise-1"); counts(w, b!, "raise-1");
    await rolls(a!, roll(["raise-1"])); await rolls(b!, roll(["raise-1"]));
    await carry(b!, a!, BAG);
    a!.shadowed = true;
    expect(said(await a!.holder.sealBlob({ bagId: BAG, plaintext: body("x"), signer: a!.signer }))).toBe("own-edge-shadowed");
    // Nor does it admit: a from-now version would wrap a key for its own seat.
    verifies(w, a!, "admit-1");
    expect(said(await a!.holder.admitFromNow({ bagId: BAG, act: "admit-1", history: "closed", signer: a!.signer }))).toBe("own-edge-shadowed");
  });
});

describe("rival foundings: two vessels found one bag before either reads the other", () => {
  it("both foundings stand under their own locators, each vessel reads both and writes under its own, and no rule picks one", async () => {
    const { v: [a, b] } = await fleet("a", "b");
    const fromA = await seal(a!, "a founded");
    const fromB = await seal(b!, "b founded");
    expect(fromA.founding).not.toBe(fromB.founding);
    await carry(a!, b!, BAG); await carry(b!, a!, BAG);
    for (const one of [a!, b!]) {
      const reading = await heads(one);
      expect(reading.rival).toBe(true);
      expect(reading.foundings.map((f) => f.founding).sort()).toEqual([fromA.founding, fromB.founding].sort());
      expect(await opens(one, fromA.body.ref)).toBe("a founded");
      expect(await opens(one, fromB.body.ref)).toBe("b founded");
    }
    expect((await seal(a!, "a writes on")).founding).toBe(fromA.founding);
    expect((await seal(b!, "b writes on")).founding).toBe(fromB.founding);
    expect((await heads(a!)).foundings.find((f) => f.written)!.founding).toBe(fromA.founding);
  });

  it("a vessel that wrote under neither refuses to pick: a person chooses, and the choice holds across a restart", async () => {
    const { v: [a, b, c] } = await fleet("a", "b", "c");
    const fromA = await seal(a!, "a founded"), fromB = await seal(b!, "b founded");
    await carry(a!, c!, BAG); await carry(b!, c!, BAG);
    expect(said(await c!.holder.sealBlob({ bagId: BAG, plaintext: body("c writes"), signer: c!.signer }))).toBe("founding-forked");
    expect(said(await c!.holder.chooseHead({ bagId: BAG, head: "ab".repeat(32) as KeyVersionId }))).toBe("no-head-held");
    expect(await c!.holder.chooseHead({ bagId: BAG, head: fromB.body.keyVersion })).toEqual({ founding: fromB.founding });
    c!.restart();
    expect((await seal(c!, "c writes")).founding).toBe(fromB.founding);
    // The choice moves: one founding carries this vessel's writes.
    expect(await c!.holder.chooseHead({ bagId: BAG, head: fromA.body.keyVersion })).toEqual({ founding: fromA.founding });
    expect((await seal(c!, "c writes again")).founding).toBe(fromA.founding);
  });

  it("A REMOVAL ROLLS EVERY FOUNDING A VESSEL HOLDS A HEAD IN, and a founding that arrives after the raise settled still gets its roll", async () => {
    const { w, v: [a, b, c] } = await fleet("a", "b", "c");
    await seal(a!, "a founded");
    const fromB = await seal(b!, "b founded");
    counts(w, a!, "raise-1"); counts(w, b!, "raise-1");
    w.group.delete(c!.id);
    // a rolls while it holds its own founding alone.
    expect((await rolls(a!, roll(["raise-1"], c!))).map((r) => r.result)).toEqual(["rolled"]);
    await carry(b!, a!, BAG);                                       // the rival founding arrives
    // The kept roll, handed over again: the founding already rolled owes nothing, the arrival rolls.
    const again = await rolls(a!, roll(["raise-1"], c!));
    expect(again.map((r) => r.result).sort()).toEqual(["not-owed", "rolled"]);
    expect(again.find((r) => r.result === "rolled")!.founding).toBe(fromB.founding);
    expect((await rolls(a!, roll(["raise-1"], c!))).map((r) => r.result)).toEqual(["not-owed", "not-owed"]);
  });
});

describe("a reader counts what it can check: the base rule", () => {
  async function newcomerAfterRemoval() {
    const { w, v: [a, b] } = await fleet("a", "b");
    const v1 = await seal(a!, "the past");
    counts(w, a!, "raise-1");
    const d = await vessel(w, "d");                                  // seated after version 1 wrapped
    introduce(a!, b!, d);
    const rolled = await rolls(a!, roll(["raise-1"]));
    const v2 = await seal(a!, "the present");
    return { w, a: a!, b: b!, d, v1, v2, rolled };
  }

  it("a reader seated FROM NOW opens the version its seat received and nothing earlier", async () => {
    const { w, a, d, v1, v2 } = await newcomerAfterRemoval();
    counts(w, d, "raise-1");                                         // its own ledger counts the raise
    await carry(a, d, BAG);
    expect(await opens(d, v2.body.ref)).toBe("the present");
    expect(await opens(d, v1.body.ref)).toBe("REFUSED:reference-unknown");
    expect((await heads(d)).foundings[0]!.held).toEqual([v2.body.keyVersion]);
    // A BASE CARRIES NO AUTHORITY OVER A SPAN'S PAST: d never counted the span's opener, so it hands nothing over.
    const e = await vessel(w, "e");
    introduce(d, e);
    expect(said(await d.holder.handOver({ bagId: BAG, reader: e.id, signer: d.signer }))).toBe("opener-not-counted");
  });

  it("A BASE NEEDS A LICENSE THE READER VERIFIES ITSELF: a removal whose raise its own ledger does not count stays uncounted", async () => {
    const { a, d, v2 } = await newcomerAfterRemoval();
    await carry(a, d, BAG);                                          // d counts no raise
    expect(await opens(d, v2.body.ref)).toBe("REFUSED:bag-unfounded");
    expect((await heads(d)).foundings[0]!.uncounted).toEqual([{ keyVersion: v2.body.keyVersion, why: "cause-unverified" }]);
  });

  it("a from-now admission mints a version that opens a new span; the newcomer counts it under the act it verified, and reads nothing before", async () => {
    const { w, v: [a] } = await fleet("a");
    const past = await seal(a!, "before the newcomer");
    const n = await vessel(w, "n");
    introduce(a!, n);
    verifies(w, a!, "admit-1");
    expect(said(await a!.holder.admitFromNow({ bagId: BAG, act: "admit-unverified", history: "closed", signer: a!.signer }))).toBe("count-refused:cause-unverified");
    const admitted = await a!.holder.admitFromNow({ bagId: BAG, act: "admit-1", history: "closed", signer: a!.signer });
    if ("refusal" in admitted) throw new Error(said(admitted));
    const present = await seal(a!, "after the admission");
    expect(present.body.keyVersion).toBe(admitted[0]!.keyVersion);
    await carry(a!, n, BAG);
    expect(await opens(n, present.body.ref)).toBe("REFUSED:bag-unfounded");   // n verified no admission yet
    verifies(w, n, "admit-1");
    await carry(a!, n, BAG);
    expect(await opens(n, present.body.ref)).toBe("after the admission");
    expect(await opens(n, past.body.ref)).toBe("REFUSED:reference-unknown");
    expect(said(await a!.holder.admitFromNow({ bagId: OTHER, act: "admit-1", history: "closed", signer: a!.signer }))).toBe("bag-unfounded");
    expect(said(await a!.holder.admitFromNow({ bagId: BAG, act: "admit-1", history: "closed", signer: null }))).toBe("signer-unavailable");
  });

  it("A FROM-NOW ADMISSION MINTS ONLY ONCE ITS FRESH BASE STANDS: the base gets cut under the drawn version before any lockbox wraps, and no base means no mint", async () => {
    const { w, v: [a] } = await fleet("a");
    await seal(a!, "before");
    verifies(w, a!, "admit-1", "admit-2", "admit-3");
    const lockboxes = () => [...a!.rest.values.keys()].filter((k) => k.startsWith("lockbox/")).length;
    const before = lockboxes();
    // No hand cuts a base: the admission refuses by name and rests nothing.
    a!.cutsBase = null; a!.restart();
    expect(said(await a!.holder.admitFromNow({ bagId: BAG, act: "admit-1", history: "closed", signer: a!.signer }))).toBe("fresh-base-unavailable");
    expect(lockboxes()).toBe(before);
    // A document store that refuses the cut: the same refusal, the same nothing.
    a!.cutsBase = false; a!.restart();
    expect(said(await a!.holder.admitFromNow({ bagId: BAG, act: "admit-2", history: "closed", signer: a!.signer }))).toBe("fresh-base-unavailable");
    expect(lockboxes()).toBe(before);
    expect((await heads(a!)).foundings[0]!.held.length).toBe(1);
    // CONTROL: a base that stands lets the version mint, and the cut ran while no lockbox of that version rested.
    a!.cutsBase = true; a!.restart();
    const admitted = await a!.holder.admitFromNow({ bagId: BAG, act: "admit-3", history: "closed", signer: a!.signer });
    if ("refusal" in admitted) throw new Error(said(admitted));
    expect(a!.bases.at(-1)).toEqual({ keyVersion: admitted[0]!.keyVersion, lockboxes: before });
    expect(lockboxes()).toBe(before + 1);
    // A removal's roll opens no span and asks for no base.
    const cuts = a!.bases.length;
    counts(w, a!, "raise-1");
    await rolls(a!, roll(["raise-1"]));
    expect(a!.bases.length).toBe(cuts);
  });

  it("A BASE LASTS ONLY WHILE ITS PARENT STAYS UNHELD: once the parent's key arrives the reader counts afresh, and the version stands only where that parent counts", async () => {
    const w = world();
    const f = await vessel(w, "f"), a = await vessel(w, "a");
    introduce(f, a);
    const v1 = await seal(f, "founded by f", BAG, { history: "shareable" });
    await carry(f, a, BAG);
    // d takes its seat after version 1 wrapped. It trusts a's face and refuses f's.
    const d = await vessel(w, "d", { standing: { holdsWrite: ({ certificate }) => certificate.scope.faceKey === a.chain.scope.faceKey } });
    introduce(a, d);
    counts(w, a, "raise-1"); counts(w, d, "raise-1");
    await rolls(a, roll(["raise-1"]));
    const v2 = await seal(a, "rolled by a");
    for (const [address, bytes] of a.values) d.values.set(address, bytes);
    // d opens version 2's lockbox alone, and counts it as a base over the parent it holds no key for.
    const first = await a.holder.parcelsFor({ bagId: BAG, reader: d.id });
    await d.holder.receive({ parcels: first as never, records: await a.store.records("manifest") });
    expect((await heads(d)).foundings[0]!.held).toEqual([v2.body.keyVersion]);
    expect(await opens(d, v2.body.ref)).toBe("rolled by a");
    // The parent's key arrives by a hand-over. Its record carries a signer d's own reading refuses.
    const handed = await a.holder.handOver({ bagId: BAG, reader: d.id, signer: a.signer });
    if ("refusal" in handed) throw new Error(said(handed));
    await d.holder.receive({ parcels: handed.parcels, records: [handed.record] });
    const reading = (await heads(d)).foundings[0]!;
    expect(reading.held).toEqual([]);                                // the parent stays uncounted, so the base falls with it
    expect(reading.uncounted.map((u) => u.why).sort()).toEqual(["parent-unknown", "writer-not-capable"]);
    expect(await opens(d, v2.body.ref)).toBe("REFUSED:bag-unfounded");
    expect(await opens(d, v1.body.ref)).toBe("REFUSED:bag-unfounded");
  });
});

describe("the with-its-past hand-over: an explicit act, under the span's own declaration", () => {
  it("a holder hands a shareable span to one reader: the reader counts it under the hand-over record and opens its past", async () => {
    const { w, v: [a] } = await fleet("a");
    const v1 = await seal(a!, "written in a shareable span", BAG, { history: "shareable" });
    counts(w, a!, "raise-1");
    await rolls(a!, roll(["raise-1"]));
    const v2 = await seal(a!, "written after a roll");
    const n = await vessel(w, "n");                                  // seated from now
    introduce(a!, n);
    counts(w, n, "raise-1");                                         // its own fold of the fleet's board counts the raise
    const handed = await a!.holder.handOver({ bagId: BAG, reader: n.id, signer: a!.signer });
    if ("refusal" in handed) throw new Error(said(handed));
    expect(handed.parcels.length).toBe(2);
    expect(handed.missing).toEqual([]);
    expect((await a!.store.records("hand-over")).map((r) => r.body.versions)).toEqual([handed.record.body.versions]);   // the record rests for every reader of the head
    expect(handed.record.body.versions).toEqual([v1.body.keyVersion, v2.body.keyVersion].sort());
    // The record seals the reader's name: no carrier reads who received the span.
    expect(hex(handed.record.sealed).includes(hex(utf8Bytes(n.id)))).toBe(false);
    expect(JSON.stringify(handed.record.body).includes(n.id)).toBe(false);
    for (const [address, bytes] of a!.values) n.values.set(address, bytes);
    expect(said(await n.holder.receive({ parcels: handed.parcels, records: [handed.record, ...await a!.store.records("manifest")] }))).toBe("OK");
    expect(await opens(n, v1.body.ref)).toBe("written in a shareable span");
    expect(await opens(n, v2.body.ref)).toBe("written after a roll");
  });

  it("THE HAND-OVER RECORD LICENSES NOTHING: a version it lists counts only where the reader's OWN ledger counts its raise", async () => {
    const { w, v: [a] } = await fleet("a");
    const v1 = await seal(a!, "v1", BAG, { history: "shareable" });
    counts(w, a!, "raise-1");
    await rolls(a!, roll(["raise-1"]));
    const v2 = await seal(a!, "v2");
    const n = await vessel(w, "n");
    introduce(a!, n);
    const handed = await a!.holder.handOver({ bagId: BAG, reader: n.id, signer: a!.signer });
    if ("refusal" in handed) throw new Error(said(handed));
    expect(handed.record.body.versions).toContain(v2.body.keyVersion);     // the record names the roll's version, for this reader
    for (const [address, bytes] of a!.values) n.values.set(address, bytes);
    await n.holder.receive({ parcels: handed.parcels, records: [handed.record, ...await a!.store.records("manifest")] });
    expect(await opens(n, v1.body.ref)).toBe("v1");                 // a founding needs no evidence
    expect(await opens(n, v2.body.ref)).toBe("REFUSED:reference-unknown");   // the raise counts nowhere in n's ledger, record or no record
    expect((await heads(n)).foundings[0]!.uncounted).toEqual([{ keyVersion: v2.body.keyVersion, why: "cause-unverified" }]);
    // CONTROL: once n's own ledger counts the raise, the same resting bytes count.
    counts(w, n, "raise-1");
    await n.holder.receive({ parcels: [] });
    expect(await opens(n, v2.body.ref)).toBe("v2");
  });

  it("THE REFUSALS: a closed span, a reader with no standing seat, a reader with no card, a vessel under its own shadow, no signer, an unknown head", async () => {
    const { w, v: [a, b] } = await fleet("a", "b");
    await seal(a!, "closed", BAG);
    await seal(a!, "open", OTHER, { history: "shareable" });
    expect(said(await a!.holder.handOver({ bagId: BAG, reader: b!.id, signer: a!.signer }))).toBe("history-closed");
    const stranger = await vessel(w, "stranger");
    w.group.delete(stranger.id);
    expect(said(await a!.holder.handOver({ bagId: OTHER, reader: stranger.id, signer: a!.signer }))).toBe("reader-not-standing");
    const aside = await vessel(w, "aside");
    introduce(a!, aside);
    setsAside(w, a!, aside);
    expect(said(await a!.holder.handOver({ bagId: OTHER, reader: aside.id, signer: a!.signer }))).toBe("reader-not-standing");
    const cardless = await vessel(w, "cardless");
    const lockboxes = [...a!.rest.values.keys()].filter((k) => k.startsWith("lockbox/")).length;
    expect(said(await a!.holder.handOver({ bagId: OTHER, reader: cardless.id, signer: a!.signer }))).toBe("reader-unreached");
    expect([...a!.rest.values.keys()].filter((k) => k.startsWith("lockbox/")).length).toBe(lockboxes);   // nothing rested
    expect([...a!.rest.values.keys()].filter((k) => k.startsWith("hand-over/")).length).toBe(0);
    a!.shadowed = true;
    expect(said(await a!.holder.handOver({ bagId: OTHER, reader: b!.id, signer: a!.signer }))).toBe("own-edge-shadowed");
    a!.shadowed = false;
    expect(said(await a!.holder.handOver({ bagId: OTHER, reader: b!.id, signer: null }))).toBe("signer-unavailable");
    expect(said(await a!.holder.handOver({ bagId: OTHER, reader: b!.id, from: "ab".repeat(32) as KeyVersionId, signer: a!.signer }))).toBe("version-unknown");
    expect(said(await a!.holder.handOver({ bagId: "lar:///nowhere", reader: b!.id, signer: a!.signer }))).toBe("bag-unfounded");
    // CONTROL: the shareable span, a standing reader with a card, an unshadowed vessel and a signer hand over.
    expect(said(await a!.holder.handOver({ bagId: OTHER, reader: b!.id, signer: a!.signer }))).toBe("OK");
  });

  it("THE ACT REACHES NO EARLIER SPAN: after a from-now admission the hand-over hands the new span alone", async () => {
    const { w, v: [a] } = await fleet("a");
    const old = await seal(a!, "the earlier span", BAG, { history: "shareable" });
    verifies(w, a!, "admit-1");
    const admitted = await a!.holder.admitFromNow({ bagId: BAG, act: "admit-1", history: "shareable", signer: a!.signer });
    if ("refusal" in admitted) throw new Error(said(admitted));
    const fresh = await seal(a!, "the new span");
    const n = await vessel(w, "n");
    introduce(a!, n);
    verifies(w, n, "admit-1");                                       // n reads the admission act itself
    const handed = await a!.holder.handOver({ bagId: BAG, reader: n.id, signer: a!.signer });
    if ("refusal" in handed) throw new Error(said(handed));
    expect(handed.record.body.versions).toEqual([admitted[0]!.keyVersion]);
    expect(handed.record.body.versions).not.toContain(old.body.keyVersion);
    for (const [address, bytes] of a!.values) n.values.set(address, bytes);
    await n.holder.receive({ parcels: handed.parcels, records: [handed.record, ...await a!.store.records("manifest")] });
    // The opener's parents sit in the earlier span, which n holds no key for: it counts as a base, under the act n verified.
    expect(await opens(n, fresh.body.ref)).toBe("the new span");
    expect(await opens(n, old.body.ref)).toBe("REFUSED:reference-unknown");
    // A BASE CARRIES NO AUTHORITY PAST ITS OWN SPAN, and n still hands on only what its opener declared.
    const m = await vessel(w, "m");
    introduce(n, m);
    n.cards.add(m.id);
    const onward = await n.holder.handOver({ bagId: BAG, reader: m.id, signer: n.signer });
    if ("refusal" in onward) throw new Error(said(onward));
    expect(onward.record.body.versions).toEqual([admitted[0]!.keyVersion]);
  });
});

describe("a lockbox and a record deliver nothing they cannot prove", () => {
  /** Rest a lockbox and a key version record a capable member forged by hand. */
  async function forge(v: Vessel, w: World, bagId: string, over: { locator?: "true" | "other"; body?: Partial<KeyVersionBody>; private?: Partial<KeyVersionPrivate>; wrapAs?: { bag?: string; keyVersion?: string } }) {
    const key = mintContentKey();
    const keyVersion = keyVersionIdOf(key, bagId);
    const locator = over.locator === "other" ? bagLocatorOf(mintContentKey(), bagId) : bagLocatorOf(key, bagId);
    const { wrapLockbox } = await import("../src/lockbox-wrap.js");
    const wrapped = await wrapLockbox({ payload: { bagId, locator, keyVersion, key }, readers: [...w.group], shore: v.shore });
    if (!("lockbox" in wrapped)) throw new Error("setup: wrap");
    await v.store.putLockbox({ ...wrapped.lockbox, ...(over.wrapAs ?? {}) } as never);
    const signed = await signRecord({
      kind: "key-version", bagId, key, signer: v.signer,
      body: { bag: locator, keyVersion, parents: [], span: keyVersion, ...over.body },
      private: { cause: { kind: "founding" }, history: "closed", joinProofs: [], unserved: [], ...over.private },
    });
    if (!("record" in signed)) throw new Error(`setup: sign ${signed.refusal}`);
    await v.store.putRecord(signed.record);
    return { key, keyVersion, locator, record: signed.record };
  }

  it("CONTROL: a founding forged by hand through the same doors counts", async () => {
    const { w, v: [a] } = await fleet("a");
    const made = await forge(a!, w, BAG, {});
    a!.restart();
    expect((await heads(a!)).foundings.map((f) => f.heads)).toEqual([[made.keyVersion]]);
  });

  it("a founding whose locator its own key does not derive counts nothing", async () => {
    const { w, v: [a] } = await fleet("a");
    const made = await forge(a!, w, BAG, { locator: "other" });
    a!.restart();
    const reading = await heads(a!);
    expect(reading.foundings[0]!.heads).toEqual([]);
    expect(reading.foundings[0]!.uncounted).toEqual([{ keyVersion: made.keyVersion, why: "founding-locator-mismatch" }]);
  });

  it("A SWAPPED LOCKBOX REFUSES: a box moved under another lockbox's clear part opens to a payload that names another version, and delivers nothing", async () => {
    const { w, v: [a] } = await fleet("a");
    const true1 = await forge(a!, w, BAG, {});
    const other = keyVersionIdOf(mintContentKey(), BAG);
    // The same box again, re-labelled as another version of the same locator.
    const lockbox = (await a!.store.lockboxes())[0]!;
    await a!.store.putLockbox({ ...lockbox, keyVersion: other });
    expect((await a!.store.lockboxes()).length).toBe(2);            // the swapped lockbox rests
    a!.restart();
    const reading = await heads(a!);
    expect(reading.foundings.length).toBe(1);
    expect(reading.foundings[0]!.held).toEqual([true1.keyVersion]);   // the true version alone
    expect(reading.foundings[0]!.uncounted).toEqual([]);              // the swapped box delivered no key at all
  });

  it("a record signed by a face the reader's own reading holds incapable counts nothing; two unlike records under one version refuse both", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const strict = await vessel(w, "strict", { standing: { holdsWrite: ({ certificate }) => certificate.scope.faceKey !== a.chain.scope.faceKey } });
    introduce(a, strict);
    const sealed = await seal(a, "from a writer strict refuses");
    await carry(a, strict, BAG);
    expect(await opens(strict, sealed.body.ref)).toBe("REFUSED:bag-unfounded");
    expect((await heads(strict)).foundings[0]!.uncounted).toEqual([{ keyVersion: sealed.body.keyVersion, why: "writer-not-capable" }]);
    // Two unlike facts under one key version id: the same key, signed once as closed and once as shareable.
    const { w: w2, v: [x] } = await fleet("x");
    const made = await forge(x!, w2, BAG, {});
    const twin = await signRecord({ kind: "key-version", bagId: BAG, key: made.key, signer: x!.signer, body: { bag: made.locator, keyVersion: made.keyVersion, parents: [], span: made.keyVersion }, private: { cause: { kind: "founding" }, history: "shareable", joinProofs: [], unserved: [] } });
    if (!("record" in twin)) throw new Error("setup");
    expect(readRecord("key-version", twin.record, { bagId: BAG, locator: made.locator, key: made.key, standing: { holdsWrite: () => true } })).toHaveProperty("record");
    await x!.store.putRecord(twin.record);
    x!.restart();
    const reading = await heads(x!);
    expect(reading.foundings[0]!.heads).toEqual([]);
    expect(reading.foundings[0]!.uncounted).toEqual([{ keyVersion: made.keyVersion, why: "version-conflict" }]);
  });

  it("A KEY ENTERS USE ONLY UNDER A COUNTED RECORD: a lockbox with no record opens no value and seals none", async () => {
    const { w, v: [a] } = await fleet("a");
    const made = await forge(a!, w, BAG, {});
    for (const name of [...a!.rest.values.keys()].filter((k) => k.startsWith("key-version/"))) a!.rest.values.delete(name);
    // A fresh vessel object over a rest that holds the lockbox alone.
    const b = await vessel(w, "b");
    introduce(a!, b);
    for (const lockbox of await a!.store.lockboxes()) await b.store.putLockbox(lockbox);
    for (const doc of w.docs.keys()) b.ingested.add(doc);
    w.docs.forEach((doc) => (doc.seats as Set<string>).add(b.id));
    const reading = await heads(b);
    expect(reading.foundings[0]!.held).toEqual([]);
    expect(reading.foundings[0]!.heads).toEqual([]);
    void made;
    // The next seal founds the bag afresh under a key of its own.
    const sealed = await seal(b, "a fresh founding");
    expect(sealed.founded).toBeDefined();
    expect(sealed.body.keyVersion).not.toBe(made.keyVersion);
  });
});

describe("a lock ends an act in flight, at whichever await it lands", () => {
  it("a lock that lands while the sealed value rests leaves no manifest to name it", async () => {
    const { v: [a] } = await fleet("a");
    await seal(a!, "first");
    const set = a!.values.set.bind(a!.values);
    let armed = true;
    a!.values.set = (address, bytes) => { if (armed) { armed = false; a!.holder.lock(); } return set(address, bytes); };
    const manifests = () => [...a!.rest.values.keys()].filter((k) => k.startsWith("manifest/")).length;
    const before = manifests();
    expect(said(await a!.holder.sealBlob({ bagId: BAG, plaintext: body("second"), signer: a!.signer }))).toBe("holder-locked");
    expect(armed).toBe(false);                                       // the lock did land at the value's write
    expect(manifests()).toBe(before);                                // no manifest rested after it
    expect([...a!.rest.values.keys()].filter((k) => k.startsWith("index/")).length).toBe(1);
  });

  it("a lock that lands while the manifest signs rests no sealed value; one that lands at the last write still answers `holder-locked`", async () => {
    // (1) The lock lands inside the manifest's signature: the check before the value's write stops the act.
    const { v: [a] } = await fleet("a");
    await seal(a!, "first");
    let signs = 0;
    const locking: RecordSigner = { certificate: a!.signer.certificate, sign: async (purpose, payload) => { signs += 1; a!.holder.lock(); return a!.signer.sign(purpose, payload); } };
    const values = a!.values.size;
    expect(said(await a!.holder.sealBlob({ bagId: BAG, plaintext: body("second"), signer: locking }))).toBe("holder-locked");
    expect(signs).toBe(1);
    expect(a!.values.size).toBe(values);                             // no value rested after the lock
    // (2) The lock lands at the very last write (the write-head note): every earlier check has passed.
    const { v: [b] } = await fleet("b");
    await seal(b!, "first");
    let armed = true;
    const inner = b!.rest.put.bind(b!.rest);
    b!.rest.put = async (kind, name, bytes) => { await inner(kind, name, bytes); if (armed && kind === "own" && name.startsWith("write-head.")) { armed = false; b!.holder.lock(); } };
    expect(said(await b!.holder.sealBlob({ bagId: BAG, plaintext: body("second"), signer: b!.signer }))).toBe("holder-locked");
    expect(armed).toBe(false);                                       // the lock did land at that write
    // CONTROL: with no lock the same seal answers a sealed body.
    b!.restart();
    expect(said(await b!.holder.sealBlob({ bagId: BAG, plaintext: body("third"), signer: b!.signer }))).toBe("OK");
  });
});

describe("one act at a time", () => {
  it("two seals asked together found one bag once", async () => {
    const { v: [a] } = await fleet("a");
    const [one, two] = await Promise.all([seal(a!, "first"), seal(a!, "second")]);
    expect([one.founded !== undefined, two.founded !== undefined].filter(Boolean).length).toBe(1);
    expect(one.body.keyVersion).toBe(two.body.keyVersion);
    expect([...a!.rest.values.keys()].filter((k) => k.startsWith("key-version/")).length).toBe(1);
  });

  it("a lock that lands while a seal runs leaves no key behind and no half-told answer", async () => {
    const { v: [a] } = await fleet("a");
    await seal(a!, "first");
    const running = a!.holder.sealBlob({ bagId: BAG, plaintext: body("second"), signer: a!.signer });
    a!.holder.lock();
    const calls = a!.rest.calls.filter((c) => c.startsWith("put")).length;
    const result = await running;
    expect(said(result)).toBe("holder-locked");                     // the act in flight answers the lock, never a success
    expect(a!.rest.calls.filter((c) => c.startsWith("put")).length).toBe(calls);   // and rests nothing after it
    expect(said(await a!.holder.reading(BAG))).toBe("holder-locked");
    // CONTROL: the same seal with no lock answers a sealed body.
    a!.restart();
    expect(said(await a!.holder.sealBlob({ bagId: BAG, plaintext: body("second"), signer: a!.signer }))).toBe("OK");
  });
});
