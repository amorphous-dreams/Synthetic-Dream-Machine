/**
 * browser-face-presentation — what this browser presents at a gate: the face a fleet join seated here, or nothing
 * but the floor.
 *
 * THE FLOOR FIRST (operator ruling 2026-10-16: browser devices stand at the floor). A browser device begins as an anon
 * capability stack, and the person decides which faces to join to it. So a dial that holds no joined face presents
 * FACELESS (`facelessFloorPresentation`): a place presentation under a key minted for that one dial, with no arm. The
 * floor gate sorts it a stranger, which an OPEN Nexus answers and a PRIVATE one meets with silence (`socket-sorter`).
 * The faceless key lives one dial and rests nowhere, so two floor reads by one device never link on the wire; the
 * device key stays home, because a stranger's key proves nothing at a gate.
 *
 * A JOINED FACE. `composeBrowserFacePresentation` reads what the fleet-join door left in this browser's store, the
 * way the node's joinee does (`lararium-node` `dial-presentation`, the joinee branch): the face's record (the root
 * holder's certificates and grants, `record:<group>`), the dial the root-signed answer carried (the hearth's charter
 * and the face's own admit at the hearth's Nexus, `dial:<group>`), and the face-scoped key the request minted into
 * this browser's own custody row. The admit reads at the root the KEPT charter seats (`presentedAdmitReader`), never
 * at one the gate or a URL names; the session opens on the mesh's one door (`openJoinedFaceSession`). Each absence is
 * named: the pin's Nexus, the face's group, the join, the dial, the charter, the admit's verdict, the scope, the grant,
 * the key, or the session's own refusal.
 *
 * WHICH FACE. The one face this vessel's boot stands on (the bootstrap's PersonaGroup, which the fleet-join admit
 * seated). A session wears the face and the vessel wears none (stable-founding-road, "A SESSION wears the face"): a
 * per-tab face and the recorded switch act wait on ONE FACE, and this module wires neither.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-face-presentation
 */
import * as ed25519 from "@noble/ed25519";
import {
  admittedKeyOf, checkVesselChain, faceKeyGrantRevision, foldWithdrawals, heldNexusRoot, hex, hexToBytes,
  makeMultiSigQuorumVerifier, nexusAidOf, openJoinedFaceSession, parseNexusDoc, presentedAdmitReader, readFaceKeyGrant,
  sessionBinding, SessionTable,
  type FacePresentation, type FaceScope, type GateBundlePin, type PlaceOraclePresentation, type SessionBinding,
} from "@lararium/mesh";
import { browserVesselFaceKeyCustody, dialRow, type KeptFleetJoinDial } from "./browser-fleet-join.js";
import { FLEET_JOIN_STORE, VESSEL_FACE_KEY_STORE, idbGet, openVesselIdb } from "./browser-vessel-identity.js";

/** Why no face presentation stands, by name. */
export interface BrowserFacePresentationRefusal { readonly refusal: string; readonly detail?: string }

/** The Nexus AID text a pin names, or null where its hex does not read as text. */
export function nexusAidOfPin(pin: Pick<GateBundlePin, "nexus">): string | null {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(hexToBytes(pin.nexus)); } catch { return null; }
}

interface KeptFaceRecord { readonly personaGroup: string; readonly rootKey: string; readonly certificates: readonly unknown[]; readonly grants: readonly unknown[] }

const scopeOf = (value: unknown): FaceScope | null => {
  try {
    const at = (value as { scope?: { faceKey?: unknown; nexus?: unknown } }).scope;
    return typeof at?.faceKey === "string" && typeof at.nexus === "string" ? { faceKey: at.faceKey, nexus: at.nexus } as FaceScope : null;
  } catch { return null; }
};

/**
 * The face presentation this browser makes at `pin`'s Nexus, for the face `personaGroup` names: its own certificate
 * from the join, a session on the handed table, the admit as its arm, and the face's withdrawal memory.
 */
export async function composeBrowserFacePresentation(args: {
  readonly idbName:      string;
  readonly pin:          GateBundlePin;
  readonly personaGroup: string | null | undefined;
  /** The dial's own session table; one per dial where none is handed. */
  readonly table?:       SessionTable;
  readonly binding?:     SessionBinding;
  readonly profile?:     unknown;
}): Promise<{ readonly presentation: FacePresentation } | BrowserFacePresentationRefusal> {
  const aid = nexusAidOfPin(args.pin);
  if (aid === null) return { refusal: "pin-nexus-unreadable" };
  if (!args.personaGroup) return { refusal: "face-group-absent", detail: "this vessel stands at the floor: no face is joined to it" };
  const group = args.personaGroup;
  const db = await openVesselIdb(args.idbName);
  let record: KeptFaceRecord | undefined;
  let dial: KeptFleetJoinDial | undefined;
  try {
    record = await idbGet<KeptFaceRecord>(db, FLEET_JOIN_STORE, `record:${group}`);
    dial = await idbGet<KeptFleetJoinDial>(db, FLEET_JOIN_STORE, dialRow(group));
  } finally { db.close(); }
  if (record === undefined) return { refusal: "join-absent", detail: "no fleet join of this face landed in this browser" };
  if (dial === undefined) return { refusal: "dial-absent", detail: "the join landed before its dial was kept; land a fresh fleet-join answer" };

  // THE ROOT the admit reads at: the charter the root-signed answer carried, kept here, never one the gate names.
  const charter = typeof dial.charter === "string" ? parseNexusDoc(dial.charter) : null;
  const charterAid = nexusAidOf(charter);
  if (charter === null || charterAid === null) return { refusal: "charter-unread" };
  if (charterAid !== aid) return { refusal: "charter-other-nexus", detail: "the kept charter names another Nexus than the pin" };
  const root = heldNexusRoot({ nexus: aid, charter, denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() });
  if ("absent" in root) return { refusal: "charter-absent", detail: root.absent };
  const arm = { kind: "admit", admit: dial.admit.admit, lineage: dial.admit.lineage } as const;
  const admit = await presentedAdmitReader(() => root).read({ admit: arm.admit, lineage: arm.lineage });
  if ("refusal" in admit) return { refusal: "admit-unread", detail: admit.refusal };

  // THE SCOPE: the certificate the join issued at this Nexus over the key the admit names. A browser holds no
  // hand-over line of its own, so the admitted key answers itself.
  const nym = String(dial.admit.admit.nym).toLowerCase();
  const scopes = new Map<string, { scope: FaceScope; certificate: unknown }>();
  for (const certificate of record.certificates) {
    const scope = scopeOf(certificate);
    if (scope !== null && scope.nexus === aid && admittedKeyOf({ nexus: aid, key: scope.faceKey, carried: [] }) === nym) scopes.set(scope.faceKey, { scope, certificate });
  }
  if (scopes.size !== 1) return { refusal: "scope-absent", ...(scopes.size > 1 ? { detail: "two certificates at this Nexus answer the admit" } : {}) };
  const [{ scope, certificate }] = [...scopes.values()] as [{ scope: FaceScope; certificate: unknown }];
  const grant = record.grants.map((g) => readFaceKeyGrant(g, record!.rootKey))
    .find((g) => g !== null && g.scope.faceKey === scope.faceKey && g.scope.nexus === scope.nexus) ?? null;
  if (grant === null) return { refusal: "grant-absent" };

  // THIS BROWSER'S OWN KEY for the scope, named from its custody row and never from the certificate.
  const keyDb = await openVesselIdb(args.idbName);
  let secret: Uint8Array | undefined;
  try { secret = await idbGet<Uint8Array>(keyDb, VESSEL_FACE_KEY_STORE, `${scope.nexus}|${scope.faceKey.toLowerCase()}`); } finally { keyDb.close(); }
  if (!(secret instanceof Uint8Array) || secret.length !== 32) return { refusal: "vessel-face-key-absent" };
  const held = Uint8Array.from(secret);
  let vesselFaceKey: string;
  try { vesselFaceKey = hex(await ed25519.getPublicKeyAsync(held)); } finally { held.fill(0); }

  const fold = foldWithdrawals(scope);
  if (!("memory" in fold)) return { refusal: "history-unfolded", detail: fold.refusal };
  const opened = await openJoinedFaceSession({
    table: args.table ?? new SessionTable(`browser-dial-${crypto.randomUUID()}`),
    binding: args.binding ?? sessionBinding("socket"),
    profile: args.profile ?? "face",
    admitted: scope, certificate, memory: fold.memory, vesselFaceKey, admit,
    grant: { personaGroup: grant.personaGroup, faceKey: grant.scope.faceKey, nexus: grant.scope.nexus, revision: faceKeyGrantRevision(grant) },
    apart: [record.rootKey], custody: browserVesselFaceKeyCustody(args.idbName),
  });
  if (!("signer" in opened)) return { refusal: opened.refusal };
  const chain = checkVesselChain({ admitted: scope, certificate, memory: fold.memory });
  if (chain.verdict !== "verified") return { refusal: "chain-refused", detail: chain.verdict };
  return { presentation: { certificate: chain.chain.certificate, signer: opened.signer, arm, history: fold.memory } };
}

/**
 * The faceless floor presentation: a place key minted for this one dial, its signing door, and no arm. The seed
 * lives in this closure alone and rests nowhere.
 */
export async function facelessFloorPresentation(): Promise<PlaceOraclePresentation> {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const placeKey = hex(await ed25519.getPublicKeyAsync(seed));
  return { kind: "place", placeKey, sign: (image) => ed25519.signAsync(image, seed), arm: null };
}
