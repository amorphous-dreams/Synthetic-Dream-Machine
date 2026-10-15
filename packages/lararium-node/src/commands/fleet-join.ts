/**
 * fleet-join — THE FLEET-JOIN DOOR on a node vessel: one face's fleet takes a new vessel of the same human.
 *
 * Four acts, two on each vessel, and three files between them by courier (`@lararium/mesh` `fleet-join`):
 *
 *   OFFER    the root holder names the face, its root key, a fresh nonce and every (face key, Nexus) scope the
 *            face stands at. A scope stands where the face holds its per-Nexus key; the offer mints none.
 *   REQUEST  the joining vessel, a PLACE already founded (`lares vessel found`), mints one face-scoped key per
 *            offered scope into its own custody, requests a certificate over each, and keeps the join pending
 *            beside the X25519 secret the answer seals to.
 *   ANSWER   the root holder reads the request against the offer rebuilt over today's scopes and the request's
 *            own nonce, signs the device edge (`device-admit`), certifies each face-scoped key under its face
 *            key, grants each face key under the PersonaGroup root, seals the face's address secret to the
 *            request, and signs the whole: the gate pin and the canon list ride INSIDE the signed answer.
 *   LAND     the joining vessel reads the answer under the root key its kept offer named, lands the address
 *            secret and the face's record, and founds onto its place through the admit it carried.
 *
 * THE ROOT HOLDS NO LEDGER. Each answer reads its request against the scopes that stand when the operator runs
 * it, so an answer is an operator's act over a file the operator carried; nothing here answers a request by
 * itself. A joined vessel holds no root bytes and no private face key: the address secret is the one secret that
 * crosses, sealed to a key the request named.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-chain · lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { Repo } from "@automerge/automerge-repo";
import * as ed25519 from "@noble/ed25519";
import {
  PERSONA_GROUP_ID_TIDDLER, composeFleetJoinRequest, faceKeyGrantImage, fleetJoinAnswerImage, fleetJoinOffer,
  fleetJoinSealPair, foldWithdrawals, hex, issueCertificate, mintVesselFaceKey, readFleetJoinAnswer, readFleetJoinOffer,
  readFleetJoinRequest, sealAddressSecret,
  type FaceKeyGrant, type FaceScope, type FleetJoinAnswer, type FleetJoinOffer, type FleetJoinRequest,
  type VesselFaceCertificate,
} from "@lararium/mesh";
import { carriedAdmitOfFleetJoin } from "@lararium/keyhive";
import { primaryNexusAid, readCarriedCharters } from "../carried-set.js";
import { nexusKeyPublicOf, nodeFaceKeyCustody, nodeVesselFaceKeyCustody, readNexusKey, storeVesselFaceKey } from "../face-key-custody.js";
import {
  clearPendingFleetJoin, keepFaceJoinRecord, keepPendingFleetJoin, landFaceAddressSecret, mintFaceAddressSecret,
  readPendingFleetJoin,
} from "../fleet-join-custody.js";
import { loadPersonaGroupRootSeed, loadPersonaGroupRootVerifyingKey, loadVesselSigningSeed, loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { larBootstrapPath } from "../vessel-paths.js";
import { runDeviceAdmit } from "./device-admit.js";
import { runInit } from "./init.js";

/** The face this door joins: the founding face, as `device-admit` signs for it. */
const FACE = 0;

/** A fleet join refused by name: the mesh readers' refusal, or this door's own. */
export class FleetJoinRefused extends Error {
  override readonly name = "FleetJoinRefused";
  constructor(readonly refusal: string, detail: string) {
    super(`[lares fleet join] ${refusal}: ${detail}`);
  }
}

const isRefusal = (v: unknown): v is { refusal: string } =>
  typeof v === "object" && v !== null && typeof (v as { refusal?: unknown }).refusal === "string";

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

/** The PersonaGroup root's verifying key, where this vessel holds the root. */
async function heldRootKey(): Promise<string> {
  const key = (await loadPersonaGroupRootVerifyingKey(FACE))?.toLowerCase().replace(/^0x/, "");
  if (!key) throw new FleetJoinRefused("root-absent", "this vessel holds no PersonaGroup root; a fleet join is answered from the vessel that holds it.");
  return key;
}

/** Every (face key, Nexus) scope the face stands at here: each held charter's Nexus where the face holds its
 *  per-Nexus key. Reads only; mints no key. */
async function standingScopes(sealHome: string): Promise<FaceScope[]> {
  const aids = new Set<string>(readCarriedCharters(sealHome).keys());
  const primary = primaryNexusAid(sealHome);
  if (primary !== null) aids.add(primary);
  const scopes: FaceScope[] = [];
  for (const nexus of [...aids].sort()) {
    const seed = await readNexusKey(FACE, nexus);
    if (seed === null) continue;
    try { scopes.push({ faceKey: nexusKeyPublicOf(seed), nexus } as FaceScope); } finally { seed.fill(0); }
  }
  return scopes;
}

async function signHex(image: Uint8Array, seed: Uint8Array): Promise<string> {
  return hex(await ed25519.signAsync(image, seed));
}

// ── The root holder ──────────────────────────────────────────────────────────────────────────────

/** The root holder's offer: the face, its root key, a fresh nonce, and the scopes the face stands at. */
export async function runFleetJoinOffer(opts: { readonly sealHome: string }): Promise<FleetJoinOffer> {
  const personaGroup = bootstrapPersonaGroup();
  const rootKey = await heldRootKey();
  return fleetJoinOffer({ personaGroup, rootKey, nonce: randomBytes(32).toString("hex"), scopes: await standingScopes(opts.sealHome) });
}

export interface FleetJoinAnswerOptions {
  readonly repo:     Repo;
  readonly sealHome: string;
  /** The request file as the joinee wrote it. */
  readonly request:  unknown;
  /** The url the joinee dials this hearth at (`device-admit --sync-url`). */
  readonly syncUrl?: string;
}

/** The root holder's answer to ONE request, read against the offer rebuilt over today's scopes. */
export async function runFleetJoinAnswer(opts: FleetJoinAnswerOptions): Promise<FleetJoinAnswer> {
  const personaGroup = bootstrapPersonaGroup();
  const rootKey = await heldRootKey();
  const nonce = typeof opts.request === "object" && opts.request !== null ? (opts.request as { nonce?: unknown }).nonce : undefined;
  if (typeof nonce !== "string" || !/^[0-9a-f]{64}$/.test(nonce)) throw new FleetJoinRefused("request-malformed", "the request names no nonce.");
  const offer = fleetJoinOffer({ personaGroup, rootKey, nonce, scopes: await standingScopes(opts.sealHome) });
  const apart = [rootKey, (await loadVesselVerifyingKey()).toLowerCase()];
  const request = readFleetJoinRequest(opts.request, offer, apart);
  if (isRefusal(request)) throw new FleetJoinRefused(request.refusal, "the request does not read against this face's offer as it stands now.");

  // THE DEVICE EDGE: the same door `device-admit` runs, binding the joinee's vessel key to this hearth.
  const { payload, carried } = await runDeviceAdmit({ repo: opts.repo, joineeVerifyingKey: request.vesselKey, ...(opts.syncUrl ? { syncUrl: opts.syncUrl } : {}) });
  if (typeof carried.hearthGatePubKey !== "string") throw new FleetJoinRefused("pin-absent", "the hearth names no gate key to pin.");

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

  const seed = await loadPersonaGroupRootSeed(FACE);
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
      carriage: { gatePin: carried.hearthGatePubKey, canon: carried.hearthCanonDocs ?? {} },
      reach: { syncUrl: payload.syncUrl, islandKind: carried.hearthIslandKind ?? null, islandScope: carried.hearthIslandScope ?? null },
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
  let request;
  try {
    request = await composeFleetJoinRequest({
      offer, vesselKey, sealKey: seal.key, custody: nodeVesselFaceKeyCustody,
      mintFaceKey: async (scope) => {
        const minted = await mintVesselFaceKey();
        try { await storeVesselFaceKey(scope, minted.secret); } finally { minted.secret.fill(0); }
        return minted.publicKey;
      },
      sign: (image) => signHex(image, seed),
    });
  } finally { seed.fill(0); }
  if (isRefusal(request)) { seal.secret.fill(0); throw new FleetJoinRefused(request.refusal, "the request this vessel composed does not read back."); }
  try { await keepPendingFleetJoin({ request, offer, sealSecret: hex(seal.secret) }); } finally { seal.secret.fill(0); }
  return request;
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
  if ("refusal" in admit) throw new FleetJoinRefused(admit.refusal, "the answer's device edge does not found this face.");
  try { await landFaceAddressSecret(answer.personaGroup, addressSecret); } finally { addressSecret.fill(0); }
  await keepFaceJoinRecord({ personaGroup: answer.personaGroup, rootKey: offer.rootKey, certificates: answer.certificates, grants: answer.grants });
  await runInit({ repo: opts.repo, force: true, admitPayload: admit, custody: { slots: [] } });
  await clearPendingFleetJoin(request.nonce);
  return answer;
}
