/**
 * island-store-left — the store a wiki island kept before wiki islands kept none, read once and named.
 *
 * A wiki island relays through the vessel's Repo and rests nothing of its own: the vessel's store holds every document
 * once. A house an older composition stood still holds each wiki island's own store beside the vessel's, at
 * `<storageRoot>/<wiki id, path-safe>`: second copies of documents the vessel rests, clear copies of a face's personal layers
 * among them, stale snapshots never compacted, and temps a writer left when a faulted island died mid-save. No code
 * reads it again, and no code removes it: what it holds stays the operator's, and a re-found, which stands a new hearth,
 * leaves it behind. The pool names it once per process, at the wiki's first mount, with what it holds.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/vessel-island-pool
 */
import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** The temp spellings a staged save leaves beside its target (`<target>.<pid>.<suffix>.tmp`, `<target>.<pid>.tmp`). */
const STAGED_TEMP = /\.\d+\.(?:[^./]+\.)?tmp$/;

/** Where a wiki island's own store stood under a storage root: the wiki id, path-safe. */
export function islandStoreDir(storageRoot: string, wikiId: string): string {
  return join(storageRoot, wikiId.replace(/^lar:\/\/\//, "").replace(/[^a-zA-Z0-9@._-]/g, "_"));
}

/** What a left island store holds, or null where no directory stands there. Reads names and sizes, never a byte. */
export function readIslandStoreLeft(dir: string): { readonly files: number; readonly bytes: number; readonly temps: number } | null {
  try { if (!lstatSync(dir).isDirectory()) return null; } catch { return null; }
  let files = 0, bytes = 0, temps = 0;
  const walk = (at: string): void => {
    let entries: import("node:fs").Dirent[];
    try { entries = readdirSync(at, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) { walk(path); continue; }
      if (!entry.isFile()) continue;
      files++;
      try { bytes += lstatSync(path).size; } catch { /* a file gone mid-walk counts no bytes */ }
      if (STAGED_TEMP.test(entry.name)) temps++;
    }
  };
  walk(dir);
  return { files, bytes, temps };
}

/** The line that names a left island store, or null where none stands. */
export function islandStoreLeftLine(dir: string): string | null {
  const held = readIslandStoreLeft(dir);
  if (!held) return null;
  const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
  return `[vessel-pool] an island store stands unused at ${dir}: the vessel holds every doc ` +
    `(${plural(held.files, "file", "files")}, ${held.bytes} bytes, ${plural(held.temps, "stranded temp", "stranded temps")}); ` +
    `nothing reads it, nothing removes it; a re-found leaves it behind`;
}
