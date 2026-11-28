/**
 * keep-config — the keep workspace the house config names: the one bound workspace the unlock, the wake and `down` keep into.
 *
 * `LARES_KEEP_WORKSPACE=<name>` names it (the environment first, else the operator's surface env file, as the shim reads both);
 * with no name set, the one pair LARES_WORKSPACES binds names it. Several pairs and no name read none, and so does a name
 * outside the workspace grammar: nothing guesses which clone holds the operator's repo.
 *
 * `LARES_KEEP_SESSIONS` (the same two places) switches the device's Claude Code sessions off a keep: `0`, `off`, `false` or `no`
 * keeps the house alone, and so does the line's `sessions=false`. Unset, a keep carries the sessions (`./keep-sessions.ts`).
 *
 * The wake hook reads the same rule in plain JavaScript (`.claude-plugin/hooks/lares-wake-core.mjs#keepWorkspaceOf`); a change
 * here changes there.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { readFileSync } from "node:fs";
import { WORKSPACE_NAME_RE } from "@lararium/mesh/workbench";
import { envValue, surfaceEnvPath } from "./surface-env.js";

export const KEEP_WORKSPACE_ENV = "LARES_KEEP_WORKSPACE";

const named = (name: string): string | null => (WORKSPACE_NAME_RE.test(name) && name !== "." && name !== ".." ? name : null);

/** The keep workspace's name, or null where the config names none. */
export function keepWorkspaceName(env: Readonly<Record<string, string | undefined>>, envFileText: string | null): string | null {
  const set = envValue(KEEP_WORKSPACE_ENV, env, envFileText);
  if (set !== "") return named(set);
  const pairs = envValue("LARES_WORKSPACES", env, envFileText).split(";").map((p) => p.trim()).filter((p) => p.indexOf("=") > 0);
  return pairs.length === 1 ? named(pairs[0]!.slice(0, pairs[0]!.indexOf("=")).trim()) : null;
}

/** The keep workspace this process's config names: its environment, then the operator's surface env file. */
export function configuredKeepWorkspace(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  const file = surfaceEnvPath(env);
  let text: string | null = null;
  try { text = file === null ? null : readFileSync(file, "utf8"); } catch { text = null; }
  return keepWorkspaceName(env, text);
}

export const KEEP_SESSIONS_ENV = "LARES_KEEP_SESSIONS";
const OFF: ReadonlySet<string> = new Set(["0", "off", "false", "no"]);

/** Whether a keep carries the device's sessions: the line's flag first, then LARES_KEEP_SESSIONS, and on where neither speaks. */
export function keepSessionsOn(flag: boolean | undefined, env: Readonly<Record<string, string | undefined>>, envFileText: string | null): boolean {
  return flag ?? !OFF.has(envValue(KEEP_SESSIONS_ENV, env, envFileText).toLowerCase());
}

/** The sessions switch this process's config names: its environment, then the operator's surface env file. */
export function configuredKeepSessions(flag?: boolean, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  if (flag !== undefined) return flag;
  const file = surfaceEnvPath(env);
  let text: string | null = null;
  try { text = file === null ? null : readFileSync(file, "utf8"); } catch { text = null; }
  return keepSessionsOn(undefined, env, text);
}
