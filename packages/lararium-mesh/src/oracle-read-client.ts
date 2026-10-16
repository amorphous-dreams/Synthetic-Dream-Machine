/**
 * oracle-read-client — the CONSUMER side of the Two-Faced Substrate: pull a peer's oracle read-face over
 * the SEALED channel, run the reader rule, and load it as a CRDT.
 *
 * PEERS PROVE FIRST. The read-face answers no stranger: the pointer and its snapshot cross only a channel whose dialer
 * passed the floor gate's exchange (`dialFaceGate` at the floor tier: a Noise IK flight to the pinned floor key, the
 * face's sealed presentation, a signed finish, and the gate's signed verdict). A dialer that cannot present reads
 * nothing, and an HTTP request for the oracle meets the vessel's closed door.
 *
 * EVERY DIALER PINS TWICE. The gate's pin comes from the pair index the caller injects (hearth, Nexus, "/oracle",
 * "floor"), never from the wire; the publisher's key (`verifyingKey`) is named out of band and is NOT the gate's key
 * (the floor key rests outside the vessel key), so a socket that proved to one gate cannot be fed another vessel's map.
 *
 * The reader then VERIFIES before trusting (signature · causal ancestry · publisher binding · rehash == cid ·
 * heads == signed frontier). Isomorphic: the global `WebSocket` + `Automerge.load`; a browser vessel reads exactly so.
 *
 * THE VERBS. After the verdict the face sends ONE "session" message whose body is the signed pointer frame
 * (`ORACLE_POINTER_FRAME`, JSON as it always spoke), then ONE message carrying the snapshot bytes that pointer names
 * (kind "session" or "sync"), then closes. A face with no pointer yet closes without a message. The challenge
 * and auth frames the old wire carried are gone: the gate does that work.
 *
 * Stands specified in code until the oracle face's server half is wired (cutover slice C/D).
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/lararium-identity#/the-oracle-plane
 */

import { load as automergeLoad, getHeads, type Doc } from "@automerge/automerge";
import { verifyOraclePointer, verifyOracleSnapshotBytes, type OraclePointer } from "./oracle-substrate.js";
import type { DialPinKey } from "./admit-gate-pin.js";
import type { DialSocket } from "./face-dial.js";
import { dialFaceGate, dialPlaceGate } from "./face-dial.js";
import type { GateBundlePin } from "./gate-bundle.js";
import type { PlaceArm } from "./gate-exchange.js";
import { dialedChannel, type GateSessionChannel } from "./gate-session-channel.js";
import type { FacePresentation } from "./lar-ws-client-adapter.js";
import { wsDialSocket } from "./ws-dial-socket.js";

/**
 * THE ORACLE SOCKET ROUTE AND FRAME, SPELLED ONCE.
 *
 * A server in `lararium-node` answers this route (behind its knock) and this client dials it. Spelled twice, the two move
 * only when someone remembers both — and they do not run in one process, so nothing forces the memory: a vessel
 * and a Herm built from different commits would simply miss each other, which reads as a peer being down rather
 * than as a rename. Mesh holds them because node imports mesh and never the reverse.
 *
 * After the gate's verdict the face sends ONE "session" message (`ORACLE_POINTER_FRAME`, the signed pointer, JSON),
 * then ONE message (the snapshot bytes that pointer names), then closes. A face with no pointer yet closes
 * without a message.
 */
export const ORACLE_SOCKET_ROUTE  = "/oracle";
export const ORACLE_POINTER_FRAME = "lar:oracle-pointer";

export interface OraclePointerFrame {
  readonly type:    typeof ORACLE_POINTER_FRAME;
  readonly pointer: OraclePointer;
}

export interface OraclePullResult<T = unknown> {
  readonly ok:       boolean;
  readonly reason?:  string;
  readonly pointer?: OraclePointer;
  readonly doc?:     Doc<T>;
  readonly cid?:     string;
}

/**
 * What a FACELESS reader presents at a floor gate: a place's own key, its signing door, and the Nexus quorum's counted
 * `carry` act over that key (house reading "The faceless reader", place-floor-pin.ts). A place with no contract at the
 * pinned Nexus presents none and sorts as any stranger does: silence where the Nexus reads private.
 */
export interface PlaceOraclePresentation {
  readonly kind:     "place";
  readonly placeKey: string;
  readonly sign:     (image: Uint8Array) => Promise<Uint8Array> | Uint8Array;
  readonly arm:      PlaceArm | null;
}

export interface OraclePullOpts {
  /** The pair index the floor pin is read from, injected: the reader keeps no global. */
  readonly pins:              { get(key: DialPinKey): GateBundlePin | null };
  /** The hearth the reader reaches, by its true name, and the Nexus it stands at (hex of the AID's bytes). */
  readonly hearth:            string;
  readonly nexus:             string;
  /** What the reader presents at the floor gate: a face (its certificate, the session's signer, at most one arm and its
   *  history), or a faceless place (its key and its carriage contract at this Nexus). */
  readonly presentation:      FacePresentation | PlaceOraclePresentation;
  /** The audience the dial names. */
  readonly audience:          string;
  /** The reader's deadline source (the caller owns the clock): one for the dial, one for each wait on a message. */
  readonly deadlines:         { draw(lapse: () => void): { cancel(): void } };
  /** The publisher's key — the key the pointer must be signed by. NOT the gate's key. */
  readonly verifyingKey:      string;
  /** Locally held pointer identities; a missing parent is unavailable. */
  readonly knownPointerIds?: readonly string[];
  /** A fresh dial socket (tests inject one). Default: the global `WebSocket` on the oracle route with the knock and flight in its upgrade. */
  readonly dialSocket?:       (url: string) => DialSocket;
}

/** The oracle socket URL for a peer's base URL — http(s) maps to ws(s); a ws(s) base rides as given. */
export function oracleSocketUrl(baseUrl: string): string {
  const u = new URL(baseUrl.replace(/\/+$/, "") + ORACLE_SOCKET_ROUTE);
  if (u.protocol === "http:") u.protocol = "ws:";
  else if (u.protocol === "https:") u.protocol = "wss:";
  return u.href;
}

function parseFrame(bytes: Uint8Array): unknown {
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; } catch { return undefined; }
}

function isOraclePointerFrame(v: unknown): v is OraclePointerFrame {
  return typeof v === "object" && v !== null
    && (v as { type?: unknown }).type === ORACLE_POINTER_FRAME
    && typeof (v as { pointer?: unknown }).pointer === "object";
}

/** The next message, or null when the channel ends or the deadline lapses first (the channel is then closed). */
async function nextWithin(channel: GateSessionChannel, deadlines: OraclePullOpts["deadlines"]): Promise<{ kind: string; bytes: Uint8Array } | null> {
  let draw: { cancel(): void } | undefined;
  const lapsed = new Promise<null>((resolve) => { draw = deadlines.draw(() => { channel.close(); resolve(null); }); });
  try { return await Promise.race([channel.recv(), lapsed]); } finally { draw?.cancel(); }
}

/**
 * Pull + verify + load the oracle doc from a peer at `baseUrl`, proving `opts.identity` at its gate first.
 * Never throws (the pin read, the url, the dial and the pull are each guarded); a failure returns `{ ok: false, reason }`
 * (and the pointer, when it got that far).
 * Order: dial → prove → pointer frame → verify → snapshot frame → rehash → load → heads.
 */
export async function pullAndVerifyOracle<T = unknown>(
  baseUrl: string,
  opts: OraclePullOpts,
): Promise<OraclePullResult<T>> {
  const tier = "floor" as const;
  // NEVER THROWS: an index that cannot read the key, a URL that does not parse and a dial that throws each answer by name.
  let pin: GateBundlePin | null;
  try { pin = opts.pins.get({ hearth: opts.hearth, nexus: opts.nexus, route: ORACLE_SOCKET_ROUTE, tier }); }
  catch { return { ok: false, reason: "the pin index could not read this hearth and Nexus (pin-unreadable)" }; }
  if (pin === null) return { ok: false, reason: "no floor pin held for this hearth and Nexus (pin-absent)" };
  // The pin must stand where the read asked: at this Nexus, on the oracle route, at the floor. An index that answers with
  // a pin standing elsewhere dials nothing.
  if (pin.nexus !== opts.nexus || pin.route !== ORACLE_SOCKET_ROUTE || pin.tier !== tier) {
    return { ok: false, reason: "the pin held stands at another Nexus, route or tier than this read asks (pin-other-nexus)" };
  }
  let url: string;
  try { url = oracleSocketUrl(baseUrl); } catch { return { ok: false, reason: "the base url does not parse" }; }
  let socket: DialSocket;
  let outcome: Awaited<ReturnType<typeof dialFaceGate>> | Awaited<ReturnType<typeof dialPlaceGate>>;
  try {
    socket = (opts.dialSocket ?? wsDialSocket)(url);
    const shown = opts.presentation;
    outcome = "kind" in shown && shown.kind === "place"
      ? await dialPlaceGate({ pin, tier, socket, audience: opts.audience, placeKey: shown.placeKey, sign: shown.sign, arm: shown.arm, deadlines: opts.deadlines })
      : await dialFaceGate({
        pin, tier, socket, audience: opts.audience, certificate: (shown as FacePresentation).certificate, signer: (shown as FacePresentation).signer,
        arm: (shown as FacePresentation).arm, history: (shown as FacePresentation).history, deadlines: opts.deadlines,
        ...((shown as FacePresentation).carry ? { carry: (shown as FacePresentation).carry! } : {}),
      });
  } catch { return { ok: false, reason: "dial failed: the dial threw" }; }
  if (outcome.state === "silence") return { ok: false, reason: "dial failed: the gate said nothing" };
  if (outcome.state === "refused") return { ok: false, reason: `dial refused here: ${outcome.refusal}` };
  if (outcome.state !== "verified") return { ok: false, reason: `gate answered ${outcome.state}` };

  const channel = dialedChannel({ transport: outcome.transport, socket: { send: (f) => socket.send(f), recv: () => socket.recv(), cut: () => socket.close() } });
  try {
    return await pullOverChannel<T>(channel, opts);
  } catch {
    return { ok: false, reason: "the pull threw" };
  } finally {
    channel.close();
  }
}

async function pullOverChannel<T>(channel: GateSessionChannel, opts: OraclePullOpts): Promise<OraclePullResult<T>> {
  // 1. the signed pointer — verify BEFORE trusting, bound to the publisher this reader pinned.
  const first = await nextWithin(channel, opts.deadlines);
  if (first === null || first.kind !== "session") return { ok: false, reason: "peer published no pointer" };
  const frame = parseFrame(first.bytes);
  if (!isOraclePointerFrame(frame)) return { ok: false, reason: "peer published no pointer" };
  const pointer = frame.pointer;
  const pointerVerdict = await verifyOraclePointer(pointer, {
    verifyingKey: opts.verifyingKey,
    ...(opts.knownPointerIds !== undefined ? { knownPointerIds: opts.knownPointerIds } : {}),
  });
  if (!pointerVerdict.ok) return { ok: false, reason: `pointer rejected: ${pointerVerdict.reason}`, pointer };

  // 2. the content-addressed snapshot — rehash == cid (the host cannot lie about the bytes).
  const second = await nextWithin(channel, opts.deadlines);
  if (second === null || (second.kind !== "session" && second.kind !== "sync")) return { ok: false, reason: "peer sent no snapshot", pointer };
  const bytes = second.bytes;
  if (!(await verifyOracleSnapshotBytes(bytes, pointer.cid)))
    return { ok: false, reason: "snapshot hash mismatch (cid does not match bytes)", pointer };

  // 3. load read-only.
  let doc: Doc<T>;
  try {
    doc = automergeLoad<T>(bytes);
  } catch (e) {
    return { ok: false, reason: `automerge load failed: ${e instanceof Error ? e.message : String(e)}`, pointer };
  }

  const loadedHeads = [...new Set(getHeads(doc) as string[])].sort();
  const signedHeads = [...new Set(pointer.heads)].sort();
  if (loadedHeads.length !== signedHeads.length || loadedHeads.some((head, i) => head !== signedHeads[i]))
    return { ok: false, reason: "snapshot heads mismatch (signed frontier does not match bytes)", pointer };

  return { ok: true, pointer, doc, cid: pointer.cid };
}
