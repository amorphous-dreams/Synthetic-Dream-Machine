import { defineConfig, type Plugin, type Connect } from "vite";
import wasm from "vite-plugin-wasm";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";

const GENESIS_DIR = resolve(import.meta.dirname, "../../genesis");
const PRONAOS_RECORD = resolve(import.meta.dirname, "../../.pronaos-build/pronaos-artifact.json");

/**
 * Serve `genesis/` at `/genesis` in the DEV and PREVIEW servers alone.
 *
 * The page reads `seed.json` and the CAS blobs off `/genesis` at runtime. A built page stands behind a hearth's Pronaos,
 * which serves both off the genesis root that hearth boots, so the build carries no genesis copy
 * (`tools/genesis-parity-witness.sh` reads one RED). The dev and preview servers hold no hearth, so they route the tree's own genesis.
 * `server.fs.allow` grants vite permission to READ a path and creates no route: without this middleware a request falls
 * through to the SPA fallback and the vessel receives `index.html` where a CAS blob belongs.
 *
 * Blobs carry content addresses, so they stay immutable and cacheable forever; `seed.json` answers no-store.
 */
function serveGenesisInDev(): Plugin {
  const route: Connect.NextHandleFunction = (req, res, next) => {
    const rel = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/")).replace(/^(\.\.[/\\])+/, "");
    const file = join(GENESIS_DIR, rel);
    if (!file.startsWith(GENESIS_DIR) || !existsSync(file) || !statSync(file).isFile()) return next();
    const seedFile = rel.replace(/^[/\\]+/, "") === "seed.json";
    res.setHeader("Content-Type", seedFile ? "application/json" : "application/octet-stream");
    res.setHeader("Cache-Control", seedFile ? "no-store" : "public, max-age=31536000, immutable");
    createReadStream(file).pipe(res);
  };
  return {
    name: "lararium:serve-genesis-dev",
    apply: "serve",
    configureServer(server) { server.middlewares.use("/genesis", route); },
    // `vite preview` serves the built page with no hearth behind it, so it routes the tree's own genesis the same way;
    // the dist still carries no copy.
    configurePreviewServer(server) { server.middlewares.use("/genesis", route); },
  };
}

/**
 * Hold the final Vite output as one explicit handoff receipt. The receipt is
 * outside dist: it is an operator input to Node, never a public Web route.
 */
function emitPronaosArtifactRecord(): Plugin {
  const routes: Array<{ path: string; file: string; contentType: string; cache: "immutable" | "no-store"; sha256: string }> = [];
  const digest = (source: string | Uint8Array): string => createHash("sha256").update(source).digest("hex");
  return {
    name: "lararium:pronaos-artifact-record",
    apply: "build",
    generateBundle(_options, bundle) {
      routes.length = 0;
      for (const output of Object.values(bundle)) {
        const file = output.fileName;
        if (!/^assets\/.+\.(?:m?js|css|wasm)$/.test(file)) continue;
        const contentType = file.endsWith(".css") ? "text/css" : file.endsWith(".wasm") ? "application/wasm" : "application/javascript";
        // The digest reads the bytes on disk at close: Vite's import analysis rewrites a chunk that holds a dynamic import after this hook.
        routes.push({ path: `/${file}`, file, contentType, cache: "immutable", sha256: "" });
      }
    },
    closeBundle() {
      // Vite writes the HTML/public copy after generateBundle; these are the
      // two known non-Rollup files, never a directory enumeration.
      for (const route of routes) if (route.sha256 === "") route.sha256 = digest(readFileSync(resolve(import.meta.dirname, "dist", route.file)));
      const index = resolve(import.meta.dirname, "dist/index.html");
      if (existsSync(index)) routes.push({ path: "/", file: "index.html", contentType: "text/html; charset=utf-8", cache: "no-store", sha256: digest(readFileSync(index)) });
      const manifest = resolve(import.meta.dirname, "dist/manifest.webmanifest");
      if (existsSync(manifest)) {
        const source = readFileSync(manifest);
        routes.push({ path: "/manifest.webmanifest", file: "manifest.webmanifest", contentType: "application/manifest+json", cache: "no-store", sha256: digest(source) });
      }
      routes.sort((a, b) => a.path.localeCompare(b.path));
      mkdirSync(resolve(import.meta.dirname, "../../.pronaos-build"), { recursive: true });
      writeFileSync(PRONAOS_RECORD, `${JSON.stringify({ schema: "lararium-pronaos-artifact/v1", routes }, null, 2)}\n`);
    },
  };
}

// Web-surface capabilities — Automerge WASM + module Web Workers.
// Config follows the Automerge "Vite" recipe (research-grounded 2026-06-25):
//   - wasm()        : @automerge/automerge ships its core as .wasm
// The genesis boot artifact, seed.json, reaches the page at runtime off `/genesis` (the hearth's Pronaos, or the dev route).
// automerge-wasm's top-level-await is handled by the esnext target (build + dev),
// so vite-plugin-top-level-await is NOT needed (and dropping it removes the @swc/core
// native build that snagged pnpm's pre-run deps-check).
export default defineConfig({
  define: { __LAR_WALK_DOOR__: JSON.stringify(process.env["LAR_WALK_DOOR"] === "1") },
  plugins: [wasm(), serveGenesisInDev(), emitPronaosArtifactRecord()],

  // The worker is a SEPARATE rollup build — top-level plugins do NOT inherit, so wasm()
  // must be repeated for the worker to instantiate automerge's wasm. format "es" is
  // mandatory: module workers (new Worker(url,{type:"module"})) only bundle under ES.
  worker: {
    format: "es",
    plugins: () => [wasm()],
  },

  optimizeDeps: {
    // MANDATORY: esbuild pre-bundling would emit a SECOND copy of the automerge-wasm
    // JS wrapper, double-initializing its module-level heap tracker (dev-only heap
    // corruption). Excluding it keeps a single wrapper instance.
    exclude: ["@automerge/automerge-wasm"],
    // Let the dev pre-bundler accept top-level-await (matches build.target).
    esbuildOptions: { target: "esnext" },
  },

  // assetsInlineLimit:0 — the admin/wiki worker shims are referenced by `new URL(...,
  // import.meta.url)` passed indirectly to openBrowserVessel; small, Vite would INLINE them
  // as `data:` URIs, where dynamic `import()` (keyhive-WASM-first, the chain) cannot resolve
  // (no base URL). Forcing a file asset keeps the worker's dynamic imports resolvable.
  build: { target: "esnext", assetsInlineLimit: 0 },

  server: {
    host: true,        // also bind LAN — the home / intranet serving topology
    port: 5173,
    // The dev route reads genesis/ at the repo root (outside this package); allow it.
    fs: { allow: [".", "../..", "../../genesis"] },
  },
});
