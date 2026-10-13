/**
 * face-dial — THE DIALER's half of the gate exchange: one session presents one face to one pinned gate.
 *
 * A dial holds the gate's pin before it sends a byte. It then:
 *
 *   1. mints a fresh X25519 static key for this dial alone, writes Noise IK message one to the pinned
 *      transport key under the pin's prologue, and sends it beside the knock. No card, no key of the face
 *      and no key of the vessel rides that flight: the static key means nothing past this dial;
 *   2. reads message two, which proves the gate holds the pinned key, and holds a sealed channel;
 *   3. presents, sealed: this vessel's certificate under the face, the session's certificate, at most one
 *      arm, and the frontier of the face's withdrawal history with the events it carries;
 *   4. signs the finish with the session's signer: this handshake's hash, the pin's digest, the
 *      presentation's own bytes and the audience;
 *   5. reads the gate's answer and believes it only under the pinned signing key, for this handshake.
 *
 * WHAT A DIAL ANSWERS. `verified` hands back the sealed channel. `unconfirmed`, `withdrawn`, `incomplete`
 * and `forked` hand back what the gate named, UNREAD: the caller folds each event through the withdrawal's
 * own reader before it believes one, and acts on nothing shared until it presents again. `silence` says the
 * pinned gate signed nothing this dial could read: a gate that refuses says nothing at all, so a dial never
 * learns why. `refused` names a fault on this side, before or beside the wire.
 *
 * ITS OWN DEADLINE. A gate that refuses stays quiet until its own deadline cuts the socket. A dial draws a
 * deadline of its own beside it, so a hostile endpoint that answers a flight and then waits forever holds
 * no dial open and no static key alive.
 *
 * WHAT IT CARRIES BY DEFAULT. The whole line of the history its vessel holds: a gate that learned nothing
 * newer then learns it from the first honest vessel of the face to dial. A caller that carries less reads
 * `incomplete` from a gate behind it, and presents again with the whole line.
 *
 * Platform-blind: a node and a browser both dial through it, each over its own socket.
 * Stands specified in code until the socket cutover wires it; out of the package barrel till then.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-gate-exchange
 */
import { defaultCryptoProvider, hex, hexToBytes, utf8Bytes, type RandomProvider } from "./crypto.js";
import { isWithdrawalMemory, type WithdrawalMemory } from "./face-authority.js";
import {
  own, readCertificate, sameFaceScope, type FaceWithdrawal, type VesselFaceCertificate,
} from "./face-proof-subjects.js";
import { gateBundleDigest, gateKnock, gatePrologue, readGateBundlePin, readGateSignature, type GateBundlePin, type GateTier } from "./gate-bundle.js";
import {
  GATE_FRAME, encodeGatePresentation, encodePlacePresentation, gateFinishPayload, gateFrame, gatePartReader, gateParts,
  gatePlaceFinishImage, gatePresentationDigest, gateVerdictImage, readGateAnswer, type PlaceArm, type PresentationArm,
} from "./gate-exchange.js";
import { noiseInitiate, noiseKeyPair, type NoiseTransport } from "./noise-ik.js";
import type { SessionSigner } from "./session-signer.js";

/** One socket, as a dial sees it. A browser carries the first flight in its upgrade; a node sends it raw. */
export interface DialSocket {
  /** Send the first flight: the knock and Noise IK message one. */
  open(flight: { readonly knock: string; readonly message1: Uint8Array }): void | Promise<void>;
  send(frame: Uint8Array): void;
  /** The next frame, or null once the gate cut the socket. */
  recv(): Promise<Uint8Array | null>;
  close(): void;
}

export interface FaceDialArgs {
  /** The gate's pin, held before the dial. */
  readonly pin:         unknown;
  /** The tier the caller means to reach. A pin of the other tier dials nothing: a floor gate's `verified` seats the floor alone. */
  readonly tier:        GateTier;
  readonly socket:      DialSocket;
  /** What the dial asks to reach. */
  readonly audience:    string;
  /** This vessel's own certificate under the face the session wears. */
  readonly certificate: VesselFaceCertificate;
  /** The session's signer. Its certificate names the session key and the hand's profile. */
  readonly signer:      SessionSigner;
  /** At most one arm. */
  readonly arm:         PresentationArm | null;
  /** What this vessel holds of its face's withdrawal history. */
  readonly history:     WithdrawalMemory;
  /** The events to carry. The history's whole line where a caller names none. */
  readonly carry?:      readonly FaceWithdrawal[];
  /**
   * The dial's own deadline: the source calls `lapse` once, later, unless cancelled. A gate that answers
   * a flight and then says nothing forever would otherwise hold this dial, and its static key, open. The
   * source owns the clock; this module reads none.
   */
  readonly deadlines:   { draw(lapse: () => void): { cancel(): void } };
  readonly random?:     RandomProvider;
}

export const FACE_DIAL_REFUSALS = [
  "pin-refused",              // the pin fails its own reading
  "pin-other-tier",           // the pin names another tier than the caller means to reach
  "history-foreign",          // no memory the withdrawal fold built
  "certificate-refused",      // this vessel's certificate fails its reading
  "pin-other-nexus",          // the pin names another Nexus than the face's scope
  "signer-other-chain",       // the signer's certificate stands under another face, Nexus or vessel key
  "signer-refused",           // the signer signed no finish: its session closed, switched or stands frozen
] as const;
export type FaceDialRefusal = (typeof FACE_DIAL_REFUSALS)[number];

export type FaceDialOutcome =
  /** The gate attached the session: every later frame rides `transport`. */
  | { readonly state: "verified"; readonly transport: NoiseTransport }
  | { readonly state: "unconfirmed"; readonly frontier: unknown; readonly events: readonly unknown[] }
  | { readonly state: "withdrawn"; readonly events: readonly unknown[] }
  | { readonly state: "incomplete"; readonly frontier: unknown }
  | { readonly state: "forked"; readonly events: readonly unknown[] }
  /** The pinned gate signed nothing this dial could read. */
  | { readonly state: "silence" }
  /** A fault on this side. `sent` says whether a first flight left before it. */
  | { readonly state: "refused"; readonly refusal: FaceDialRefusal; readonly sent: boolean };


/**
 * Present one face to one pinned gate. It never throws: a socket that faults reads as silence. A dial that
 * ends in anything but `verified` closes its socket: both ends discard a dial that attached nothing.
 */
export async function dialFaceGate(args: FaceDialArgs): Promise<FaceDialOutcome> {
  // A lapse ends the dial whatever its socket does: it closes the socket, overwrites the dial's static key and
  // answers silence, so a socket whose own promises never settle holds nothing open.
  const keys: DialKeys = { wipe: () => {} };
  let lapse!: (outcome: FaceDialOutcome) => void;
  const lapsed = new Promise<FaceDialOutcome>((resolve) => { lapse = resolve; });
  const deadline = args.deadlines.draw(() => {
    try { args.socket.close(); } catch { /* already gone */ }
    keys.wipe();
    lapse({ state: "silence" });
  });
  try {
    const outcome = await Promise.race([present(args, keys), lapsed]);
    if (outcome.state !== "verified") { try { args.socket.close(); } catch { /* already gone */ } }
    return outcome;
  } finally {
    deadline.cancel();
  }
}

/** The dial's own key, as its deadline reaches it. */
interface DialKeys { wipe: () => void }

async function present(args: FaceDialArgs, keys: DialKeys): Promise<FaceDialOutcome> {
  const refused = (refusal: FaceDialRefusal, sent = false): FaceDialOutcome => ({ state: "refused", refusal, sent });
  const pinned = readGateBundlePin(args.pin);
  if (!("pin" in pinned)) return refused("pin-refused");
  const pin: GateBundlePin = pinned.pin;
  if (pin.tier !== args.tier) return refused("pin-other-tier");
  if (!isWithdrawalMemory(args.history)) return refused("history-foreign");
  const certificate = readCertificate(args.certificate);
  if (!own(certificate, "read")) return refused("certificate-refused");
  const scope = certificate.read.scope;
  if (hex(utf8Bytes(scope.nexus)) !== pin.nexus) return refused("pin-other-nexus");
  const sessionCertificate = args.signer.certificate;
  if (!sameFaceScope(sessionCertificate.scope, scope) || sessionCertificate.vesselFaceKey !== certificate.read.vesselFaceKey || !sameFaceScope(args.history.scope, scope)) {
    return refused("signer-other-chain");
  }

  // A static key for this dial alone: it names nobody, and it drops when the dial ends.
  const staticSecret = (args.random ?? defaultCryptoProvider).getRandomValues(new Uint8Array(32));
  const staticPair = noiseKeyPair(staticSecret);
  keys.wipe = () => { staticSecret.fill(0); staticPair.secretKey.fill(0); };
  const { socket } = args;
  try {
    const dial = noiseInitiate({ prologue: gatePrologue(pin), s: staticPair, rs: hexToBytes(pin.transportKey) });
    await socket.open({ knock: gateKnock(pin), message1: dial.message1 });
    const message2 = await socket.recv();
    if (message2 === null) return { state: "silence" };
    const answered = dial.readMessage2(message2);
    if (answered.payload.length !== 0) return { state: "silence" };      // message two carries nothing: a verdict there reads as no gate's
    const transport = answered.transport;

    const presentation = encodeGatePresentation({
      certificate: certificate.read, sessionCertificate, arm: args.arm,
      frontier: args.history.frontier, carried: args.carry ?? args.history.line, audience: args.audience,
    });
    const bundleDigest = gateBundleDigest(pin);
    const signed = await args.signer.sign("finish", gateFinishPayload({
      handshakeHash: transport.handshakeHash, bundleDigest, presentationDigest: gatePresentationDigest(presentation), audience: args.audience,
    }));
    if (!own(signed, "signature")) return refused("signer-refused", true);
    for (const part of gateParts(GATE_FRAME.presentationPart, GATE_FRAME.presentationEnd, presentation)) socket.send(transport.send.seal(part));
    socket.send(transport.send.seal(gateFrame(GATE_FRAME.finish, hexToBytes(signed.signature))));

    // The answer, then the gate's signature over it. Anything else, or nothing, reads as silence.
    const reader = gatePartReader(GATE_FRAME.answerPart, GATE_FRAME.answerEnd);
    let answer: Uint8Array | null = null;
    while (answer === null) {
      const frame = await socket.recv();
      if (frame === null) return { state: "silence" };
      const pushed = reader.push(transport.receive.open(frame));
      if (pushed === "refused") return { state: "silence" };
      answer = pushed;
    }
    const last = await socket.recv();
    if (last === null) return { state: "silence" };
    const verdict = transport.receive.open(last);
    if (verdict.length !== 65 || verdict[0] !== GATE_FRAME.verdict) return { state: "silence" };
    if (!readGateSignature(pin, gateVerdictImage({ handshakeHash: transport.handshakeHash, bundleDigest, answer }), verdict.subarray(1))) return { state: "silence" };
    const read = readGateAnswer(answer);
    if (read === null) return { state: "silence" };
    switch (read.state) {
      case "verified":    return { state: "verified", transport };
      case "unconfirmed": return { state: "unconfirmed", frontier: read.frontier, events: read.events ?? [] };
      case "withdrawn":   return { state: "withdrawn", events: read.events ?? [] };
      case "incomplete":  return { state: "incomplete", frontier: read.frontier };
      case "forked":      return { state: "forked", events: read.events ?? [] };
    }
  } catch {
    // A socket that faults, a frame that opens nothing, a flight no gate answered: all read as silence.
    return { state: "silence" };
  } finally {
    keys.wipe();
  }
}

// ── A faceless place dials ──────────────────────────────────────────────────────────────────────

export interface PlaceDialArgs {
  readonly pin:       unknown;
  /** The tier the place means to reach. */
  readonly tier:      GateTier;
  readonly socket:    DialSocket;
  readonly audience:  string;
  /** The place's own key, bare lower-case hex. */
  readonly placeKey:  string;
  /** The place key's own signing door: the 64 signature bytes over exactly the image handed in. */
  readonly sign:      (image: Uint8Array) => Promise<Uint8Array> | Uint8Array;
  /** The place's carriage contract for the pinned Nexus, or null where it holds none. */
  readonly arm:       PlaceArm | null;
  readonly deadlines: { draw(lapse: () => void): { cancel(): void } };
  readonly random?:   RandomProvider;
}

/** A place hears `verified` or nothing: it holds no face, so no state of a face's history answers it. */
export type PlaceDialOutcome =
  | { readonly state: "verified"; readonly transport: NoiseTransport }
  | { readonly state: "silence" }
  | { readonly state: "refused"; readonly refusal: "pin-refused" | "pin-other-tier" };

/**
 * A faceless place presents its own key to one pinned gate: the same flight, the same sealed channel and
 * the same deadline a face's dial keeps, with the place's presentation and a finish its own key signs
 * under the place finish's name. It never throws.
 */
export async function dialPlaceGate(args: PlaceDialArgs): Promise<PlaceDialOutcome> {
  const pinned = readGateBundlePin(args.pin);
  if (!("pin" in pinned)) return { state: "refused", refusal: "pin-refused" };
  const pin = pinned.pin;
  if (pin.tier !== args.tier) return { state: "refused", refusal: "pin-other-tier" };
  const staticSecret = (args.random ?? defaultCryptoProvider).getRandomValues(new Uint8Array(32));
  const staticPair = noiseKeyPair(staticSecret);
  const wipe = (): void => { staticSecret.fill(0); staticPair.secretKey.fill(0); };
  const { socket } = args;
  let lapse!: (outcome: PlaceDialOutcome) => void;
  const lapsed = new Promise<PlaceDialOutcome>((resolve) => { lapse = resolve; });
  const deadline = args.deadlines.draw(() => { try { socket.close(); } catch { /* already gone */ } wipe(); lapse({ state: "silence" }); });
  const speak = async (): Promise<PlaceDialOutcome> => {
    try {
      const dial = noiseInitiate({ prologue: gatePrologue(pin), s: staticPair, rs: hexToBytes(pin.transportKey) });
      await socket.open({ knock: gateKnock(pin), message1: dial.message1 });
      const message2 = await socket.recv();
      if (message2 === null) return { state: "silence" };
      const answered = dial.readMessage2(message2);
      if (answered.payload.length !== 0) return { state: "silence" };
      const transport = answered.transport;
      const presentation = encodePlacePresentation({ placeKey: args.placeKey, arm: args.arm, audience: args.audience });
      const bundleDigest = gateBundleDigest(pin);
      const signature = await args.sign(gatePlaceFinishImage({
        handshakeHash: transport.handshakeHash, bundleDigest, presentationDigest: gatePresentationDigest(presentation), audience: args.audience, placeKey: args.placeKey,
      }));
      for (const part of gateParts(GATE_FRAME.presentationPart, GATE_FRAME.presentationEnd, presentation)) socket.send(transport.send.seal(part));
      socket.send(transport.send.seal(gateFrame(GATE_FRAME.finish, signature)));
      const answer = gatePartReader(GATE_FRAME.answerPart, GATE_FRAME.answerEnd).push(transport.receive.open((await socket.recv()) ?? new Uint8Array(0)));
      if (answer === null || answer === "refused") return { state: "silence" };
      const verdict = transport.receive.open((await socket.recv()) ?? new Uint8Array(0));
      if (verdict.length !== 65 || verdict[0] !== GATE_FRAME.verdict) return { state: "silence" };
      if (!readGateSignature(pin, gateVerdictImage({ handshakeHash: transport.handshakeHash, bundleDigest, answer }), verdict.subarray(1))) return { state: "silence" };
      return readGateAnswer(answer)?.state === "verified" ? { state: "verified", transport } : { state: "silence" };
    } catch {
      return { state: "silence" };
    } finally {
      wipe();
    }
  };
  try {
    const outcome = await Promise.race([speak(), lapsed]);
    if (outcome.state !== "verified") { try { socket.close(); } catch { /* already gone */ } }
    return outcome;
  } finally {
    deadline.cancel();
  }
}
