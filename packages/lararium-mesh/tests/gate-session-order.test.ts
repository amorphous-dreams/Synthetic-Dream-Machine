/**
 * The gate's verdict precedes its session, and an immediate application frame waits for the seat to open.
 *
 * A real gate seats a real sealed channel (`gate-session-channel`); a real dialer reads `verified` and sends
 * application frame one at once, while the gate's seat stays held shut. The frame buffers and never delivers before
 * the seat opens, then arrives exactly once. The node gate server drives the same law over a live WebSocket
 * (`@lararium/node` `tests/face-gate-server.test.ts`).
 */
import { describe, expect, test } from "vitest";
import { dialFaceGate } from "../src/face-dial.js";
import type { GateSessionTable } from "../src/face-gate.js";
import { dialedChannel, seatedChannel, type SeatedChannel } from "../src/gate-session-channel.js";
import { AUDIENCE, dial, handDeadlines, presenter, wire, world } from "./face-gate-fixture.js";

const turn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("gate verdict and first application frame", () => {
  test("CONTROL: the in-memory gate opens a session only after sending its verdict", async () => {
    const w = await world();
    const p = await presenter(w, "order-control");
    const result = await dial(w, p);
    expect(result.outcome.state).toBe("verified");
    expect(w.attached).toHaveLength(1);
    expect(w.sentAtAttach[0]).toBeGreaterThan(0);
  });

  test("VERDICT_OPENS_BEFORE_FIRST_SYNC_FRAME: an immediate application frame buffers until the seat opens, then arrives once", async () => {
    let release!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    const seated: SeatedChannel[] = [];
    const sessions: GateSessionTable = {
      attach(socket, session) {
        const channel = seatedChannel({ transport: session.transport, socket });
        seated.push(channel);
        return { open() { void released.then(() => channel.open()); }, abandon() { channel.abandon(); } };
      },
    };
    const w = await world({ sessions });
    const p = await presenter(w, "immediate frame");
    const { dial: socket, accepted, log } = wire();
    const dialing = dialFaceGate({ pin: w.pin, tier: w.pin.tier, socket, audience: AUDIENCE, certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history, deadlines: handDeadlines() });
    const accepting = accepted.then((gateSocket) => w.gate.accept(gateSocket));
    const outcome = await dialing;
    if (outcome.state !== "verified") throw new Error(`the dial came to ${outcome.state}`);
    const mine = dialedChannel({ transport: outcome.transport, socket: { send: (f) => socket.send(f), recv: () => socket.recv(), cut: () => socket.close() } });
    expect(await accepting).toEqual({ outcome: "attached", class: "contracted" });
    const sentBefore = log.toGate.length;
    mine.send("sync", Uint8Array.of(1, 2, 3));
    const gate = seated[0]!;
    let delivered = 0;
    const reading = gate.recv().then((m) => { delivered++; return m; });
    // The gate's pump pulled frame one and waits for the next, all while the seat stays held shut.
    while (!log.gateWaits || log.toGate.length === sentBefore) await turn();
    expect(gate.state).toBe("pending");
    expect(delivered).toBe(0);
    release();
    const first = await reading;
    expect(gate.state).toBe("open");
    expect(first?.kind).toBe("sync");
    expect(Array.from(first!.bytes)).toEqual([1, 2, 3]);
    mine.close();
    expect(await gate.recv()).toBeNull();
    expect(delivered).toBe(1);
    expect(gate.closedBy).toBe("peer-close");
  });
});
