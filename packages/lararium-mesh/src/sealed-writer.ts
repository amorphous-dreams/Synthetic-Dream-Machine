/**
 * sealed-writer — THE one writer of tree-key-sealed carriers and of the slot tree that holds the tree key.
 *
 * TWO PROOFS GOVERN EVERY WRITE, both before any byte moves.
 *
 *  1. THE tree key IN HAND IS THE TREE'S. The slot tree standing at `treePath` carries the keyed check of its tree key
 *     (`keyslot.ts`), and every writer — a carrier write, a tree commit, a rotation — proves the tree key in hand against
 *     it. A mismatch refuses as `TreeKeyRefusal` (`tree-key-mismatch`); no tree standing, or a torn one, refuses too
 *     (`tree-absent`, `tree-unreadable`), since then no tree key is the vessel's. So a stranger tree key founds no carrier, and
 *     a process still holding a tree key a rotation retired writes nothing, an absent carrier included.
 *  2. THE KEY OPENS WHAT STANDS. A carrier accepts a write only when nothing stands there, or when the tree key opens the
 *     sealed bytes; every other reading refuses with its own name (`s-envelope.ts`): `key-fails`, `torn`,
 *     `unopenable`, `bare`.
 *
 * A wrong passphrase opens no tree key, so it reaches no write at all; a tree key the tree does not commit to replaces nothing.
 *
 * ONE HOLDER FROM CHECK TO RENAME. Every writer and the rotation run inside `io.exclusive`, so no write checks
 * against a tree a rotation then replaces before its rename lands. A carrier whose next bytes depend on its
 * standing ones (a set that gains or loses one entry) goes through `updateSealedCarrier`: the read, the decision
 * and the write share one holder, so no other writer in any process lands between them.
 *
 * THE SHAPE OF A WRITE: seal → write a SIDECAR → read it back → compare the bytes and open them → rename over the
 * carrier. It never seals in place, and a sidecar that does not read back as written never lands.
 *
 * A tree key ROTATION opens EVERY carrier under the old tree key before it writes a single temp: the failure that matters (a
 * carrier the old tree key does not open) costs nothing, because it surfaces while nothing has moved. Its carrier list
 * comes from the one carrier table (the node's `vault-carriers`), and the rotation checks that list against the
 * store: a file bearing the tree key seal's magic that the list omits refuses the whole rotation (`CensusRefusal`), so a
 * partial list strands nothing. It then binds the new tree, writes and checks every carrier sidecar, writes the
 * tree's sidecar LAST, and renames carriers before the tree. The tree's sidecar is the commit point: when it stands, every carrier sidecar beside it was written and
 * read back, so `settleRotation` finishes the renames; when it does not, the rotation never committed and the
 * carrier sidecars go. The unlock settles before it opens anything.
 *
 * THE GUARD PROVES THE KEY, NEVER THE CONTENT. An opening tree key still admits an empty state over a full one; the boot
 * hydrates from what it opens before anything writes back, and those two facts stay two.
 *
 * Platform-blind: the store arrives as a `CustodyIo` port (node `fs`, browser IndexedDB), and nothing here imports
 * `node:`.
 */

import { bytesEqual, defaultCryptoProvider, type RandomProvider } from "./crypto.js";
import { bindSlot, encodeSlotTree, decodeSlotTree, type KdfPort, type SlotSpec, type SlotTree } from "./keyslot.js";
import { sealUnderS, openUnderS, treeKeyAnswersCheck, type TreeKey, type TreeKeyOpening } from "./tree-key.js";
import { readSCarrier, type SCarrierReading } from "./s-envelope.js";
import { isRelationClass, type KeyClass } from "./key-class.js";
import { openUnderFck, sealUnderFck, type FaceCarrier, type FaceCustodyKey, type FckOpening } from "./fck.js";
import { readFckCarrier } from "./fck-envelope.js";

/** The store the writer works through. Every path names one file. */
export interface CustodyIo {
  /** The bytes standing at `path`, or `null` when nothing stands. */
  read(path: string): Promise<Uint8Array | null>;
  /** Write `bytes` at `path` whole or not at all, durably (temp → fsync → rename → fsync the directory). */
  write(path: string, bytes: Uint8Array): Promise<void>;
  /** Replace `to` with `from` in one atomic, durable step. */
  rename(from: string, to: string): Promise<void>;
  /** Remove `path`; nothing standing there is no fault. */
  remove(path: string): Promise<void>;
  /** Every path standing in the homes this store spans. The rotation's census check reads it. */
  list(): Promise<readonly string[]>;
  /**
   * Run `fn` as the one custody holder: no other `exclusive` call on the same homes runs until it settles, in this
   * process or any other (node: a lock file beside the slot tree; browser: one Web Lock). Not reentrant.
   */
  exclusive<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * One sealed carrier: the name its AEAD binds, and the path it rests at. `keyClass` carries the table row's class
 * when the row names one; a `relation` carrier's refusals say that only the other party re-issues its bytes.
 */
export interface SealedCarrier { readonly name: string; readonly path: string; readonly keyClass?: KeyClass | null }

/** The frame and context for one custody class; every mutating operation uses the same holder and tree proof. */
interface CarrierSeal<C extends SealedCarrier> {
  readonly open: (key: TreeKey, carrier: C, bytes: Uint8Array | null) => TreeKeyOpening | FckOpening;
  readonly seal: (key: TreeKey, carrier: C, plaintext: Uint8Array, rng: RandomProvider) => Uint8Array;
  readonly read: (bytes: Uint8Array | null) => SCarrierReading;
}
const S_SEAL: CarrierSeal<SealedCarrier> = {
  open: (key, carrier, bytes) => openUnderS(key, carrier.name, bytes),
  seal: (key, carrier, plaintext, rng) => sealUnderS(key, carrier.name, plaintext, rng),
  read: readSCarrier,
};
const FACE_SEAL: CarrierSeal<FaceCarrier> = { open: openUnderFck, seal: sealUnderFck, read: readFckCarrier };

/** The sidecar of a single write. A stray one never committed; settling removes it. */
export const SEALING_SUFFIX = ".s-sealing";
/** The sidecar of a tree key rotation. The tree's rotating sidecar marks the rotation committed. */
export const ROTATING_SUFFIX = ".s-rotating";

type RefusedReading = Exclude<TreeKeyOpening["reading"], "opens" | "absent">;

/** A write or rotation the standing bytes refuse. `reading` names the fact met; nothing was written. */
export class CustodyRefusal extends Error {
  constructor(readonly reading: RefusedReading, readonly carrier: SealedCarrier) {
    super(
      `sealed-writer: refusing to write over the carrier "${carrier.name}" at ${carrier.path} — ${SAYS[reading]}` +
      (carrier.keyClass && isRelationClass(carrier.keyClass) ? RELATION_LOSS : ""),
    );
    this.name = "CustodyRefusal";
  }
}

/** The sentence a relation carrier's refusal adds: no rotation, repair or re-founding regenerates it. */
const RELATION_LOSS =
  "; this carrier holds a relation secret that no house key derives, so only the other party can re-issue it " +
  "(a rotation re-seals it and can never regenerate it)";

const SAYS: Record<RefusedReading, string> = {
  "key-fails":
    "the tree key in hand does not open the bytes standing there, so this write would replace sealed state under a key " +
    "that never sealed it",
  torn:
    "the carrier is torn (the house magic over a frame too short to hold a nonce and a tag), so no credential is at " +
    "fault here; recover it from a backup rather than re-typing anything",
  unopenable:
    "it carries a seal this build cannot frame (a damaged magic, or another scheme of the house family), and a write " +
    "would destroy ciphertext that a repair could still recover; copy the carrier aside first",
  bare:
    "cleartext stands there, and this writer replaces only bytes the tree key sealed",
};

/** Why the standing tree refuses the tree key in hand. */
export type TreeKeyReading = "tree-absent" | "tree-unreadable" | "tree-key-mismatch";

/** A writer whose tree key the standing slot tree does not commit to. Nothing was written. */
export class TreeKeyRefusal extends Error {
  constructor(readonly reading: TreeKeyReading, readonly treePath: string) {
    super(`sealed-writer: refusing to write — ${TREE_SAYS[reading]} (the slot tree at ${treePath})`);
    this.name = "TreeKeyRefusal";
  }
}

const TREE_SAYS: Record<TreeKeyReading, string> = {
  "tree-absent": "no slot tree stands, so no tree key is this vessel's yet; bind the tree before any carrier",
  "tree-unreadable": "the slot tree does not read, so no tree key can prove itself against it",
  "tree-key-mismatch":
    "the tree key in hand is not the tree key the standing tree commits to (a stranger's, or one a rotation retired), and a " +
    "write under it would seal state no slot opens",
};

/** A rotation whose carrier list omits files that bear the tree key seal. Nothing was written. */
export class CensusRefusal extends Error {
  constructor(readonly uncovered: readonly string[]) {
    super(
      `sealed-writer: refusing to rotate — the carrier list omits ${uncovered.length} file(s) sealed under the tree key, ` +
      `which a rotation would strand: ${uncovered.join(", ")}`,
    );
    this.name = "CensusRefusal";
  }
}

/** One standing carrier, and what its bytes read as. */
export interface StandingCarrier { readonly carrier: SealedCarrier; readonly reading: Exclude<SCarrierReading, "absent"> }

/**
 * A founding or a write over a store this custody never sealed: a carrier stands (cleartext, an unframed
 * envelope, or a seal no tree commits to) and no slot tree does. Nothing was written. `standing` names the listed
 * carriers met; `unlisted` the paths that bear the tree key seal's magic yet no listed carrier names.
 */
export class OccupiedStoreRefusal extends Error {
  constructor(readonly standing: readonly StandingCarrier[], readonly unlisted: readonly string[], readonly treePath: string) {
    super(
      `sealed-writer: refusing — no slot tree stands at ${treePath}, yet ${standing.length + unlisted.length} ` +
      `carrier(s) already stand: ${[...standing.map((s) => `${s.carrier.name} (${s.reading})`), ...unlisted].join(", ")}. ` +
      `A founding seals from birth and nothing wraps cleartext in place; found into an empty root`,
    );
    this.name = "OccupiedStoreRefusal";
  }
}

/**
 * THE FOUNDING'S OWN CHECK, AS A READ. Throws `OccupiedStoreRefusal` when any carrier of `carriers` stands while no slot
 * tree stands at `treePath`, or when an unlisted file bears the tree key seal's magic. It reads and lists alone: it takes
 * no custody claim and writes nothing, so a command may ask it before it gathers a human route. The founding runs
 * the same check again under its claim (`commitSlotTree`).
 */
export async function assertStoreUnoccupied(args: {
  readonly io: Pick<CustodyIo, "read" | "list">; readonly treePath: string; readonly carriers: readonly SealedCarrier[];
}): Promise<void> {
  return refuseOccupiedStore(args.io, args.treePath, args.carriers);
}

/** Read the store for occupants. Throws `OccupiedStoreRefusal` when any carrier stands with no tree; writes nothing. */
async function refuseOccupiedStore<C extends SealedCarrier>(io: Pick<CustodyIo, "read" | "list">, treePath: string, carriers: readonly C[], seal: CarrierSeal<C> = S_SEAL as CarrierSeal<C>, scope?: (path: string) => boolean): Promise<void> {
  const standing: StandingCarrier[] = [];
  for (const carrier of carriers) {
    const reading = seal.read(await io.read(carrier.path));
    if (reading !== "absent") standing.push({ carrier, reading });
  }
  const named = new Set(carriers.map((c) => c.path));
  const unlisted: string[] = [];
  for (const path of await io.list()) {
    if (scope && !scope(path)) continue;
    if (path === treePath || isSidecar(path) || named.has(path)) continue;
    const reading = seal.read(await io.read(path));
    if (reading === "sealed" || reading === "torn") unlisted.push(path);
  }
  if (standing.length > 0 || unlisted.length > 0) throw new OccupiedStoreRefusal(standing, unlisted.sort(), treePath);
}

/** Prove `treeKey` against the tree standing at `treePath`. Returns the standing bytes, or throws `TreeKeyRefusal`. */
async function proveAgainstTree(io: CustodyIo, treePath: string, treeKey: TreeKey): Promise<Uint8Array> {
  const bytes = await io.read(treePath);
  const reading = decodeSlotTree(bytes);
  if (reading.reading === "absent") throw new TreeKeyRefusal("tree-absent", treePath);
  if (reading.reading === "unreadable") throw new TreeKeyRefusal("tree-unreadable", treePath);
  if (!treeKeyAnswersCheck(treeKey, reading.tree.keyCheck)) throw new TreeKeyRefusal("tree-key-mismatch", treePath);
  return bytes!;
}

const isSidecar = (path: string): boolean => path.endsWith(SEALING_SUFFIX) || path.endsWith(ROTATING_SUFFIX);

/** Two readings agree: both absent, or both present with equal bytes. */
function sameReading(a: Uint8Array | null, b: Uint8Array | null): boolean {
  return a === null || b === null ? a === b : bytesEqual(a, b);
}

/** Open the carrier under `treeKey`, reading what stands. */
export async function openSealedCarrier(args: { readonly io: CustodyIo; readonly treeKey: TreeKey; readonly carrier: SealedCarrier }): Promise<TreeKeyOpening> {
  return openUnderS(args.treeKey, args.carrier.name, await args.io.read(args.carrier.path));
}

/**
 * Seal `plaintext` as the carrier, and land it only when the tree at `treePath` commits to `treeKey` and the carrier
 * holds nothing or bytes `treeKey` opens.
 */
export async function writeSealedCarrier(args: WriteSealedCarrierArgs): Promise<void> {
  return args.io.exclusive(() => writeHeld(args, S_SEAL));
}

export interface WriteFaceCarrierArgs {
  readonly io: CustodyIo; readonly key: FaceCustodyKey; readonly treePath: string;
  readonly carrier: FaceCarrier; readonly plaintext: Uint8Array; readonly rng?: RandomProvider;
}

/** Seal a D row only after its own face tree proves the key and its standing context opens. */
export async function writeFaceCarrier(args: WriteFaceCarrierArgs): Promise<void> {
  return args.io.exclusive(() => writeHeld({ ...args, treeKey: args.key }, FACE_SEAL, facePathScope(args.treePath)));
}

/** Read a D row with the expected context supplied by the caller. */
export async function openFaceCarrier(args: { readonly io: CustodyIo; readonly key: FaceCustodyKey; readonly carrier: FaceCarrier }): Promise<FckOpening> {
  return openUnderFck(args.key, args.carrier, await args.io.read(args.carrier.path));
}

/** What an update decides: the carrier's next plaintext, or `null` to leave it as it stands; and the caller's answer. */
export interface SealedCarrierUpdate<T> { readonly plaintext: Uint8Array | null; readonly value: T }

/**
 * Read one sealed carrier, decide, and write it, as ONE custody holder. `decide` receives the carrier's standing
 * reading under `treeKey` and answers its next plaintext (`null` writes nothing). A `decide` that throws writes nothing.
 * The write holds both proofs of `writeSealedCarrier`.
 */
export async function updateSealedCarrier<T>(args: Omit<WriteSealedCarrierArgs, "plaintext"> & {
  readonly decide: (standing: TreeKeyOpening) => SealedCarrierUpdate<T> | Promise<SealedCarrierUpdate<T>>;
}): Promise<T> {
  return updateCarrierHeld(args.io, args.treeKey, args.treePath, args.carrier, args.decide, S_SEAL, args.rng);
}

export async function updateFaceCarrier<T>(args: Omit<WriteFaceCarrierArgs, "plaintext"> & {
  readonly decide: (standing: FckOpening) => SealedCarrierUpdate<T> | Promise<SealedCarrierUpdate<T>>;
}): Promise<T> {
  return updateCarrierHeld(args.io, args.key, args.treePath, args.carrier, args.decide, FACE_SEAL, args.rng, facePathScope(args.treePath));
}

async function updateCarrierHeld<C extends SealedCarrier, O extends TreeKeyOpening | FckOpening, T>(
  io: CustodyIo, key: TreeKey, treePath: string, carrier: C,
  decide: (standing: O) => SealedCarrierUpdate<T> | Promise<SealedCarrierUpdate<T>>,
  seal: CarrierSeal<C>, rng?: RandomProvider, scope?: (path: string) => boolean,
): Promise<T> {
  return io.exclusive(async () => {
    if (scope) await proveAgainstTree(io, treePath, key);
    const standing = seal.open(key, carrier, await io.read(carrier.path)) as O;
    const next = await decide(standing);
    if (next.plaintext !== null) await writeHeld({ io, treeKey: key, treePath, carrier, plaintext: next.plaintext,
      ...(rng ? { rng } : {}) }, seal, scope);
    return next.value;
  });
}

/**
 * Remove one sealed carrier, as ONE custody holder. The tree at `treePath` must commit to `treeKey`, and the carrier
 * must hold nothing or bytes `treeKey` opens: a holder removes only what its own key sealed, so bytes another key
 * sealed, torn bytes and bare bytes each refuse `CustodyRefusal` and stay. A stray sidecar of the carrier leaves
 * with it. Answers whether a carrier left. `when`, where given, reads the standing plaintext under the same hold:
 * a carrier it declines stays, and the removal answers false.
 */
export async function removeSealedCarrier(args: Omit<WriteSealedCarrierArgs, "plaintext" | "rng"> & {
  readonly when?: (plaintext: Uint8Array) => boolean;
}): Promise<boolean> {
  return removeCarrierHeld(args.io, args.treeKey, args.treePath, args.carrier, S_SEAL, args.when);
}

export async function removeFaceCarrier(args: Omit<WriteFaceCarrierArgs, "plaintext" | "rng"> & {
  readonly when?: (plaintext: Uint8Array) => boolean;
}): Promise<boolean> {
  return removeCarrierHeld(args.io, args.key, args.treePath, args.carrier, FACE_SEAL, args.when, facePathScope(args.treePath));
}

async function removeCarrierHeld<C extends SealedCarrier>(io: CustodyIo, treeKey: TreeKey, treePath: string, carrier: C,
  seal: CarrierSeal<C>, when?: (plaintext: Uint8Array) => boolean, scope?: (path: string) => boolean): Promise<boolean> {
  if (scope && !scope(carrier.path)) throw new Error("sealed-writer: a face carrier lies outside its tree namespace");
  return io.exclusive(async () => {
    await proveAgainstTree(io, treePath, treeKey);
    const standing = seal.open(treeKey, carrier, await io.read(carrier.path));
    if (standing.reading !== "absent" && standing.reading !== "opens") throw new CustodyRefusal(standing.reading, carrier);
    let wanted = true;
    if (standing.reading === "opens") {
      try { wanted = when ? when(standing.plaintext) : true; } finally { standing.plaintext.fill(0); }
    }
    if (!wanted) return false;
    await io.remove(`${carrier.path}${SEALING_SUFFIX}`);
    if (standing.reading === "absent") return false;
    await io.remove(carrier.path);
    return true;
  });
}

export interface WriteSealedCarrierArgs {
  readonly io:        CustodyIo;
  readonly treeKey:        TreeKey;
  /** The slot tree the tree key proves against. */
  readonly treePath:  string;
  readonly carrier:   SealedCarrier;
  readonly plaintext: Uint8Array;
  readonly rng?:      RandomProvider;
}

async function writeHeld<C extends SealedCarrier>(args: WriteSealedCarrierArgs & { readonly carrier: C }, seal: CarrierSeal<C>, scope?: (path: string) => boolean): Promise<void> {
  const { io, treeKey, carrier } = args;
  if (scope && !scope(carrier.path)) throw new Error("sealed-writer: a face carrier lies outside its tree namespace");
  try {
    await proveAgainstTree(io, args.treePath, treeKey);
  } catch (err) {
    if (err instanceof TreeKeyRefusal && err.reading === "tree-absent") await refuseOccupiedStore(io, args.treePath, [carrier], seal, scope);
    throw err;
  }
  const standing = seal.open(treeKey, carrier, await io.read(carrier.path));
  if (standing.reading !== "absent" && standing.reading !== "opens") throw new CustodyRefusal(standing.reading, carrier);

  const sealed = seal.seal(treeKey, carrier, args.plaintext, args.rng ?? defaultCryptoProvider);
  const side = `${carrier.path}${SEALING_SUFFIX}`;
  await io.write(side, sealed);
  await readBackOrDiscard(io, side, sealed, (back) => {
    const o = seal.open(treeKey, carrier, back);
    return o.reading === "opens" && sameReading(o.plaintext, args.plaintext);
  });
  await io.rename(side, carrier.path);
}

async function readBackOrDiscard(io: CustodyIo, side: string, written: Uint8Array, opens: (back: Uint8Array) => boolean): Promise<void> {
  const back = await io.read(side);
  if (back !== null && sameReading(back, written) && opens(back)) return;
  await io.remove(side);
  throw new Error(`sealed-writer: the sidecar at ${side} did not read back as written; nothing replaced the standing bytes`);
}

/**
 * Write the slot tree. Refuses when the tree standing at `path` moved since the caller read `expected`, when `tree`
 * does not commit to `treeKey`, and when a standing tree commits to another tree key: a bind or unbind keeps the tree key, and only
 * `rotateTreeKey` moves it. Founding (nothing standing) commits the first tree.
 */
export async function commitSlotTree(args: CommitSlotTreeArgs): Promise<void> {
  return args.io.exclusive(() => commitHeld(args, S_SEAL));
}

export interface CommitFaceTreeArgs {
  readonly io: CustodyIo; readonly path: string; readonly expected: Uint8Array | null;
  readonly key: FaceCustodyKey; readonly tree: SlotTree; readonly carriers: readonly FaceCarrier[];
}

/** Bind a face tree only when its key answers its check and no face row stands without it. */
export async function commitFaceTree(args: CommitFaceTreeArgs): Promise<void> {
  return args.io.exclusive(() => commitHeld({ ...args, treeKey: args.key }, FACE_SEAL, facePathScope(args.path)));
}

export async function assertFaceStoreUnoccupied(args: {
  readonly io: Pick<CustodyIo, "read" | "list">; readonly treePath: string; readonly carriers: readonly FaceCarrier[];
}): Promise<void> {
  return refuseOccupiedStore(args.io, args.treePath, args.carriers, FACE_SEAL, facePathScope(args.treePath));
}

export interface CommitSlotTreeArgs {
  readonly io:       CustodyIo;
  readonly path:     string;
  readonly expected: Uint8Array | null;
  /** The tree key the tree wraps: the standing tree's, and the one `tree` commits to. */
  readonly treeKey:       TreeKey;
  readonly tree:     SlotTree;
  /**
   * Every tree-key-sealed carrier the vessel keeps (the carrier table's hot and cold rows). A founding (nothing standing
   * at `path`) refuses with `OccupiedStoreRefusal`, before any write, when any of them already stands or when an
   * unlisted file bears the tree key seal's magic.
   */
  readonly carriers: readonly SealedCarrier[];
}

async function commitHeld<C extends SealedCarrier>(args: CommitSlotTreeArgs & { readonly carriers: readonly C[] }, seal: CarrierSeal<C>, scope?: (path: string) => boolean): Promise<void> {
  const { io, path } = args;
  if (scope && args.carriers.some((c) => !scope(c.path))) throw new Error("sealed-writer: a face carrier lies outside its tree namespace");
  const standing = await io.read(path);
  if (!sameReading(standing, args.expected)) {
    throw new Error(`sealed-writer: the slot tree at ${path} moved since it was read; read it again before binding`);
  }
  if (standing !== null) await proveAgainstTree(io, path, args.treeKey);
  else await refuseOccupiedStore(io, path, args.carriers, seal, scope);
  if (!treeKeyAnswersCheck(args.treeKey, args.tree.keyCheck)) throw new TreeKeyRefusal("tree-key-mismatch", path);
  const bytes = encodeSlotTree(args.tree);
  const reading = decodeSlotTree(bytes);
  if (reading.reading !== "readable") throw new Error(`sealed-writer: refusing to write a slot tree that reads ${reading.reading}`);
  const side = `${path}${SEALING_SUFFIX}`;
  await io.write(side, bytes);
  await readBackOrDiscard(io, side, bytes, (back) => decodeSlotTree(back).reading === "readable");
  await io.rename(side, path);
}

/**
 * Rotate the tree key: re-seal every carrier under `newTreeKey` and bind `slots` over it as the new tree. Before any write it
 * proves `oldTreeKey` against the standing tree, checks that `carriers` covers every file the store holds under the tree key
 * seal's magic, and opens every carrier under `oldTreeKey`; any of these refusing refuses the whole rotation with nothing
 * written. Returns the new tree.
 */
export async function rotateTreeKey(args: RotateTreeKeyArgs): Promise<SlotTree> {
  return args.io.exclusive(() => rotateHeld(args, S_SEAL));
}

export interface RotateFckArgs {
  readonly io: CustodyIo; readonly treePath: string; readonly carriers: readonly FaceCarrier[];
  readonly oldKey: FaceCustodyKey; readonly newKey: FaceCustodyKey;
  readonly slots: readonly SlotSpec[]; readonly kdf: KdfPort; readonly rng?: RandomProvider;
}

/** Re-seal the complete carrier census of one face, then commit that face's new slot tree. */
export async function rotateFck(args: RotateFckArgs): Promise<SlotTree> {
  return args.io.exclusive(() => rotateHeld({ ...args, oldTreeKey: args.oldKey, newTreeKey: args.newKey }, FACE_SEAL, facePathScope(args.treePath)));
}

/** A face tree and its rows occupy one directory subtree so a census cannot claim a sibling's files. */
function facePathScope(treePath: string): (path: string) => boolean {
  const at = treePath.lastIndexOf("/");
  const prefix = treePath.slice(0, at + 1);
  if (prefix.length < 2) throw new Error("sealed-writer: a face tree needs its own directory namespace");
  return (path) => path.startsWith(prefix);
}

export interface RotateTreeKeyArgs {
  readonly io:       CustodyIo;
  readonly treePath: string;
  /** Every tree-key-sealed carrier the vessel keeps: the carrier table's hot and cold rows, never a hand-picked subset. */
  readonly carriers: readonly SealedCarrier[];
  readonly oldTreeKey:    TreeKey;
  readonly newTreeKey:    TreeKey;
  readonly slots:    readonly SlotSpec[];
  /** The port each re-bound passphrase pin derives through. */
  readonly kdf:      KdfPort;
  readonly rng?:     RandomProvider;
}

async function rotateHeld<C extends SealedCarrier>(args: RotateTreeKeyArgs & { readonly carriers: readonly C[] }, seal: CarrierSeal<C>, scope?: (path: string) => boolean): Promise<SlotTree> {
  const { io, treePath } = args;
  if (scope && args.carriers.some((c) => !scope(c.path))) throw new Error("sealed-writer: a face carrier lies outside its tree namespace");
  const rng = args.rng ?? defaultCryptoProvider;
  const treeSide = `${treePath}${ROTATING_SUFFIX}`;
  if (await io.read(treeSide) !== null) {
    throw new Error(`sealed-writer: an unsettled rotation stands at ${treeSide}; settle it before rotating again`);
  }
  await proveAgainstTree(io, treePath, args.oldTreeKey);

  // THE CENSUS: every file bearing the tree key seal's magic stands in the list, or the rotation would strand it.
  const named = new Set(args.carriers.map((c) => c.path));
  const uncovered: string[] = [];
  for (const path of await io.list()) {
    if (scope && !scope(path)) continue;
    if (path === treePath || isSidecar(path) || named.has(path)) continue;
    const reading = seal.read(await io.read(path));
    if (reading === "sealed" || reading === "torn") uncovered.push(path);
  }
  if (uncovered.length > 0) throw new CensusRefusal(uncovered.sort());

  // PRE-VALIDATE: every carrier opens under the old tree key before a single temp exists.
  const opened: { carrier: C; plaintext: Uint8Array }[] = [];
  for (const carrier of args.carriers) {
    const o = seal.open(args.oldTreeKey, carrier, await io.read(carrier.path));
    if (o.reading === "absent") continue;
    if (o.reading !== "opens") throw new CustodyRefusal(o.reading, carrier);
    opened.push({ carrier, plaintext: o.plaintext });
  }
  if (args.slots.length === 0) throw new Error("sealed-writer: a rotation that binds no slot leaves the new tree key with no human route");
  let tree: SlotTree | null = null;
  for (const spec of args.slots) tree = await bindSlot(tree, args.newTreeKey, spec, args.kdf, rng);
  const treeBytes = encodeSlotTree(tree!);

  // WRITE AND CHECK every sidecar; the tree's goes last, as the commit point.
  const sides: string[] = [];
  try {
    for (const { carrier, plaintext } of opened) {
      const side = `${carrier.path}${ROTATING_SUFFIX}`;
      const sealed = seal.seal(args.newTreeKey, carrier, plaintext, rng);
      sides.push(side);
      await io.write(side, sealed);
      await readBackOrDiscard(io, side, sealed, (back) => {
        const o = seal.open(args.newTreeKey, carrier, back);
        return o.reading === "opens" && sameReading(o.plaintext, plaintext);
      });
    }
    sides.push(treeSide);
    await io.write(treeSide, treeBytes);
    await readBackOrDiscard(io, treeSide, treeBytes, (back) => decodeSlotTree(back).reading === "readable");
  } catch (err) {
    for (const side of sides) await io.remove(side).catch(() => undefined);
    throw err;
  }

  // COMMIT: carriers first, the tree last. A fault from here on settles forward.
  for (const { carrier } of opened) await io.rename(`${carrier.path}${ROTATING_SUFFIX}`, carrier.path);
  await io.rename(treeSide, treePath);
  return tree!;
}

/**
 * Finish or discard whatever a fault left behind. The tree's rotating sidecar, readable, means the rotation
 * committed: every carrier sidecar still standing renames into place, then the tree. Anything else means it never
 * committed: every rotating and sealing sidecar goes. Run it before any carrier opens.
 */
export async function settleRotation(args: SettleRotationArgs): Promise<"clean" | "completed" | "discarded"> {
  return args.io.exclusive(() => settleHeld(args));
}

export async function settleFaceRotation(args: {
  readonly io: CustodyIo; readonly treePath: string; readonly carriers: readonly FaceCarrier[];
  readonly onSweep?: (path: string) => void;
}): Promise<"clean" | "completed" | "discarded"> {
  const scope = facePathScope(args.treePath);
  if (args.carriers.some((c) => !scope(c.path))) throw new Error("sealed-writer: a face carrier lies outside its tree namespace");
  return args.io.exclusive(() => settleHeld(args, scope));
}

export interface SettleRotationArgs {
  readonly io:       CustodyIo;
  readonly treePath: string;
  readonly carriers: readonly SealedCarrier[];
  readonly onSweep?: (path: string) => void;
}

async function settleHeld(args: SettleRotationArgs, scope?: (path: string) => boolean): Promise<"clean" | "completed" | "discarded"> {
  const { io, treePath } = args;
  const treeSide = `${treePath}${ROTATING_SUFFIX}`;
  const treeSideBytes = await io.read(treeSide);
  let strays = false;
  for (const path of [treePath, ...args.carriers.map((c) => c.path)]) {
    if (await io.read(`${path}${SEALING_SUFFIX}`) !== null) { await io.remove(`${path}${SEALING_SUFFIX}`); strays = true; }
  }
  if (treeSideBytes !== null && decodeSlotTree(treeSideBytes).reading === "readable") {
    for (const c of args.carriers) {
      const side = `${c.path}${ROTATING_SUFFIX}`;
      if (await io.read(side) !== null) await io.rename(side, c.path);
    }
    await io.rename(treeSide, treePath);
    for (const path of await io.list()) {
      if ((!scope || scope(path)) && path.endsWith(SEALING_SUFFIX)) { await io.remove(path); args.onSweep?.(path); }
    }
    return "completed";
  }
  if (treeSideBytes !== null) { await io.remove(treeSide); strays = true; }
  for (const c of args.carriers) {
    const side = `${c.path}${ROTATING_SUFFIX}`;
    if (await io.read(side) !== null) { await io.remove(side); strays = true; }
  }
  for (const path of await io.list()) {
    if (scope && !scope(path)) continue;
    if (path.endsWith(ROTATING_SUFFIX) && path !== treeSide) { await io.remove(path); strays = true; args.onSweep?.(path); }
    if (path.endsWith(SEALING_SUFFIX)) { await io.remove(path); strays = true; args.onSweep?.(path); }
  }
  return strays ? "discarded" : "clean";
}
