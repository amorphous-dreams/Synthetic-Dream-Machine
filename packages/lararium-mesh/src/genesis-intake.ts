/**
 * genesis-intake — the ONE genesis intake core, platform-blind.
 *
 * The emitter lives next door (genesis-doc.ts: buildGenesisDoc /
 * verifyGenesisArtifact); this module carries the receiving side every
 * vessel runs: validate bytes → import → post-import verify. The island
 * stays the founding record: no path merges one genesis document into
 * another, and a differing shipped seed stays an offer. One hull, so the node and browser intake
 * cannot drift apart on record shape or authority string; the platform
 * wrappers keep only their byte SOURCES (fs · bundle/IDB/OPFS/peer)
 * and their held offices (mintLaresIfAbsent stays in the node genesis
 * office — the gate enforces by placement).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/genesis-intake
 */

import type { Repo, DocHandle, DocumentId } from "@automerge/automerge-repo";
import { interpretAsDocumentId } from "@automerge/automerge-repo";
import { load as automergeLoad } from "@automerge/automerge";
import type { LarDoc } from "./base-doc.js";
import { ENGINE_CORE_ID } from "./base-doc.js";
import { ownEntry } from "./stored-value.js";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "./lar-uris.js";
import { materializeGenesisDoc, oracleGenesisDocUrl, type GenesisSeed } from "./genesis-doc.js";
import { resolveBootDoc } from "./boot-resolver.js";
import { assertNoPrototypeKeys } from "./prototype-key-shore.js";

/**
 * Validate genesis bytes before any import: Automerge format, TW5 core blob,
 * packed Lares plugin. Throws loudly with `label` naming the calling intake;
 * returns the previewed doc for further inspection.
 */
export function validateGenesisBytes(bytes: Uint8Array, label: string): LarDoc {
  let preview: LarDoc;
  try {
    preview = automergeLoad<LarDoc>(bytes);
  } catch (err) {
    throw new Error(`[${label}] genesis bytes failed Automerge.load() validation: ${err}`);
  }
  // Every by-key read below (`blobs`, `tiddlers`) stands on own keys only: a prototype key refuses by name.
  assertNoPrototypeKeys(preview, `${label}: genesis bytes`);
  if (!ownEntry(preview.blobs, ENGINE_CORE_ID)) {
    throw new Error(
      `[${label}] genesis artifact missing TW5 core blob (${ENGINE_CORE_ID}) — ` +
      `CID mismatch or corrupt artifact; rebuild genesis`,
    );
  }
  if (!ownEntry(preview.blobs, LARES_MEMETIC_WIKITEXT_PLUGIN_URI)) {
    throw new Error(
      `[${label}] genesis artifact missing packed Lares TW5 plugin — rebuild genesis after build:plugin`,
    );
  }
  return preview;
}

/**
 * Import genesis bytes into a Repo: validate → import → whenReady → verify
 * the imported doc actually carries the core blob (an import can fail
 * silently). Returns the live handle.
 */
export async function importGenesisIsland(
  repo:  Repo,
  bytes: Uint8Array,
  label: string,
): Promise<DocHandle<LarDoc>> {
  validateGenesisBytes(bytes, label);

  const handle = repo.import<LarDoc>(bytes);
  await handle.whenReady();

  const doc = handle.doc();
  if (!doc || !ownEntry(doc.blobs, ENGINE_CORE_ID)) {
    throw new Error(`[${label}] handle.whenReady() resolved but TW5 core blob absent — import failed silently`);
  }

  const blobCount    = Object.keys(doc.blobs ?? {}).length;
  const tiddlerCount = Object.keys(doc.tiddlers ?? {}).length;
  console.log(`[${label}] loaded  url=${handle.url}  blobs=${blobCount}  tiddlers=${tiddlerCount}`);

  return handle;
}

/**
 * materializeGenesisIsland — the boot intake: RELOAD-OR-MATERIALIZE the oracle doc.
 *
 * The oracle island is a LIVE CRDT, not a shipped binary. This boot path reads no Automerge-binary
 * boot seed and never merges into a stale doc:
 *
 *   1. find-FIRST under the DETERMINISTIC doc id (oracleGenesisDocUrl). A prior boot
 *      persisted the oracle doc there → reload it with the operator's writes intact
 *      (the persist-across-restart path). NO merge, NO fresh-empty doc.
 *   2. absent (first boot) → MATERIALIZE the oracle doc fresh from the plain-data seed
 *      and import it UNDER that same deterministic id, so the next boot finds it.
 *
 * Platform-blind: callers (node · browser) supply the seed from their own source
 * (seed.json · bundle). The deterministic id makes the materialize safe to
 * repeat across peers — byte-identical history under one shared address.
 */
export async function materializeGenesisIsland(
  repo:  Repo,
  seed:  GenesisSeed | undefined,
  label: string,
): Promise<DocHandle<LarDoc>> {
  const url = oracleGenesisDocUrl();

  // 1. find-first: a persisted oracle doc re-loads under the deterministic id.
  //    hearth-private fails FAST on the unavailable signal (local-first: a missing
  //    doc is the legitimate first boot, not a mesh-delivery wait).
  let existing: DocHandle<LarDoc> | null = null;
  try {
    existing = await resolveBootDoc<LarDoc>(repo, url, { tideline: "hearth-private", label: `${label} (@oracle)` });
  } catch {
    existing = null;   // unavailable → first boot, materialize below
  }
  if (existing && ownEntry(existing.doc()?.blobs, ENGINE_CORE_ID)) {
    const d = existing.doc()!;
    console.log(
      `[${label}] oracle doc reloaded (persisted)  url=${existing.url}  ` +
      `blobs=${Object.keys(d.blobs ?? {}).length}  tiddlers=${Object.keys(d.tiddlers ?? {}).length}`,
    );
    return existing;
  }

  // 2. first boot: materialize fresh from the plain-data seed, import under the id.
  if (!seed) {
    throw new Error(
      `[${label}] oracle seed required for first materialization — no persisted oracle doc was found`,
    );
  }
  const bytes = materializeGenesisDoc(seed);
  validateGenesisBytes(bytes, label);
  const docId  = interpretAsDocumentId(url) as DocumentId;
  const handle = repo.import<LarDoc>(bytes, { docId });
  await handle.whenReady();

  const doc = handle.doc();
  if (!doc || !ownEntry(doc.blobs, ENGINE_CORE_ID)) {
    throw new Error(`[${label}] oracle doc materialized but TW5 core blob absent — corrupt genesis seed`);
  }
  if (handle.url !== url) {
    throw new Error(`[${label}] oracle doc materialized under ${handle.url}, expected deterministic ${url}`);
  }
  console.log(
    `[${label}] oracle doc materialized FRESH  url=${handle.url}  ` +
    `blobs=${Object.keys(doc.blobs ?? {}).length}  tiddlers=${Object.keys(doc.tiddlers ?? {}).length}`,
  );
  return handle;
}

/**
 * Read the CAS member names carried by an already-persisted oracle.
 *
 * This is a restart continuity witness only: callers MUST use it to verify local
 * CAS bytes or to request those exact bytes from a separately declared immutable
 * source. It never turns mutable oracle metadata into permission to invent bytes.
 */
export function genesisCasCidsFromOracle(doc: LarDoc): readonly string[] {
  const entries = Object.values(doc.blobs ?? {});
  if (entries.length === 0) {
    throw new Error("[genesis-intake] persisted oracle carries no CAS member metadata");
  }
  const cids = entries.map((entry) => {
    if (!entry || typeof entry.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
      throw new Error(`[genesis-intake] persisted oracle carries a malformed CAS member (${String(entry?.id)})`);
    }
    return entry.sha256;
  });
  if (!cids.includes(ownEntry(doc.blobs, ENGINE_CORE_ID)?.sha256 ?? "")) {
    throw new Error(`[genesis-intake] persisted oracle is missing TW5 core CAS metadata (${ENGINE_CORE_ID})`);
  }
  if (new Set(cids).size !== cids.length) {
    throw new Error("[genesis-intake] persisted oracle carries duplicate CAS member CIDs");
  }
  return [...cids].sort();
}
