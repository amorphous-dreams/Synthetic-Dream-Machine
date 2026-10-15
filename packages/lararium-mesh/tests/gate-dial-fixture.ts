/**
 * gate-dial-fixture — THE ONE HELPER a test speaks the gate's handshake through.
 *
 * A suite that needs a socket admitted, a gate played, a dialer played or a presentation bound to a socket
 * asks for it here and names no frame of the handshake itself. The socket's handshake changes ONCE, in one
 * cutover; that cutover edits this file (and the node package's twin, which stands a real gate) and leaves
 * every suite that came through it alone.
 *
 * What a suite holds after it comes through here: a verdict, a key, an admitted socket, a signed
 * presentation. What it never holds: a frame's `type`, a nonce's place in a message, or the bytes a proof
 * signs. A suite that asserts one of those tests the wire's own law and belongs to the wire's own vectors
 * (`OLD_WIRE_VECTORS` in `gate-dial-funnel.test.ts`), which retire with the wire they pin.
 *
 * Test support. No source file imports it.
 */
import {
  authOkBytes, buildAuthResponse, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, isLarAuthMsg,
  isLarAuthOkMsg, isLarChallengeMsg, mintLeafNonce, mkLarAuthOk, mkLarChallenge, runPeerHandshake, signLeafProof,
  signPresented, verifyAuthOk, verifyAuthProof,
  type LeafIdentity, type Presented, type UnsignedPresented,
} from "../src/auth-wire.js";
import { hex, webGetRandomValues } from "../src/crypto.js";
import type { DeviceDelegationTiddler } from "../src/device-delegation.js";
import type { AuthVerifierShore } from "../src/island-protocol.js";
import { LarWSClientAdapter, type LarWSClientOptions } from "../src/lar-ws-client-adapter.js";

type Sign = (bytes: Uint8Array) => Promise<string> | string;

// ── The real dialer ─────────────────────────────────────────────────────────────────────────────

/** Dial a gate as every vessel does: the one client transport, with the identity it proves and the gate it pinned. */
export function dialGate(options: LarWSClientOptions): LarWSClientAdapter {
  return new LarWSClientAdapter(options);
}

/** A dialer whose key stands as its own card: the identity a suite hands `dialGate` when it tests no card. */
export async function dialerIdentity(seed: Uint8Array): Promise<LeafIdentity> {
  const key = await ed25519VerifyingKeyFromSeed(seed);
  return { contactCard: key, peerPubKey: key, sign: ed25519SignerFromSeed(seed) };
}

// ── The dialer's half, over frames a suite carries by hand ──────────────────────────────────────

/** What a dialer brings to one gate. */
export interface GateDialer {
  /** The key the dialer proves. */
  readonly peerPubKey:   string;
  /** The gate key the dialer pinned. */
  readonly gatePubKey:   string;
  /** The audience the dial names. */
  readonly aud:          string;
  readonly sign:         Sign;
  /** The card the dialer presents; its key where a suite names none. */
  readonly contactCard?: string;
  readonly edge?:        DeviceDelegationTiddler;
  /** A presentation, bound to the socket when the dial runs. */
  readonly presented?:   UnsignedPresented;
  readonly leafSign?:    Sign;
}

/** A frame channel: parsed messages in, messages out. */
export interface DialChannel {
  recv(): Promise<unknown>;
  send(message: unknown): void;
}

/** Run the dialer's whole half over a channel, and answer whether the pinned gate passed it. */
export function runDial(channel: DialChannel, dialer: GateDialer): Promise<{ ok: true; nonce: string } | { ok: false; reason: string }> {
  return runPeerHandshake({
    recv: channel.recv, send: channel.send,
    contactCard: dialer.contactCard ?? dialer.peerPubKey, peerPubKey: dialer.peerPubKey, gatePubKey: dialer.gatePubKey,
    aud: dialer.aud, sign: dialer.sign,
    ...(dialer.edge ? { edge: dialer.edge } : {}),
    ...(dialer.presented ? { presented: dialer.presented } : {}),
    ...(dialer.leafSign ? { leafSign: dialer.leafSign } : {}),
  });
}

/** A dialer's answer: an opaque record a suite serializes, keeps or replays. It may ask which slots it fills. */
export type DialerAnswer = Readonly<Record<string, unknown>>;

/**
 * A dialer a suite drives one frame at a time, for the suites that hold a raw socket: it tells the gate's
 * opening frame from its verdict, answers the opening, and reads the verdict against the gate it pinned.
 */
export interface DialerDouble {
  /** Does `frame` open the exchange? */
  opens(frame: unknown): boolean;
  /** The dialer's answer to the gate's opening `frame`, ready to serialize. A suite may keep it to replay it. */
  answer(frame: unknown): Promise<DialerAnswer>;
  /** Does `frame` read as a verdict? Shape alone. */
  admitted(frame: unknown): boolean;
  /** Does `frame` carry the pinned gate's own verdict over the answer this double last gave? */
  verifies(frame: unknown): Promise<boolean>;
}

export function dialerDouble(dialer: GateDialer): DialerDouble {
  let last: { nonce: string; leafNonce: string } | null = null;
  return {
    opens: (frame) => isLarChallengeMsg(frame),
    admitted: (frame) => isLarAuthOkMsg(frame),
    async answer(frame) {
      if (!isLarChallengeMsg(frame)) throw new Error("gate-dial-fixture: the frame opens no exchange");
      const leafNonce = mintLeafNonce();
      const presented: Presented | undefined = dialer.presented && dialer.leafSign
        ? await signPresented({ presented: dialer.presented, nonce: frame.nonce, gatePubKey: dialer.gatePubKey, vesselKey: dialer.peerPubKey, sign: dialer.leafSign })
        : undefined;
      last = { nonce: frame.nonce, leafNonce };
      return { ...await buildAuthResponse({
        contactCard: dialer.contactCard ?? dialer.peerPubKey, nonce: frame.nonce, gatePubKey: dialer.gatePubKey,
        peerPubKey: dialer.peerPubKey, aud: dialer.aud, leafNonce, sign: dialer.sign,
        ...(dialer.edge ? { edge: dialer.edge } : {}),
        ...(presented ? { presented } : {}),
      }) };
    },
    async verifies(frame) {
      if (!isLarAuthOkMsg(frame) || last === null) return false;
      return verifyAuthOk({ ...last, gatePubKey: dialer.gatePubKey, peerPubKey: dialer.peerPubKey, aud: dialer.aud, sig: frame.sig });
    },
  };
}

// ── The gate's half, played by hand ─────────────────────────────────────────────────────────────

/** How a played gate behaves. */
export interface GateDoubleScript {
  /** The seed of the key the gate holds and dialers pin. */
  readonly gateSeed:     Uint8Array;
  readonly aud:          string;
  /**
   * How the gate reads the dialer's proof: `"check"` verifies it under the key the dialer names (or under
   * `peerPubKey`, where the suite fixes whom it expects); `"accept"` passes any well-formed answer, for a
   * suite that tests what follows admission. `"check"` where a suite names none.
   */
  readonly proof?:       "check" | "accept";
  /** The one key the gate expects to prove. Absent: the key the dialer's own card names. */
  readonly peerPubKey?:  string;
  /** A key the gate signs its verdict with IN PLACE of its own: the verdict then proves nothing to a dialer. */
  readonly verdictSeed?: Uint8Array;
}

/** One socket's exchange at a played gate. */
export interface GateExchange {
  /** The frame the gate opens with, serialized. */
  readonly opening: string;
  /**
   * The gate's reading of one frame from the dialer. `read` says whether the frame answers the opening at all:
   * a gate ignores any other frame. `verdict` holds the verdict frame, serialized, or null where the gate stays
   * silent (no answer, a failed proof). `proven` reports the proof's own reading, whatever the gate then does;
   * `peerPubKey` names the key that proved.
   */
  answer(text: string): Promise<{ readonly read: boolean; readonly verdict: string | null; readonly proven: boolean; readonly reason?: string; readonly peerPubKey?: string }>;
}

/** The key a dialer's card names: the card itself where it reads as a key, else its `peerPubKey` field. */
function cardKey(card: string): string {
  if (/^[0-9a-f]{64}$/.test(card)) return card;
  try { return String((JSON.parse(card) as { peerPubKey?: unknown }).peerPubKey ?? ""); } catch { return ""; }
}

/** Play a gate by hand: one `accept()` per socket. */
export async function gateDouble(script: GateDoubleScript): Promise<{ readonly gatePubKey: string; accept(): GateExchange }> {
  const gatePubKey = await ed25519VerifyingKeyFromSeed(script.gateSeed);
  const signVerdict = ed25519SignerFromSeed(script.verdictSeed ?? script.gateSeed);
  return {
    gatePubKey,
    accept() {
      const nonce = hex(webGetRandomValues(new Uint8Array(32)));
      return {
        opening: JSON.stringify(mkLarChallenge(nonce)),
        async answer(text) {
          let message: unknown;
          try { message = JSON.parse(text); } catch { return { read: false, verdict: null, proven: false, reason: "unreadable" }; }
          if (!isLarAuthMsg(message)) return { read: false, verdict: null, proven: false, reason: "no answer to the opening" };
          const peerPubKey = script.peerPubKey ?? cardKey(message.contactCard);
          let proven = true;
          let reason: string | undefined;
          if ((script.proof ?? "check") === "check") {
            const reading = await verifyAuthProof({ nonce, gatePubKey, peerPubKey, aud: script.aud, sig: message.sig });
            proven = reading.ok;
            reason = reading.reason;
          }
          if (!proven) return { read: true, verdict: null, proven, ...(reason ? { reason } : {}), peerPubKey };
          const sig = await signVerdict(authOkBytes({ nonce, leafNonce: message.leafNonce, gatePubKey, peerPubKey, aud: script.aud }));
          return { read: true, verdict: JSON.stringify(mkLarAuthOk(sig)), proven, peerPubKey };
        },
      };
    },
  };
}

/** A frame no gate reads as an answer to its opening: what a suite sends to prove a gate stays silent. */
export function strayAnswerFrame(): string {
  return JSON.stringify({ type: "lar:auth", contactCard: "x", nonce: "wrong" });
}

/** Does this serialized frame open an exchange? For a suite that asserts only THAT a gate opened one. */
export function isGateOpening(text: string): boolean {
  try { return isLarChallengeMsg(JSON.parse(text)); } catch { return false; }
}

// ── The keyholder's floor, without a keyholder ──────────────────────────────────────────────────

/**
 * The verify shore a real gate arms with in a suite that stands no keyholder worker: it reads the dialer's
 * key off its card, checks the dialer's proof under that key for the gate's own key, and then asks `admits`.
 * A proof says WHO; `admits` says whether that key holds standing here. Absent, every proven key passes.
 */
export function provingShore(gatePubKey: string, opts: {
  readonly admits?:       (peerPubKey: string) => boolean;
  readonly sameOperator?: (peerPubKey: string) => boolean;
} = {}): AuthVerifierShore {
  return {
    async verify(cardBytes, bagUrl, _access, proof) {
      if (!proof) return { ok: false, reason: "V3 proof required" };
      const peerPubKey = cardKey(new TextDecoder().decode(cardBytes));
      if (!peerPubKey) return { ok: false, reason: "no peer key in card" };
      const reading = await verifyAuthProof({ nonce: proof.nonce, gatePubKey, peerPubKey, aud: bagUrl, sig: proof.sig });
      if (!reading.ok) return { ok: false, reason: `V3 proof rejected: ${reading.reason ?? "unverified"}` };
      if (opts.admits && !opts.admits(peerPubKey)) return { ok: false, reason: "insufficient capability (not admitted to the daemon bag)" };
      return {
        ok: true, identifier: peerPubKey, proofVerified: true,
        ...(opts.sameOperator?.(peerPubKey) ? { peerClass: "same-operator" as const } : {}),
      };
    },
  };
}

// ── A presentation bound to one socket ──────────────────────────────────────────────────────────

/** The socket a presentation binds to: what the gate issued on it, and the key the dialer proved on it. */
export interface SocketUnderTest {
  readonly nonce:      string;
  readonly gatePubKey: string;
  readonly vesselKey:  string;
}

/** A socket for a suite that reads a presentation with no gate standing. */
export function socketUnderTest(vesselKey: string, over: Partial<Omit<SocketUnderTest, "vesselKey">> = {}): SocketUnderTest {
  return Object.freeze({ nonce: over.nonce ?? "ab".repeat(32), gatePubKey: over.gatePubKey ?? "ee".repeat(32), vesselKey });
}

/** The presenting leaf's proof that binds `presented` to `socket`. */
export async function socketProof(socket: SocketUnderTest, presented: UnsignedPresented | Presented, sign: Sign): Promise<string> {
  return signLeafProof({ presented, nonce: socket.nonce, gatePubKey: socket.gatePubKey, vesselKey: socket.vesselKey, sign });
}

/** `presented`, bound to `socket` by its own leaf. */
export async function presentOnSocket(socket: SocketUnderTest, presented: UnsignedPresented, sign: Sign): Promise<Presented> {
  return signPresented({ presented, nonce: socket.nonce, gatePubKey: socket.gatePubKey, vesselKey: socket.vesselKey, sign });
}
