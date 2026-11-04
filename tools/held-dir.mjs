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
    close: () => fh.close(),
  };
}
