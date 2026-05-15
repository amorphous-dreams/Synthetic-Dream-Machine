import { readdirSync, readFileSync } from "fs";
import path from "path";
import { packagePath, packageRelative, TIDDLERS_DIR } from "./paths.js";
import { sha256 } from "./module-manifest.js";
import { parseTidFile } from "./tid-file.js";
import { type SourceManifestFile, type StaticTiddlerSource } from "./source-manifest.js";

export type PluginInfoSource = SourceManifestFile & { title: string };

export function witnessPluginInfo(): PluginInfoSource {
  const tiddlersAbs = packagePath(TIDDLERS_DIR);
  const pluginInfoAbs = path.join(tiddlersAbs, "plugin.info");
  const pluginInfoPath = packageRelative(pluginInfoAbs);
  const pluginInfoText = readFileSync(pluginInfoAbs, "utf8");
  const pluginInfo = JSON.parse(pluginInfoText) as Record<string, unknown>;
  const pluginTitle = String(pluginInfo["title"] ?? "");
  if (!pluginTitle) throw new Error(`[plugin-build] plugin.info missing title: ${pluginInfoPath}`);

  return {
    path: pluginInfoPath,
    title: pluginTitle,
    sha256: sha256(pluginInfoText),
  };
}

export function witnessStaticTiddlers(): StaticTiddlerSource[] {
  const tiddlersAbs = packagePath(TIDDLERS_DIR);
  const staticTiddlers: StaticTiddlerSource[] = [];

  for (const entry of readdirSync(tiddlersAbs, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".tid")) continue;
    const abs = path.join(tiddlersAbs, entry.name);
    const rel = packageRelative(abs);
    const text = readFileSync(abs, "utf8");
    const { fields, body } = parseTidFile(text, rel);
    const title = fields["title"];
    if (!title) throw new Error(`[plugin-build] static tiddler missing title: ${rel}`);
    staticTiddlers.push({
      path: rel,
      title,
      ...(fields["type"] ? { type: fields["type"] } : {}),
      ...(fields["tags"] ? { tags: fields["tags"] } : {}),
      sha256: sha256(text),
      bodySha256: sha256(body),
    });
  }

  staticTiddlers.sort((a, b) => a.path.localeCompare(b.path));
  return staticTiddlers;
}
