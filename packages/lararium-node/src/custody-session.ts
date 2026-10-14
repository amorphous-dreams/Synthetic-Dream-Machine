/**
 * custody-session — THE CUSTODY SESSION: the acts that found, open, change and read the vessel's key custody.
 *
 * One vessel key (VK) rests inside the keyslot tree (`vk-slots.bin`); the custody root rests sealed under that VK.
 * This module composes the mesh's sealed writer and the carrier table into the six acts a founding and the
 * `vault` door share, and holds no state of its own: every act takes the port (`CustodyIo`) and the homes.
 *
 * ── A FOUNDING SEALS FROM BIRTH ─────────────────────────────────────────────────────────────────
 * `foundCustody` mints the VK, binds every slot, commits the tree through `commitSlotTree` (so a store that already
 * holds a carrier refuses `OldShapeRefusal` before a byte lands), then mints the custody root and seals it. It
 * refuses a founding with no slot: a VK with no human route is a vessel nobody can open. The slot specs bind a
 * passphrase or paper route; the tree refuses a spec with neither.
 *
 * ── AN UNLOCK NEVER THROWS ON A CREDENTIAL ──────────────────────────────────────────────────────
 * `unlockCustody` settles a rotation a fault left behind (independent of any credential), reads the tree, and
 * opens the VK. A wrong credential reads `no-slot-opens`; an absent or torn tree reads by name. Nothing is written
 * on a reading other than the settle.
 *
 * ── AN UNBIND THAT ROTATES RUNS AS ONE ACT ──────────────────────────────────────────────────────
 * `unbindCustodySlot` with `rotate` hands the staying slots to the VK rotation and writes no tree of its own: the
 * rotation's census and its opening of every carrier run before any byte moves, so a carrier that refuses the
 * rotation leaves the slot bound, and the one commit lands a tree that holds the staying slots under the new VK.
 *
 * ── STATUS OPENS NOTHING, AND READS EACH FILE ONCE ──────────────────────────────────────────────
 * `custodyStatus` takes no key. It reports the tree's slots, ONE reading for every file the table names as
 * standing, and every private file the table does not name. A row outside the vessel key carries the law it rests
 * bare under; a hot or cold row that reads anything but `sealed` reads as a fault.
 */

import { mkdirSync } from "node:fs";
import {
  bindSlot, commitSlotTree, decodeSlotTree, mintVk, openVk, readVkCarrier, settleRotation, unbindSlot,
  type Credential, type CustodyIo, type SlotSpec, type SlotTree, type VesselKey, type VkCarrierReading,
} from "@lararium/mesh";
import { mintCustodyRoot, sealCustodyRoot, type CustodyRoot } from "./custody-root.js";
import {
  carrierCensus, outsideTheTable, rotateVesselVk, vkSealedCarriers, vkSlotsPath,
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
  const bytes = await io.read(vkSlotsPath(homes.identity));
  return { bytes, reading: decodeSlotTree(bytes) };
}

async function readableTree(io: CustodyIo, homes: CustodyHomes): Promise<{ bytes: Uint8Array; tree: SlotTree }> {
  const { bytes, reading } = await readTree(io, homes);
  if (reading.reading === "absent") throw new CustodyFoundingRefused(`no slot tree stands at ${vkSlotsPath(homes.identity)}`);
  if (reading.reading === "unreadable") throw new CustodyFoundingRefused(`the slot tree reads unreadable: ${reading.why}`);
  return { bytes: bytes!, tree: reading.tree };
}

/** Whether a slot tree stands at the identity home (any reading but absent). */
export async function custodyTreeStands(io: CustodyIo, homes: CustodyHomes): Promise<boolean> {
  return (await io.read(vkSlotsPath(homes.identity))) !== null;
}

/**
 * Found the custody: mint the VK, bind every slot, commit the tree, then mint and seal the custody root.
 * Refuses an empty `slots`, and (via `commitSlotTree`) a store that already holds a carrier with no tree.
 */
export async function foundCustody(args: {
  readonly io:    CustodyIo;
  readonly homes: CustodyHomes;
  readonly slots: readonly SlotSpec[];
}): Promise<{ vk: VesselKey; tree: SlotTree; root: CustodyRoot }> {
  assertFoundingRoute(args.slots);
  const { io, homes } = args;
  mkdirSync(homes.identity, { recursive: true, mode: 0o700 });
  const vk = mintVk();
  let tree: SlotTree | null = null;
  for (const spec of args.slots) tree = bindSlot(tree, vk, spec);
  const path = vkSlotsPath(homes.identity);
  await commitSlotTree({ io, path, expected: null, vk, tree: tree!, carriers: vkSealedCarriers(homes) });
  const root = mintCustodyRoot();
  await sealCustodyRoot({ io, vk, treePath: path, root, identityDir: homes.identity });
  return { vk, tree: tree!, root };
}

export type CustodyUnlock =
  | { readonly reading: "opens"; readonly vk: VesselKey; readonly slot: string }
  | { readonly reading: "no-slot-opens"; readonly notes: readonly string[] }
  | { readonly reading: "tree-absent" }
  | { readonly reading: "tree-unreadable"; readonly why: string };

/** Open the VK with the presented credentials. Settles a left-behind rotation first; never throws on a credential. */
export async function unlockCustody(args: {
  readonly io:          CustodyIo;
  readonly homes:       CustodyHomes;
  readonly credentials: readonly Credential[];
}): Promise<CustodyUnlock> {
  const { io, homes } = args;
  await settleRotation({ io, treePath: vkSlotsPath(homes.identity), carriers: vkSealedCarriers(homes) });
  const { reading } = await readTree(io, homes);
  if (reading.reading === "absent") return { reading: "tree-absent" };
  if (reading.reading === "unreadable") return { reading: "tree-unreadable", why: reading.why };
  const o = openVk(reading.tree, args.credentials);
  return o.reading === "opens" ? { reading: "opens", vk: o.vk, slot: o.slot } : { reading: "no-slot-opens", notes: o.notes };
}

/** Bind one more slot over the standing tree's own VK. Returns the new tree and the new slot's id. */
export async function bindCustodySlot(args: {
  readonly io:    CustodyIo;
  readonly homes: CustodyHomes;
  readonly vk:    VesselKey;
  readonly spec:  SlotSpec;
}): Promise<{ tree: SlotTree; slotId: string }> {
  const { bytes, tree } = await readableTree(args.io, args.homes);
  const next = bindSlot(tree, args.vk, args.spec);
  await commitSlotTree({
    io: args.io, path: vkSlotsPath(args.homes.identity), expected: bytes, vk: args.vk, tree: next,
    carriers: vkSealedCarriers(args.homes),
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
 * the spec of every slot that stays, the rotation re-seals every carrier under a new VK and binds exactly those
 * slots over it, and no tree lands before the rotation's own census and openings pass. Returns the tree that
 * stands, the rotation offer, whether the VK moved, and the VK that seals the carriers now.
 */
export async function unbindCustodySlot(args: {
  readonly io:      CustodyIo;
  readonly homes:   CustodyHomes;
  readonly vk:      VesselKey;
  readonly slotId:  string;
  readonly rotate?: readonly SlotSpec[];
}): Promise<{ tree: SlotTree; rotationOffer: string; rotated: boolean; vk: VesselKey }> {
  const { bytes, tree } = await readableTree(args.io, args.homes);
  const out = unbindSlot(tree, args.slotId);
  if (args.rotate === undefined) {
    await commitSlotTree({
      io: args.io, path: vkSlotsPath(args.homes.identity), expected: bytes, vk: args.vk, tree: out.tree,
      carriers: vkSealedCarriers(args.homes),
    });
    return { ...out, rotated: false, vk: args.vk };
  }
  if (args.rotate.length !== out.tree.slots.length) {
    throw new RotationSlotsRefused(
      `${out.tree.slots.length} slot(s) stay once slot ${args.slotId} leaves, and the rotation names ${args.rotate.length}: ` +
      "a rotation binds every staying slot over the new vessel key, so each one's route gets read again; nothing was changed",
    );
  }
  const r = await rotateCustody({ io: args.io, homes: args.homes, oldVk: args.vk, slots: args.rotate });
  return { tree: r.tree, rotationOffer: out.rotationOffer, rotated: true, vk: r.vk };
}

/** Mint a new VK and re-seal every carrier under it, binding `slots` over it. Returns the new VK and tree. */
export async function rotateCustody(args: {
  readonly io:    CustodyIo;
  readonly homes: CustodyHomes;
  readonly oldVk: VesselKey;
  readonly slots: readonly SlotSpec[];
}): Promise<{ vk: VesselKey; tree: SlotTree }> {
  const vk = mintVk();
  const tree = await rotateVesselVk({ io: args.io, homes: args.homes, oldVk: args.oldVk, newVk: vk, slots: args.slots });
  return { vk, tree };
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
  readonly reading:  VkCarrierReading;
  /** The law this row rests outside the vessel key under; null on a hot or cold row. */
  readonly bare:     string | null;
  /**
   * True where the file breaks its own row's law: a hot or cold row that reads anything but `sealed`; a floor or
   * floor-plain row under the vessel key's seal, which no rotation re-seals; a file that fails the name its row
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
  for (const e of carrierCensus(args.homes)) {
    const bytes = await args.io.read(e.path);
    const reading = readVkCarrier(bytes);
    const underKey = e.custody === "hot" || e.custody === "cold";
    const fault = underKey
      ? reading !== "sealed"
      : reading === "sealed" || reading === "torn" || (e.holds !== null && bytes !== null && !e.holds(e.file, bytes));
    rows.push({ row: e.row, name: e.name, home: e.home, file: e.file, custody: e.custody, keyClass: e.keyClass, reading, bare: e.bare, fault });
  }
  return { tree, rows, outside: outsideTheTable(args.homes) };
}
