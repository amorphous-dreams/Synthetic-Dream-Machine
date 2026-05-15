import { mkdirSync, readFileSync, rmSync } from "fs";
import path from "path";
import { build } from "vite";
import { discoverModules } from "./discover-modules.js";
import { MODULE_MANIFEST, packagePath, packageRelative, ROOT, TIDDLER_SRC_DIR } from "./paths.js";
import { MODULE_MANIFEST_FORMAT, type ModuleManifestEntry, sha256, writeModuleManifest } from "./module-manifest.js";

export async function buildPluginCjsTiddlers(outDir = TIDDLER_SRC_DIR): Promise<void> {
  const outDirAbs = packagePath(outDir);
  rmSync(outDirAbs, { recursive: true, force: true });
  mkdirSync(outDirAbs, { recursive: true });

  const modules = discoverModules();
  const manifest: ModuleManifestEntry[] = [];

  for (const mod of modules) {
    await build({
      configFile: false,
      logLevel: "warn",
      build: {
        lib: {
          entry: mod.absPath,
          formats: ["cjs"],
          fileName: () => `${mod.name}.js`,
        },
        outDir: outDirAbs,
        emptyOutDir: false,
        sourcemap: false,
        minify: false,
        rollupOptions: {
          external: (id) => id.startsWith("$:/") || id === "tiddlywiki" || id.startsWith("tiddlywiki/"),
          output: {
            banner: mod.banner,
            esModule: false,
            exports: "named",
          },
        },
      },
      resolve: {
        alias: {
          "@lararium/core/meme-ast": path.resolve(ROOT, "../lararium-core/src/meme-ast/index.ts"),
          "@lararium/core": path.resolve(ROOT, "../lararium-core/src/index.ts"),
        },
      },
    });

    const outputPath = path.join(outDirAbs, `${mod.name}.js`);
    const outputText = readFileSync(outputPath, "utf8");
    manifest.push({
      title: mod.fields["title"]!,
      moduleType: mod.fields["module-type"]!,
      sourcePath: mod.sourcePath,
      outputPath: packageRelative(outputPath),
      sha256: sha256(outputText),
    });
    console.log(`[plugin-build] ${outDir}/${mod.name}.js`);
  }

  const manifestPath = packagePath(MODULE_MANIFEST);
  writeModuleManifest(manifestPath, {
    format: MODULE_MANIFEST_FORMAT,
    generatedBy: "packages/lararium-tw5/vite.plugin.config.ts",
    outDir,
    modules: manifest,
  });
  console.log(`✓ Vite emitted ${modules.length} plugin module bundles to ${outDir}/`);
  console.log(`✓ Vite wrote ${packageRelative(manifestPath)}`);
}
