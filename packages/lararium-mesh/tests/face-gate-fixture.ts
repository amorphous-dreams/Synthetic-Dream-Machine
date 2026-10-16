/**
 * face-gate-fixture — a gate, its collaborators and its dialers, all in one process.
 *
 * A WORLD stands one gate for one Nexus on one route over memory-backed doubles: a custody root that
 * derives, a held Nexus root with a real quorum, the house's own presenter-verifier, a shadow ring and a
 * grant ring a suite sets by hand, a sorter that folds the house's own class rule over ONE Nexus's posture,
 * a session table that records, and a deadline a suite fires by hand. A PRESENTER holds one face's chain,
 * a live session, a session signer and the face's admit. A WIRE joins a dialer to the gate and keeps every
 * frame that crossed, in the clear, as an observer would read it.
 *
 * Every key here derives from a label: synthetic, repeatable, and no key any vessel holds.
 */
import * as ed25519 from "@noble/ed25519";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import type { CarriageEntry } from "../src/carriage-registry.js";
import { hex, hexToBytes, utf8Bytes } from "../src/crypto.js";
import { checkVesselChain, foldWithdrawals, type VesselFaceKeyCustody, type WithdrawalMemory } from "../src/face-authority.js";
import { dialFaceGate, dialPlaceGate, type DialSocket, type FaceDialArgs, type FaceDialOutcome, type PlaceDialOutcome } from "../src/face-dial.js";
import {
  makeFaceGate, memoryBackedWithdrawals, presentedAdmitReader, type FaceGate, type GateOutcome, type GateSession,
  type GateDeadlines, type GateSessionTable, type GateShadowReading, type GateSocket, type GateSortInput, type GateSortVerdict, type GateWithdrawalMemory,
  type HeldNexusRoot, type GateSilenceDetail, type GateSilenceReason,
} from "../src/face-gate.js";
import type { FaceScope, NexusAid, VesselFaceCertificate } from "../src/face-proof-subjects.js";
import { classifySocket, type FederationPosture } from "../src/federation-gate.js";
import {
  custodyRootDoor, deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, gateKnock, gatePrologue, sovereignGateRoot, sovereignRoute,
  type GateBundle, type GateBundlePin, type GateRootDoor, type GateTier,
} from "../src/gate-bundle.js";
import {
  GATE_FRAME, encodeGatePresentation, encodePlacePresentation, gateFinishPayload, gateFrame, gateParts, gatePlaceFinishImage,
  gatePresentationDigest, type GatePresentation, type PlaceArm, type PlacePresentation, type PresentationArm,
} from "../src/gate-exchange.js";
import type { PeerClass } from "../src/island-protocol.js";
import { makeMultiSigQuorumVerifier, type KahuQuorumSeats, type KapaeAntigenEntry } from "../src/kapae-antigen.js";
import { noiseInitiate, noiseKeyPair, type NoiseTransport } from "../src/noise-ik.js";
import { SessionTable, sessionBinding, type CapabilityProfile } from "../src/session-contract.js";
import { supplySessionFace, type FaceGrantReading } from "../src/session-face.js";
import { mintSessionSigner, type SessionSigner } from "../src/session-signer.js";
import { chain, vesselOf, type Chain, type Pair } from "./face-proof-fixture.js";
import { carriageAct, kahuRoster } from "./fixtures/carriage.js";

/** Each tier's root over a bare derive: the door a seat mints, minted here for a vector. */
const sov = (d: GateRootDoor) => sovereignGateRoot(custodyRootDoor(d));
const flo = (d: GateRootDoor) => floorGateRoot(floorKeyDoor(d));
export const AUDIENCE = "lar:///ha.ka.ba/bags/daemon";
export const GROUP = "b7f1c2a9d4e60381";

/** A root's derive door, stood in: one child per registered name, as the custody seat and the floor key derive. */
export function rootOf(label: string): GateRootDoor {
  const bytes = sha256(utf8Bytes(`face-gate-fixture root ${label}`));
  return { derive: (domain) => hkdf(sha256, bytes, new Uint8Array(0), utf8Bytes(domain), 32) };
}

const seedOf = (label: string): Uint8Array => sha256(utf8Bytes(`face-gate-fixture ${label}`));

// ── The wire ────────────────────────────────────────────────────────────────────────────────────

/** Everything that crossed one socket, as a passive observer reads it. */
export interface WireLog {
  /** The first flight, in the clear. */
  flight:    { knock: string; message1: Uint8Array } | null;
  /** Every frame the gate sent, in order. */
  toDialer:  Uint8Array[];
  /** Every frame the dialer sent after its flight, in order. */
  toGate:    Uint8Array[];
  /** How many times the gate cut the socket. */
  cuts:      number;
  /** How many times the dialer closed it. */
  closes:    number;
  /** Every send, either way, in order: who sent, and how many bytes. */
  order:     string[];
  /** Does the gate stand waiting on a frame the dialer has not sent? */
  readonly gateWaits: boolean;
}

class Queue {
  readonly #held: Array<Uint8Array | null> = [];
  readonly #waiting: Array<(frame: Uint8Array | null) => void> = [];
  #ended = false;
  push(frame: Uint8Array | null): void {
    if (this.#ended) return;
    if (frame === null) this.#ended = true;
    const waiter = this.#waiting.shift();
    if (waiter) waiter(frame); else this.#held.push(frame);
    if (frame === null) for (const rest of this.#waiting.splice(0)) rest(null);
  }
  take(): Promise<Uint8Array | null> {
    if (this.#held.length > 0) return Promise.resolve(this.#held.shift()!);
    if (this.#ended) return Promise.resolve(null);
    return new Promise((resolve) => this.#waiting.push(resolve));
  }
  /** Does a reader stand waiting on a frame nobody sent yet? */
  get starved(): boolean { return this.#waiting.length > 0; }
}

/** One socket, both ends in this process. `accepted` resolves with the gate's end once a flight left. */
export function wire(): { dial: DialSocket; accepted: Promise<GateSocket>; log: WireLog } {
  const toGate = new Queue(), toDialer = new Queue();
  const log: WireLog = { flight: null, toDialer: [], toGate: [], cuts: 0, closes: 0, order: [], get gateWaits() { return toGate.starved; } };
  let accept!: (socket: GateSocket) => void;
  const accepted = new Promise<GateSocket>((resolve) => { accept = resolve; });
  const dial: DialSocket = {
    open(flight) {
      log.flight = { knock: flight.knock, message1: Uint8Array.from(flight.message1) };
      accept({
        flight: { knock: flight.knock, message1: Uint8Array.from(flight.message1) },
        send(frame) { log.toDialer.push(Uint8Array.from(frame)); log.order.push(`gate:${frame.length}`); toDialer.push(Uint8Array.from(frame)); },
        recv: () => toGate.take(),
        cut() { log.cuts++; toDialer.push(null); toGate.push(null); },
        sent: () => log.toDialer.length,
      } as GateSocket);
    },
    send(frame) { log.toGate.push(Uint8Array.from(frame)); log.order.push(`dial:${frame.length}`); toGate.push(Uint8Array.from(frame)); },
    recv: () => toDialer.take(),
    close() { log.closes++; toGate.push(null); toDialer.push(null); },
  };
  return { dial, accepted, log };
}

/** A deadline source a suite fires by hand. No clock stands behind it. */
export function handDeadlines(): { draw(lapse: () => void): { cancel(): void }; fire(): void; drawn: number; cancelled: number; standing: number } {
  const lapses = new Set<() => void>();
  const source = {
    drawn: 0, cancelled: 0,
    get standing() { return lapses.size; },
    draw(lapse: () => void) {
      source.drawn++;
      lapses.add(lapse);
      return { cancel() { if (lapses.delete(lapse)) source.cancelled++; } };
    },
    fire() { for (const lapse of [...lapses]) { lapses.delete(lapse); lapse(); } },
  };
  return source;
}

/** Let the event loop turn: every microtask and every queued frame lands. */
export async function settle(turns = 3): Promise<void> {
  for (let turn = 0; turn < turns; turn++) await new Promise((resolve) => setTimeout(resolve, 1));
}

/**
 * Wait until the gate can do no more by itself: its run ended, or it stands waiting on a frame nobody sent.
 * No span of time decides it, so a slow machine reads the same answer a fast one reads.
 */
export async function gateAtRest(accepting: Promise<GateOutcome>, log: WireLog): Promise<void> {
  let ended = false;
  void accepting.then(() => { ended = true; });
  while (!ended && !log.gateWaits) await settle(1);
  // The gate that waits has drained every frame sent so far; one more turn lets a frame in flight land first.
  await settle();
  while (!ended && !log.gateWaits) await settle(1);
}

// ── The world: one gate and what it asks ────────────────────────────────────────────────────────

const KAHU = [seedOf("kahu one"), seedOf("kahu two"), seedOf("kahu three")];
const WARDENS = [seedOf("warden one"), seedOf("warden two")];

export interface World {
  readonly nexus:       NexusAid;
  readonly bundle:      GateBundle;
  readonly pin:         GateBundlePin;
  readonly gate:        FaceGate;
  readonly deadlines:   ReturnType<typeof handDeadlines>;
  readonly withdrawals: GateWithdrawalMemory;
  /** The Nexus root this vessel holds; a suite may swap it, or set it null. */
  held:                 HeldNexusRoot | null;
  posture:              FederationPosture;
  /** Face keys a standing shadow sets aside. */
  readonly aside:       Set<string>;
  /** Whether this vessel reads its own fleet at all: false stands as the floor. */
  fleetReadable:        boolean;
  /** Vessel face keys a dyad shadow sets aside from the fleet. */
  readonly fleetAside:  Set<string>;
  /** Place keys whose carriage edge a standing shadow sets aside. */
  readonly placeAside:  Set<string>;
  /** The private grants this vessel's ring holds, by face key. */
  readonly grants:      Map<string, FaceGrantReading>;
  /** What the sorter answers IN PLACE of the house's rule, where a suite sets one. */
  sorterAnswer:         ((input: GateSortInput) => GateSortVerdict | null | Promise<GateSortVerdict | null>) | null;
  /** Everything the collaborators got asked, in order. */
  readonly asked:       string[];
  readonly sorted:      GateSortInput[];
  /** The sessions whose seat the gate opened, in order. */
  readonly attached:    Array<{ socket: GateSocket; session: GateSession }>;
  /** The sessions the gate took a seat for and then abandoned. */
  readonly abandoned:   GateSession[];
  /** How many frames the gate had sent on each socket when the table took its session. */
  readonly sentAtAttach: number[];
  /** A fault the session table throws IN PLACE of taking a session, where a suite sets one. */
  tableFault:           Error | null;
  /** A fault a seat throws when the gate opens it, where a suite sets one. */
  seatFault:            Error | null;
  readonly refusals:    string[];
  readonly epoch:       string;
  admitFor(face: Pair, parents?: readonly string[]): Promise<CarriageEntry>;
  revokeFor(face: Pair, parents: readonly string[]): Promise<CarriageEntry>;
  /** The quorum's `carry` act over a place's key, with the place's own carrier seal. */
  carryFor(placeSeed: Uint8Array, parents?: readonly string[]): Promise<CarriageEntry>;
  uncarryFor(placeSeed: Uint8Array, parents: readonly string[]): Promise<CarriageEntry>;
}

/** Stand one gate for `nexus` on `route`, under the vessel root `root`. */
export async function world(opts: { nexus?: string; route?: string; root?: GateRootDoor; tier?: GateTier; posture?: FederationPosture; maxPending?: number; audience?: string; withdrawals?: GateWithdrawalMemory; gateBundle?: (derived: GateBundle) => GateBundle; onRefuse?: (reason: GateSilenceReason, detail?: GateSilenceDetail) => void; admitRefusal?: string; lapses?: GateDeadlines; sessions?: GateSessionTable } = {}): Promise<World> {
  const nexus = (opts.nexus ?? "nexus-a.synthetic") as NexusAid;
  const epoch = `epoch-${nexus}`;
  // Each Nexus seats its own quorum: an admit one Nexus signed counts under no other's roster.
  const kahuSeeds = KAHU.map((seed) => sha256(new Uint8Array([...seed, ...utf8Bytes(nexus)])));
  const roster: KahuQuorumSeats = await kahuRoster(kahuSeeds, 2, epoch);
  const antigenRoster = await kahuRoster(WARDENS, 2, epoch);
  const door = opts.root ?? rootOf("vessel one");
  const bundle = opts.tier === "floor"
    ? deriveGateBundle(flo(door), utf8Bytes(nexus), floorRoute(opts.route ?? "/shelf"))
    : deriveGateBundle(sov(door), utf8Bytes(nexus), sovereignRoute(opts.route ?? "/ws"));
  const deadlines = handDeadlines();
  const withdrawals = opts.withdrawals ?? memoryBackedWithdrawals();
  const w: World = {
    nexus, bundle, pin: bundle.pin, deadlines, withdrawals, epoch,
    held: { nexus, revision: "board-heads-1", roster, denyBoard: [] as CarriageEntry[], antigen: [] as KapaeAntigenEntry[], antigenRoster, antigenVerifier: makeMultiSigQuorumVerifier(), handOvers: [] },
    posture: opts.posture ?? "private",
    aside: new Set(), fleetReadable: true, fleetAside: new Set(), placeAside: new Set(), grants: new Map(), sorterAnswer: null,
    asked: [], sorted: [], attached: [], abandoned: [], sentAtAttach: [], tableFault: null, seatFault: null, refusals: [],
    admitFor: (face, parents = []) => carriageAct(face.secret, "admit", { kahu: kahuSeeds.slice(0, 2), epoch, parents }),
    revokeFor: (face, parents) => carriageAct(face.secret, "revoke", { kahu: kahuSeeds.slice(0, 2), epoch, parents }),
    carryFor: (placeSeed, parents = []) => carriageAct(placeSeed, "carry", { kahu: kahuSeeds.slice(0, 2), epoch, parents }),
    uncarryFor: (placeSeed, parents) => carriageAct(placeSeed, "uncarry", { kahu: kahuSeeds.slice(0, 2), epoch, parents }),
    gate: undefined as unknown as FaceGate,
  };
  const admits = presentedAdmitReader(() => w.held);
  (w as { gate: FaceGate }).gate = makeFaceGate({
    // A suite that bends the deadline source hands its own to the gate; `w.deadlines` stays the hand-fired twin.
    bundle: opts.gateBundle ? opts.gateBundle(bundle) : bundle, nexus, audience: opts.audience ?? AUDIENCE, deadlines: opts.lapses ?? deadlines, withdrawals,
    ...(opts.maxPending !== undefined ? { maxPending: opts.maxPending } : {}),
    admits: {
      read: (arm) => { w.asked.push("admit"); return opts.admitRefusal === undefined ? admits.read(arm) : Promise.resolve({ refusal: opts.admitRefusal }); },
      readPlace: (arm) => { w.asked.push("contract"); return admits.readPlace(arm); },
    },
    shadows: {
      consult({ scope, vesselFaceKey }): GateShadowReading {
        w.asked.push("shadow");
        return { aside: w.aside.has(scope.faceKey), fleetAside: !w.fleetReadable || w.fleetAside.has(vesselFaceKey) };
      },
      consultPlace({ placeKey }) { w.asked.push("shadow-place"); return { aside: w.placeAside.has(placeKey) }; },
    },
    grants: { grantFor: (scope) => { w.asked.push("grant"); return w.grants.get(scope.faceKey) ?? null; } },
    sorter: {
      async sort(input) {
        w.asked.push("sort");
        w.sorted.push(input);
        if (w.sorterAnswer) return w.sorterAnswer(input);
        // The house's own class rule, over THIS Nexus's posture alone.
        const cls: PeerClass | null = classifySocket({
          sameOperator: input.sameGroup !== null && !input.fleetAside,
          contracted: input.admit !== null || input.place !== null,
          walker: input.arm?.kind === "grant" || input.arm?.kind === "claim",
          answersStrangers: w.posture === "open",
        });
        const nym = input.admit ? input.scope!.faceKey : input.place ? input.placeKey! : null;
        return cls === null ? null : { class: cls, ...(nym ? { standing: { nym, aid: nexus } } : {}) };
      },
    },
    // A suite that stands a real session table hands it in; the recording table stands otherwise.
    sessions: opts.sessions ?? {
      attach(socket, session) {
        w.asked.push("attach");
        if (w.tableFault) throw w.tableFault;
        w.sentAtAttach.push((socket as GateSocket & { sent(): number }).sent());
        return {
          open() { w.asked.push("open"); if (w.seatFault) throw w.seatFault; w.attached.push({ socket, session }); },
          abandon() { w.asked.push("abandon"); w.abandoned.push(session); },
        };
      },
    },
    onRefuse: (reason, detail) => { w.refusals.push(reason); opts.onRefuse?.(reason, detail); },
  });
  return w;
}

// ── A presenter: one face's chain, a live session and its signer ────────────────────────────────

export interface Presenter {
  readonly chain:       Chain;
  readonly scope:       FaceScope;
  readonly certificate: VesselFaceCertificate;
  readonly vessel:      Pair;
  readonly signer:      SessionSigner;
  readonly table:       SessionTable;
  readonly sessionId:   string;
  /** The face's admit at the world's Nexus. */
  readonly admit:       CarriageEntry;
  readonly arm:         PresentationArm;
  /** What this vessel holds of its face's withdrawals; a suite replaces it as the vessel learns. */
  history:              WithdrawalMemory;
}

const custodyOf = (by: Pair): VesselFaceKeyCustody => ({ signAsVesselFace: (_scope, _key, image) => ed25519.signAsync(image, by.secret) });

export function memoryOf(scope: FaceScope, events: unknown = []): WithdrawalMemory {
  const fold = foldWithdrawals(scope, events);
  if (!("memory" in fold)) throw new Error(`the history folds no memory: ${fold.refusal}`);
  return fold.memory;
}

/**
 * Open a session that wears `c`'s face on `vessel`'s own certificate, and mint its signer: the session's
 * face comes from the one supplier, and the signer from the one mint, as a vessel's own session open does.
 */
async function seat(c: Chain, vessel: Pair, certificate: VesselFaceCertificate, profile: CapabilityProfile, admitRef: string): Promise<{ signer: SessionSigner; table: SessionTable; sessionId: string }> {
  // The order of acts: the vessel's chain verifies, the supplier answers the face, the session opens, the signer mints.
  const verdict = checkVesselChain({ admitted: c.scope, certificate, memory: memoryOf(c.scope) });
  if (verdict.verdict !== "verified") throw new Error(`the vessel's own chain reads ${verdict.verdict}`);
  const supply = supplySessionFace({
    chain: verdict.chain, vesselFaceKey: vessel.key,
    admit: { verdict: { state: "held", reason: "held", nym: c.scope.faceKey }, head: c.scope.faceKey, nexus: c.scope.nexus, admitRef, revision: "board-heads-1" },
    grant: { personaGroup: GROUP, faceKey: c.scope.faceKey, nexus: c.scope.nexus, revision: "group-heads-1" },
  });
  if (!("face" in supply)) throw new Error(`no face supplied: ${supply.refusal}`);
  const table = new SessionTable("owner-epoch-synthetic");
  const binding = sessionBinding("socket");
  const opened = table.open(binding, supply.face, profile);
  if (!opened.ok) throw new Error(opened.refusal);
  const minted = await mintSessionSigner({ table, binding, session: opened.session, certificate, apart: [], custody: custodyOf(vessel) });
  if (!("signer" in minted)) throw new Error(`no signer minted: ${minted.refusal}`);
  return { signer: minted.signer, table, sessionId: opened.session.sessionId };
}

/** A face admitted at `w`'s Nexus, its first vessel, a live session and that session's signer. */
export async function presenter(w: World, label: string, profile: CapabilityProfile = "face"): Promise<Presenter> {
  const c = await chain(label, w.nexus, profile);
  const admit = await w.admitFor(c.face);
  const seated = await seat(c, c.vessel, c.certificate, profile, "admit-cid-synthetic");
  return { chain: c, scope: c.scope, certificate: c.certificate, vessel: c.vessel, admit, arm: { kind: "admit", admit, lineage: [] }, history: memoryOf(c.scope), ...seated };
}

/** A further vessel of `of`'s face: its own key, its own certificate, its own session and signer. */
export async function sibling(of: Presenter, label: string, profile: CapabilityProfile = "face"): Promise<Presenter> {
  const next = await vesselOf(of.chain, label);
  const seated = await seat(of.chain, next.vessel, next.certificate, profile, "admit-cid-synthetic");
  return { ...of, certificate: next.certificate, vessel: next.vessel, history: memoryOf(of.scope), ...seated };
}

// ── Dialing ─────────────────────────────────────────────────────────────────────────────────────

/** A dial its own side refused before any flight left: no gate ran, so no gate refusal stands to report. */
export const UNREACHED = Object.freeze({ outcome: "unreached" } as const);
/** What the gate came to, or that no flight ever reached it. */
export type GateReading = GateOutcome | typeof UNREACHED;

export interface Dialed {
  readonly outcome: FaceDialOutcome;
  readonly gate:    GateReading;
  readonly log:     WireLog;
}

/**
 * One honest dial, start to end. A dial the gate answers ends by itself; a dial the gate meets with silence
 * ends when this helper fires the deadline, after it has read that the gate cut nothing before it.
 */
export async function dial(w: World, p: Presenter, over: Partial<FaceDialArgs> = {}): Promise<Dialed & { cutsBeforeLapse: number; pendingBeforeLapse: number }> {
  const { dial: socket, accepted, log } = wire();
  const outcome = dialFaceGate({ pin: w.pin, tier: w.pin.tier, socket, audience: AUDIENCE, certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history, deadlines: handDeadlines(), ...over });
  // The gate's own run ends by itself on an honest dial: it answers, or it reaches its silence and waits.
  const accepting = accepted.then((gateSocket) => w.gate.accept(gateSocket));
  const early = await Promise.race([accepting.then(() => null), outcome]);
  if (early !== null && early.state === "refused") return { outcome: early, gate: UNREACHED, log, cutsBeforeLapse: log.cuts, pendingBeforeLapse: w.gate.pending };
  const gate = await accepting;
  await settle();
  const cutsBeforeLapse = log.cuts, pendingBeforeLapse = w.gate.pending;
  w.deadlines.fire();
  return { outcome: await outcome, gate, log, cutsBeforeLapse, pendingBeforeLapse };
}

/** What a hand-driven dial may bend. */
export interface Bend {
  /** The pin the flight gets written to. The world's own where a suite names none. */
  pin?:          GateBundlePin;
  /** The knock sent, in place of the pin's own. */
  knock?:        string;
  /** A payload for message one. */
  payload?:      Uint8Array;
  /** Rewrite the presentation before it gets sealed. */
  presentation?: (presentation: GatePresentation) => unknown;
  /** Rewrite the presentation's BYTES after the finish got signed over the honest ones. */
  bytesAfterFinish?: (bytes: Uint8Array) => Uint8Array;
  /** Rewrite the finish signature's bytes. */
  finish?:       (signature: Uint8Array) => Uint8Array;
  /** Sign the finish over another handshake hash, bundle digest or audience. */
  finishOver?:   Partial<{ handshakeHash: Uint8Array; bundleDigest: string; audience: string }>;
  /** Stop after message two: send no presentation at all. */
  stopAfterMessage2?: boolean;
  /** Send the presentation and no finish. */
  noFinish?:     boolean;
}

/**
 * A dial driven by hand through the exchange's own pieces, so a suite can bend any one of them. It answers
 * the wire's log and the gate's own outcome; whatever the gate sent back stays sealed in the log.
 */
export async function bentDial(w: World, p: Presenter, bend: Bend = {}, over: Partial<Pick<FaceDialArgs, "arm" | "carry" | "audience">> = {}): Promise<{ gate: GateOutcome; log: WireLog; cutsBeforeLapse: number; pendingBeforeLapse: number; transport: NoiseTransport | null }> {
  const pin = bend.pin ?? w.pin;
  const { dial: socket, accepted, log } = wire();
  const flight = noiseInitiate({ prologue: gatePrologue(pin), s: noiseKeyPair(seedOf(`static ${Math.random()}`)), rs: hexToBytes(pin.transportKey), ...(bend.payload ? { payload: bend.payload } : {}) });
  void socket.open({ knock: bend.knock ?? gateKnock(pin), message1: flight.message1 });
  const accepting = w.gate.accept(await accepted);
  let transport: NoiseTransport | null = null;
  const speak = (async () => {
    const message2 = await socket.recv();
    if (message2 === null) return;
    transport = flight.readMessage2(message2).transport;
    if (bend.stopAfterMessage2) return;
    const audience = over.audience ?? AUDIENCE;
    const honest: GatePresentation = {
      certificate: p.certificate, sessionCertificate: p.signer.certificate, arm: over.arm === undefined ? p.arm : over.arm,
      frontier: p.history.frontier, carried: over.carry ?? p.history.line, audience,
    };
    const signedBytes = encodeGatePresentation((bend.presentation ? bend.presentation(honest) : honest) as GatePresentation);
    const signed = await p.signer.sign("finish", gateFinishPayload({
      handshakeHash: transport.handshakeHash, bundleDigest: w.bundle.digest, presentationDigest: gatePresentationDigest(signedBytes), audience, ...bend.finishOver,
    }));
    if (!("signature" in signed)) throw new Error(`the signer refused: ${signed.refusal}`);
    const sentBytes = bend.bytesAfterFinish ? bend.bytesAfterFinish(signedBytes) : signedBytes;
    for (const part of gateParts(GATE_FRAME.presentationPart, GATE_FRAME.presentationEnd, sentBytes)) socket.send(transport.send.seal(part));
    if (bend.noFinish) return;
    const signature = hexToBytes(signed.signature);
    socket.send(transport.send.seal(gateFrame(GATE_FRAME.finish, bend.finish ? bend.finish(signature) : signature)));
  })();
  // The gate ends its own run, or it waits on a frame this dial never sends: either way it stays quiet.
  await Promise.race([speak, accepting]);
  await gateAtRest(accepting, log);
  const cutsBeforeLapse = log.cuts, pendingBeforeLapse = w.gate.pending;
  w.deadlines.fire();
  const gate = await accepting;
  await speak;
  return { gate, log, cutsBeforeLapse, pendingBeforeLapse, transport };
}

/** Replay a recorded first flight on a fresh socket, and send nothing after it. */
export async function replayFlight(w: World, flight: { knock: string; message1: Uint8Array }): Promise<{ gate: GateOutcome; log: WireLog; cutsBeforeLapse: number; pendingBeforeLapse: number }> {
  const { dial: socket, accepted, log } = wire();
  void socket.open(flight);
  const accepting = w.gate.accept(await accepted);
  await gateAtRest(accepting, log);
  const cutsBeforeLapse = log.cuts, pendingBeforeLapse = w.gate.pending;
  w.deadlines.fire();
  return { gate: await accepting, log, cutsBeforeLapse, pendingBeforeLapse };
}

// ── A faceless place ────────────────────────────────────────────────────────────────────────────

/** A herm or a carrier: one key, and the quorum's carriage contract over it at the world's Nexus. */
export interface Place {
  readonly seed:     Uint8Array;
  readonly key:      string;
  readonly contract: CarriageEntry;
  readonly arm:      PlaceArm;
  sign(image: Uint8Array): Promise<Uint8Array>;
}

export async function place(w: World, label: string): Promise<Place> {
  const seed = seedOf(`place ${label}`);
  const key = hex(await ed25519.getPublicKeyAsync(seed));
  const contract = await w.carryFor(seed);
  return { seed, key, contract, arm: { kind: "place", contract, lineage: [] }, sign: (image) => ed25519.signAsync(image, seed) };
}

/** One honest dial of a place, start to end, as `dial` runs a face's. */
export async function dialPlace(w: World, pl: Place, over: { arm?: PlaceArm | null; audience?: string; tier?: GateTier } = {}): Promise<{ outcome: PlaceDialOutcome; gate: GateReading; log: WireLog; cutsBeforeLapse: number; pendingBeforeLapse: number }> {
  const { dial: socket, accepted, log } = wire();
  const outcome = dialPlaceGate({ pin: w.pin, tier: w.pin.tier, socket, audience: over.audience ?? AUDIENCE, placeKey: pl.key, sign: pl.sign, arm: over.arm === undefined ? pl.arm : over.arm, deadlines: handDeadlines(), ...(over.tier ? { tier: over.tier } : {}) });
  const accepting = accepted.then((gateSocket) => w.gate.accept(gateSocket));
  const early = await Promise.race([accepting.then(() => null), outcome]);
  if (early !== null && early.state === "refused") return { outcome: early, gate: UNREACHED, log, cutsBeforeLapse: log.cuts, pendingBeforeLapse: w.gate.pending };
  const gate = await accepting;
  await settle();
  const cutsBeforeLapse = log.cuts, pendingBeforeLapse = w.gate.pending;
  w.deadlines.fire();
  return { outcome: await outcome, gate, log, cutsBeforeLapse, pendingBeforeLapse };
}

/**
 * A place's dial driven by hand: a suite may rewrite the presentation, sign the finish with another key, or
 * sign it over another image. The gate's own run always ends by itself here.
 */
export async function bentPlaceDial(w: World, pl: Place, bend: {
  presentation?: (honest: PlacePresentation) => unknown;
  signWith?:     Uint8Array;
  image?:        (parts: Parameters<typeof gatePlaceFinishImage>[0]) => Uint8Array;
} = {}): Promise<{ gate: GateOutcome; log: WireLog; cutsBeforeLapse: number; pendingBeforeLapse: number }> {
  const { dial: socket, accepted, log } = wire();
  const flight = noiseInitiate({ prologue: gatePrologue(w.pin), s: noiseKeyPair(seedOf(`static ${Math.random()}`)), rs: hexToBytes(w.pin.transportKey) });
  void socket.open({ knock: gateKnock(w.pin), message1: flight.message1 });
  const accepting = w.gate.accept(await accepted);
  const message2 = await socket.recv();
  if (message2 !== null) {
    const { transport } = flight.readMessage2(message2);
    const honest: PlacePresentation = { placeKey: pl.key, arm: pl.arm, audience: AUDIENCE };
    const bytes = encodePlacePresentation((bend.presentation ? bend.presentation(honest) : honest) as PlacePresentation);
    const parts = { handshakeHash: transport.handshakeHash, bundleDigest: w.bundle.digest, presentationDigest: gatePresentationDigest(bytes), audience: AUDIENCE, placeKey: pl.key };
    const signature = await ed25519.signAsync(bend.image ? bend.image(parts) : gatePlaceFinishImage(parts), bend.signWith ?? pl.seed);
    for (const part of gateParts(GATE_FRAME.presentationPart, GATE_FRAME.presentationEnd, bytes)) socket.send(transport.send.seal(part));
    socket.send(transport.send.seal(gateFrame(GATE_FRAME.finish, signature)));
  }
  const gate = await accepting;
  await settle();
  const cutsBeforeLapse = log.cuts, pendingBeforeLapse = w.gate.pending;
  w.deadlines.fire();
  return { gate, log, cutsBeforeLapse, pendingBeforeLapse };
}
