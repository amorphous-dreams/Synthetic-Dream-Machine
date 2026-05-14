import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Package root for @lararium/tw5. */
export const ROOT = path.resolve(__dirname, "..");
export const SRC_DIR = path.join(ROOT, "src");

export const TIDDLERS_DIR = "tiddlers";
export const TIDDLER_SRC_DIR = "tiddlers/src";
export const MODULE_MANIFEST = "dist-plugin/module-manifest.json";
export const SOURCE_MANIFEST = "dist-plugin/plugin-source-manifest.json";

export function packagePath(...parts: string[]): string {
  return path.join(ROOT, ...parts);
}

export function packageRelative(absPath: string): string {
  return path.relative(ROOT, absPath);
}
