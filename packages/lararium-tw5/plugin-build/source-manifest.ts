import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { MODULE_MANIFEST, packagePath, packageRelative, TIDDLERS_DIR } from "./paths.js";
import { type ModuleManifest, sha256 } from "./module-manifest.js";

export const SOURCE_MANIFEST_FORMAT = "lararium-tw5-plugin-source-manifest/v1";

export interface SourceManifestFile {
  path: string;
  sha256: string;
}

export interface StaticTiddlerSource extends SourceManifestFile {
  title: string;
  type?: string;
  tags?: string;
}

export interface PluginSourceManifest {
  format: typeof SOURCE_MANIFEST_FORMAT;
  generatedBy: string;
  pluginInfo: SourceManifestFile & { title: string };
  staticTiddlers: StaticTiddlerSource[];
  moduleManifest: SourceManifestFile & { moduleCount: number };
}

function parseTidFields(text: string, filePath: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [idx, line] of text.split(/\r?\n/).entries()) {
    if (line.trim() === "") break;
    const match = /^([^:\s][^:]*):\s*(.*)$/.exec(line);
    if (!match) throw new Error(`[plugin-build] invalid .tid field line ${idx + 1} in ${filePath}: ${line}`);
    fields[match[1]!.trim()] = match[2]!.trim();
  }
  return fields;
}

export function buildPluginSourceManifest(
  moduleManifest: ModuleManifest,
  moduleManifestSha256: string,
): PluginSourceManifest {
  const tiddlersAbs = packagePath(TIDDLERS_DIR);
  const pluginInfoAbs = path.join(tiddlersAbs, "plugin.info");
  const pluginInfoPath = packageRelative(pluginInfoAbs);
  const pluginInfoText = readFileSync(pluginInfoAbs, "utf8");
  const pluginInfo = JSON.parse(pluginInfoText) as Record<string, unknown>;
  const pluginTitle = String(pluginInfo["title"] ?? "");
  if (!pluginTitle) throw new Error(`[plugin-build] plugin.info missing title: ${pluginInfoPath}`);

  const staticTiddlers: StaticTiddlerSource[] = [];
  for (const entry of readdirSync(tiddlersAbs, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".tid")) continue;
    const abs = path.join(tiddlersAbs, entry.name);
    const rel = packageRelative(abs);
    const text = readFileSync(abs, "utf8");
    const fields = parseTidFields(text, rel);
    const title = fields["title"];
    if (!title) throw new Error(`[plugin-build] static tiddler missing title: ${rel}`);
    staticTiddlers.push({
      path: rel,
      title,
      ...(fields["type"] ? { type: fields["type"] } : {}),
      ...(fields["tags"] ? { tags: fields["tags"] } : {}),
      sha256: sha256(text),
    });
  }
  staticTiddlers.sort((a, b) => a.path.localeCompare(b.path));

  return {
    format: SOURCE_MANIFEST_FORMAT,
    generatedBy: "packages/lararium-tw5/scripts/build-plugin-tiddler.ts",
    pluginInfo: {
      path: pluginInfoPath,
      title: pluginTitle,
      sha256: sha256(pluginInfoText),
    },
    staticTiddlers,
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
    for (const key of ["path", "title", "sha256"] as const) {
      if (!t[key]) throw new Error(`[plugin-build] ${label} staticTiddlers[${idx}] missing ${key}`);
    }
    if (!/^[a-f0-9]{64}$/.test(t.sha256)) {
      throw new Error(`[plugin-build] ${label} staticTiddlers[${idx}] has invalid sha256: ${t.sha256}`);
    }
  }
  if (!manifest.moduleManifest?.path || !manifest.moduleManifest.sha256 || typeof manifest.moduleManifest.moduleCount !== "number") {
    throw new Error(`[plugin-build] ${label} missing moduleManifest claim`);
  }
}
