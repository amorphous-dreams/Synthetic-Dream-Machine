/**
 * THE BASES THIS DOCUMENT OWNS: which document a bag's records rest in, whether a base still holds that document's
 * history, the base at a path, HEAD standing in where no synced base does, and the pin and forget that move a base.
 * Heleuma ha: see lararium/mesh/disk-projector-bases.
 */

import { relative as relativePath, resolve as resolvePath } from "path";
import { carrierHash } from "@lararium/mesh/crypto";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { confineMirrorWrite } from "../bag-paths.js";
import type { BagMirrorConfig } from "../bag-paths.js";
import { syncedTreeKey } from "../synced-tree.js";
import type { SyncedBase } from "../synced-tree.js";
import type { ProjectorCore } from "./core.js";

/** The document this composition names for a bag's records, or undefined where it names none. */
export function docOf(core: ProjectorCore, bagId: string): string | undefined {
  return core.documentOf?.(bagId) || undefined;
}

/** Whether a base names ANOTHER document than the one this composition reads for the bag: such a base vouches for nothing here. */
export function otherDocument(core: ProjectorCore, bagId: string, base: SyncedBase | null): boolean {
  if (base === null || base.doc === undefined) return false;
  const mine = docOf(core, bagId);
  return mine !== undefined && base.doc !== mine;
}

/**
 * Whether a base stands PAST the records this composition reads: it names heads, and the bag's document lacks them.
 * The document read back without the write that agreement saw, so the base vouches for no write and no unlink here.
 * A base with no heads, or a store with no history to ask, answers false and vouches as it always did.
 */
export function pastRecords(core: ProjectorCore, bagId: string, base: SyncedBase | null): boolean {
  if (base === null || base.heads === undefined) return false;
  const lineage = core.lineageOf?.(bagId) ?? null;
  return lineage !== null && !lineage.holds(base.heads);
}

/** The base that stands at `path` for THIS document's records, or null: another document's base names none here. */
export function ownBaseAt(core: ProjectorCore, bagId: string, uri: string, path: string): SyncedBase | null {
  const base = core.syncedTree.baseAt(syncedTreeKey(bagId, uri), path);
  return otherDocument(core, bagId, base) ? null : base;
}

/**
 * THE BASE THE POOL'S HEAD NAMES for a carrier at `path` (face-pools A5), where no synced base stands: HEAD's bytes on
 * the disk side, the render they say on the records side (folded as the gate's `≈` folds the disk), or null where no
 * port stands, the body rides binary, or HEAD never held the file.
 */
export function headBaseAt(core: ProjectorCore, uri: string, path: string, ext: string, isBinary: boolean): SyncedBase | null {
  if (core.baseFromGit === undefined || isBinary) return null;
  const head = core.baseFromGit(path);
  if (head === null) return null;
  const disk = carrierHash(head.body, head.meta);
  const records = (() => {
    if (ext === MEME_EXT) {
      const canonical = core.canonicalizeFn ? core.canonicalizeFn(uri, head.body) : null;
      return canonical === null ? null : carrierHash(canonical, head.meta);
    }
    const canonical = core.canonicalizeNativeFn ? core.canonicalizeNativeFn(uri, ext, head.body, head.meta) : null;
    return canonical === null ? null : carrierHash(canonical.body, canonical.metaBody);
  })();
  return { path, disk, records: records ?? disk };
}

/** Every base the carrier holds for THIS document's records. */
export function ownBases(core: ProjectorCore, bagId: string, uri: string): SyncedBase[] {
  return core.syncedTree.bases(syncedTreeKey(bagId, uri)).filter((base) => !otherDocument(core, bagId, base));
}

/** Pin an agreement between the file at `path` and this document's records. */
export function pin(core: ProjectorCore, bagId: string, uri: string, path: string, diskHash: string, recordsHash: string = diskHash): void {
  core.syncedTree.set(syncedTreeKey(bagId, uri), path, diskHash, recordsHash, docOf(core, bagId), core.lineageOf?.(bagId)?.heads ?? undefined);
}

/** The base at `path` leaves, unless it names another document: that row stays with the file it vouches for. */
export function forgetAt(core: ProjectorCore, bagId: string, uri: string, path: string): void {
  const key = syncedTreeKey(bagId, uri);
  if (!otherDocument(core, bagId, core.syncedTree.baseAt(key, path))) core.syncedTree.deleteAt(key, path);
}

/**
 * THE HOMES A CARRIER'S BASES NAME, WHERE THIS MIRROR HOLDS THEM. Each base names the file its agreement
 * stood at, and the ingest gesture pins one at whatever source it read: a holding directory beside the
 * mirror included. A path this mirror's own ward would refuse to write names no home of the mirror, so no
 * unlink weighs it and the file there stays its person's.
 */
export function basedHomes(core: ProjectorCore, mirror: BagMirrorConfig, uri: string): string[] {
  return ownBases(core, mirror.bagId, uri).map((base) => base.path).filter((basedAt) =>
    confineMirrorWrite(mirror.mirrorRoot, relativePath(resolvePath(mirror.mirrorRoot), basedAt), mirror.allowBagsRootFiles).ok);
}
