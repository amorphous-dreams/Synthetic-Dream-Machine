/**
 * custody-session — THE CUSTODY SESSION: the acts that found, open, change and read the vessel's key custody.
 *
 * One vessel key (S key) rests inside the keyslot tree (`s-slots.bin`); the custody root rests sealed under that S key.
 * This module composes the mesh's sealed writer and the carrier table into the six acts a founding and the
 * `vault` door share, and holds no state of its own: every act takes the port (`CustodyIo`) and the homes.
 *
 * ── A FOUNDING SEALS FROM BIRTH ─────────────────────────────────────────────────────────────────
 * `foundCustody` mints the S key, binds every slot, commits the tree through `commitSlotTree` (so a store that already
 * holds a carrier refuses `OccupiedStoreRefusal` before a byte lands), then mints the serving key (SK) and writes the
 * serving tree that wraps it under its own slots (`sk-slots.bin`), then mints the custody root and seals it. It
 * refuses a founding with no slot: an S key with no human route is a vessel nobody can open. The slot specs bind a
 * passphrase or paper route; the tree refuses a spec with neither.
 *
 * ── AN UNLOCK NEVER THROWS ON A CREDENTIAL ──────────────────────────────────────────────────────
 * `unlockCustody` settles a rotation a fault left behind (independent of any credential), reads the tree, and
 * opens the S key, then SK through the serving tree's own slots (ember#/the-serving-key). A wrong credential reads
 * `no-slot-opens`; an absent or torn tree reads by name; a route the serving tree does not take leaves `sk` null
 * while the S key stands open. Nothing is written on a reading other than the settle.
 *
 * ── AN UNBIND THAT ROTATES RUNS AS ONE ACT ──────────────────────────────────────────────────────
 * `unbindCustodySlot` with `rotate` hands the staying slots to the S key rotation and writes no tree of its own: the
 * rotation's census and its opening of every carrier run before any byte moves, so a carrier that refuses the
 * rotation leaves the slot bound, and the one commit lands a tree that holds the staying slots under the new S key.
 *
 * ── STATUS OPENS NOTHING, AND READS EACH FILE ONCE ──────────────────────────────────────────────
 * `custodyStatus` takes no key. It reports the tree's slots, ONE reading for every file the table names as
 * standing, and every private file the table does not name. A row outside the vessel key carries the law it rests
 * bare under; a hot or cold row that reads anything but `sealed` reads as a fault.
 */

import { mkdirSync } from "node:fs";
import {
  assertStoreUnoccupied, bindSlot, commitSlotTree, decodeSlotTree, mintServingKey, mintTreeKey,
  openTreeKey, readFckCarrier, readSCarrier, settleRotation, unbindSlot,
  type Credential, type CustodyIo, type ServingKey, type SlotSpec, type SlotTree, type TreeKey, type SCarrierReading,
} from "@lararium/mesh";
import { nativeKdf } from "@lararium/mesh/node";
import { mintCustodyRoot, sealCustodyRoot, type CustodyRoot } from "./custody-root.js";
import {
  carrierCensus, carrierTable, outsideTheTable, rotateNodeKey, skSlotsPath, sSealedCarriers, occupantCarriers, sSlotsPath,
  type CarrierEntry, type CustodyHomes, type OutsideFile,
} from "./vault-carriers.js";

/** The refusal of a founding that names no human route. */
export class CustodyFoundingRefused extends Error {
  override readonly name = "CustodyFoundingRefused";
  constructor(detail: string) {
    super(`[custody-session] ${detail}`);
  }
}

/** Refuse, by name, a founding with no slot to bind. Writes nothing; `runInit` calls it before its first mutation. */
export function assertFoundingRoute(slots: readonly SlotSpec[]): void {
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new CustodyFoundingRefused(
      "a founding seals custody from birth and needs a human route (a passphrase or a paper pin) to bind; none was given",
    );
  }
}

/** The tree standing at the identity home: its bytes (for the optimistic write) and its reading. */
async function readTree(io: CustodyIo, homes: CustodyHomes) {
  const bytes = await io.read(sSlotsPath(homes.identity));
  return { bytes, reading: decodeSlotTree(bytes) };
}

async function readableTree(io: CustodyIo, homes: CustodyHomes): Promise<{ bytes: Uint8Array; tree: SlotTree }> {
  const { bytes, reading } = await readTree(io, homes);
  if (reading.reading === "absent") throw new CustodyFoundingRefused(`no slot tree stands at ${sSlotsPath(homes.identity)}`);
  if (reading.reading === "unreadable") throw new CustodyFoundingRefused(`the slot tree reads unreadable: ${reading.why}`);
  return { bytes: bytes!, tree: reading.tree };
}

/** Whether a slot tree stands at the identity home (any reading but absent). */
export async function custodyTreeStands(io: CustodyIo, homes: CustodyHomes): Promise<boolean> {
  return (await io.read(sSlotsPath(homes.identity))) !== null;
}

/**
 * Found the custody: mint the S key, bind every slot, commit the tree, mint SK and write the serving tree that wraps it
 * under the S key's entry, then mint and seal the custody root. Refuses an empty `slots`, and (via `commitSlotTree`) a
 * store that already holds a carrier with no tree. SK mints here and nowhere else: a restored vessel mints its own
 * at its own founding (ember#/meets).
 */
export async function foundCustody(args: {
  readonly io:    CustodyIo;
  readonly homes: CustodyHomes;
  readonly slots: readonly SlotSpec[];
}): Promise<{ treeKey: TreeKey; tree: SlotTree; sk: ServingKey; root: CustodyRoot }> {
  assertFoundingRoute(args.slots);
  const { io, homes } = args;
  mkdirSync(homes.identity, { recursive: true, mode: 0o700 });
  const treeKey = mintTreeKey();
  let tree: SlotTree | null = null;
  for (const spec of args.slots) tree = await bindSlot(tree, treeKey, spec, nativeKdf);
  const path = sSlotsPath(homes.identity);
  const sk = mintServingKey();
  // THE SERVING TREE STANDS ON ITS OWN. SK wraps under its own slots, bound over the same founding route but with their own
  // wrapped key, salt and slot ids, so the S key wraps nothing of it (ember#/the-serving-key): a second device lifts a resting
  // hearth to SERVING without the route the S key needs.
  let skTree: SlotTree | null = null;
  for (const spec of args.slots) skTree = await bindSlot(skTree, sk as unknown as TreeKey, spec, nativeKdf);
  // ONE CLAIM. The store's shape gets read before any write, so an occupied store refuses with nothing written; the
  // serving tree then lands, and the node tree commits last. A fault between the two leaves a serving tree beside no node
  // tree, which the next founding replaces whole.
  await io.exclusive(async () => {
    const held = heldIo(io);
    const carriers = sSealedCarriers(homes);
    // A slot tree already standing names an S key whose serving tree this founding must never replace.
    if ((await held.read(path)) !== null) {
      throw new CustodyFoundingRefused(`a slot tree already stands at ${path}; a founding seals custody once, and nothing was written`);
    }
    await assertStoreUnoccupied({ io: held, treePath: path, carriers: occupantCarriers(homes) });
    // A serving tree beside no node tree stands from a founding a fault cut short; this founding replaces it whole.
    await held.remove(skSlotsPath(homes.identity));
    await commitSlotTree({ io: held, path: skSlotsPath(homes.identity), expected: null, treeKey: sk as unknown as TreeKey, tree: skTree!, carriers: [] });
    await commitSlotTree({ io: held, path, expected: null, treeKey, tree: tree!, carriers });
  });
  const root = mintCustodyRoot();
  await sealCustodyRoot({ io, treeKey, treePath: path, root, identityDir: homes.identity });
  return { treeKey, tree: tree!, sk, root };
}

/**
 * The port inside a claim this act already holds: every read and write passes through, and `exclusive` runs its act
 * at once, since the claim is not reentrant. A multi-write act (a founding, a rotation, a serving tree's settle)
 * holds ONE claim for its whole span, so no other holder's act lands between its writes.
 */
function heldIo(io: CustodyIo): CustodyIo {
  return {
    read:   (p) => io.read(p),
    write:  (p, b) => io.write(p, b),
    rename: (f, t) => io.rename(f, t),
    remove: (p) => io.remove(p),
    list:   () => io.list(),
    exclusive: (fn) => fn(),
  };
}

/** What the serving tree reads when the presented credentials open no SK. */
export type ServingUnopenable = "serving-tree-absent" | "serving-tree-unreadable" | "no-slot-opens";

/** Two readings of one file hold the same bytes, absence included. */

/**
 * Open SK through the serving tree's own slots with the presented credentials. The tree stands apart from the node tree: a
 * route the node tree takes may not be one the serving tree takes, and then SK stays shut while the node key opens.
 */
export async function openServingTree(args: {
  readonly io:          CustodyIo;
  readonly homes:       CustodyHomes;
  readonly credentials: readonly Credential[];
}): Promise<{ readonly reading: "opens"; readonly sk: ServingKey } | { readonly reading: ServingUnopenable; readonly why: string }> {
  const path = skSlotsPath(args.homes.identity);
  const t = decodeSlotTree(await args.io.read(path));
  if (t.reading === "absent") return { reading: "serving-tree-absent", why: `no serving tree stands at ${path}` };
  if (t.reading === "unreadable") return { reading: "serving-tree-unreadable", why: t.why };
  const o = await openTreeKey(t.tree, args.credentials, nativeKdf);
  if (o.reading !== "opens") return { reading: "no-slot-opens", why: "no slot of the serving tree opens under what was presented" };
  return { reading: "opens", sk: o.treeKey as unknown as ServingKey };
}

export type CustodyUnlock =
  | { readonly reading: "opens"; readonly treeKey: TreeKey; readonly sk: ServingKey | null; readonly slot: string }
  | { readonly reading: "no-slot-opens"; readonly notes: readonly string[] }
  | { readonly reading: "tree-absent" }
  | { readonly reading: "tree-unreadable"; readonly why: string };

/** What a route opens at the slot tree alone: the node key, or the reading that names why not. */
export type CustodyNodeKeyOpening = Exclude<CustodyUnlock, { reading: "opens" }>
  | { readonly reading: "opens"; readonly treeKey: TreeKey; readonly slot: string };

/**
 * Open the node key (S) alone with the presented credentials, settling a left-behind rotation first; never throws on a
 * credential. A proof that a person holds a route of this vessel reads here (`CustodyHolder.proves`): it asks which
 * key the route opens, and opens nothing beyond it.
 */
export async function openCustodyNodeKey(args: {
  readonly io:          CustodyIo;
  readonly homes:       CustodyHomes;
  readonly credentials: readonly Credential[];
}): Promise<CustodyNodeKeyOpening> {
  const { io, homes } = args;
  await settleRotation({ io, treePath: sSlotsPath(homes.identity), carriers: sSealedCarriers(homes) });
  const { reading } = await readTree(io, homes);
  if (reading.reading === "absent") return { reading: "tree-absent" };
  if (reading.reading === "unreadable") return { reading: "tree-unreadable", why: reading.why };
  const o = await openTreeKey(reading.tree, args.credentials, nativeKdf);
  if (o.reading !== "opens") return { reading: "no-slot-opens", notes: o.notes };
  return { reading: "opens", treeKey: o.treeKey, slot: o.slot };
}

/** Open the node key with the presented credentials, then the serving key if the same route fits its tree. Never throws on a credential. */
export async function unlockCustody(args: {
  readonly io:          CustodyIo;
  readonly homes:       CustodyHomes;
  readonly credentials: readonly Credential[];
}): Promise<CustodyUnlock> {
  const { io, homes } = args;
  const o = await openCustodyNodeKey(args);
  if (o.reading !== "opens") return o;
  const s = await openServingTree({ io, homes, credentials: args.credentials });
  return { reading: "opens", treeKey: o.treeKey, sk: s.reading === "opens" ? s.sk : null, slot: o.slot };
}

/** Bind one more slot over the standing tree's own S key. Returns the new tree and the new slot's id. */
export async function bindCustodySlot(args: {
  readonly io:    CustodyIo;
  readonly homes: CustodyHomes;
  readonly treeKey:    TreeKey;
  readonly spec:  SlotSpec;
}): Promise<{ tree: SlotTree; slotId: string }> {
  const { bytes, tree } = await readableTree(args.io, args.homes);
  const next = await bindSlot(tree, args.treeKey, args.spec, nativeKdf);
  await commitSlotTree({
    io: args.io, path: sSlotsPath(args.homes.identity), expected: bytes, treeKey: args.treeKey, tree: next,
    carriers: sSealedCarriers(args.homes),
  });
  return { tree: next, slotId: next.slots[next.slots.length - 1]!.id };
}

/** The refusal of an unbind whose rotation names another set of slots than the ones that stay. Nothing was written. */
export class RotationSlotsRefused extends Error {
  override readonly name = "RotationSlotsRefused";
  constructor(detail: string) { super(`[custody-session] ${detail}`); }
}

/**
 * Remove one slot (never the last). With `rotate`, the removal and the rotation run as ONE act: `rotate` carries
 * the spec of every slot that stays, the rotation re-seals every carrier under a new S key and binds exactly those
 * slots over it, and no tree lands before the rotation's own census and openings pass. Returns the tree that
 * stands, the rotation offer, whether the S key moved, and the S key that seals the carriers now.
 */
export async function unbindCustodySlot(args: {
  readonly io:      CustodyIo;
  readonly homes:   CustodyHomes;
  readonly treeKey:      TreeKey;
  readonly slotId:  string;
  readonly rotate?: readonly SlotSpec[];
}): Promise<{ tree: SlotTree; rotationOffer: string; rotated: boolean; treeKey: TreeKey }> {
  const { bytes, tree } = await readableTree(args.io, args.homes);
  const out = unbindSlot(tree, args.slotId);
  if (args.rotate === undefined) {
    await commitSlotTree({
      io: args.io, path: sSlotsPath(args.homes.identity), expected: bytes, treeKey: args.treeKey, tree: out.tree,
      carriers: sSealedCarriers(args.homes),
    });
    return { ...out, rotated: false, treeKey: args.treeKey };
  }
  if (args.rotate.length !== out.tree.slots.length) {
    throw new RotationSlotsRefused(
      `${out.tree.slots.length} slot(s) stay once slot ${args.slotId} leaves, and the rotation names ${args.rotate.length}: ` +
      "a rotation binds every staying slot over the new vessel key, so each one's route gets read again; nothing was changed",
    );
  }
  const r = await rotateCustody({ io: args.io, homes: args.homes, oldTreeKey: args.treeKey, slots: args.rotate });
  return { tree: r.tree, rotationOffer: out.rotationOffer, rotated: true, treeKey: r.treeKey };
}

/**
 * Mint a new node key and re-seal every carrier under it, binding `slots` over it. Returns the new key and tree. The serving
 * tree stands apart (its own slots, wrapped by no other key), so a rotation of the node key moves no byte of it.
 */
export async function rotateCustody(args: {
  readonly io:    CustodyIo;
  readonly homes: CustodyHomes;
  readonly oldTreeKey: TreeKey;
  readonly slots: readonly SlotSpec[];
}): Promise<{ treeKey: TreeKey; tree: SlotTree }> {
  return args.io.exclusive(async () => {
    const io = heldIo(args.io);
    const treeKey = mintTreeKey();
    const tree = await rotateNodeKey({ io, homes: args.homes, oldTreeKey: args.oldTreeKey, newTreeKey: treeKey, slots: args.slots });
    return { treeKey, tree };
  });
}

/** The one reading of one standing file. */
export interface CustodyStatusRow {
  readonly row:      string;
  /** The census name of this file: the row's own, or the row's spelling of one face's or one hearth's file. */
  readonly name:     string;
  readonly home:     CarrierEntry["home"];
  readonly file:     string;
  readonly custody:  CarrierEntry["custody"];
  readonly keyClass: CarrierEntry["keyClass"];
  readonly reading:  SCarrierReading;
  /** The law this row rests outside the vessel key under; null on a serving, hot, cold or outbox row. */
  readonly bare:     string | null;
  /**
   * True where the file breaks its own row's law: a serving, hot or cold row that reads anything but `sealed`; an
   * outbox row whose bytes fail its own check (a name its bytes fail, bytes that frame as no outbox seal); a floor
   * or floor-plain row under the vessel key's seal, which no rotation re-seals; a file that fails the name its row
   * derives from its bytes.
   */
  readonly fault:    boolean;
}

export interface CustodyStatus {
  readonly tree:
    | { readonly reading: "absent" }
    | { readonly reading: "unreadable"; readonly why: string }
    | { readonly reading: "readable"; readonly slots: readonly { readonly id: string; readonly t: number; readonly pins: readonly string[] }[] };
  readonly rows: readonly CustodyStatusRow[];
  /** Every private file in the homes that no row of the table names (`outsideTheTable`). */
  readonly outside: readonly OutsideFile[];
}

/**
 * What stands: the tree's slots (ids and pin kinds), one reading for every standing file the table names, and
 * every private file it does not name. Opens nothing, takes no key.
 */
export async function custodyStatus(args: { readonly io: CustodyIo; readonly homes: CustodyHomes }): Promise<CustodyStatus> {
  const { reading } = await readTree(args.io, args.homes);
  const tree: CustodyStatus["tree"] = reading.reading === "readable"
    ? { reading: "readable", slots: reading.tree.slots.map((s) => ({ id: s.id, t: s.t, pins: s.pins.map((p) => p.kind) })) }
    : reading;
  const rows: CustodyStatusRow[] = [];
  // THE SEALED STORE'S SHELVES HOLD OPAQUE BYTES: a note, a chunk, a rest or a parcel may open with any byte, so a
  // seal reading proves nothing there, and such a row reads its law off its own check (`holds`) alone.
  const opaque = new Set(carrierTable().filter((r) => r.writer === "sealed-store-fs").map((r) => r.row));
  for (const e of carrierCensus(args.homes)) {
    const bytes = await args.io.read(e.path);
    const faceRow = e.custody === "face-hot" || e.custody === "face-cold";
    const reading = faceRow ? readFckCarrier(bytes) : readSCarrier(bytes);
    const underKey = e.custody === "serving" || e.custody === "hot" || e.custody === "cold" || faceRow;
    // An outbox parcel rests under the outbox key's own seal, never the vessel key's: its row's check reads that seal.
    const failsHolds = e.holds !== null && bytes !== null && !e.holds(e.file, bytes);
    const fault = underKey
      ? reading !== "sealed"
      : e.custody === "outbox"
        ? bytes === null || failsHolds
        : (!opaque.has(e.row) && reading !== "bare" && reading !== "absent") || failsHolds;
    rows.push({ row: e.row, name: e.name, home: e.home, file: e.file, custody: e.custody, keyClass: e.keyClass, reading, bare: e.bare, fault });
  }
  return { tree, rows, outside: outsideTheTable(args.homes) };
}
