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
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { randomBytes } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isRestKind, isRestName, restNameHolds, type RestKind, type SealedStoreRest } from "@lararium/mesh";
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

/** The rest over files. `dir` names the sealed store's own directory (`sealedStoreDir`). */
export function fsSealedStoreRest(dir: string): SealedStoreRest {
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
    },
    async get(kind, name) {
      const target = pathOf(kind, name);
      try { return Uint8Array.from(readFileSync(target)); }
      catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return null; throw err; }
    },
    async list(kind, prefix = "") {
      let names: string[];
      try { names = readdirSync(shelfOf(kind)); }
      catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return []; throw err; }
      return names.filter((name) => isRestName(name) && name.startsWith(prefix)).sort();
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
