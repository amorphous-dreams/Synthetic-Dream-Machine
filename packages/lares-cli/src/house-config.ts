/**
 * THE HOUSE'S OWN CONFIG SIGNALS, read the way the host shim (`tools/lares-container.sh`) reads them, so a verb and the shim
 * never disagree about how the house stands.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SURFACE_ENV } from "./mcp-resolve.js";

/** The surface env file the shim reads (`$HOME/.lares/lares-surface.env`), whether or not it stands. */
function surfaceEnvPath(): string {
  return join(homedir(), ".lares", SURFACE_ENV);
}

/**
 * The value one name carries, exactly as the shim's `value_of` reads it: the environment first (an empty value counts as
 * none), else the surface env file's LAST line that reads `<spaces>NAME=…`, its rest taken verbatim (no unquoting, no
 * trim; a comment or an `export ` prefix never matches). Empty when neither names it.
 */
export function surfaceEnvValue(name: string): string {
  const env = process.env[name] ?? "";
  if (env !== "") return env;
  const file = surfaceEnvPath();
  if (!existsSync(file)) return "";
  // sed's [[:space:]] class; the rest of the line rides whole, a carriage return included (JS `.` would stop at one).
  const line = new RegExp(`^[ \\t\\r\\v\\f]*${name}=([^\\n]*)$`);
  let value = "";
  for (const text of readFileSync(file, "utf8").split("\n")) {
    const m = line.exec(text);
    if (m !== null) value = m[1]!;
  }
  return value;
}

/**
 * Does a pūlama keep this house's custody? Inside the vessel, compose sets `LAR_PULAMA_SOCKET` (empty when no pūlama
 * stands); on the host, the shim stands one when `LARES_PULAMA` reads `1`.
 */
export function pulamaStands(): boolean {
  return (process.env["LAR_PULAMA_SOCKET"] ?? "") !== "" || surfaceEnvValue("LARES_PULAMA") === "1";
}
