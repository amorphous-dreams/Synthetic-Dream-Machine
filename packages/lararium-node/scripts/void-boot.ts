/**
 * void-boot — cold-start seeder for the Lararium node peer.
 *
 * Called exactly once per corpus doc, on first boot (empty Automerge docs,
 * files exist on disk). The sequence is strict:
 *
 *   1. Engine doc seeds from disk (TW5 core + plugin blobs) → catalog entry.
 *   2. A seed VM boots from the JS engine blob — this VM is the deserializer
 *      authority for all subsequent carrier ingest.
 *   3. Each corpus file flows through vm.deserializeCarrier():
 *        disk text → TW5 deserializer → [parent, ...children] tiddler records
 *   4. All records write into the corpus Automerge doc in one change() call.
 *   5. The seed VM is discarded. The recipe VM starts clean and loads from the
 *      now-populated corpus doc via loadFromStore on first use.
 *
 * The server is a local-first peer, not an authority. Void boot is a capability
 * peer role: disk reader + TW5 engine owner + Automerge doc creator. Any peer
 * with read access to lares/ could perform this same seed.
 *
 * Fontany-Fuller-Zelenka void-boot law:
 *   - Engine first, VM second, corpus third — strict ordering.
 *   - VM is the single codec. No splitCarrierToTiddlers bypass in seeding.
 *   - Raw carrier text NEVER enters the Automerge doc.
 *   - Source memes (TS/TSX graph navigation) seed directly (non-carrier, no VM).
 */

import { readFileSync, existsSync } from "fs";
import { join }                     from "path";
import { LarariumTW5 }              from "@lararium/tw5";
import { resolveLarUri }            from "@lararium/core";
import { compileCarrierIndex, LARES_ROOT } from "../src/node-host.js";
import { buildSourceMemes }         from "./source-memes.js";
import type { MemeStoreDoc }        from "@lararium/core";
import type { DocHandle }           from "@automerge/automerge-repo";

export interface VoidBootResult {
  memeCount:   number;
  childCount:  number;
  warnCount:   number;
  compiledAt:  string;
}

/**
 * Seed a corpus Automerge doc from disk using the TW5 VM as the deserializer.
 *
 * bagId           — corpus bag slug (e.g. "lares")
 * handle          — the empty corpus doc to populate
 * quine           — true for lares/ (self-describing corpus)
 * includeSource   — true to also seed TS/TSX source memes
 */
export async function voidBootCorpus(
  bagId:         string,
  handle:        DocHandle<MemeStoreDoc>,
  opts:          { quine?: boolean; includeSource?: boolean } = {},
): Promise<VoidBootResult> {
  const compiledAt = new Date().toISOString();
  const vm = new LarariumTW5();
  await vm.boot();

  // Snapshot the engine-owned $:/ namespace immediately after boot, before any
  // corpus tiddlers are loaded. These titles belong in the engine doc island —
  // they must not be written into the corpus Automerge doc.
  const engineSystemTitles = new Set(vm.filterTiddlers("[prefix[$:/]]"));

  const records: Array<{ title: string; fields: Record<string, string | string[]>; text: string }> = [];
  let warnCount = 0;

  if (opts.quine) {
    // Ingest lares/ carrier files through the TW5 deserializer
    const carriers = compileCarrierIndex();
    for (const carrier of carriers) {
      const resolution = resolveLarUri(carrier.uri);
      if (!resolution.laresRelPath) continue;
      const abs = join(LARES_ROOT, resolution.laresRelPath);
      if (!existsSync(abs)) continue;

      const text = readFileSync(abs, "utf8");
      try {
        const tiddlers = vm.deserializeCarrier(carrier.uri, text);
        for (const t of tiddlers) {
          const title = t["title"] as string | undefined;
          if (!title) continue;
          // Engine-owned $:/ titles stay in the engine doc island — not corpus.
          // Any new $:/ titles emitted by carrier deserialization (plugin state,
          // parse warnings) are also excluded; they belong in personal/session doc.
          if (title.startsWith("$:/")) {
            if (!engineSystemTitles.has(title)) warnCount++;
            continue;
          }
          const { title: _t, text: bodyText, ...fieldRest } = t;
          records.push({
            title,
            fields: fieldRest as Record<string, string | string[]>,
            text:   typeof bodyText === "string" ? bodyText : "",
          });
        }
      } catch (e) {
        console.warn(`[void-boot] deserialize failed for ${carrier.uri}:`, e);
        warnCount++;
      }
    }
  }

  if (opts.includeSource) {
    // Source module memes — verbatim TS/TSX seeded directly (no carrier codec)
    for (const sm of buildSourceMemes(compiledAt)) {
      records.push({ title: sm.uri, fields: sm.fields ?? {}, text: sm.text });
    }
  }

  // Write all records into the Automerge doc in one change() transaction
  const parentCount = records.filter((r) => !r.title.includes("#")).length;
  const childCount  = records.length - parentCount;

  handle.change((doc) => {
    for (const rec of records) {
      doc[rec.title] = {
        title:  rec.title,
        fields: rec.fields as Record<string, string>,
        text:   rec.text,
        bag:    bagId,
      };
    }
  });

  vm.dispose();

  console.log(
    `[void-boot] corpus ${bagId}: ${parentCount} parents, ${childCount} children` +
    (warnCount > 0 ? `, ${warnCount} warnings` : ""),
  );

  return {
    memeCount:  parentCount,
    childCount,
    warnCount,
    compiledAt,
  };
}
