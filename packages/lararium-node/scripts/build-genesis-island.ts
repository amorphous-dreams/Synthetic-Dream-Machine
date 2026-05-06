/**
 * build-genesis-island — Sprint 2 build-time genesis artifact builder.
 *
 * Produces packages/lararium-node/genesis/island.bin:
 *   a deterministic Automerge binary carrying all engine blobs + lares tiddlers.
 *
 * Determinism invariant:
 *   actorId = sha256hex(sorted content hashes of all walked inputs).
 *   Two builds from identical source produce identical island.sha256.
 *
 * Oracle tiddlers (LARARIUM_DOC_URI → handle.url, etc.) are NOT written here.
 * They embed the runtime DocUrl which is assigned by repo.import() at boot time.
 * reconcileWellKnownTiddlers() writes them after loading (S3/S4 scope).
 *
 * Run via:  tsx scripts/build-genesis-island.ts
 * Or via:   pnpm --filter @lararium/node build:genesis
 */

import * as Automerge            from "@automerge/automerge";
import { createHash }            from "crypto";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath }         from "url";

import { TW5Engine }             from "@lararium/tw5";
import { tw5MemesRoot, tw5PluginsRoot } from "@lararium/tw5/tw5-memes-root";
import { TW5_VERSION, TW5_CORE_SCRIPT_FILENAME } from "@lararium/tw5";

import type { LarariumDoc, LarariumBlobEntry } from "@lararium/core";
import {
  ENGINE_CORE_ID,
  LARARIUM_DOC_URI, CATALOG_DOC_URI, LARES_DOC_URI,
  IDENTITIES_DOC_URI, CIRCLES_DOC_URI, SESSIONS_DOC_URI,
  recipeUri,
  bagDescriptorUri,
  blobDescriptorUri,
} from "@lararium/core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dir = dirname(fileURLToPath(import.meta.url));
const GENESIS_DIR  = join(__dir, "../genesis");
const TW5_PUBLIC   = join(__dir, "../../lararium-tw5/public");

/** Capture the SOH ? -> uri line from a memetic-wikitext carrier. */
const SOH_URI_RE = /<<~[^>]*&#x0001;[^>]*\?\s*->\s*([^\s>]+)\s*>>/;

function sha256hex(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function walkMdFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) results.push(...walkMdFiles(full));
      else if (entry.name.endsWith(".md")) results.push(full);
    }
  } catch { /* directory absent — skip */ }
  return results.sort();
}

function walkFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) results.push(...walkFiles(full, ext));
      else if (entry.name.endsWith(ext)) results.push(full);
    }
  } catch { /* directory absent — skip */ }
  return results.sort();
}

// ---------------------------------------------------------------------------
// Deterministic actor ID
//
// Hash every input file (sorted) and combine hashes so any single-byte change
// in any input propagates to a new actor ID, hence new genesis bytes and CID.
// ---------------------------------------------------------------------------

function deriveActorId(tw5CorePath: string): string {
  const h = createHash("sha256");

  // TW5 core blob
  if (existsSync(tw5CorePath)) {
    h.update("tw5-core:");
    h.update(readFileSync(tw5CorePath));
  }

  // Meme carrier files (sorted for determinism)
  for (const f of walkMdFiles(tw5MemesRoot)) {
    h.update(`md:${f}:`);
    h.update(readFileSync(f));
  }

  // Lares meme root — the @lares carriers
  const laresMemeRoot = join(__dir, "../../lares/memes");
  for (const f of walkMdFiles(laresMemeRoot)) {
    h.update(`lares:${f}:`);
    h.update(readFileSync(f));
  }

  // Vendored plugin JSON files (sorted)
  for (const f of walkFiles(tw5PluginsRoot, ".json")) {
    h.update(`plugin:${f}:`);
    h.update(readFileSync(f));
  }

  return h.digest("hex");
}

// ---------------------------------------------------------------------------
// Lares plugin blob — same logic as buildLaresPluginBlob() in lararium-island.ts
// but without the SPRINT-2 runtime-call constraint.
// ---------------------------------------------------------------------------

async function buildLaresPluginBlob(): Promise<Uint8Array> {
  // Walk both tw5 memes and lares memes
  const tw5Files   = walkMdFiles(tw5MemesRoot);
  const laresMemes = join(__dir, "../../lares/memes");
  const laresFiles = walkMdFiles(laresMemes);
  const allFiles   = [...tw5Files, ...laresFiles];

  const seedVm = new TW5Engine();
  await seedVm.boot();

  const tiddlerMap: Record<string, Record<string, unknown>> = {};
  let count = 0;

  for (const filePath of allFiles) {
    const content  = readFileSync(filePath, "utf8");
    const uriMatch = SOH_URI_RE.exec(content);
    if (!uriMatch) continue;
    const rawUri = uriMatch[1]!;
    const uri    = rawUri.startsWith("lar:///") ? rawUri : `lar:///${rawUri}`;
    try {
      const fields = seedVm.deserializeCarrier(uri, content);
      for (const f of fields) {
        if (f["title"]) { tiddlerMap[f["title"] as string] = f; count++; }
      }
    } catch { /* malformed meme — skip */ }
  }

  seedVm.dispose();
  console.log(`[genesis] lares plugin  ${count} tiddlers from ${allFiles.length} files`);

  const pluginTiddler = {
    title:          "$:/plugins/lararium/lares",
    type:           "application/json",
    "plugin-type": "plugin",
    version:        TW5_VERSION,
    text:           JSON.stringify({ tiddlers: tiddlerMap }),
  };
  return new TextEncoder().encode(JSON.stringify(pluginTiddler));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[genesis] Sprint 2 — build-genesis-island starting");

  const coreJsPath = join(TW5_PUBLIC, TW5_CORE_SCRIPT_FILENAME);
  if (!existsSync(coreJsPath)) {
    throw new Error(
      `[genesis] TW5 core not found: ${coreJsPath}\n  → run pnpm --filter @lararium/tw5 build:vendor first`,
    );
  }

  // 1. Derive deterministic actor ID from all content inputs.
  console.log("[genesis] deriving actor ID from content hash …");
  const actorId = deriveActorId(coreJsPath);
  console.log(`[genesis] actorId = ${actorId.slice(0, 16)}…`);

  // 2. Build lares plugin blob.
  console.log("[genesis] building lares plugin blob …");
  const laresPluginBlob = await buildLaresPluginBlob();
  const laresPluginSha  = sha256hex(laresPluginBlob);

  // 3. Read TW5 core blob.
  const coreBlob  = new Uint8Array(readFileSync(coreJsPath));
  const coreSha   = sha256hex(coreBlob);
  console.log(`[genesis] TW5 core  v${TW5_VERSION}  sha=${coreSha.slice(0, 12)}…`);

  // 4. Collect vendored plugin blobs.
  const vendoredPlugins: LarariumBlobEntry[] = [];
  if (existsSync(tw5PluginsRoot)) {
    for (const file of readdirSync(tw5PluginsRoot).filter(f => f.endsWith(".json")).sort()) {
      const filePath = join(tw5PluginsRoot, file);
      const blob     = new Uint8Array(readFileSync(filePath));
      const sha      = sha256hex(blob);
      let id      = basename(file, ".json");
      let version = "unknown";
      let author: string | undefined;
      let source: string | undefined;
      try {
        const meta = JSON.parse(new TextDecoder().decode(blob)) as Record<string, unknown>;
        if (typeof meta["title"]   === "string") id      = meta["title"];
        if (typeof meta["version"] === "string") version = meta["version"];
        if (typeof meta["author"]  === "string") author  = meta["author"];
        if (typeof meta["source"]  === "string") source  = meta["source"];
      } catch { /* unparseable — use filename-derived id */ }
      vendoredPlugins.push({
        id, version, sha256: sha,
        mimeType: "application/json",
        blob,
        ...(author && { author }),
        ...(source && { source }),
        license: "MIT",
      });
      console.log(`[genesis] vendored plugin  ${id}  v${version}  sha=${sha.slice(0, 12)}…`);
    }
  }

  // 5. Snapshot systemTitles from a bare VM boot.
  console.log("[genesis] snapshotting system titles …");
  const snapshotVm = new TW5Engine();
  await snapshotVm.boot();
  const systemTitles = snapshotVm.filterTiddlers("[prefix[$:/]]").sort();
  snapshotVm.dispose();
  console.log(`[genesis] systemTitles count = ${systemTitles.length}`);

  // 6. Create Automerge doc with pinned actor.
  //    Automerge.from() passes {} to its internal _change, ignoring the time option.
  //    Use init() + an explicit first change so every change gets time: 0.
  let doc = Automerge.init<LarariumDoc>({ actor: actorId });
  doc = Automerge.change(doc, { time: 0 }, d => {
    const r = d as unknown as Record<string, unknown>;
    r["schemaVersion"] = "0.1";
    r["blobs"]         = {};
    r["tiddlers"]      = {};
    r["systemTitles"]  = [];
  });

  // 7. Write TW5 core blob.
  const coreEntry: LarariumBlobEntry = {
    id:       ENGINE_CORE_ID,
    version:  TW5_VERSION,
    sha256:   coreSha,
    mimeType: "application/javascript",
    blob:     coreBlob,
    license:  "BSD-3-Clause",
    author:   "UnaMesa Association",
    source:   "https://tiddlywiki.com",
  };
  doc = Automerge.change(doc, { time: 0 }, d => {
    (d.blobs as Record<string, LarariumBlobEntry>)[ENGINE_CORE_ID] = coreEntry;
  });

  // 8. Write vendored plugin blobs.
  for (const entry of vendoredPlugins) {
    doc = Automerge.change(doc, { time: 0 }, d => {
      (d.blobs as Record<string, LarariumBlobEntry>)[entry.id] = entry;
    });
  }

  // 9. Write lares plugin blob.
  doc = Automerge.change(doc, { time: 0 }, d => {
    (d.blobs as Record<string, LarariumBlobEntry>)["lararium-lares"] = {
      id:       "lararium-lares",
      version:  TW5_VERSION,
      sha256:   laresPluginSha,
      mimeType: "application/json",
      blob:     laresPluginBlob,
    };
  });

  // 10. Write systemTitles.
  doc = Automerge.change(doc, { time: 0 }, d => {
    if (d.systemTitles)
      (d.systemTitles as string[]).splice(0, d.systemTitles.length, ...systemTitles);
  });

  // 11. Write default recipe tiddlers.
  //     No `updatedAt` timestamps — genesis tiddlers carry no mutable state.
  doc = Automerge.change(doc, { time: 0 }, d => {
    const tiddlers = d.tiddlers as Record<string, unknown>;

    // Recipe: full
    const fullUri = recipeUri("@lararium", "full");
    tiddlers[fullUri] = {
      title: fullUri,
      fields: {
        label: "Full (content + social plane)",
        bagStack: [
          LARARIUM_DOC_URI, CATALOG_DOC_URI, LARES_DOC_URI,
          IDENTITIES_DOC_URI, CIRCLES_DOC_URI, SESSIONS_DOC_URI,
        ].join(" "),
        authority: "genesis", bag: LARARIUM_DOC_URI,
      },
      authority: "genesis",
      bag: LARARIUM_DOC_URI,
    };

    // Recipe: default
    const defaultUri = recipeUri("@lararium", "default");
    tiddlers[defaultUri] = {
      title: defaultUri,
      fields: {
        label: "Default (content Tiga)",
        bagStack: [LARARIUM_DOC_URI, CATALOG_DOC_URI, LARES_DOC_URI].join(" "),
        authority: "genesis", bag: LARARIUM_DOC_URI,
      },
      authority: "genesis",
      bag: LARARIUM_DOC_URI,
    };

    // Recipe: catalog default
    const catalogDefaultUri = recipeUri("@catalog", "default");
    tiddlers[catalogDefaultUri] = {
      title: catalogDefaultUri,
      fields: {
        label: "Catalog default (discovery + lares)",
        bagStack: [CATALOG_DOC_URI, LARES_DOC_URI].join(" "),
        authority: "genesis", bag: LARARIUM_DOC_URI,
      },
      authority: "genesis",
      bag: LARARIUM_DOC_URI,
    };
  });

  // 12. Write bag descriptor tiddlers.
  const ROOT_BAGS = [
    { bagId: LARARIUM_DOC_URI,   label: "ha — engine & grammar (Lararium)",   readPolicy: "public",  writePolicy: "private" },
    { bagId: CATALOG_DOC_URI,    label: "ka — corpus discovery (Catalog)",     readPolicy: "public",  writePolicy: "private" },
    { bagId: LARES_DOC_URI,      label: "ba — persona & doctrine (Lares)",     readPolicy: "public",  writePolicy: "private" },
    { bagId: IDENTITIES_DOC_URI, label: "ha — principals (Identities)",             readPolicy: "private", writePolicy: "private" },
    { bagId: CIRCLES_DOC_URI,     label: "ka — collective authority (Groups)",       readPolicy: "private", writePolicy: "private" },
    { bagId: SESSIONS_DOC_URI,   label: "ba — live operator sessions (Sessions)",   readPolicy: "private", writePolicy: "private" },
  ];
  doc = Automerge.change(doc, { time: 0 }, d => {
    const tiddlers = d.tiddlers as Record<string, unknown>;
    for (const { bagId, label, readPolicy, writePolicy } of ROOT_BAGS) {
      const uri = bagDescriptorUri(bagId);
      tiddlers[uri] = {
        title: uri,
        fields: { label, readPolicy, writePolicy, authority: "genesis", bag: LARARIUM_DOC_URI },
        authority: "genesis",
        bag: LARARIUM_DOC_URI,
      };
    }
  });

  // 13. Write blob descriptor tiddlers.
  doc = Automerge.change(doc, { time: 0 }, d => {
    const tiddlers = d.tiddlers as Record<string, unknown>;
    const blobs    = (d.blobs ?? {}) as Record<string, LarariumBlobEntry>;
    for (const [blobId, entry] of Object.entries(blobs)) {
      const uri               = blobDescriptorUri(blobId);
      const isVendoredPlugin  = blobId.startsWith("$:/plugins/");
      tiddlers[uri] = {
        title:     uri,
        text:      blobId,
        fields: {
          sha256:   entry.sha256,
          version:  entry.version,
          mimeType: entry.mimeType,
          ...(entry.author  && { author:  entry.author }),
          ...(entry.source  && { source:  entry.source }),
          ...(entry.license && { license: entry.license }),
          ...(isVendoredPlugin && { pluginInstallable: "true", pluginTitle: blobId }),
          tags:      isVendoredPlugin ? "blob-descriptor plugin-descriptor" : "blob-descriptor",
        },
        bag:       LARARIUM_DOC_URI,
        authority: "genesis",
      };
    }
  });

  // 14. Serialize and write output files.
  mkdirSync(GENESIS_DIR, { recursive: true });

  const genesisBytes = Automerge.save(doc);
  const genesisSha   = sha256hex(genesisBytes);

  writeFileSync(join(GENESIS_DIR, "island.bin"), genesisBytes);
  writeFileSync(join(GENESIS_DIR, "island.sha256"), genesisSha + "\n", "utf8");

  // 15. Smoke-test: load the saved bytes and verify grammar tiddler readable.
  const reloaded = Automerge.load<LarariumDoc>(genesisBytes);
  const blobCount    = Object.keys(reloaded.blobs ?? {}).length;
  const tiddlerCount = Object.keys(reloaded.tiddlers ?? {}).length;
  if (!reloaded.blobs?.[ENGINE_CORE_ID]) {
    throw new Error("[genesis] smoke-test FAILED: TW5 core blob not found after reload");
  }

  console.log(`[genesis] ✓ island.bin  ${(genesisBytes.byteLength / 1024).toFixed(0)} KB`);
  console.log(`[genesis] ✓ blobs=${blobCount}  tiddlers=${tiddlerCount}  systemTitles=${reloaded.systemTitles?.length ?? 0}`);
  console.log(`[genesis] ✓ sha256=${genesisSha}`);
  console.log("[genesis] Sprint 2 gate satisfied — genesis artifact ready.");
}

main().catch(err => {
  console.error("[genesis] FATAL:", err);
  process.exit(1);
});
