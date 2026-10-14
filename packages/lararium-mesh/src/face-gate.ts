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
  carriageEntryActCid, carriageEntryCounts, isCarriageDescendant,
  type CarriageEntry, type PresentedAdmitVerdict, type PresentedLineageAct,
} from "./carriage-registry.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { hex, utf8Bytes } from "./crypto.js";
import {
  checkFaceChain, foldWithdrawals, heldWithdrawals, isWithdrawalMemory, learnWithdrawals, type WithdrawalMemory,
} from "./face-authority.js";
import {
  own, readCertificate, readSessionCertificate, readSessionSignature, sameFaceScope,
  type FaceScope, type NexusAid, type SessionKey, type VesselFaceKey,
} from "./face-proof-subjects.js";
import type { GateBundle, GateTier } from "./gate-bundle.js";
import {
  GATE_FRAME, encodeGateAnswer, gateFinishPayload, gateFrame, gatePartReader, gateParts, gatePlaceFinishImage,
  gateVerdictImage, readGatePresentation, readPlacePresentation, type GateAnswer, type PlaceArm, type PresentationArm,
  type ReadPlacePresentation,
} from "./gate-exchange.js";
import type { PeerClass } from "./island-protocol.js";
import { foldAntigenVerdicts } from "./kapae-antigen.js";
import type { NoiseTransport } from "./noise-ik.js";
import { PLACE_PROFILE, type SeatProfile } from "./session-contract.js";
import type { FaceAdmitReading, FaceGrantReading } from "./session-face.js";
import { NO_HELD_ROOT, readAdmitAtHeldRoot } from "./held-nexus-root.js";
import type { HeldNexusRoot } from "./held-nexus-root.js";
export type { HeldNexusRoot } from "./held-nexus-root.js";

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
  /** The same held-root door, for a place's carriage contract. */
  readPlace(arm: { readonly contract: CarriageEntry; readonly lineage: readonly CarriageEntry[] }): Promise<PlaceContractReading | { readonly refusal: string }>;
}

/** A place's carriage contract, as the held-root door read it. */
export interface PlaceContractReading {
  /** `held`, or why not: the same five states an admit reads. `nym` names the place key, lower-case. */
  readonly verdict:     PresentedAdmitVerdict;
  readonly nexus:       string;
  /** The contract act's own content id. */
  readonly contractRef: string;
  readonly revision:    string;
}

/**
 * The admit reader over the house's one presenter-verifier. `held` answers the root this vessel holds for
 * the gate's Nexus, read fresh for each admit, or null where it holds none: an admit then refuses by name,
 * because a verifier with no root of its own would believe whatever roster a presenter implies.
 */
export function presentedAdmitReader(held: () => HeldNexusRoot | null | Promise<HeldNexusRoot | null>): GateAdmitReader {
  return {
    async read(arm) {
      return readAdmitAtHeldRoot(arm, await held());
    },
    async readPlace(arm) {
      const root = await held();
      if (root === null) return { refusal: NO_HELD_ROOT };
      return { verdict: await verifyPresentedCarry(arm, root), nexus: root.nexus, contractRef: carriageEntryActCid(arm.contract), revision: root.revision };
    },
  };
}

/**
 * Read a PRESENTED carriage contract against a held root: the quorum's `carry` act over a place's key, with
 * the place's own carrier seal, at the roster's own epoch. The board stays deny-only: a counted `uncarry`
 * that descends from the contract closes it, one that stands concurrent leaves it unsettled, and a held
 * kapae on the place's key denies it. A contract at an earlier epoch reads `wrong-epoch`: a place carries
 * across a roll by the new quorum's own `carry` act.
 */
export async function verifyPresentedCarry(arm: { readonly contract: CarriageEntry; readonly lineage: readonly CarriageEntry[] }, root: HeldNexusRoot): Promise<PresentedAdmitVerdict> {
  const { contract } = arm;
  const nym = typeof contract?.nym === "string" ? contract.nym.toLowerCase() : "";
  const verdict = (state: PresentedAdmitVerdict["state"], reason: string): PresentedAdmitVerdict => ({ state, reason, nym });
  if (contract?.action !== "carry") return verdict("rejected", "not-a-carry");
  if (contract.sealEpochCid !== root.roster.sealEpochCid) return verdict("wrong-epoch", "contract-not-at-head-epoch");
  if (!(await carriageEntryCounts(contract, root.roster))) return verdict("rejected", "contract-not-counted");
  const contractCid = carriageEntryActCid(contract);
  const causal = new Map<string, { readonly parents: readonly string[] }>();
  for (const act of arm.lineage) {
    if (act.nym.toLowerCase() !== nym || (act.action !== "carry" && act.action !== "uncarry")) return verdict("rejected", "lineage-foreign-act");
    if (!(await carriageEntryCounts(act, root.roster))) return verdict("rejected", "lineage-not-counted");
    causal.set(carriageEntryActCid(act), act);
  }
  for (const node of [contract, ...arm.lineage]) if (node.parents.some((parent) => !causal.has(parent))) return verdict("rejected", "lineage-broken-chain");
  causal.set(contractCid, contract);
  let closing = false, concurrent = false;
  for (const entry of root.denyBoard) {
    if (entry === null || typeof entry !== "object" || entry.action !== "uncarry" || typeof entry.nym !== "string" || entry.nym.toLowerCase() !== nym) continue;
    if (!(await carriageEntryCounts(entry, root.roster))) continue;
    const cid = carriageEntryActCid(entry);
    if (!causal.has(cid)) causal.set(cid, entry);
    if (isCarriageDescendant(cid, contractCid, causal)) closing = true;
    else if (!isCarriageDescendant(contractCid, cid, causal)) concurrent = true;
  }
  let kapaeHeld = false, kapaeUnsettled = false;
  for (const [antigenNym, reading] of await foldAntigenVerdicts(root.antigen, root.antigenRoster, root.antigenVerifier)) {
    if (antigenNym.toLowerCase() !== nym) continue;
    if (reading === "held") kapaeHeld = true; else if (reading !== "withdrawn") kapaeUnsettled = true;
  }
  if (kapaeHeld) return verdict("denied", "kapae-held");
  if (closing) return verdict("denied", "uncarry-descends-from-contract");
  if (kapaeUnsettled) return verdict("unsettled", "kapae-unsettled");
  if (concurrent) return verdict("unsettled", "uncarry-concurrent-with-contract");
  return verdict("held", "held");
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
  /** The same ring, over a place's carriage edge at one Nexus: true where a standing shadow sets the place aside. */
  consultPlace(place: { readonly nexus: NexusAid; readonly placeKey: string }): { readonly aside: boolean };
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
  /** The tier of the gate that asks: a floor gate seats the floor's shelf alone. */
  readonly tier:       GateTier;
  /** The face that presented, or null where a place did. */
  readonly scope:      FaceScope | null;
  /** The place key that presented, or null where a face did. */
  readonly placeKey:   string | null;
  /** The carriage contract this gate read HELD for the place key at this Nexus, or null. */
  readonly place:      PlaceContractReading | null;
  readonly profile:    SeatProfile;
  /** The admit this gate read HELD for the face key at this Nexus, or null. */
  readonly admit:      FaceAdmitReading | null;
  /** The private grant the ring answered for this face, or null. */
  readonly sameGroup:  FaceGrantReading | null;
  /** The shadow ring's fleet reading. */
  readonly fleetAside: boolean;
  /** The arm as presented: a walker's grant or claim keeps its own reader, inside the sorter. */
  readonly arm:        PresentationArm | PlaceArm | null;
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
  /** The tier of the gate that seated it. A floor seat reaches what the floor serves, and nothing this vessel can open. */
  readonly tier:          GateTier;
  /** The face the session wears, or null for a place's seat. */
  readonly scope:         FaceScope | null;
  /** The session's key, or null for a place's seat: a place holds no session. */
  readonly sessionKey:    SessionKey | null;
  /** The place key a place's seat stands under; null for a face's. */
  readonly placeKey:      string | null;
  /** A hand's profile, exactly as the session's certificate names it; the place's own for a place's seat. */
  readonly profile:       SeatProfile;
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
const ARM_CLASSES: Readonly<Record<"none" | PresentationArm["kind"] | PlaceArm["kind"], readonly PeerClass[]>> = Object.freeze({
  none:  ["stranger"],
  admit: ["same-operator", "contracted"],
  grant: ["walker"],
  claim: ["walker"],
  place: ["contracted"],
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
  // A floor gate seats no fleet lane: it asks no private grant, reads no withdrawal memory, answers no
  // refusing state and sorts nobody same-operator.
  const floor = bundle.pin.tier === "floor";
  let pending = 0;

  /** A standing the sorter names stands under the presenter's own proven key at this gate's Nexus, or it draws nothing. */
  const standsAs = (standing: GateSortVerdict["standing"], key: string): boolean =>
    standing === undefined || (standing.nym === key && standing.aid === deps.nexus);

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

    /** Sign and send one answer, sealed. False where the deadline already lapsed: nothing then leaves. */
    const answer = async (named: GateAnswer): Promise<boolean> => {
      const bytes = encodeGateAnswer(named);
      const signature = await bundle.sign(gateVerdictImage({ handshakeHash: transport.handshakeHash, bundleDigest: bundle.digest, answer: bytes }));
      if (state.lapsed) return false;
      for (const part of gateParts(GATE_FRAME.answerPart, GATE_FRAME.answerEnd, bytes)) socket.send(transport.send.seal(part));
      socket.send(transport.send.seal(gateFrame(GATE_FRAME.verdict, signature)));
      return true;
    };

    /**
     * 9 · the session's seat, then the verdict, after the finish. The table takes the session first and sends
     * nothing; the deadline then stands down, so no lapse cuts a socket whose verdict left; the verdict leaves;
     * the seat opens.
     */
    const seat = async (session: GateSession): Promise<GateOutcome> => {
      if (state.lapsed) return silence("the deadline lapsed before the verdict");
      const taken = await deps.sessions.attach(socket, Object.freeze(session));
      if (state.lapsed) { taken.abandon(); return silence("the deadline lapsed before the verdict"); }
      state.attached = true;
      state.standDown();
      try {
        await answer({ state: "verified" });
      } catch (error) {
        // The verdict could not leave and no deadline stands to cut the socket: the gate cuts it here.
        taken.abandon();
        try { socket.cut(); } catch { /* already gone */ }
        return silence(`the verdict could not leave: ${error instanceof Error ? error.message : String(error)}`);
      }
      try {
        taken.open();
      } catch (error) {
        // The verdict left and the table could not open the session: abandon the seat and cut the socket here,
        // since no deadline stands to cut it.
        try { taken.abandon(); } catch { /* the table already faulted */ }
        try { socket.cut(); } catch { /* already gone */ }
        return silence(`the session could not open: ${error instanceof Error ? error.message : String(error)}`);
      }
      return { outcome: "attached", class: session.class };
    };

    /**
     * THE PLACE ARM: a faceless place, outside the face proof. Its own key signs the finish; at most its
     * carriage contract rides; no chain gets checked and no withdrawal history answers. It hears `verified`
     * or nothing.
     */
    const place = async (shown: ReadPlacePresentation): Promise<GateOutcome> => {
      if (shown.audience !== deps.audience) return silence("the dial names another audience");
      const image = gatePlaceFinishImage({
        handshakeHash: transport.handshakeHash, bundleDigest: bundle.digest, presentationDigest: shown.digest, audience: shown.audience, placeKey: shown.placeKey,
      });
      if (!verifyEd25519(finish.subarray(1), image, shown.placeKey)) return silence("the place's finish refuses");
      let contract: PlaceContractReading | null = null;
      if (shown.arm !== null) {
        const reading = await deps.admits.readPlace({ contract: shown.arm.contract, lineage: shown.arm.lineage });
        if (own(reading, "refusal")) return silence(`the contract refuses: ${reading.refusal}`);
        if (reading.verdict.state !== "held") return silence(`the contract reads ${reading.verdict.state}: ${reading.verdict.reason}`);
        if (reading.verdict.nym !== shown.placeKey) return silence("the contract names another place");
        if (reading.nexus !== deps.nexus) return silence("the contract stands in another Nexus");
        if (deps.shadows.consultPlace({ nexus: deps.nexus, placeKey: shown.placeKey }).aside) return silence("a standing shadow sets the place aside");
        contract = reading;
      }
      const sorted = await deps.sorter.sort({
        tier: bundle.pin.tier, scope: null, placeKey: shown.placeKey, place: contract, profile: PLACE_PROFILE,
        admit: null, sameGroup: null, fleetAside: true, arm: shown.arm,
      });
      if (sorted === null) return silence("sorted to silence");
      if (!ARM_CLASSES[shown.arm?.kind ?? "none"].includes(sorted.class)) return silence(`the sorter answered ${sorted.class} over an arm that never earns it`);
      if (!standsAs(sorted.standing, shown.placeKey)) return silence("the sorter named a standing under another key or another Nexus");
      return seat({
        tier: bundle.pin.tier, scope: null, sessionKey: null, placeKey: shown.placeKey, profile: PLACE_PROFILE, class: sorted.class,
        ...(sorted.standing ? { standing: sorted.standing } : {}),
        push: Object.freeze([...(sorted.push ?? [])]), transport,
      });
    };

    const read = readGatePresentation(presented);
    if (read === null) {
      const shown = readPlacePresentation(presented);
      return shown === null ? silence("the presentation reads as none") : place(shown);
    }
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

    // 6 · the arm. Its subject names the face key, and an admit reads held at this Nexus, or nothing follows. An
    // admit names the key the Nexus admitted, and the face key must stand at the head of that key's line.
    if (read.arm?.kind !== "admit" && read.armSubject !== null && read.armSubject !== scope.faceKey) return silence("the arm stands under another key");
    if ((read.arm?.kind === "grant" && read.arm.grant.nexusAid !== deps.nexus) || (read.arm?.kind === "claim" && read.arm.nexusAid !== deps.nexus)) return silence("the arm names another Nexus");
    let admit: FaceAdmitReading | null = null;
    if (read.arm?.kind === "admit") {
      const reading = await deps.admits.read({ admit: read.arm.admit, lineage: read.arm.lineage });
      if (own(reading, "refusal")) return silence(`the admit refuses: ${reading.refusal}`);
      if (reading.verdict.state !== "held") return silence(`the admit reads ${reading.verdict.state}: ${reading.verdict.reason}`);
      if (reading.head !== scope.faceKey) return silence("the arm stands under another key");
      if (reading.nexus !== deps.nexus) return silence("the admit stands in another Nexus");
      admit = reading;
    }

    // 7 · the chain, against what this gate learned of the face. It learns only under an admitted face key.
    const fresh = foldWithdrawals(scope);
    if (!own(fresh, "memory")) return silence("the face's scope folds no history");
    const learned = admit === null || floor ? null : await deps.withdrawals.read(scope);
    const verdict = checkFaceChain({
      admitted: scope, certificate: read.certificate, sessionCertificate: read.sessionCertificate,
      frontier: read.frontier, carried: read.carried, memory: learned ?? fresh.memory,
    });
    if (verdict.verdict === "invalid") return silence(`the chain reads invalid: ${verdict.refusal}`);
    if (admit !== null && !floor) await deps.withdrawals.keep(verdict.memory);

    // 8 · the shadow ring, then the sorter, once, before any answer of any kind.
    const shadow = deps.shadows.consult({ scope, vesselFaceKey: certificate.read.vesselFaceKey });
    if (shadow.aside) return silence("a standing shadow sets the presenter aside");
    // A named state goes only to a presenter of an admitted face. Every other presenter hears nothing.
    if (verdict.verdict !== "verified" && admit === null) return silence(`the chain reads ${verdict.verdict} under no held admit`);
    if (verdict.verdict !== "verified" && floor) return silence(`the chain reads ${verdict.verdict} at a floor gate`);
    let sameGroup: FaceGrantReading | null = null;
    if (admit !== null && !floor) {
      const grant = await deps.grants.grantFor(scope);
      if (grant !== null && grant.faceKey === scope.faceKey && grant.nexus === scope.nexus) sameGroup = grant;
    }
    const sorted = await deps.sorter.sort({
      tier: bundle.pin.tier, scope, placeKey: null, place: null, profile: session.read.profile, admit, sameGroup,
      fleetAside: shadow.fleetAside || floor, arm: read.arm,
    });
    if (sorted === null) return silence("sorted to silence");
    if (!ARM_CLASSES[read.arm?.kind ?? "none"].includes(sorted.class)) return silence(`the sorter answered ${sorted.class} over an arm that never earns it`);
    if (!standsAs(sorted.standing, scope.faceKey)) return silence("the sorter named a standing under another key or another Nexus");
    if (sorted.class === "same-operator" && (sameGroup === null || shadow.fleetAside || floor)) return silence("the sorter answered same-operator over no private grant, or over a device set aside");

    if (verdict.verdict !== "verified") {
      const named: GateAnswer =
        verdict.verdict === "unconfirmed" ? { state: "unconfirmed", frontier: verdict.frontier, events: verdict.catchUp }
        : verdict.verdict === "withdrawn" ? { state: "withdrawn", events: verdict.evidence }
        : verdict.verdict === "incomplete" ? { state: "incomplete", frontier: verdict.frontier }
        : { state: "forked", events: verdict.evidence };
      return (await answer(named)) ? { outcome: "answered", state: named.state } : silence("the deadline lapsed before the answer");
    }

    const chain = verdict.chain;
    return seat({
      tier: bundle.pin.tier, scope, sessionKey: chain.sessionKey, placeKey: null, profile: chain.profile, class: sorted.class,
      ...(sorted.standing ? { standing: sorted.standing } : {}),
      push: Object.freeze([...(sorted.push ?? [])]), transport,
    });
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
