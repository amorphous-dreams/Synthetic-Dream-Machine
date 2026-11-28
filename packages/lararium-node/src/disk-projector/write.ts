/**
 * THE DISK HAND: the atomic, durable write every projected file takes (with its first-write measure), the read of what
 * stands on disk in the carrier's own text form, and the render text a carrier's pointer or body stands as.
 * Heleuma ha: see lararium/mesh/disk-projector-write.
 */

import { existsSync, readFileSync } from "fs";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import type { CarrierFile } from "@lararium/tw5";
import { atomicWriteFileSync } from "../fs-atomic.js";
import type { ProjectorCore } from "./core.js";
import { PROJECTION_FILE_MODE } from "./entries.js";

export function noteFirstWrite(core: ProjectorCore): void {
  const m = core.measure;
  m.writes++;
  if (m.wroteSinceChange || m.lastChangeAt < 0) return;
  m.wroteSinceChange = true;
  const gapMs = Math.round(performance.now() - m.lastChangeAt);
  if (gapMs >= 1_000) {
    console.error(`[disk-projector] MEASURE last change event to first file write ${gapMs}ms · bagsHolding calls in that window ${m.holdsSinceChange} · change events so far ${m.changeEvents} · file writes so far ${m.writes}`);
  }
}

/** Write bytes atomically and durably: a temp file in the SAME dir created at mode 0600, fsynced, renamed over the
 *  target, then the parent dir fsynced (`atomicWriteFileSync`). A watcher or editor never observes a torn file, a
 *  crash leaves the whole old file or the whole new one (or a stray temp), and the rename survives the crash. */
export function atomicWrite(core: ProjectorCore, candidate: string, body: string | Buffer): void {
  noteFirstWrite(core);
  atomicWriteFileSync(candidate, typeof body === "string" ? Buffer.from(body, "utf-8") : body, `${candidate}.lar-tmp-${process.pid}`, { mode: PROJECTION_FILE_MODE });
}

/**
 * WHAT STANDS ON DISK, in the CARRIER'S OWN TEXT FORM — the one shape the three-way gate
 * hashes on both legs. A binary filetype reads its raw bytes and re-encodes to base64,
 * because the Synced-tree observation and the ingest gesture both hash that base64 text
 * (the carrier text), never the decoded bytes; only the physical file holds those.
 *
 * Returns null where NO CONTENT FILE stands: the gate's clause 2 (a first projection, or a
 * vanished file where a base stands). A content file whose declared `.meta` left reads as a
 * disk state of its own: the body alone, `sidecarGone` set. That state equals no render and no
 * canonical view, so the base clauses decide it and a hand's body never gives way on the
 * strength of a missing sidecar. An unreadable content file reads as absent.
 */
export function diskCarrierText(
  candidate: string,
  metaPath: string | null,
  isBinary: boolean,
): { readonly body: string; readonly meta: string | undefined; readonly sidecarGone: boolean } | null {
  try {
    if (!existsSync(candidate)) return null;
    const body = isBinary ? readFileSync(candidate).toString("base64") : readFileSync(candidate, "utf-8");
    if (metaPath === null) return { body, meta: undefined, sidecarGone: false };
    if (!existsSync(metaPath)) return { body, meta: undefined, sidecarGone: true };
    return { body, meta: readFileSync(metaPath, "utf-8"), sidecarGone: false };
  } catch { return null; }
}

/**
 * The text a carrier's render stands as, the text the Synced tree's records side hashes. A POINTER carries
 * no body: its raw bytes come from the local cid/ tier, verified by hash, and a miss or a fault leaves the
 * body pending (the `.meta` lands alone). A binary filetype (image/PDF) carries base64 text in `body` (a
 * pointer's bytes re-encode to it); the raw bytes land on disk. The Synced-tree observation and the ingest
 * gesture BOTH hash the base64 string form (the carrier text), so the echo gate compares like with like;
 * only the physical file holds decoded bytes.
 */
export async function renderedOutput(core: ProjectorCore, tiddlerUri: string, file: CarrierFile): Promise<{ readonly pointerBytes: Buffer | null; readonly bodyPending: boolean; readonly output: string }> {
  let pointerBytes: Buffer | null = null;
  if (file.pointerCid !== undefined) {
    const got = core.resolveByCid ? await core.resolveByCid(file.pointerCid) : null;
    if (got && sha256HexBytesSync(got) === file.pointerCid) pointerBytes = Buffer.from(got);
    else if (got) console.error(`[disk-projector] pointer ${tiddlerUri}: cid/ bytes fail sha256 == ${file.pointerCid} — writing the .meta alone`);
  }
  const bodyPending = file.pointerCid !== undefined && pointerBytes === null;
  const output = pointerBytes ? (file.encoding === "base64" ? pointerBytes.toString("base64") : pointerBytes.toString("utf-8")) : file.body;
  return { pointerBytes, bodyPending, output };
}
