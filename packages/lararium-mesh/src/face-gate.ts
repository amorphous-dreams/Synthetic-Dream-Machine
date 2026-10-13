/**
 * face-gate — THE GATE, behind interfaces: one face proven at one Nexus on one route, and no vessel behind it.
 *
 * A gate stands per (Nexus, route) and holds that pair's bundle. It runs the whole exchange against a
 * socket it cannot see into and collaborators it only asks:
 *
 *   1. THE DEADLINE gets drawn at accept, once, before the gate reads a byte.
 *   2. THE KNOCK must name this gate's own bundle. A wrong knock draws nothing.
 *   3. THE FIRST FLIGHT (Noise IK message one, empty payload) must decrypt under the bundle's transport key
 *      and prologue. Until it does the gate emits NOTHING. It buys provisional work alone: the same bytes
 *      replay, so the gate attaches nothing and performs no act on its strength.
 *   4. The gate answers MESSAGE TWO, empty: no verdict rides it.
 *   5. THE PRESENTATION and THE SIGNED FINISH arrive sealed. The gate reads the two certificates, checks
 *      the audience, and verifies the finish: the session key signed THIS handshake's hash, this bundle's
 *      digest and these presentation bytes. A recorder of a first flight holds none of that.
 *   6. ONE ARM AT MOST gets read. An admit goes to the admit reader, which answers the verifier's own
 *      verdict against a root this vessel holds; an arm that names another key than the face key, or an
 *      admit that reads anything but held at this Nexus, draws nothing.
 *   7. THE CHAIN gets checked against what this gate has learned of the face's withdrawals. A gate learns
 *      and keeps events only under a face key whose admit it just read held.
 *   8. Past a `verified` chain: THE SHADOW RING gets consulted, then THE SORTER, once, before any verdict.
 *   9. THE VERDICT follows the finish and never precedes it. The session table takes the session first and
 *      sends nothing; the gate then signs its answer with the bundle's signing key and sends it sealed; only
 *      then does the session open. A dialer never holds a verdict for a session the table refused.
 *
 * WHAT A PRESENTER HEARS. A named answer (`verified`, `unconfirmed`, `withdrawn`, `incomplete`, `forked`)
 * goes only to a presenter whose three signatures verified under a face key whose admit reads held here.
 * Everyone else hears message two at most, and then nothing: a wrong audience, a broken chain, a failed
 * finish, an arm that does not hold, a shadowed presenter, a stranger at a private gate and a sorter's
 * refusal all read alike. The gate cuts the socket when its one deadline lapses and never before, so how
 * long it stayed quiet says nothing of which check failed. The cause goes to the local `onRefuse` alone.
 *
 * WHAT THE GATE NEVER KEEPS. It holds denials and never certificates: the session it attaches names the
 * face key, the session key, the profile and the class, and no vessel's face-scoped key. It keeps no
 * inventory of a face's vessels (lar:///ha.ka.ba/lares/api/pono/face-proof#/named-leaks).
 *
 * WHAT THE COLLABORATORS OWE. The socket carries frames; the deadline source draws one lapse per accept
 * and reads its own clock, so no clock enters this module; the admit reader verifies an admit against a
 * held root; the shadow ring and the grant ring answer from the vessel's own folds; the sorter classes;
 * the withdrawal memory accretes; the session table attaches. Where a gate's withdrawal memory rests
 * stands owed: `memoryBackedWithdrawals` keeps it in memory and persists nothing.
 *
 * Stands specified in code until the socket cutover wires it; out of the package barrel till then.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-gate-exchange
 */
import {
  carriageEntryActCid, verifyPresentedAdmit, type CarriageEntry, type PresentedLineageAct,
} from "./carriage-registry.js";
import { hex, utf8Bytes } from "./crypto.js";
import {
  checkFaceChain, foldWithdrawals, heldWithdrawals, isWithdrawalMemory, learnWithdrawals, type WithdrawalMemory,
} from "./face-authority.js";
import {
  own, readCertificate, readSessionCertificate, readSessionSignature, sameFaceScope,
  type FaceScope, type NexusAid, type SessionKey, type VesselFaceKey,
} from "./face-proof-subjects.js";
import type { GateBundle } from "./gate-bundle.js";
import {
  GATE_FRAME, encodeGateAnswer, gateFinishPayload, gateFrame, gatePartReader, gateParts, gateVerdictImage,
  readGatePresentation, type GateAnswer, type PresentationArm,
} from "./gate-exchange.js";
import type { PeerClass } from "./island-protocol.js";
import type { KahuQuorumSeats, KapaeAntigenEntry, QuorumVerifier } from "./kapae-antigen.js";
import type { NoiseTransport } from "./noise-ik.js";
import type { CapabilityProfile } from "./session-contract.js";
import type { FaceAdmitReading, FaceGrantReading } from "./session-face.js";
import type { SealEpoch } from "./wax-stamp.js";

// ── The socket and the deadline ─────────────────────────────────────────────────────────────────

/** One accepted socket, as a gate sees it. The transport beneath it (a WebSocket, a raw stream) stays its own. */
export interface GateSocket {
  /** The first flight, as the transport read it: the knock, and Noise IK message one. */
  readonly flight: { readonly knock: string; readonly message1: Uint8Array };
  /** Send one frame. */
  send(frame: Uint8Array): void;
  /** The next frame, or null once the peer left. */
  recv(): Promise<Uint8Array | null>;
  /** Cut the socket: no close frame, no code, no reason. */
  cut(): void;
}

/**
 * The source of a gate's ONE deadline per socket. `draw` runs at accept and calls `lapse` once, later, unless
 * cancelled. The source owns the clock and the draw's spread; the gate reads neither.
 */
export interface GateDeadlines {
  draw(lapse: () => void): { cancel(): void };
}

// ── The admit reader ────────────────────────────────────────────────────────────────────────────

/** What a gate asks of a presented admit: the presenter-verifier's own reading, or a named refusal. */
export interface GateAdmitReader {
  read(arm: { readonly admit: CarriageEntry; readonly lineage: readonly PresentedLineageAct[] }): Promise<FaceAdmitReading | { readonly refusal: string }>;
}

/** The root of one Nexus as this vessel holds it locally: what a presented admit gets read against. */
export interface HeldNexusRoot {
  /** The Nexus this root belongs to, in the spelling the gate's own scope uses. */
  readonly nexus:           string;
  /** The causal position this reading stands at: the heads the verifier folds. */
  readonly revision:        string;
  readonly roster:          KahuQuorumSeats;
  readonly sealLineage?:    readonly SealEpoch[];
  readonly denyBoard:       Iterable<CarriageEntry>;
  readonly antigen:         Iterable<KapaeAntigenEntry>;
  readonly antigenRoster:   KahuQuorumSeats;
  readonly antigenVerifier: QuorumVerifier;
}

/**
 * The admit reader over the house's one presenter-verifier. `held` answers the root this vessel holds for
 * the gate's Nexus, read fresh for each admit, or null where it holds none: an admit then refuses by name,
 * because a verifier with no root of its own would believe whatever roster a presenter implies.
 */
export function presentedAdmitReader(held: () => HeldNexusRoot | null | Promise<HeldNexusRoot | null>): GateAdmitReader {
  return {
    async read(arm) {
      const root = await held();
      if (root === null) return { refusal: "no-held-root" };
      const verdict = await verifyPresentedAdmit({
        admit: arm.admit, lineage: arm.lineage, roster: root.roster, denyBoard: root.denyBoard,
        antigen: root.antigen, antigenRoster: root.antigenRoster, antigenVerifier: root.antigenVerifier,
        ...(root.sealLineage ? { sealLineage: root.sealLineage } : {}),
      });
      return { verdict, nexus: root.nexus, admitRef: carriageEntryActCid(arm.admit), revision: root.revision };
    },
  };
}

// ── The rings and the sorter ────────────────────────────────────────────────────────────────────

/** What the edge shadow ring reads over one presenter. */
export interface GateShadowReading {
  /** A standing shadow sets this presenter aside at this gate: it draws what a false signature draws. */
  readonly aside:      boolean;
  /** A standing shadow sets this presenter's device aside from this vessel's own fleet, or the vessel
   *  cannot read its fleet at all (the floor): the presenter never sorts same-operator. */
  readonly fleetAside: boolean;
}

/**
 * The edge shadow ring, as a gate consults it: once per presenter, after its chain verified. The ring
 * answers closed until its first fold lands, so a gate that asks early sets the presenter aside.
 */
export interface GateShadowRing {
  consult(presenter: { readonly scope: FaceScope; readonly vesselFaceKey: VesselFaceKey }): GateShadowReading;
}

/**
 * The PersonaGroup ring, as a gate asks it: the private, root-authorized record that this face key speaks
 * for a PersonaGroup this vessel shares, or null. A gate outside the PersonaGroup holds no such record.
 */
export interface GateFaceGrantRing {
  grantFor(scope: FaceScope): FaceGrantReading | null | Promise<FaceGrantReading | null>;
}

/** What the sorter reads: facts this gate proved, and the arm as it rode. */
export interface GateSortInput {
  readonly scope:      FaceScope;
  readonly profile:    CapabilityProfile;
  /** The admit this gate read HELD for the face key at this Nexus, or null. */
  readonly admit:      FaceAdmitReading | null;
  /** The private grant the ring answered for this face, or null. */
  readonly sameGroup:  FaceGrantReading | null;
  /** The shadow ring's fleet reading. */
  readonly fleetAside: boolean;
  /** The arm as presented: a walker's grant or claim keeps its own reader, inside the sorter. */
  readonly arm:        PresentationArm | null;
}

export interface GateSortVerdict {
  readonly class:     PeerClass;
  /** The key and the Nexus a contracted or walker socket stands as. */
  readonly standing?: { readonly nym: string; readonly aid: string };
  /** Session frames that follow the verdict on the attached socket, in order. */
  readonly push?:     ReadonlyArray<{ readonly kind: string; readonly body: unknown }>;
}

/** The one sorter: a class for the presenter, or null, which draws nothing. It reads this Nexus's posture alone. */
export interface GateSorter {
  sort(input: GateSortInput): Promise<GateSortVerdict | null>;
}

// ── The withdrawal memory ───────────────────────────────────────────────────────────────────────

/**
 * What a gate has learned of the withdrawals of the faces that presented to it. The store only accretes:
 * `keep` joins what it held with what arrives and never replaces a memory with a smaller one.
 */
export interface GateWithdrawalMemory {
  read(scope: FaceScope): WithdrawalMemory | null | Promise<WithdrawalMemory | null>;
  keep(memory: WithdrawalMemory): void | Promise<void>;
}

/** A gate's withdrawal memory, kept in this process alone. It persists nothing and enumerates nothing. */
export function memoryBackedWithdrawals(): GateWithdrawalMemory {
  const held = new Map<string, WithdrawalMemory>();
  const keyOf = (scope: FaceScope): string => `${scope.nexus}\n${scope.faceKey}`;
  return {
    read: (scope) => held.get(keyOf(scope)) ?? null,
    keep(memory) {
      if (!isWithdrawalMemory(memory)) return;
      const standing = held.get(keyOf(memory.scope));
      if (standing === undefined) { held.set(keyOf(memory.scope), memory); return; }
      // The union of both: an interleaved check that read an older memory loses nothing this one learned.
      const joined = learnWithdrawals(standing, heldWithdrawals(memory));
      if (own(joined, "memory")) held.set(keyOf(memory.scope), joined.memory);
    },
  };
}

// ── The session a gate attaches ─────────────────────────────────────────────────────────────────

/** What an attached socket carries. No vessel's key stands in it. */
export interface GateSession {
  readonly scope:         FaceScope;
  readonly sessionKey:    SessionKey;
  /** The hand's profile, exactly as the session's certificate names it. */
  readonly profile:       CapabilityProfile;
  readonly class:         PeerClass;
  readonly standing?:     { readonly nym: string; readonly aid: string };
  readonly push:          ReadonlyArray<{ readonly kind: string; readonly body: unknown }>;
  /** The sealed channel every later frame rides. */
  readonly transport:     NoiseTransport;
}

/**
 * A session the table took and has not yet opened. The gate opens it once its verdict left, or abandons it
 * where the verdict could not leave.
 */
export interface GateSeat {
  /** The verdict left: the session may now send and receive on its socket. */
  open(): void;
  /** No verdict left: forget the session. */
  abandon(): void;
}

/**
 * The gate's table of attached sockets. `attach` runs once per verified dial, BEFORE the verdict leaves, and
 * sends nothing: a dialer never holds a verdict for a session the table refused. A table that throws
 * attaches nothing, and the dial draws silence.
 */
export interface GateSessionTable {
  attach(socket: GateSocket, session: GateSession): GateSeat | Promise<GateSeat>;
}

// ── The gate ────────────────────────────────────────────────────────────────────────────────────

export interface FaceGateDeps {
  readonly bundle:      GateBundle;
  /** The Nexus this gate stands in. Its bytes must name the bundle's own Nexus. */
  readonly nexus:       NexusAid;
  /** The audience a dial must name. */
  readonly audience:    string;
  readonly deadlines:   GateDeadlines;
  readonly admits:      GateAdmitReader;
  readonly shadows:     GateShadowRing;
  readonly grants:      GateFaceGrantRing;
  readonly sorter:      GateSorter;
  readonly withdrawals: GateWithdrawalMemory;
  readonly sessions:    GateSessionTable;
  /** How many sockets may stand accepted and neither attached nor cut at once. */
  readonly maxPending?: number;
  /** Where a refusal's cause goes. The wire never carries it. */
  readonly onRefuse?:   (reason: string) => void;
}

/** What one accept came to, for the vessel's own log. Nothing of it crosses the wire. */
export type GateOutcome =
  | { readonly outcome: "attached"; readonly class: PeerClass }
  | { readonly outcome: "answered"; readonly state: Exclude<GateAnswer["state"], "verified"> }
  | { readonly outcome: "silence";  readonly reason: string };

export interface FaceGate {
  /** Run the exchange on one accepted socket. It never throws and never rejects. */
  accept(socket: GateSocket): Promise<GateOutcome>;
  /** How many sockets stand accepted and neither attached nor cut. A count, never a list. */
  readonly pending: number;
}

const MAX_PENDING = 50;

/** One accept's standing against its deadline. */
interface AcceptState { lapsed: boolean; attached: boolean; standDown: () => void }

/** Did any gate already run its exchange on this socket? One socket carries one first flight. */
const ACCEPTED = new WeakSet<GateSocket>();

/** The classes each arm may sort to. A sorter's answer outside its arm's row draws nothing. */
const ARM_CLASSES: Readonly<Record<"none" | PresentationArm["kind"], readonly PeerClass[]>> = Object.freeze({
  none:  ["stranger"],
  admit: ["same-operator", "contracted"],
  grant: ["walker"],
  claim: ["walker"],
});

function sameText(a: string, b: string): boolean {
  if (typeof a !== "string" || a.length !== b.length) return false;
  let differ = 0;
  for (let at = 0; at < a.length; at++) differ |= a.charCodeAt(at) ^ b.charCodeAt(at);
  return differ === 0;
}

/** Stand a gate for one Nexus on one route. */
export function makeFaceGate(deps: FaceGateDeps): FaceGate {
  const { bundle } = deps;
  if (hex(utf8Bytes(deps.nexus)) !== bundle.pin.nexus) throw new Error("face-gate: the gate's Nexus and its bundle's Nexus differ");
  const maxPending = deps.maxPending ?? MAX_PENDING;
  let pending = 0;

  async function run(socket: GateSocket, state: AcceptState): Promise<GateOutcome> {
    const silence = (reason: string): GateOutcome => ({ outcome: "silence", reason });

    // 2 · the knock, 3 · the first flight. Nothing leaves before both hold.
    if (!sameText(socket.flight.knock, bundle.knock)) return silence("the knock names another gate");
    let transport: NoiseTransport;
    try {
      const flight = bundle.respond(socket.flight.message1);
      if (flight.payload.length !== 0) return silence("the first flight carries a payload");
      const answered = flight.writeMessage2();
      transport = answered.transport;
      socket.send(answered.message2);                       // 4 · message two, empty: no verdict rides it
    } catch { return silence("the first flight decrypts nothing"); }

    /** The next sealed frame, opened; null where the peer left or the frame opens nothing. */
    const next = async (): Promise<Uint8Array | null> => {
      const frame = await socket.recv();
      if (frame === null) return null;
      try { return transport.receive.open(frame); } catch { return null; }
    };

    // 5 · the presentation, then the signed finish.
    const reader = gatePartReader(GATE_FRAME.presentationPart, GATE_FRAME.presentationEnd);
    let presented: Uint8Array | null = null;
    while (presented === null) {
      const plain = await next();
      if (plain === null) return silence("no presentation");
      const pushed = reader.push(plain);
      if (pushed === "refused") return silence("the presentation's frames read as none");
      presented = pushed;
    }
    const finish = await next();
    if (finish === null || finish.length !== 65 || finish[0] !== GATE_FRAME.finish) return silence("no signed finish");

    const read = readGatePresentation(presented);
    if (read === null) return silence("the presentation reads as none");
    if (read.audience !== deps.audience) return silence("the dial names another audience");
    const certificate = readCertificate(read.certificate);
    if (!own(certificate, "read")) return silence(`the certificate refuses: ${certificate.refusal}`);
    const session = readSessionCertificate(read.sessionCertificate);
    if (!own(session, "read")) return silence(`the session certificate refuses: ${session.refusal}`);
    const scope = certificate.read.scope;
    if (scope.nexus !== deps.nexus) return silence("the chain names another Nexus");
    if (!sameFaceScope(session.read.scope, scope) || session.read.vesselFaceKey !== certificate.read.vesselFaceKey) return silence("the session certificate stands under another chain");

    const payload = gateFinishPayload({
      handshakeHash: transport.handshakeHash, bundleDigest: bundle.digest, presentationDigest: read.digest, audience: read.audience,
    });
    const finished = readSessionSignature(session.read, "finish", payload, hex(finish.subarray(1)));
    if (!own(finished, "read")) return silence(`the finish refuses: ${finished.refusal}`);

    // 6 · the arm. Its subject names the face key, and an admit reads held at this Nexus, or nothing follows.
    if (read.armSubject !== null && read.armSubject !== scope.faceKey) return silence("the arm stands under another key");
    if ((read.arm?.kind === "grant" && read.arm.grant.nexusAid !== deps.nexus) || (read.arm?.kind === "claim" && read.arm.nexusAid !== deps.nexus)) return silence("the arm names another Nexus");
    let admit: FaceAdmitReading | null = null;
    if (read.arm?.kind === "admit") {
      const reading = await deps.admits.read({ admit: read.arm.admit, lineage: read.arm.lineage });
      if (own(reading, "refusal")) return silence(`the admit refuses: ${reading.refusal}`);
      if (reading.verdict.state !== "held") return silence(`the admit reads ${reading.verdict.state}: ${reading.verdict.reason}`);
      if (reading.verdict.nym !== scope.faceKey) return silence("the admit names another face");
      if (reading.nexus !== deps.nexus) return silence("the admit stands in another Nexus");
      admit = reading;
    }

    // 7 · the chain, against what this gate learned of the face. It learns only under an admitted face key.
    const fresh = foldWithdrawals(scope);
    if (!own(fresh, "memory")) return silence("the face's scope folds no history");
    const learned = admit === null ? null : await deps.withdrawals.read(scope);
    const verdict = checkFaceChain({
      admitted: scope, certificate: read.certificate, sessionCertificate: read.sessionCertificate,
      frontier: read.frontier, carried: read.carried, memory: learned ?? fresh.memory,
    });
    if (verdict.verdict === "invalid") return silence(`the chain reads invalid: ${verdict.refusal}`);
    if (admit !== null) await deps.withdrawals.keep(verdict.memory);

    /** Sign and send one answer, sealed. False where the deadline already lapsed: nothing then leaves. */
    const answer = async (named: GateAnswer): Promise<boolean> => {
      const bytes = encodeGateAnswer(named);
      const signature = await bundle.sign(gateVerdictImage({ handshakeHash: transport.handshakeHash, bundleDigest: bundle.digest, answer: bytes }));
      if (state.lapsed) return false;
      for (const part of gateParts(GATE_FRAME.answerPart, GATE_FRAME.answerEnd, bytes)) socket.send(transport.send.seal(part));
      socket.send(transport.send.seal(gateFrame(GATE_FRAME.verdict, signature)));
      return true;
    };

    // 8 · the shadow ring, then the sorter, once, before any answer of any kind.
    const shadow = deps.shadows.consult({ scope, vesselFaceKey: certificate.read.vesselFaceKey });
    if (shadow.aside) return silence("a standing shadow sets the presenter aside");
    // A named state goes only to a presenter of an admitted face. Every other presenter hears nothing.
    if (verdict.verdict !== "verified" && admit === null) return silence(`the chain reads ${verdict.verdict} under no held admit`);
    let sameGroup: FaceGrantReading | null = null;
    if (admit !== null) {
      const grant = await deps.grants.grantFor(scope);
      if (grant !== null && grant.faceKey === scope.faceKey && grant.nexus === scope.nexus) sameGroup = grant;
    }
    const sorted = await deps.sorter.sort({ scope, profile: session.read.profile, admit, sameGroup, fleetAside: shadow.fleetAside, arm: read.arm });
    if (sorted === null) return silence("sorted to silence");
    if (!ARM_CLASSES[read.arm?.kind ?? "none"].includes(sorted.class)) return silence(`the sorter answered ${sorted.class} over an arm that never earns it`);
    if (sorted.class === "same-operator" && (sameGroup === null || shadow.fleetAside)) return silence("the sorter answered same-operator over no private grant, or over a device set aside");

    if (verdict.verdict !== "verified") {
      const named: GateAnswer =
        verdict.verdict === "unconfirmed" ? { state: "unconfirmed", frontier: verdict.frontier, events: verdict.catchUp }
        : verdict.verdict === "withdrawn" ? { state: "withdrawn", events: verdict.evidence }
        : verdict.verdict === "incomplete" ? { state: "incomplete", frontier: verdict.frontier }
        : { state: "forked", events: verdict.evidence };
      return (await answer(named)) ? { outcome: "answered", state: named.state } : silence("the deadline lapsed before the answer");
    }

    // 9 · the session's seat, then the verdict, after the finish. The table takes the session first and sends
    // nothing; the deadline then stands down, so no lapse cuts a socket whose verdict left; the verdict leaves;
    // the seat opens.
    const chain = verdict.chain;
    if (state.lapsed) return silence("the deadline lapsed before the verdict");
    const seat = await deps.sessions.attach(socket, Object.freeze({
      scope, sessionKey: chain.sessionKey, profile: chain.profile, class: sorted.class,
      ...(sorted.standing ? { standing: sorted.standing } : {}),
      push: Object.freeze([...(sorted.push ?? [])]), transport,
    }));
    if (state.lapsed) { seat.abandon(); return silence("the deadline lapsed before the verdict"); }
    state.attached = true;
    state.standDown();
    try {
      await answer({ state: "verified" });
    } catch (error) {
      // The verdict could not leave and no deadline stands to cut the socket: the gate cuts it here.
      seat.abandon();
      try { socket.cut(); } catch { /* already gone */ }
      return silence(`the verdict could not leave: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      seat.open();
    } catch (error) {
      // The verdict left and the table could not open the session: abandon the seat and cut the socket here,
      // since no deadline stands to cut it.
      try { seat.abandon(); } catch { /* the table already faulted */ }
      try { socket.cut(); } catch { /* already gone */ }
      return silence(`the session could not open: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { outcome: "attached", class: sorted.class };
  }

  return {
    get pending(): number { return pending; },
    async accept(socket) {
      // One socket carries one first flight. A second run on it draws no deadline of its own, sends nothing and
      // touches nothing: the first run's deadline alone governs the socket.
      if (ACCEPTED.has(socket)) {
        const refused: GateOutcome = { outcome: "silence", reason: "the socket already carried its one flight" };
        try { deps.onRefuse?.(refused.reason); } catch { /* a log never decides */ }
        return refused;
      }
      ACCEPTED.add(socket);
      // 1 · ONE deadline, drawn at accept. Whatever follows, a socket that never attached gets cut when it lapses.
      // Until it attaches or lapses the socket holds its pending place, whatever its run came to: a refused
      // socket and a waiting one weigh alike on the bound.
      const state: AcceptState = { lapsed: false, attached: false, standDown: () => {} };
      let placed = false;
      const leave = (): void => { if (placed) { placed = false; pending--; } };
      const deadline = deps.deadlines.draw(() => {
        state.lapsed = true;
        leave();
        if (!state.attached) { try { socket.cut(); } catch { /* already gone */ } }
      });
      state.standDown = () => { deadline.cancel(); leave(); };
      let outcome: GateOutcome;
      if (pending >= maxPending) outcome = { outcome: "silence", reason: "too many pending sockets" };
      else {
        placed = true;
        pending++;
        try { outcome = await run(socket, state); }
        catch (error) { outcome = { outcome: "silence", reason: `a fault: ${error instanceof Error ? error.message : String(error)}` }; }
      }
      if (outcome.outcome === "silence") { try { deps.onRefuse?.(outcome.reason); } catch { /* a log never decides */ } }
      return outcome;
    },
  };
}
