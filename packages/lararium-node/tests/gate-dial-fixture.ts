/**
 * gate-dial-fixture — the node package's half of THE ONE HELPER a test speaks the gate's handshake through.
 *
 * The platform-blind half lives in mesh (`packages/lararium-mesh/tests/gate-dial-fixture.ts`): the real
 * dialer, a dialer and a gate played by hand, the keyholder's floor without a keyholder, and a presentation
 * bound to a socket. This file re-exports all of it and adds what only a node suite needs: a REAL gate stood
 * over a WebSocket server, and armed.
 *
 * The socket's handshake changes once, in one cutover. That cutover edits these two files and leaves every
 * suite that came through them alone.
 *
 * Test support. No source file imports it.
 */
import type { WebSocketServer } from "ws";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, type AuthVerifierShore } from "@lararium/mesh";
import { DaemonAuthGate, type GateKey, type SocketSorter } from "../src/daemon-auth-gate.js";
import { provingShore } from "../../lararium-mesh/tests/gate-dial-fixture.js";

export * from "../../lararium-mesh/tests/gate-dial-fixture.js";

/** The gate key a seed holds: its verifying key, and the signer of its verdicts. */
export async function gateKeyOf(seed: Uint8Array): Promise<GateKey> {
  return { pubKey: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
}

/** A sorter that answers every proven socket as a stranger: an OPEN gate, for a suite that tests no sort. */
export const strangerSorter: SocketSorter = async () => ({ class: "stranger" });

/** How a suite arms a real gate. */
export interface GateArming {
  /** The gate's own key. */
  readonly gate:   GateKey;
  /** The audience a dial names. */
  readonly aud:    string;
  /** The sorter every proven socket passes before a verdict. A stranger-admitting one where a suite names none. */
  readonly sort?:  SocketSorter;
  /** The verify shore. Absent: the keyholder's floor (`provingShore`), narrowed by `admits`. */
  readonly shore?: AuthVerifierShore;
  /** With no `shore`: which proven keys hold standing. Absent: every proven key. */
  readonly admits?: (peerPubKey: string) => boolean;
}

/** Stand a real gate over `wss`, unarmed: every socket draws silence until `armGate`. */
export function standGate(wss: WebSocketServer, opts: { readonly authTimeoutMs?: number; readonly onRefuse?: (reason: string) => void } = {}): DaemonAuthGate {
  return new DaemonAuthGate(wss as unknown as ConstructorParameters<typeof DaemonAuthGate>[0], {
    authTimeoutMs: opts.authTimeoutMs ?? 300, onRefuse: opts.onRefuse ?? (() => {}),
  });
}

/** Arm a stood gate. */
export function armGate(gate: DaemonAuthGate, arming: GateArming): void {
  const shore = arming.shore ?? provingShore(arming.gate.pubKey, arming.admits ? { admits: arming.admits } : {});
  gate.arm(shore, arming.aud, arming.gate, arming.sort ?? strangerSorter);
}
