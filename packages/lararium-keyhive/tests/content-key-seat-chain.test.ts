/**
 * content-key-seat-chain — the seat under the PRODUCTION standing (`ownChainStanding`): the vessel's own chain stands
 * only once a session asked, and the owed raises outlive an island restart.
 *
 * The collided cold read of the custody train (2026-10-31, `cold-t2/blind.md`, H1 and H2) measured both holes with
 * every earlier seat suite blind to them: each stood its seat on `holdsWrite: () => true`.
 *   · H1: a roll that reaches the holder before any session asked read every record as not capable, settled as
 *     `bag-unfounded`, and a later seal rode the pre-removal head: the removed device opened it.
 *   · H2: the owed list lived in memory alone, so a restart forgot it.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store · lar:///ha.ka.ba/lares/api/pono/kapae#/keys
 */
import { describe, expect, it } from "vitest";
import {
  ScriptedSeatRolls, SealedStore, memorySealedStoreRest, utf8Bytes,
  type RecordSigner, type RollOutcome, type SealedAddress, type SealedStoreRest, type SeatRoll, type SessionOwnChain,
} from "@lararium/mesh";
import { KeyhiveProvider, InMemoryEventStore, seatContentKeys, ownChainStanding, type ContentKeySeat } from "../src/index.js";
import { sessionSignatureImage } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain, signHex } from "../../lararium-mesh/tests/face-proof-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/garden-notes";
const SCOPE = "ab".repeat(32);
const NEXUS = "nexus-test-one";
const text = (b: Uint8Array) => new TextDecoder().decode(b);
const said = (r: object): string => ("refusal" in r ? `${(r as { refusal: string }).refusal}${(r as { cause?: string }).cause ? `:${(r as { cause?: string }).cause}` : ""}` : "OK");
const bare = (id: string) => id.toLowerCase().replace(/^0x/, "");

interface Device {
  provider: KeyhiveProvider; id: string; rest: SealedStoreRest; values: Map<SealedAddress, Uint8Array>;
  signer: RecordSigner; own: SessionOwnChain; chainNow: SessionOwnChain | null; hostile: boolean;
  /** The vessel's durable reading: raises it counts on the board that no subscriber has yet taken (no ledger mark). */
  unanswered: Set<string>;
  rolls: ScriptedSeatRolls; standing: Map<string, string>; reports: RollOutcome[]; seat: ContentKeySeat; reseat(): ContentKeySeat;
}

async function fleet(base: number, n: number) {
  const ds: Device[] = [];
  let group = "";
  for (let i = 0; i < n; i++) {
    const provider = new KeyhiveProvider();
    await provider.init({ seed: new Uint8Array(32).fill(base + i), eventStore: new InMemoryEventStore() });
    const c = await chain(`d${i}-${base}`, NEXUS);
    const signer: RecordSigner = { certificate: c.sessionCertificate, sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }) };
    const d: Device = {
      provider, id: await provider.vesselIdentifierHex(), rest: memorySealedStoreRest(), values: new Map(), signer,
      own: { scope: { faceKey: c.scope.faceKey, nexus: c.scope.nexus }, vesselFaceKey: c.sessionCertificate.vesselFaceKey }, chainNow: null, hostile: false,
      unanswered: new Set(), rolls: new ScriptedSeatRolls(), standing: new Map(), reports: [], seat: undefined as never,
      reseat() {
        d.seat?.lock();
        d.seat = seatContentKeys({
          providers: [d.provider], rest: d.rest,
          values: { read: async (a) => d.values.get(a) ?? null, write: async (a, b) => { d.values.set(a, Uint8Array.from(b)); } },
          restArchive: async () => {}, group: { groupId: group, scope: SCOPE }, bags: () => [BAG],
          standingOf: async (m) => (d.standing.get(bare(m)) ?? "clear") as never,
          unansweredRaises: () => [...d.unanswered],
          // THE PRODUCTION SHAPE: no seat signer, and the standing reads the chain the last session carried.
          session: { signer: () => null, standing: d.hostile ? { holdsWrite: () => true } : ownChainStanding(() => d.chainNow, () => [BAG]) },
          report: (o) => { d.reports.push(o); }, subscribe: (s) => d.rolls.subscribe(s),
        });
        return d.seat;
      },
    };
    ds.push(d);
  }
  for (const a of ds) for (const b of ds) if (a !== b) await a.provider.receiveContactCard(await b.provider.contactCard());
  group = (await ds[0]!.provider.createGroup()).groupId;
  for (const d of ds.slice(1)) await ds[0]!.provider.addGroupMember(d.id, group);
  for (const d of ds.slice(1)) await d.provider.ingestPeerEvents(await ds[0]!.provider.eventsForPeer(d.id));
  for (const d of ds) d.reseat();
  return { group, ds };
}
async function carry(from: Device, to: Device): Promise<void> {
  const parcels = await from.seat.holder.parcelsFor({ bagId: BAG, reader: to.id });
  if (!Array.isArray(parcels)) throw new Error(`parcelsFor ${said(parcels as object)}`);
  const store = new SealedStore(from.rest);
  for (const [a, b] of from.values) to.values.set(a, Uint8Array.from(b));
  const took = await to.seat.holder.receive({ parcels, records: [...await store.records("manifest"), ...await store.records("hand-over")] });
  if ("refusal" in took) throw new Error(`receive ${said(took)}`);
}
const removal = (group: string, member: string): SeatRoll => ({ kind: "seat-roll", scope: SCOPE, edgeId: "edge-c", seat: { group, member }, raiseCids: ["raise-1"], how: "revoked" } as never);
/** The vessel counts c's removal: the board sets c aside and the raise stands unanswered until a subscriber takes it. */
function counts(f: Device, c: Device): void { f.standing.set(bare(c.id), "aside"); f.unanswered.add("raise-1"); }
/** Deliver the roll as the seat settler does; a delivery the seat takes marks the raise answered in the ledger. */
async function deliver(f: Device, group: string, c: Device): Promise<"owed" | "settled"> {
  try { await f.rolls.announce(removal(group, c.id)); f.unanswered.delete("raise-1"); return "settled"; } catch { return "owed"; }
}
/** The removed device runs its own code: it holds the old key and verifies nothing it need not. */
async function hostileOpens(c: Device, f: Device, ref: string): Promise<string> {
  c.hostile = true; c.reseat();
  await carry(f, c).catch(() => undefined);
  const r = await c.seat.holder.openBlob({ bagId: BAG, ref });
  return "plaintext" in r ? text(r.plaintext) : `REFUSED:${said(r)}`;
}

describe("H1 · a roll that reaches the holder before any session asked", () => {
  it("RED: with no chain standing, the roll stays owed (never `bag-unfounded`); the session's seal then settles onto a NEW version, the old body opens, no rival founds, and the removed device opens nothing new", async () => {
    const { group, ds: [f, c] } = await fleet(0xa1, 2);
    f!.chainNow = f!.own;
    const before = await f!.seat.seal({ bagId: BAG, plaintext: utf8Bytes("before c left"), signer: f!.signer });
    if ("refusal" in before) throw new Error(said(before));
    await carry(f!, c!);
    // RESTART: a fresh island, and no session has asked yet.
    f!.chainNow = null; f!.reseat();
    counts(f!, c!);
    expect(await deliver(f!, group, c!)).toBe("owed");
    expect(f!.reports.map((r) => r.result)).not.toContain("bag-unfounded");
    expect(f!.seat.owedFor(BAG)).toEqual(["raise-1"]);
    // A session asks.
    f!.chainNow = f!.own;
    const after = await f!.seat.seal({ bagId: BAG, plaintext: utf8Bytes("SECRET after c left"), signer: f!.signer });
    if ("refusal" in after) throw new Error(said(after));
    expect(after.founded).toBeUndefined();
    expect(after.body.keyVersion).not.toBe(before.body.keyVersion);
    const old = await f!.seat.holder.openBlob({ bagId: BAG, ref: before.body.ref });
    expect("plaintext" in old ? text(old.plaintext) : said(old)).toBe("before c left");
    expect(await hostileOpens(c!, f!, after.body.ref)).toMatch(/^REFUSED:/);
  });

  it("CONTROL: with the chain standing before the roll arrives, the session's seal lands on the successor", async () => {
    const { group, ds: [f, c] } = await fleet(0xa5, 2);
    f!.chainNow = f!.own;
    const before = await f!.seat.seal({ bagId: BAG, plaintext: utf8Bytes("before"), signer: f!.signer });
    if ("refusal" in before) throw new Error(said(before));
    counts(f!, c!);
    expect(await deliver(f!, group, c!)).toBe("owed");             // no seat signer: the roll waits for a session
    const after = await f!.seat.seal({ bagId: BAG, plaintext: utf8Bytes("after"), signer: f!.signer });
    if ("refusal" in after) throw new Error(said(after));
    expect(after.body.keyVersion).not.toBe(before.body.keyVersion);
  });
});

describe("H2 · the owed raises outlive an island restart", () => {
  it("RED: owed, then a restart: the seat still names the raise, a seal refuses `roll-owed` until the roll comes again, then the session settles it and seals on a NEW version", async () => {
    const { group, ds: [f, c] } = await fleet(0xb1, 2);
    f!.chainNow = f!.own;
    const before = await f!.seat.seal({ bagId: BAG, plaintext: utf8Bytes("before c left"), signer: f!.signer });
    if ("refusal" in before) throw new Error(said(before));
    await carry(f!, c!);
    counts(f!, c!);
    expect(await deliver(f!, group, c!)).toBe("owed");
    f!.reseat();                                                   // island restart
    expect(await f!.seat.owedNow(BAG)).toEqual(["raise-1"]);
    const early = await f!.seat.seal({ bagId: BAG, plaintext: utf8Bytes("SECRET early"), signer: f!.signer });
    expect("refusal" in early && early.refusal).toBe("roll-owed");
    expect(await deliver(f!, group, c!)).toBe("owed");             // the settler brings the roll again
    const after = await f!.seat.seal({ bagId: BAG, plaintext: utf8Bytes("SECRET after c left"), signer: f!.signer });
    if ("refusal" in after) throw new Error(said(after));
    expect(after.body.keyVersion).not.toBe(before.body.keyVersion);
    expect(await hostileOpens(c!, f!, after.body.ref)).toMatch(/^REFUSED:/);
  });

  it("CONTROL: with no raise counted, a restart leaves the seal on the same version", async () => {
    const { ds: [f] } = await fleet(0xb5, 2);
    f!.chainNow = f!.own;
    const before = await f!.seat.seal({ bagId: BAG, plaintext: utf8Bytes("before"), signer: f!.signer });
    if ("refusal" in before) throw new Error(said(before));
    f!.reseat();
    expect(await f!.seat.owedNow(BAG)).toEqual([]);
    const after = await f!.seat.seal({ bagId: BAG, plaintext: utf8Bytes("after"), signer: f!.signer });
    if ("refusal" in after) throw new Error(said(after));
    expect(after.body.keyVersion).toBe(before.body.keyVersion);
  });
});
