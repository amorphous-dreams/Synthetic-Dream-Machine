/**
 * synthetic-gate-world — a SYNTHETIC gate and its presenters, derived from labels, for the containerized crossing probes.
 *
 * The crossing probes run as two containers that share only a volume. Neither can hold the other's memory, so both derive
 * the same world from the same label: the Nexus's quorum seats, the face, its vessel and its session all read as a fixed
 * fill hashed under a label — synthetic, repeatable, and no key any vessel holds. The gate side stands the world's gate
 * (a `FaceGate` over a held Nexus root with a real quorum); the dial side wears a face: its certificate, its session
 * signer and an admit the label's quorum signed.
 *
 * PROBES ONLY, AND NOT A MESH EXPORT: it lives beside its only consumers so no package surface hands out deterministic keys.
 * NOT A VESSEL'S ROUTE. No boot reaches this module: a vessel's gate stands from its own custody, its own hearth and its
 * own Nexus. Only a probe, which must stand a gate and a face with nothing real behind them, names it.
 */
import * as ed25519 from "@noble/ed25519";
import { createHash, hkdfSync } from "node:crypto";
import { SessionTable, checkVesselChain, classifySocket, custodyRootDoor, deriveGateBundle, foldWithdrawals, hex, makeFaceGate, makeMultiSigQuorumVerifier, memoryBackedWithdrawals, presentedAdmitReader, sessionBinding, signCarriageContract, signCarriageQuorum, sovereignGateRoot, sovereignRoute, utf8Bytes } from "@lararium/mesh";
import { certificateImage } from "@lararium/mesh/face-proof-subjects";
import { mintSessionSigner } from "@lararium/mesh/session-signer";
import { supplySessionFace } from "@lararium/mesh/session-face";
import type { PeerClass, PresentationArm, CarriageEntry, FaceGate, FaceKey, FaceScope, FederationPosture, GateBundlePin, GateDeadlines, GateRootDoor, GateSessionTable, HeldNexusRoot, KahuQuorumSeats, KapaeAntigenEntry, VesselFaceCertificate, VesselFaceKey, VesselFaceKeyCustody, WithdrawalMemory } from "@lararium/mesh";

/** The audience the crossing gate arms; a presentation bound to any other is refused. */
export const CROSSING_AUDIENCE = "lar:///ha.ka.ba/bags/daemon";
const GROUP = "b7f1c2a9d4e60381";

type NexusAid = FaceScope["nexus"];
type SessionSigner = Awaited<ReturnType<typeof mintSessionSigner>> extends infer R ? R extends { signer: infer S } ? S : never : never;
const sha256Of = (b: Uint8Array): Uint8Array => new Uint8Array(createHash("sha256").update(b).digest());
const seedOf = (label: string): Uint8Array => sha256Of(utf8Bytes(`synthetic-gate-world ${label}`));
const pubOf = (seed: Uint8Array): Promise<string> => ed25519.getPublicKeyAsync(seed).then(hex);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array): Promise<string> => ed25519.signAsync(bytes, seed).then(hex);
const rootOf = (label: string): GateRootDoor => {
  const bytes = seedOf(`root ${label}`);
  return { derive: (domain) => new Uint8Array(hkdfSync("sha256", bytes, new Uint8Array(0), utf8Bytes(domain), 32)) };
};

/** A Nexus's quorum: three seats derived from the Nexus name, two to sign. */
const kahuSeedsOf = (nexus: string): Uint8Array[] => ["kahu one", "kahu two", "kahu three"].map((l) => sha256Of(new Uint8Array([...seedOf(l), ...utf8Bytes(nexus)])));
const epochOf = (nexus: string): string => `epoch-${nexus}`;

/** The clock deadlines the gate draws on the process clock. */
export function clockDeadlines(ms: number): GateDeadlines {
  return { draw(lapse) { const t = setTimeout(lapse, ms); return { cancel: () => clearTimeout(t) }; } };
}

export interface CrossingGate {
  readonly nexus: NexusAid;
  readonly gate:  FaceGate;
  /** What a dialer pins for this gate; plain strings, so it rides a JSON file. */
  readonly pin:   GateBundlePin;
}

/**
 * Stand the crossing gate for `nexus`. `admitting: false` holds NO Nexus root, so no admit reads and the gate turns every
 * face away (the "admit nobody" policy). `sessions` is the table the gate seats an admitted socket through.
 */
export async function standCrossingGate(opts: {
  nexus: string; sessions: GateSessionTable; admitting?: boolean; posture?: FederationPosture; audience?: string; route?: string;
  hearth?: string; deadlineMs?: number;
}): Promise<CrossingGate> {
  const nexus = opts.nexus as NexusAid;
  const epoch = epochOf(nexus);
  const roster: KahuQuorumSeats = { keys: await Promise.all(kahuSeedsOf(nexus).map(pubOf)), threshold: 2, sealEpochCid: epoch };
  const antigenSeeds = ["warden one", "warden two"].map(seedOf);
  const antigenRoster: KahuQuorumSeats = { keys: await Promise.all(antigenSeeds.map(pubOf)), threshold: 2, sealEpochCid: epoch };
  const held: HeldNexusRoot | null = opts.admitting === false ? null : {
    nexus, revision: "board-heads-1", roster, denyBoard: [] as CarriageEntry[], antigen: [] as KapaeAntigenEntry[], antigenRoster, antigenVerifier: makeMultiSigQuorumVerifier(), handOvers: [],
  };
  const bundle = deriveGateBundle(sovereignGateRoot(custodyRootDoor(rootOf(opts.hearth ?? "crossing hearth"))), utf8Bytes(nexus), sovereignRoute(opts.route ?? "/ws"));
  const admits = presentedAdmitReader(() => held);
  const posture = opts.posture ?? "private";
  const gate = makeFaceGate({
    bundle, nexus, audience: opts.audience ?? CROSSING_AUDIENCE, deadlines: clockDeadlines(opts.deadlineMs ?? 10_000), withdrawals: memoryBackedWithdrawals(),
    admits: { read: (arm) => admits.read(arm), readPlace: (arm) => admits.readPlace(arm) },
    shadows: {
      consult: () => ({ aside: false, fleetAside: false }),
      consultPlace: () => ({ aside: false }),
    },
    grants: { grantFor: () => null },
    sorter: {
      async sort(input) {
        const cls: PeerClass | null = classifySocket({
          sameOperator: input.sameGroup !== null && !input.fleetAside,
          contracted: input.admit !== null || input.place !== null,
          walker: input.arm?.kind === "grant" || input.arm?.kind === "claim",
          answersStrangers: posture === "open",
        });
        const nym = input.admit ? input.scope!.faceKey : input.place ? input.placeKey! : null;
        return cls === null ? null : { class: cls, ...(nym ? { standing: { nym, aid: nexus } } : {}) };
      },
    },
    sessions: opts.sessions,
  });
  return { nexus, gate, pin: bundle.pin };
}

/** What a dial wears: the face's certificate, its session signer, an admit, and the face's withdrawal memory. */
export interface CrossingFace {
  readonly certificate: VesselFaceCertificate;
  readonly signer:      SessionSigner;
  readonly arm:         PresentationArm | null;
  readonly history:     WithdrawalMemory;
}

interface Pair { readonly secret: Uint8Array; readonly key: string }
const pairOf = async (label: string): Promise<Pair> => { const secret = seedOf(`key ${label}`); return { secret, key: await pubOf(secret) }; };

async function wear(label: string, nexus: string): Promise<{ scope: FaceScope; certificate: VesselFaceCertificate; signer: SessionSigner; face: Pair; history: WithdrawalMemory }> {
  const face = await pairOf(`${label} face`);
  const vessel = await pairOf(`${label} vessel`);
  const scope: FaceScope = { faceKey: face.key as FaceKey, nexus: nexus as NexusAid };
  const vesselFaceKey = vessel.key as VesselFaceKey;
  const certificate: VesselFaceCertificate = {
    scope, vesselFaceKey, signature: hex(await ed25519.signAsync(certificateImage(scope, vesselFaceKey), face.secret)) as VesselFaceCertificate["signature"],
  };
  const folded = foldWithdrawals(scope, []);
  if (!("memory" in folded)) throw new Error(`the history folds no memory: ${folded.refusal}`);
  const verdict = checkVesselChain({ admitted: scope, certificate, memory: folded.memory });
  if (verdict.verdict !== "verified") throw new Error(`the vessel's own chain reads ${verdict.verdict}`);
  const supply = supplySessionFace({
    chain: verdict.chain, vesselFaceKey,
    admit: { verdict: { state: "held", reason: "held", nym: scope.faceKey }, head: scope.faceKey, nexus: scope.nexus, admitRef: "admit-cid-synthetic", revision: "board-heads-1" },
    grant: { personaGroup: GROUP, faceKey: scope.faceKey, nexus: scope.nexus, revision: "group-heads-1" },
  });
  if (!("face" in supply)) throw new Error(`no face supplied: ${supply.refusal}`);
  const table = new SessionTable("owner-epoch-synthetic");
  const binding = sessionBinding("socket");
  const opened = table.open(binding, supply.face, "face");
  if (!opened.ok) throw new Error(opened.refusal);
  const custody: VesselFaceKeyCustody = { signAsVesselFace: (_scope, _key, image) => ed25519.signAsync(image, vessel.secret) };
  const minted = await mintSessionSigner({ table, binding, session: opened.session, certificate, apart: [], custody });
  if (!("signer" in minted)) throw new Error(`no signer minted: ${minted.refusal}`);
  return { scope, certificate, signer: minted.signer, face, history: folded.memory };
}

async function admitOf(face: Pair, nexus: string): Promise<CarriageEntry> {
  const epoch = epochOf(nexus);
  const seal = await signCarriageContract(await pubOf(face.secret), epoch, signerOf(face.secret));
  const signers = await Promise.all(kahuSeedsOf(nexus).slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  return signCarriageQuorum({ nym: await pubOf(face.secret), action: "admit", parents: [], sealEpochCid: epoch }, signers, seal);
}

/** A face the Nexus admitted, wearing its own session signer. */
export async function crossingFace(nexus: string, label: string): Promise<CrossingFace> {
  const w = await wear(label, nexus);
  return { certificate: w.certificate, signer: w.signer, arm: { kind: "admit", admit: await admitOf(w.face, nexus), lineage: [] }, history: w.history };
}

/** A face that presents the admitted face's certificate and admit under ANOTHER face's session signer: a forgery. */
export async function forgedFace(nexus: string, label: string, forgerLabel: string): Promise<CrossingFace> {
  const real = await crossingFace(nexus, label);
  const forger = await wear(forgerLabel, nexus);
  return { ...real, signer: forger.signer };
}

/** A face that arrives with no admit: it presents its chain and nothing the Nexus signed. */
export async function strangerFace(nexus: string, label: string): Promise<CrossingFace> {
  const w = await wear(label, nexus);
  return { certificate: w.certificate, signer: w.signer, arm: null, history: w.history };
}
