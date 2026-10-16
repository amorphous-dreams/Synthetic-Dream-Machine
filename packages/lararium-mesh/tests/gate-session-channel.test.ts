/**
 * gate-session-channel vectors — a real gate and a real dial over the fixture's wire, with the channel table seating.
 *
 * The gate here is built with makeFaceGate beside a world's collaborators, since world() seats its own recording
 * table. Nothing waits on a clock: every order below is pinned by a deferred or by a message that follows it.
 */
import { describe, expect, it } from "vitest";
import { dialFaceGate } from "../src/face-dial.js";
import { makeFaceGate, presentedAdmitReader, type FaceGate, type GateOutcome, type GateSessionTable } from "../src/face-gate.js";
import { classifySocket } from "../src/federation-gate.js";
import type { PeerClass } from "../src/island-protocol.js";
import type { NoiseTransport } from "../src/noise-ik.js";
import { SEALED_PART_BODY_MAX, sealedParts } from "../src/sealed-carriage.js";
import {
  CHANNEL_CLOSE_REASONS, GateChannelClosed, channelSessionTable, dialedChannel, seatedChannel,
  type ChannelCloseReason, type GateSessionChannel, type SeatedChannel,
} from "../src/gate-session-channel.js";
import { AUDIENCE, handDeadlines, presenter, wire, world, type Presenter, type World } from "./face-gate-fixture.js";

const turn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
function deferred<T = void>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const bytesOf = (n: number, salt = 1): Uint8Array => Uint8Array.from({ length: n }, (_, i) => (i * 7 + salt) & 0xff);


function gateOver(w: World, sessions: GateSessionTable): FaceGate {
  const admits = presentedAdmitReader(() => w.held);
  return makeFaceGate({
    bundle: w.bundle, nexus: w.nexus, audience: AUDIENCE, deadlines: w.deadlines, withdrawals: w.withdrawals,
    admits: { read: (arm) => admits.read(arm), readPlace: (arm) => admits.readPlace(arm) },
    shadows: { consult: () => ({ aside: false, fleetAside: false }), consultPlace: () => ({ aside: false }) },
    grants: { grantFor: () => null },
    sorter: {
      async sort(input) {
        const cls: PeerClass | null = classifySocket({
          sameOperator: input.sameGroup !== null && !input.fleetAside,
          contracted: input.admit !== null || input.place !== null,
          walker: input.arm?.kind === "grant" || input.arm?.kind === "claim",
          answersStrangers: false,
        });
        return cls === null ? null : { class: cls, ...(input.admit ? { standing: { nym: input.scope!.faceKey, aid: w.nexus } } : {}) };
      },
    },
    sessions,
  });
}

interface Dialer { accepting: Promise<GateOutcome>; raw: ReturnType<typeof wire>; transport: NoiseTransport; channel: GateSessionChannel; log: ReturnType<typeof wire>["log"] }

/** One honest dial against `gate`; resolves at the dialer's verified, before the gate's seat need have opened. */
async function dialInto(w: World, gate: FaceGate, p: Presenter): Promise<Dialer> {
  const raw = wire();
  const verdict = dialFaceGate({ pin: w.pin, tier: w.pin.tier, socket: raw.dial, audience: AUDIENCE, certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history, deadlines: handDeadlines() });
  const accepting = raw.accepted.then((socket) => gate.accept(socket));
  const outcome = await verdict;
  if (outcome.state !== "verified") throw new Error(`the dial came to ${outcome.state}`);
  const socket = { send: (f: Uint8Array) => raw.dial.send(f), recv: () => raw.dial.recv(), cut: () => raw.dial.close() };
  return { accepting, raw, transport: outcome.transport, channel: dialedChannel({ transport: outcome.transport, socket }), log: raw.log };
}

/**
 * A table that seats real channels, hands them out at once, and opens them only when `release` resolves.
 * `tap` sees every frame the pump pulls off the socket.
 */
function heldTable(release: Promise<void>, seated: SeatedChannel[], opts: { pendingBound?: number; queueBound?: number; tap?: (frame: Uint8Array | null) => void; called?: () => void; hangAfterCut?: boolean; settled?: () => void } = {}): GateSessionTable {
  return {
    attach(socket, session) {
      let cutDone = false;
      const beneath = opts.tap === undefined && opts.called === undefined && !opts.hangAfterCut ? socket : {
        send: (f: Uint8Array) => socket.send(f),
        cut: () => { cutDone = true; socket.cut(); },
        recv: () => {
          opts.called?.();
          // A socket that settles nothing once cut: a pump that reads it again hangs for good.
          if (opts.hangAfterCut && cutDone) return new Promise<Uint8Array | null>(() => {});
          return socket.recv().then((frame) => { opts.tap?.(frame); return frame; });
        },
      };
      const channel = seatedChannel({
        transport: session.transport, socket: beneath,
        ...(opts.pendingBound !== undefined ? { pendingBound: opts.pendingBound } : {}),
        ...(opts.queueBound !== undefined ? { queueBound: opts.queueBound } : {}),
        ...(opts.settled !== undefined ? { settled: opts.settled } : {}),
      });
      seated.push(channel);
      return { open() { void release.then(() => channel.open()); }, abandon() { channel.abandon(); } };
    },
  };
}

async function standard(): Promise<{ w: World; p: Presenter; gate: FaceGate; opened: Promise<GateSessionChannel> }> {
  const w = await world();
  const p = await presenter(w, "channel face");
  const opened = deferred<GateSessionChannel>();
  const gate = gateOver(w, channelSessionTable((channel) => opened.resolve(channel)));
  return { w, p, gate, opened: opened.promise };
}

describe("GateSessionChannel", () => {
  it("CONTROL: a dialed channel sends a sync message after verified and the gate's onOpen channel receives it", async () => {
    const { w, p, gate, opened } = await standard();
    const d = await dialInto(w, gate, p);
    d.channel.send("sync", bytesOf(40));
    const at = await opened;
    expect(at.state).toBe("open");
    const got = await at.recv();
    expect(got?.kind).toBe("sync");
    expect(Array.from(got!.bytes)).toEqual(Array.from(bytesOf(40)));
  });

  it("IMMEDIATE_FRAME_AFTER_OPEN: frame one sent at the dial's verified arrives exactly once, after open, never before", async () => {
    const w = await world();
    const p = await presenter(w, "immediate face");
    const seated: SeatedChannel[] = [];
    const sent = deferred();
    let pulled = 0;
    const gate = gateOver(w, heldTable(sent.promise, seated, { tap: (frame) => { if (frame !== null) pulled++; } }));
    const d = await dialInto(w, gate, p);
    // The dialer's verified is read; the gate's open() has not run (it waits on `sent`).
    const before = pulled;
    d.channel.send("session", bytesOf(9));
    const channel = seated[0]!;
    // Positive pin: the pump pulled frame one off the wire, queued it, and came back to wait for the next, all before open.
    while (pulled === before || !d.log.gateWaits) await turn();
    expect(pulled - before).toBe(1);
    expect(channel.state).toBe("pending");
    let delivered = 0;
    const reading = channel.recv().then((m) => { delivered++; return m; });
    for (let i = 0; i < 4; i++) await turn();
    expect(channel.state).toBe("pending");
    expect(delivered).toBe(0);
    sent.resolve();
    const first = await reading;
    expect(channel.state).toBe("open");
    expect(Array.from(first!.bytes)).toEqual(Array.from(bytesOf(9)));
    d.channel.close();
    expect(await channel.recv()).toBeNull();
    expect(delivered).toBe(1);
    expect(channel.closedBy).toBe("peer-close");
  });

  it("a multi-part sync message round-trips both directions", async () => {
    const { w, p, gate, opened } = await standard();
    const d = await dialInto(w, gate, p);
    const big = bytesOf(3 * SEALED_PART_BODY_MAX + 5, 3);
    d.channel.send("sync", big);
    const at = await opened;
    const there = await at.recv();
    expect(there!.bytes.length).toBe(big.length);
    expect(Buffer.from(there!.bytes).equals(Buffer.from(big))).toBe(true);
    const back = bytesOf(3 * SEALED_PART_BODY_MAX + 5, 5);
    at.send("sync", back);
    const here = await d.channel.recv();
    expect(Buffer.from(here!.bytes).equals(Buffer.from(back))).toBe(true);
  });

  it("session and sync messages keep their order", async () => {
    const { w, p, gate, opened } = await standard();
    const d = await dialInto(w, gate, p);
    d.channel.send("session", bytesOf(3, 1));
    d.channel.send("sync", bytesOf(2 * SEALED_PART_BODY_MAX, 2));
    d.channel.send("session", bytesOf(1, 3));
    const at = await opened;
    const kinds: string[] = [];
    for (let i = 0; i < 3; i++) kinds.push((await at.recv())!.kind);
    expect(kinds).toEqual(["session", "sync", "session"]);
  });

  it("parts of two messages interleaved on the wire join in order", async () => {
    const { w, p, gate, opened } = await standard();
    const d = await dialInto(w, gate, p);
    const a = sealedParts("session", 0, bytesOf(SEALED_PART_BODY_MAX + 4, 1));
    const b = sealedParts("sync", 1, bytesOf(SEALED_PART_BODY_MAX + 6, 2));
    for (const part of [a[0]!, b[0]!, a[1]!, b[1]!]) d.raw.dial.send(d.transport.send.seal(part));
    const at = await opened;
    const first = await at.recv();
    const second = await at.recv();
    expect([first!.kind, second!.kind]).toEqual(["session", "sync"]);
    expect(first!.bytes.length).toBe(SEALED_PART_BODY_MAX + 4);
    expect(second!.bytes.length).toBe(SEALED_PART_BODY_MAX + 6);
  });

  it("a peer close delivers the messages already whole, then null", async () => {
    const { w, p, gate, opened } = await standard();
    const d = await dialInto(w, gate, p);
    d.channel.send("session", bytesOf(2, 1));
    d.channel.send("sync", bytesOf(2, 2));
    d.channel.close();
    const at = await opened;
    expect((await at.recv())!.kind).toBe("session");
    expect((await at.recv())!.kind).toBe("sync");
    expect(await at.recv()).toBeNull();
    expect(at.state).toBe("closed");
    expect(at.closedBy).toBe("peer-close");
    expect(() => at.send("sync", bytesOf(1))).toThrow(GateChannelClosed);
  });

  it("a forged frame closes frame-unopened", async () => {
    const { w, p, gate, opened } = await standard();
    const d = await dialInto(w, gate, p);
    d.raw.dial.send(bytesOf(64, 9));
    const at = await opened;
    expect(await at.recv()).toBeNull();
    expect(at.closedBy).toBe("frame-unopened");
  });

  it("a handshake tag sealed under the transport closes carriage-refused", async () => {
    const { w, p, gate, opened } = await standard();
    const d = await dialInto(w, gate, p);
    d.raw.dial.send(d.transport.send.seal(new Uint8Array([0x13, 0, 0, 0])));
    const at = await opened;
    expect(await at.recv()).toBeNull();
    expect(at.closedBy).toBe("carriage-refused");
  });

  it("NONSENSE: a channel over another handshake's transport opens nothing", async () => {
    const w = await world();
    const p1 = await presenter(w, "first face");
    const p2 = await presenter(w, "second face");
    const one = deferred<GateSessionChannel>(), two = deferred<GateSessionChannel>();
    let n = 0;
    const gate = gateOver(w, channelSessionTable((channel) => (n++ === 0 ? one : two).resolve(channel)));
    const d1 = await dialInto(w, gate, p1);
    await one.promise;
    const d2 = await dialInto(w, gate, p2);
    const gateTwo = await two.promise;
    const crossed = dialedChannel({
      transport: d1.transport,
      socket: { send: (f) => d2.raw.dial.send(f), recv: () => d2.raw.dial.recv(), cut: () => d2.raw.dial.close() },
    });
    crossed.send("sync", bytesOf(3));
    expect(await gateTwo.recv()).toBeNull();
    expect(gateTwo.closedBy).toBe("frame-unopened");
  });

  it("pending overflow closes pending-overflow and cuts", async () => {
    const w = await world();
    const p = await presenter(w, "overflow face");
    const seated: SeatedChannel[] = [];
    const never = deferred();
    const gate = gateOver(w, heldTable(never.promise, seated, { pendingBound: 2 }));
    const d = await dialInto(w, gate, p);
    for (let i = 0; i < 3; i++) d.channel.send("session", bytesOf(1, i));
    const channel = seated[0]!;
    expect(await channel.recv()).toBeNull();
    expect(channel.closedBy).toBe("pending-overflow");
    expect(await d.channel.recv()).toBeNull();
    expect(d.channel.closedBy).toBe("peer-gone");
  });

  it("abandon closes abandoned and the dialer then reads null", async () => {
    const w = await world();
    const p = await presenter(w, "abandon face");
    const seated: SeatedChannel[] = [];
    const never = deferred();
    const gate = gateOver(w, heldTable(never.promise, seated));
    const d = await dialInto(w, gate, p);
    d.channel.send("session", bytesOf(1));
    const channel = seated[0]!;
    channel.abandon();
    expect(channel.closedBy).toBe("abandoned");
    expect(await channel.recv()).toBeNull();
    expect(await d.channel.recv()).toBeNull();
    expect(d.channel.closedBy).toBe("peer-gone");
  });

  it("send while pending throws unopened", async () => {
    const w = await world();
    const p = await presenter(w, "pending face");
    const seated: SeatedChannel[] = [];
    const gate = gateOver(w, heldTable(new Promise<void>(() => {}), seated));
    await dialInto(w, gate, p);
    const channel = seated[0]!;
    expect(channel.state).toBe("pending");
    try { channel.send("sync", bytesOf(1)); expect.unreachable(); } catch (error) {
      expect(error).toBeInstanceOf(GateChannelClosed);
      expect((error as GateChannelClosed).reason).toBe("unopened");
    }
  });

  it("close is idempotent, sends exactly one control/close frame, and send then throws local", async () => {
    const { w, p, gate, opened } = await standard();
    const d = await dialInto(w, gate, p);
    const before = d.log.toGate.length;
    d.channel.close();
    d.channel.close();
    expect(d.log.toGate.length - before).toBe(1);
    expect(d.channel.state).toBe("closed");
    expect(d.channel.closedBy).toBe("local");
    try { d.channel.send("sync", bytesOf(1)); expect.unreachable(); } catch (error) {
      expect((error as GateChannelClosed).reason).toBe("local");
    }
    expect(await d.channel.recv()).toBeNull();
    const at = await opened;
    expect(await at.recv()).toBeNull();
  });

  it("spent ids close ids-spent", async () => {
    const { w, p, gate, opened } = await standard();
    const d = await dialInto(w, gate, p);
    const raw = d.raw;
    const spending = dialedChannel({
      transport: d.transport, firstId: 0xffffffff,
      socket: { send: (f) => raw.dial.send(f), recv: () => raw.dial.recv(), cut: () => raw.dial.close() },
    });
    spending.send("sync", bytesOf(1));
    expect(() => spending.send("sync", bytesOf(1))).toThrow(GateChannelClosed);
    expect(spending.closedBy).toBe("ids-spent");
    await opened;
  });

  it("a gate whose onOpen throws closes the channel local and the dial reads the cut", async () => {
    const w = await world();
    const p = await presenter(w, "throwing face");
    const seen = deferred<GateSessionChannel>();
    const gate = gateOver(w, channelSessionTable((channel) => { seen.resolve(channel); throw new Error("onOpen refused"); }));
    const d = await dialInto(w, gate, p);
    const channel = await seen.promise;
    expect(channel.closedBy).toBe("local");
    expect(await d.channel.recv()).toBeNull();
    const gateReading = await d.accepting;
    expect(gateReading).toEqual({ outcome: "silence", reason: "session-unopened" });
    // The channel's own close cut once; the gate then cut again, since no deadline stands to cut the socket.
    expect(d.log.cuts).toBe(2);
  });

  it("every close reason is reached, each driven inside this one test", async () => {
    const seatedAndDialed = async (): Promise<{ d: Dialer; at: GateSessionChannel }> => {
      const { w, p, gate, opened } = await standard();
      const d = await dialInto(w, gate, p);
      return { d, at: await opened };
    };
    const drivers: Record<ChannelCloseReason, () => Promise<ChannelCloseReason | null>> = {
      local: async () => { const { d } = await seatedAndDialed(); d.channel.close(); return d.channel.closedBy; },
      "peer-close": async () => { const { d, at } = await seatedAndDialed(); d.channel.close(); await at.recv(); return at.closedBy; },
      "peer-gone": async () => { const { d, at } = await seatedAndDialed(); d.raw.dial.close(); await at.recv(); return at.closedBy; },
      "frame-unopened": async () => { const { d, at } = await seatedAndDialed(); d.raw.dial.send(bytesOf(64, 9)); await at.recv(); return at.closedBy; },
      "carriage-refused": async () => {
        const { d, at } = await seatedAndDialed();
        d.raw.dial.send(d.transport.send.seal(new Uint8Array([0x13, 0, 0, 0])));
        await at.recv();
        return at.closedBy;
      },
      "pending-overflow": async () => {
        const w = await world();
        const p = await presenter(w, "census overflow");
        const seated: SeatedChannel[] = [];
        const d = await dialInto(w, gateOver(w, heldTable(new Promise<void>(() => {}), seated, { pendingBound: 1 })), p);
        d.channel.send("session", bytesOf(1)); d.channel.send("session", bytesOf(1));
        await seated[0]!.recv();
        return seated[0]!.closedBy;
      },
      abandoned: async () => {
        const w = await world();
        const p = await presenter(w, "census abandon");
        const seated: SeatedChannel[] = [];
        await dialInto(w, gateOver(w, heldTable(new Promise<void>(() => {}), seated)), p);
        seated[0]!.abandon();
        return seated[0]!.closedBy;
      },
      "ids-spent": async () => {
        const { d } = await seatedAndDialed();
        const spending = dialedChannel({ transport: d.transport, firstId: 0xffffffff, socket: { send: (f) => d.raw.dial.send(f), recv: () => d.raw.dial.recv(), cut: () => d.raw.dial.close() } });
        spending.send("sync", bytesOf(1));
        try { spending.send("sync", bytesOf(1)); } catch { /* the closed channel throws */ }
        return spending.closedBy;
      },
    };
    for (const reason of CHANNEL_CLOSE_REASONS) expect(await drivers[reason](), reason).toBe(reason);
  });

  it("the peer sends two messages then closes while the seat stays pending: both deliver after open, then null (peer-close)", async () => {
    const w = await world();
    const p = await presenter(w, "pending close face");
    const seated: SeatedChannel[] = [];
    const release = deferred();
    const d = await dialInto(w, gateOver(w, heldTable(release.promise, seated)), p);
    const channel = seated[0]!;
    d.channel.send("session", bytesOf(2, 1));
    d.channel.send("sync", bytesOf(2, 2));
    d.channel.close();
    while (channel.closedBy === null) await turn();
    expect(channel.closedBy).toBe("peer-close");
    // A reader asks BEFORE open: a closed channel still delivers nothing until its seat opens.
    let early = 0;
    const asking = channel.recv().then((m) => { early++; return m; });
    for (let i = 0; i < 4; i++) await turn();
    expect(early).toBe(0);
    release.resolve();
    expect((await asking)!.kind).toBe("session");
    expect((await channel.recv())!.kind).toBe("sync");
    expect(await channel.recv()).toBeNull();
    expect(channel.closedBy).toBe("peer-close");
  });

  it("the socket ends while the seat stays pending: both deliver after open, then null (peer-gone)", async () => {
    const w = await world();
    const p = await presenter(w, "pending gone face");
    const seated: SeatedChannel[] = [];
    const release = deferred();
    const d = await dialInto(w, gateOver(w, heldTable(release.promise, seated)), p);
    const channel = seated[0]!;
    d.channel.send("session", bytesOf(2, 1));
    d.channel.send("sync", bytesOf(2, 2));
    d.raw.dial.close();
    while (channel.closedBy === null) await turn();
    expect(channel.closedBy).toBe("peer-gone");
    release.resolve();
    expect((await channel.recv())!.kind).toBe("session");
    expect((await channel.recv())!.kind).toBe("sync");
    expect(await channel.recv()).toBeNull();
    expect(channel.closedBy).toBe("peer-gone");
  });

  it("BACK-PRESSURE: an open channel nobody reads holds the pump at the queue bound, then 40 messages deliver in order", async () => {
    const w = await world();
    const p = await presenter(w, "pressure face");
    const seated: SeatedChannel[] = [];
    let pulled = 0;
    const d = await dialInto(w, gateOver(w, heldTable(Promise.resolve(), seated, { tap: (frame) => { if (frame !== null) pulled++; } })), p);
    const channel = seated[0]!;
    const base = pulled;
    for (let i = 0; i < 40; i++) d.channel.send("session", Uint8Array.of(i));
    for (let i = 0; i < 4; i++) await turn();
    expect(channel.state).toBe("open");
    expect(pulled - base).toBe(16);
    for (let i = 0; i < 40; i++) expect(Array.from((await channel.recv())!.bytes), `message ${i}`).toEqual([i]);
    expect(pulled - base).toBe(40);
    d.channel.close();
    expect(await channel.recv()).toBeNull();
  });

  it("BACK-PRESSURE: a named queueBound holds at that bound, on both halves; a bound under one is a RangeError", async () => {
    const w = await world();
    const p = await presenter(w, "bound face");
    const seated: SeatedChannel[] = [];
    let pulled = 0, calls = 0, ended = false;
    const d = await dialInto(w, gateOver(w, heldTable(Promise.resolve(), seated, { queueBound: 3, tap: (frame) => { if (frame !== null) pulled++; }, called: () => { calls++; }, settled: () => { ended = true; } })), p);
    const channel = seated[0]!;
    const base = pulled;
    for (let i = 0; i < 8; i++) d.channel.send("session", Uint8Array.of(i));
    for (let i = 0; i < 4; i++) await turn();
    expect(pulled - base).toBe(3);
    // Close locally while the pump is paused at the bound: the queue drops, the pump wakes and ends, and it pulls nothing more.
    const callsAtClose = calls;
    channel.close();
    expect(channel.closedBy).toBe("local");
    expect(await channel.recv()).toBeNull();
    for (let i = 0; i < 4; i++) await turn();
    expect(ended).toBe(true);
    expect(calls).toBe(callsAtClose);
    const socket = { send: () => {}, recv: () => new Promise<null>(() => {}), cut: () => {} };
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(() => seatedChannel({ transport: d.transport, socket, queueBound: bad })).toThrow(RangeError);
      expect(() => dialedChannel({ transport: d.transport, socket, queueBound: bad })).toThrow(RangeError);
    }
    expect(() => dialedChannel({ transport: d.transport, socket, queueBound: 1 })).not.toThrow();
  });

  it("a pump woken by close() reads no cut socket: it ends without another recv", async () => {
    const w = await world();
    const p = await presenter(w, "hang face");
    const seated: SeatedChannel[] = [];
    let calls = 0, ended = false;
    const d = await dialInto(w, gateOver(w, heldTable(Promise.resolve(), seated, { queueBound: 2, hangAfterCut: true, called: () => { calls++; }, settled: () => { ended = true; } })), p);
    const channel = seated[0]!;
    for (let i = 0; i < 5; i++) d.channel.send("session", Uint8Array.of(i));
    for (let i = 0; i < 4; i++) await turn();
    expect(channel.state).toBe("open");
    const callsAtClose = calls;
    channel.close();
    for (let i = 0; i < 4; i++) await turn();
    expect(calls).toBe(callsAtClose);
    expect(ended).toBe(true);
  });
});
