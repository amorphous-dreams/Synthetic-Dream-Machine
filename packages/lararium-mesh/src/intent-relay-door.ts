/** One sealed intent submission on the sovereign relay route. */
import { canonicalJsonBytes, defaultCryptoProvider, hexToBytes, type RandomProvider } from "./crypto.js";
import { gateKnock, gatePrologue, readGateBundlePin } from "./gate-bundle.js";
import type { DialSocket } from "./face-dial.js";
import type { SignedIntentEntry } from "./intent-entry.js";
import { NOISE_MAX_MESSAGE_BYTES, noiseInitiate, noiseKeyPair } from "./noise-ik.js";

export const INTENT_RELAY_ROUTE = "/ws/intent-relay";
export const INTENT_RELAY_MAX_PLAINTEXT_BYTES = NOISE_MAX_MESSAGE_BYTES - 16 - 1;
export const INTENT_RELAY_REFUSALS = ["malformed", "face-off", "entry-refused", "delegation-unknown", "delegation-revoked", "delegation-closed", "unknown-frontier", "agent-key", "verb-outside-prefix", "args-outside-policy", "group", "too-large", "fault"] as const;
export type IntentRelayRefusal = (typeof INTENT_RELAY_REFUSALS)[number];
export type IntentRelayResult =
  | { readonly status: "admitted" | "duplicate"; readonly receipt: unknown }
  | { readonly status: "refused"; readonly refusal: IntentRelayRefusal };

const plain = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
function readObject(bytes: Uint8Array): Record<string, unknown> | null {
  if (!(bytes instanceof Uint8Array) || bytes.length < 2 || bytes.length > INTENT_RELAY_MAX_PLAINTEXT_BYTES || bytes[0] !== 0x7b) return null;
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return plain(value) && same(canonicalJsonBytes(value), bytes) ? value : null;
  } catch { return null; }
}
function encode(value: unknown): Uint8Array {
  const bytes = canonicalJsonBytes(value);
  if (bytes.length > INTENT_RELAY_MAX_PLAINTEXT_BYTES) throw new RangeError("intent-relay: one message exceeds the Noise bound");
  return bytes;
}
export function encodeIntentRelaySubmit(entry: SignedIntentEntry): Uint8Array { return encode({ submit: entry }); }
export function readIntentRelaySubmit(bytes: Uint8Array): { ok: true; entry: unknown } | { ok: false } {
  const value = readObject(bytes);
  return value && Object.keys(value).length === 1 && Object.hasOwn(value, "submit") ? { ok: true, entry: value.submit } : { ok: false };
}
export function encodeIntentRelayResult(result: IntentRelayResult): Uint8Array { return encode({ result }); }
export function readIntentRelayResult(bytes: Uint8Array): IntentRelayResult | null {
  const outer = readObject(bytes);
  if (!outer || Object.keys(outer).length !== 1 || !plain(outer.result)) return null;
  const result = outer.result;
  if ((result.status === "admitted" || result.status === "duplicate") && Object.keys(result).length === 2 && Object.hasOwn(result, "receipt")) return result as IntentRelayResult;
  if (result.status === "refused" && Object.keys(result).length === 2 && INTENT_RELAY_REFUSALS.includes(result.refusal as IntentRelayRefusal)) return result as IntentRelayResult;
  return null;
}

/** A caller closes the socket to end a wait; the dial keeps no timer. */
export async function dialIntentRelay(args: { readonly pin: unknown; readonly socket: DialSocket; readonly entry: SignedIntentEntry; readonly random?: RandomProvider }): Promise<IntentRelayResult | { status: "silence" }> {
  const reading = readGateBundlePin(args.pin);
  if (!("pin" in reading) || reading.pin.tier !== "sovereign" || reading.pin.route !== INTENT_RELAY_ROUTE) return { status: "silence" };
  let submit: Uint8Array;
  try { submit = encodeIntentRelaySubmit(args.entry); }
  catch { return { status: "refused", refusal: "too-large" }; }
  const secret = (args.random ?? defaultCryptoProvider).getRandomValues(new Uint8Array(32));
  let pair: ReturnType<typeof noiseKeyPair> | null = null;
  try {
    pair = noiseKeyPair(secret);
    const dial = noiseInitiate({ prologue: gatePrologue(reading.pin), s: pair, rs: hexToBytes(reading.pin.transportKey) });
    await args.socket.open({ knock: gateKnock(reading.pin), message1: dial.message1 });
    const message2 = await args.socket.recv();
    if (message2 === null) return { status: "silence" };
    const opened = dial.readMessage2(message2);
    if (opened.payload.length !== 0) return { status: "silence" };
    args.socket.send(opened.transport.send.seal(submit));
    const frame = await args.socket.recv();
    if (frame === null) return { status: "silence" };
    return readIntentRelayResult(opened.transport.receive.open(frame)) ?? { status: "silence" };
  } catch { return { status: "silence" }; }
  finally { secret.fill(0); pair?.secretKey.fill(0); args.socket.close(); }
}
