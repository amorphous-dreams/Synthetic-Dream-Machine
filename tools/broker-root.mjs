/**
 * broker-root — the ONE place a launched seat's broker-owned directory lives (seat-harness#/the-broker).
 *
 * No caller names it. The root sits at a fixed path under the real home, OUTSIDE ~/.lares-scratch entirely, and only an
 * environment the controller sets (LARES_BROKER_ROOT) moves it. `checkBrokerRoot` verifies every existing component from the
 * home down by lstat: a real directory (no symlink), ours, nothing group- or world-writable above the root, the root itself
 * mode exactly 0700, and the whole path outside the scratch tree and every guarded root; it creates nothing.
 * `ensureBrokerRoot` makes the missing components (0700) and re-verifies; `newSeatDir` mkdtemp's a seat inside it.
 */
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";

export const BROKER_SUBPATH = ".local/state/lares-broker/seats";
export const DEFAULT_MAX_GB = 10;

/** The broker root path: the controller's env, else the fixed default under the real home. */
export function brokerRootPath(realHome, env = process.env) {
  return env.LARES_BROKER_ROOT ? path.resolve(env.LARES_BROKER_ROOT) : path.join(realHome, BROKER_SUBPATH);
}

const uid = () => (typeof process.getuid === "function" ? process.getuid() : 0);

/** Throws a named Error unless the existing part of `root` is sound; returns `{ root, missing }` (the components still to make). */
export function checkBrokerRoot(root, { realHome, guarded = [] }) {
  const home = realpathSync(realHome);
  const scratch = path.join(home, ".lares-scratch");
  const within = (parent, child) => child === parent || child.startsWith(`${parent}${path.sep}`);
  if (!within(home, root)) throw new Error(`the broker root ${root} must sit under the real home ${home}`);
  if (within(scratch, root)) throw new Error(`the broker root ${root} must sit outside ${scratch} entirely (a lead can write anywhere a lane lives under it)`);
  for (const g of guarded) if (within(g, root) || within(root, g)) throw new Error(`the broker root ${root} must sit outside ${g}`);
  const parts = path.relative(home, root).split(path.sep).filter(Boolean);
  let cursor = home, missing = [];
  for (let i = 0; i < parts.length; i++) {
    const next = path.join(cursor, parts[i]);
    let st;
    try { st = lstatSync(next); } catch (error) { if (error.code === "ENOENT") { missing = parts.slice(i); break; } throw error; }
    if (st.isSymbolicLink() || !st.isDirectory()) throw new Error(`${next} is not a real directory (a symlink or file stands in the broker root's path)`);
    if (st.uid !== uid()) throw new Error(`${next} is not owned by this user`);
    const last = i === parts.length - 1;
    if (last && (st.mode & 0o777) !== 0o700) throw new Error(`the broker root ${next} must be mode 0700 (it reads ${(st.mode & 0o777).toString(8)})`);
    if (!last && (st.mode & 0o022) !== 0) throw new Error(`${next} is group- or world-writable above the broker root`);
    cursor = next;
  }
  return { root, missing };
}

/** Makes the missing components (0700) and re-verifies the whole path. */
export function ensureBrokerRoot(root, opts) {
  const { missing } = checkBrokerRoot(root, opts);
  let cursor = missing.length ? root.split(path.sep).slice(0, root.split(path.sep).length - missing.length).join(path.sep) || path.sep : root;
  for (const part of missing) { cursor = path.join(cursor, part); mkdirSync(cursor, { mode: 0o700 }); } // broker-owned
  checkBrokerRoot(root, opts);
  return root;
}

/** Total bytes under the root (a walk, no symlink followed). */
export function brokerRootBytes(root) {
  let total = 0;
  const walk = (dir) => {
    let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      try { const st = lstatSync(p); if (e.isDirectory()) walk(p); else total += st.size; } catch { /* gone mid-walk */ }
    }
  };
  walk(root);
  return total;
}

/** Refuses (by name) while the root holds more than `maxGb` gigabytes. */
export function checkBrokerRootSize(root, maxGb = Number(process.env.LARES_BROKER_MAX_GB) || DEFAULT_MAX_GB) {
  const bytes = brokerRootBytes(root);
  if (bytes > maxGb * 1024 ** 3) throw new Error(`the broker root ${root} holds ${(bytes / 1024 ** 3).toFixed(2)} GB, over the ${maxGb} GB bound; remove finished seat dirs first`);
}

/** A fresh seat directory (mkdtemp, 0700) inside a verified root. */
export function newSeatDir(root) {
  return mkdtempSync(path.join(root, "seat-")); // broker-owned
}
