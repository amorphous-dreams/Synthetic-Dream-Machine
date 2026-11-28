/**
 * The disk projector's shared shapes and small pure helpers: the moved file a capture reads, the settle inbox and reconcile watch, the
 * slice of the wiki the orphan pass reads, the keys and alert titles every module names, and the path readers.
 * Heleuma ha: see lararium/mesh/disk-projector-entries.
 */

import { existsSync, readFileSync, realpathSync } from "fs";
import { basename, dirname, join as joinPath, resolve as resolvePath } from "path";
import { rootAddressOf } from "@lararium/mesh/family";

/** The alert a carrier file git never tracked raises where the records dropped it and the file stays: one per path. */
export const UNTRACKED_CARRIER_ALERT_PREFIX = "$:/temp/lares/alert/untracked-carrier/";
export const untrackedCarrierAlertTitle = (path: string): string => `${UNTRACKED_CARRIER_ALERT_PREFIX}${path}`;

/** The mode every projected file takes at creation: the operator alone reads the house's plaintext renders. */
export const PROJECTION_FILE_MODE = 0o600;

/** One settle wait's inbox: the carrier roots changes named since its last look; `all` names every root. */
export interface SettleInbox { readonly bagId: string; readonly roots: Set<string>; all: boolean; readonly waiting: Map<string, string>; readonly superseded: string[] }
/** One settle wait's watch on a carrier's next reconcile. */
export interface ReconcileWatch { ran: boolean; threw: boolean }

/** What the orphan pass reads of the wiki. */
export interface OrphanWiki {
  allTitles(): string[];
  getTiddler(title: string): { fields: Record<string, unknown>; getFieldStrings?: () => Record<string, string> } | undefined;
  addTiddler(fields: Record<string, unknown>): void;
  deleteTiddler(title: string): void;
  getChangeCount?(title: string): number;
}

/**
 * ONE FILE A HAND MOVED, as the projector hands it to the capture door (`LarDiskProjectorOptions.capture`): the bag and the
 * carrier, the path and the hash of the bytes that stand there, the base that stood at that path (what this projector last
 * wrote or last saw captured), the hash of the render the records hold now (null where the records hold no such carrier),
 * and `behind` where the records lost the history that base read (the file then holds the newer words).
 */
export interface MovedFile {
  readonly bagId: string;
  readonly uri: string;
  readonly path: string;
  readonly disk: string;
  readonly base: { readonly disk: string; readonly records: string } | null;
  readonly records: string | null;
  readonly behind?: true;
}

/** What the capture door did with a moved file: its words landed in the records, stood as parallel drafts, or did not land (and why). */
export type CaptureOutcome = { readonly kind: "landed" } | { readonly kind: "drafted"; readonly drafts: readonly string[] } | { readonly kind: "refused"; readonly why: string };

/** Read a file and compare it byte-for-byte against `body`; a missing or
 *  unreadable file reads as unequal (the caller then writes). */
export function safeReadEquals(path: string, body: string): boolean {
  try { return existsSync(path) && readFileSync(path, "utf-8") === body; }
  catch { return false; }
}

/** The per-mirror siting memory's key. */
export function sitedKey(bagId: string, uri: string): string {
  return `${bagId}\n${uri}`;
}

/** Whether `bagId` stands among the bags a leave spares. */
export function keepSpares(keep: string | ReadonlySet<string> | undefined, bagId: string): boolean {
  return keep === undefined ? false : typeof keep === "string" ? keep === bagId : keep.has(bagId);
}

/** The content file a listed carrier file belongs to: a `.meta` sidecar names the file it rides beside. */
export function contentOf(file: string): string {
  return file.endsWith(".meta") ? file.slice(0, -".meta".length) : file;
}

/** The carrier root a record title belongs to, by the URI fragment-path law (`root#a/b` → `root`). */
export function rootOf(title: string): string {
  return rootAddressOf(title);
}

/** A path with its symlinks resolved; a path gone from disk resolves through its nearest standing parent. */
export function realPathOf(path: string): string {
  const abs = resolvePath(path);
  try { return realpathSync(abs); } catch {
    const parent = dirname(abs);
    return parent === abs ? abs : joinPath(realPathOf(parent), basename(abs));
  }
}
