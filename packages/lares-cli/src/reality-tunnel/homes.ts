/**
 * reality-tunnel/homes — every operator home one device carries.
 *
 * One device carries one operator. Under WSL that operator holds two homes, the Linux home and the
 * Windows profile, and a harness may store memory in either; a guard that keeps one leaves the other
 * to its host's defaults. So the home radius resolves both, and each row names the home it read.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

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

/** The Windows profile as a WSL path: `/mnt/c/Users/<name>` when it stands, else `%USERPROFILE%` through `wslpath`. */
function windowsProfile(native: string): string | null {
  const guess = join("/mnt/c/Users", basename(native));
  if (existsSync(guess)) return guess;
  const echo = spawnSync("cmd.exe", ["/c", "echo", "%USERPROFILE%"], { encoding: "utf8", timeout: 4000 });
  const win = String(echo.stdout ?? "").trim();
  if (echo.status === 0 && win && !win.includes("%")) {
    const conv = spawnSync("wslpath", ["-u", win], { encoding: "utf8", timeout: 2000 });
    const p = String(conv.stdout ?? "").trim();
    if (conv.status === 0 && p && existsSync(p)) return p;
  }
  return null;
}

export function resolveHomes(opts: { home?: string; windows?: string | null; env?: NodeJS.ProcessEnv } = {}): Homes {
  const native = opts.home ?? homedir();
  if (opts.windows !== undefined) return { native, windows: opts.windows };
  const env = opts.env ?? process.env;
  return { native, windows: process.platform === "linux" && onWsl(env) ? windowsProfile(native) : null };
}

/** Every home in the set, each with the name a row prints. */
export const homesOf = (h: Homes): Array<{ name: string; dir: string }> =>
  [{ name: "home", dir: h.native }, ...(h.windows ? [{ name: "windows", dir: h.windows }] : [])];
