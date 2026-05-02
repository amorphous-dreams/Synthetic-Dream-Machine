/**
 * lararium-island — seeds the LarariumDoc Automerge corpus doc.
 *
 * Reads TW5 core JS and vendored plugin JSON files from disk on first boot.
 * Stores each as a Uint8Array blob (Automerge binary, no CRDT string overhead).
 *
 * Called once per server lifetime when the lararium island URL file does not exist.
 * On subsequent boots the existing doc is loaded from NodeFS storage.
 *
 * Island law: this doc is separate from the catalog.
 * The catalog receives a CatalogEngineEntry pointing to the engine doc URL.
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join, basename } from "path";
import { LarariumTW5 } from "@lararium/tw5";
import { createHash } from "crypto";
import type { Repo, DocHandle } from "@automerge/automerge-repo";
import type { LarariumDoc, LarariumBlobEntry } from "@lararium/core";
import { ENGINE_CORE_ID, emptyLarariumDoc } from "@lararium/core";
import { laresRoot } from "@lares/lares";
import { TW5_VERSION, TW5_CORE_SCRIPT_FILENAME } from "@lararium/tw5";

const PLUGINS_DIR = join(laresRoot, "memes/api/v0.1/tw5-plugins");

function sha256hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function readBlob(path: string): Uint8Array {
  return new Uint8Array(readFileSync(path));
}

/**
 * Seed a new LarariumDoc from disk artifacts.
 * Returns the doc handle and the sha256 of the TW5 core blob.
 */
export async function seedLarariumDoc(
  repo: Repo,
  appPublicDir: string,
): Promise<{ handle: DocHandle<LarariumDoc>; coreSha256: string }> {
  const handle = repo.create<LarariumDoc>(emptyLarariumDoc());

  // TW5 core blob
  const coreJsPath = join(appPublicDir, TW5_CORE_SCRIPT_FILENAME);
  if (!existsSync(coreJsPath)) {
    throw new Error(`[lararium-island] TW5 core not found: ${coreJsPath} — run pnpm build:tw5-vendor`);
  }
  const coreBlob  = readBlob(coreJsPath);
  const coreSha   = sha256hex(coreBlob);
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

  handle.change((doc) => {
    (doc.blobs as Record<string, LarariumBlobEntry>)[ENGINE_CORE_ID] = coreEntry;
  });

  // Vendored plugin blobs — every *.json in the tw5-plugins dir
  if (existsSync(PLUGINS_DIR)) {
    for (const file of readdirSync(PLUGINS_DIR).filter(f => f.endsWith(".json"))) {
      const filePath = join(PLUGINS_DIR, file);
      const blob     = readBlob(filePath);
      const sha      = sha256hex(blob);

      // Parse metadata from outer JSON to populate LarariumBlobEntry fields.
      // The blob itself is stored as binary — we only peek for the id/version.
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

      const entry: LarariumBlobEntry = {
        id, version, sha256: sha,
        mimeType: "application/json",
        blob,
        ...(author && { author }),
        ...(source && { source }),
        license: "MIT",
      };

      handle.change((doc) => {
        (doc.blobs as Record<string, LarariumBlobEntry>)[id] = entry;
      });

      console.log(`[lararium-island] seeded plugin  ${id}  v${version}  sha=${sha.slice(0, 12)}…`);
    }
  }

  // Snapshot the $:/ system title manifest from a freshly booted VM.
  // This set is the engine authority boundary — corpus docs must not store these.
  const snapshotVm = new LarariumTW5();
  await snapshotVm.boot();
  const systemTitles = snapshotVm.filterTiddlers("[prefix[$:/]]").sort();
  snapshotVm.dispose();

  handle.change((doc) => {
    (doc as { systemTitles?: readonly string[] }).systemTitles = systemTitles;
  });

  console.log(`[lararium-island] TW5 core v${TW5_VERSION}  sha=${coreSha.slice(0, 12)}…  system titles: ${systemTitles.length}`);
  console.log(`[lararium-island] engine doc URL: ${handle.url}`);
  return { handle, coreSha256: coreSha };
}
