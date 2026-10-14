/**
 * content-key-seat — the content-key holder seated beside REAL Keyhive identities: a key exists, persists
 * across a restored Archive, reaches the readers the face's key group holds, and leaves a removed device
 * behind at the vessel's own seat roll.
 *
 * Every vessel here stands real `KeyhiveProvider`s (a veil that holds the group, a vessel that holds a seat),
 * a rest, a store of sealed values and a session's signer. Nothing stands in for Keyhive.
 *
 * WHAT THE REMOVAL PROOF RESTS ON, stated once: (1) Keyhive's key agreement inside a FRESH document holds a
 * leaf for each identity the wrapper added and for nobody else (`lockbox-wrap.test.ts`, on 0.3.0-alpha.1);
 * (2) the minting vessel's own reading of who to leave out: the seat its roll names, and each party its edge
 * reading sets aside; (3) the removed device's prekey secrets staying its own. It rests on NO revocation
 * reaching the bag's document: the lockbox wraps into a fresh document no group reaches.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store · lar:///ha.ka.ba/lares/api/pono/kapae#/keys
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ScriptedSeatRolls, SealedStore, ed25519SignerFromSeed, hex, memorySealedStoreRest, signSeatRoll, utf8Bytes,
  type EdgeStanding, type RecordSigner, type RollOutcome, type SealedAddress, type SealedStoreRest, type SeatRoll,
} from "@lararium/mesh";
import { KeyhiveProvider, InMemoryEventStore, announceSeatRoll, keyhiveSeatShore, runSeatDuties, seatContentKeys, type ContentKeySeat } from "../src/index.js";
import { sessionSignatureImage } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain, pair, signHex, type Chain } from "../../lararium-mesh/tests/face-proof-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/garden-notes";
const SCOPE = "ab".repeat(32);                                        // a fleet root, as a seat roll names its scope
const NEXUS = "nexus-test-one";
const text = (b: Uint8Array) => new TextDecoder().decode(b);
const said = (r: object): string => ("refusal" in r ? `${(r as { refusal: string }).refusal}${(r as { cause?: string }).cause ? `:${(r as { cause?: string }).cause}` : ""}` : "OK");
const bare = (id: string) => id.toLowerCase().replace(/^0x/, "");

interface Device {
  readonly name: string;
  readonly seed: number;
  readonly events: InMemoryEventStore;
  provider: KeyhiveProvider;
  readonly id: string;
  readonly archives: Uint8Array[];
  readonly rest: SealedStoreRest;
  readonly values: Map<SealedAddress, Uint8Array>;
  readonly chain: Chain;
  readonly signer: RecordSigner;
  readonly rolls: ScriptedSeatRolls;
  readonly standing: Map<string, EdgeStanding>;
  readonly raises: Set<string>;
  readonly reports: RollOutcome[];
  signs: boolean;
  seat: ContentKeySeat;
  /** Stand the seat afresh over the same rest. */
  reseat(): ContentKeySeat;
}

/** A fleet of devices in one PersonaGroup: `founder` creates the group and seats the rest. */
async function fleet(base: number, names: readonly string[]): Promise<{ group: string; devices: Device[]; ship(from: Device, to: Device): Promise<void>; everything(from: Device): Promise<Uint8Array[]> }> {
  const devices: Device[] = [];
  let group = "";
  for (const [i, name] of names.entries()) {
    const events = new InMemoryEventStore();
    const provider = new KeyhiveProvider();
    await provider.init({ seed: new Uint8Array(32).fill(base + i), eventStore: events });
    const c = await chain(`${name}-${base}`, NEXUS);
    const signer: RecordSigner = {
      certificate: c.sessionCertificate,
      sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }),
    };
    const d: Device = {
      name, seed: base + i, events, provider, id: await provider.vesselIdentifierHex(), archives: [], rest: memorySealedStoreRest(), values: new Map(),
      chain: c, signer, rolls: new ScriptedSeatRolls(), standing: new Map(), raises: new Set(), reports: [], signs: true,
      seat: undefined as unknown as ContentKeySeat,
      reseat() {
        d.seat = seatContentKeys({
          providers: [d.provider], rest: d.rest,
          values: { read: async (a) => d.values.get(a) ?? null, write: async (a, bytes) => { d.values.set(a, Uint8Array.from(bytes)); } },
          restArchive: async (p) => { d.archives.push(await (p as KeyhiveProvider).exportArchive()); },
          group: { groupId: group, scope: SCOPE },
          bags: () => [BAG],
          standingOf: (member) => d.standing.get(bare(member)) ?? "clear",
          countedRaises: () => d.raises,
          session: { signer: () => (d.signs ? d.signer : null), standing: { holdsWrite: () => true } },
          report: (o) => { d.reports.push(o); },
          subscribe: (sink) => d.rolls.subscribe(sink),
        });
        return d.seat;
      },
    };
    devices.push(d);
  }
  for (const a of devices) for (const b of devices) if (a !== b) await a.provider.receiveContactCard(await b.provider.contactCard());
  const founder = devices[0]!;
  group = (await founder.provider.createGroup()).groupId;
  for (const d of devices.slice(1)) await founder.provider.addGroupMember(d.id, group);
  const ship = async (from: Device, to: Device): Promise<void> => { await to.provider.ingestPeerEvents(await from.provider.eventsForPeer(to.id)); };
  for (const d of devices.slice(1)) await ship(founder, d);
  for (const d of devices) d.reseat();
  return { group, devices, ship, everything: async (from) => { await from.provider.settleEvents(); return (await from.events.list()).map((r) => r.bytes); } };
}

async function seal(d: Device, plaintext: string, history?: "shareable" | "closed") {
  const r = await d.seat.holder.sealBlob({ bagId: BAG, plaintext: utf8Bytes(plaintext), signer: d.signs ? d.signer : null, ...(history ? { founding: { history } } : {}) });
  if ("refusal" in r) throw new Error(`setup: seal refused ${said(r)}`);
  return r;
}
async function opens(d: Device, ref: string): Promise<string> {
  const r = await d.seat.holder.openBlob({ bagId: BAG, ref });
  return "plaintext" in r ? text(r.plaintext) : `REFUSED:${said(r)}`;
}
/** Carry everything one device holds for the bag to another: parcels over the member lane, the rest as a carrier would. */
async function carry(from: Device, to: Device): Promise<void> {
  const parcels = await from.seat.holder.parcelsFor({ bagId: BAG, reader: to.id });
  if (!Array.isArray(parcels)) throw new Error(`setup: parcelsFor refused ${said(parcels as object)}`);
  const store = new SealedStore(from.rest);
  for (const [address, bytes] of from.values) to.values.set(address, Uint8Array.from(bytes));
  const took = await to.seat.holder.receive({ parcels, records: [...await store.records("manifest"), ...await store.records("hand-over")] });
  if ("refusal" in took) throw new Error(`setup: receive refused ${said(took)}`);
}
const roll = (raiseCids: string[], seat: { group: string; member: string } | undefined, how: SeatRoll["how"]): SeatRoll =>
  ({ kind: "seat-roll", scope: SCOPE, edgeId: "edge-1", ...(seat ? { seat } : {}), raiseCids, how });

describe("a private body seals on real Keyhive identities, end to end", () => {
  it("seal, restart from the kept Archive, unlock, open; every seated device opens; a locked vessel refuses by name and reads nothing", async () => {
    const { devices: [f, b] } = await fleet(0x10, ["f", "b"]);
    const sealed = await seal(f!, "the household's private note");
    expect(sealed.founded).toBeDefined();
    expect(await opens(f!, sealed.body.ref)).toBe("the household's private note");
    await carry(f!, b!);
    expect(await opens(b!, sealed.body.ref)).toBe("the household's private note");

    // LOCK: every key overwritten; every ask refuses by name.
    f!.seat.lock();
    expect(await opens(f!, sealed.body.ref)).toBe("REFUSED:holder-locked");
    expect(said(await f!.seat.holder.sealBlob({ bagId: BAG, plaintext: utf8Bytes("x"), signer: f!.signer }))).toBe("holder-locked");

    // RESTART: a new provider from the Archive the wrap rested, over an EMPTY event store, and a new seat over the same rest.
    expect(f!.archives.length).toBeGreaterThan(0);
    const restored = new KeyhiveProvider();
    await restored.init({ seed: new Uint8Array(32).fill(f!.seed), eventStore: new InMemoryEventStore(), archiveBytes: f!.archives[f!.archives.length - 1]! });
    f!.provider = restored;
    f!.reseat();
    expect(await opens(f!, sealed.body.ref)).toBe("the household's private note");
    // It writes on under the same version: the restart minted nothing.
    expect((await seal(f!, "after the restart")).body.keyVersion).toBe(sealed.body.keyVersion);

    // CONTROL: a provider that stands FRESH (no Archive) under the same seed opens nothing: its wrap seat left with its prekeys.
    const fresh = new KeyhiveProvider();
    await fresh.init({ seed: new Uint8Array(32).fill(f!.seed), eventStore: new InMemoryEventStore() });
    f!.provider = fresh;
    f!.reseat();
    expect(await opens(f!, sealed.body.ref)).toBe("REFUSED:bag-unfounded");
  });

  it("a reader restored from its own Archive opens each lockbox it opened before", async () => {
    const { devices: [f, b] } = await fleet(0x18, ["f", "b"]);
    const sealed = await seal(f!, "kept by the reader");
    await carry(f!, b!);
    expect(await opens(b!, sealed.body.ref)).toBe("kept by the reader");
    const archive = await b!.provider.exportArchive();
    const restored = new KeyhiveProvider();
    await restored.init({ seed: new Uint8Array(32).fill(b!.seed), eventStore: new InMemoryEventStore(), archiveBytes: archive });
    b!.provider = restored;
    b!.reseat();
    expect(await opens(b!, sealed.body.ref)).toBe("kept by the reader");
  });

  it("A SESSION SIGNS, OR NOTHING MINTS: a seat with no session proof composed refuses by name and counts no record", async () => {
    const { group, devices: [f] } = await fleet(0x20, ["f"]);
    const bareSeat = seatContentKeys({
      providers: [f!.provider], rest: f!.rest, values: { read: async () => null, write: async () => {} },
      restArchive: async () => {}, group: { groupId: group, scope: SCOPE }, bags: () => [BAG], subscribe: (sink) => f!.rolls.subscribe(sink),
    });
    expect(await bareSeat.holder.sealBlob({ bagId: BAG, plaintext: utf8Bytes("x"), signer: null })).toEqual({ refusal: "signer-unavailable" });
    // A signer from elsewhere changes nothing: with no proof composed this vessel reads no writer as capable.
    expect(said(await bareSeat.holder.sealBlob({ bagId: BAG, plaintext: utf8Bytes("x"), signer: f!.signer }))).toBe("record-refused:writer-not-capable");
    // CONTROL: the composed seat seals.
    expect((await seal(f!, "with a session")).body.ref).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("a removed device opens nothing sealed after its removal", () => {
  it("THE ROLL MINTS at the vessel's own seat roll: the executor revokes the seat, hands the roll over, and the successor wraps for the readers that remain", async () => {
    const { group, devices: [f, b, c], everything } = await fleet(0x30, ["f", "b", "c"]);
    const before = await seal(f!, "sealed while c stood");
    await carry(f!, b!); await carry(f!, c!);
    expect(await opens(c!, before.body.ref)).toBe("sealed while c stood");

    // The vessel answers one counted raise through the REAL executor on the Keyhive shore.
    f!.raises.add("raise-1");
    const outcomes = await runSeatDuties(keyhiveSeatShore(f!.provider), [{ kind: "revoke", scope: SCOPE, edgeId: "edge-c", seat: { group, member: c!.id }, raiseCids: ["raise-1"], then: "leave-out" }], (r) => f!.rolls.announce(r));
    expect(outcomes.map((o) => `${o.did}:${o.marks.join(",")}`)).toEqual(["revoked:raise-1"]);
    expect(f!.reports.map((r) => r.result)).toEqual(["rolled"]);

    const after = await seal(f!, "sealed after c left");
    expect(after.body.keyVersion).toBe(f!.reports[0]!.keyVersion);
    expect(after.body.keyVersion).not.toBe(before.body.keyVersion);
    // A reader counts a removal's version only where its OWN ledger counts the raise.
    await carry(f!, b!);
    expect(await opens(b!, after.body.ref)).toBe("REFUSED:reference-unknown");
    b!.raises.add("raise-1");
    await carry(f!, b!);
    expect(await opens(b!, after.body.ref)).toBe("sealed after c left");

    // The removed device receives EVERYTHING a carrier or a careless member lane could hand it: every lockbox,
    // record, manifest, row and sealed value, and every public Keyhive operation the vessel ever emitted.
    await c!.provider.ingestPeerEvents(await everything(f!)).catch(() => undefined);
    await carry(f!, c!);
    expect((await new SealedStore(c!.rest).lockboxes()).length).toBe(2);        // it holds both lockboxes
    expect(await opens(c!, after.body.ref)).toBe("REFUSED:reference-unknown");
    expect(await opens(c!, before.body.ref)).toBe("sealed while c stood");      // forward only: it keeps what it read
    const reading = await c!.seat.holder.reading(BAG);
    if ("refusal" in reading) throw new Error(said(reading));
    expect(reading.foundings[0]!.held).toEqual([before.body.keyVersion]);

    // A restored earlier Archive opens no more than the live device did.
    const old = new KeyhiveProvider();
    await old.init({ seed: new Uint8Array(32).fill(c!.seed), eventStore: new InMemoryEventStore(), archiveBytes: await c!.provider.exportArchive() });
    c!.provider = old;
    c!.reseat();
    expect(await opens(c!, after.body.ref)).toBe("REFUSED:reference-unknown");
  });

  it("CONTROL: with no removal the same device opens what the vessel seals next", async () => {
    const { devices: [f, , c] } = await fleet(0x38, ["f", "b", "c"]);
    await seal(f!, "v1");
    const next = await seal(f!, "sealed with c still seated");
    await carry(f!, c!);
    expect(await opens(c!, next.body.ref)).toBe("sealed with c still seated");
  });

  it("a hand that holds no authority over the seat still rolls the content key: the seat stands in the group, and the successor leaves it out by name", async () => {
    const { group, devices: [f, b, c] } = await fleet(0x40, ["f", "b", "c"]);
    await seal(f!, "v1");
    await carry(f!, b!); await carry(f!, c!);
    // b sits beside c and seated nobody: its revoke meets `no-authority`, and the roll still comes.
    b!.raises.add("raise-1");
    const outcomes = await runSeatDuties(keyhiveSeatShore(b!.provider), [{ kind: "revoke", scope: SCOPE, edgeId: "edge-c", seat: { group, member: c!.id }, raiseCids: ["raise-1"], then: "leave-out" }], (r) => b!.rolls.announce(r));
    expect(outcomes.map((o) => o.did)).toEqual(["no-authority"]);
    expect((await b!.provider.verifyGroupMembership(c!.id, group)).ok).toBe(true);    // the seat still stands
    expect(b!.reports.map((r) => r.result)).toEqual(["rolled"]);
    const after = await seal(b!, "sealed by b after the raise");
    await carry(b!, f!); await carry(b!, c!);
    f!.raises.add("raise-1");
    await carry(b!, f!);
    expect(await opens(f!, after.body.ref)).toBe("sealed by b after the raise");
    expect(await opens(c!, after.body.ref)).toBe("REFUSED:reference-unknown");
  });

  it("a party this vessel's edge reading sets aside receives no key, whatever the group seats", async () => {
    const { devices: [f, b, c] } = await fleet(0x48, ["f", "b", "c"]);
    f!.standing.set(bare(c!.id), "aside");
    const sealed = await seal(f!, "c stands aside here");
    await carry(f!, b!); await carry(f!, c!);
    expect(await opens(b!, sealed.body.ref)).toBe("c stands aside here");
    expect(await opens(c!, sealed.body.ref)).toBe("REFUSED:bag-unfounded");
    // A seat that owes its roll leaves first: it receives no key either.
    const { devices: [f2, , c2] } = await fleet(0x4c, ["f", "b", "c"]);
    f2!.standing.set(bare(c2!.id), "owing");
    const owed = await seal(f2!, "c owes its roll");
    await carry(f2!, c2!);
    expect(await opens(c2!, owed.body.ref)).toBe("REFUSED:bag-unfounded");
  });

  it("A FAILED MINT COMES AGAIN: with no session signer the executor reads `undelivered` and marks nothing; the same duty then finds the seat gone and rolls", async () => {
    const { group, devices: [f, , c] } = await fleet(0x50, ["f", "b", "c"]);
    const v1 = await seal(f!, "v1");
    f!.raises.add("raise-1");
    f!.signs = false;
    const duty = { kind: "revoke" as const, scope: SCOPE, edgeId: "edge-c", seat: { group, member: c!.id }, raiseCids: ["raise-1"], then: "leave-out" as const };
    const first = await runSeatDuties(keyhiveSeatShore(f!.provider), [duty], (r) => f!.rolls.announce(r));
    expect(first.map((o) => `${o.did}:${o.marks.length}`)).toEqual(["undelivered:0"]);
    expect(first[0]!.said).toMatch(/mint-failed.*stays owed/);
    const held = await f!.seat.holder.reading(BAG);
    if ("refusal" in held) throw new Error(said(held));
    expect(held.foundings[0]!.heads).toEqual([v1.body.keyVersion]);              // nothing minted
    f!.signs = true;
    const again = await runSeatDuties(keyhiveSeatShore(f!.provider), [duty], (r) => f!.rolls.announce(r));
    expect(again.map((o) => `${o.did}:${o.marks.join(",")}`)).toEqual(["gone:raise-1"]);
    expect(f!.reports.map((r) => r.result)).toEqual(["mint-failed", "rolled"]);
    // A further repeat mints no second successor.
    await f!.rolls.announce(roll(["raise-1"], duty.seat, "gone"));
    expect(f!.reports.map((r) => r.result)).toEqual(["mint-failed", "rolled", "not-owed"]);
  });

  it("an Archive that will not rest fails the wrap, so the roll stays owed and nothing half-minted counts", async () => {
    const { group, devices: [f, , c] } = await fleet(0x58, ["f", "b", "c"]);
    await seal(f!, "v1");
    f!.raises.add("raise-1");
    let refuse = true;
    f!.seat.lock();
    f!.seat = seatContentKeys({
      providers: [f!.provider], rest: f!.rest, values: { read: async (a) => f!.values.get(a) ?? null, write: async (a, bytes) => { f!.values.set(a, bytes); } },
      restArchive: async (p) => { if (refuse) throw new Error("the custody seat refused the archive"); f!.archives.push(await (p as KeyhiveProvider).exportArchive()); },
      group: { groupId: group, scope: SCOPE }, bags: () => [BAG], standingOf: () => "clear", countedRaises: () => f!.raises,
      session: { signer: () => f!.signer, standing: { holdsWrite: () => true } }, report: (o) => { f!.reports.push(o); }, subscribe: (sink) => f!.rolls.subscribe(sink),
    });
    const lockboxes = (await new SealedStore(f!.rest).lockboxes()).length;
    await expect(f!.rolls.announce(roll(["raise-1"], { group, member: c!.id }, "gone"))).rejects.toThrow(/mint-failed/);
    expect((await new SealedStore(f!.rest).lockboxes()).length).toBe(lockboxes);   // no lockbox rested
    refuse = false;
    await f!.rolls.announce(roll(["raise-1"], { group, member: c!.id }, "gone"));
    expect(f!.reports.map((r) => r.result)).toEqual(["mint-failed", "rolled"]);
  });
});

describe("sibling successors, the hand-over and the kept rolls, on real identities", () => {
  it("two vessels that answer one raise mint siblings; both stand until a writer that holds both joins them", async () => {
    const { group, devices: [f, b, c] } = await fleet(0x60, ["f", "b", "c"]);
    await seal(f!, "v1");
    await carry(f!, b!);
    f!.raises.add("raise-1"); b!.raises.add("raise-1");
    const named = { group, member: c!.id };
    await f!.rolls.announce(roll(["raise-1"], named, "revoked"));
    await b!.rolls.announce(roll(["raise-1"], named, "no-authority"));
    expect(f!.reports[0]!.keyVersion).not.toBe(b!.reports[0]!.keyVersion);
    await carry(b!, f!); await carry(f!, b!);
    const fork = await f!.seat.holder.reading(BAG);
    if ("refusal" in fork) throw new Error(said(fork));
    expect(fork.foundings[0]!.forked).toBe(true);
    expect(fork.foundings[0]!.heads.length).toBe(2);
    const joined = await seal(f!, "sealed under the join");
    expect(joined.joined).toBeDefined();
    await carry(f!, b!); await carry(f!, c!);
    expect(await opens(b!, joined.body.ref)).toBe("sealed under the join");
    expect(await opens(c!, joined.body.ref)).toBe("REFUSED:reference-unknown");
  });

  it("FROM NOW and WITH ITS PAST: a device seated later opens no earlier version, until a holder hands a shareable span over by an explicit act; a closed span refuses", async () => {
    const { group, devices: [f, n], ship } = await fleet(0x70, ["f", "n"]);
    // n's seat leaves and returns: it holds no key of the span it missed.
    const late = n!;
    const open = await seal(f!, "written in a shareable span", "shareable");
    // n was seated when the founding wrapped, so stand a device that was not: seat x after the wrap.
    const xEvents = new InMemoryEventStore();
    const xProvider = new KeyhiveProvider();
    await xProvider.init({ seed: new Uint8Array(32).fill(0x7e), eventStore: xEvents });
    await xProvider.receiveContactCard(await f!.provider.contactCard());
    await f!.provider.receiveContactCard(await xProvider.contactCard());
    const xId = await xProvider.vesselIdentifierHex();
    await f!.provider.addGroupMember(xId, group);
    await xProvider.ingestPeerEvents(await f!.provider.eventsForPeer(xId));
    const xChain = await chain("x-70", NEXUS);
    const x = {
      rest: memorySealedStoreRest(), values: new Map<SealedAddress, Uint8Array>(),
      seat: undefined as unknown as ContentKeySeat,
    };
    x.seat = seatContentKeys({
      providers: [xProvider], rest: x.rest, values: { read: async (a) => x.values.get(a) ?? null, write: async (a, bytes) => { x.values.set(a, bytes); } },
      restArchive: async () => {}, group: { groupId: group, scope: SCOPE }, bags: () => [BAG], standingOf: () => "clear",
      session: { signer: () => ({ certificate: xChain.sessionCertificate, sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, xChain.scope, xChain.sessionCertificate.sessionKey, payload), xChain.session) }) }), standing: { holdsWrite: () => true } },
      subscribe: () => () => {},
    });
    void late; void ship;
    // FROM NOW: x holds every lockbox and opens none of the earlier version.
    const parcels = await f!.seat.holder.parcelsFor({ bagId: BAG, reader: xId });
    if (!Array.isArray(parcels)) throw new Error("setup");
    for (const [address, bytes] of f!.values) x.values.set(address, bytes);
    await x.seat.holder.receive({ parcels, records: await new SealedStore(f!.rest).records("manifest") });
    const blind = await x.seat.holder.openBlob({ bagId: BAG, ref: open.body.ref });
    expect(said(blind)).toBe("bag-unfounded");
    // WITH ITS PAST, by an explicit act.
    const handed = await f!.seat.holder.handOver({ bagId: BAG, reader: xId, signer: f!.signer });
    if ("refusal" in handed) throw new Error(said(handed));
    expect(handed.record.body.versions).toEqual([open.body.keyVersion]);
    expect(hex(handed.record.sealed).includes(hex(utf8Bytes(bare(xId))))).toBe(false);
    await x.seat.holder.receive({ parcels: handed.parcels, records: [handed.record] });
    const read = await x.seat.holder.openBlob({ bagId: BAG, ref: open.body.ref });
    expect("plaintext" in read ? text(read.plaintext) : said(read)).toBe("written in a shareable span");

    // A CLOSED span refuses the same act by name, and wraps nothing.
    const { devices: [g, m] } = await fleet(0x78, ["g", "m"]);
    await seal(g!, "written in a closed span");
    const lockboxes = (await new SealedStore(g!.rest).lockboxes()).length;
    expect(said(await g!.seat.holder.handOver({ bagId: BAG, reader: m!.id, signer: g!.signer }))).toBe("history-closed");
    expect((await new SealedStore(g!.rest).lockboxes()).length).toBe(lockboxes);
  });

  it("the kept rolls come again under the vessel's own receipt: a forged roll moves nothing, a kept one rolls what it still owes", async () => {
    const { group, devices: [f, , c] } = await fleet(0x80, ["f", "b", "c"]);
    await seal(f!, "v1");
    const vessel = await pair("vessel-80");
    const vesselKey = vessel.key;
    const kept = await signSeatRoll(roll(["raise-1"], { group, member: c!.id }, "revoked"), ed25519SignerFromSeed(vessel.secret));
    const forged = { ...kept, raiseCids: ["raise-2"] };
    const took = await f!.seat.catchUp([forged, kept, { nonsense: true }], vesselKey);
    expect(took).toEqual({ taken: 1, refused: 2, owed: [] });
    expect(f!.reports.map((r) => `${r.result}:${r.raises.join(",")}`)).toEqual(["rolled:raise-1"]);
    // The same kept roll again owes nothing.
    expect(await f!.seat.catchUp([kept], vesselKey)).toEqual({ taken: 1, refused: 0, owed: [] });
    expect(f!.reports.map((r) => r.result)).toEqual(["rolled", "not-owed"]);
    // A receipt under another key moves nothing.
    expect(await f!.seat.catchUp([kept], "cd".repeat(32))).toEqual({ taken: 0, refused: 1, owed: [] });
  });
});

describe("a vessel with no face names no key group", () => {
  it("its keys wrap for its own identities alone: a seated device of the same fleet opens nothing, and the vessel itself opens", async () => {
    const { devices: [f, b] } = await fleet(0xa0, ["f", "b"]);
    f!.seat.lock();
    f!.seat = seatContentKeys({
      providers: [f!.provider], rest: f!.rest, values: { read: async (a) => f!.values.get(a) ?? null, write: async (a, bytes) => { f!.values.set(a, bytes); } },
      restArchive: async () => {}, group: null, bags: () => [BAG], standingOf: () => "clear",
      session: { signer: () => f!.signer, standing: { holdsWrite: () => true } }, subscribe: (sink) => f!.rolls.subscribe(sink),
    });
    const sealed = await seal(f!, "for this vessel alone");
    expect(sealed.founded!.unserved).toEqual([]);                    // nobody named, so nobody went unserved
    expect(await opens(f!, sealed.body.ref)).toBe("for this vessel alone");
    await carry(f!, b!);
    expect(await opens(b!, sealed.body.ref)).toBe("REFUSED:bag-unfounded");
    // A seat with a face and NO reader of its fleet's standing reads every other seat as set aside: same result.
    const { group: g2, devices: [f2, b2] } = await fleet(0xa8, ["f", "b"]);
    f2!.seat.lock();
    f2!.seat = seatContentKeys({
      providers: [f2!.provider], rest: f2!.rest, values: { read: async (a) => f2!.values.get(a) ?? null, write: async (a, bytes) => { f2!.values.set(a, bytes); } },
      restArchive: async () => {}, group: { groupId: g2, scope: SCOPE }, bags: () => [BAG],
      session: { signer: () => f2!.signer, standing: { holdsWrite: () => true } }, subscribe: (sink) => f2!.rolls.subscribe(sink),
    });
    const alone = await seal(f2!, "no standing reader composed");
    await carry(f2!, b2!);
    expect(await opens(b2!, alone.body.ref)).toBe("REFUSED:bag-unfounded");
    // And a roll for any scope reaches no bag of a faceless vessel.
    await f!.rolls.announce(roll(["raise-1"], undefined, "gone"));
    const reading = await f!.seat.holder.reading(BAG);
    if ("refusal" in reading) throw new Error(said(reading));
    expect(reading.foundings[0]!.held).toEqual([sealed.body.keyVersion]);
  });
});

describe("the production seam", () => {
  it("with no `subscribe` handed in, the seat subscribes to this island's own seat rolls: `announceSeatRoll` reaches it, and `lock` unsubscribes", async () => {
    const { group, devices: [f, , c] } = await fleet(0x90, ["f", "b", "c"]);
    for (const d of [f!]) d.seat.lock();
    const reports: RollOutcome[] = [];
    const seat = seatContentKeys({
      providers: [f!.provider], rest: f!.rest, values: { read: async (a) => f!.values.get(a) ?? null, write: async (a, bytes) => { f!.values.set(a, bytes); } },
      restArchive: async () => {}, group: { groupId: group, scope: SCOPE }, bags: () => [BAG], standingOf: () => "clear",
      session: { signer: () => f!.signer, standing: { holdsWrite: () => true } }, report: (o) => { reports.push(o); },
    });
    const sealed = await seat.holder.sealBlob({ bagId: BAG, plaintext: utf8Bytes("v1"), signer: f!.signer });
    expect(said(sealed)).toBe("OK");
    await announceSeatRoll(roll(["raise-1"], { group, member: c!.id }, "gone"));
    expect(reports.map((r) => r.result)).toEqual(["rolled"]);
    seat.lock();
    await announceSeatRoll(roll(["raise-2"], { group, member: c!.id }, "gone"));
    expect(reports.length).toBe(1);                                   // no subscriber stands after the lock
  });

  it("NOTHING WAITS ON A CLOCK: the seat, the holder, the wrap and the store read no clock and no timer", () => {
    const files = [
      join(import.meta.dirname, "../src/content-key-seat.ts"), join(import.meta.dirname, "../src/keyhive-lockbox.ts"),
      join(import.meta.dirname, "../../lararium-mesh/src/content-key-holder.ts"), join(import.meta.dirname, "../../lararium-mesh/src/lockbox-wrap.ts"),
      join(import.meta.dirname, "../../lararium-mesh/src/sealed-store-rest.ts"),
    ];
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      const code = raw.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
      expect(code.length, file).toBeGreaterThan(1000);
      expect(code.length, file).toBeLessThan(raw.length);
      expect(code, file).not.toMatch(/\bDate\b|\bsetTimeout\b|\bsetInterval\b|\bperformance\b|Math\.random/);
    }
    // CONTROL: the same pattern bites a line that does read a clock.
    expect("const now = Date.now();").toMatch(/\bDate\b/);
  });
});
