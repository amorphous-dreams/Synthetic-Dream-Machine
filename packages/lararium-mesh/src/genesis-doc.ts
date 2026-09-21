/**
 * genesis-doc.ts — platform-neutral genesis island document builder.
 *
 * Accepts assembled byte inputs; returns a deterministic Automerge binary.
 * No filesystem, no network, no DOM. Pure mesh concern.
 *
 * Callers supply the blobs. buildGenesisDoc() constructs the LarDoc and runs
 * the two-pass CID injection. The output bytes write to any sink: disk, IndexedDB,
 * bundler inline, or test fixture.
 *
 * Schema: lar:///ha.ka.ba/lararium/mesh/genesis-doc
 */

import {
  init  as automergeInit,
  change as automergeChange,
  save   as automergeSave,
  load   as automergeLoad,
} from "@automerge/automerge";
import { PLUGIN_ATTESTATION_DOMAIN } from "./domains.js";
import { stringifyAutomergeUrl } from "@automerge/automerge-repo";
import { canonicalJsonBytes } from "./crypto.js";
import type { AutomergeUrl, BinaryDocumentId } from "@automerge/automerge-repo";
import { cidV1Sha256, sha256HexBytesSync, sha256BytesSync, utf8Bytes } from "./crypto.js";
import {
  GENESIS_CAS_MANIFEST_FORMAT,
  type GenesisCasManifest,
} from "./cas.js";
import {
  ORACLE_DOC_URI,
  LARARIUM_DOC_URI,
  CATALOG_DOC_URI,
  LARES_DOC_URI,
  LARES_MEMETIC_WIKITEXT_PLUGIN_URI,
  bagDescriptorUri,
  recipeUri,
} from "./lar-uris.js";
import { recipeRecordFields, type WikiRecipe } from "./wiki-recipe.js";
import type { LarDoc, LarBlobEntry } from "./base-doc.js";
import { ENGINE_CORE_ID, blobDescriptorUri } from "./base-doc.js";

// ---------------------------------------------------------------------------
// Shared attestation contract
// ---------------------------------------------------------------------------

/**
 * PluginBuildAttestation — schema written by @lararium/tw5 build-plugin-tiddler.ts.
 *
 * Promoted from a build-script local to the shared mesh contract so the genesis
 * builder and the plugin build pipeline speak the same type without coupling
 * @lararium/node to @lararium/tw5 at the type level.
 *
 * Format string: "lararium-tw5-plugin-build/v1"
 */
export interface PluginBuildAttestation {
  readonly format:                  string;
  readonly canonicalTitle:          string;
  readonly compatibilityTitle?:     string;
  readonly moduleManifestPath:      string;
  readonly moduleManifestSha256:    string;
  readonly sourceManifestPath?:     string;
  readonly sourceManifestSha256?:   string;
  readonly packTranscriptPath?:     string;
  readonly packTranscriptSha256?:   string;
  readonly moduleCount:             number;
  readonly packedTiddlerCount:      number;
  readonly pluginJsonSha256:        string;
  /**
   * The builder's signature over the canonical bytes of every field above.
   *
   * WHY AN UNSIGNED ATTESTATION CERTIFIES NOTHING. The hashes here bind BYTES excellently and bind
   * PROVENANCE not at all — anyone who can write the file can write the digests to match whatever they
   * shipped. The signature names WHO stood behind the build, which is the only thing a reader could not
   * have recomputed for themselves.
   *
   * OPTIONAL, and the absence reads honestly rather than fatally: an unsigned attestation still carries
   * usable diff handles, and `verifyPluginAttestation` reports UNSIGNED as its own verdict rather than
   * folding it into "invalid". A reader decides what an unsigned build may seed.
   */
  readonly builder?:                { readonly signer: string; readonly sig: string };
}

/** The domain an attestation signs within. A signature means nothing without the domain it was made in. */
export { PLUGIN_ATTESTATION_DOMAIN } from "./domains.js";
/** The canonical bytes an attestation signs over — every field EXCEPT the signature that covers them. */
export function pluginAttestationBytes(a: Omit<PluginBuildAttestation, "builder">): Uint8Array {
  return canonicalJsonBytes({ domain: PLUGIN_ATTESTATION_DOMAIN, ...a });
}

/**
 * Sign an attestation. The caller supplies the signer — this module holds no key and mints no authority,
 * the same discipline `cabal-invite` keeps.
 */
export async function signPluginAttestation(
  a: Omit<PluginBuildAttestation, "builder">,
  signer: string,
  sign: (bytes: Uint8Array) => Promise<string>,
): Promise<PluginBuildAttestation> {
  return { ...a, builder: { signer, sig: await sign(pluginAttestationBytes(a)) } };
}

/** What a reader learns about who stood behind a build. UNSIGNED reads as its own answer, never as invalid. */
export type PluginAttestationRead = "unsigned" | "forged" | { readonly signer: string };

/**
 * Read an attestation's provenance OFFLINE — no reachable builder, no clock, nothing to phone.
 *
 * Returns the signer when the signature holds, `forged` when it does not, and `unsigned` when none rides.
 * It reports and never refuses: whether an unsigned or foreign-signed build may seed a hearth stays the
 * reader's policy, because a rule baked here would decide every operator's trust from one seat.
 */
export async function verifyPluginAttestation(
  a: PluginBuildAttestation,
  verify: (bytes: Uint8Array, sigHex: string, signerHex: string) => Promise<boolean>,
): Promise<PluginAttestationRead> {
  const builder = a.builder;
  if (!builder) return "unsigned";
  const { builder: _covered, ...covered } = a;
  return await verify(pluginAttestationBytes(covered), builder.sig, builder.signer)
    ? { signer: builder.signer }
    : "forged";
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * GenesisPluginEntry — one vendored plugin blob plus its optional attestation.
 */
/**
 * What a vendored blob IS, DECLARED rather than guessed from where it sits.
 *
 * Three kinds rode one bucket while the collector globbed a directory: the GRAMMAR every carrier is read
 * through, the BASE seed (the lararium API/shadow tiddlers that ride beside the lares + lararium bags), and
 * an operator's own optional PLUGINS. Reading them as one composition made base-seed material overturn an
 * operator's plugin epoch and an operator's plugin overturn everybody's grammar — one bucket, three
 * unrelated rhythms. The class travels with the entry so the regions derive from a declaration.
 */
export type GenesisBlobKind =
  | "grammar"   // the memetic-wikitext grammar — REQUIRED, and kāhuli's GRAMMAR tier
  | "base"      // required base seed (API/shadow tiddlers) — ships, ratchets nothing
  | "plugin";   // an operator's own offering, layered on top of the required base

export interface GenesisPluginEntry {
  readonly id:          string;
  readonly version:     string;
  readonly sha256:      string;
  readonly mimeType:    string;
  readonly blob:        Uint8Array;
  /** DECLARED class. Absent reads as `plugin` — the grammar is recognised by its own URI regardless. */
  readonly kind?:       GenesisBlobKind;
  readonly license?:    string;
  readonly author?:     string;
  readonly source?:     string;
  readonly attestation?: PluginBuildAttestation;
}

/**
 * GenesisInputs — everything buildGenesisDoc() needs to construct the artifact.
 *
 * All byte values arrive as Uint8Array. The caller owns how they obtained them
 * (readFileSync, fetch, bundler inline, test fixture). buildGenesisDoc() treats
 * them as opaque byte sequences and hashes/stores them accordingly.
 *
 * actorSeed: caller-derived hex string (e.g. sha256 of sorted input hashes).
 *   buildGenesisDoc() uses it as the Automerge actor ID for determinism.
 *
 * systemTitles: list of TW5 shadow tiddler titles from a bare core boot.
 *   Caller boots TW5Engine and passes the result. buildGenesisDoc() does not
 *   depend on @lararium/tw5.
 */
export interface GenesisInputs {
  /** Deterministic actor seed — hex string. */
  readonly actorSeed:     string;
  /** TW5 core JavaScript blob. */
  readonly coreBlob:      Uint8Array;
  /** TW5 version string for the core blob. */
  readonly coreVersion:   string;
  /** TW5 core sha256 hex (caller-computed or buildGenesisDoc computes it). */
  readonly coreSha256?:   string;
  /** Vendored plugin blobs. Must include the Lares memetic-wikitext plugin. */
  readonly plugins:       readonly GenesisPluginEntry[];
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * GenesisArtifact — output of buildGenesisDoc().
 *
 * bytes: the deterministic Automerge verification witness (never a shipped boot file).
 * sha256: hex hash of the final bytes (forward integrity over the finished doc).
 * cid: CIDv1 raw-sha256 of the final bytes (forward integrity).
 * engineCid: content-CID of the engine region (TW5 core + version) — the hearth
 *   TRUE-NAME (G-D3) and the SLOW ratchet. A pure function of inputs, never of doc bytes.
 * grammarCid: content-CID of the grammar region — the REQUIRED memetic-wikitext grammar ALONE.
 *   kāhuli's FAST ratchet: an overturn the mesh takes together, leaving engineCid stable.
 * pluginsCid: content-CID of the plugins region (sorted plugin id/version/sha256) — THIS operator's
 *   own collection. A region, never a kāhuli tier: any operator offers their own on top of the
 *   required blobs, and plugin drift is not grammar drift.
 *
 * The three region CIDs are INPUTS (content functions), not derived from the saved
 * bytes — so the witness tiddlers carry them in a SINGLE write pass. No self-referential
 * fixpoint: the old "strip the genesis-cid tiddler → hash === preSha256" dance is gone.
 */
export interface GenesisArtifact {
  readonly bytes:      Uint8Array;
  readonly sha256:     string;
  readonly cid:        string;
  readonly engineCid:  string;
  /** The GRAMMAR region — kāhuli's fast ratchet over the required memetic-wikitext grammar alone. */
  readonly grammarCid: string;
  /** The PLUGINS region — this operator's OWN collection, layered on the required base. Moves alone. */
  readonly pluginsCid: string;
  /**
   * The logical CAS inventory derived strictly from `seed`. It names every
   * `genesis/cas/<cid>` file for build, bulb, and public-wire work; it is never
   * a second genesis file.
   */
  readonly casManifest: GenesisCasManifest;
  /**
   * Every CAS-bound blob's {cid, bytes} — what the build sink writes to
   * `genesis/cas/<cid>`. Held in memory only; never embedded in the CRDT.
   */
  readonly casEntries:  readonly { readonly cid: string; readonly bytes: Uint8Array }[];
  /**
   * The PLAIN-DATA genesis seed — the oracle doc's initial state as JSON (no Automerge
   * bytes). The build sink writes it to `seed.json`; the boot MATERIALIZES
   * the oracle CRDT fresh from it under the deterministic doc id (slice 2). This is
   * the boot artifact now; the Automerge `bytes` survive only as a test witness.
   */
  readonly seed:        GenesisSeed;
}

// ---------------------------------------------------------------------------
// The plain-data genesis seed (slice 2: genesis is data, not a baked CRDT)
// ---------------------------------------------------------------------------

export const GENESIS_SEED_FORMAT = "lararium-genesis-seed/v1" as const;

/**
 * GenesisSeed — the oracle doc's initial state as PLAIN DATA (JSON-serializable).
 *
 * It carries exactly what the oracle CRDT is seeded with: the schema version, the
 * blob METADATA map (descriptors only — bytes ride the CID plane), and the system
 * tiddlers map (bag descriptors, system recipes, blob descriptors, region witnesses).
 * `actorSeed` pins the Automerge actor so `materializeGenesisDoc(seed)` is byte-stable
 * — two peers materialize byte-identical history, safe to share one deterministic id.
 */
export interface GenesisSeed {
  readonly format:        typeof GENESIS_SEED_FORMAT;
  readonly actorSeed:     string;
  readonly schemaVersion: string;
  readonly blobs:         Record<string, LarBlobEntry>;
  readonly tiddlers:      Record<string, unknown>;
}

const GENESIS_BLOB_CID = /^[0-9a-f]{64}$/;

/**
 * Derive the logical CAS inventory from the immutable seed.
 *
 * The inventory remains a useful in-memory bulb/public-wire payload, but it is
 * no longer a second boot file.  This function is deliberately strict: a seed
 * with a malformed blob row, duplicate CID, or missing region witness cannot
 * quietly turn into an empty or widened CAS set.
 */
export function genesisCasManifestFromSeed(seed: GenesisSeed): GenesisCasManifest {
  if (!seed || seed.format !== GENESIS_SEED_FORMAT) {
    throw new Error(`[genesis-derive] unsupported seed format: ${String(seed?.format)}`);
  }
  if (!seed.blobs || typeof seed.blobs !== "object" || Array.isArray(seed.blobs)) {
    throw new Error("[genesis-derive] seed blobs must be an object");
  }
  const rows = Object.entries(seed.blobs)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, blob]) => {
      if (!blob || typeof blob !== "object") throw new Error(`[genesis-derive] blob ${id} is not an object`);
      if (blob.id !== id) {
        throw new Error(`[genesis-derive] blob map key/id mismatch for ${id}: declared=${String(blob.id)}`);
      }
      if (typeof blob.sha256 !== "string" || !GENESIS_BLOB_CID.test(blob.sha256)) {
        throw new Error(`[genesis-derive] blob ${id} has a noncanonical SHA-256 CID`);
      }
      if (typeof blob.mimeType !== "string" || blob.mimeType.length === 0) {
        throw new Error(`[genesis-derive] blob ${id} has no MIME type`);
      }
      if (typeof blob.version !== "string" || blob.version.length === 0) {
        throw new Error(`[genesis-derive] blob ${id} has no version`);
      }
      return { cid: blob.sha256, id, mimeType: blob.mimeType, version: blob.version };
    });
  const cids = new Set<string>();
  for (const row of rows) {
    if (cids.has(row.cid)) throw new Error(`[genesis-derive] duplicate blob CID: ${row.cid}`);
    cids.add(row.cid);
  }
  const regionCid = (name: string, title: string): string => {
    const record = seed.tiddlers?.[title] as { tiddler?: { cid?: unknown } } | undefined;
    const cid = record?.tiddler?.cid;
    if (typeof cid !== "string" || cid.length === 0) {
      throw new Error(`[genesis-derive] ${name} region witness is absent or empty: ${title}`);
    }
    return cid;
  };
  return {
    format: GENESIS_CAS_MANIFEST_FORMAT,
    engineCid: regionCid("engine", GENESIS_CID_ENGINE_TIDDLER),
    grammarCid: regionCid("grammar", GENESIS_CID_GRAMMAR_TIDDLER),
    pluginsCid: regionCid("plugins", GENESIS_CID_PLUGINS_TIDDLER),
    blobs: rows,
  };
}

// ---------------------------------------------------------------------------
// Region content-CIDs (G-D2: one doc, two ratchets; G-D3: engineCid = true-name)
// ---------------------------------------------------------------------------

/** The two genesis witness tiddlers — one per ratchet region, both in the oracle plane. */
export const GENESIS_CID_ENGINE_TIDDLER  = `${ORACLE_DOC_URI}/genesis-cid-engine`;
/** The REQUIRED grammar's own epoch — held apart from an operator's plugin collection. */
export const GENESIS_CID_GRAMMAR_TIDDLER = `${ORACLE_DOC_URI}/genesis-cid-grammar`;
export const GENESIS_CID_PLUGINS_TIDDLER = `${ORACLE_DOC_URI}/genesis-cid-plugins`;

/**
 * Validate the structural relationship between the two genesis planes.
 *
 * This is deliberately an integrity check, not an authority rule: callers compare a seed against a
 * transient logical inventory at a build or wire boundary. Matching fields prove the inventory was
 * derived from that seed; they do not confer a capability. Rich seed metadata with no CAS counterpart
 * is intentionally not compared here.
 *
 * Throws when a shared blob identity or a region witness differs. Platform-neutral and side-effect free.
 */
export function validateGenesisBundleCoherence(
  seed: GenesisSeed,
  manifest: GenesisCasManifest,
): void {
  if (seed.format !== GENESIS_SEED_FORMAT) {
    throw new Error(`[genesis-coherence] unsupported seed format: ${String(seed.format)}`);
  }
  if (manifest.format !== GENESIS_CAS_MANIFEST_FORMAT) {
    throw new Error(`[genesis-coherence] unsupported manifest format: ${String(manifest.format)}`);
  }

  const seedRows = Object.entries(seed.blobs)
    .map(([mapId, blob]) => ({
      id: mapId,
      declaredId: blob.id,
      cid: blob.sha256,
      mimeType: blob.mimeType,
      version: blob.version,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const manifestRows = [...manifest.blobs]
    .map((blob) => ({
      id: blob.id,
      declaredId: blob.id,
      cid: blob.cid,
      mimeType: blob.mimeType,
      version: blob.version,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const [index, seedRow] of seedRows.entries()) {
    if (seedRow.declaredId !== seedRow.id) {
      throw new Error(
        `[genesis-coherence] seed blob map key/id mismatch for ${seedRow.id}: ` +
        `declared=${seedRow.declaredId}`,
      );
    }
    const manifestRow = manifestRows[index];
    if (!manifestRow) {
      throw new Error(`[genesis-coherence] manifest is missing seed blob ${seedRow.id}`);
    }
    for (const field of ["id", "cid", "mimeType", "version"] as const) {
      if (seedRow[field] !== manifestRow[field]) {
        throw new Error(
          `[genesis-coherence] blob identity mismatch for ${seedRow.id}: ` +
          `${field} seed=${String(seedRow[field])} manifest=${String(manifestRow[field])}`,
        );
      }
    }
  }
  if (manifestRows.length > seedRows.length) {
    const extra = manifestRows[seedRows.length]!;
    throw new Error(`[genesis-coherence] manifest has blob absent from seed: ${extra.id}`);
  }

  const seedWitness = (title: string): string => {
    const record = seed.tiddlers[title] as { tiddler?: { cid?: unknown } } | undefined;
    const cid = record?.tiddler?.cid;
    if (typeof cid !== "string" || cid.length === 0) {
      throw new Error(`[genesis-coherence] seed region witness is absent or empty: ${title}`);
    }
    return cid;
  };
  const regions = [
    ["engine", GENESIS_CID_ENGINE_TIDDLER, manifest.engineCid],
    ["grammar", GENESIS_CID_GRAMMAR_TIDDLER, manifest.grammarCid],
    ["plugins", GENESIS_CID_PLUGINS_TIDDLER, manifest.pluginsCid],
  ] as const;
  for (const [name, title, manifestCid] of regions) {
    const seedCid = seedWitness(title);
    if (seedCid !== manifestCid) {
      throw new Error(
        `[genesis-coherence] ${name} region witness mismatch: ` +
        `seed=${seedCid} manifest=${manifestCid}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// The oracle deterministic doc id (slice 2: materialize-fresh, no shipped binary)
// ---------------------------------------------------------------------------

/**
 * The well-known seed for the oracle doc's deterministic DocumentId. STABLE FOREVER —
 * it derives from the oracle doc's canonical URI alone, never from the engine/plugin
 * content, so the public crossroads board keeps ONE address across every engine
 * churn and every peer (churn advances the pointer, never re-genesis). A
 * content-derived id would fork the board on each rebuild — the anti-pattern.
 */
export const ORACLE_GENESIS_DOC_SEED = `${ORACLE_DOC_URI}#genesis-doc-id` as const;

/**
 * oracleGenesisDocUrl — the oracle doc's DETERMINISTIC automerge: url.
 *
 * Derived from the well-known seed: the first 16 bytes of its sha256 form the
 * BinaryDocumentId. Every vessel (this peer across reboots; future mesh peers)
 * computes the SAME url, so a freshly-materialized oracle doc re-loads under one
 * stable id (persist-across-restart) and peers materialize one shared board.
 *
 * Cross-VERSION caveat (the epoch-ratchet residual): two peers that materialize
 * fresh from DIFFERENT engine versions seed different histories under this one id.
 * In practice a peer SYNCS an existing board rather than re-materialize; the rare
 * structural shift rides the epoch boundary, far-future.
 */
export function oracleGenesisDocUrl(): AutomergeUrl {
  const binId = sha256BytesSync(utf8Bytes(ORACLE_GENESIS_DOC_SEED)).slice(0, 16) as BinaryDocumentId;
  return stringifyAutomergeUrl({ documentId: binId });
}

/**
 * engineCid — content-CID of the engine region, and the hearth's true-name. A pure function of the
 * core BLOB's sha256; deterministic, no doc bytes. A plugin change must NEVER perturb it.
 *
 * THE VERSION LABEL RIDES NOWHERE NEAR THIS PREIMAGE, deliberately. Folding a version string in beside
 * the digest makes a pure RE-TAG — identical bytes, `5.5.0-prerelease` renamed `5.5.0` — mint a fresh
 * true-name, which manufactures a schism out of an editorial act. The sha256 already binds every byte
 * the label could describe; the label adds a false difference and no true one. `coreVersion` still
 * rides the blob DESCRIPTOR for a human to read, where a wrong label misleads nobody's identity.
 */
export function computeEngineCid(_coreVersion: string, coreSha256: string): string {
  return cidV1Sha256(utf8Bytes(`engine/v1\ncore-sha256:${coreSha256}`));
}

/**
 * pluginsCid — content-CID of the plugins region: the sorted {id,sha256} PAIRS, canonical-JSON, sorted
 * by id so write-order never perturbs it. Versions stay OUT for the same reason they leave the engine
 * preimage — a re-tag must not read as a different composition.
 */
type RegionEntry = { readonly id: string; readonly version: string; readonly sha256: string; readonly kind?: GenesisBlobKind };

/** Fold a region: the sorted {id, sha256} PAIRS under a DOMAIN, so two regions holding the same entries
 *  can never mint the same digest. Versions stay out — a re-tag must not read as a different composition. */
function foldRegion(domain: string, entries: readonly RegionEntry[]): string {
  const pairs = entries
    .map((p) => ({ id: p.id, sha256: p.sha256 }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return cidV1Sha256(utf8Bytes(`${domain}\n${JSON.stringify(pairs)}`));
}

const isGrammar  = (p: RegionEntry): boolean => p.id === LARES_MEMETIC_WIKITEXT_PLUGIN_URI;
const isBaseSeed = (p: RegionEntry): boolean => p.kind === "base";

/**
 * THE PLUGINS REGION — an OPERATOR'S OWN COLLECTION, layered on the required base.
 *
 * It folds neither the grammar nor the base seed: any operator offers their own plugins on top of the
 * required blobs and the lares/lararium bags, and doing so must overturn nothing anyone else stands on.
 * A plugin added here moves THIS operator's plugin epoch and nothing further.
 */
export function computePluginsCid(plugins: readonly RegionEntry[]): string {
  return foldRegion("plugins/v1", plugins.filter((p) => !isGrammar(p) && !isBaseSeed(p)));
}

/**
 * THE GRAMMAR REGION — kāhuli's fast ratchet, folded over the memetic-wikitext grammar ALONE.
 *
 * kāhuli overturns exactly two tiers: ENGINE (the core's true-name, the slow ratchet) and GRAMMAR (the
 * parser every carrier is read through). The grammar is REQUIRED — every lararium reads through it — so it
 * earns its own epoch, held apart from whatever plugins an operator happens to offer. Folding the two
 * together let one operator's extra plugin overturn EVERYBODY's grammar: the same false schism the region
 * CIDs were split to prevent, arriving through the composition instead of through a version label.
 *
 * BASE SEED SITS IN NEITHER. `lararium-boot-shadows` is not a plugin at all — it is the API/shadow tiddler
 * seed that rides beside the lares + lararium bags. It ships as a required blob, attested by its manifest
 * sha; a change to it moves the ISLAND, never an epoch, because it binds no membership and no reading.
 *
 * Each SELECTION lives at one site, because the mint and the verify both reach it — a rule copied to two
 * call sites is a rule that drifts, and a drifted region reads as a corrupt genesis.
 */
export function computeGrammarCid(plugins: readonly RegionEntry[]): string {
  return foldRegion("grammar/v1", plugins.filter(isGrammar));
}

// ---------------------------------------------------------------------------
// Root bag catalog
// ---------------------------------------------------------------------------

/**
 * The bags GENESIS itself stands — the universal floor every vessel carries, and nothing else.
 *
 * A FACE'S PLANES ARE NOT DECLARED HERE. The persona · circles · identities · sessions planes each derive their id
 * from the tag their PersonaGroup mints, so no name for them exists when this seed is built, and a genesis
 * every vessel shares can describe no plane belonging to one person. They describe themselves at founding,
 * where the knowledge lives.
 */
const ROOT_BAGS = [
  { bagId: ORACLE_DOC_URI,     label: "ha — runtime system island (Oracle)",       readPolicy: "public",  writePolicy: "private" },
  { bagId: LARARIUM_DOC_URI,   label: "ha — memetic corpus (Lararium)",            readPolicy: "public",  writePolicy: "private" },
  { bagId: CATALOG_DOC_URI,    label: "ka — corpus discovery (Catalog)",            readPolicy: "public",  writePolicy: "private" },
  { bagId: LARES_DOC_URI,      label: "ba — persona & doctrine (Lares)",            readPolicy: "public",  writePolicy: "private" },
] as const;

// ---------------------------------------------------------------------------
// Core builder
// ---------------------------------------------------------------------------

/**
 * buildGenesisSeed() — assemble the oracle doc's initial state as PLAIN DATA.
 *
 * Platform-neutral, no Automerge: it builds the blob METADATA map (descriptors only;
 * bytes ride the CID plane) and the system tiddlers map (bag descriptors, system
 * recipes, blob descriptors, region witnesses). `materializeGenesisDoc(seed)` turns
 * it into the live oracle CRDT at boot — the genesis is data, never a baked binary.
 */
export function buildGenesisSeed(inputs: GenesisInputs, coreSha256?: string): GenesisSeed {
  const coreSha     = coreSha256 ?? inputs.coreSha256 ?? sha256HexBytesSync(inputs.coreBlob);
  const coreVersion = inputs.coreVersion;

  // Blob METADATA (core + plugins) — bytes ship as genesis/cas/<cid> files, never here.
  const blobs: Record<string, LarBlobEntry> = {};
  blobs[ENGINE_CORE_ID] = {
    id:       ENGINE_CORE_ID,
    version:  coreVersion,
    sha256:   coreSha,
    mimeType: "application/javascript",
    license:  "BSD-3-Clause",
    author:   "UnaMesa Association",
    source:   "https://tiddlywiki.com",
  };
  for (const entry of inputs.plugins) {
    blobs[entry.id] = {
      id:       entry.id,
      version:  entry.version,
      sha256:   entry.sha256,
      mimeType: entry.mimeType,
      // The declared class travels INTO the doc, so the verify classifies exactly as the mint did.
      ...(entry.kind    && { kind:    entry.kind }),
      ...(entry.license && { license: entry.license }),
      ...(entry.author  && { author:  entry.author }),
      ...(entry.source  && { source:  entry.source }),
    };
  }

  const tiddlers: Record<string, unknown> = {};

  // Bag descriptor tiddlers.
  for (const { bagId, label, readPolicy, writePolicy } of ROOT_BAGS) {
    tiddlers[bagDescriptorUri(bagId)] = {
      tiddler: { title: bagDescriptorUri(bagId), label, readPolicy, writePolicy, "$origin-bag": ORACLE_DOC_URI },
      meta: { authority: "genesis" },
    };
  }

  // SYSTEM wiki-recipes — the lares + lararium quine
  // wikis ride the oracle system plane, never the catalog registry (USER recipes mint into it).
  // The record spells the SAME cascade the mount lays (`recipeRecordFields` ⇆ `recipeFromRecord`):
  // the lares wiki = oracle floor + lararium library + its own canon; `writable-bag` = working.
  const systemRecipe = (recipe: WikiRecipe) => {
    const title = recipeUri("oracle", recipe.wikiSlug);
    tiddlers[title] = {
      tiddler: { title, ...recipeRecordFields(recipe) },
      meta: { authority: "genesis" },
    };
  };
  systemRecipe({ wikiSlug: "lares", libraryBags: [LARARIUM_DOC_URI] });
  systemRecipe({ wikiSlug: "lararium" });

  // Blob descriptor tiddlers (sorted by blob id — deterministic).
  for (const blobId of Object.keys(blobs).sort()) {
    const entry    = blobs[blobId]!;
    const isPlugin = blobId.startsWith("$:/plugins/") || blobId.startsWith("lar:///plugins/");
    const att      = inputs.plugins.find(p => p.id === blobId)?.attestation;
    tiddlers[blobDescriptorUri(blobId)] = {
      tiddler: {
        title:  blobDescriptorUri(blobId),
        text:   blobId,
        sha256:   entry.sha256,
        version:  entry.version,
        mimeType: entry.mimeType,
        ...(entry.author  && { author:  entry.author }),
        ...(entry.source  && { source:  entry.source }),
        ...(entry.license && { license: entry.license }),
        ...(isPlugin && { pluginInstallable: "true", pluginTitle: blobId }),
        ...(att && {
          buildAttestationFormat:    att.format,
          canonicalTitle:            att.canonicalTitle,
          ...(att.compatibilityTitle   && { compatibilityTitle:   att.compatibilityTitle }),
          moduleManifestPath:          att.moduleManifestPath,
          moduleManifestSha256:        att.moduleManifestSha256,
          ...(att.sourceManifestPath   && { sourceManifestPath:   att.sourceManifestPath }),
          ...(att.sourceManifestSha256 && { sourceManifestSha256: att.sourceManifestSha256 }),
          ...(att.packTranscriptPath   && { packTranscriptPath:   att.packTranscriptPath }),
          ...(att.packTranscriptSha256 && { packTranscriptSha256: att.packTranscriptSha256 }),
          moduleCount:        String(att.moduleCount),
          packedTiddlerCount: String(att.packedTiddlerCount),
          pluginJsonSha256:   att.pluginJsonSha256,
        }),
        tags: isPlugin ? "blob-descriptor plugin-descriptor" : "blob-descriptor",
        "$origin-bag": ORACLE_DOC_URI,
      },
      meta: { authority: "genesis" },
    };
  }

  // Region content-CID witnesses — THREE rhythms, never one bucket: the engine's true-name (slow), the
  // required grammar's epoch (kāhuli's fast ratchet), and this operator's own plugin collection.
  const engineCid  = computeEngineCid(coreVersion, coreSha);
  const grammarCid = computeGrammarCid(inputs.plugins);
  const pluginsCid = computePluginsCid(inputs.plugins);
  tiddlers[GENESIS_CID_ENGINE_TIDDLER] = {
    tiddler: {
      title: GENESIS_CID_ENGINE_TIDDLER, text: "", cid: engineCid,
      note:  "engine content-CID (TW5 core + version) — the hearth true-name; slow ratchet",
      "$origin-bag": ORACLE_DOC_URI,
    },
    meta: { authority: "genesis" },
  };
  tiddlers[GENESIS_CID_GRAMMAR_TIDDLER] = {
    tiddler: {
      title: GENESIS_CID_GRAMMAR_TIDDLER, text: "", cid: grammarCid,
      note:  "grammar content-CID (the required memetic-wikitext grammar alone) — kāhuli's fast ratchet",
      "$origin-bag": ORACLE_DOC_URI,
    },
    meta: { authority: "genesis" },
  };
  tiddlers[GENESIS_CID_PLUGINS_TIDDLER] = {
    tiddler: {
      title: GENESIS_CID_PLUGINS_TIDDLER, text: "", cid: pluginsCid,
      note:  "plugins content-CID — THIS operator's own collection, layered on the required base",
      "$origin-bag": ORACLE_DOC_URI,
    },
    meta: { authority: "genesis" },
  };

  return { format: GENESIS_SEED_FORMAT, actorSeed: inputs.actorSeed, schemaVersion: "0.1", blobs, tiddlers };
}

/**
 * materializeGenesisDoc() — build the oracle doc's Automerge bytes from the plain-data seed.
 *
 * Deterministic: pinned actor (`seed.actorSeed`), `time: 0`, sorted key order — two
 * peers materialize byte-identical history, so they may share one deterministic doc
 * id safely. Called at BOOT (open-node-vessel) to seed a fresh oracle doc, and by the
 * verifier. The genesis ships as `seed`, never
 * as these bytes.
 */
export function materializeGenesisDoc(seed: GenesisSeed): Uint8Array {
  let doc = automergeInit<LarDoc>({ actor: seed.actorSeed });
  doc = automergeChange(doc, { time: 0 }, d => {
    const r = d as unknown as Record<string, unknown>;
    r["schemaVersion"] = seed.schemaVersion;
    const blobs: Record<string, unknown> = {};
    for (const k of Object.keys(seed.blobs).sort()) blobs[k] = seed.blobs[k];
    r["blobs"] = blobs;
    const tiddlers: Record<string, unknown> = {};
    for (const k of Object.keys(seed.tiddlers).sort()) tiddlers[k] = seed.tiddlers[k];
    r["tiddlers"] = tiddlers;
  });
  return automergeSave(doc);
}

/**
 * buildGenesisDoc() — construct the genesis artifact: the plain-data seed (the boot
 * artifact), the deterministic Automerge bytes (verifier only),
 * the three region CIDs, and the CAS manifest + blob entries (the CID plane).
 *
 * Platform-neutral. No filesystem, no DOM. Accepts assembled byte inputs.
 */
export function buildGenesisDoc(inputs: GenesisInputs): GenesisArtifact {
  const coreSha     = inputs.coreSha256 ?? sha256HexBytesSync(inputs.coreBlob);
  const coreVersion = inputs.coreVersion;

  const seed   = buildGenesisSeed(inputs, coreSha);
  const bytes  = materializeGenesisDoc(seed);
  const sha256 = sha256HexBytesSync(bytes);
  const cid    = cidV1Sha256(bytes);

  const engineCid  = computeEngineCid(coreVersion, coreSha);
  const grammarCid = computeGrammarCid(inputs.plugins);
  const pluginsCid = computePluginsCid(inputs.plugins);

  // The CAS plane: the bytes the CRDT no longer carries, keyed by sha256 (the CID). EVERY vendored blob
  // ships — grammar, base seed and operator plugins alike. Which REGION a blob names is a separate
  // question from whether it travels: the base seed rides here and stands in no region at all.
  // The build sink writes each to genesis/cas/<cid>; the loader mirrors them by manifest.
  const casEntries: { cid: string; bytes: Uint8Array }[] = [
    { cid: coreSha, bytes: inputs.coreBlob },
    ...inputs.plugins.map((p) => ({ cid: p.sha256, bytes: p.blob })),
  ];
  const casManifest = genesisCasManifestFromSeed(seed);

  return { bytes, sha256, cid, engineCid, grammarCid, pluginsCid, casManifest, casEntries, seed };
}

// ---------------------------------------------------------------------------
// Smoke verifier
// ---------------------------------------------------------------------------

/**
 * verifyGenesisArtifact() — reload and assert the core blob + BOTH region witness
 * tiddlers present, then RECOMPUTE each region content-CID from the reloaded content
 * and assert it matches the witness AND the artifact. A content-CID is a pure function
 * of inputs, so a mismatch names a corrupt or tampered artifact — never a fixpoint wobble.
 *
 * Throws on failure. Returns tiddler/blob counts for diagnostics.
 * Platform-neutral — uses automergeLoad from mesh.
 */
export function verifyGenesisArtifact(
  artifact: GenesisArtifact,
): { blobCount: number; tiddlerCount: number } {
  // The seed and CAS manifest remain independent planes; this witness only proves their shared
  // identity fields and region pointers describe one build before the CRDT is reloaded.
  validateGenesisBundleCoherence(artifact.seed, artifact.casManifest);
  const doc = automergeLoad<LarDoc>(artifact.bytes);

  const core = doc.blobs?.[ENGINE_CORE_ID];
  if (!core) {
    throw new Error("[genesis] verify FAILED: TW5 core blob not found after reload");
  }

  const readWitness = (title: string): string => {
    const cid = (doc.tiddlers?.[title] as { tiddler?: { cid?: string } } | undefined)?.tiddler?.cid;
    if (!cid || cid.length < 10) {
      throw new Error(`[genesis] verify FAILED: witness tiddler ${title} absent or empty — stored=${cid}`);
    }
    return cid;
  };
  const storedEngineCid  = readWitness(GENESIS_CID_ENGINE_TIDDLER);
  const storedGrammarCid = readWitness(GENESIS_CID_GRAMMAR_TIDDLER);
  const storedPluginsCid = readWitness(GENESIS_CID_PLUGINS_TIDDLER);

  const recomputedEngineCid = computeEngineCid(core.version, core.sha256);
  if (recomputedEngineCid !== storedEngineCid || recomputedEngineCid !== artifact.engineCid) {
    throw new Error(
      `[genesis] verify FAILED: engineCid (hearth true-name) mismatch — ` +
      `recomputed=${recomputedEngineCid} stored=${storedEngineCid} artifact=${artifact.engineCid}`,
    );
  }
  // Each region recomputes from the SAME declared classes the mint folded — the blob descriptors carry
  // `kind`, so a base-seed blob lands outside BOTH FOLDED regions (grammar and plugins) here exactly as
  // it did at the mint. The engine stands apart from both — its preimage is not a region fold.
  const vendored = Object.values(doc.blobs ?? {}).filter((b) => b.id !== ENGINE_CORE_ID)
    .map((b) => ({ id: b.id, version: b.version, sha256: b.sha256, ...(b.kind ? { kind: b.kind as GenesisBlobKind } : {}) }));

  const recomputedGrammarCid = computeGrammarCid(vendored);
  if (recomputedGrammarCid !== storedGrammarCid || recomputedGrammarCid !== artifact.grammarCid) {
    throw new Error(
      `[genesis] verify FAILED: grammarCid mismatch — ` +
      `recomputed=${recomputedGrammarCid} stored=${storedGrammarCid} artifact=${artifact.grammarCid}`,
    );
  }

  const recomputedPluginsCid = computePluginsCid(vendored);
  if (recomputedPluginsCid !== storedPluginsCid || recomputedPluginsCid !== artifact.pluginsCid) {
    throw new Error(
      `[genesis] verify FAILED: pluginsCid mismatch — ` +
      `recomputed=${recomputedPluginsCid} stored=${storedPluginsCid} artifact=${artifact.pluginsCid}`,
    );
  }

  return {
    blobCount:    Object.keys(doc.blobs ?? {}).length,
    tiddlerCount: Object.keys(doc.tiddlers ?? {}).length,
  };
}
