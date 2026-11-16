/**
 * git-tree-reader — a head's tree, read out of a checkout's object store with no git binary.
 *
 * The vessel's image carries no git (its serve stage installs shared libraries alone), and a rite's return rests on the
 * receipt standing for the head's TREE, which the vessel derives itself. So the vessel opens the store directly:
 *
 *   the store      `<checkout>/.git/objects`; a linked worktree's `.git` file names its git dir, whose `commondir` names the
 *                  store it shares; `objects/info/alternates` adds the stores it borrows from
 *   a loose object `objects/<2>/<rest>`, zlib-deflated `<type> <size>\0<bytes>`
 *   a packed one   found through a version-2 pack index (`pack/*.idx`), read at its offset in the pack; an offset delta or a
 *                  reference delta resolves against its base, however deep the chain within the bound
 *
 * EVERY OBJECT HASHES BACK TO ITS NAME. The reader hashes `<type> <size>\0<bytes>` under the name's own algorithm (SHA-1 for
 * a 40-digit name, SHA-256 for a 64-digit one) and refuses bytes that hash to another name, so a store that holds the wrong
 * bytes under a head answers nothing. It reads; it writes nothing, spawns nothing and trusts no ref: the caller names the head.
 */
import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { constants, inflateSync } from "node:zlib";
import { SwarmRefused } from "@lararium/mesh";

export interface GitObject { readonly type: string; readonly data: Buffer; /** How many deltas the read crossed to reach these bytes. */ readonly deltas: number }

const NAME = /^[0-9a-f]{40}$|^[0-9a-f]{64}$/;
const TYPES: Readonly<Record<number, string>> = { 1: "commit", 2: "tree", 3: "blob", 4: "tag" };
const MAX_DELTA_CHAIN = 512;
class Unreadable extends Error {}
const fail = (why: string): never => { throw new Unreadable(why); };

/** The object stores a git dir reads from: its own (through `commondir` for a linked worktree), then each alternate. */
function objectStores(gitDir: string): string[] {
  let common = gitDir;
  const commondir = join(gitDir, "commondir");
  if (existsSync(commondir)) common = resolve(gitDir, readFileSync(commondir, "utf8").trim());
  const stores = [join(common, "objects")];
  const alternates = join(stores[0]!, "info", "alternates");
  if (existsSync(alternates)) {
    for (const line of readFileSync(alternates, "utf8").split("\n")) {
      const path = line.trim();
      if (path !== "" && !path.startsWith("#")) stores.push(isAbsolute(path) ? path : resolve(stores[0]!, path));
    }
  }
  return stores;
}

/** A checkout's git dir: `.git` as a directory, or the dir a linked worktree's `.git` file names. */
function gitDirOf(checkout: string): string | null {
  const dot = join(checkout, ".git");
  if (!existsSync(dot)) return null;
  if (statSync(dot).isDirectory()) return dot;
  const named = /^gitdir:\s*(.+)\s*$/m.exec(readFileSync(dot, "utf8"))?.[1];
  return named === undefined ? null : resolve(checkout, named.trim());
}

/** Inflate one zlib stream that starts at `at` in a pack and holds `size` bytes, reading wider until the whole stream fits. */
function inflateAt(fd: number, at: number, size: number): Buffer {
  for (let span = Math.max(256, size + 64); span <= 1 << 30; span *= 2) {
    const chunk = Buffer.alloc(span);
    const got = readSync(fd, chunk, 0, span, at);
    const out = inflateSync(chunk.subarray(0, got), { finishFlush: constants.Z_SYNC_FLUSH });
    if (out.length === size) return out;
    if (out.length > size) fail("a packed object inflates past its stated size");
    if (got < span) fail("a packed object ends before its stated size");
  }
  return fail("a packed object reads as too large");
}

/** Apply one git delta to its base. */
function applyDelta(base: Buffer, delta: Buffer): Buffer {
  let at = 0;
  const varint = (): number => {
    let value = 0, shift = 0, byte: number;
    do { byte = delta[at++] ?? fail("a delta ends inside its header"); value += (byte & 0x7f) * 2 ** shift; shift += 7; } while (byte & 0x80);
    return value;
  };
  if (varint() !== base.length) fail("a delta names another base size");
  const out = Buffer.alloc(varint());
  let to = 0;
  while (at < delta.length) {
    const op = delta[at++]!;
    if (op & 0x80) {
      let offset = 0, size = 0;
      for (let i = 0; i < 4; i++) if (op & (1 << i)) offset += (delta[at++] ?? fail("a delta copy ends early")) * 2 ** (8 * i);
      for (let i = 0; i < 3; i++) if (op & (0x10 << i)) size += (delta[at++] ?? fail("a delta copy ends early")) * 2 ** (8 * i);
      if (size === 0) size = 0x10000;
      if (offset + size > base.length || to + size > out.length) fail("a delta copies outside its base or its result");
      base.copy(out, to, offset, offset + size); to += size;
    } else if (op !== 0) {
      if (at + op > delta.length || to + op > out.length) fail("a delta inserts outside its bounds");
      delta.copy(out, to, at, at + op); at += op; to += op;
    } else fail("a delta holds a reserved instruction");
  }
  if (to !== out.length) fail("a delta fills less than its stated result");
  return out;
}

/** Where a version-2 pack index holds `name`, as an offset into its pack; null where it holds none. */
function indexOffset(idx: Buffer, name: Buffer): number | null {
  if (idx.length < 1032 || idx.readUInt32BE(0) !== 0xff744f63 || idx.readUInt32BE(4) !== 2) return null;
  const width = name.length, count = idx.readUInt32BE(8 + 255 * 4);
  let low = name[0] === 0 ? 0 : idx.readUInt32BE(8 + (name[0]! - 1) * 4), high = idx.readUInt32BE(8 + name[0]! * 4);
  const names = 1032;
  while (low < high) {
    const mid = (low + high) >>> 1, order = idx.compare(name, 0, width, names + mid * width, names + (mid + 1) * width);
    if (order === 0) {
      const small = idx.readUInt32BE(names + count * width + count * 4 + mid * 4);
      if ((small & 0x80000000) === 0) return small;
      const large = names + count * width + count * 8 + (small & 0x7fffffff) * 8;
      return Number(idx.readBigUInt64BE(large));
    }
    // `compare` orders the index's entry against the name asked for: an entry that sorts before it sends the search up.
    if (order < 0) low = mid + 1; else high = mid;
  }
  return null;
}

/** One entry of a pack, at its offset: its type and bytes, deltas resolved. */
function packEntry(stores: readonly string[], pack: string, fd: number, offset: number, width: number, depth: number): GitObject {
  if (depth > MAX_DELTA_CHAIN) fail("a delta chain runs past its bound");
  const head = Buffer.alloc(64);
  readSync(fd, head, 0, 64, offset);
  let at = 0, byte = head[at++]!;
  const kind = (byte >> 4) & 7;
  let size = byte & 0x0f, shift = 4;
  while (byte & 0x80) { byte = head[at++]!; size += (byte & 0x7f) * 2 ** shift; shift += 7; }
  if (kind === 6) {
    // An offset delta names its base by a distance back in this same pack.
    byte = head[at++]!;
    let back = byte & 0x7f;
    while (byte & 0x80) { byte = head[at++]!; back = (back + 1) * 128 + (byte & 0x7f); }
    const base = packEntry(stores, pack, fd, offset - back, width, depth + 1);
    return { type: base.type, data: applyDelta(base.data, inflateAt(fd, offset + at, size)), deltas: base.deltas + 1 };
  }
  if (kind === 7) {
    const base = objectIn(stores, head.subarray(at, at + width).toString("hex"), depth + 1);
    return { type: base.type, data: applyDelta(base.data, inflateAt(fd, offset + at + width, size)), deltas: base.deltas + 1 };
  }
  const type = TYPES[kind] ?? fail("a packed object carries an unknown type");
  return { type, data: inflateAt(fd, offset + at, size), deltas: 0 };
}

/** One object by name, out of the first store that holds it: loose, else packed. */
function objectIn(stores: readonly string[], name: string, depth: number): GitObject {
  const width = name.length / 2, want = Buffer.from(name, "hex");
  for (const store of stores) {
    const loose = join(store, name.slice(0, 2), name.slice(2));
    if (existsSync(loose)) {
      const raw = inflateSync(readFileSync(loose));
      const nul = raw.indexOf(0);
      const header = /^([a-z]+) (\d+)$/.exec(raw.subarray(0, nul < 0 ? 0 : nul).toString("latin1")) ?? fail("a loose object carries no header");
      const data = raw.subarray(nul + 1);
      if (data.length !== Number(header[2])) fail("a loose object's size differs from its header");
      return { type: header[1]!, data, deltas: 0 };
    }
    const packs = join(store, "pack");
    if (!existsSync(packs)) continue;
    for (const file of readdirSync(packs).filter((n) => n.endsWith(".idx")).sort()) {
      const offset = indexOffset(readFileSync(join(packs, file)), want);
      if (offset === null) continue;
      const pack = join(packs, `${file.slice(0, -4)}.pack`);
      const fd = openSync(pack, "r");
      try { return packEntry(stores, pack, fd, offset, width, depth); } finally { closeSync(fd); }
    }
  }
  return fail(`no store holds ${name}`);
}

/** Read one object by name from a git dir, and hold its bytes to that name. */
export async function readGitObject(gitDir: string, name: string): Promise<GitObject> {
  if (!NAME.test(name)) throw new Unreadable("an object name reads as 40 or 64 hex digits");
  const object = objectIn(objectStores(gitDir), name, 0);
  const hashed = createHash(name.length === 40 ? "sha1" : "sha256").update(`${object.type} ${object.data.length}\0`).update(object.data).digest("hex");
  if (hashed !== name) throw new Unreadable(`the bytes under ${name} hash to another name`);
  return object;
}

/**
 * The tree a head names, read out of the first checkout whose store holds that commit. A head that reads as no object name,
 * a checkout with no store, a head no store holds, and bytes that hash to another name each refuse `rite-tree-unreadable`.
 */
export async function treeOfHead(head: string, checkouts: readonly string[]): Promise<string> {
  let why = "no checkout named";
  if (!NAME.test(head)) why = "the head reads as no object name";
  else for (const checkout of checkouts) {
    try {
      const gitDir = gitDirOf(checkout);
      if (gitDir === null) { why = `no git dir stands at ${checkout}`; continue; }
      const commit = await readGitObject(gitDir, head);
      if (commit.type !== "commit") { why = `${head} names a ${commit.type}, never a commit`; continue; }
      const tree = /^tree ([0-9a-f]+)\n/.exec(commit.data.subarray(0, 80).toString("latin1"))?.[1];
      if (tree !== undefined && NAME.test(tree)) return tree;
      why = "the commit names no tree";
    } catch (err) {
      why = err instanceof Error ? err.message : String(err);
    }
  }
  throw new SwarmRefused("rite-tree-unreadable", `no checkout this vessel reaches yields a tree for the head ${head.slice(0, 64)} (${why})`);
}
