/**
 * custody-shape — THE CUSTODY SHAPE READER. Before any act writes a vessel home, one reading names the shape the
 * homes stand in, off the one carrier table (`vault-carriers`):
 *
 *   `fresh`      — no carrier stands in any home; a founding may write.
 *   `floor-only` — only floor and floor-plain carriers stand, with no slot tree: a leaf that holds no secret.
 *   `slotted`    — a slot tree stands, and every hot and cold carrier opens with the VK envelope.
 *   `occupied`   — a carrier stands that this build must never write over. Three readings name it:
 *     · `unknown-envelope`      — the house envelope reader (`readVkCarrier`) reads a frame no unlock of this
 *                                 build opens: another scheme, a damaged magic, any seal it cannot frame. The
 *                                 frame decides alone: a writer that read such a carrier as cleartext would
 *                                 shred it.
 *     · `unslotted-secret`      — a hot or cold carrier stands with no slot tree to guard it.
 *     · `cleartext-beside-tree` — a slot tree stands, and a hot or cold carrier opens with no VK envelope.
 *
 * The reader only reads: it opens each carrier's first bytes and writes nothing in any home, so a refused home
 * stays byte-identical. The caller refuses before its first
 * write, naming every offender.
 *
 * THE ENVELOPE'S RECOGNIZER ARRIVES AS AN INPUT. The VK envelope belongs to the sealed writer: this reader
 * takes its `sealed(head)` answer, and asks the mesh's one envelope reader which frames no unlock opens, so one
 * spelling of every magic stands.
 */

import { closeSync, openSync, readSync } from "node:fs";
import { readFckCarrier, readVkCarrier } from "@lararium/mesh";
import { carrierCensus, type CarrierEntry, type CustodyHome, type CustodyHomes } from "./vault-carriers.js";

/** Where the fresh start's by-hand move stands written. */

/** How many leading bytes the reader hands the recognizer. */
export const CUSTODY_HEAD_BYTES = 64;

export type OccupantReason = "unknown-envelope" | "unslotted-secret" | "cleartext-beside-tree";

/** One carrier this build must never write over. */
export interface OccupantOffender {
  readonly home:   CustodyHome;
  readonly file:   string;
  readonly row:    string;
  readonly reason: OccupantReason;
}

export type CustodyShape =
  | { readonly kind: "fresh" }
  | { readonly kind: "floor-only" }
  | { readonly kind: "slotted" }
  | { readonly kind: "occupied"; readonly offenders: readonly OccupantOffender[] };

export interface CustodyShapeReading {
  /** True when a carrier's leading bytes open with the VK envelope. */
  readonly sealed: (head: Uint8Array) => boolean;
}

/** The slot tree's row: its presence makes a home slotted. */
const SLOT_TREE_ROW = "s-slots";

/** A carrier's first bytes; an unreadable carrier reads empty, which no envelope recognizes. */
function headOf(path: string): Uint8Array {
  let fd: number;
  try { fd = openSync(path, "r"); } catch { return new Uint8Array(0); }
  try {
    const buf = Buffer.alloc(CUSTODY_HEAD_BYTES);
    const n = readSync(fd, buf, 0, CUSTODY_HEAD_BYTES, 0);
    return new Uint8Array(buf.subarray(0, n));
  } catch { return new Uint8Array(0); }
  finally { closeSync(fd); }
}

/** A frame no unlock of this build opens: anything the envelope reader reads other than sealed, torn or bare. */
function opensWithUnknownEnvelope(head: Uint8Array, face = false): boolean {
  const r = face ? readFckCarrier(head) : readVkCarrier(head);
  return r !== "sealed" && r !== "torn" && r !== "bare" && r !== "absent";
}

const isSecret = (e: CarrierEntry): boolean => e.custody === "serving" || e.custody === "hot" || e.custody === "cold" || e.custody === "face-hot" || e.custody === "face-cold";

/** Read the shape every home stands in. Reads only. */
export function readCustodyShape(homes: CustodyHomes, reading: CustodyShapeReading): CustodyShape {
  const census = carrierCensus(homes);
  const tree = census.some((e) => e.row === SLOT_TREE_ROW);
  const offenders: OccupantOffender[] = [];
  const offend = (e: CarrierEntry, reason: OccupantReason): void => {
    offenders.push({ home: e.home, file: e.file, row: e.row, reason });
  };
  for (const e of census) {
    const head = headOf(e.path);
    const face = e.custody === "face-hot" || e.custody === "face-cold";
    if (opensWithUnknownEnvelope(head, face)) { offend(e, "unknown-envelope"); continue; }
    if (!isSecret(e)) continue;
    if (!tree) offend(e, "unslotted-secret");
    else if (!(face ? readFckCarrier(head) === "sealed" : reading.sealed(head))) offend(e, "cleartext-beside-tree");
  }
  if (offenders.length > 0) return { kind: "occupied", offenders };
  if (tree) return { kind: "slotted" };
  return census.length > 0 ? { kind: "floor-only" } : { kind: "fresh" };
}

/** The named refusal for an occupied home this build writes nothing over: every offender. */
export function occupiedStoreRefusal(shape: Extract<CustodyShape, { kind: "occupied" }>): string {
  const lines = shape.offenders.map((o) => `  ${o.home}: ${o.file} (${o.row}) — ${o.reason}`);
  return [
    "these vessel homes hold carriers no slot tree commits to, and nothing here writes over them:",
    ...lines,
    "move these homes aside by hand, then found fresh",
  ].join("\n");
}
