import { sha256HexSync } from "@lararium/core";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export const MODULE_MANIFEST_FORMAT = "lararium-tw5-module-manifest/v1";

export interface ModuleManifestEntry {
  title: string;
  moduleType: string;
  sourcePath: string;
  outputPath: string;
  sha256: string;
}

export interface ModuleManifest {
  format: typeof MODULE_MANIFEST_FORMAT;
  generatedBy: string;
  outDir: string;
  modules: ModuleManifestEntry[];
}

export { sha256HexSync as sha256 } from "@lararium/core";

export function writeModuleManifest(pathname: string, manifest: ModuleManifest): void {
  verifyModuleManifest(manifest, pathname);
  mkdirSync(path.dirname(pathname), { recursive: true });
  writeFileSync(pathname, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

export function readModuleManifest(pathname: string): { manifest: ModuleManifest; text: string; sha256: string } {
  const text = readFileSync(pathname, "utf8");
  const manifest = JSON.parse(text) as ModuleManifest;
  verifyModuleManifest(manifest, pathname);
  return { manifest, text, sha256: sha256HexSync(text) };
}

export function verifyModuleManifest(manifest: ModuleManifest, label = "module manifest"): void {
  if (manifest.format !== MODULE_MANIFEST_FORMAT) {
    throw new Error(`[plugin-build] ${label} has unsupported format: ${String(manifest.format)}`);
  }
  if (!Array.isArray(manifest.modules)) {
    throw new Error(`[plugin-build] ${label} missing modules[]`);
  }
  for (const [idx, mod] of manifest.modules.entries()) {
    for (const key of ["title", "moduleType", "sourcePath", "outputPath", "sha256"] as const) {
      if (!mod[key]) throw new Error(`[plugin-build] ${label} modules[${idx}] missing ${key}`);
    }
    if (!/^[a-f0-9]{64}$/.test(mod.sha256)) {
      throw new Error(`[plugin-build] ${label} modules[${idx}] has invalid sha256: ${mod.sha256}`);
    }
  }
}
