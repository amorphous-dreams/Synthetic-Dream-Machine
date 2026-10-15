import { sha256 } from "./module-manifest.js";
import { type PluginSourceManifest } from "./source-manifest.js";

export function verifyPluginInfoTitle(manifest: PluginSourceManifest, expectedTitle: string): void {
  if (manifest.pluginInfo.title !== expectedTitle) {
    throw new Error(
      `[plugin-build] plugin.info title mismatch: expected ${expectedTitle}, got ${manifest.pluginInfo.title}`,
    );
  }
}

export function verifyPackedStaticTiddlers(
  manifest: PluginSourceManifest,
  packedTiddlers: Record<string, Record<string, unknown>>,
): void {
  const failures: string[] = [];

  for (const t of manifest.staticTiddlers) {
    const packed = packedTiddlers[t.title];
    if (!packed) {
      failures.push(`missing static tiddler "${t.title}" (source: ${t.path})`);
      continue;
    }

    if (t.type !== undefined) {
      const packedType = String(packed["type"] ?? "");
      if (packedType !== t.type) {
        failures.push(`"${t.title}": type field drift — source: "${t.type}", packed: "${packedType}"`);
      }
    }

    if (t.tags !== undefined) {
      const packedTags = String(packed["tags"] ?? "");
      if (packedTags !== t.tags) {
        failures.push(`"${t.title}": tags field drift — source: "${t.tags}", packed: "${packedTags}"`);
      }
    }

    const packedText = String(packed["text"] ?? "");
    const packedBodySha = sha256(packedText);
    if (packedBodySha !== t.bodySha256) {
      failures.push(
        `"${t.title}": body digest mismatch\n` +
        `    source bodySha256: ${t.bodySha256.slice(0, 16)}…\n` +
        `    packed bodySha256: ${packedBodySha.slice(0, 16)}…`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(`[plugin-build] packed plugin failed source-manifest verification:\n  ${failures.join("\n  ")}`);
  }
}
