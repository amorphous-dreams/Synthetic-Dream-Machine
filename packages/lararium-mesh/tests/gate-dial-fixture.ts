/**
 * gate-dial-fixture — THE ONE HELPER a test dials a sealed gate through.
 *
 * A suite that needs a socket admitted, a gate stood or a dialer driven asks for it here and names no frame of the
 * handshake itself. The socket speaks one handshake (the Noise IK flight, a sealed presentation, a signed verdict), and
 * no double of a dialer or a gate stands beside it. This file holds the real dialer (`dialGate`), a real gate over a world in this process
 * (`gateOver`, `dialSocketTo`) and the rig that seats channels for the adapter (`faceGateRig`).
 *
 * What a suite holds after it comes through here: a verdict, a channel, a peer. What it never holds: a frame's `type`,
 * a nonce's place in a message, or the bytes a proof signs.
 *
 * Test support. No source file imports it.
 */
import { LarWSClientAdapter, type LarWSClientOptions } from "../src/lar-ws-client-adapter.js";
import { hearthPinIndex, type HearthPinIndex } from "../src/admit-gate-pin.js";
import type { DialSocket } from "../src/face-dial.js";
import { makeFaceGate, presentedAdmitReader, type FaceGate } from "../src/face-gate.js";
import { classifySocket } from "../src/federation-gate.js";
import type { PeerClass } from "../src/island-protocol.js";
import { channelSessionTable, type GateSessionChannel } from "../src/gate-session-channel.js";
import { AUDIENCE, handDeadlines, presenter, wire, world, type Presenter, type World } from "./face-gate-fixture.js";

// ── The real dialer ─────────────────────────────────────────────────────────────────────────────

/** Dial a gate as every vessel does: the one client transport, with the face it presents and the gate pin it holds. */
export function dialGate(options: LarWSClientOptions): LarWSClientAdapter {
  return new LarWSClientAdapter(options);
}

// ── The face dial: a dialer and a real gate, meeting in this process ─────────────────────────────

/** A real gate over a world's collaborators, seating `sessions` (the world's own table records and seats no channel). */
export function gateOver(w: World, sessions: Parameters<typeof makeFaceGate>[0]["sessions"]): FaceGate {
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

/** A dial socket whose far end is `gate`'s accept: the in-process wire, with the log an observer reads. */
export function dialSocketTo(gate: FaceGate): { readonly socket: DialSocket; readonly log: ReturnType<typeof wire>["log"] } {
  const { dial, accepted, log } = wire();
  void accepted.then((gateSocket) => gate.accept(gateSocket));
  return { socket: dial, log };
}

export interface FaceGateRig {
  readonly w: World;
  readonly p: Presenter;
  readonly gate: FaceGate;
  readonly pins: HearthPinIndex;
  readonly hearth: string;
  /** Every channel the gate opened, in order; `nextChannel()` waits for the one after those taken. */
  readonly opened: GateSessionChannel[];
  nextChannel(): Promise<GateSessionChannel>;
  /** Every dial socket the adapter drew, with its wire log. */
  readonly sockets: Array<ReturnType<typeof dialSocketTo>>;
  /** The options a `LarWSClientAdapter` needs to dial this gate from `presented`. */
  adapterOptions(over?: Partial<LarWSClientOptions>): LarWSClientOptions;
}

/** One world, one face, one real gate seating channels, and the pair index holding the gate's sovereign pin. */
export async function faceGateRig(): Promise<FaceGateRig> {
  const w = await world();
  const p = await presenter(w, "adapter face");
  const opened: GateSessionChannel[] = [];
  const waiting: Array<(channel: GateSessionChannel) => void> = [];
  let taken = 0;
  const gate = gateOver(w, channelSessionTable((channel) => { opened.push(channel); waiting.shift()?.(channel); }));
  const pins = hearthPinIndex();
  const hearth = "hearth-under-test";
  pins.put(hearth, w.pin);
  const sockets: Array<ReturnType<typeof dialSocketTo>> = [];
  return {
    w, p, gate, pins, hearth, opened, sockets,
    nextChannel() {
      if (taken < opened.length) return Promise.resolve(opened[taken++]!);
      return new Promise((resolve) => waiting.push((channel) => { taken++; resolve(channel); }));
    },
    adapterOptions(over = {}) {
      return {
        url: "ws://gate.test/ws", pins, hearth, nexus: w.pin.nexus, audience: AUDIENCE, deadlines: handDeadlines(), retryInterval: 0,
        presentation: { certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history },
        dialSocket: () => { const met = dialSocketTo(gate); sockets.push(met); return met.socket; },
        ...over,
      };
    },
  };
}
