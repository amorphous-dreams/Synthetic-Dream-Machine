/** The shared list of paths a push may change without raising a CI or held-out run (tools/ci-ignored-paths.json). */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const IGNORED_PATHS = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "ci-ignored-paths.json"), "utf8")).paths;

/** A GitHub Actions path glob as a RegExp: `*` stays inside a segment, `**` crosses segments, `**` + `/` may match no directory. */
export function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") { out += "(?:.*/)?"; i += 2; } else { out += ".*"; i += 1; }
    } else if (ch === "*") out += "[^/]*";
    else out += ch.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}
const MATCHERS = IGNORED_PATHS.map(globToRegExp);

export const isIgnoredPath = (path) => MATCHERS.some((re) => re.test(path));
/** True when the change names at least one path and every path is ignored; an empty change reads nothing ignored. */
export const onlyIgnoredPaths = (paths) => paths.length > 0 && paths.every(isIgnoredPath);
