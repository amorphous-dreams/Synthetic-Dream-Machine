/**
 * custody-shape — THE OLD-SHAPE READER. Before any act writes a vessel home, one reading names the shape the
 * homes stand in, off the one carrier table (`vault-carriers`):
 *
 *   `fresh`      — no carrier stands in any home; a founding may write.
 *   `floor-only` — only floor and floor-plain carriers stand, with no slot tree: a leaf that holds no secret.
 *   `slotted`    — a slot tree stands, and every hot and cold carrier opens with the VK envelope.
 *   `old-shape`  — a carrier the re-found build must never write over. Three readings name it:
 *     · `retired-envelope`      — the carrier opens with the retired `LARK` magic, whatever version byte
 *                                 follows. The magic decides alone: a version nothing knows still names a
 *                                 sealed carrier, and a writer that read it as cleartext would shred it.
 *     · `unslotted-secret`      — a hot or cold carrier stands with no slot tree to guard it.
 *     · `cleartext-beside-tree` — a slot tree stands, and a hot or cold carrier opens with no VK envelope.
 *
 * The reader only reads: it opens each carrier's first bytes and writes nothing in any home, so an old home
 * stays byte-identical for the fresh start's move (`#/fresh-start`). The caller refuses before its first
 * write, naming every offender.
 *
 * THE ENVELOPE'S RECOGNIZER ARRIVES AS AN INPUT. The VK envelope belongs to the sealed writer; this reader
 * takes its `sealed(head)` answer and names no envelope of its own, so one spelling of the magic stands.
 */

import { closeSync, openSync, readSync } from "node:fs";
import { ARCHIVE_MAGIC } from "@lararium/mesh";
import { carrierCensus, type CarrierEntry, type CustodyHome, type CustodyHomes } from "./vault-carriers.js";

/** Where the fresh start's by-hand move stands written. */
export const FRESH_START_RUNBOOK = "lar:///ha.ka.ba/lares/docs/stable-founding-road#/fresh-start";

/** How many leading bytes the reader hands the recognizer. */
export const CUSTODY_HEAD_BYTES = 64;

export type OldShapeReason = "retired-envelope" | "unslotted-secret" | "cleartext-beside-tree";

/** One carrier the re-found build must never write over. */
export interface OldShapeOffender {
  readonly home:   CustodyHome;
  readonly file:   string;
  readonly row:    string;
  readonly reason: OldShapeReason;
}

export type CustodyShape =
  | { readonly kind: "fresh" }
  | { readonly kind: "floor-only" }
  | { readonly kind: "slotted" }
  | { readonly kind: "old-shape"; readonly offenders: readonly OldShapeOffender[] };

export interface CustodyShapeReading {
  /** True when a carrier's leading bytes open with the VK envelope. */
  readonly sealed: (head: Uint8Array) => boolean;
}

/** The slot tree's row: its presence makes a home slotted. */
const SLOT_TREE_ROW = "vk-slots";

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

function opensWithRetiredMagic(head: Uint8Array): boolean {
  return head.length >= ARCHIVE_MAGIC.length && ARCHIVE_MAGIC.every((b, i) => head[i] === b);
}

const isSecret = (e: CarrierEntry): boolean => e.custody === "hot" || e.custody === "cold";

/** Read the shape every home stands in. Reads only. */
export function readCustodyShape(homes: CustodyHomes, reading: CustodyShapeReading): CustodyShape {
  const census = carrierCensus(homes);
  const tree = census.some((e) => e.row === SLOT_TREE_ROW);
  const offenders: OldShapeOffender[] = [];
  const offend = (e: CarrierEntry, reason: OldShapeReason): void => {
    offenders.push({ home: e.home, file: e.file, row: e.row, reason });
  };
  for (const e of census) {
    const head = headOf(e.path);
    if (opensWithRetiredMagic(head)) { offend(e, "retired-envelope"); continue; }
    if (!isSecret(e)) continue;
    if (!tree) offend(e, "unslotted-secret");
    else if (!reading.sealed(head)) offend(e, "cleartext-beside-tree");
  }
  if (offenders.length > 0) return { kind: "old-shape", offenders };
  if (tree) return { kind: "slotted" };
  return census.length > 0 ? { kind: "floor-only" } : { kind: "fresh" };
}

/** The named refusal for an old-shape home: every offender, and where the fresh start stands written. */
export function oldShapeRefusal(shape: Extract<CustodyShape, { kind: "old-shape" }>): string {
  const lines = shape.offenders.map((o) => `  ${o.home}: ${o.file} (${o.row}) — ${o.reason}`);
  return [
    "these vessel homes hold carriers in the old shape, and nothing here writes over them:",
    ...lines,
    `move the old homes aside by hand, then found fresh — ${FRESH_START_RUNBOOK}`,
  ].join("\n");
}
