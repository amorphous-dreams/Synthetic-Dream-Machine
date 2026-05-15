import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  readPluginSourceManifest,
  type PluginSourceManifest,
} from "../plugin-build/source-manifest.js";
import {
  verifyPackedStaticTiddlers,
  verifyPluginInfoTitle,
} from "../plugin-build/verify-packed-plugin.js";
import { parseTidFile } from "../plugin-build/tid-file.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE_MANIFEST = path.join(ROOT, "dist-plugin", "plugin-source-manifest.json");
const CANONICAL_TITLE = "lar:///plugins/lares/memetic-wikitext";

function assertThrows(label: string, fn: () => void, pattern: RegExp): void {
  try {
    fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!pattern.test(msg)) {
      throw new Error(`${label}: wrong failure message\nexpected: ${pattern}\nactual: ${msg}`);
    }
    return;
  }
  throw new Error(`${label}: expected failure, but verifier passed`);
}

function cloneManifest(manifest: PluginSourceManifest): PluginSourceManifest {
  return JSON.parse(JSON.stringify(manifest)) as PluginSourceManifest;
}

const { manifest } = readPluginSourceManifest(SOURCE_MANIFEST);
verifyPluginInfoTitle(manifest, CANONICAL_TITLE);

const packed: Record<string, Record<string, unknown>> = {};
for (const t of manifest.staticTiddlers) {
  const text = readFileSync(path.join(ROOT, t.path), "utf8");
  const parsed = parseTidFile(text, t.path);
  packed[t.title] = { ...parsed.fields, text: parsed.body };
}

verifyPackedStaticTiddlers(manifest, packed);

const first = manifest.staticTiddlers[0];
if (!first) throw new Error("source manifest carried no static tiddlers");
const withType = manifest.staticTiddlers.find((t) => t.type !== undefined);
const withTags = manifest.staticTiddlers.find((t) => t.tags !== undefined);

const missingPacked = { ...packed };
delete missingPacked[first.title];
assertThrows(
  "missing static tiddler",
  () => verifyPackedStaticTiddlers(manifest, missingPacked),
  /missing static tiddler/,
);

const bodyDriftPacked = { ...packed, [first.title]: { ...packed[first.title], text: `${String(packed[first.title]?.["text"] ?? "")}\nDRIFT` } };
assertThrows(
  "static body drift",
  () => verifyPackedStaticTiddlers(manifest, bodyDriftPacked),
  /body digest mismatch/,
);

if (withType) {
  const typeDriftPacked = { ...packed, [withType.title]: { ...packed[withType.title], type: "text/plain" } };
  assertThrows(
    "static type drift",
    () => verifyPackedStaticTiddlers(manifest, typeDriftPacked),
    /type field drift/,
  );
}

if (withTags) {
  const tagDriftPacked = { ...packed, [withTags.title]: { ...packed[withTags.title], tags: "drift" } };
  assertThrows(
    "static tags drift",
    () => verifyPackedStaticTiddlers(manifest, tagDriftPacked),
    /tags field drift/,
  );
}

const titleDrift = cloneManifest(manifest);
titleDrift.pluginInfo.title = "lar:///plugins/lares/not-this";
assertThrows(
  "plugin.info title drift",
  () => verifyPluginInfoTitle(titleDrift, CANONICAL_TITLE),
  /plugin\.info title mismatch/,
);

console.log("✓ plugin provenance smoke clean");
console.log(`  ${manifest.staticTiddlers.length} static tiddler claims verified`);
console.log("  negative checks: missing static, body drift, type drift, tags drift, title drift");
