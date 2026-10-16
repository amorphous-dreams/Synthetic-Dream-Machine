/**
 * fleet-join — THE FLEET-JOIN DOOR on a node vessel: one face's fleet takes a new vessel of the same human.
 *
 * Four acts, two on each vessel, and three files between them by courier (`@lararium/mesh` `fleet-join`):
 *
 *   OFFER    the root holder names the face, its root key, a fresh nonce and every (face key, Nexus) scope the
 *            face stands at. A scope stands where the face holds its per-Nexus key; the offer mints one key alone,
 *            the face's at its HOUSEHOLD Nexus (`face-household-admit`), since the answer carries the face's admit there.
 *   REQUEST  the joining vessel, a PLACE already founded (`lares vessel found`), mints one face-scoped key per
 *            offered scope into its own custody, requests a certificate over each, and keeps the join pending
 *            beside the X25519 secret the answer seals to.
 *   ANSWER   the root holder reads the request against the offer rebuilt over today's scopes and the request's
 *            own nonce, signs the device edge (`device-admit`), certifies each face-scoped key under its face
 *            key, grants each face key under the PersonaGroup root, seals the face's address secret to the
 *            request, and signs the whole: the gate pin and the canon list ride INSIDE the signed answer. So does
 *            what the joinee needs to DIAL: the hearth's charter, the face's own admit at the hearth's Nexus (made
 *            sure of here, minted once through the contract door: `ensureFaceHouseholdAdmit`), and the hearth's
 *            floor pins.
 *   LAND     the joining vessel reads the answer under the root key its kept offer named, re-reads the charter and the
 *            admit (its quorum at that charter, its commitment and its pin) and refuses by name before it writes
 *            anything, then keeps the charter and the admit as a joinee keeps a contracted admit (`takeAdmitBundle`),
 *            lands the address secret and the face's record, keeps the floor pins, and founds onto its place through
 *            the admit it carried.
 *
 * THE ROOT HOLDS NO NONCE LEDGER. Each answer reads its request against the scopes that stand when the operator runs
 * it, so an answer stands as an operator's act over a file the operator carried; nothing here answers a request by
 * itself. What the root DOES keep is the issued book (`noteIssuedFaceKeys`): each certificate an answer issued, beside
 * the device the signed answer names, noted before the answer leaves, so its gate can map a presenting face-scoped
 * key to the device the fleet edge reads (D4). A joined vessel holds no root bytes and no private face key: the address secret alone crosses, sealed
 * to a key the request named.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-chain · lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import type { Repo } from "@automerge/automerge-repo";
import * as ed25519 from "@noble/ed25519";
import {
  PERSONA_GROUP_ID_TIDDLER, composeFleetJoinRequest, faceKeyGrantImage, fleetJoinAnswerImage, fleetJoinOffer,
  fleetJoinSealPair, foldWithdrawals, hex, issueCertificate, mintVesselFaceKey, readFleetJoinAnswer, readFleetJoinOffer,
  readFleetJoinRequest, sealAddressSecret, heldNexusRoot, makeMultiSigQuorumVerifier, nexusAidOf, verifySignedAdmitBundle,
  gateBundleDigest,
  type FaceKeyGrant, type FleetJoinAnswer, type FleetJoinOffer, type FleetJoinRequest,
  type VesselFaceCertificate,
} from "@lararium/mesh";
import { takeAdmitBundle, type AdmitBundle } from "../admit-bundle.js";
import { importCarriedCharter, primaryNexusAid } from "../carried-set.js";
import { FaceHouseholdAdmitRefused, ensureFaceHouseholdAdmit, ensureFaceHouseholdLeaf } from "../face-household-admit.js";
import { keepHearthFloorPins } from "../hearth-floor-pin-store.js";
import { stoodFloorPins } from "../hearth-sovereign-pin.js";
import { nexusCharterDocPath, parseNexusDoc } from "../nexus-doc.js";
import { vesselFloorKeyDoor } from "../node-vessel-identity.js";
import type { NexusLeaf } from "../nexus-leaf.js";
import { carriedAdmitOfFleetJoin } from "@lararium/keyhive";
import { standingFaceScopes } from "../face-root-holdings.js";
import { FaceProvisional, refuseWhileProvisional } from "../face-provisional.js";
import { nodeFaceKeyCustody, nodeVesselFaceKeyCustody, readVesselFaceKeyPublic, storeVesselFaceKey } from "../face-key-custody.js";
import {
  clearPendingFleetJoin, keepFaceJoinRecord, keepPendingFleetJoin, landFaceAddressSecret, mintFaceAddressSecret, noteIssuedFaceKeys, readFaceAddressSecret,
  readFaceJoinRecord, readPendingFleetJoin,
} from "../fleet-join-custody.js";
import { loadPersonaGroupRootSeed, loadPersonaGroupRootVerifyingKey, loadVesselSigningSeed, loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { loadIdentityAnchors } from "../identity-anchors.js";
import { larBootstrapPath, larSealHome } from "../vessel-paths.js";
import { runDeviceAdmit } from "./device-admit.js";
import { runInit } from "./init.js";

/** The face a join names where its caller names none: the founding face. */
export const FLEET_JOIN_DEFAULT_FACE = 0;

/** The face index a caller named, read whole: a non-negative integer, or a refusal by name. */
function faceIndex(face: number | undefined): number {
  const index = face ?? FLEET_JOIN_DEFAULT_FACE;
  if (!Number.isSafeInteger(index) || index < 0) throw new FleetJoinRefused("face-malformed", `--face names a persona index: a whole number from 0, never ${String(face)}.`);
  return index;
}

/** A fleet join refused by name: the mesh readers' refusal, or this door's own. */
export class FleetJoinRefused extends Error {
  override readonly name = "FleetJoinRefused";
  constructor(readonly refusal: string, detail: string) {
    super(`[lares fleet join] ${refusal}: ${detail}`);
  }
}

const isRefusal = (v: unknown): v is { refusal: string } =>
  typeof v === "object" && v !== null && typeof (v as { refusal?: unknown }).refusal === "string";

/**
 * The PersonaGroup the named face stands in. The founding face reads its group off the bootstrap's pin; a face
 * an operator added (`lares persona new <index>`) reads it off its own anchors, since the bootstrap pins the
 * founding face alone. A face this vessel never founded refuses by name.
 */
async function facePersonaGroup(face: number): Promise<string> {
  if (face === 0) return bootstrapPersonaGroup();
  const anchors = await loadIdentityAnchors(face);
  if (anchors === null || anchors.personaGroupId.length === 0) {
    throw new FleetJoinRefused("face-absent", `this vessel holds no face at index ${face}; found one with \`lares persona new ${face}\` first.`);
  }
  return anchors.personaGroupId;
}

/** The PersonaGroup this vessel's bootstrap names, or a refusal: a place with no face joins no vessel to one. */
function bootstrapPersonaGroup(): string {
  const path = larBootstrapPath();
  if (!existsSync(path)) throw new FleetJoinRefused("face-absent", `${path} not found — found the hearth first (\`lares vessel found --hearth\`).`);
  const plugin = JSON.parse(readFileSync(path, "utf8")) as { text?: string };
  const tiddlers = (JSON.parse(plugin.text ?? "{}") as { tiddlers?: Record<string, { text?: string }> }).tiddlers ?? {};
  const group = tiddlers[PERSONA_GROUP_ID_TIDDLER]?.text;
  if (typeof group !== "string" || group.length === 0) {
    throw new FleetJoinRefused("face-absent", "this vessel's bootstrap names no face; land one with `lares persona new 0` on the hearth.");
  }
  return group;
}

/** The PersonaGroup a joining vessel's bootstrap already pins, or null where it stands a bare place. */
function wornJoinedGroup(): string | null {
  const path = larBootstrapPath();
  if (!existsSync(path)) return null;
  try {
    const plugin = JSON.parse(readFileSync(path, "utf8")) as { text?: string };
    const group = (JSON.parse(plugin.text ?? "{}") as { tiddlers?: Record<string, { text?: string }> }).tiddlers?.[PERSONA_GROUP_ID_TIDDLER]?.text;
    return typeof group === "string" && group.length > 0 ? group : null;
  } catch {
    // A torn bootstrap names no face this landing could keep apart from: refuse rather than write over it.
    throw new FleetJoinRefused("bootstrap-torn", `${path} does not read; this landing writes nothing over it.`);
  }
}

/** The PersonaGroup root's verifying key, where this vessel holds the root. */
async function heldRootKey(face: number): Promise<string> {
  const key = (await loadPersonaGroupRootVerifyingKey(face))?.toLowerCase().replace(/^0x/, "");
  if (!key) throw new FleetJoinRefused("root-absent", "this vessel holds no PersonaGroup root; the vessel that holds it answers a fleet join.");
  return key;
}

/** Every (face key, Nexus) scope the face stands at here (`face-root-holdings`): one reader for the offer, the
 *  answer and the gate's grant ring. */
const standingScopes = standingFaceScopes;

async function signHex(image: Uint8Array, seed: Uint8Array): Promise<string> {
  return hex(await ed25519.signAsync(image, seed));
}

// ── The root holder ──────────────────────────────────────────────────────────────────────────────

/** A provisional face refuses `act` as a named FleetJoinRefused. */
async function refuseProvisional(face: number, act: string): Promise<void> {
  try { await refuseWhileProvisional(face, act); }
  catch (error) {
    if (error instanceof FaceProvisional) throw new FleetJoinRefused(error.reason, error.message);
    throw error;
  }
}

/** The household leaf or admit, its refusal named as a FleetJoinRefused (`no-household-nexus`, `admit-unminted`). */
async function householdNamed<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    if (error instanceof FaceHouseholdAdmitRefused) throw new FleetJoinRefused(error.refusal, error.message);
    throw error;
  }
}

/**
 * The root holder's offer: the face, its root key, a fresh nonce, and the scopes the face stands at. `face` names
 * the persona index the join serves (`--face`, default the founding face); the index stays local to this vessel and
 * never rides the offer, which names the face by its PersonaGroup and root key.
 */
export async function runFleetJoinOffer(opts: { readonly sealHome: string; readonly face?: number }): Promise<FleetJoinOffer> {
  const face = faceIndex(opts.face);
  const personaGroup = await facePersonaGroup(face);
  const rootKey = await heldRootKey(face);
  // A restored root may read and serve this face, but cannot add a vessel to its authority: refuse before the offer mints
  // anything, the household leaf included.
  await refuseProvisional(face, "fleet join offer");
  // THE HOUSEHOLD SCOPE: the face's key at the Nexus its hearth's gate stands at, so the joinee asks a certificate there
  // and the answer's admit there names a key the joinee is certified under.
  (await householdNamed(() => ensureFaceHouseholdLeaf(opts.sealHome, face))).seed.fill(0);
  return fleetJoinOffer({ personaGroup, rootKey, nonce: randomBytes(32).toString("hex"), scopes: await standingScopes(opts.sealHome, face) });
}

export interface FleetJoinAnswerOptions {
  readonly repo:     Repo;
  readonly sealHome: string;
  /** The request file as the joinee wrote it. */
  readonly request:  unknown;
  /** The url the joinee dials this hearth at (`--sync-url`). */
  readonly syncUrl?: string;
  /** The persona index the join serves (`--face`); the founding face where absent. It must name the face its offer named. */
  readonly face?:    number;
}

/** The root holder's answer to ONE request, read against the offer rebuilt over today's scopes. */
export async function runFleetJoinAnswer(opts: FleetJoinAnswerOptions): Promise<FleetJoinAnswer> {
  const face = faceIndex(opts.face);
  const personaGroup = await facePersonaGroup(face);
  const rootKey = await heldRootKey(face);
  const nonce = typeof opts.request === "object" && opts.request !== null ? (opts.request as { nonce?: unknown }).nonce : undefined;
  if (typeof nonce !== "string" || !/^[0-9a-f]{64}$/.test(nonce)) throw new FleetJoinRefused("request-malformed", "the request names no nonce.");
  const offer = fleetJoinOffer({ personaGroup, rootKey, nonce, scopes: await standingScopes(opts.sealHome, face) });
  const apart = [rootKey, (await loadVesselVerifyingKey()).toLowerCase()];
  const request = readFleetJoinRequest(opts.request, offer, apart);
  if (isRefusal(request)) throw new FleetJoinRefused(request.refusal, "the request does not read against this face's offer as it stands now.");

  // A restored root may read and serve this face, but cannot add a vessel to its authority.
  // Check before the device edge, certificates, grants, address secret or answer can be made.
  await refuseProvisional(face, "fleet join answer");

  // THE DEVICE EDGE (`runDeviceAdmit`): the root signs the joinee's vessel key into this hearth's fleet.
  const { payload, hearth } = await runDeviceAdmit({ repo: opts.repo, face, joineeVerifyingKey: request.vesselKey, ...(opts.syncUrl ? { syncUrl: opts.syncUrl } : {}) });

  // THE DIAL THE JOINEE NEEDS: the face's admit at this hearth's Nexus (minted once, through the contract door), the
  // charter that seats its quorum, and this hearth's floor pins. The admit commits to the pin the edge's hearth stands
  // under, so the answer's carriage IS the admit's opened carriage.
  const household = await householdNamed(() => ensureFaceHouseholdAdmit({ repo: opts.repo, sealHome: opts.sealHome, face, ...(payload.syncUrl ? { syncUrl: payload.syncUrl } : {}) }));
  if (gateBundleDigest(household.opening.carriage.gatePin) !== gateBundleDigest(hearth.gatePin)) {
    throw new FleetJoinRefused("admit-other-pin", "the face's household admit commits to another pin than the gate this hearth stands under.");
  }
  if (!request.requests.some((q) => q.scope.nexus === household.aid && q.scope.faceKey === household.admit.nym.toLowerCase())) {
    throw new FleetJoinRefused("request-scope-household-absent", "the request asks no certificate at this hearth's Nexus for the face's admitted key; offer again.");
  }
  const charter = readFileSync(nexusCharterDocPath(opts.sealHome), "utf8");
  const floorPins = stoodFloorPins(opts.sealHome, await vesselFloorKeyDoor());

  // ONE CERTIFICATE PER REQUESTED SCOPE, under that scope's face key. The issuer's history stands at its genesis:
  // no removal of a face-scoped key lands a withdrawal on this vessel yet.
  const certificates: VesselFaceCertificate[] = [];
  for (const q of request.requests) {
    const fold = foldWithdrawals(q.scope);
    if (!("memory" in fold)) throw new FleetJoinRefused(fold.refusal, "the face's withdrawal history does not fold.");
    const issued = await issueCertificate({ request: q, history: fold.memory, apart, custody: nodeFaceKeyCustody });
    if (!("certificate" in issued)) throw new FleetJoinRefused(issued.refusal, `no certificate issued at ${q.scope.nexus}.`);
    certificates.push(issued.certificate);
  }
  // THE ISSUED BOOK, before any answer can leave: the device is the request's vessel key, the key the device edge
  // names and the answer binds beside these certificates. A note that fails sends no answer.
  await noteIssuedFaceKeys({ personaGroup, rootKey, device: request.vesselKey, certificates });

  const seed = await loadPersonaGroupRootSeed(face);
  try {
    const grants: FaceKeyGrant[] = [];
    for (const q of request.requests) {
      grants.push({ personaGroup, scope: q.scope, signature: await signHex(faceKeyGrantImage(personaGroup, q.scope), seed) });
    }
    const secret = await mintFaceAddressSecret(personaGroup);
    let sealed;
    try { sealed = sealAddressSecret({ secret, request }); } finally { secret.fill(0); }
    const body = {
      nonce, vesselKey: request.vesselKey, personaGroup, edge: payload,
      carriage: { gatePin: household.opening.carriage.gatePin, canon: { ...household.opening.carriage.canon } },
      reach: { syncUrl: payload.syncUrl, islandKind: hearth.islandKind ?? null, islandScope: hearth.islandScope ?? null },
      charter,
      admit: { admit: household.admit, lineage: household.lineage, salt: household.opening.salt },
      floorPins,
      secret: sealed,
    };
    return { kind: "fleet-join-answer", ...body, certificates, grants, signature: await signHex(fleetJoinAnswerImage(body), seed) };
  } finally { seed.fill(0); }
}

// ── The joining vessel ───────────────────────────────────────────────────────────────────────────

/**
 * The joining vessel's request over an offer it carried. Its face-scoped keys mint here and rest in its own
 * custody; the join stays pending until its answer lands. The same offer again answers the request already kept;
 * another offer while one join stands pending refuses `join-pending`.
 */
export async function runFleetJoinRequest(opts: { readonly offer: unknown }): Promise<FleetJoinRequest> {
  const offer = readFleetJoinOffer(opts.offer);
  if (isRefusal(offer)) throw new FleetJoinRefused(offer.refusal, "the offer does not read.");
  const pending = await readPendingFleetJoin();
  if (pending !== null) {
    const kept = readFleetJoinRequest(pending.request, offer);
    if (!isRefusal(kept)) return kept;
    throw new FleetJoinRefused("join-pending", "another fleet join stands pending here; land its answer, or abandon it (`lares fleet join abandon`).");
  }
  const vesselKey = (await loadVesselVerifyingKey()).toLowerCase();
  const seal = fleetJoinSealPair();
  const seed = await loadVesselSigningSeed();
  try {
    const request = await composeFleetJoinRequest({
      offer, vesselKey, sealKey: seal.key, custody: nodeVesselFaceKeyCustody,
      // A key a broken request left at rest answers again, so the same offer retries clean.
      mintFaceKey: async (scope) => {
        const standing = await readVesselFaceKeyPublic(scope);
        if (standing !== null) return standing;
        const minted = await mintVesselFaceKey();
        try { await storeVesselFaceKey(scope, minted.secret); } finally { minted.secret.fill(0); }
        return minted.publicKey;
      },
      sign: (image) => signHex(image, seed),
    });
    if (isRefusal(request)) throw new FleetJoinRefused(request.refusal, "the request this vessel composed does not read back.");
    await keepPendingFleetJoin({ request, offer, sealSecret: hex(seal.secret) });
    return request;
  } finally { seed.fill(0); seal.secret.fill(0); }
}

/** Abandon the join pending here; answers whether one stood. Its face-scoped keys stay at rest. */
export async function runFleetJoinAbandon(): Promise<boolean> {
  const pending = await readPendingFleetJoin();
  const nonce = (pending?.request as { nonce?: unknown } | undefined)?.nonce;
  return typeof nonce === "string" ? clearPendingFleetJoin(nonce) : false;
}

/**
 * Land the answer onto the place this vessel founded: read it under the root key the kept offer named, land the
 * face's address secret and record, then found the face through the admit it carried. A landing over the same
 * answer again changes nothing it already landed.
 */
export async function runFleetJoinLand(opts: { readonly repo: Repo; readonly answer: unknown }): Promise<FleetJoinAnswer> {
  const pending = await readPendingFleetJoin();
  if (pending === null) throw new FleetJoinRefused("join-absent", "no fleet join stands pending here; request one first (`lares fleet join request`).");
  const offer = readFleetJoinOffer(pending.offer);
  if (isRefusal(offer)) throw new FleetJoinRefused(offer.refusal, "the kept offer does not read.");
  const request = readFleetJoinRequest(pending.request, offer, [offer.rootKey]);
  if (isRefusal(request)) throw new FleetJoinRefused(request.refusal, "the kept request does not read.");
  const sealSecret = new Uint8Array(Buffer.from(pending.sealSecret, "hex"));
  let verified;
  try {
    verified = readFleetJoinAnswer(opts.answer, { request, personaGroup: offer.personaGroup, rootKey: offer.rootKey, sealSecret });
  } finally { sealSecret.fill(0); }
  if (isRefusal(verified)) throw new FleetJoinRefused(verified.refusal, "the answer does not read against the request this vessel sent.");
  const { answer, addressSecret } = verified;
  const admit = carriedAdmitOfFleetJoin(answer);
  if ("refusal" in admit) { addressSecret.fill(0); throw new FleetJoinRefused(admit.refusal, "the answer's device edge does not found this face."); }
  // Standing rows under other bytes refuse by name before anything lands, so a refused landing writes nothing.
  // A vessel stands one joined face: a landing re-founds its bootstrap and its h0 anchors, so a second face's answer
  // over a vessel that already wears another would overwrite the first face's mount. It refuses instead.
  const worn = wornJoinedGroup();
  if (worn !== null && worn !== answer.personaGroup) {
    addressSecret.fill(0);
    throw new FleetJoinRefused("face-other", "this vessel already stands another face of a fleet; a second joined face on one vessel stands owed.");
  }
  // THE DIAL IT CARRIED, re-read before anything lands: the charter names the hearth's Nexus, the face's admit holds at
  // that charter's quorum, opens over the answer's carriage and commits to its pin. Any miss refuses by name.
  const dial = await readCarriedDial(answer);
  if ("refusal" in dial) { addressSecret.fill(0); throw new FleetJoinRefused(dial.refusal, dial.detail); }
  const standing = await readFaceJoinRecord(answer.personaGroup);
  if (standing !== null && standing.rootKey !== offer.rootKey) {
    addressSecret.fill(0);
    throw new FleetJoinRefused("record-other", "this vessel holds that face's record under another root key.");
  }
  const standingSecret = await readFaceAddressSecret(answer.personaGroup);
  if (standingSecret !== null) {
    const same = standingSecret.length === addressSecret.length && standingSecret.every((v, i) => v === addressSecret[i]);
    standingSecret.fill(0);
    if (!same) { addressSecret.fill(0); throw new FleetJoinRefused("secret-other", "this vessel holds another address secret for that face."); }
  }
  // THE CHARTER FIRST: its import refuses a lineage that does not extend a held one, and that refusal writes nothing.
  // The take reads its admit against the charter it holds, so the charter lands before it; a take that refuses then
  // takes back a charter this landing put down where none stood (`landed`), since a carried charter alone stands a
  // realm plane for a Nexus this vessel never joined. A charter that extended or matched a held one stands: it moved a
  // lineage this vessel already held forward (`fleet-join-land-undo.test.ts` witnesses it; the rule flips if a refused
  // landing must leave a held charter byte for byte as it stood).
  const sealHome = larSealHome();
  let imported: { readonly outcome?: string; readonly path?: string } | void = undefined;
  try {
    if (primaryNexusAid(sealHome) !== dial.aid) imported = importCarriedCharter(sealHome, answer.charter);
  } catch (error) {
    addressSecret.fill(0);
    throw new FleetJoinRefused("charter-refused", error instanceof Error ? error.message : String(error));
  }
  // THE ADMIT, kept as a joinee keeps a contracted admit. Its leaf is the face key its certificate at that Nexus names:
  // a joinee holds no roster line, so the certificate the answer carried stands in for the leaf.
  const certifiedAt = async (aid: string): Promise<readonly NexusLeaf[]> => answer.certificates
    .filter((c) => c.scope.nexus === aid)
    .map((c) => ({ handleIndex: 0, verifyingKey: c.scope.faceKey, seed: new Uint8Array(0) }));
  try { await takeAdmitBundle({ sealHome, raw: JSON.stringify(dial.bundle), leaves: certifiedAt }); }
  catch (error) {
    addressSecret.fill(0);
    if (imported && imported.outcome === "landed" && typeof imported.path === "string") {
      try { unlinkSync(imported.path); } catch { /* already gone */ }
    }
    throw new FleetJoinRefused("admit-refused", error instanceof Error ? error.message : String(error));
  }
  keepHearthFloorPins(sealHome, dial.aid, answer.floorPins);
  try { await landFaceAddressSecret(answer.personaGroup, addressSecret); } finally { addressSecret.fill(0); }
  await keepFaceJoinRecord({ personaGroup: answer.personaGroup, rootKey: offer.rootKey, certificates: answer.certificates, grants: answer.grants });
  await runInit({ repo: opts.repo, force: true, admitPayload: admit, custody: { slots: [] } });
  await clearPendingFleetJoin(request.nonce);
  return answer;
}

// ── The dial a landing keeps ─────────────────────────────────────────────────────────────────────

/**
 * Re-read the dial an answer carried, writing nothing: the charter parses and names the hearth's Nexus (the edge's true
 * name), and the face's admit, as a bundle over the answer's carriage, holds at that charter's quorum, opens to the
 * commitment the quorum signed and commits to the pin the answer carries (`verifySignedAdmitBundle`).
 */
export async function readCarriedDial(answer: FleetJoinAnswer): Promise<{ readonly aid: string; readonly bundle: AdmitBundle } | { readonly refusal: string; readonly detail: string }> {
  const doc = parseNexusDoc(answer.charter);
  const aid = nexusAidOf(doc);
  if (doc === null || aid === null) return { refusal: "charter-unread", detail: "the answer's charter does not read as a seated charter." };
  const named = (answer.edge as { hearthTrueName?: unknown }).hearthTrueName;
  if (named !== aid) return { refusal: "charter-other-nexus", detail: "the answer's charter names another Nexus than the hearth its edge binds." };
  const bundle: AdmitBundle = {
    aid, gatePubKey: answer.carriage.gatePin.signingKey, admit: answer.admit.admit, lineage: answer.admit.lineage,
    opening: { carriage: answer.carriage, salt: answer.admit.salt }, ...(answer.reach.syncUrl ? { syncUrl: answer.reach.syncUrl } : {}),
  };
  const root = heldNexusRoot({ nexus: aid, charter: doc, denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() });
  if ("absent" in root) return { refusal: "charter-unread", detail: `the answer's charter seats no root (${root.absent}).` };
  const signed = await verifySignedAdmitBundle(bundle, root);
  if ("refusal" in signed) return { refusal: `admit-${signed.refusal}`, detail: `the face's admit does not hold at the hearth's charter (${signed.refusal}${signed.state ? `: ${signed.state}` : ""}).` };
  return { aid, bundle };
}

/** The joinee's kept floor pins, re-exported where the land keeps them. */
export { hearthFloorPinsPathFor, readKeptHearthFloorPins } from "../hearth-floor-pin-store.js";
