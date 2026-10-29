/**
 * browser-fleet-join — THE FLEET-JOIN DOOR's joining half on a browser vessel: one face's fleet takes this browser.
 *
 * Two acts on this browser, with the root holder's two between them (`lares fleet join offer` and `answer`):
 *
 *   REQUEST  read the offer the human carried here, mint one face-scoped key per offered scope into this browser's
 *            own sealed custody rows, request a certificate over each, and keep the join pending beside the X25519 secret the
 *            answer seals to. The request goes back by the same hands.
 *   LAND     read the answer under the root key the KEPT offer named, land the face's address secret and the
 *            face's record, and hand back the admit the answer carried. The caller boots the vessel on it, as the
 *            admit door does; the gate pin and the canon list ride INSIDE the root's signature.
 *   SETTLE   once that boot stands, the landed join leaves. Until then the same answer lands again, so a boot
 *            that never came up retries from the same paste.
 *
 * The request composes through the one composer the node's door uses (`composeFleetJoinRequest`), and the admit
 * reads through the one reader (`carriedAdmitOfFleetJoin`), so a browser and a node spell one join alike. This
 * browser receives no root bytes.
 *
 * WHAT RESTS WHERE: face keys, the pending join and address secret rest under the slot tree in `keystore`;
 * signed public records and dials rest in the fleet-join store.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-chain · lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings
 */
import * as ed25519 from "@noble/ed25519";
import {
  bytesEqual, composeFleetJoinRequest, fleetJoinSealPair, hex, hexToBytes, readFleetJoinAnswer, readFleetJoinOffer,
  readFleetJoinRequest,
  type FaceScope, type FleetJoinAnswer, type FleetJoinOffer, type FleetJoinRequest, type VesselFaceKeyCustody,
} from "@lararium/mesh";
import { carriedAdmitOfFleetJoin, type CarriedAdmitPayload } from "@lararium/keyhive";
import {
  FLEET_JOIN_STORE, idbGet, idbKeys, openVesselIdb,
} from "./browser-vessel-identity.js";
import { readKeystoreRow, withCustodyRows } from "./browser-custody.js";
import { browserFaceAtom, faceAddressSecretRow } from "./browser-face-atom.js";

/** A fleet join this browser refused, by name: a mesh reader's refusal, or this door's own. */
export class BrowserFleetJoinRefused extends Error {
  constructor(readonly refusal: string, detail: string) {
    super(`${refusal}: ${detail}`);
    this.name = "BrowserFleetJoinRefused";
  }
}

/** A face's pending join rests in its own row, so two faces join at once and one never answers for another. */
const PENDING_PREFIX = "fleet-join-pending/";
const pendingRow = (personaGroup: string): string => `${PENDING_PREFIX}${personaGroup}`;
const isRefusal = (v: unknown): v is { refusal: string } => typeof v === "object" && v !== null && "refusal" in v;
const faceKeyRow = (scope: FaceScope): string => `vessel-face-key/${scope.nexus}|${scope.faceKey.toLowerCase()}`;

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

/** The face-scoped key standing for `scope`, or `fresh` sealed there when none stands, read and written in one
 *  custody act: a key an earlier request left at rest answers again, so the same offer retries clean. */
async function standOrStoreVesselFaceKey(idbName: string, scope: FaceScope, fresh: Uint8Array): Promise<Uint8Array> {
  return withCustodyRows(idbName, async (rows) => {
    const standing = await rows.read(faceKeyRow(scope));
    if (standing === undefined) { await rows.write(faceKeyRow(scope), fresh); return Uint8Array.from(fresh); }
    if (!(standing instanceof Uint8Array) || standing.length !== 32) throw new BrowserFleetJoinRefused("face-key-malformed", `the key standing for ${scope.nexus} does not read.`);
    return Uint8Array.from(standing);
  });
}

/** This browser's custody door for its face-scoped keys (`VesselFaceKeyCustody`): the row at the scope signs, once
 *  its key answers the key the caller named. */
export function browserVesselFaceKeyCustody(idbName = "lares:vessel"): VesselFaceKeyCustody {
  return {
    async signAsVesselFace(scope, vesselFaceKey, image) {
      const secret = await readKeystoreRow(idbName, faceKeyRow(scope));
      if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new BrowserFleetJoinRefused("face-key-absent", `no face-scoped key stands for ${scope.nexus}.`);
      const held = Uint8Array.from(secret);
      try {
        if (hex(await ed25519.getPublicKeyAsync(held)) !== vesselFaceKey.toLowerCase()) throw new BrowserFleetJoinRefused("face-key-other", "the key at that scope names another key.");
        return await ed25519.signAsync(image, held);
      } finally { held.fill(0); }
    },
  };
}

async function readPending(idbName: string, personaGroup: string): Promise<PendingJoin | null> {
  return (await readKeystoreRow(idbName, pendingRow(personaGroup)) as PendingJoin | undefined) ?? null;
}

/** Every face with a join pending in this browser, from the keystore's row names (clear or sealed). */
async function pendingGroups(idbName: string): Promise<string[]> {
  const db = await openVesselIdb(idbName);
  try {
    return (await idbKeys(db, "keystore")).map((k) => /^(?:sealed\/)?fleet-join-pending\/(.+)$/.exec(k)?.[1]).filter((g): g is string => g !== undefined).sort();
  } finally { db.close(); }
}

/**
 * This browser's request over an offer the human carried here. The same offer again answers the request already
 * kept; another offer while one join stands pending refuses `join-pending`.
 */
export async function browserFleetJoinRequest(opts: { readonly offer: unknown; readonly idbName?: string }): Promise<FleetJoinRequest> {
  const idbName = opts.idbName ?? "lares:vessel";
  const offer = readFleetJoinOffer(opts.offer);
  if (isRefusal(offer)) throw new BrowserFleetJoinRefused(offer.refusal, "the offer does not read.");
  const pending = await readPending(idbName, offer.personaGroup);
  if (pending !== null) {
    const kept = readFleetJoinRequest(pending.request, offer);
    if (!isRefusal(kept)) return kept;
    throw new BrowserFleetJoinRefused("join-pending", "another fleet join stands pending for this face in this browser; land its answer, or abandon it.");
  }
  const atom = await browserFaceAtom(idbName, offer.personaGroup);
  const seal = fleetJoinSealPair();
  try {
    const request = await composeFleetJoinRequest({
      offer, atomKey: atom.key, sealKey: seal.key,
      custody: browserVesselFaceKeyCustody(idbName),
      mintFaceKey: async (scope) => {
        const fresh = crypto.getRandomValues(new Uint8Array(32));
        let held: Uint8Array | null = null;
        try {
          held = await standOrStoreVesselFaceKey(idbName, scope, fresh);
          return hex(await ed25519.getPublicKeyAsync(held));
        } finally { fresh.fill(0); held?.fill(0); }
      },
      sign: (image) => atom.sign(image),
    });
    if (isRefusal(request)) throw new BrowserFleetJoinRefused(request.refusal, "the request this browser composed does not read back.");
    const kept: PendingJoin = { offer, request, sealSecret: hex(seal.secret) };
    await withCustodyRows(idbName, async (rows) => {
      if (await rows.read(pendingRow(offer.personaGroup)) !== undefined) throw new BrowserFleetJoinRefused("join-pending", "another fleet join for this face came to stand pending in this browser meanwhile.");
      await rows.write(pendingRow(offer.personaGroup), kept);
    });
    return request;
  } finally { seal.secret.fill(0); }
}

/** Clear the pending row inside one transaction, when `keep` reads it as the one to clear; answers whether it went. */
function clearPendingWhere(idbName: string, personaGroup: string, clear: (p: PendingJoin) => boolean): Promise<boolean> {
  return withCustodyRows(idbName, async (rows) => {
    const p = await rows.read(pendingRow(personaGroup)) as PendingJoin | undefined;
    if (!p || !clear(p)) return false;
    await rows.delete(pendingRow(personaGroup));
    return true;
  });
}

/** Abandon the join pending here; answers whether one stood. Its face-scoped keys stay at rest. */
export async function browserFleetJoinAbandon(idbName = "lares:vessel", personaGroup?: string): Promise<boolean> {
  let group = personaGroup;
  if (group === undefined) {
    const standing = await pendingGroups(idbName);
    if (standing.length > 1) throw new BrowserFleetJoinRefused("face-not-named", "joins stand pending for several faces; name the face to abandon.");
    group = standing[0];
    if (group === undefined) return false;
  }
  return clearPendingWhere(idbName, group, () => true);
}

/**
 * Land an answer: read it under the root key the kept offer named, land the face's address secret and its record,
 * and hand back the admit it carried for the vessel's boot. The pending join stays, marked landed, until
 * `browserFleetJoinSettle` once the boot stands: the same answer lands again meanwhile, and a standing secret or
 * record under other bytes refuses untouched. The custody act lock holds the cross-store order.
 */
export async function browserFleetJoinLand(opts: { readonly answer: unknown; readonly idbName?: string }): Promise<{ readonly answer: FleetJoinAnswer; readonly admit: CarriedAdmitPayload }> {
  const idbName = opts.idbName ?? "lares:vessel";
  // The answer names its face; the kept offer for THAT face is read, and the answer verifies against it below.
  const answeredGroup = (opts.answer as { personaGroup?: unknown } | null)?.personaGroup;
  const pending = typeof answeredGroup === "string" ? await readPending(idbName, answeredGroup) : null;
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
  const secretRow = faceAddressSecretRow(answer.personaGroup);
  const recordRow = `record:${answer.personaGroup}`;
  try {
    await withCustodyRows(idbName, async (rows) => {
      const p = await rows.read(pendingRow(offer.personaGroup)) as PendingJoin | undefined;
      if (p?.request?.nonce !== request.nonce || p.request.sealKey !== request.sealKey) {
        throw new BrowserFleetJoinRefused("join-absent", "no join pending here matches the request this answer lands.");
      }
      const standingSecret = await rows.read(secretRow);
      if (standingSecret !== undefined && !(standingSecret instanceof Uint8Array && bytesEqual(standingSecret, addressSecret))) {
        throw new BrowserFleetJoinRefused("secret-other", "this browser holds another address secret for that face.");
      }
      const standingRecord = await withDb(idbName, (db) => idbGet<{ rootKey?: unknown }>(db, FLEET_JOIN_STORE, recordRow));
      if (standingRecord !== undefined && standingRecord.rootKey !== offer.rootKey) {
        throw new BrowserFleetJoinRefused("record-other", "this browser holds that face's record under another root key.");
      }
      // Cross-store order: check all standing rows, seal the secret, commit public record and dial together,
      // then mark pending landed. Any stop leaves the same answer ready to land again.
      await rows.write(secretRow, addressSecret);
      await withDb(idbName, (db) => inOneTransaction<void>(db, FLEET_JOIN_STORE, (os, _refuse, done) => {
        os.put({ personaGroup: answer.personaGroup, rootKey: offer.rootKey, certificates: answer.certificates, grants: answer.grants }, recordRow);
        os.put({ charter: answer.charter, admit: answer.admit, carriage: answer.carriage } satisfies KeptFleetJoinDial, dialRow(answer.personaGroup));
        done(undefined);
      }));
      await rows.write(pendingRow(offer.personaGroup), { ...p, landed: true } satisfies PendingJoin);
    });
  } finally { addressSecret.fill(0); }
  return { answer, admit };
}

/** The boot on a landed join stands: the pending join leaves. Answers whether a landed join stood; a join whose
 *  answer has not landed stays pending, whichever tab kept it. */
export async function browserFleetJoinSettle(idbName = "lares:vessel", personaGroup?: string): Promise<boolean> {
  const groups = personaGroup === undefined ? await pendingGroups(idbName) : [personaGroup];
  let settled = false;
  for (const group of groups) if (await clearPendingWhere(idbName, group, (p) => p.landed === true)) settled = true;
  return settled;
}
