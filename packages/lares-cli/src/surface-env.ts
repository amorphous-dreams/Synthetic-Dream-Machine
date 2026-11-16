/**
 * surface-env — the operator's container surface as the host reads it: the env file the shim and the bridge both read, the
 * value one name carries there, and the image's own marker.
 */
import { join } from "node:path";

/** The image's own marker: set in the Dockerfile, so a vessel never forwards to itself. */
export const IN_CONTAINER_ENV = "LARES_IN_CONTAINER";

/** The operator's container env file, or null while HOME names no home. */
export function surfaceEnvPath(env: Readonly<Record<string, string | undefined>>): string | null {
  const home = env["HOME"]?.trim();
  return home ? join(home, ".lares", "lares-surface.env") : null;
}

/** The value one name carries: the environment first, else the env file's last plain KEY=VALUE line (as the shim reads). */
export function envValue(name: string, env: Readonly<Record<string, string | undefined>>, envFileText: string | null): string {
  const set = env[name]?.trim();
  if (set) return set;
  let last = "";
  for (const line of (envFileText ?? "").split("\n")) {
    const m = new RegExp(`^\\s*${name}=(.*)$`).exec(line);
    if (m) last = m[1]!.trim();
  }
  return last;
}
