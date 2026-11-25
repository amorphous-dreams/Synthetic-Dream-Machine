/**
 * sealed-store-fs — the node's rest for the sealed store's lockboxes, signed records and index rows.
 *
 * ONE DIRECTORY PER KIND, ONE FILE PER NAME, under `<storage>/sealed`, beside the sealed values' own `cad/`
 * tier. Nothing here holds a secret, a name or a key in the clear (`@lararium/mesh` `sealed-store-rest`), so
 * the files rest as plain bytes and a carrier may hold every one.
 *
 * A WRITE LANDS WHOLE OR NOT AT ALL. Each value goes to a temporary file in its own directory, every byte of
 * it however many calls the file system takes, reaches the disk, takes its name by a rename, and the directory's own entry reaches the disk before the write answers.
 * A directory the write had to make reaches the disk the same way, through its parent, before the value does.
 * A stop leaves the earlier state or the whole value. A temporary file carries a name the store's own rule
 * refuses, so a leftover never lists and never reads.
 *
 * A NAME THAT ALREADY RESTS KEEPS ITS BYTES, for every kind but `own`: a name derives from the bytes it names,
 * so a second write under it holds nothing to add. A file altered at rest gives way to bytes that hash to the
 * digest its name ends in, and to no others. `own` holds the vessel's local notes, and its latest write
 * replaces.
 *
 * NO NAME FORMS A PATH BEFORE THE RULE READS IT: no separator, no `..`, no upper case.
 *
 * A LOOKUP BY ONE ID READS NO WHOLE SHELF. The rest holds each shelf's sorted names in memory, beside the directory's own
 * stamp (inode, modification and change marks), and a listing under a prefix reads that list by binary search. A stamp
 * that moved (another writer, a file dropped in by hand) reads the directory again; this rest's own write adds its name
 * and takes the new stamp only where the stamp stood as held before the write touched the shelf. A stamp answers to the
 * file system's own tick, so a second writer's name that lands inside the tick this rest's write took may stay out of
 * the held list: a prefix that finds no name there reads the directory once more before it answers empty, so no resting
 * name reads as ABSENT, though a lookup that finds one copy under an id may miss a second copy until the stamp moves. A
 * listing with no prefix reads the directory itself. The list holds names alone, and every name passes the rule.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { randomBytes } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isRestKind, isRestName, restNameHolds, type RestKind, type SealedStoreRest } from "@lararium/mesh/sealed-store-rest";
import type { ProviderChunkRest } from "@lararium/keyhive";

/** The sealed store's own directory under a vessel's storage directory. */
export function sealedStoreDir(storageDir: string): string {
  return join(storageDir, "sealed");
}

/** Flush a directory's own entries: a rename reaches the disk only once its directory does. */
function syncDir(dir: string): void {
  const fd = openSync(dir, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

/** Make `dir` and every missing directory above it, and flush each new directory's entry: a directory made
 *  for a first write reaches the disk once its PARENT does, so a stop after the write answers still finds it. */
function makeDir(dir: string): void {
  const first = mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (first === undefined) return;
  const top = resolve(first);
  for (let at = resolve(dir); ; at = dirname(at)) {
    syncDir(dirname(at));
    if (at === top || dirname(at) === at) return;
  }
}

/** Write every byte. One call may take fewer bytes than it got handed, and a rest that answered after a part
 *  of a lockbox would leave a value sealed under a key no restart opens. */
function writeWhole(fd: number, bytes: Uint8Array): void {
  for (let at = 0; at < bytes.length;) {
    const took = writeSync(fd, bytes, at, bytes.length - at);
    if (!(took > 0)) throw new Error("sealed-store-fs: the file system took no byte of the value");
    at += took;
  }
}

/** A shelf directory's stamp: its inode and its modification and change marks, or null where it stands absent. */
function stampOf(shelf: string): string | null {
  try {
    const st = statSync(shelf, { bigint: true });
    return `${st.ino}:${st.mtimeNs}:${st.ctimeNs}`;
  } catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return null; throw err; }
}
/** The first index in sorted `names` whose name reads at or after `key`. */
function lowerBound(names: readonly string[], key: string): number {
  let lo = 0, hi = names.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (names[mid]! < key) lo = mid + 1; else hi = mid; }
  return lo;
}

/** The rest over files. `dir` names the sealed store's own directory (`sealedStoreDir`). */
export function fsSealedStoreRest(dir: string): SealedStoreRest {
  /** Each shelf's names as this rest last read them (sorted, the rule already passed), and the stamp they answer to. */
  const held = new Map<RestKind, { names: string[]; stamp: string | null }>();
  /** Read one shelf's directory and hold what it names. */
  const readShelf = (kind: RestKind): string[] => {
    const shelf = shelfOf(kind);
    const stamp = stampOf(shelf);
    let names: string[];
    try { names = readdirSync(shelf); }
    catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") { held.set(kind, { names: [], stamp: null }); return []; } throw err; }
    names = names.filter((name) => isRestName(name)).sort();
    held.set(kind, { names, stamp });
    return names;
  };
  const underPrefix = (names: readonly string[], prefix: string): string[] => {
    const out: string[] = [];
    for (let at = lowerBound(names, prefix); at < names.length && names[at]!.startsWith(prefix); at++) out.push(names[at]!);
    return out;
  };
  const shelfOf = (kind: RestKind): string => {
    if (!isRestKind(kind)) throw new TypeError("sealed-store-fs: an unknown rest kind names no directory");
    return join(dir, kind);
  };
  const pathOf = (kind: RestKind, name: string): string => {
    const shelf = shelfOf(kind);
    if (!isRestName(name)) throw new TypeError("sealed-store-fs: a rest name holds lower-case letters, digits, dots and dashes alone");
    return join(shelf, name);
  };
  return {
    async put(kind, name, bytes) {
      const target = pathOf(kind, name);
      if (kind !== "own" && existsSync(target) && (restNameHolds(name, readFileSync(target)) || !restNameHolds(name, bytes))) return;
      const shelf = shelfOf(kind);
      makeDir(shelf);
      // The shelf's stamp before this write touches it: the temporary file below moves it too.
      const before = stampOf(shelf);
      // An upper-case lead keeps the temporary name outside the rule every listed name passes.
      const temp = join(shelf, `TMP-${randomBytes(12).toString("hex")}`);
      const fd = openSync(temp, "wx", 0o600);
      try {
        writeWhole(fd, bytes);
        fsyncSync(fd);
      } catch (err) {
        closeSync(fd);
        rmSync(temp, { force: true });
        throw err;
      }
      closeSync(fd);
      try { renameSync(temp, target); } catch (err) { rmSync(temp, { force: true }); throw err; }
      syncDir(shelf);
      // THIS REST'S OWN NAME JOINS THE HELD LIST, where nothing else moved the shelf since this rest last read it;
      // otherwise the list gives way and the next listing reads the directory.
      const list = held.get(kind);
      if (list !== undefined) {
        if (list.stamp !== null && list.stamp === before) {
          const at = lowerBound(list.names, name);
          if (list.names[at] !== name) list.names.splice(at, 0, name);
          list.stamp = stampOf(shelf);
        } else held.delete(kind);
      }
    },
    async get(kind, name) {
      const target = pathOf(kind, name);
      try { return Uint8Array.from(readFileSync(target)); }
      catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return null; throw err; }
    },
    async list(kind, prefix = "") {
      if (prefix === "") return [...readShelf(kind)];
      const list = held.get(kind);
      if (list === undefined || list.stamp !== stampOf(shelfOf(kind))) return underPrefix(readShelf(kind), prefix);
      const found = underPrefix(list.names, prefix);
      // A MISS READS THE DIRECTORY ONCE MORE: a stamp may hold across a write that landed inside its own tick.
      return found.length > 0 ? found : underPrefix(readShelf(kind), prefix);
    },
  };
}

const HEX = /^[0-9a-f]{1,128}$/;
/**
 * The rest for the Keyhive chunks a provider tracks per bag (`@lararium/keyhive` `ProviderChunkRest`): one
 * directory per shelf, one file per content reference, each ciphertext under an opaque name. A shelf reads as
 * a digest of a bag URL and its document, so no URL forms a path here. Writes land whole, by the same rename.
 */
export function fsProviderChunkRest(dir: string): ProviderChunkRest {
  const bare = (id: string): string => {
    const name = id.toLowerCase().replace(/^0x/, "");
    if (!HEX.test(name)) throw new TypeError("sealed-store-fs: a chunk shelf and a content reference read as hex alone");
    return name;
  };
  return {
    async put(shelf, refHex, ciphertext) {
      const home = join(dir, bare(shelf));
      makeDir(home);
      const temp = join(home, `TMP-${randomBytes(12).toString("hex")}`);
      const fd = openSync(temp, "wx", 0o600);
      try { writeWhole(fd, ciphertext); fsyncSync(fd); }
      catch (err) { closeSync(fd); rmSync(temp, { force: true }); throw err; }
      closeSync(fd);
      try { renameSync(temp, join(home, bare(refHex))); } catch (err) { rmSync(temp, { force: true }); throw err; }
      syncDir(home);
    },
    async list(shelf) {
      const home = join(dir, bare(shelf));
      let names: string[];
      try { names = readdirSync(home); }
      catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return []; throw err; }
      return names.filter((name) => HEX.test(name)).sort().map((name) => ({ refHex: `0x${name}`, ciphertext: Uint8Array.from(readFileSync(join(home, name))) }));
    },
    async drop(shelf) { rmSync(join(dir, bare(shelf)), { recursive: true, force: true }); },
  };
}
