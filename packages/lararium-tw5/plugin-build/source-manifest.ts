import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { MODULE_MANIFEST } from "./paths.js";
import { type ModuleManifest, sha256 } from "./module-manifest.js";
import { witnessPluginInfo, witnessStaticTiddlers } from "./source-witness.js";

export const SOURCE_MANIFEST_FORMAT = "lararium-tw5-plugin-source-manifest/v2";

export interface SourceManifestFile {
  path: string;
  sha256: string;
}

export interface StaticTiddlerSource extends SourceManifestFile {
  title: string;
  type?: string;
  tags?: string;
  /** SHA-256 of the tiddler body text (content after the first blank line). Empty string when no body. */
  bodySha256: string;
}

export interface PluginSourceManifest {
  format: typeof SOURCE_MANIFEST_FORMAT;
  generatedBy: string;
  pluginInfo: SourceManifestFile & { title: string };
  staticTiddlers: StaticTiddlerSource[];
  moduleManifest: SourceManifestFile & { moduleCount: number };
}

export function buildPluginSourceManifest(
  moduleManifest: ModuleManifest,
  moduleManifestSha256: string,
): PluginSourceManifest {
  return {
    format: SOURCE_MANIFEST_FORMAT,
    generatedBy: "packages/lararium-tw5/scripts/build-plugin-tiddler.ts",
    pluginInfo: witnessPluginInfo(),
    staticTiddlers: witnessStaticTiddlers(),
    moduleManifest: {
      path: MODULE_MANIFEST,
      sha256: moduleManifestSha256,
      moduleCount: moduleManifest.modules.length,
    },
  };
}

export function writePluginSourceManifest(pathname: string, manifest: PluginSourceManifest): void {
  verifyPluginSourceManifest(manifest, pathname);
  mkdirSync(path.dirname(pathname), { recursive: true });
  writeFileSync(pathname, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

export function readPluginSourceManifest(pathname: string): { manifest: PluginSourceManifest; text: string; sha256: string } {
  const text = readFileSync(pathname, "utf8");
  const manifest = JSON.parse(text) as PluginSourceManifest;
  verifyPluginSourceManifest(manifest, pathname);
  return { manifest, text, sha256: sha256(text) };
}

export function verifyPluginSourceManifest(manifest: PluginSourceManifest, label = "plugin source manifest"): void {
  if (manifest.format !== SOURCE_MANIFEST_FORMAT) {
    throw new Error(`[plugin-build] ${label} has unsupported format: ${String(manifest.format)}`);
  }
  if (!manifest.pluginInfo?.path || !manifest.pluginInfo.title || !manifest.pluginInfo.sha256) {
    throw new Error(`[plugin-build] ${label} missing pluginInfo claim`);
  }
  if (!Array.isArray(manifest.staticTiddlers)) {
    throw new Error(`[plugin-build] ${label} missing staticTiddlers[]`);
  }
  for (const [idx, t] of manifest.staticTiddlers.entries()) {
    for (const key of ["path", "title", "sha256", "bodySha256"] as const) {
      if (t[key] === undefined || t[key] === null) throw new Error(`[plugin-build] ${label} staticTiddlers[${idx}] missing ${key}`);
    }
    if (!/^[a-f0-9]{64}$/.test(t.sha256)) {
      throw new Error(`[plugin-build] ${label} staticTiddlers[${idx}] has invalid sha256: ${t.sha256}`);
    }
    if (!/^[a-f0-9]{64}$/.test(t.bodySha256)) {
      throw new Error(`[plugin-build] ${label} staticTiddlers[${idx}] has invalid bodySha256: ${t.bodySha256}`);
    }
  }
  if (!manifest.moduleManifest?.path || !manifest.moduleManifest.sha256 || typeof manifest.moduleManifest.moduleCount !== "number") {
    throw new Error(`[plugin-build] ${label} missing moduleManifest claim`);
  }
}
