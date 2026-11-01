/**
 * custody-holder — THE ONE HOLDER OF THE OPENED VESSEL KEY in a standing vessel.
 *
 * The vessel key (S key) and the opened custody root rest in this module's closure for as long as the vessel stays
 * unlocked, and nowhere else: no field, no log line, no refusal and no reading carries the key, the root, a
 * credential or a digest of one. Every hot row a standing vessel reads or writes passes through `readRow` /
 * `writeRow`; a cold row opens for one act (`openColdRow`) and its plaintext zero-fills when the act settles.
 *
 * ── THE FLOOR HOLDS NOTHING ─────────────────────────────────────────────────────────────────────
 * A fresh holder holds no key. Locked, a read answers `locked` and a write refuses `CustodyLocked`. `lock` waits
 * out every read and write in flight, then zero-fills and drops both secrets; nothing an unlock did touches disk,
 * so a restart always returns to the floor.
 *
 * ── A TORN ROW NEVER READS EMPTY ────────────────────────────────────────────────────────────────
 * `readRow` answers `opens`, `absent`, `locked`, or `unavailable` with the sealed reader's own name for what
 * stands (`torn`, `key-fails`, `bare`, `unopenable`). No caller may mint over `unavailable`.
 *
 * ── THE UNLOCK BOUND ────────────────────────────────────────────────────────────────────────────
 * Any process of the vessel's own user reaches the unlock door. Each credential that opens no slot spends one of
 * `UNLOCK_ATTEMPTS_PER_BOOT` attempts; once spent, every later unlock answers `attempts-spent` before any key
 * derivation runs. Nothing resets the count but a restart: no success, no lock. Unlocks run one at a time, so
 * parallel guesses never outrun the bound.
 *
 * ── A FOUNDING HANDS ITS KEY STRAIGHT IN ────────────────────────────────────────────────────────
 * The act that minted the vessel key holds it already; `adopt` takes that key, opens the custody root and the
 * serving key (SK) under it and holds all three, as an unlock does. It asks no credential and spends no attempt, and it refuses a key the custody root does not open
 * under, so a stranger key never sits here.
 *
 * Node-main only: a worker never imports this module.
 */
import { createHash } from "node:crypto";
import {
  openSealedCarrier, writeSealedCarrier, updateSealedCarrier, removeSealedCarrier, CustodyRefusal, treeKeyEquals,
  openFaceCarrier, writeFaceCarrier, updateFaceCarrier, removeFaceCarrier, commitFaceTree, bindSlot, mintFck,
  type Credential, type CustodyIo, type FaceCarrier, type FaceCustodyKey, type ServingKey, type SlotSpec, type TreeKey,
} from "@lararium/mesh";
import { nativeKdf } from "@lararium/mesh/node";
import { faceCarrierFor, openFaceTree } from "./face-custody.js";
import { appendFaceEntry, bindFaceAsk, FaceIndexRefused, bindFaceGroup, faceTreePath, findFace, readFaceIndex, retireFaceAsk } from "./face-index.js";
import { custodyDerive, custodyRootFromBytes, openCustodyRootCarrier, type CustodyRoot } from "./custody-root.js";
import { openCustodyNodeKey, unlockCustody } from "./custody-session.js";
import { carrierTable, sSlotsPath, type CarrierRow, type CustodyHome, type CustodyHomes, type FaceSelector } from "./vault-carriers.js";

export type HolderUnlock =
  | { readonly reading: "opens"; readonly slot: string }
  | { readonly reading: "already-unlocked" }
  | { readonly reading: "no-slot-opens"; readonly attemptsLeft: number }
  | { readonly reading: "attempts-spent" }
  | { readonly reading: "tree-absent" }
  | { readonly reading: "tree-unreadable"; readonly why: string }
  | { readonly reading: "root-unopenable"; readonly why: string };

/** What `proves` answers: whether a person presented a route of the tree this holder's own key rests in. */
export type HolderProof =
  | { readonly reading: "proves" }
  | { readonly reading: "locked"; readonly fcid?: string }
  | { readonly reading: "no-slot-opens"; readonly attemptsLeft: number }
  | { readonly reading: "attempts-spent" }
  | { readonly reading: "tree-absent" }
  | { readonly reading: "tree-unreadable"; readonly why: string };

export type RowReading =
  | { readonly reading: "opens"; readonly plaintext: Uint8Array }
  | { readonly reading: "absent" }
  | { readonly reading: "locked"; readonly fcid?: string }
  | { readonly reading: "unavailable"; readonly why: string };

/** What `updateRow`'s decision answers: the row's next plaintext (`null` writes nothing) and the caller's answer. */
export interface RowUpdate<T> { readonly plaintext: Uint8Array | null; readonly value: T }

export class CustodyLocked extends Error {
  override readonly name: string = "CustodyLocked";
  constructor(message = "this vessel's key rests unopened, so its sealed rows stay shut: open it with `lares vault unlock`") { super(message); }
}
/** A face's rows were asked for while that face rests unopened: the other faces' keys open none of them. */
export class FaceLocked extends CustodyLocked {
  override readonly name = "FaceLocked";
  constructor(readonly fcid: string) {
    super(`face ${fcid.slice(0, 8)} rests unopened, so its sealed rows stay shut: open it with \`lares vault unlock --face <N>\``);
  }
}
/** A face row was asked for and the floor index names no face that owns it. */
export class FaceCustodyAbsent extends Error {
  override readonly name = "FaceCustodyAbsent";
  constructor(file: string) { super(`custody row identity/${file} names a face this node holds no custody for; found or admit the face first`); }
}
/** A cold row that stands and does not open: the act never runs over anything but the row's own plaintext. */
export class CustodyRowUnavailable extends Error {
  override readonly name = "CustodyRowUnavailable";
  constructor(readonly home: CustodyHome, readonly file: string, readonly reading: string) {
    super(`custody row ${home}/${file} reads ${reading}`);
  }
}
export class CustodyRowUnknown extends Error {
  override readonly name = "CustodyRowUnknown";
  constructor(home: CustodyHome, file: string, detail = "no hot or cold carrier row matches") {
    super(`custody row ${home}/${file}: ${detail}`);
  }
}

/** Which face a call means: its local ordinal in the floor index, its group's digest, or its custody id. */
export type FaceRef = { readonly ordinal: number } | { readonly group: string } | { readonly fcid: string } | { readonly ask: string };

export type FaceUnlock =
  | { readonly reading: "opens"; readonly fcid: string; readonly ordinal: number; readonly slot: string }
  | { readonly reading: "already-unlocked"; readonly fcid: string; readonly ordinal: number }
  | { readonly reading: "no-slot-opens"; readonly fcid: string; readonly attemptsLeft: number }
  | { readonly reading: "attempts-spent"; readonly fcid: string }
  | { readonly reading: "face-absent" }
  | { readonly reading: "tree-absent"; readonly fcid: string }
  | { readonly reading: "tree-unreadable"; readonly fcid: string; readonly why: string }
  /** The floor index routed to a tree whose own D `face-owner` row names another face (or none): nothing seats. */
  | { readonly reading: "index-mismatch"; readonly fcid: string; readonly why: string };

/** The D row a face's directory keeps to authenticate the floor index entry that routed to it. */
export interface FaceOwnerRow { readonly fcid: string; readonly group: string | null }

export const UNLOCK_ATTEMPTS_PER_BOOT = 3;

export interface CustodyHolder {
  /** The homes this holder's rows rest in. */
  readonly homes: CustodyHomes;
  unlock(credentials: readonly Credential[]): Promise<HolderUnlock>;
  /**
   * PROVE A PERSON STANDS HERE, on a holder that already holds its key: the credentials open a slot of this
   * vessel's tree, and the key that slot yields equals the key held. An act that hands a face's root off the
   * vessel asks this first. A miss spends one of the boot's unlock attempts, exactly as an unlock's miss does,
   * and spent attempts refuse before any key derivation runs. Opens nothing new and holds nothing new.
   */
  proves(credentials: readonly Credential[]): Promise<HolderProof>;
  /** Hold a vessel key the caller already opened (a founding's own mint). Refuses a key the custody root does not open under. */
  adopt(treeKey: TreeKey): Promise<void>;
  lock(): Promise<void>;
  isUnlocked(): boolean;
  attemptsLeft(): number;
  openedSlot(): string | null;
  readRow(home: CustodyHome, file: string): Promise<RowReading>;
  writeRow(home: CustodyHome, file: string, plaintext: Uint8Array): Promise<void>;
  /**
   * Read a hot row, decide, and write it as ONE custody holder: no other writer in any process lands between the
   * read and the write. `decide` answers the row's next plaintext, or `null` to leave it as it stands.
   */
  updateRow<T>(home: CustodyHome, file: string, decide: (standing: RowReading) => RowUpdate<T>): Promise<T>;
  /** Move one hot row's bytes under one holder claim; a matching destination completes a stopped move. */
  moveRow(home: CustodyHome, source: string, destination: string, expected: Uint8Array): Promise<void>;
  /** Run a scan and its decisions under the same claim as a founding row move. */
  withRows<T>(act: (rows: { read(home: CustodyHome, file: string): Promise<Uint8Array | null>; remove(home: CustodyHome, file: string, when?: (bytes: Uint8Array) => boolean): Promise<boolean> }) => Promise<T>): Promise<T>;
  /**
   * Remove one hot row as ONE custody holder; answers whether a row stood. The holder removes only a row its own
   * key opens: a row that stands and does not open refuses `CustodyRowUnavailable` and stays.
   */
  removeRow(home: CustodyHome, file: string, when?: (plaintext: Uint8Array) => boolean): Promise<boolean>;
  /**
   * Remove one COLD row as ONE custody holder; answers whether a row stood. As `removeRow` does for a hot row,
   * the holder removes only a row its own key opens: a row that stands and does not open refuses
   * `CustodyRowUnavailable` and stays. An act removes a cold row once what the row committed stands done. `when`,
   * where given, reads the standing plaintext under the same hold: a row it declines stays, and the removal
   * answers false. The plaintext zero-fills once `when` returns.
   */
  removeColdRow(home: CustodyHome, file: string, when?: (plaintext: Uint8Array) => boolean): Promise<boolean>;
  openColdRow<T>(home: CustodyHome, file: string, act: (plaintext: Uint8Array) => Promise<T> | T): Promise<T>;
  /**
   * Read a cold row, decide, and write it as ONE custody holder, for a cold row whose mint must never land over a
   * standing one. `decide` receives the row's standing reading and answers its next plaintext, or `null` to leave
   * it as it stands. The standing plaintext zero-fills once the decision returns, so the decision keeps a copy of
   * what it needs and nothing else.
   */
  updateColdRow<T>(home: CustodyHome, file: string, decide: (standing: RowReading) => RowUpdate<T>): Promise<T>;
  /**
   * Run `act` as ONE custody holder, while this holder holds its key: no sealed write in any process lands while it
   * runs, and no other `exclusive` act either. For a floor row whose mint must land once and never over another
   * act's (the vessel key and its inception): `act` writes those bytes itself, outside the vessel key, and touches
   * no sealed row, since a sealed write inside it would wait on the claim it already holds. Locked refuses
   * `CustodyLocked` before `act` runs.
   */
  exclusive<T>(act: () => Promise<T>): Promise<T>;
  derive(domain: string): Uint8Array;
  // ── faces: each face's custody key (FCK) opens that face's rows alone ─────────────────────────────
  /**
   * Found one face's custody: a fresh custody id enters the floor index (under the group's digest or the founding's ask), a
   * fresh FCK is bound in the face's own slot tree under `slots`, and the face's `face-owner` row seals under it. The
   * founding hands the key straight in; the face stands unlocked.
   */
  foundFace(args: { readonly ask?: string | null; readonly group?: string | null; readonly ordinal?: number; readonly slots: readonly SlotSpec[] }): Promise<{ readonly ordinal: number; readonly fcid: string }>;
  /** Bind the group's digest to a face founded under its ask: the index entry and the `face-owner` row take it together. */
  bindFace(fcid: string, groupDigest: string): Promise<void>;
  /** Open one face with the presented credentials. Spends one of the boot's attempts for that face on a miss. */
  unlockFace(face: FaceRef, credentials: readonly Credential[]): Promise<FaceUnlock>;
  /** Try the credentials against every face's tree and open each one they fit; a face they do not fit stays shut and spends nothing. */
  unlockFaces(credentials: readonly Credential[]): Promise<readonly FaceUnlock[]>;
  /** A reserved face takes the founding ask whose digest could not stand before its first row. */
  bindFaceAsk(fcid: string, askDigest: string): Promise<void>;
  /** The founding ask leaves a face's entry once its rows moved under the group. */
  retireFaceAsk(fcid: string): Promise<void>;
  /** What the floor index names for a face, and whether it stands unlocked here. Opens nothing. */
  faceStanding(face: FaceRef): Promise<{ readonly ordinal: number; readonly fcid: string; readonly group: string | null; readonly ask: string | null; readonly unlocked: boolean } | null>;
  lockFace(fcid: string): Promise<void>;
  /** The custody ids of the faces standing unlocked. */
  unlockedFaces(): readonly string[];
  isFaceUnlocked(face: FaceRef): Promise<boolean>;
}

/** A key handed to `adopt` that the custody root does not open under. */
export class CustodyAdoptRefused extends Error {
  override readonly name = "CustodyAdoptRefused";
  constructor(reading: string) { super(`the custody root reads ${reading} under the key handed in; nothing is held`); }
}

/** Where a `(home, file)` row lives and which key opens it. */
type Located =
  | { readonly kind: "treeKey"; readonly row: CarrierRow; readonly path: string; readonly name: string }
  | { readonly kind: "face"; readonly row: CarrierRow; readonly path: string; readonly carrier: FaceCarrier; readonly fcid: string; readonly treePath: string };

interface FaceSeat { readonly fck: FaceCustodyKey; readonly slot: string | null; readonly ordinal: number }

const heldPort = (io: CustodyIo): CustodyIo => ({
  read: (path) => io.read(path), write: (path, bytes) => io.write(path, bytes), rename: (from, to) => io.rename(from, to),
  remove: (path) => io.remove(path), list: () => io.list(), exclusive: (act) => act(),
});

/**
 * A policy a test fixture seats so a WRITE to a row of a face the floor index does not name founds that face under the route
 * the policy answers, instead of refusing `FaceCustodyAbsent`. The product seats none: it founds each face by its own act
 * (`face-route`), and a write to an unfounded face refuses by name.
 */
let faceAutoFounder: ((selector: Exclude<FaceSelector, null>) => readonly SlotSpec[]) | null = null;
export function seatFaceAutoFounder(policy: ((selector: Exclude<FaceSelector, null>) => readonly SlotSpec[]) | null): void { faceAutoFounder = policy; }

export function makeCustodyHolder(a: { readonly io: CustodyIo; readonly homes: CustodyHomes }): CustodyHolder {
  let treeKey: TreeKey | null = null;
  // The serving key, opened through the serving tree's S key entry at every unlock and held beside the S key. No serving
  // row stands yet for it to open (the rows move under it with the ember's serving tier); the lock zero-fills it.
  let sk: ServingKey | null = null;
  let root: CustodyRoot | null = null;
  let slot: string | null = null;
  let spent = 0;
  const faceSpent = new Map<string, number>();
  const faces = new Map<string, FaceSeat>();
  let unlockChain: Promise<unknown> = Promise.resolve();
  let accepting = true;
  const active = new Set<Promise<unknown>>();

  const enqueueUnlock = (credentials: readonly Credential[]): Promise<HolderUnlock> => {
    const run = unlockChain.then(() => doUnlock(credentials), () => doUnlock(credentials));
    unlockChain = run.catch(() => undefined);
    return run;
  };
  const doUnlock = async (credentials: readonly Credential[]): Promise<HolderUnlock> => {
    if (treeKey !== null) return { reading: "already-unlocked" };
    if (spent >= UNLOCK_ATTEMPTS_PER_BOOT) return { reading: "attempts-spent" };
    const result = await unlockCustody({ io: a.io, homes: a.homes, credentials });
    if (result.reading === "no-slot-opens") {
      spent++;
      return { reading: "no-slot-opens", attemptsLeft: UNLOCK_ATTEMPTS_PER_BOOT - spent };
    }
    if (result.reading !== "opens") return result;
    const opened = await openCustodyRootCarrier({ io: a.io, treeKey: result.treeKey, identityDir: a.homes.identity });
    if (opened.reading !== "opens") {
      result.treeKey.fill(0);
      result.sk?.fill(0);
      return { reading: "root-unopenable", why: opened.reading };
    }
    treeKey = result.treeKey;
    sk = result.sk;
    root = custodyRootFromBytes(opened.opened);
    slot = result.slot;
    // The node key opens alone: no face key hangs from it. A face opens by its own unlock (`unlockFace`, `unlockFaces`).
    return { reading: "opens", slot };
  };
  const doProve = async (credentials: readonly Credential[]): Promise<HolderProof> => {
    if (treeKey === null || !accepting) return { reading: "locked" };
    if (spent >= UNLOCK_ATTEMPTS_PER_BOOT) return { reading: "attempts-spent" };
    const result = await openCustodyNodeKey({ io: a.io, homes: a.homes, credentials });
    if (result.reading === "no-slot-opens") {
      spent++;
      return { reading: "no-slot-opens", attemptsLeft: UNLOCK_ATTEMPTS_PER_BOOT - spent };
    }
    if (result.reading !== "opens") return result;
    // A route that opens a tree whose key differs from the one held proves nothing about this vessel.
    const same = treeKey !== null && treeKeyEquals(result.treeKey, treeKey);
    result.treeKey.fill(0);
    if (same) return { reading: "proves" };
    spent++;
    return { reading: "no-slot-opens", attemptsLeft: UNLOCK_ATTEMPTS_PER_BOOT - spent };
  };
  const operation = <T>(fn: () => Promise<T>): Promise<T> => {
    if (!accepting) return Promise.reject(new CustodyLocked());
    let tracked!: Promise<T>;
    tracked = fn().finally(() => active.delete(tracked));
    active.add(tracked);
    return tracked;
  };

  // ── the faces ───────────────────────────────────────────────────────────────────────────────────
  const ownerCarrier = (fcid: string): FaceCarrier => {
    const row = carrierTable().find((r) => r.row === "face-owner")!;
    return faceCarrierFor(a.homes, fcid, "face-owner.bin", row);
  };
  const encodeOwner = (owner: FaceOwnerRow): Uint8Array => new TextEncoder().encode(JSON.stringify({ fcid: owner.fcid, group: owner.group }));
  const decodeOwner = (bytes: Uint8Array): FaceOwnerRow | null => {
    try {
      const v = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
      if (Object.keys(v).sort().join(",") !== "fcid,group" || typeof v["fcid"] !== "string" || !(v["group"] === null || typeof v["group"] === "string")) return null;
      return { fcid: v["fcid"], group: v["group"] as string | null };
    } catch { return null; }
  };
  const resolveFace = async (by: FaceRef) => {
    const index = await readFaceIndex(a.io, a.homes.identity);
    return findFace(index, "ordinal" in by ? { ordinal: by.ordinal } : "group" in by ? { group: by.group } : "ask" in by ? { ask: by.ask } : { fcid: by.fcid });
  };
  const doFoundFace = async (args: { ask?: string | null; group?: string | null; ordinal?: number; fillRetired?: boolean; slots: readonly SlotSpec[] }) => {
    if (!Array.isArray(args.slots) || args.slots.length === 0) {
      throw new Error("[custody-holder] a face founding seals its custody from birth and needs a human route to bind; none was given");
    }
    return a.io.exclusive(async () => {
      const held = heldPort(a.io);
      const { ordinal, fcid } = await appendFaceEntry(held, a.homes.identity, { ask: args.ask ?? null, group: args.group ?? null, ...(args.ordinal !== undefined ? { ordinal: args.ordinal } : {}), ...(args.fillRetired ? { fillRetired: true } : {}) });
      const fck = mintFck();
      let tree = null as import("@lararium/mesh").SlotTree | null;
      for (const spec of args.slots) tree = await bindSlot(tree, fck, spec, nativeKdf);
      await commitFaceTree({ io: held, path: faceTreePath(a.homes.identity, fcid), expected: null, key: fck, tree: tree!, carriers: [] });
      await writeFaceCarrier({ io: held, key: fck, treePath: faceTreePath(a.homes.identity, fcid), carrier: ownerCarrier(fcid), plaintext: encodeOwner({ fcid, group: args.group ?? null }) });
      faces.set(fcid, { fck, slot: null, ordinal });
      return { ordinal, fcid };
    });
  };
  const doBindFace = async (fcid: string, groupDigest: string): Promise<void> => {
    const seat = faces.get(fcid);
    if (!seat) throw new FaceLocked(fcid);
    await a.io.exclusive(async () => {
      const held = heldPort(a.io);
      await bindFaceGroup(held, a.homes.identity, fcid, groupDigest);
      await updateFaceCarrier({
        io: held, key: seat.fck, treePath: faceTreePath(a.homes.identity, fcid), carrier: ownerCarrier(fcid),
        decide: () => ({ plaintext: encodeOwner({ fcid, group: groupDigest }), value: undefined }),
      });
    });
  };
  const doUnlockFace = async (by: FaceRef, credentials: readonly Credential[]): Promise<FaceUnlock> => {
    const found = await resolveFace(by);
    if (!found) return { reading: "face-absent" };
    const { fcid, ordinal } = found;
    if (faces.has(fcid)) return { reading: "already-unlocked", fcid, ordinal };
    if ((faceSpent.get(fcid) ?? 0) >= UNLOCK_ATTEMPTS_PER_BOOT) return { reading: "attempts-spent", fcid };
    const opened = await openFaceTree({ io: a.io, homes: a.homes, fcid, credentials });
    if (opened.reading === "no-slot-opens") {
      faceSpent.set(fcid, (faceSpent.get(fcid) ?? 0) + 1);
      return { reading: "no-slot-opens", fcid, attemptsLeft: UNLOCK_ATTEMPTS_PER_BOOT - (faceSpent.get(fcid) ?? 0) };
    }
    if (opened.reading === "tree-absent") return { reading: "tree-absent", fcid };
    if (opened.reading === "tree-unreadable") return { reading: "tree-unreadable", fcid, why: opened.why };
    // THE INDEX ROUTES AND NEVER DECIDES: the face's own D row must name the custody id and the group the index entry names.
    const owner = await openFaceCarrier({ io: a.io, key: opened.fck, carrier: ownerCarrier(fcid) });
    const refuse = (why: string): FaceUnlock => { opened.fck.fill(0); return { reading: "index-mismatch", fcid, why }; };
    if (owner.reading !== "opens") return refuse(`the face-owner row reads ${owner.reading}`);
    const named = decodeOwner(owner.plaintext);
    owner.plaintext.fill(0);
    if (named === null) return refuse("the face-owner row is malformed");
    if (named.fcid !== fcid) return refuse("the face-owner row names another custody id");
    if (named.group !== found.group) return refuse("the face-owner row names another group than the floor index entry");
    // ONCE THE FACE HOLDS ANCHORS, THEY AGREE TOO: the anchors row at the face's own handle index names a group, and that group
    // answers the floor index entry. Either row disagreeing with the index refuses by name before anything seats.
    const anchorsRow = carrierTable().find((r) => r.row === "anchors");
    if (anchorsRow) {
      const anchored = await openFaceCarrier({ io: a.io, key: opened.fck, carrier: faceCarrierFor(a.homes, fcid, `anchors-h${ordinal}.json`, anchorsRow) });
      if (anchored.reading === "opens") {
        let group: unknown = null;
        try { group = (JSON.parse(new TextDecoder().decode(anchored.plaintext)) as { personaGroupId?: unknown }).personaGroupId; } catch { /* unreadable */ }
        anchored.plaintext.fill(0);
        if (typeof group !== "string" || (found.group !== null && createHash("sha256").update(group).digest("hex") !== found.group)) {
          return refuse("the anchors row names another group than the floor index entry");
        }
      } else if (anchored.reading !== "absent") {
        return refuse(`the anchors row reads ${anchored.reading}`);
      }
    }
    faces.set(fcid, { fck: opened.fck, slot: opened.slot, ordinal });
    return { reading: "opens", fcid, ordinal, slot: opened.slot };
  };
  const doUnlockFaces = async (credentials: readonly Credential[]): Promise<FaceUnlock[]> => {
    const index = await readFaceIndex(a.io, a.homes.identity);
    const out: FaceUnlock[] = [];
    for (let ordinal = 0; ordinal < index.faces.length; ordinal++) {
      if (!("fcid" in index.faces[ordinal]!)) continue;
      out.push(await doUnlockFace({ ordinal }, credentials));
    }
    return out;
  };

  /** Resolve a logical `(home, file)` to the carrier that holds it and the key that opens it. */
  const locate = async (home: CustodyHome, file: string, coldAllowed: boolean, forWrite = false): Promise<Located> => {
    const sRow = carrierTable().find((r) => {
      if (r.home !== home || (r.custody !== "hot" && r.custody !== "cold")) return false;
      r.match.lastIndex = 0;
      return r.match.test(file);
    });
    if (sRow) {
      if (sRow.custody === "cold" && !coldAllowed) throw new CustodyRowUnknown(home, file, "cold rows require openColdRow");
      return { kind: "treeKey", row: sRow, path: `${a.homes[home]}/${file}`, name: `${home}/${file}` };
    }
    const faceRow = home === "identity" ? carrierTable().find((r) => r.faceRow !== undefined && r.faceRow.select !== null && r.faceRow.inner.test(file)) : undefined;
    if (!faceRow || faceRow.faceRow!.select(faceRow.faceRow!.inner.exec(file)!) === null) throw new CustodyRowUnknown(home, file);
    if (faceRow.custody === "face-cold" && !coldAllowed) throw new CustodyRowUnknown(home, file, "cold rows require openColdRow");
    const selector = faceRow.faceRow!.select(faceRow.faceRow!.inner.exec(file)!) as Exclude<FaceSelector, null>;
    let found = findFace(await readFaceIndex(a.io, a.homes.identity), selector);
    if (!found && forWrite && faceAutoFounder) {
      // Two writers racing to the same absent face found it once: the loser finds the winner's face standing.
      try { await doFoundFace({ fillRetired: true, ...("group" in selector ? { group: selector.group } : "ask" in selector ? { ask: selector.ask } : { ordinal: selector.ordinal }), slots: faceAutoFounder(selector) }); }
      catch (err) { if (!(err instanceof FaceIndexRefused)) throw err; }
      found = findFace(await readFaceIndex(a.io, a.homes.identity), selector);
    }
    if (!found) throw new FaceCustodyAbsent(file);
    const carrier = faceCarrierFor(a.homes, found.fcid, file, faceRow);
    return { kind: "face", row: faceRow, path: carrier.path, carrier, fcid: found.fcid, treePath: faceTreePath(a.homes.identity, found.fcid) };
  };
  const keyOf = (target: Located & { kind: "face" }): FaceCustodyKey => {
    const seat = faces.get(target.fcid);
    if (!seat || !accepting) throw new FaceLocked(target.fcid);
    return seat.fck;
  };
  const needTreeKey = (): TreeKey => {
    if (treeKey === null || !accepting) throw new CustodyLocked();
    return treeKey;
  };

  const doAdopt = async (handed: TreeKey): Promise<void> => {
    if (treeKey !== null) return;
    const opened = await openCustodyRootCarrier({ io: a.io, treeKey: handed, identityDir: a.homes.identity });
    if (opened.reading !== "opens") throw new CustodyAdoptRefused(opened.reading);
    treeKey = Uint8Array.from(handed) as TreeKey;
    sk = null;                       // the serving tree opens under its own route, never under the node key handed in
    root = custodyRootFromBytes(opened.opened);
    slot = null;
  };

  const asReading = (standing: { readonly reading: string; readonly plaintext?: Uint8Array }): RowReading =>
    standing.reading === "opens" ? { reading: "opens", plaintext: standing.plaintext! }
      : standing.reading === "absent" ? { reading: "absent" }
        : { reading: "unavailable", why: standing.reading };

  /** One read of one located row. */
  const readLocated = async (t: Located): Promise<RowReading> => {
    if (t.kind === "treeKey") {
      const result = await openSealedCarrier({ io: a.io, treeKey: needTreeKey(), carrier: { name: t.name, path: t.path, keyClass: t.row.keyClass } });
      return asReading(result);
    }
    return asReading(await openFaceCarrier({ io: a.io, key: keyOf(t), carrier: t.carrier }));
  };
  const updateLocated = <T>(t: Located, decide: (standing: RowReading) => RowUpdate<T>): Promise<T> => {
    if (t.kind === "treeKey") {
      return updateSealedCarrier({ io: a.io, treeKey: needTreeKey(), treePath: sSlotsPath(a.homes.identity), carrier: { name: t.name, path: t.path, keyClass: t.row.keyClass }, decide: (standing) => decide(asReading(standing)) });
    }
    return updateFaceCarrier({ io: a.io, key: keyOf(t), treePath: t.treePath, carrier: t.carrier, decide: (standing) => decide(asReading(standing)) });
  };
  const removeLocated = async (t: Located, when?: (plaintext: Uint8Array) => boolean): Promise<boolean> => {
    if (t.kind === "treeKey") {
      return removeSealedCarrier({ io: a.io, treeKey: needTreeKey(), treePath: sSlotsPath(a.homes.identity), carrier: { name: t.name, path: t.path, keyClass: t.row.keyClass }, ...(when ? { when } : {}) });
    }
    return removeFaceCarrier({ io: a.io, key: keyOf(t), treePath: t.treePath, carrier: t.carrier, ...(when ? { when } : {}) });
  };
  const refusedAs = (home: CustodyHome, file: string, err: unknown): never => {
    if (err instanceof CustodyRefusal) throw new CustodyRowUnavailable(home, file, err.reading);
    throw err;
  };

  return {
    homes: a.homes,
    unlock: enqueueUnlock,
    proves(credentials) {
      const run = unlockChain.then(() => doProve(credentials), () => doProve(credentials));
      unlockChain = run.catch(() => undefined);
      return run;
    },
    adopt(handed) {
      const run = unlockChain.then(() => doAdopt(handed), () => doAdopt(handed));
      unlockChain = run.catch(() => undefined);
      return run;
    },
    lock(): Promise<void> {
      accepting = false;
      // A lock takes its turn on the unlock chain: an unlock already deriving finishes first, so no key lands
      // after the lock that meant to drop it.
      const drop = async (): Promise<void> => {
        await Promise.allSettled([...active]);
        treeKey?.fill(0);
        sk?.fill(0);
        root?.bytes.fill(0);
        for (const seat of faces.values()) seat.fck.fill(0);
        faces.clear();
        treeKey = null;
        sk = null;
        root = null;
        slot = null;
        accepting = true;
      };
      const run = unlockChain.then(drop, drop);
      unlockChain = run.catch(() => undefined);
      return run;
    },
    isUnlocked: () => treeKey !== null,
    attemptsLeft: () => UNLOCK_ATTEMPTS_PER_BOOT - spent,
    openedSlot: () => slot,
    async readRow(home, file) {
      if (!accepting) return { reading: "locked" };
      let target: Located;
      try { target = await locate(home, file, false); } catch (err) { if (err instanceof FaceCustodyAbsent) return { reading: "absent" }; throw err; }
      if (target.kind === "treeKey" ? treeKey === null : !faces.has(target.fcid)) return target.kind === "face" ? { reading: "locked", fcid: target.fcid } : { reading: "locked" };
      return operation(() => readLocated(target));
    },
    async writeRow(home, file, plaintext) {
      const t = await locate(home, file, true, true);
      if (t.kind === "treeKey") {
        const key = needTreeKey();
        return operation(() => writeSealedCarrier({ io: a.io, treeKey: key, treePath: sSlotsPath(a.homes.identity), carrier: { name: t.name, path: t.path, keyClass: t.row.keyClass }, plaintext }));
      }
      const key = keyOf(t);
      return operation(() => writeFaceCarrier({ io: a.io, key, treePath: t.treePath, carrier: t.carrier, plaintext }));
    },
    async updateRow(home, file, decide) {
      // A face the index does not name holds no row: a decision that writes nothing reads it absent; one that writes founds the face
      // (a fixture's policy) or refuses `FaceCustodyAbsent`.
      let t: Located;
      try { t = await locate(home, file, false); } catch (err) {
        if (!(err instanceof FaceCustodyAbsent)) throw err;
        const probe = decide({ reading: "absent" });
        if (probe.plaintext === null) return probe.value;
        t = await locate(home, file, false, true);
      }
      if (t.kind === "treeKey") needTreeKey(); else keyOf(t);
      return operation(() => updateLocated(t, decide));
    },
    async moveRow(home, source, destination, expected) {
      if (source === destination) throw new Error("custody move names the same row twice");
      const from = await locate(home, source, false, true);
      const to = await locate(home, destination, false, true);
      if (from.kind !== to.kind || (from.kind === "face" && to.kind === "face" && from.fcid !== to.fcid)) {
        throw new Error("custody move spans two keys; a row moves only inside one key's carriers");
      }
      if (from.kind === "treeKey") needTreeKey(); else keyOf(from);
      return operation(() => a.io.exclusive(async () => {
        // The outer claim spans both sealed steps; the inner writer receives a claim already held.
        const io = heldPort(a.io);
        const equals = (bytes: Uint8Array) => bytes.length === expected.length && bytes.every((byte, i) => byte === expected[i]);
        const open = async (t: Located, file: string): Promise<RowReading> => {
          const reading = t.kind === "treeKey"
            ? asReading(await openSealedCarrier({ io, treeKey: needTreeKey(), carrier: { name: t.name, path: t.path, keyClass: t.row.keyClass } }))
            : asReading(await openFaceCarrier({ io, key: keyOf(t), carrier: t.carrier }));
          if (reading.reading !== "opens" && reading.reading !== "absent") throw new CustodyRowUnavailable(home, file, reading.reading === "unavailable" ? reading.why : reading.reading);
          return reading;
        };
        const standingSource = await open(from, source);
        const standingDestination = await open(to, destination);
        if (standingSource.reading === "opens" && !equals(standingSource.plaintext)) throw new Error("custody source row holds other bytes");
        if (standingDestination.reading === "opens" && !equals(standingDestination.plaintext)) throw new Error("custody destination row holds other bytes");
        // A source already gone (a re-entered founding recovered its seed from an earlier group row) still keeps the destination.
        if (standingDestination.reading === "absent") {
          if (to.kind === "treeKey") await writeSealedCarrier({ io, treeKey: needTreeKey(), treePath: sSlotsPath(a.homes.identity), carrier: { name: to.name, path: to.path, keyClass: to.row.keyClass }, plaintext: expected });
          else await writeFaceCarrier({ io, key: keyOf(to), treePath: to.treePath, carrier: to.carrier, plaintext: expected });
        }
        // Only these back-to-back steps expose two rows to a crash; re-entry removes the source.
        if (standingSource.reading === "opens") {
          if (from.kind === "treeKey") await removeSealedCarrier({ io, treeKey: needTreeKey(), treePath: sSlotsPath(a.homes.identity), carrier: { name: from.name, path: from.path, keyClass: from.row.keyClass } });
          else await removeFaceCarrier({ io, key: keyOf(from), treePath: from.treePath, carrier: from.carrier });
        }
      }));
    },
    withRows(act) {
      if (!accepting) return Promise.reject(new CustodyLocked());
      return operation(() => a.io.exclusive(async () => {
        const io = heldPort(a.io);
        return act({
          async read(home, file) {
            const t = await locate(home, file, false);
            const reading = t.kind === "treeKey"
              ? asReading(await openSealedCarrier({ io, treeKey: needTreeKey(), carrier: { name: t.name, path: t.path, keyClass: t.row.keyClass } }))
              : asReading(await openFaceCarrier({ io, key: keyOf(t), carrier: t.carrier }));
            if (reading.reading === "opens") return reading.plaintext;
            if (reading.reading === "absent") return null;
            throw new CustodyRowUnavailable(home, file, reading.reading === "unavailable" ? reading.why : reading.reading);
          },
          async remove(home, file, when) {
            const t = await locate(home, file, false);
            try {
              return t.kind === "treeKey"
                ? await removeSealedCarrier({ io, treeKey: needTreeKey(), treePath: sSlotsPath(a.homes.identity), carrier: { name: t.name, path: t.path, keyClass: t.row.keyClass }, ...(when ? { when } : {}) })
                : await removeFaceCarrier({ io, key: keyOf(t), treePath: t.treePath, carrier: t.carrier, ...(when ? { when } : {}) });
            } catch (error) { return refusedAs(home, file, error); }
          },
        });
      }));
    },
    async removeRow(home, file, when) {
      // A face this node holds no custody for holds no row to remove.
      let t: Located;
      try { t = await locate(home, file, false); } catch (err) { if (err instanceof FaceCustodyAbsent) return false; throw err; }
      if (t.kind === "treeKey") needTreeKey(); else keyOf(t);
      return operation(async () => { try { return await removeLocated(t, when); } catch (err) { return refusedAs(home, file, err); } });
    },
    async removeColdRow(home, file, when) {
      let t: Located;
      try { t = await locate(home, file, true); } catch (err) { if (err instanceof FaceCustodyAbsent) return false; throw err; }
      if (t.row.custody !== "cold" && t.row.custody !== "face-cold") throw new CustodyRowUnknown(home, file, "removeColdRow requires a cold row");
      if (t.kind === "treeKey") needTreeKey(); else keyOf(t);
      return operation(async () => { try { return await removeLocated(t, when); } catch (err) { return refusedAs(home, file, err); } });
    },
    async updateColdRow(home, file, decide) {
      let t: Located;
      try { t = await locate(home, file, true); } catch (err) {
        if (!(err instanceof FaceCustodyAbsent)) throw err;
        const probe = decide({ reading: "absent" });
        if (probe.plaintext === null) return probe.value;
        t = await locate(home, file, true, true);
      }
      if (t.row.custody !== "cold" && t.row.custody !== "face-cold") throw new CustodyRowUnknown(home, file, "updateColdRow requires a cold row");
      if (t.kind === "treeKey") needTreeKey(); else keyOf(t);
      return operation(() => updateLocated(t, (standing) => {
        try {
          const next = decide(standing);
          // A decision that hands the standing buffer back as the next plaintext gets its own copy, so the
          // zero-fill below never reaches the bytes about to seal.
          return next.plaintext !== null && standing.reading === "opens" && next.plaintext.buffer === standing.plaintext.buffer
            ? { ...next, plaintext: Uint8Array.from(next.plaintext) } : next;
        } finally {
          if (standing.reading === "opens") standing.plaintext.fill(0);
        }
      }));
    },
    async openColdRow(home, file, act) {
      const t = await locate(home, file, true);
      if (t.row.custody !== "cold" && t.row.custody !== "face-cold") throw new CustodyRowUnknown(home, file, "openColdRow requires a cold row");
      if (t.kind === "treeKey") needTreeKey(); else keyOf(t);
      return operation(async () => {
        const opened = await readLocated(t);
        if (opened.reading !== "opens") throw new CustodyRowUnavailable(home, file, opened.reading === "unavailable" ? opened.why : opened.reading);
        try { return await act(opened.plaintext); } finally { opened.plaintext.fill(0); }
      });
    },
    exclusive(act) {
      if (treeKey === null || !accepting) return Promise.reject(new CustodyLocked());
      return operation(() => a.io.exclusive(act));
    },
    derive(domain) {
      if (!accepting || root === null) throw new CustodyLocked();
      return custodyDerive(root, domain);
    },
    foundFace(args) {
      const run = unlockChain.then(() => doFoundFace(args), () => doFoundFace(args));
      unlockChain = run.catch(() => undefined);
      return run;
    },
    bindFace(fcid, groupDigest) {
      const run = unlockChain.then(() => doBindFace(fcid, groupDigest), () => doBindFace(fcid, groupDigest));
      unlockChain = run.catch(() => undefined);
      return run;
    },
    unlockFace(face, credentials) {
      const run = unlockChain.then(() => doUnlockFace(face, credentials), () => doUnlockFace(face, credentials));
      unlockChain = run.catch(() => undefined);
      return run;
    },
    unlockFaces(credentials) {
      const run = unlockChain.then(() => doUnlockFaces(credentials), () => doUnlockFaces(credentials));
      unlockChain = run.catch(() => undefined);
      return run;
    },
    bindFaceAsk(fcid, askDigest) {
      const run = unlockChain.then(() => a.io.exclusive(() => bindFaceAsk(heldPort(a.io), a.homes.identity, fcid, askDigest)), () => a.io.exclusive(() => bindFaceAsk(heldPort(a.io), a.homes.identity, fcid, askDigest)));
      unlockChain = run.catch(() => undefined);
      return run;
    },
    retireFaceAsk(fcid) {
      const run = unlockChain.then(() => a.io.exclusive(() => retireFaceAsk(heldPort(a.io), a.homes.identity, fcid)), () => a.io.exclusive(() => retireFaceAsk(heldPort(a.io), a.homes.identity, fcid)));
      unlockChain = run.catch(() => undefined);
      return run;
    },
    async faceStanding(face) {
      const found = await resolveFace(face);
      return found === null ? null : { ...found, unlocked: faces.has(found.fcid) };
    },
    lockFace(fcid) {
      const drop = async (): Promise<void> => {
        await Promise.allSettled([...active]);
        faces.get(fcid)?.fck.fill(0);
        faces.delete(fcid);
      };
      const run = unlockChain.then(drop, drop);
      unlockChain = run.catch(() => undefined);
      return run;
    },
    unlockedFaces: () => [...faces.keys()],
    async isFaceUnlocked(face) {
      const found = await resolveFace(face);
      return found !== null && faces.has(found.fcid);
    },
  };
}
