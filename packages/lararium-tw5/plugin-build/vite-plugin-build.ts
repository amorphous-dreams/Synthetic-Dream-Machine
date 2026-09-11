import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
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
          external: (id) => {
            if (id.startsWith("$:/") || id === "tiddlywiki" || id.startsWith("tiddlywiki/")) return true;
            // smol-toml ships as its own library tiddler; externalize in all modules except
            // the lib-smol-toml bundle itself (which must inline it).
            if (id === "smol-toml" && mod.name !== "smol-toml") return true;
            // wiki-sense-fold ships ONCE as its own library tiddler; every other module requires
            // it by URI (the smol-toml precedent) — only the fold bundle inlines its own body.
            // The alias below rewrites the relative import to this BARE id first (a bare external
            // emits the paths mapping verbatim; a relative external gets re-relativized by rollup).
            if (id === "lararium-wiki-sense-fold") return true;
            // meme-ast ships ONCE as its own library tiddler (modules/meme-ast) — the same trio:
            // every consumer module requires it by URI instead of inlining its own copy.
            if (id === "lararium-meme-ast") return true;
            // place-meme ships ONCE as its own library tiddler; the route skins require it by URI.
            if (id === "lararium-place-meme") return true;
            // meme-laws carries every pure law over meme text ONCE; the deserializer, the placement,
            // the projections and the face require it by URI.
            if (id === "lararium-meme-laws") return true;
            // meme-markdown ships ONCE; the face and the projection filter require it by URI.
            if (id === "lararium-meme-markdown") return true;
            // meme-project ships ONCE; the face, the filter and the exporter require it by URI.
            if (id === "lararium-meme-project") return true;
            // the deserializer ships ONCE as its own module tiddler; the placement and the nalu engine
            // require it by URI instead of carrying the whole reader.
            if (id === "lararium-deserializer") return true;
            return false;
          },
          output: {
            esModule: false,
            exports: "named",
            generatedCode: { symbols: false },
            paths: (id: string) =>
              id === "lararium-wiki-sense-fold"
                ? "lar:///ha.ka.ba/lararium/tw5/lib/wiki-sense-fold"
                : id === "lararium-meme-ast"
                  ? "lar:///ha.ka.ba/lararium/tw5/modules/meme-ast"
                : id === "lararium-place-meme"
                  ? "lar:///ha.ka.ba/lararium/tw5/modules/place-meme"
                : id === "lararium-meme-laws"
                  ? "lar:///ha.ka.ba/lararium/tw5/modules/meme-laws"
                : id === "lararium-meme-markdown"
                  ? "lar:///ha.ka.ba/lararium/tw5/modules/meme-markdown"
                : id === "lararium-meme-project"
                  ? "lar:///ha.ka.ba/lararium/tw5/modules/meme-project"
                : id === "lararium-deserializer"
                  ? "lar:///ha.ka.ba/lararium/tw5/modules/deserializer"
                  : id === "smol-toml"
                    ? "lar:///ha.ka.ba/lararium/tw5/lib/smol-toml"
                    : id,
          },
        },
      },
      resolve: {
        alias: [
          // the shared wiki-sense fold rides as ONE library tiddler: rewrite the relative import
          // to a bare id (externalized + paths-mapped above) in every module EXCEPT the fold's own
          // bundle, which must inline its body.
          ...(mod.name !== "wiki-sense-fold"
            ? [{ find: /^(\.\.?\/)+wiki-sense-fold(\.js)?$/, replacement: "lararium-wiki-sense-fold" }]
            : []),
          // meme-ast rides the same law: its runtime submodules (index/parse/fence-mask/ahu-scan)
          // rewrite to ONE bare id in every module except meme-ast's own bundle — the five inlined
          // copies collapse to require() of the one library tiddler. (types.js stays type-only and
          // erases before resolution.)
          ...(mod.name !== "meme-ast"
            ? [{
                find: /^(\.\.?\/)+meme-ast\/(index|parse|fence-mask|ahu-scan)(\.js)?$/,
                replacement: "lararium-meme-ast",
              }]
            : []),
          // place-meme rides the same law: one library tiddler, required by URI from every skin.
          ...(mod.name !== "place-meme"
            ? [{ find: /^(\.\.?\/)+place-meme(\.js)?$/, replacement: "lararium-place-meme" }]
            : []),
          // meme-laws rides the same law: the seven law modules it re-exports rewrite to ONE bare id
          // in every module except the library's own bundle, which inlines them.
          ...(mod.name !== "meme-laws"
            ? [{
                find: /^(\.\.?\/)+(meme-laws|meme-normalize|block-check|carrier-check|carrier-shape|carrier-edges|carrier-head|frame-marks)(\.js)?$/,
                replacement: "lararium-meme-laws",
              }]
            : []),
          ...(mod.name !== "meme-markdown"
            ? [{ find: /^(\.\.?\/)+meme-markdown(\.js)?$/, replacement: "lararium-meme-markdown" }]
            : []),
          ...(mod.name !== "meme-project"
            ? [{ find: /^(\.\.?\/)+meme-project(\.js)?$/, replacement: "lararium-meme-project" }]
            : []),
          ...(mod.name !== "deserializer"
            ? [{ find: /^(\.\.?\/)+deserializer(\.js)?$/, replacement: "lararium-deserializer" }]
            : []),
          {
            find: /^@lararium\/mesh\/(.+)$/,
            replacement: `${path.resolve(ROOT, "../lararium-mesh/src")}/$1`,
          },
          {
            find: "@lararium/mesh",
            replacement: path.resolve(ROOT, "../lararium-mesh/src/index.ts"),
          },
        ],
      },
    });

    const outputPath = path.join(outDirAbs, `${mod.name}.js`);
    const raw = readFileSync(outputPath, "utf8");
    const outputText = mod.banner + raw;
    writeFileSync(outputPath, outputText, "utf8");
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
