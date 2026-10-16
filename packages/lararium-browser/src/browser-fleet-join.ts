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
 *            admit door does; the gate pin and the canon list ride INSIDE the root's signature.
 *   SETTLE   once that boot stands, the landed join leaves. Until then the same answer lands again, so a boot
 *            that never came up retries from the same paste.
 *
 * The request composes through the one composer the node's door uses (`composeFleetJoinRequest`), and the admit
 * reads through the one reader (`carriedAdmitOfFleetJoin`), so a browser and a node spell one join alike. This
 * browser receives no root bytes and no private face key: it mints its own face-scoped keys and keeps them here.
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
  FLEET_JOIN_STORE, VESSEL_FACE_KEY_STORE, idbGet, loadBrowserSigningSeed, openVesselIdb,
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

/** The dial a landed answer carried, kept per face (`dial:<group>`): what the face's presentation reads at its hearth. */
export interface KeptFleetJoinDial {
  readonly charter:  FleetJoinAnswer["charter"];
  readonly admit:    FleetJoinAnswer["admit"];
  readonly carriage: FleetJoinAnswer["carriage"];
}
/** The row a face's kept dial rests at in the fleet-join store. */
export const dialRow = (personaGroup: string): string => `dial:${personaGroup}`;

/** What this browser keeps while its join stands pending; `landed` once its answer landed, awaiting the boot. */
interface PendingJoin { readonly offer: FleetJoinOffer; readonly request: FleetJoinRequest; readonly sealSecret: string; readonly landed?: true }

async function withDb<T>(idbName: string, act: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openVesselIdb(idbName);
  try { return await act(db); } finally { db.close(); }
}

/** One readwrite transaction over `store`, settled on its commit: `act` stages its requests and names a refusal to
 *  abort on, and the promise resolves only once the browser committed every write. */
function inOneTransaction<T>(db: IDBDatabase, store: string, act: (os: IDBObjectStore, refuse: (e: Error) => void, done: (v: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    let refusal: Error | null = null;
    let value: T;
    tx.oncomplete = () => resolve(value);
    tx.onabort = () => reject(refusal ?? tx.error);
    tx.onerror = () => { /* onabort carries the refusal */ };
    act(tx.objectStore(store), (e) => { refusal = e; tx.abort(); }, (v) => { value = v; });
  });
}
const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

/** The face-scoped key standing for `scope`, or `fresh` sealed there when none stands, read and written in one
 *  transaction: a key an earlier request left at rest answers again, so the same offer retries clean. */
async function standOrStoreVesselFaceKey(idbName: string, scope: FaceScope, fresh: Uint8Array): Promise<Uint8Array> {
  return withDb(idbName, (db) => inOneTransaction<Uint8Array>(db, VESSEL_FACE_KEY_STORE, (os, refuse, done) => {
    const got = os.get(faceKeyRow(scope));
    got.onsuccess = () => {
      const standing: unknown = got.result;
      if (standing === undefined) { os.put(Uint8Array.from(fresh), faceKeyRow(scope)); done(Uint8Array.from(fresh)); return; }
      if (!(standing instanceof Uint8Array) || standing.length !== 32) { refuse(new BrowserFleetJoinRefused("face-key-malformed", `the key standing for ${scope.nexus} does not read.`)); return; }
      done(Uint8Array.from(standing));
    };
  }));
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
        const fresh = crypto.getRandomValues(new Uint8Array(32));
        let held: Uint8Array | null = null;
        try {
          held = await standOrStoreVesselFaceKey(idbName, scope, fresh);
          return hex(await ed25519.getPublicKeyAsync(held));
        } finally { fresh.fill(0); held?.fill(0); }
      },
      sign: async (image) => hex(await ed25519.signAsync(image, seed)),
    });
    if (isRefusal(request)) throw new BrowserFleetJoinRefused(request.refusal, "the request this browser composed does not read back.");
    const kept: PendingJoin = { offer, request, sealSecret: hex(seal.secret) };
    // `add`, never `put`: a join another tab kept in the meantime refuses rather than vanishing under this one.
    await withDb(idbName, (db) => inOneTransaction<void>(db, FLEET_JOIN_STORE, (os, refuse, done) => {
      const added = os.add(kept, PENDING);
      added.onsuccess = () => done(undefined);
      added.onerror = (e) => {
        if (added.error?.name !== "ConstraintError") return;   // the transaction aborts on the error itself
        e.preventDefault();
        refuse(new BrowserFleetJoinRefused("join-pending", "another fleet join came to stand pending in this browser meanwhile."));
      };
    }));
    return request;
  } finally { seed.fill(0); seal.secret.fill(0); }
}

/** Clear the pending row inside one transaction, when `keep` reads it as the one to clear; answers whether it went. */
function clearPendingWhere(idbName: string, clear: (p: PendingJoin) => boolean): Promise<boolean> {
  return withDb(idbName, (db) => inOneTransaction<boolean>(db, FLEET_JOIN_STORE, (os, _refuse, done) => {
    const got = os.get(PENDING);
    got.onsuccess = () => {
      const p = got.result as PendingJoin | undefined;
      if (p === undefined || !clear(p)) { done(false); return; }
      os.delete(PENDING);
      done(true);
    };
  }));
}

/** Abandon the join pending here; answers whether one stood. Its face-scoped keys stay at rest. */
export async function browserFleetJoinAbandon(idbName = "lares:vessel"): Promise<boolean> {
  return clearPendingWhere(idbName, () => true);
}

/**
 * Land an answer: read it under the root key the kept offer named, land the face's address secret and its record,
 * and hand back the admit it carried for the vessel's boot. The pending join stays, marked landed, until
 * `browserFleetJoinSettle` once the boot stands: the same answer lands again meanwhile, and a standing secret or
 * record under other bytes refuses untouched. Every row commits in one transaction, or none does.
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
  const secretRow = `secret:${answer.personaGroup}`;
  const recordRow = `record:${answer.personaGroup}`;
  try {
    await withDb(idbName, (db) => inOneTransaction<void>(db, FLEET_JOIN_STORE, (os, refuse, done) => {
      const standingSecret = os.get(secretRow);
      standingSecret.onsuccess = () => {
        const s: unknown = standingSecret.result;
        if (s !== undefined && !(s instanceof Uint8Array && sameBytes(s, addressSecret))) {
          refuse(new BrowserFleetJoinRefused("secret-other", "this browser holds another address secret for that face.")); return;
        }
        const standingRecord = os.get(recordRow);
        standingRecord.onsuccess = () => {
          const r = standingRecord.result as { rootKey?: unknown } | undefined;
          if (r !== undefined && r.rootKey !== offer.rootKey) {
            refuse(new BrowserFleetJoinRefused("record-other", "this browser holds that face's record under another root key.")); return;
          }
          // The pending row reads again inside this transaction: a join another tab kept meanwhile stays its own.
          const stillPending = os.get(PENDING);
          stillPending.onsuccess = () => {
            const p = stillPending.result as PendingJoin | undefined;
            if (p?.request?.nonce !== request.nonce || p.request.sealKey !== request.sealKey) {
              refuse(new BrowserFleetJoinRefused("join-absent", "no join pending here matches the request this answer lands.")); return;
            }
            os.put(Uint8Array.from(addressSecret), secretRow);
            os.put({ personaGroup: answer.personaGroup, rootKey: offer.rootKey, certificates: answer.certificates, grants: answer.grants }, recordRow);
            // THE DIAL IT CARRIED, kept beside the record as the root signed it: the hearth's charter and the face's own admit
            // at the hearth's Nexus. The face's presentation reads them again at each dial (`browser-face-presentation`):
            // the charter seats the root the admit reads held at, so a torn one presents nothing, by name.
            os.put({ charter: answer.charter, admit: answer.admit, carriage: answer.carriage } satisfies KeptFleetJoinDial, dialRow(answer.personaGroup));
            os.put({ ...p, landed: true } satisfies PendingJoin, PENDING);
            done(undefined);
          };
        };
      };
    }));
  } finally { addressSecret.fill(0); }
  return { answer, admit };
}

/** The boot on a landed join stands: the pending join leaves. Answers whether a landed join stood; a join whose
 *  answer has not landed stays pending, whichever tab kept it. */
export async function browserFleetJoinSettle(idbName = "lares:vessel"): Promise<boolean> {
  return clearPendingWhere(idbName, (p) => p.landed === true);
}
