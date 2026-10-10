/**
 * sealed-writer — THE one writer of VK-sealed carriers and of the slot tree that holds the VK.
 *
 * TWO PROOFS GOVERN EVERY WRITE, both before any byte moves.
 *
 *  1. THE VK IN HAND IS THE TREE'S. The slot tree standing at `treePath` carries the keyed check of its VK
 *     (`keyslot.ts`), and every writer — a carrier write, a tree commit, a rotation — proves the VK in hand against
 *     it. A mismatch refuses as `TreeVkRefusal` (`vk-mismatch`); no tree standing, or a torn one, refuses too
 *     (`tree-absent`, `tree-unreadable`), since then no VK is the vessel's. So a stranger VK founds no carrier, and
 *     a process still holding a VK a rotation retired writes nothing, an absent carrier included.
 *  2. THE KEY OPENS WHAT STANDS. A carrier accepts a write only when nothing stands there, or when the VK opens the
 *     sealed bytes; every other reading refuses with its own name (`vk-envelope.ts`): `key-fails`, `torn`,
 *     `unopenable`, `old-shape`, `bare`.
 *
 * A wrong passphrase opens no VK, so it reaches no write at all; a VK the tree does not commit to replaces nothing.
 *
 * ONE HOLDER FROM CHECK TO RENAME. Every writer and the rotation run inside `io.exclusive`, so no write checks
 * against a tree a rotation then replaces before its rename lands.
 *
 * THE SHAPE OF A WRITE: seal → write a SIDECAR → read it back → compare the bytes and open them → rename over the
 * carrier. It never seals in place, and a sidecar that does not read back as written never lands.
 *
 * A VK ROTATION opens EVERY carrier under the old VK before it writes a single temp: the failure that matters (a
 * carrier the old VK does not open) costs nothing, because it surfaces while nothing has moved. Its carrier list
 * comes from the one carrier table (the node's `vault-carriers`), and the rotation checks that list against the
 * store: a file bearing the VK seal's magic that the list omits refuses the whole rotation (`CensusRefusal`), so a
 * partial list strands nothing. It then binds the new tree, writes and checks every carrier sidecar, writes the
 * tree's sidecar LAST, and renames carriers before the tree. The tree's sidecar is the commit point: when it stands, every carrier sidecar beside it was written and
 * read back, so `settleRotation` finishes the renames; when it does not, the rotation never committed and the
 * carrier sidecars go. The unlock settles before it opens anything.
 *
 * THE GUARD PROVES THE KEY, NEVER THE CONTENT. An opening VK still admits an empty state over a full one; the boot
 * hydrates from what it opens before anything writes back, and those two facts stay two.
 *
 * Platform-blind: the store arrives as a `CustodyIo` port (node `fs`, browser IndexedDB), and nothing here imports
 * `node:`.
 */

import { defaultCryptoProvider, type RandomProvider } from "./crypto.js";
import { bindSlot, encodeSlotTree, decodeSlotTree, type SlotSpec, type SlotTree } from "./keyslot.js";
import { sealUnderVk, openUnderVk, vkAnswersCheck, type VesselKey, type VkOpening } from "./vk.js";
import { readVkCarrier } from "./vk-envelope.js";

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

/** One sealed carrier: the name its AEAD binds, and the path it rests at. */
export interface SealedCarrier { readonly name: string; readonly path: string }

/** The sidecar of a single write. A stray one never committed; settling removes it. */
export const SEALING_SUFFIX = ".vk-sealing";
/** The sidecar of a VK rotation. The tree's rotating sidecar marks the rotation committed. */
export const ROTATING_SUFFIX = ".vk-rotating";

type RefusedReading = Exclude<VkOpening["reading"], "opens" | "absent">;

/** A write or rotation the standing bytes refuse. `reading` names the fact met; nothing was written. */
export class CustodyRefusal extends Error {
  constructor(readonly reading: RefusedReading, readonly carrier: SealedCarrier) {
    super(`sealed-writer: refusing to write over the carrier "${carrier.name}" at ${carrier.path} — ${SAYS[reading]}`);
    this.name = "CustodyRefusal";
  }
}

const SAYS: Record<RefusedReading, string> = {
  "key-fails":
    "the VK in hand does not open the bytes standing there, so this write would replace sealed state under a key " +
    "that never sealed it",
  torn:
    "the carrier is torn (the house magic over a frame too short to hold a nonce and a tag), so no credential is at " +
    "fault here; recover it from a backup rather than re-typing anything",
  unopenable:
    "it carries a seal this build cannot frame (a damaged magic, or another scheme of the house family), and a write " +
    "would destroy ciphertext that a repair could still recover; copy the carrier aside first",
  "old-shape":
    "it carries the LARK envelope of the retired passphrase custody, which no unlock opens; the fresh-start runbook " +
    "(stable-founding-road #/fresh-start) answers it",
  bare:
    "cleartext stands there, and this writer replaces only bytes the VK sealed",
};

/** Why the standing tree refuses the VK in hand. */
export type TreeVkReading = "tree-absent" | "tree-unreadable" | "vk-mismatch";

/** A writer whose VK the standing slot tree does not commit to. Nothing was written. */
export class TreeVkRefusal extends Error {
  constructor(readonly reading: TreeVkReading, readonly treePath: string) {
    super(`sealed-writer: refusing to write — ${TREE_SAYS[reading]} (the slot tree at ${treePath})`);
    this.name = "TreeVkRefusal";
  }
}

const TREE_SAYS: Record<TreeVkReading, string> = {
  "tree-absent": "no slot tree stands, so no VK is this vessel's yet; bind the tree before any carrier",
  "tree-unreadable": "the slot tree does not read, so no VK can prove itself against it",
  "vk-mismatch":
    "the VK in hand is not the VK the standing tree commits to (a stranger's, or one a rotation retired), and a " +
    "write under it would seal state no slot opens",
};

/** A rotation whose carrier list omits files that bear the VK seal. Nothing was written. */
export class CensusRefusal extends Error {
  constructor(readonly uncovered: readonly string[]) {
    super(
      `sealed-writer: refusing to rotate — the carrier list omits ${uncovered.length} file(s) sealed under the VK, ` +
      `which a rotation would strand: ${uncovered.join(", ")}`,
    );
    this.name = "CensusRefusal";
  }
}

/** Prove `vk` against the tree standing at `treePath`. Returns the standing bytes, or throws `TreeVkRefusal`. */
async function proveAgainstTree(io: CustodyIo, treePath: string, vk: VesselKey): Promise<Uint8Array> {
  const bytes = await io.read(treePath);
  const reading = decodeSlotTree(bytes);
  if (reading.reading === "absent") throw new TreeVkRefusal("tree-absent", treePath);
  if (reading.reading === "unreadable") throw new TreeVkRefusal("tree-unreadable", treePath);
  if (!vkAnswersCheck(vk, reading.tree.vkCheck)) throw new TreeVkRefusal("vk-mismatch", treePath);
  return bytes!;
}

const isSidecar = (path: string): boolean => path.endsWith(SEALING_SUFFIX) || path.endsWith(ROTATING_SUFFIX);

function bytesEqual(a: Uint8Array | null, b: Uint8Array | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Open the carrier under `vk`, reading what stands. */
export async function openSealedCarrier(args: { readonly io: CustodyIo; readonly vk: VesselKey; readonly carrier: SealedCarrier }): Promise<VkOpening> {
  return openUnderVk(args.vk, args.carrier.name, await args.io.read(args.carrier.path));
}

/**
 * Seal `plaintext` as the carrier, and land it only when the tree at `treePath` commits to `vk` and the carrier
 * holds nothing or bytes `vk` opens.
 */
export async function writeSealedCarrier(args: WriteSealedCarrierArgs): Promise<void> {
  return args.io.exclusive(() => writeHeld(args));
}

export interface WriteSealedCarrierArgs {
  readonly io:        CustodyIo;
  readonly vk:        VesselKey;
  /** The slot tree the VK proves against. */
  readonly treePath:  string;
  readonly carrier:   SealedCarrier;
  readonly plaintext: Uint8Array;
  readonly rng?:      RandomProvider;
}

async function writeHeld(args: WriteSealedCarrierArgs): Promise<void> {
  const { io, vk, carrier } = args;
  await proveAgainstTree(io, args.treePath, vk);
  const standing = openUnderVk(vk, carrier.name, await io.read(carrier.path));
  if (standing.reading !== "absent" && standing.reading !== "opens") throw new CustodyRefusal(standing.reading, carrier);

  const sealed = sealUnderVk(vk, carrier.name, args.plaintext, args.rng ?? defaultCryptoProvider);
  const side = `${carrier.path}${SEALING_SUFFIX}`;
  await io.write(side, sealed);
  await readBackOrDiscard(io, side, sealed, (back) => {
    const o = openUnderVk(vk, carrier.name, back);
    return o.reading === "opens" && bytesEqual(o.plaintext, args.plaintext);
  });
  await io.rename(side, carrier.path);
}

async function readBackOrDiscard(io: CustodyIo, side: string, written: Uint8Array, opens: (back: Uint8Array) => boolean): Promise<void> {
  const back = await io.read(side);
  if (back !== null && bytesEqual(back, written) && opens(back)) return;
  await io.remove(side);
  throw new Error(`sealed-writer: the sidecar at ${side} did not read back as written; nothing replaced the standing bytes`);
}

/**
 * Write the slot tree. Refuses when the tree standing at `path` moved since the caller read `expected`, when `tree`
 * does not commit to `vk`, and when a standing tree commits to another VK: a bind or unbind keeps the VK, and only
 * `rotateVk` moves it. Founding (nothing standing) commits the first tree.
 */
export async function commitSlotTree(args: CommitSlotTreeArgs): Promise<void> {
  return args.io.exclusive(() => commitHeld(args));
}

export interface CommitSlotTreeArgs {
  readonly io:       CustodyIo;
  readonly path:     string;
  readonly expected: Uint8Array | null;
  /** The VK the tree wraps: the standing tree's, and the one `tree` commits to. */
  readonly vk:       VesselKey;
  readonly tree:     SlotTree;
}

async function commitHeld(args: CommitSlotTreeArgs): Promise<void> {
  const { io, path } = args;
  const standing = await io.read(path);
  if (!bytesEqual(standing, args.expected)) {
    throw new Error(`sealed-writer: the slot tree at ${path} moved since it was read; read it again before binding`);
  }
  if (standing !== null) await proveAgainstTree(io, path, args.vk);
  if (!vkAnswersCheck(args.vk, args.tree.vkCheck)) throw new TreeVkRefusal("vk-mismatch", path);
  const bytes = encodeSlotTree(args.tree);
  const reading = decodeSlotTree(bytes);
  if (reading.reading !== "readable") throw new Error(`sealed-writer: refusing to write a slot tree that reads ${reading.reading}`);
  const side = `${path}${SEALING_SUFFIX}`;
  await io.write(side, bytes);
  await readBackOrDiscard(io, side, bytes, (back) => decodeSlotTree(back).reading === "readable");
  await io.rename(side, path);
}

/**
 * Rotate the VK: re-seal every carrier under `newVk` and bind `slots` over it as the new tree. Before any write it
 * proves `oldVk` against the standing tree, checks that `carriers` covers every file the store holds under the VK
 * seal's magic, and opens every carrier under `oldVk`; any of these refusing refuses the whole rotation with nothing
 * written. Returns the new tree.
 */
export async function rotateVk(args: RotateVkArgs): Promise<SlotTree> {
  return args.io.exclusive(() => rotateHeld(args));
}

export interface RotateVkArgs {
  readonly io:       CustodyIo;
  readonly treePath: string;
  /** Every VK-sealed carrier the vessel keeps: the carrier table's hot and cold rows, never a hand-picked subset. */
  readonly carriers: readonly SealedCarrier[];
  readonly oldVk:    VesselKey;
  readonly newVk:    VesselKey;
  readonly slots:    readonly SlotSpec[];
  readonly rng?:     RandomProvider;
}

async function rotateHeld(args: RotateVkArgs): Promise<SlotTree> {
  const { io, treePath } = args;
  const rng = args.rng ?? defaultCryptoProvider;
  const treeSide = `${treePath}${ROTATING_SUFFIX}`;
  if (await io.read(treeSide) !== null) {
    throw new Error(`sealed-writer: an unsettled rotation stands at ${treeSide}; settle it before rotating again`);
  }
  await proveAgainstTree(io, treePath, args.oldVk);

  // THE CENSUS: every file bearing the VK seal's magic stands in the list, or the rotation would strand it.
  const named = new Set(args.carriers.map((c) => c.path));
  const uncovered: string[] = [];
  for (const path of await io.list()) {
    if (path === treePath || isSidecar(path) || named.has(path)) continue;
    const reading = readVkCarrier(await io.read(path));
    if (reading === "sealed" || reading === "torn") uncovered.push(path);
  }
  if (uncovered.length > 0) throw new CensusRefusal(uncovered.sort());

  // PRE-VALIDATE: every carrier opens under the old VK before a single temp exists.
  const opened: { carrier: SealedCarrier; plaintext: Uint8Array }[] = [];
  for (const carrier of args.carriers) {
    const o = openUnderVk(args.oldVk, carrier.name, await io.read(carrier.path));
    if (o.reading === "absent") continue;
    if (o.reading !== "opens") throw new CustodyRefusal(o.reading, carrier);
    opened.push({ carrier, plaintext: o.plaintext });
  }
  if (args.slots.length === 0) throw new Error("sealed-writer: a rotation that binds no slot leaves the new VK with no human route");
  let tree: SlotTree | null = null;
  for (const spec of args.slots) tree = bindSlot(tree, args.newVk, spec, rng);
  const treeBytes = encodeSlotTree(tree!);

  // WRITE AND CHECK every sidecar; the tree's goes last, as the commit point.
  const sides: string[] = [];
  try {
    for (const { carrier, plaintext } of opened) {
      const side = `${carrier.path}${ROTATING_SUFFIX}`;
      const sealed = sealUnderVk(args.newVk, carrier.name, plaintext, rng);
      sides.push(side);
      await io.write(side, sealed);
      await readBackOrDiscard(io, side, sealed, (back) => {
        const o = openUnderVk(args.newVk, carrier.name, back);
        return o.reading === "opens" && bytesEqual(o.plaintext, plaintext);
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

export interface SettleRotationArgs {
  readonly io:       CustodyIo;
  readonly treePath: string;
  readonly carriers: readonly SealedCarrier[];
}

async function settleHeld(args: SettleRotationArgs): Promise<"clean" | "completed" | "discarded"> {
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
    return "completed";
  }
  if (treeSideBytes !== null) { await io.remove(treeSide); strays = true; }
  for (const c of args.carriers) {
    const side = `${c.path}${ROTATING_SUFFIX}`;
    if (await io.read(side) !== null) { await io.remove(side); strays = true; }
  }
  return strays ? "discarded" : "clean";
}
