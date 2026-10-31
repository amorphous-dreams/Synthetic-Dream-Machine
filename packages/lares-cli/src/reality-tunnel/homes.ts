/**
 * reality-tunnel/homes — every operator home one device carries.
 *
 * One device carries one operator. Under WSL that operator holds two homes, the Linux home and the
 * Windows profile, and a harness may store memory in either; a guard that keeps one leaves the other
 * to its host's defaults. So the home radius resolves both, and each row names the home it read.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Homes {
  /** The home this process runs under. */
  readonly native: string;
  /** The Windows profile a WSL distro shares the device with, or null off WSL. */
  readonly windows: string | null;
}

const onWsl = (env: NodeJS.ProcessEnv): boolean => {
  if (env["WSL_DISTRO_NAME"]) return true;
  try { return /microsoft/i.test(readFileSync("/proc/version", "utf8")); } catch { return false; }
};

/** Ask Windows for `%USERPROFILE%` and convert it to a WSL path; null when Windows does not answer. */
function askWindows(): string | null {
  const echo = spawnSync("cmd.exe", ["/c", "echo", "%USERPROFILE%"], { encoding: "utf8", timeout: 4000, cwd: "/mnt/c" });
  const win = String(echo.stdout ?? "").trim();
  if (echo.status !== 0 || !win || win.includes("%")) return null;
  const conv = spawnSync("wslpath", ["-u", win], { encoding: "utf8", timeout: 2000 });
  const p = String(conv.stdout ?? "").trim();
  return conv.status === 0 && p ? p : null;
}

/**
 * The Windows profile, as Windows itself names it. A guess from the Linux user name could name
 * another account's profile, so none stands: the answer comes from `%USERPROFILE%`, asked once and
 * kept in the home's state, and a profile Windows does not name reads as none.
 */
export function windowsProfile(native: string, opts: { state?: string; ask?: () => string | null; persist?: boolean } = {}): string | null {
  const state = opts.state ?? join(process.env["XDG_STATE_HOME"]?.trim() || join(native, ".local", "state"), "lares", "reality-tunnel");
  const cache = join(state, "windows-profile");
  try {
    const held = readFileSync(cache, "utf8").trim();
    if (held && existsSync(held)) return held;
  } catch { /* not asked yet */ }
  const p = (opts.ask ?? askWindows)();
  if (!p || !existsSync(p)) return null;
  // Observing writes nothing: only a tend keeps the answer.
  if (opts.persist) { try { mkdirSync(state, { recursive: true }); writeFileSync(cache, `${p}\n`); } catch { /* the answer stands; the cache is a convenience */ } }
  return p;
}

export function resolveHomes(opts: { home?: string; windows?: string | null; env?: NodeJS.ProcessEnv; persist?: boolean } = {}): Homes {
  const native = opts.home ?? homedir();
  if (opts.windows !== undefined) return { native, windows: opts.windows };
  const env = opts.env ?? process.env;
  return { native, windows: process.platform === "linux" && onWsl(env) ? windowsProfile(native, { persist: opts.persist === true }) : null };
}

/** Every home in the set, each with the name a row prints. */
export const homesOf = (h: Homes): Array<{ name: string; dir: string }> =>
  [{ name: "home", dir: h.native }, ...(h.windows ? [{ name: "windows", dir: h.windows }] : [])];
