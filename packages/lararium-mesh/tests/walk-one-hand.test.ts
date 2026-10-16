/**
 * walk-one-hand.test.ts — a walk record changes under ONE hand at a time, and a store that refuses costs one message.
 *
 * The walk client changes a record through the store's `update` alone: the store reads the standing record, the
 * client decides over it, the store writes. Each vector pins ONE interleaving by a handshake with the store: the
 * site's update ARRIVES and waits, another hand changes the record whole, and the update is RELEASED. No vector
 * reads a clock or waits on the machine.
 *
 * ONE HAND (each site against a hand-out or a grant landing between its read and its write):
 *   · H1 take: a grant that lands while an invite is taken stays kept beside the invite;
 *   · H2 grant: an invite handed out while a grant lands stays out of the wallet, and no second hand-out answers it;
 *   · H3 settle: the same, while the invite settles;
 *   · H4 fill: the same, while the wallet's batch goes pending;
 *   · H5 minted: the same, while the hearth's answer finalizes; and a second answer to one batch adds no token;
 *   · H6 hand-out: two hand-outs over one token answer it once;
 *   · H7 carry: the same, while a carriage receipt lands; a record that left meanwhile takes no receipt;
 *   · H8 notice: the same, while the hearth's notice marks the record.
 * A STORE THAT REFUSES:
 *   · F1 grant · F2 settle · F3 minted · F4 notice: the refusal reaches `onFault` naming the message, nothing floats,
 *     and the walk keeps the next message (CONTROL);
 *   · F5: a transport that refuses the re-presentation reaches `onFault` the same way;
 *   · F6: a fault port that throws costs nothing further;
 *   · F7: a fetch whose store refuses rejects to the caller that awaits it;
 *   · F8: a hand-out whose store refuses rejects, and no token leaves.
 * A RECORD READS WHOLE:
 *   · R1: `isWalkRecord` accepts a whole record and refuses each malformed field by itself.
 */
import { describe, test, expect } from "vitest";
import {
  mintHostingAct, mintHostToken, issueGrant, evaluateWalkerBatch, decodeInvite, encodeInvite, hostingActCid,
  type HostingEpoch, type HostingGrant, type InviteToken,
} from "../src/hosting.js";
import {
  walkOver, popInvite, takeInvite, isWalkRecord, tellWalkFault,
  HOSTING_GRANT_SESSION_KIND, HOSTING_MINT_SESSION_KIND, HOSTING_MINTED_SESSION_KIND,
  type WalkFault, type WalkRecord, type WalkStore,
} from "../src/walk-client.js";
import { carryDocument, fetchDocument, watchCarryNotice, HOSTING_CARRY_SESSION_KIND, HOSTING_FETCH_SESSION_KIND, HOSTING_FETCHED_SESSION_KIND, HOSTING_NOTICE_SESSION_KIND } from "../src/walk-carry.js";
import type { LarSessionMsg, LeafIdentity } from "../src/leaf-presentation.js";

const AID = "nexus-" + "a".repeat(64);
const GATE = "ee".repeat(32);
const HEARTH = new Uint8Array(32).fill(51);
// A REAL verifying key (RFC 8032 §7.1): a grant names only a walker leaf the Ed25519 door accepts.
const LEAF = { verifyingKey: "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a", seed: new Uint8Array(32).fill(52) };
const BASE: LeafIdentity = { contactCard: "d".repeat(64), peerPubKey: "d".repeat(64), sign: async () => "00".repeat(64) };

class StoreLocked extends Error { override readonly name = "StoreLocked"; }

interface Handshake { readonly arrived: Promise<void>; release(): void }
function latch(): { readonly wait: Promise<void>; open(): void } {
  let open!: () => void;
  const wait = new Promise<void>((r) => { open = r; });
  return { wait, open };
}

/**
 * An in-memory walk store whose `update` reads, decides and writes with no await between: its own lock. A test may
 * HOLD its n-th coming update before that read (`holdUpdate`), count updates that returned (`returned`), and make
 * the store refuse (`refuse`).
 */
function testStore(seed?: WalkRecord) {
  const map = new Map<string, WalkRecord>();
  if (seed) map.set(GATE, structuredClone(seed));
  let calls = 0;
  let done = 0;
  const holds = new Map<number, { readonly arrived: ReturnType<typeof latch>; readonly released: ReturnType<typeof latch> }>();
  const waiters: Array<{ readonly n: number; readonly open: () => void }> = [];
  let refusal: { readonly reads: boolean; readonly updates: boolean } = { reads: false, updates: false };
  const store: WalkStore = {
    async read(g) {
      if (refusal.reads) throw new StoreLocked("the store's key rests unopened");
      return map.get(g) ?? null;
    },
    async update(g, decide) {
      const held = holds.get(++calls);
      try {
        if (held) { held.arrived.open(); await held.released.wait; }
        if (refusal.updates) throw new StoreLocked("the store's key rests unopened");
        const next = decide(map.get(g) ?? null);
        if (next) map.set(g, structuredClone(next));
        return next;
      } finally {
        done++;
        for (const w of waiters.splice(0)) { if (done >= w.n) w.open(); else waiters.push(w); }
      }
    },
  };
  return {
    store, map,
    now: (): WalkRecord => map.get(GATE)!,
    /** Hold the n-th update from here (1 = the next one) before it reads. */
    holdUpdate(n = 1): Handshake {
      const h = { arrived: latch(), released: latch() };
      holds.set(calls + n, h);
      return { arrived: h.arrived.wait, release: () => h.released.open() };
    },
    /** Resolves once `n` more updates returned (wrote, declined or refused). */
    returned(n: number): Promise<void> {
      const target = done + n;
      const l = latch();
      waiters.push({ n: target, open: l.open });
      return l.wait;
    },
    refuse(what: { readonly reads?: boolean; readonly updates?: boolean }): void { refusal = { reads: what.reads === true, updates: what.updates === true }; },
  };
}

/** A walker riding an in-memory transport: frames in, proven peers in, sends, re-presentations and faults out. */
function ride(store: WalkStore, opts: { readonly epoch?: HostingEpoch; readonly presented?: HostingGrant; readonly representThrows?: boolean } = {}) {
  const session: Array<(m: LarSessionMsg) => void> = [];
  const candidates: Array<(e: { peerId: unknown }) => void> = [];
  const sent: Array<{ readonly kind: string; readonly body: unknown }> = [];
  const represented: LeafIdentity[] = [];
  const faults: WalkFault[] = [];
  let faultWaiter: (() => void) | null = null;
  let sendWaiter: (() => void) | null = null;
  const onFault = (fault: WalkFault): void => { faults.push(fault); faultWaiter?.(); faultWaiter = null; };
  const transport = {
    onSession: (l: (m: LarSessionMsg) => void) => { session.push(l); return () => {}; },
    sendSession: (kind: string, body: unknown) => { sent.push({ kind, body }); sendWaiter?.(); sendWaiter = null; return true; },
    represent: (identity: LeafIdentity) => { if (opts.representThrows) throw new Error("the socket closed"); represented.push(identity); },
    on: (_e: "peer-candidate", l: (e: { peerId: unknown }) => void) => { candidates.push(l); },
    identity: { ...BASE, ...(opts.presented ? { presented: { kind: "grant" as const, grant: opts.presented } } : {}) } as LeafIdentity,
  };
  const epoch = opts.epoch;
  walkOver({
    transport, store, gatePubKey: GATE, leaf: LEAF, base: BASE, onFault,
    ...(epoch ? { actFor: async (cid: string) => (hostingActCid(epoch.act) === cid ? epoch.act : null) } : {}),
  });
  return {
    transport, sent, represented, faults, onFault,
    frame(kind: string, body: unknown): void { for (const l of session) l({ type: "lar:session", kind, body }); },
    proven(): void { for (const l of candidates) l({ peerId: "hearth" }); },
    nextFault(): Promise<void> { return new Promise((r) => { faultWaiter = r; }); },
    nextSend(): Promise<void> { return new Promise((r) => { sendWaiter = r; }); },
  };
}

async function hearth(): Promise<{ readonly epoch: HostingEpoch; readonly grant: HostingGrant; readonly T: InviteToken }> {
  const epoch = await mintHostingAct({ leafSeed: HEARTH, nexusAid: AID, prev: null, cap: 3 });
  const grant = issueGrant(epoch, { leaf: LEAF.verifyingKey, lineage: "1".repeat(64), survived: 0, from: "host" });
  return { epoch, grant, T: mintHostToken(epoch) };
}
const carriedInvite = (token: InviteToken): string => encodeInvite({ nexusAid: AID, gatePubKey: GATE, token });

/** The token left the wallet once: the record holds it nowhere, and the next hand-out answers none. */
async function expectHandedOnce(s: ReturnType<typeof testStore>, first: string | null, T: InviteToken): Promise<void> {
  expect(decodeInvite(first!)!.token).toEqual(T);
  expect((s.now().wallet ?? []).map((w) => w.token.n)).not.toContain(T.n);
}

describe("one hand at a time: a site's update decides over the record as it stands at the write", () => {
  test("H1 take: a take decides over the record as it stands, so a grant or a receipt that lands meanwhile stays kept", async () => {
    const { epoch, grant, T } = await hearth();
    const receipt = { cid: "blake3:" + "d".repeat(64), ref: "c".repeat(64), key: "e".repeat(64) };
    // A receipt lands while a walker with an unsettled invite takes a fresh one: the record keeps both.
    const older = carriedInvite(mintHostToken(epoch));
    const s = testStore({ nexusAid: AID, relay: "ws://hearth.example/ws", invite: older, grant });
    const held = s.holdUpdate();
    const taking = takeInvite(s.store, carriedInvite(T));
    await held.arrived;
    s.map.set(GATE, { ...s.now(), carried: [receipt] });                        // the other hand: a receipt lands whole
    held.release();
    const taken = await taking;
    expect(s.now()).toEqual({ nexusAid: AID, relay: "ws://hearth.example/ws", invite: carriedInvite(T), grant, carried: [receipt] });
    expect(taken!.record).toEqual(s.now());
    // A grant settles while a walker with no grant takes an invite: the walker already walks there, and the take
    // answers the settled record and writes nothing over it.
    const s2 = testStore({ nexusAid: AID });
    const held2 = s2.holdUpdate();
    const taking2 = takeInvite(s2.store, carriedInvite(T));
    await held2.arrived;
    s2.map.set(GATE, { nexusAid: AID, grant });
    held2.release();
    expect((await taking2)!.record).toEqual({ nexusAid: AID, grant });
    expect(s2.now()).toEqual({ nexusAid: AID, grant });
    // An invite for another Nexus at a hearth already walked at keeps nothing: one record names one Nexus.
    const elsewhere = encodeInvite({ nexusAid: "nexus-" + "b".repeat(64), gatePubKey: GATE, token: T });
    const s3 = testStore({ nexusAid: AID, invite: older, grant });
    expect(await takeInvite(s3.store, elsewhere)).toBeNull();
    expect(s3.now()).toEqual({ nexusAid: AID, invite: older, grant });
  });

  test("H2 grant: an invite handed out while a grant lands stays out, and no second hand-out answers it", async () => {
    const { grant, T } = await hearth();
    const s = testStore({ nexusAid: AID, wallet: [{ epoch: grant.epoch, token: T }] });
    const w = ride(s.store);
    const held = s.holdUpdate();
    const settled = s.returned(2);
    w.frame(HOSTING_GRANT_SESSION_KIND, { grant });
    await held.arrived;
    const first = await popInvite(s.store, GATE);
    held.release();
    await settled;
    await expectHandedOnce(s, first, T);
    expect(s.now().grant).toEqual(grant);
    expect(await popInvite(s.store, GATE)).toBeNull();
    expect(w.represented).toHaveLength(1);
  });

  test("CONTROL: a grant that names another Nexus keeps nothing and re-presents nothing", async () => {
    const { grant } = await hearth();
    const s = testStore({ nexusAid: "nexus-" + "b".repeat(64) });
    const w = ride(s.store);
    const declined = s.returned(1);
    w.frame(HOSTING_GRANT_SESSION_KIND, { grant });
    await declined;
    expect(s.now()).toEqual({ nexusAid: "nexus-" + "b".repeat(64) });
    expect(w.represented).toHaveLength(0);
    expect(w.faults).toHaveLength(0);
  });

  test("H3 settle: an invite handed out while the carried invite settles stays out", async () => {
    const { grant, T } = await hearth();
    const s = testStore({ nexusAid: AID, invite: carriedInvite(T), grant, wallet: [{ epoch: grant.epoch, token: T }] });
    const w = ride(s.store, { presented: grant });
    const held = s.holdUpdate();
    const settled = s.returned(2);
    w.proven();
    await held.arrived;
    const first = await popInvite(s.store, GATE);
    held.release();
    await settled;
    await expectHandedOnce(s, first, T);
    expect(s.now().invite).toBeUndefined();
    expect(await popInvite(s.store, GATE)).toBeNull();
  });

  test("H4 fill: an invite handed out while the batch goes pending stays out, and the batch stands durable before it is sent", async () => {
    const { epoch } = await hearth();
    const prev = await mintHostingAct({ leafSeed: HEARTH, nexusAid: AID, prev: epoch.cid, cap: 3 });
    const next = await mintHostingAct({ leafSeed: HEARTH, nexusAid: AID, prev: prev.cid, cap: 3 });
    const nextGrant = issueGrant(next, { leaf: LEAF.verifyingKey, lineage: "1".repeat(64), survived: 0, from: "host" });
    const live = mintHostToken(prev);
    const dead = mintHostToken(epoch);                                          // two rolls back: the hearth holds it no longer
    const s = testStore({ nexusAid: AID, grant: nextGrant, wallet: [{ epoch: epoch.cid, token: dead }, { epoch: prev.cid, token: live }] });
    const w = ride(s.store, { epoch: next, presented: nextGrant });
    const held = s.holdUpdate(2);                                               // 1 = the settle, 2 = the fill
    const sent = w.nextSend();
    w.proven();
    await held.arrived;
    const first = await popInvite(s.store, GATE);
    held.release();
    await sent;
    await expectHandedOnce(s, first, live);
    expect(s.now().wallet).toEqual([]);                                         // the dead token pruned, the live one handed out
    expect(w.sent).toEqual([{ kind: HOSTING_MINT_SESSION_KIND, body: { blinded: s.now().pending!.items.map((i) => i.blinded) } }]);
    expect(isWalkRecord(s.now()), "the client's own pending batch reads whole").toBe(true);
  });

  test("H5 minted: an invite handed out while the answer finalizes stays out; a second answer to one batch adds no token", async () => {
    const { epoch, grant, T } = await hearth();
    const s = testStore({ nexusAid: AID, grant, wallet: [] });
    const w = ride(s.store, { epoch, presented: grant });
    const asked = w.nextSend();
    w.proven();
    await asked;
    const answer = evaluateWalkerBatch(epoch, (w.sent[0]!.body as { blinded: string[] }).blinded);
    s.map.set(GATE, { ...s.now(), wallet: [{ epoch: epoch.cid, token: T }] });   // one token stands beside the pending batch
    const held = s.holdUpdate();
    const settled = s.returned(3);                                              // two answers and the hand-out
    w.frame(HOSTING_MINTED_SESSION_KIND, answer);
    w.frame(HOSTING_MINTED_SESSION_KIND, answer);
    await held.arrived;
    const first = await popInvite(s.store, GATE);
    held.release();
    await settled;
    // The second answer finalized first; the held one then met a batch no longer pending and added nothing.
    const handed = decodeInvite(first!)!.token;
    const wallet = s.now().wallet!;
    expect(wallet.map((x) => x.token.n)).not.toContain(handed.n);
    const minted = (w.sent[0]!.body as { blinded: string[] }).blinded.length;
    expect(minted).toBeGreaterThan(0);
    expect(wallet).toHaveLength(minted);                                        // T and the batch once, less the one handed out
    expect(new Set(wallet.map((x) => x.token.n)).size).toBe(minted);
    expect(wallet[0]!.token).toEqual(T);
    expect(s.now().pending).toBeUndefined();
    expect(isWalkRecord(s.now()), "the client's own finalized wallet reads whole").toBe(true);
  });

  test("H6 hand-out: two hand-outs over one token answer it once", async () => {
    const { grant, T } = await hearth();
    const s = testStore({ nexusAid: AID, grant, wallet: [{ epoch: grant.epoch, token: T }] });
    const held = s.holdUpdate();
    const slow = popInvite(s.store, GATE);
    await held.arrived;
    const quick = await popInvite(s.store, GATE);
    held.release();
    expect(decodeInvite(quick!)!.token).toEqual(T);
    expect(await slow).toBeNull();
  });

  test("H7 carry: an invite handed out while a carriage receipt lands stays out", async () => {
    const { grant, T } = await hearth();
    const s = testStore({ nexusAid: AID, grant, wallet: [{ epoch: grant.epoch, token: T }] });
    const sent = latch();
    const transport = { onSession: () => () => {}, sendSession: (kind: string) => { if (kind === HOSTING_CARRY_SESSION_KIND) sent.open(); return true; } };
    const held = s.holdUpdate();
    const carrying = carryDocument({ transport, store: s.store, gatePubKey: GATE, leaf: LEAF, plaintext: new Uint8Array([1, 2, 3]), withinMs: 0 });
    await held.arrived;
    const first = await popInvite(s.store, GATE);
    held.release();
    await sent.wait;
    await carrying;
    await expectHandedOnce(s, first, T);
    expect(s.now().carried).toHaveLength(1);
    expect(isWalkRecord(s.now()), "the client's own receipt reads whole").toBe(true);
    expect(await popInvite(s.store, GATE)).toBeNull();
  });

  test("H7b carry: a record that left while the carry waited takes no receipt, and no earlier reading returns", async () => {
    const { grant, T } = await hearth();
    for (const after of [null, { nexusAid: AID } satisfies WalkRecord]) {       // the record left whole, or lost its grant
      const s = testStore({ nexusAid: AID, grant, wallet: [{ epoch: grant.epoch, token: T }] });
      const sent: string[] = [];
      const transport = { onSession: () => () => {}, sendSession: (kind: string) => { sent.push(kind); return true; } };
      const held = s.holdUpdate();
      const carrying = carryDocument({ transport, store: s.store, gatePubKey: GATE, leaf: LEAF, plaintext: new Uint8Array([1, 2, 3]), withinMs: 0 });
      await held.arrived;
      if (after) s.map.set(GATE, after); else s.map.delete(GATE);
      held.release();
      expect(await carrying).toBeNull();
      expect(s.map.get(GATE) ?? null).toEqual(after);
      expect(sent).toEqual([]);                                                 // no sealed value leaves without its receipt
    }
  });

  test("H8 notice: an invite handed out while the hearth's notice marks the record stays out", async () => {
    const { grant, T } = await hearth();
    const s = testStore({ nexusAid: AID, grant, wallet: [{ epoch: grant.epoch, token: T }] });
    const listeners: Array<(m: LarSessionMsg) => void> = [];
    watchCarryNotice({ onSession: (l) => { listeners.push(l); return () => {}; } }, s.store, GATE, () => {});
    const held = s.holdUpdate();
    const settled = s.returned(2);
    for (const l of listeners) l({ type: "lar:session", kind: HOSTING_NOTICE_SESSION_KIND, body: {} });
    await held.arrived;
    const first = await popInvite(s.store, GATE);
    held.release();
    await settled;
    await expectHandedOnce(s, first, T);
    expect(s.now().atRisk).toBe(true);
  });
});

describe("a store that refuses costs one message and says so", () => {
  test("F1 grant: a store that locks while a grant arrives tells the fault port; CONTROL: the next grant is kept", async () => {
    const { grant } = await hearth();
    const s = testStore({ nexusAid: AID });
    const w = ride(s.store);
    s.refuse({ updates: true });
    const told = w.nextFault();
    w.frame(HOSTING_GRANT_SESSION_KIND, { grant });
    await told;
    expect(w.faults).toHaveLength(1);
    expect(w.faults[0]!.at).toBe("grant");
    expect((w.faults[0]!.error as Error).name).toBe("StoreLocked");
    expect(w.represented).toHaveLength(0);
    expect(s.now().grant).toBeUndefined();
    s.refuse({});
    const kept = s.returned(1);
    w.frame(HOSTING_GRANT_SESSION_KIND, { grant });
    await kept;
    expect(s.now().grant).toEqual(grant);
    expect(w.faults).toHaveLength(1);
  });

  test("F2 settle: a store that refuses the settling tells the fault port and sends no batch", async () => {
    const { epoch, grant, T } = await hearth();
    const s = testStore({ nexusAid: AID, invite: carriedInvite(T), grant });
    const w = ride(s.store, { epoch, presented: grant });
    s.refuse({ updates: true });
    const told = w.nextFault();
    w.proven();
    await told;
    expect(w.faults.map((f) => f.at)).toEqual(["settle"]);
    expect(s.now().invite).toBe(carriedInvite(T));
    expect(w.sent).toEqual([]);
  });

  test("F3 minted: a store that refuses the answer's read tells the fault port and keeps the batch pending", async () => {
    const { epoch, grant } = await hearth();
    const s = testStore({ nexusAid: AID, grant });
    const w = ride(s.store, { epoch, presented: grant });
    const asked = w.nextSend();
    w.proven();
    await asked;
    const answer = evaluateWalkerBatch(epoch, (w.sent[0]!.body as { blinded: string[] }).blinded);
    s.refuse({ reads: true });
    const told = w.nextFault();
    w.frame(HOSTING_MINTED_SESSION_KIND, answer);
    await told;
    expect(w.faults.map((f) => f.at)).toEqual(["minted"]);
    expect(s.now().pending).toBeDefined();
    expect(s.now().wallet).toBeUndefined();
  });

  test("F4 notice: a store that refuses the mark tells the fault port", async () => {
    const s = testStore({ nexusAid: AID });
    const listeners: Array<(m: LarSessionMsg) => void> = [];
    const faults: WalkFault[] = [];
    const told = latch();
    watchCarryNotice({ onSession: (l) => { listeners.push(l); return () => {}; } }, s.store, GATE, (f) => { faults.push(f); told.open(); });
    s.refuse({ updates: true });
    for (const l of listeners) l({ type: "lar:session", kind: HOSTING_NOTICE_SESSION_KIND, body: {} });
    await told.wait;
    expect(faults.map((f) => f.at)).toEqual(["notice"]);
    expect(s.now().atRisk).toBeUndefined();
  });

  test("F5: a transport that refuses the re-presentation tells the fault port, and the grant stays kept", async () => {
    const { grant } = await hearth();
    const s = testStore({ nexusAid: AID });
    const w = ride(s.store, { representThrows: true });
    const told = w.nextFault();
    w.frame(HOSTING_GRANT_SESSION_KIND, { grant });
    await told;
    expect(w.faults.map((f) => f.at)).toEqual(["grant"]);
    expect(s.now().grant).toEqual(grant);
  });

  test("F6: a fault port that throws costs nothing further", () => {
    expect(() => tellWalkFault(() => { throw new Error("the port fell over"); }, "grant", new Error("refused"))).not.toThrow();
  });

  test("F7: a fetch whose store refuses rejects to the caller that awaits it", async () => {
    const s = testStore({ nexusAid: AID, carried: [{ cid: "blake3:" + "d".repeat(64), ref: "c".repeat(64), key: "e".repeat(64) }] });
    const listeners: Array<(m: LarSessionMsg) => void> = [];
    const transport = {
      onSession: (l: (m: LarSessionMsg) => void) => { listeners.push(l); return () => {}; },
      sendSession: (kind: string, body: unknown) => {
        if (kind === HOSTING_FETCH_SESSION_KIND) for (const l of listeners) l({ type: "lar:session", kind: HOSTING_FETCHED_SESSION_KIND, body: { cid: (body as { cid: string }).cid, ciphertext: "AAAA" } });
        return true;
      },
    };
    s.refuse({ reads: true });
    await expect(fetchDocument({ transport, store: s.store, gatePubKey: GATE, cid: "blake3:" + "d".repeat(64), withinMs: 60_000 })).rejects.toThrow("the store's key rests unopened");
  });

  test("F8: a hand-out whose store refuses rejects, and no token leaves", async () => {
    const { grant, T } = await hearth();
    const s = testStore({ nexusAid: AID, grant, wallet: [{ epoch: grant.epoch, token: T }] });
    s.refuse({ updates: true });
    await expect(popInvite(s.store, GATE)).rejects.toThrow("the store's key rests unopened");
    expect(s.now().wallet).toHaveLength(1);
  });
});

describe("a walk record reads whole or not at all", () => {
  test("R1: a whole record passes; each malformed field refuses by itself", async () => {
    const { epoch, grant, T } = await hearth();
    const whole: WalkRecord = {
      nexusAid: AID, relay: "ws://hearth.example/ws", invite: carriedInvite(T), grant, atRisk: true,
      wallet: [{ epoch: epoch.cid, token: T }],
      pending: { epoch: epoch.cid, tweakedKey: "ab".repeat(32), items: [{ n: "01".repeat(32), blind: "02".repeat(32), blinded: "03".repeat(32) }] },
      carried: [{ cid: "blake3:" + "d".repeat(64), ref: "c".repeat(64), key: "e".repeat(64) }],
    };
    expect(isWalkRecord(whole)).toBe(true);
    expect(isWalkRecord({ nexusAid: AID })).toBe(true);
    expect(isWalkRecord({ nexusAid: AID, wallet: [], carried: [] })).toBe(true);
    const broken: ReadonlyArray<readonly [string, unknown]> = [
      ["no record", null],
      ["an array", [whole]],
      ["no nexus", { ...whole, nexusAid: "" }],
      ["a field this record never names", { ...whole, claim: "x" }],
      ["a relay that is no string", { ...whole, relay: 7 }],
      ["an invite that does not decode", { ...whole, invite: "lar-invite:torn" }],
      ["a grant missing its tag", { ...whole, grant: { ...grant, tag: undefined } }],
      ["a notice mark that is no boolean", { ...whole, atRisk: "yes" }],
      ["a wallet that is a string", { ...whole, wallet: "x" }],
      ["a wallet entry with no token", { ...whole, wallet: [{ epoch: epoch.cid }] }],
      ["a wallet entry whose token lost its output", { ...whole, wallet: [{ epoch: epoch.cid, token: { ...T, y: undefined } }] }],
      ["a wallet entry with no epoch", { ...whole, wallet: [{ epoch: 1, token: T }] }],
      ["a pending batch with no items", { ...whole, pending: { ...whole.pending!, items: [] } }],
      ["a pending item missing its blind", { ...whole, pending: { ...whole.pending!, items: [{ n: "01".repeat(32), blinded: "03".repeat(32) }] } }],
      ["a pending batch missing its key", { ...whole, pending: { epoch: epoch.cid, items: whole.pending!.items } }],
      ["a pending item whose blind is no hex", { ...whole, pending: { ...whole.pending!, items: [{ n: "01".repeat(32), blind: 7, blinded: "03".repeat(32) }] } }],
      ["a pending item whose blind reads short", { ...whole, pending: { ...whole.pending!, items: [{ n: "01".repeat(32), blind: "a", blinded: "03".repeat(32) }] } }],
      ["a pending batch whose key reads short", { ...whole, pending: { ...whole.pending!, tweakedKey: "ab" } }],
      ["a receipt whose key is no digest", { ...whole, carried: [{ cid: "blake3:" + "d".repeat(64), ref: "c".repeat(64), key: "zz" }] }],
      ["a receipt missing its key", { ...whole, carried: [{ cid: "blake3:" + "d".repeat(64), ref: "c".repeat(64) }] }],
      ["a receipt whose address names no blake3 digest", { ...whole, carried: [{ cid: "d".repeat(64), ref: "c".repeat(64), key: "e".repeat(64) }] }],
      ["a receipt whose reference reads short", { ...whole, carried: [{ cid: "blake3:" + "d".repeat(64), ref: "c".repeat(63), key: "e".repeat(64) }] }],
      ["receipts that are no list", { ...whole, carried: {} }],
    ];
    for (const [why, record] of broken) expect(isWalkRecord(record), why).toBe(false);
  });
});
