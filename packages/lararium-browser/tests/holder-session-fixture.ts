/**
 * A face's session as a tab presents it to the holder: the countersigned edge and the atom's signature over the
 * port's own challenge. A witness drives the holder core with fake ports and these helpers.
 */
import { buildDeviceDelegation, type DeviceDelegationTiddler } from "../../lararium-mesh/src/device-delegation.js";
import { faceAtomKeyFromSeed, type FaceAtomKey } from "../../lararium-mesh/src/face-atom.js";
import { signHolderSessionProof } from "../../lararium-mesh/src/holder-session-proof.js";
import type { HolderPort } from "../src/shared-holder-core.js";

export type Message = Record<string, unknown>;

export interface FaceFixture { readonly group: string; readonly atom: FaceAtomKey; readonly edge: DeviceDelegationTiddler }

/** One face: a persona root and an atom (scratch seeds) with the edge the root and atom sign between them. */
export async function faceFixture(group: string, rootByte = 41, atomByte = 51): Promise<FaceFixture> {
  const atomSeed = new Uint8Array(32).fill(atomByte);
  const atom = faceAtomKeyFromSeed(atomSeed, group);
  const edge = await buildDeviceDelegation({ personaRootSeed: new Uint8Array(32).fill(rootByte), atomSeed, hearthTrueName: "", boundEpoch: 1 });
  return { group, atom, edge };
}

/** A fake holder port: what it received, what a tab sends through it, and the holder's verdict as an event. */
export function fakePort() {
  const listeners = new Set<(event: MessageEvent) => void>();
  const received: Message[] = [];
  const waiters = new Set<(message: Message) => void>();
  const endpoint: HolderPort = {
    postMessage: (message) => { received.push(message as Message); for (const waiter of [...waiters]) waiter(message as Message); },
    addEventListener: (_type, listener) => { listeners.add(listener); },
    start: () => {},
  };
  const hello = (): Message & { ownerEpoch: string; sessionId: string; generation: number; nonce: string } =>
    received.find((m) => m.kind === "holder:hello") as never;
  const envelope = () => { const { ownerEpoch, sessionId, generation } = hello(); return { ownerEpoch, sessionId, generation }; };
  const sendRaw = (data: unknown): void => { for (const listener of listeners) listener({ data, ports: [] } as unknown as MessageEvent); };
  const send = (message: Message): void => sendRaw({ ...envelope(), ...message });
  const messages = (kind: string) => received.filter((m) => m.kind === kind || m.type === kind);
  /** Resolves with the holder's next admission verdict on this port: the product's own event, never a clock. */
  const verdict = (): Promise<Message> => new Promise((resolve) => {
    const waiter = (message: Message): void => {
      if (message.kind !== "holder:admitted" && message.kind !== "holder:refused") return;
      waiters.delete(waiter); resolve(message);
    };
    waiters.add(waiter);
  });
  return { endpoint, received, hello, envelope, send, sendRaw, messages, verdict };
}

export type FakePort = ReturnType<typeof fakePort>;

/** Admit a connected port as a member of a face's house, answering the port's challenge with the face's atom. */
export async function admitPort(tab: FakePort, face: FaceFixture): Promise<Message> {
  const h = tab.hello();
  const signature = await signHolderSessionProof(face.atom, {
    ownerEpoch: h.ownerEpoch, sessionId: h.sessionId, nonce: h.nonce, personaGroup: face.group,
  });
  const answered = tab.verdict();
  tab.send({ type: "session:open", personaGroup: face.group, edge: face.edge, signature });
  return answered;
}
