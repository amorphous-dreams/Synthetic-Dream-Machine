import { defineConfig, type Plugin } from "vite";
import wasm from "vite-plugin-wasm";
import { createHash } from "node:crypto";
import { createReadStream, cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";

const GENESIS_DIR = resolve(import.meta.dirname, "../../genesis");
const PRONAOS_RECORD = resolve(import.meta.dirname, "../../.pronaos-build/pronaos-artifact.json");

/**
 * Serve `genesis/` at `/genesis` — in the dev server AND into the build.
 *
 * The seed rides in as a JSON import, so the bundler carries it. The CAS BLOBS do not:
 * the vessel FETCHES them at runtime from `/genesis/cas/<cid>`, and nothing routed that. `server.fs.allow`
 * grants vite permission to READ a path; it does not create a route. So the request fell through to the
 * SPA fallback and the vessel was handed `index.html` — 2.5 KB of HTML where 2.4 MB of TiddlyWiki core
 * belonged.
 *
 * The TW5 core-integrity gate caught it and faulted the island, which is exactly its job, and the leaf
 * then re-dialled the relay forever. The reconnect loop LOOKED like a transport fault; it was a 404
 * wearing an HTML page. Nothing in the suite saw it, because no test boots a full island against genesis.
 *
 * Blobs are content-addressed, so they are immutable by construction and cacheable forever.
 */
function serveGenesis(): Plugin {
  return {
    name: "lararium:serve-genesis",
    configureServer(server) {
      server.middlewares.use("/genesis", (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/")).replace(/^(\.\.[/\\])+/, "");
        const file = join(GENESIS_DIR, rel);
        // Path-escape guard: a `..` in the request must never reach outside the genesis dir.
        if (!file.startsWith(GENESIS_DIR) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      // The built vessel fetches the same paths, so the build must carry the same tree.
      if (existsSync(GENESIS_DIR)) cpSync(GENESIS_DIR, resolve(import.meta.dirname, "dist/genesis"), { recursive: true });
    },
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
    generateBundle(_options, bundle) {
      routes.length = 0;
      for (const output of Object.values(bundle)) {
        const file = output.fileName;
        const source = output.type === "asset" ? output.source : output.code;
        if (!/^assets\/.+\.(?:m?js|css|wasm)$/.test(file)) continue;
        const contentType = file.endsWith(".css") ? "text/css" : file.endsWith(".wasm") ? "application/wasm" : "application/javascript";
        routes.push({ path: `/${file}`, file, contentType, cache: "immutable", sha256: digest(source) });
      }
    },
    closeBundle() {
      // Vite writes the HTML/public copy after generateBundle; these are the
      // two known non-Rollup files, never a directory enumeration.
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

// Web-surface capabilities — Automerge WASM + module Web Workers + the genesis seed.
// Config follows the Automerge "Vite" recipe (research-grounded 2026-06-25):
//   - wasm()        : @automerge/automerge ships its core as .wasm
// The genesis boot artifact is now seed.json (the plain-data oracle seed,
// materialize-fresh) — a native JSON import, so the old vite-plugin-arraybuffer (which
// served the retired binary import) is gone.
// automerge-wasm's top-level-await is handled by the esnext target (build + dev),
// so vite-plugin-top-level-await is NOT needed (and dropping it removes the @swc/core
// native build that snagged pnpm's pre-run deps-check).
export default defineConfig({
  plugins: [wasm(), serveGenesis(), emitPronaosArtifactRecord()],

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
    // genesis/seed.json lives at the repo root
    // (outside this package); allow it.
    fs: { allow: [".", "../..", "../../genesis"] },
  },
});
