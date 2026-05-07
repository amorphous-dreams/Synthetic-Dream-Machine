/**
 * init-lararium — one-time social-plane bootstrap for a new Lararium node.
 *
 * Causal-island law: this script is the ONLY place that seeds social Tiga docs.
 * The server (openNodeLarPeer) finds docs created here; it never authors them.
 *
 * Three things this script produces:
 *   1. IdentitiesDoc — operator IdentityTiddler + DeviceDelegationTiddler (S7.1)
 *   2. CirclesDoc    — 5 system circles (Following / All Following / Circles / Blocked / Muted)
 *   3. SessionsDoc   — empty, ready for runtime session writes
 *
 *   genesis/social-bootstrap.json — TW5 plugin container encoding the AutomergeUrls
 *   of the three docs above + the ha-island oracle tiddlers for peer discovery.
 *
 * Usage:
 *   pnpm --filter @lararium/node lararium:init
 *
 * Re-running is idempotent: if genesis/social-bootstrap.json already exists and
 * the docs are in NodeFS storage, the script exits early without re-seeding.
 *
 * S7.1 TODO: add buildDeviceDelegation() call and include DeviceDelegationTiddler
 * with cap: "infrastructure" in the ceremony batch.
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname }   from "path";
import { fileURLToPath }   from "url";
import { Repo }            from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  IDENTITIES_DOC_URI, CIRCLES_DOC_URI, SESSIONS_DOC_URI, ADMIN_BAG_ID,
} from "@lararium/core";
import { buildCeremonyTiddlers } from "@lararium/tw5";
import {
  seedIdentitiesDoc, seedCirclesDoc, seedSessionsDoc, seedAdminDoc,
} from "../src/genesis-island.js";
import { generateOrLoadOperatorKeypair } from "../src/operator-key.js";
import { SOCIAL_BOOTSTRAP_PLUGIN_TITLE } from "../src/open-node-lar-peer.js";

const __dir      = dirname(fileURLToPath(import.meta.url));
// Default matches main.ts LAR_STORAGE default (".lararium").
// Override with LAR_STORAGE env var to match a custom --storage path.
const STORAGE    = join(__dir, "..", process.env["LAR_STORAGE"] ?? ".lararium");
const GENESIS    = join(__dir, "../genesis");
const BOOTSTRAP  = join(GENESIS, "social-bootstrap.json");

// ---------------------------------------------------------------------------
// Guard: skip if already initialised
// ---------------------------------------------------------------------------

if (existsSync(BOOTSTRAP)) {
  console.log("[lararium:init] genesis/social-bootstrap.json already exists — skipping.");
  console.log("  Delete it and re-run to force re-initialisation.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Boot a local-only Repo (no network, no WebSocket)
// ---------------------------------------------------------------------------

mkdirSync(STORAGE, { recursive: true });
mkdirSync(GENESIS, { recursive: true });

const repo = new Repo({
  storage: new NodeFSStorageAdapter(STORAGE),
});

// ---------------------------------------------------------------------------
// Operator keypair (Plane 0 → 1 delegation)
// ---------------------------------------------------------------------------

const operatorIdentity = await generateOrLoadOperatorKeypair(STORAGE);
console.log(`[lararium:init] operator verifyingKey  ${operatorIdentity.verifyingKey.slice(0, 16)}…`);

// ---------------------------------------------------------------------------
// Seed social Tiga docs
// ---------------------------------------------------------------------------

const identitiesHandle = seedIdentitiesDoc(repo);
const circlesHandle    = seedCirclesDoc(repo);
const sessionsHandle   = seedSessionsDoc(repo);
const adminHandle      = seedAdminDoc(repo);

// Operator identity ceremony: IdentityTiddler + operators CircleTiddler.
// S7.1 will add DeviceDelegationTiddler with cap: "infrastructure" here.
const ceremonyTiddlers = buildCeremonyTiddlers(
  operatorIdentity.verifyingKey,
  operatorIdentity.displayName,
);

for (const t of ceremonyTiddlers) {
  if (t.bag === IDENTITIES_DOC_URI) {
    identitiesHandle.change((doc) => {
      if (!doc.tiddlers[t.title]) {
        doc.tiddlers[t.title] = { title: t.title, bag: t.bag, authority: t.authority, fields: { ...t.fields } };
      }
    });
  } else {
    circlesHandle.change((doc) => {
      if (!doc.tiddlers[t.title]) {
        doc.tiddlers[t.title] = { title: t.title, bag: t.bag, authority: t.authority, fields: { ...t.fields } };
      }
    });
  }
}

console.log("[lararium:init] ceremony complete — operator identity written");

// ---------------------------------------------------------------------------
// Write genesis/social-bootstrap.json — TW5 plugin container
//
// Format: a single plugin tiddler whose text field encodes a JSON object of
// packed oracle tiddlers. The plugin title is lar:/// so MemeSyncAdaptor routes
// it to the "direct" save strategy. Tagged $:/tags/LarariumBootstrap so the
// lararium-bootstrap-sync startup module can find and promote it.
//
// Each packed tiddler carries the AutomergeUrl of its social doc in its text
// field — same oracle-tiddler pattern as LarariumDoc → CatalogDoc etc.
// ---------------------------------------------------------------------------

const packedTiddlers: Record<string, Record<string, unknown>> = {
  [IDENTITIES_DOC_URI]: { title: IDENTITIES_DOC_URI, text: identitiesHandle.url, fields: { kind: "oracle" } },
  [CIRCLES_DOC_URI]:    { title: CIRCLES_DOC_URI,    text: circlesHandle.url,    fields: { kind: "oracle" } },
  [SESSIONS_DOC_URI]:   { title: SESSIONS_DOC_URI,   text: sessionsHandle.url,   fields: { kind: "oracle" } },
  [ADMIN_BAG_ID]:       { title: ADMIN_BAG_ID,       text: adminHandle.url,      fields: { kind: "oracle" } },
};

const bootstrapPlugin = {
  title:         SOCIAL_BOOTSTRAP_PLUGIN_TITLE,
  "plugin-type": "plugin",
  type:          "application/json",
  tags:          "$:/tags/LarariumBootstrap",
  text:          JSON.stringify({ tiddlers: packedTiddlers }),
};

writeFileSync(BOOTSTRAP, JSON.stringify(bootstrapPlugin, null, 2), "utf8");

// Flush all docs to NodeFS storage before exit — without this race the next
// process boot won't find the docs the init just seeded.
await repo.flush();

console.log(`[lararium:init] genesis/social-bootstrap.json written`);
console.log(`  @identities  ${identitiesHandle.url}`);
console.log(`  @circles     ${circlesHandle.url}`);
console.log(`  @sessions    ${sessionsHandle.url}`);
console.log(`  @admin       ${adminHandle.url}`);
console.log("[lararium:init] done — start the node with: pnpm --filter @lararium/node dev");

process.exit(0);
