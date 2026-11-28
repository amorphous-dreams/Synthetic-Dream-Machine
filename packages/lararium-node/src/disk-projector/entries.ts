/**
 * The disk projector's shared shapes and small pure helpers: the standoff entry, the settle inbox and reconcile watch, the
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

/** The states a `sides` standoff folds into its key: the file weighed, the disk's hash, the records' hash, and the base where one stands. */
export interface StandoffSides {
  readonly path: string;
  readonly disk: string | null;
  readonly records: string;
  readonly base?: { readonly disk: string; readonly records: string };
  /**
   * THE RECORDS FELL BEHIND THE BASE (`pastRecords`): the document the base names, the heads it lacks, and whether the
   * document stood quiet since it mounted (no write landed, so it holds nothing newer than what it loaded). The keeper
   * reads this to keep the disk with no hand (`standoff-drafts.ts`).
   */
  readonly behind?: { readonly doc?: string; readonly heads: readonly string[]; readonly quiet: boolean };
}

export interface StandoffEntry extends Partial<StandoffSides> {
  readonly standoff: string;
  readonly kind: "sides" | "home";
  readonly reason: string;
}

/** One standoff as `standing()` names it. */
export interface StandingStandoff extends StandoffEntry {
  readonly bagId: string;
  readonly uri: string;
}

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
