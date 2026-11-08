/**
 * THE COMMIT BOUNDARY around the authority mutation. `absorbCapEvents` hands a grant's cap events to Keyhive, and Keyhive
 * changes membership inside that call, before any await of the caller returns; a check after the await reads a mutation
 * already made. So the reading's own guard rides INTO the absorb and is asked synchronously at the boundary, immediately
 * before the mutation: a reading a proof change overtook mutates nothing and persists nothing, and the seat's queued pass
 * reads again. A change that lands after the boundary meets a membership already committed (set-aside of a seated joinee
 * rides its own dyad and the census, never a seat rollback).
 */
import { describe, expect, test } from "vitest";
import { buildDeviceDelegation } from "@lararium/mesh";
import { KeyhiveProvider } from "../src/keyhive-provider.js";
import { runFaceJoin, type FaceJoinContext } from "../src/face-join.js";
import { absorbCapEvents, type CapEventSink } from "../src/daemon-event-store.js";
import { makeFaceSeat } from "../src/face-seat.js";
import { FACE_GRANT_PREFIX, type FaceGrantRecord } from "../src/face-grant-record.js";
import type { EventRecord, EventStore } from "../src/event-store.js";

const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const b64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));

function recordingStore(): EventStore & { rows: EventRecord[] } {
  const rows: EventRecord[] = [];
  return { rows, put: async (rec) => { rows.push(rec); }, list: async () => rows };
}

/** A founder standing a face, the crossing it packs for a joinee, and the joinee stood to take it. */
async function crossing() {
  const noop = { put: async (): Promise<void> => {}, list: async (): Promise<readonly EventRecord[]> => [] };
  const phone = new KeyhiveProvider();
  await phone.init({ seed: seedOf(71), eventStore: noop });
  const laptopSeed = seedOf(72);
  const laptop = new KeyhiveProvider();
  await laptop.init({ seed: laptopSeed, eventStore: noop });
  const pg = await phone.createGroup();
  const edge = await buildDeviceDelegation({ personaRootSeed: seedOf(214), atomSeed: laptopSeed, hearthTrueName: "", boundEpoch: 0 });
  const ctx: FaceJoinContext = { personaRootDid: edge.personaRootDid, hearthTrueName: "", personaGroupId: pg.groupId, dyad: () => "clear", leaseEpoch: 0 };
  const out = await runFaceJoin(phone, { kind: "face-join/v1", contactCard: new TextDecoder().decode(await laptop.contactCard()), deviceEdge: edge }, ctx);
  if (!out.ok) throw new Error(`the fixture's own join failed: ${JSON.stringify(out)}`);
  await laptop.dispose();
  const store = recordingStore();
  const kh = new KeyhiveProvider();
  await kh.init({ seed: laptopSeed, eventStore: store });
  await kh.receiveContactCard(new TextEncoder().encode(out.grant.founderCard));
  const before = store.rows.length;
  return { kh, store, before, group: pg.groupId, events: out.grant.capEvents.map(b64), dispose: async () => { await kh.dispose(); await phone.dispose(); } };
}

describe("absorbCapEvents asks the reading's guard at the boundary", () => {
  test("an overtaken reading mutates no membership and persists nothing", async () => {
    const c = await crossing();
    try {
      await expect(absorbCapEvents(c.kh, c.store, c.events, { admit: () => false })).rejects.toThrow(/overtaken/);
      expect(await c.kh.knowsAgent(c.group), "Keyhive took no membership").toBe(false);
      expect(c.store.rows.length, "no crossing row persisted").toBe(c.before);
    } finally { await c.dispose(); }
  });

  test("CONTROL: a standing reading takes the crossing", async () => {
    const c = await crossing();
    try {
      await absorbCapEvents(c.kh, c.store, c.events, { admit: () => true });
      expect(await c.kh.knowsAgent(c.group)).toBe(true);
    } finally { await c.dispose(); }
  });
});

describe("the seat hands its reading's guard to the ingest", () => {
  /** A seat whose ingest port opens its store across one await before it absorbs: the window the guard must close. */
  const exercise = async (changeDuringOpen: boolean) => {
    let standing: "clear" | "aside" = "clear";
    let mutations = 0, known = false;
    let release!: () => void, opening!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const opened = new Promise<void>((r) => { opening = r; });
    const sink: CapEventSink = { ingestPeerEvents: async () => { mutations++; known = true; }, settleEvents: async () => {} };
    const seat = makeFaceSeat({
      group: "group", selfVerifyingKey: "abcd", personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
      knowsAgent: async () => known,
      grants: async () => [{ title: `${FACE_GRANT_PREFIX}group/abcd`, record: { sig: "sig", capEvents: [], founderEdge: { deviceVerifyingKey: "founder" } } as unknown as FaceGrantRecord }],
      founderStanding: async () => standing,
      verify: async (_record, context) => context.dyad?.("founder") === "aside" ? { ok: false, reason: "aside" } : { ok: true },
      ingest: async (record, admit) => {
        if (mutations === 0) { opening(); await gate; }
        await absorbCapEvents(sink, recordingStore(), record.capEvents.map(b64), { admit });
      },
      lift: async () => {}, log: () => {},
    });
    const run = seat.run();
    await opened;
    if (changeDuringOpen) { standing = "aside"; seat.daemonChanged("fleet-board"); }
    release();
    await run; await seat.settled();
    return { mutations, known };
  };

  test("an aside that lands between the seat's check and the mutation mutates nothing", async () => {
    expect(await exercise(true)).toEqual({ mutations: 0, known: false });
  });

  test("CONTROL: with no change in the window the grant lands once", async () => {
    expect(await exercise(false)).toEqual({ mutations: 1, known: true });
  });
});
