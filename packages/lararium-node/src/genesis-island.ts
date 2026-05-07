/**
 * genesis-island — complete genesis-first boot surface for @lararium/node.
 *
 * Exports:
 *   loadGenesisIsland        — import genesis/island.bin into a repo; return DocHandle<LarariumDoc>
 *   reconcileIslandFromGenesis — merge genesis into a live doc when CID diverges
 *   reconcileWellKnownTiddlers — write runtime oracle tiddlers (Tiga edges) into the island handle
 *   seedLaresDoc             — create the ba satellite doc on first boot
 *   seedIdentitiesDoc        — create the @identities satellite doc on first boot
 *   seedCirclesDoc            — create the @circles satellite doc on first boot
 *   seedSessionsDoc          — create the @sessions satellite doc on first boot
 *
 * Node read path for genesis bytes:
 *   readFileSync(genesis/island.bin) resolved relative to import.meta.url.
 *   One-time boot-path read of a known build artifact — not a disk walk.
 *
 * Browser path (future, @dreamdeck/app):
 *   Bundler (esbuild / Vite) binary loader inlines island.bin as Uint8Array.
 *   repo.import(genesisBytes) — zero fs reads.
 *
 * Oracle tiddlers and satellite-doc URLs are runtime-assigned and cannot live
 * in the genesis artifact. They are written here, after loadGenesisIsland().
 */

import { readFileSync, existsSync }  from "fs";
import { join, dirname }             from "path";
import { fileURLToPath }             from "url";
import * as Automerge                from "@automerge/automerge";
import type { Repo, DocHandle }      from "@automerge/automerge-repo";
import type { LarariumDoc, MemeStoreDoc, IdentitiesDoc, CirclesDoc, SessionsDoc, SessionEventLog } from "@lararium/core";
import {
  ENGINE_CORE_ID, LARARIUM_DOC_URI,
  CATALOG_DOC_URI, LARES_DOC_URI,
  IDENTITIES_DOC_URI, CIRCLES_DOC_URI, SESSIONS_DOC_URI,
  ADMIN_BAG_ID,
  emptyMemeStoreDoc, emptyIdentitiesDoc, emptyCirclesDoc, emptySessionsDoc,
  sessionEventLogUri,
} from "@lararium/core";

// ---------------------------------------------------------------------------
// Genesis bytes source
// ---------------------------------------------------------------------------

const __dir        = dirname(fileURLToPath(import.meta.url));
// Resolved at module load time — fast path; no async IO during import.
// genesis/ lives one level up from src/ (packages/lararium-node/genesis/).
const GENESIS_BIN  = join(__dir, "../genesis/island.bin");
const GENESIS_SHA  = join(__dir, "../genesis/island.sha256");

/**
 * Reads genesis/island.bin and returns its bytes.
 * Throws clearly if the artifact is absent — indicates a missing build step.
 */
function readGenesisBin(): Uint8Array {
  if (!existsSync(GENESIS_BIN)) {
    throw new Error(
      `[genesis-island] genesis/island.bin not found at ${GENESIS_BIN}\n` +
      `  → run: pnpm --filter @lararium/node build:genesis`,
    );
  }
  return new Uint8Array(readFileSync(GENESIS_BIN));
}

/**
 * Returns the expected sha256 from genesis/island.sha256, or undefined
 * if the file is absent (tolerated — sha256 file is advisory, not enforced
 * at runtime until Keyhive signing layer is in place).
 */
export function readGenesisSha256(): string | undefined {
  try {
    return readFileSync(GENESIS_SHA, "utf8").trim();
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// GENESIS_CID — package-level constant derived at module load time.
// Used by reconcileIslandFromGenesis to detect stale live docs.
// ---------------------------------------------------------------------------

let _genesisSha256: string | undefined;

/**
 * Returns the sha256 of the genesis artifact bundled with this package.
 * Cached after first read.
 */
export function GENESIS_CID(): string | undefined {
  if (_genesisSha256 === undefined) _genesisSha256 = readGenesisSha256();
  return _genesisSha256;
}

// ---------------------------------------------------------------------------
// loadGenesisIsland
// ---------------------------------------------------------------------------

/**
 * Load the genesis artifact into a repo and return a live DocHandle.
 *
 * @param repo - An already-constructed Repo (with storage + network adapters).
 * @returns    - A DocHandle<LarariumDoc> in ready state containing all engine
 *               blobs and base tiddlers from the genesis build.
 *
 * The returned handle's url is content-addressed: the same genesis bytes
 * always produce the same DocUrl via automerge-repo's import path.
 */
export async function loadGenesisIsland(repo: Repo): Promise<DocHandle<LarariumDoc>> {
  const bytes = readGenesisBin();

  // Smoke-verify bytes before importing: Automerge.load() checks format.
  // This surfaces corruption early with a clear error rather than a silent bad state.
  try {
    const preview = Automerge.load<LarariumDoc>(bytes);
    if (!preview.blobs?.[ENGINE_CORE_ID]) {
      throw new Error(
        `[genesis-island] genesis artifact missing TW5 core blob (${ENGINE_CORE_ID}).\n` +
        `  CID mismatch or corrupt file. Re-run: pnpm --filter @lararium/node build:genesis`,
      );
    }
  } catch (err) {
    if ((err as Error).message.includes("genesis artifact")) throw err;
    throw new Error(`[genesis-island] genesis/island.bin failed Automerge.load() validation: ${err}`);
  }

  const handle = repo.import<LarariumDoc>(bytes);
  await handle.whenReady();

  const doc = handle.doc();
  if (!doc?.blobs?.[ENGINE_CORE_ID]) {
    throw new Error("[genesis-island] handle.whenReady() resolved but TW5 core blob is absent — import failed silently.");
  }

  const blobCount    = Object.keys(doc.blobs ?? {}).length;
  const tiddlerCount = Object.keys(doc.tiddlers ?? {}).length;
  const widgetCount  = Object.keys(doc.blobs ?? {}).filter(id => id.startsWith("lararium-widget-")).length;
  if (widgetCount === 0) {
    throw new Error("[genesis-island] genesis artifact contains no widget blobs (lararium-widget-*) — re-run build:genesis after widget build.");
  }
  console.log(
    `[genesis-island] loaded  url=${handle.url}  blobs=${blobCount}  widgets=${widgetCount}  tiddlers=${tiddlerCount}  systemTitles=${doc.systemTitles?.length ?? 0}`,
  );

  return handle;
}

// ---------------------------------------------------------------------------
// reconcileIslandFromGenesis
// ---------------------------------------------------------------------------

/**
 * Reconcile a live LarariumDoc against the current genesis artifact.
 *
 * Reads the genesis CID stored in the live doc's well-known tiddler
 * (lar:///ha.ka.ba/@lararium/system/genesis-cid, field: sha256).
 * If it matches GENESIS_CID(), the live doc is already current — returns early.
 * If it diverges, merges the genesis handle into the live doc so net-new
 * blobs and tiddlers flow in without overwriting any live-doc changes.
 *
 * Called from openNodeLarPeer (S4) to replace the three SPRINT-2 markers.
 *
 * @param handle        - The live LarariumDoc handle (from FS storage or peer sync).
 * @param genesisHandle - A handle loaded via loadGenesisIsland().
 */
export async function reconcileIslandFromGenesis(
  handle:        DocHandle<LarariumDoc>,
  genesisHandle: DocHandle<LarariumDoc>,
): Promise<void> {
  const expectedCid = GENESIS_CID();
  if (!expectedCid) {
    console.warn("[genesis-island] reconcile: genesis CID unavailable — skipping reconcile");
    return;
  }

  // Read stored genesis CID from the live doc.
  const GENESIS_CID_TIDDLER = `${LARARIUM_DOC_URI}/genesis-cid`;
  const liveCid = handle.doc()?.tiddlers?.[GENESIS_CID_TIDDLER]?.fields?.["sha256"] as string | undefined;

  if (liveCid === expectedCid) {
    console.log("[genesis-island] reconcile: live doc current — no merge needed");
    return;
  }

  console.log(
    `[genesis-island] reconcile: merging genesis into live doc` +
    `  live-cid=${liveCid?.slice(0, 12) ?? "absent"}  expected=${expectedCid.slice(0, 12)}`,
  );

  // Merge genesis handle into the live handle.
  // Automerge merge is additive: net-new changes from genesis flow in;
  // live-doc changes are preserved.
  const genDoc  = genesisHandle.doc();
  if (!genDoc) {
    console.warn("[genesis-island] reconcile: genesisHandle.doc() null — skipping");
    return;
  }
  handle.merge(genesisHandle);

  // Write the new genesis CID into the live doc so subsequent boots skip reconcile.
  handle.change((doc) => {
    doc.tiddlers[GENESIS_CID_TIDDLER] = {
      title:     GENESIS_CID_TIDDLER,
      fields:    { sha256: expectedCid },
      bag:       LARARIUM_DOC_URI,
      authority: "genesis",
    };
  });

  console.log("[genesis-island] reconcile: merge complete — genesis CID updated in live doc");
}

// ---------------------------------------------------------------------------
// reconcileWellKnownTiddlers — runtime oracle tiddler writer
// ---------------------------------------------------------------------------

/**
 * Write the Automerge Tiga edge tiddlers into the live island handle.
 *
 * These tiddlers embed runtime-assigned automerge: URLs and cannot live in the
 * genesis artifact. They are written (or patched) on every boot after
 * loadGenesisIsland() returns. Writes are no-ops when values already match.
 *
 *   ha self-ref     : LARARIUM_DOC_URI   → handle.url
 *   ha → ka edge    : CATALOG_DOC_URI    → catalogUrl
 *   ha → ba edge    : LARES_DOC_URI      → laresUrl       (omitted when absent)
 *   ha → identities : IDENTITIES_DOC_URI → identitiesUrl  (omitted when absent)
 *   ha → groups     : CIRCLES_DOC_URI     → groupsUrl      (omitted when absent)
 *   ha → sessions   : SESSIONS_DOC_URI   → sessionsUrl    (omitted when absent)
 */
export function reconcileWellKnownTiddlers(
  handle:         DocHandle<LarariumDoc>,
  catalogUrl:     string,
  laresUrl?:      string,
  identitiesUrl?: string,
  groupsUrl?:     string,
  sessionsUrl?:   string,
  adminUrl?:      string,
): void {
  const doc      = handle.doc();
  const tiddlers = doc?.tiddlers ?? {};
  const selfOk = tiddlers[LARARIUM_DOC_URI]?.text === handle.url;
  const catOk  = tiddlers[CATALOG_DOC_URI]?.text  === catalogUrl;
  const baOk   = laresUrl       ? tiddlers[LARES_DOC_URI]?.text       === laresUrl       : true;
  const idOk   = identitiesUrl  ? tiddlers[IDENTITIES_DOC_URI]?.text  === identitiesUrl  : true;
  const grOk   = groupsUrl      ? tiddlers[CIRCLES_DOC_URI]?.text      === groupsUrl      : true;
  const seOk   = sessionsUrl    ? tiddlers[SESSIONS_DOC_URI]?.text    === sessionsUrl    : true;
  const adOk   = adminUrl       ? tiddlers[ADMIN_BAG_ID]?.text         === adminUrl       : true;
  if (selfOk && catOk && baOk && idOk && grOk && seOk && adOk) return;

  handle.change((d) => {
    if (!selfOk) d.tiddlers[LARARIUM_DOC_URI] = { title: LARARIUM_DOC_URI, text: handle.url, fields: {}, bag: LARARIUM_DOC_URI, authority: "lararium-seed" };
    if (!catOk)  d.tiddlers[CATALOG_DOC_URI]  = { title: CATALOG_DOC_URI,  text: catalogUrl,  fields: {}, bag: LARARIUM_DOC_URI, authority: "lararium-seed" };
    if (!baOk  && laresUrl)       d.tiddlers[LARES_DOC_URI]       = { title: LARES_DOC_URI,       text: laresUrl,       fields: {}, bag: LARARIUM_DOC_URI, authority: "lararium-seed" };
    if (!idOk  && identitiesUrl)  d.tiddlers[IDENTITIES_DOC_URI]  = { title: IDENTITIES_DOC_URI,  text: identitiesUrl,  fields: {}, bag: LARARIUM_DOC_URI, authority: "lararium-seed" };
    if (!grOk  && groupsUrl)      d.tiddlers[CIRCLES_DOC_URI]      = { title: CIRCLES_DOC_URI,      text: groupsUrl,      fields: {}, bag: LARARIUM_DOC_URI, authority: "lararium-seed" };
    if (!seOk  && sessionsUrl)    d.tiddlers[SESSIONS_DOC_URI]    = { title: SESSIONS_DOC_URI,    text: sessionsUrl,    fields: {}, bag: LARARIUM_DOC_URI, authority: "lararium-seed" };
    if (!adOk  && adminUrl)       d.tiddlers[ADMIN_BAG_ID]         = { title: ADMIN_BAG_ID,        text: adminUrl,       fields: {}, bag: LARARIUM_DOC_URI, authority: "lararium-seed" };
  });

  const flags = [
    `self=${selfOk ? "ok" : "patched"}`,
    `catalog=${catOk ? "ok" : "patched"}`,
    `lares=${baOk  ? "ok" : laresUrl       ? "patched" : "pending"}`,
    `identities=${idOk ? "ok" : identitiesUrl ? "patched" : "pending"}`,
    `circles=${grOk ? "ok" : groupsUrl      ? "patched" : "pending"}`,
    `sessions=${seOk ? "ok" : sessionsUrl   ? "patched" : "pending"}`,
    `admin=${adOk ? "ok" : adminUrl        ? "patched" : "pending"}`,
  ].join("  ");
  console.log(`[genesis-island] oracle tiddlers  ${flags}`);
}

// ---------------------------------------------------------------------------
// Satellite-doc seeders — ba vertex + social plane
// ---------------------------------------------------------------------------

/** Seed the LaresDoc (ba vertex). Writes self-ref tiddler; ha→ba oracle via reconcileWellKnownTiddlers. */
export function seedLaresDoc(repo: Repo): DocHandle<MemeStoreDoc> {
  const handle = repo.create<MemeStoreDoc>(emptyMemeStoreDoc());
  handle.change((doc) => {
    doc.tiddlers[LARES_DOC_URI] = { title: LARES_DOC_URI, text: handle.url, fields: {}, bag: LARES_DOC_URI, authority: "lararium-seed" };
  });
  console.log(`[genesis-island] LaresDoc seeded  url=${handle.url}`);
  return handle;
}

/** Seed the IdentitiesDoc. Writes self-ref tiddler; ha oracle via reconcileWellKnownTiddlers. */
export function seedIdentitiesDoc(repo: Repo): DocHandle<IdentitiesDoc> {
  const handle = repo.create<IdentitiesDoc>(emptyIdentitiesDoc());
  handle.change((doc) => {
    doc.tiddlers[IDENTITIES_DOC_URI] = { title: IDENTITIES_DOC_URI, text: handle.url, fields: {}, bag: IDENTITIES_DOC_URI, authority: "lararium-seed" };
  });
  console.log(`[genesis-island] IdentitiesDoc seeded  url=${handle.url}`);
  return handle;
}

// System circle IDs — auto-seeded per Kowloon model (jzellis): adding to a circle IS the follow;
// membership never federates; social graph is private to the owning node.
const SYSTEM_CIRCLES: Array<{ id: string; displayName: string }> = [
  { id: "following",     displayName: "Following" },
  { id: "all-following", displayName: "All Following" },
  { id: "circles",       displayName: "Circles" },
  { id: "blocked",       displayName: "Blocked" },
  { id: "muted",         displayName: "Muted" },
];

/** Seed the CirclesDoc. Writes self-ref tiddler + 5 system circles; ha oracle via reconcileWellKnownTiddlers. */
export function seedCirclesDoc(repo: Repo): DocHandle<CirclesDoc> {
  const handle = repo.create<CirclesDoc>(emptyCirclesDoc());
  handle.change((doc) => {
    doc.tiddlers[CIRCLES_DOC_URI] = { title: CIRCLES_DOC_URI, text: handle.url, fields: {}, bag: CIRCLES_DOC_URI, authority: "lararium-seed" };
    for (const { id, displayName } of SYSTEM_CIRCLES) {
      const uri = `${CIRCLES_DOC_URI}/${id}`;
      doc.tiddlers[uri] = {
        title:     uri,
        text:      "",
        fields:    { id, displayName, kind: "System", memberDids: "", createdAt: "" },
        bag:       CIRCLES_DOC_URI,
        authority: "lararium-seed",
      };
    }
  });
  console.log(`[genesis-island] CirclesDoc seeded  url=${handle.url}  systemCircles=${SYSTEM_CIRCLES.length}`);
  return handle;
}

/** Seed the SessionsDoc. Writes self-ref tiddler; ha oracle via reconcileWellKnownTiddlers. */
export function seedSessionsDoc(repo: Repo): DocHandle<SessionsDoc> {
  const handle = repo.create<SessionsDoc>(emptySessionsDoc());
  handle.change((doc) => {
    doc.tiddlers[SESSIONS_DOC_URI] = { title: SESSIONS_DOC_URI, text: handle.url, fields: {}, bag: SESSIONS_DOC_URI, authority: "lararium-seed" };
  });
  console.log(`[genesis-island] SessionsDoc seeded  url=${handle.url}`);
  return handle;
}

/**
 * Seed the AdminDoc — operator-private infrastructure bag.
 *
 * Holds device delegations (cap=infrastructure), bag-mirror configs tagged
 * $:/tags/LarariumBagMirror, projection configs tagged $:/tags/LarariumProjection,
 * session tiddlers (operator → agent), and ceremony state. Federation scopes
 * to the operator's own devices via cap=infrastructure delegations gated at
 * the ingress trust check (S7.4); never reaches room peers.
 *
 * Reuses the generic MemeStoreDoc shape — semantic distinction lives in URI
 * and bag identity, not in document type.
 */
export function seedAdminDoc(repo: Repo): DocHandle<MemeStoreDoc> {
  const handle = repo.create<MemeStoreDoc>(emptyMemeStoreDoc());
  handle.change((doc) => {
    doc.tiddlers[ADMIN_BAG_ID] = { title: ADMIN_BAG_ID, text: handle.url, fields: {}, bag: ADMIN_BAG_ID, authority: "lararium-seed" };
  });
  console.log(`[genesis-island] AdminDoc seeded  url=${handle.url}`);
  return handle;
}

/**
 * Create a per-session SessionEventLog child doc.
 *
 * Creates the Automerge doc and writes its self-ref oracle tiddler.
 * The caller is responsible for writing the session tiddler (with `eventLogUrl`)
 * through the CompositeStore so the write flows through the TW5 VM path.
 *
 * Returns the live DocHandle — its `.url` is the value to store in `eventLogUrl`.
 */
export function createSessionEventLog(
  repo:      Repo,
  sessionId: string,
): DocHandle<SessionEventLog> {
  const logHandle = repo.create<SessionEventLog>({ schemaVersion: "0.1", tiddlers: {}, events: {} });
  const logUri = sessionEventLogUri(sessionId);

  // Self-ref oracle tiddler: new doc not yet in composite — direct write is correct here.
  logHandle.change((doc) => {
    doc.tiddlers[logUri] = {
      title:     logUri,
      text:      logHandle.url,
      fields:    { sessionId, kind: "session-event-log" },
      bag:       SESSIONS_DOC_URI,
      authority: "lararium-session",
    };
  });

  console.log(`[genesis-island] SessionEventLog created  sessionId=${sessionId}  url=${logHandle.url}`);
  return logHandle;
}
