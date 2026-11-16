/**
 * pulama-state — what the pūlama keeps on disk: signed records and the host's image report, and no secret.
 *
 * The pūlama's state rests in a directory of its own (`LAR_PULAMA_STATE`), mounted in the pūlama alone. A vessel never
 * writes it, so a vessel never forges or drops the record of what the pūlama served it. Every row holds a signed record
 * or a public digest; a key never rests here.
 *
 *   records/<sha256(title)>.json   one row per title: `{ title, text }`. `writeNew` lands a row only where none stands
 *                                   (an exclusive create), which gives a lei's return and a tessera half their one claim.
 *   image                           the digest of the image the host raises, as the host shim reported it at the hand door.
 *
 * The record store answers the wiki port the swarm's lei family reads and writes through (`read`, `write`, `writeNew`,
 * `list`), so that family's own reader and return seat over it unchanged.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { createHash } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, writeSync } from "node:fs";
import { join } from "node:path";
import type { SwarmWikiPort } from "@lararium/mesh";
import type { PulamaTesseraPort } from "./kukulu-gate.js";

const rowName = (title: string): string => `${createHash("sha256").update(title).digest("hex")}.json`;

function writeWhole(path: string, text: string, flag: "wx" | "w"): void {
  const fd = openSync(path, flag, 0o600);
  try { writeSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
}

/** The pūlama's record store over `dir`. */
export function pulamaRecords(dir: string): SwarmWikiPort {
  const rows = join(dir, "records");
  mkdirSync(rows, { recursive: true, mode: 0o700 });
  const readRow = (file: string): { title: string; text: string } | null => {
    try {
      const raw = JSON.parse(readFileSync(join(rows, file), "utf8")) as { title?: unknown; text?: unknown };
      return typeof raw.title === "string" && typeof raw.text === "string" ? { title: raw.title, text: raw.text } : null;
    } catch { return null; }
  };
  return {
    async read(title) { const row = readRow(rowName(title)); return row !== null && row.title === title ? row.text : null; },
    async write(title, text) {
      const path = join(rows, rowName(title)), tmp = `${path}.${process.pid}.tmp`;
      writeWhole(tmp, JSON.stringify({ title, text }), "w");
      renameSync(tmp, path);
    },
    async writeNew(title, text) {
      try { writeWhole(join(rows, rowName(title)), JSON.stringify({ title, text }), "wx"); return true; }
      catch (err) { if ((err as NodeJS.ErrnoException).code === "EEXIST") return false; throw err; }
    },
    async list(prefix) {
      const out: string[] = [];
      for (const file of readdirSync(rows)) { const row = file.endsWith(".json") ? readRow(file) : null; if (row !== null && row.title.startsWith(prefix)) out.push(row.title); }
      return out.sort();
    },
  };
}

/** The title a kūkulu's tessera half rests at, by the lei it began under. */
export const pulamaTesseraTitle = (lei: string): string => `$:/lares/pulama/tessera/${lei}/rite-begun`;
export const PULAMA_TESSERA_PREFIX = "$:/lares/pulama/tessera/";

/** The tessera port over the record store: one half per lei, written once. */
export const pulamaTessera = (records: SwarmWikiPort): PulamaTesseraPort => ({ land: (lei, text) => records.writeNew(pulamaTesseraTitle(lei), text) });

const IMAGE_DIGEST = /^[a-z0-9]+:[0-9a-f]{32,128}$/;

/** THE HOST'S IMAGE REPORT: the input port the kūkulu gate reads. The host shim writes it; no vessel does. */
export function pulamaImage(dir: string): { report(digest: string): void; raised(): string | null } {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, "image");
  return {
    report(digest) {
      if (!IMAGE_DIGEST.test(digest)) throw new RangeError("an image digest reads `<algorithm>:<hex>`");
      writeWhole(`${path}.tmp`, digest, "w");
      renameSync(`${path}.tmp`, path);
    },
    raised() {
      try { const digest = readFileSync(path, "utf8").trim(); return IMAGE_DIGEST.test(digest) ? digest : null; } catch { return null; }
    },
  };
}
