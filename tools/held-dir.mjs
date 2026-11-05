/**
 * held-dir — a directory held open by handle (seat-harness#/the-broker).
 *
 * A pathname re-resolves on every use, so a lead that can swap a directory for a symlink steers every later read and
 * create. `openHeld` opens the directory ONCE (no symlink, a real directory under the root, the opened inode equal to
 * the one lstat saw), and `at(name)` returns `/proc/self/fd/<n>/<name>`, which the kernel anchors to the opened
 * directory itself, so a swap of the pathname afterwards redirects nothing.
 */
import { constants as FS } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

/** Opens `dir`, which must be `root` itself or sit under it; rejects with a named error otherwise. */
export async function openHeld(dir, root) {
  const rootReal = await realpath(root);
  const before = await lstat(dir);
  if (before.isSymbolicLink() || !before.isDirectory()) throw new Error(`${dir} is not a real directory`);
  const fh = await open(dir, FS.O_RDONLY | FS.O_DIRECTORY | FS.O_NOFOLLOW);
  try {
    const st = await fh.stat();
    if (st.ino !== before.ino || st.dev !== before.dev) throw new Error(`${dir} changed while it opened`);
    const resolved = await realpath(`/proc/self/fd/${fh.fd}`);
    if (resolved !== rootReal && !resolved.startsWith(`${rootReal}${path.sep}`)) throw new Error(`${dir} resolves outside ${rootReal}`);
  } catch (error) { await fh.close(); throw error; }
  return {
    at: (name = "") => (name === "" ? `/proc/self/fd/${fh.fd}` : `/proc/self/fd/${fh.fd}/${name}`),
    close: () => fh.close().catch(() => {}),
  };
}

// ---- the synchronous door, for the launcher and the supervisor ----
import { closeSync, constants as FSC, fstatSync, ftruncateSync, lstatSync, mkdirSync, openSync, readFileSync, readSync as fsReadSync, realpathSync, writeSync } from "node:fs";

/** Like `openHeld`, but synchronous: returns `{ fd, at, close }` with the directory held open under `root`. */
export function openHeldSync(dir, root) {
  const rootReal = realpathSync(root);
  const before = lstatSync(dir);
  if (before.isSymbolicLink() || !before.isDirectory()) throw new Error(`${dir} is not a real directory`);
  const fd = openSync(dir, FSC.O_RDONLY | FSC.O_DIRECTORY | FSC.O_NOFOLLOW);
  try {
    const st = fstatSync(fd);
    if (st.ino !== before.ino || st.dev !== before.dev) throw new Error(`${dir} changed while it opened`);
    const resolved = realpathSync(`/proc/self/fd/${fd}`);
    if (resolved !== rootReal && !resolved.startsWith(`${rootReal}${path.sep}`)) throw new Error(`${dir} resolves outside ${rootReal}`);
  } catch (error) { closeSync(fd); throw error; }
  return heldOver(fd, true);
}

/** A held directory over an fd the caller inherited (the supervisor's), which it does not close. */
export function heldOver(fd, owns = false) {
  let closed = false;
  return {
    fd,
    at: (name = "") => (name === "" ? `/proc/self/fd/${fd}` : `/proc/self/fd/${fd}/${name}`),
    close: () => { if (owns && !closed) { closed = true; try { closeSync(fd); } catch { /* already closed */ } } },
  };
}

/**
 * Writes `data` to `name` inside a held directory: opened with O_NOFOLLOW (a planted symlink refuses), O_EXCL for mode "x", a
 * single hard link required before any truncate (a file linked to somewhere else refuses), O_APPEND for mode "a".
 */
export function writeHeld(held, name, data, mode = "w") {
  if (/[/\0]/.test(name) || name === "." || name === "..") throw new Error(`invalid output name ${name}`);
  const flags = FSC.O_WRONLY | FSC.O_CREAT | FSC.O_NOFOLLOW | (mode === "x" ? FSC.O_EXCL : 0) | (mode === "a" ? FSC.O_APPEND : 0);
  let fd;
  try { fd = openSync(held.at(name), flags, 0o644); } catch (error) { throw new Error(`${name}: ${error.code === "ELOOP" ? "a symlink stands at this output name" : error.code ?? error.message}`); }
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) throw new Error(`${name}: not a regular file`);
    if (st.nlink > 1) throw new Error(`${name}: hard-linked elsewhere`);
    if (mode === "w") ftruncateSync(fd, 0);
    writeSync(fd, data);
  } finally { closeSync(fd); }
}

/** Opens a log for the child's stdio: O_NOFOLLOW, one link, truncated; returns the fd the caller closes. */
export function openLogHeld(held, name) {
  let fd;
  try { fd = openSync(held.at(name), FSC.O_WRONLY | FSC.O_CREAT | FSC.O_NOFOLLOW, 0o644); } catch (error) { throw new Error(`${name}: ${error.code === "ELOOP" ? "a symlink stands at this output name" : error.code ?? error.message}`); }
  const st = fstatSync(fd);
  if (!st.isFile() || st.nlink > 1) { closeSync(fd); throw new Error(`${name}: not a lone regular file`); }
  ftruncateSync(fd, 0);
  return fd;
}

/** Reads `name` from a held directory without following a symlink. */
export function readHeld(held, name) {
  let fd;
  try { fd = openSync(held.at(name), FSC.O_RDONLY | FSC.O_NOFOLLOW); } catch (error) { throw new Error(`${name}: ${error.code === "ELOOP" ? "a symlink stands at this name" : error.code ?? error.message}`); }
  try { return readFileSync(fd, "utf8"); } finally { closeSync(fd); }
}

/** Makes a subdirectory inside a held one (an existing real directory passes; a symlink or file refuses). */
export function mkdirHeld(held, name) {
  try { mkdirSync(held.at(name)); } catch (error) { if (error.code !== "EEXIST") throw error; }
  const st = lstatSync(held.at(name));
  if (st.isSymbolicLink() || !st.isDirectory()) throw new Error(`${name}: not a real directory`);
}

import { readdirSync, unlinkSync } from "node:fs";

const COPY_CAP = 8 * 1024 * 1024;
const COPY_COUNT = 64;
const LANE_OWNS = new Set(["brief.md", "prompt.txt", "marker.txt", "rollouts-before.json", "attempts.log"]);

/**
 * The hand-back: copies the regular top-level files a seat left in its broker-owned directory into the lane's seat directory
 * through the held handle (an old entry unlinked first, then O_NOFOLLOW|O_EXCL), each capped at 8 MiB, at most 64 files, never
 * the inputs the lane already holds. Returns the names copied.
 */
export function copyBack(from, to) {
  const copied = [];
  for (const name of readdirSync(from.at()).sort().slice(0, COPY_COUNT)) {
    if (LANE_OWNS.has(name) || name.startsWith(".")) continue;
    const src = from.at(name);
    const st = lstatSync(src);
    if (!st.isFile() || st.nlink > 1) continue;
    let data;
    const rfd = openSync(src, FSC.O_RDONLY | FSC.O_NOFOLLOW);
    try { const buf = Buffer.alloc(Math.min(st.size, COPY_CAP)); const n = fsReadSync(rfd, buf, 0, buf.length, 0); data = buf.subarray(0, n); } finally { closeSync(rfd); }
    try { unlinkSync(to.at(name)); } catch (error) { if (error.code !== "ENOENT") continue; }
    let wfd;
    try { wfd = openSync(to.at(name), FSC.O_WRONLY | FSC.O_CREAT | FSC.O_EXCL | FSC.O_NOFOLLOW, 0o644); } catch { continue; }
    try { writeSync(wfd, data); if (st.size > COPY_CAP) writeSync(wfd, `\n[truncated at ${COPY_CAP} bytes by the broker]\n`); } finally { closeSync(wfd); }
    copied.push(name);
  }
  return copied;
}
