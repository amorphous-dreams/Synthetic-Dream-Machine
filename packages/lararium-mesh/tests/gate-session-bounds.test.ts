/**
 * gate-session-bounds — what one seated session may hold in memory: a gate names its channel's bounds per session, and a
 * channel holds no more than they allow (house ruling "Frames after open": "Reassembly and concurrent messages carry
 * bounds").
 *
 * The module ceilings let one session hold 32 MiB of partial parts and sixteen whole 16 MiB messages; a gate that seats a
 * stranger names far tighter ones.
 *
 * Proven, each with its control:
 *   · RED: a message past the session's own `messageBytes` closes the channel "carriage-refused" / CONTROL: one within it
 *     delivers;
 *   · RED: whole messages buffered while the seat stands pending past `queueBytes` close it "pending-overflow" / CONTROL:
 *     within it they wait for open and deliver;
 *   · RED: once open, the pump stops pulling while the queue holds `queueBytes` / CONTROL: a read drains it and the pump
 *     pulls again;
 *   · `channelSessionTable` names each session's bounds off the session itself.
 */
import { describe, expect, it } from "vitest";
import { dialFaceGate } from "../src/face-dial.js";
import { makeFaceGate, presentedAdmitReader, type FaceGate, type GateSession, type GateSessionTable } from "../src/face-gate.js";
import { classifySocket } from "../src/federation-gate.js";
import type { PeerClass } from "../src/island-protocol.js";
import { channelSessionTable, dialedChannel, seatedChannel, type GateSessionChannel, type SeatedChannel } from "../src/gate-session-channel.js";
import { AUDIENCE, handDeadlines, presenter, wire, world, type World } from "./face-gate-fixture.js";

const turn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
async function until(cond: () => boolean, turns = 500): Promise<void> { for (let i = 0; i < turns && !cond(); i++) await turn(); }
const bytesOf = (n: number): Uint8Array => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 1) & 0xff);

function gateOver(w: World, sessions: GateSessionTable): FaceGate {
  const admits = presentedAdmitReader(() => w.held);
  return makeFaceGate({
    bundle: w.bundle, nexus: w.nexus, audience: AUDIENCE, deadlines: w.deadlines, withdrawals: w.withdrawals,
    admits: { read: (arm) => admits.read(arm), readPlace: (arm) => admits.readPlace(arm) },
    shadows: { consult: () => ({ aside: false, fleetAside: false }), consultPlace: () => ({ aside: false }) },
    grants: { grantFor: () => null },
    sorter: {
      async sort(input) {
        const cls: PeerClass | null = classifySocket({ sameOperator: false, contracted: input.admit !== null, walker: false, answersStrangers: false });
        return cls === null ? null : { class: cls, ...(input.admit ? { standing: { nym: input.scope!.faceKey, aid: w.nexus } } : {}) };
      },
    },
    sessions,
  });
}

/** One dial into a gate over `table`; answers the dialer's own channel once it reads verified. */
async function dialWith(table: GateSessionTable): Promise<GateSessionChannel> {
  const w = await world();
  const p = await presenter(w, "bounded");
  const gate = gateOver(w, table);
  const raw = wire();
  const verdict = dialFaceGate({ pin: w.pin, tier: w.pin.tier, socket: raw.dial, audience: AUDIENCE, certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history, deadlines: handDeadlines() });
  void raw.accepted.then((socket) => gate.accept(socket));
  const outcome = await verdict;
  if (outcome.state !== "verified") throw new Error(`the dial came to ${outcome.state}`);
  return dialedChannel({ transport: outcome.transport, socket: { send: (f) => raw.dial.send(f), recv: () => raw.dial.recv(), cut: () => raw.dial.close() } });
}

describe("a seated session holds what its bounds allow", () => {
  it("RED: a message past the session's own messageBytes closes the channel; CONTROL: one within it delivers", async () => {
    const opened: GateSessionChannel[] = [];
    const named: GateSession[] = [];
    const table = channelSessionTable((channel) => { opened.push(channel); }, {
      bounds: (session) => { named.push(session); return { messageBytes: 1024, bufferBytes: 4096, concurrent: 1 }; },
    });
    const mine = await dialWith(table);
    await until(() => opened.length === 1);
    expect(named).toHaveLength(1);                                         // the table read the session it seats
    mine.send("sync", bytesOf(1000));
    expect((await opened[0]!.recv())?.bytes.length).toBe(1000);            // CONTROL
    mine.send("sync", bytesOf(2000));
    expect(await opened[0]!.recv()).toBeNull();                            // RED
    expect(opened[0]!.closedBy).toBe("carriage-refused");
  });

  it("RED: whole messages buffered while pending past queueBytes close it; CONTROL: within it they deliver at open", async () => {
    const seats: SeatedChannel[] = [];
    const held = (queueBytes: number): GateSessionTable => ({
      attach(socket, session) {
        const channel = seatedChannel({ transport: session.transport, socket, queueBytes });
        seats.push(channel);
        return { open() { /* the seat stays pending until the suite opens it */ }, abandon() { channel.abandon(); } };
      },
    });
    const within = await dialWith(held(8192));
    await until(() => seats.length === 1);
    within.send("sync", bytesOf(3000));
    within.send("sync", bytesOf(3000));
    for (let i = 0; i < 50; i++) await turn();
    expect(seats[0]!.state).toBe("pending");                               // CONTROL: 6000 bytes wait
    seats[0]!.open();
    expect((await seats[0]!.recv())?.bytes.length).toBe(3000);

    const past = await dialWith(held(4096));
    await until(() => seats.length === 2);
    past.send("sync", bytesOf(3000));
    past.send("sync", bytesOf(3000));
    await until(() => seats[1]!.state === "closed");
    expect(seats[1]!.closedBy).toBe("pending-overflow");                   // RED
  });

  it("RED: once open, the pump stops pulling while the queue holds queueBytes; CONTROL: a read lets it pull again", async () => {
    let pulled = 0;
    const opened: GateSessionChannel[] = [];
    const table: GateSessionTable = {
      attach(socket, session) {
        const counted = { send: (f: Uint8Array) => socket.send(f), cut: () => socket.cut(), recv: () => socket.recv().then((f) => { if (f !== null) pulled++; return f; }) };
        const channel = seatedChannel({ transport: session.transport, socket: counted, queueBytes: 4096 });
        return { open() { channel.open(); opened.push(channel); }, abandon() { channel.abandon(); } };
      },
    };
    const mine = await dialWith(table);
    await until(() => opened.length === 1);
    const before = pulled;
    for (let i = 0; i < 4; i++) mine.send("sync", bytesOf(3000));
    for (let i = 0; i < 50; i++) await turn();
    expect(pulled - before).toBe(2);                                       // RED: 6000 bytes queued, the pump waits
    expect((await opened[0]!.recv())?.bytes.length).toBe(3000);
    expect((await opened[0]!.recv())?.bytes.length).toBe(3000);
    await until(() => pulled - before === 4);
    expect(pulled - before).toBe(4);                                       // CONTROL: the drain let it pull
  });
});
