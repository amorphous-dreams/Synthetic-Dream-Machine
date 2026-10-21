/**
 * oracle-floor-rig — the two ends of "peers prove first" for suites that stand a real oracle face on its floor
 * gates: the gates the face is handed (one world per Nexus, a session table of the face's own) and a reader that
 * dials one of them through the house's one dialer (`pullAndVerifyFlow`).
 *
 * It names no frame of any handshake. A suite holds a world (its pin and its posture), a presenter (a face's
 * certificate, signer and arm) and a verdict.
 *
 * Test support. No source file imports it.
 */
import WsSocket from "ws";
import {
  pullAndVerifyFlow, ed25519VerifyingKeyFromSeed, ORACLE_SOCKET_ROUTE, type FederationPosture, type GateSessionTable,
} from "@lararium/mesh";
import { wsDialSocket, type WsLike } from "../../lararium-mesh/src/ws-dial-socket.js";
import { world, presenter, place, AUDIENCE, type World, type Presenter, type Place } from "../../lararium-mesh/tests/face-gate-fixture.js";

export { presenter, place, AUDIENCE, type World, type Presenter, type Place };

/** The `gates` argument a face is mounted with: one floor gate per Nexus, each seating through the face's table. */
export function floorGates(nexuses: readonly string[], opts: { posture?: FederationPosture } = {}): {
  readonly worlds: World[];
  readonly gates: (sessions: GateSessionTable) => Promise<ReadonlyArray<{ gate: World["gate"]; pin: World["pin"] }>>;
} {
  const worlds: World[] = [];
  return {
    worlds,
    gates: async (sessions) => {
      const stood: World[] = [];
      for (const nexus of nexuses) {
        stood.push(await world({ nexus, tier: "floor", route: ORACLE_SOCKET_ROUTE, sessions, ...(opts.posture ? { posture: opts.posture } : {}) }));
      }
      worlds.push(...stood);
      return stood.map((w) => ({ gate: w.gate, pin: w.pin }));
    },
  };
}

/** The reader's dial socket: a real `ws` client under the mesh's bounded dial wrapper. */
export const dialer = (url: string) => wsDialSocket(url, (u, protocols) => new WsSocket(u, protocols, { perMessageDeflate: false }) as unknown as WsLike);

/** A reader's deadlines on the process clock: a lapse well past any honest answer. */
export function realDeadlines(ms = 2_000) {
  return { draw(lapse: () => void) { const t = setTimeout(lapse, ms); return { cancel: () => clearTimeout(t) }; } };
}

/** Pull the oracle from `base` as presenter `p` at world `w`, naming the publisher's key out of band. */
export async function pullFloor<T = unknown>(
  base: string, w: World, p: Presenter,
  over: { arm?: Presenter["arm"] | null; publisherSeed: Uint8Array; deadlineMs?: number },
) {
  return pullAndVerifyFlow<T>(base, {
    pins: { get: (key) => (key.route === ORACLE_SOCKET_ROUTE && key.tier === "floor" && key.nexus === w.pin.nexus ? w.pin : null) },
    hearth: "hearth-one", nexus: w.pin.nexus,
    presentation: { certificate: p.certificate, signer: p.signer, arm: over.arm === undefined ? p.arm : over.arm, history: p.history },
    audience: AUDIENCE, deadlines: realDeadlines(over.deadlineMs), verifyingKey: await ed25519VerifyingKeyFromSeed(over.publisherSeed), dialSocket: dialer,
  });
}

/** A gate-native pull of a peer's oracle, in the shape a carriage is handed (`pullOracle`): the peer's endpoint and
 *  its publisher key in, the verified pull out. Every peer is dialed at `w`'s floor pin as presenter `p`. */
export function oraclePuller<T = unknown>(w: World, p: Presenter, over: { arm?: Presenter["arm"] | null } = {}) {
  return (peer: string, publisherKey: string) => pullAndVerifyFlow<T>(peer, {
    pins: { get: (key) => (key.route === ORACLE_SOCKET_ROUTE && key.tier === "floor" && key.nexus === w.pin.nexus ? w.pin : null) },
    hearth: "hearth-one", nexus: w.pin.nexus,
    presentation: { certificate: p.certificate, signer: p.signer, arm: over.arm === undefined ? p.arm : over.arm, history: p.history },
    audience: AUDIENCE, deadlines: realDeadlines(), verifyingKey: publisherKey, dialSocket: dialer,
  });
}

/** Pull the oracle from `base` as a faceless PLACE `pl` at world `w`: its own key and, unless `arm: null`, the quorum's
 *  `carry` act over it (the place arm, lar:///ha.ka.ba/lararium/mesh/place-floor-pin#/the-place-arm). */
export async function pullFloorAsPlace<T = unknown>(
  base: string, w: World, pl: Place,
  over: { arm?: Place["arm"] | null; publisherSeed: Uint8Array; deadlineMs?: number },
) {
  return pullAndVerifyFlow<T>(base, {
    pins: { get: (key) => (key.route === ORACLE_SOCKET_ROUTE && key.tier === "floor" && key.nexus === w.pin.nexus ? w.pin : null) },
    hearth: "hearth-one", nexus: w.pin.nexus,
    presentation: { kind: "place", placeKey: pl.key, sign: pl.sign, arm: over.arm === undefined ? pl.arm : over.arm },
    audience: AUDIENCE, deadlines: realDeadlines(over.deadlineMs), verifyingKey: await ed25519VerifyingKeyFromSeed(over.publisherSeed), dialSocket: dialer,
  });
}
