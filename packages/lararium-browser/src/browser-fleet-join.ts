/**
 * browser-fleet-join — THE FLEET-JOIN DOOR's joining half on a browser vessel: one face's fleet takes this browser.
 *
 * Two acts on this browser, with the root holder's two between them (`lares fleet join offer` and `answer`):
 *
 *   REQUEST  read the offer the human carried here, mint one face-scoped key per offered scope into this browser's
 *            own store, request a certificate over each, and keep the join pending beside the X25519 secret the
 *            answer seals to. The request goes back by the same hands.
 *   LAND     read the answer under the root key the KEPT offer named, land the face's address secret and the
 *            face's record, and hand back the admit the answer carried. The caller boots the vessel on it, as the
 *            admit door always has; the gate pin and the canon list rode INSIDE the root's signature.
 *
 * The request composes through the one composer the node's door uses (`composeFleetJoinRequest`), and the admit
 * reads through the one reader (`carriedAdmitOfFleetJoin`), so a browser and a node spell one join alike. This
 * browser receives no root bytes and no private face key: its face-scoped keys are born here and stay here.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-chain · lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings
 */
import * as ed25519 from "@noble/ed25519";
import {
  composeFleetJoinRequest, fleetJoinSealPair, hex, hexToBytes, readFleetJoinAnswer, readFleetJoinOffer,
  readFleetJoinRequest,
  type FaceScope, type FleetJoinAnswer, type FleetJoinOffer, type FleetJoinRequest, type VesselFaceKeyCustody,
} from "@lararium/mesh";
import { carriedAdmitOfFleetJoin, type CarriedAdmitPayload } from "@lararium/keyhive";
import {
  FLEET_JOIN_STORE, VESSEL_FACE_KEY_STORE, idbDelete, idbGet, idbPut, loadBrowserSigningSeed, openVesselIdb,
} from "./browser-vessel-identity.js";

/** A fleet join this browser refused, by name: a mesh reader's refusal, or this door's own. */
export class BrowserFleetJoinRefused extends Error {
  constructor(readonly refusal: string, detail: string) {
    super(`${refusal}: ${detail}`);
    this.name = "BrowserFleetJoinRefused";
  }
}

const PENDING = "pending";
const isRefusal = (v: unknown): v is { refusal: string } => typeof v === "object" && v !== null && "refusal" in v;
const faceKeyRow = (scope: FaceScope): string => `${scope.nexus}|${scope.faceKey.toLowerCase()}`;

/** What this browser keeps while its join stands pending. */
interface PendingJoin { readonly offer: FleetJoinOffer; readonly request: FleetJoinRequest; readonly sealSecret: string }

async function withDb<T>(idbName: string, act: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openVesselIdb(idbName);
  try { return await act(db); } finally { db.close(); }
}

/** Seal this browser's freshly minted face-scoped key for `scope`. A key standing there already refuses. */
async function storeVesselFaceKey(idbName: string, scope: FaceScope, secret: Uint8Array): Promise<void> {
  await withDb(idbName, async (db) => {
    const standing = await idbGet<Uint8Array>(db, VESSEL_FACE_KEY_STORE, faceKeyRow(scope));
    if (standing !== undefined) throw new BrowserFleetJoinRefused("face-key-standing", `this browser already holds a key for the face at ${scope.nexus}.`);
    await idbPut(db, VESSEL_FACE_KEY_STORE, faceKeyRow(scope), Uint8Array.from(secret));
  });
}

/** This browser's custody door for its face-scoped keys (`VesselFaceKeyCustody`): the row at the scope signs, once
 *  its key answers the key the caller named. */
export function browserVesselFaceKeyCustody(idbName = "lares:vessel"): VesselFaceKeyCustody {
  return {
    async signAsVesselFace(scope, vesselFaceKey, image) {
      const secret = await withDb(idbName, (db) => idbGet<Uint8Array>(db, VESSEL_FACE_KEY_STORE, faceKeyRow(scope)));
      if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new BrowserFleetJoinRefused("face-key-absent", `no face-scoped key stands for ${scope.nexus}.`);
      const held = Uint8Array.from(secret);
      try {
        if (hex(await ed25519.getPublicKeyAsync(held)) !== vesselFaceKey.toLowerCase()) throw new BrowserFleetJoinRefused("face-key-other", "the key at that scope names another key.");
        return await ed25519.signAsync(image, held);
      } finally { held.fill(0); }
    },
  };
}

async function readPending(idbName: string): Promise<PendingJoin | null> {
  return (await withDb(idbName, (db) => idbGet<PendingJoin>(db, FLEET_JOIN_STORE, PENDING))) ?? null;
}

/**
 * This browser's request over an offer the human carried here. The same offer again answers the request already
 * kept; another offer while one join stands pending refuses `join-pending`.
 */
export async function browserFleetJoinRequest(opts: { readonly offer: unknown; readonly idbName?: string }): Promise<FleetJoinRequest> {
  const idbName = opts.idbName ?? "lares:vessel";
  const offer = readFleetJoinOffer(opts.offer);
  if (isRefusal(offer)) throw new BrowserFleetJoinRefused(offer.refusal, "the offer does not read.");
  const pending = await readPending(idbName);
  if (pending !== null) {
    const kept = readFleetJoinRequest(pending.request, offer);
    if (!isRefusal(kept)) return kept;
    throw new BrowserFleetJoinRefused("join-pending", "another fleet join stands pending in this browser; land its answer, or abandon it.");
  }
  const seed = await loadBrowserSigningSeed(idbName);
  const seal = fleetJoinSealPair();
  try {
    const request = await composeFleetJoinRequest({
      offer, vesselKey: hex(await ed25519.getPublicKeyAsync(seed)), sealKey: seal.key,
      custody: browserVesselFaceKeyCustody(idbName),
      mintFaceKey: async (scope) => {
        const secret = crypto.getRandomValues(new Uint8Array(32));
        try {
          await storeVesselFaceKey(idbName, scope, secret);
          return hex(await ed25519.getPublicKeyAsync(secret));
        } finally { secret.fill(0); }
      },
      sign: async (image) => hex(await ed25519.signAsync(image, seed)),
    });
    if (isRefusal(request)) throw new BrowserFleetJoinRefused(request.refusal, "the request this browser composed does not read back.");
    const kept: PendingJoin = { offer, request, sealSecret: hex(seal.secret) };
    await withDb(idbName, (db) => idbPut(db, FLEET_JOIN_STORE, PENDING, kept));
    return request;
  } finally { seed.fill(0); seal.secret.fill(0); }
}

/** Abandon the join pending here; answers whether one stood. Its face-scoped keys stay at rest. */
export async function browserFleetJoinAbandon(idbName = "lares:vessel"): Promise<boolean> {
  const pending = await readPending(idbName);
  if (pending === null) return false;
  await withDb(idbName, (db) => idbDelete(db, FLEET_JOIN_STORE, PENDING));
  return true;
}

/**
 * Land an answer: read it under the root key the kept offer named, land the face's address secret and its record,
 * and hand back the admit it carried for the vessel's boot. The pending join leaves once the answer verified.
 */
export async function browserFleetJoinLand(opts: { readonly answer: unknown; readonly idbName?: string }): Promise<{ readonly answer: FleetJoinAnswer; readonly admit: CarriedAdmitPayload }> {
  const idbName = opts.idbName ?? "lares:vessel";
  const pending = await readPending(idbName);
  if (pending === null) throw new BrowserFleetJoinRefused("join-absent", "no fleet join stands pending in this browser; carry an offer here first.");
  const offer = readFleetJoinOffer(pending.offer);
  if (isRefusal(offer)) throw new BrowserFleetJoinRefused(offer.refusal, "the kept offer does not read.");
  const request = readFleetJoinRequest(pending.request, offer, [offer.rootKey]);
  if (isRefusal(request)) throw new BrowserFleetJoinRefused(request.refusal, "the kept request does not read.");
  const sealSecret = hexToBytes(pending.sealSecret);
  let verified;
  try {
    verified = readFleetJoinAnswer(opts.answer, { request, personaGroup: offer.personaGroup, rootKey: offer.rootKey, sealSecret });
  } finally { sealSecret.fill(0); }
  if (isRefusal(verified)) throw new BrowserFleetJoinRefused(verified.refusal, "the answer does not read against the request this browser sent.");
  const { answer, addressSecret } = verified;
  const admit = carriedAdmitOfFleetJoin(answer);
  if (isRefusal(admit)) { addressSecret.fill(0); throw new BrowserFleetJoinRefused(admit.refusal, "the answer's device edge does not found this face."); }
  try {
    await withDb(idbName, async (db) => {
      await idbPut(db, FLEET_JOIN_STORE, `secret:${answer.personaGroup}`, Uint8Array.from(addressSecret));
      await idbPut(db, FLEET_JOIN_STORE, `record:${answer.personaGroup}`, {
        personaGroup: answer.personaGroup, rootKey: offer.rootKey, certificates: answer.certificates, grants: answer.grants,
      });
      await idbDelete(db, FLEET_JOIN_STORE, PENDING);
    });
  } finally { addressSecret.fill(0); }
  return { answer, admit };
}
