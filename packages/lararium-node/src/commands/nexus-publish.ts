/**
 * nexus-publish — the Node shore of the immutable plugin offering door.
 *
 * This command publishes a LOCAL OFFERING SOURCE — never genesis (H3, R2). `source=<dir>` names a
 * directory this operator already holds: `<dir>/offering.json` plus each blob's bytes beside it. The
 * genesis seed carries the boot set alone and names no registry of what an operator may offer:
 * reading `$:/plugins/*` blobs out of it folds to an EMPTY gift (an empty offering that still signs,
 * verifies and announces).
 *
 * TWO SOURCE SHAPES (offerings-handoff.md "Who signs"):
 *   - A SIGNED GIFT (`offering.json` already carries `sig`/`offeror`/`pluginsCid`): a friend's offering,
 *     carried here to republish toward this Nexus's own publication board. `verifyPluginOffering` must pass,
 *     and it is announced EXACTLY as signed — never re-signed, never re-derived (the friend's-gift law).
 *     Its blobs' bytes sit at `<dir>/<sha256>` (content-addressed; the signed record itself carries no
 *     filename field to ride unsigned on the same CID).
 *   - An UNSIGNED SOURCE DESCRIPTOR (`{ blobs: [{ id, version, sha256, provenance, file }] }`, no `sig`):
 *     this operator's own collection, not yet offered by anyone. The active persona signs it fresh, as
 *     PUBLISHER, with provenance riding inside the signed preimage. `file` names each blob's bytes,
 *     relative to `<dir>` — a LOCAL layout convenience, never part of what gets signed.
 *
 * Every blob's bytes are hash-checked against its declared `sha256` BEFORE anything is signed or
 * announced (`missing-bytes`/`corrupt-bytes`, `verifyCasBytes`) — then written into this publisher's
 * own CAS, so `nexus offering inspect` reads them held and a joinee can take them. A boot-set id never
 * verifies (`boot-set-collision`); an empty source never verifies (`empty-offering`).
 *
 * UNDER A PŪLAMA the vessel holds no face root, so the signature comes from the pūlama's hand door, in the lei pattern:
 *   - `terms` (`runNexusPublishTerms`): every check above runs, and the read answers the face and the CLOSED descriptor the
 *     root would sign (`offeror` · `pluginsCid` · `blobs`), signing nothing, writing nothing and asking no route.
 *   - the pūlama's `publish '<terms>'` signs that one descriptor under the face's root (`pulama-hand`).
 *   - `signed` (the land): every check runs again over the same source, the descriptor it folds to is derived afresh, and the
 *     signed offering lands only where its signed preimage equals that descriptor's byte for byte, under the face's own root
 *     key, and verifies; then CAS and the announce run as for any signing. The land opens no ward.
 *
 * The active persona is explicit custody. A faceless Node can carry a publication board, but it cannot
 * publish in a human's name; an unset selector therefore refuses instead of choosing handle zero.
 */

import { wardRootSigner } from "../ward-signer.js";
import type { WardCredential } from "../ward-credential.js";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Repo } from "@automerge/automerge-repo";
import { publicationDocUrl, materializeSharedLarDoc } from "@lararium/mesh/deterministic-doc";
import {
  pluginOfferingBytes,
  pluginOfferingCid,
  signPluginOffering,
  verifyPluginOffering,
  type OfferedBlob,
  type PluginOffering,
  type PluginProvenance,
} from "@lararium/mesh/plugin-offering";
import { verifyCasBytes } from "@lararium/mesh/cas";
import { PLUGIN_OFFERING_DOMAIN } from "@lararium/mesh/domains";
import { computePluginsCid } from "@lararium/mesh/genesis-doc";
import { writeOfferingAnnounce } from "@lararium/mesh/offering-announce";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import { readGenesisCasManifest } from "../genesis-artifact.js";
import { FaceNotNamed, resolveFace } from "../face-selector.js";
import { casDirForStorage, writeCasEntriesFs } from "../node-cas.js";
import {
  loadPersonaGroupRootVerifyingKey,
  loadVesselVerifyingKey,
  personaRootExists,
} from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";

export class NexusPublishError extends Error {}

export interface NexusPublishPluginsOptions {
  /** The face's ward route for this act (seat-harness#/the-ward): the root signs only under a fresh ward unlock. */
  readonly ward?: WardCredential;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo: Repo;
  /** This vessel's own storage root — where the publisher's CAS (`casDirForStorage`) lives. */
  readonly storageDir: string;
  /** A LOCAL offering source directory: `offering.json` plus each blob's bytes beside it. */
  readonly source: string;
  /** The genesis directory whose blob ids `boot-set-collision` reads; absent, the vessel's own (`readGenesisSeed`'s default). */
  readonly genesisDir?: string;
  /** The face that signs the offering: named by the caller, else the one face standing open. */
  readonly handleIndex?: number;
  /** THE HAND'S SIGNATURE, from the pūlama's hand door: the offering the face root signed over this source's descriptor. It lands
   *  only where its signed preimage equals the descriptor this source folds to, under the face's own root key; it opens no ward. */
  readonly signed?: unknown;
}

/** What the pūlama's `publish` act takes: the face, and the CLOSED descriptor its root signs (the `signPluginOffering` parts). */
export interface NexusPublishTerms {
  readonly face: number;
  readonly offering: Omit<PluginOffering, "kind" | "sig">;
}

export interface NexusPublishPluginsResult {
  readonly offering: PluginOffering;
  readonly offeringCid: string;
  readonly boardUrl: string;
  readonly offeror: string;
  readonly pluginsCid: string;
  readonly blobCount: number;
}

/** An unsigned source descriptor's one blob — the signed shape plus a LOCAL, unsigned `file` path. */
interface SourceDescriptorBlob {
  readonly id: string;
  readonly version: string;
  readonly sha256: string;
  readonly provenance?: PluginProvenance;
  readonly file?: string;
}
interface SourceDescriptor {
  readonly blobs: readonly SourceDescriptorBlob[];
}

function isSignedGift(v: unknown): v is PluginOffering {
  return !!v && typeof v === "object" && typeof (v as { sig?: unknown }).sig === "string";
}

/** Read one blob's bytes off the source dir — `file` when the descriptor names one, else the blob's
 *  own sha256 as a content-addressed filename (the signed-gift convention, which carries no `file`). */
function sourceBlobPath(sourceDir: string, blob: { readonly sha256: string; readonly file?: string }): string {
  return join(sourceDir, blob.file ?? blob.sha256);
}

/** One offering source, read and judged: the face, the blobs as the descriptor names them, their verified bytes, and a gift. */
interface ReadSource {
  readonly handleIndex: number;
  readonly blobsIn: readonly SourceDescriptorBlob[];
  readonly bytesByCid: ReadonlyMap<string, Uint8Array>;
  readonly parsedGift: PluginOffering | null;
}

/** The descriptor this face's root signs over an unsigned source: its own root key as offeror, the region its blobs fold to. */
async function descriptorOf(src: ReadSource): Promise<Omit<PluginOffering, "kind" | "sig">> {
  const offeror = await loadPersonaGroupRootVerifyingKey(src.handleIndex);
  if (!offeror) {
    throw new NexusPublishError(
      `the active persona h${src.handleIndex} has no readable public root — publishing refuses`,
    );
  }
  const blobs: readonly OfferedBlob[] = src.blobsIn.map((b) => ({
    id: b.id, version: b.version, sha256: b.sha256, ...(b.provenance ? { provenance: b.provenance } : {}),
  }));
  return { offeror: offeror.toLowerCase(), pluginsCid: computePluginsCid(blobs), blobs };
}

/**
 * THE TERMS READ (under a pūlama): every check a publish runs over the source, and the face and the CLOSED descriptor its root
 * would sign, for the pūlama's hand door. It signs nothing, writes nothing and asks no route. A signed gift needs no hand
 * signature, so it refuses: `apply=true` announces it as signed.
 */
export async function runNexusPublishTerms(opts: Omit<NexusPublishPluginsOptions, "repo" | "signed" | "ward">): Promise<NexusPublishTerms> {
  const src = await readSource(opts);
  if (src.parsedGift) throw new NexusPublishError("this source carries a signed gift (offering-signed): it announces exactly as signed with apply=true, and no hand signs it again");
  const offering = await descriptorOf(src);
  return { face: src.handleIndex, offering: { offeror: offering.offeror, pluginsCid: offering.pluginsCid, blobs: canonicalBlobsOf(offering) } };
}

/** The blobs in the canonical order and shape the signed preimage carries, so the terms name exactly what the root signs. */
function canonicalBlobsOf(parts: Omit<PluginOffering, "kind" | "sig">): readonly OfferedBlob[] {
  return (JSON.parse(new TextDecoder().decode(pluginOfferingBytes(parts))) as { blobs: OfferedBlob[] }).blobs;
}

const sameBytes = (x: Uint8Array, y: Uint8Array): boolean => x.length === y.length && x.every((b, i) => b === y[i]);

/** Read one offering source and judge it: the face, the descriptor, the boot set and every blob's bytes, before any signature. */
async function readSource(opts: Omit<NexusPublishPluginsOptions, "repo" | "signed" | "ward">): Promise<ReadSource> {
  // The face the act names, else the one face standing open; several and none named refuse by name (face=N).
  const handleIndex = await resolveFace(opts.handleIndex).catch((e: unknown) => {
    if (e instanceof FaceNotNamed) throw new NexusPublishError(`publishing requires a face to sign as — ${e.message}`);
    throw e;
  });
  if (!(await personaRootExists(handleIndex))) {
    throw new NexusPublishError(
      `the active persona h${handleIndex} is not held by this vessel — publishing refuses without root custody`,
    );
  }

  const sourceDir = resolve(opts.source);
  const descriptorPath = join(sourceDir, "offering.json");
  if (!existsSync(descriptorPath)) {
    throw new NexusPublishError(`no offering source at ${descriptorPath} — publishing refuses with nothing to read`);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(descriptorPath, "utf8")); }
  catch (err) { throw new NexusPublishError(`${descriptorPath} does not read as JSON: ${(err as Error).message}`); }

  const blobsIn: readonly SourceDescriptorBlob[] = Array.isArray((parsed as { blobs?: unknown })?.blobs)
    ? (parsed as SourceDescriptor).blobs : [];
  if (blobsIn.length === 0) {
    // L-e: this refusal now NAMES its code, exactly as the other three (`boot-set-collision`,
    // `boot-set-unknown`, `missing-bytes`/`corrupt-bytes`) already do.
    throw new NexusPublishError("refusing to announce an offering that does not self-verify (empty-offering): an offering with no blobs names nothing to take");
  }

  // BOOT-SET COLLISION, BEFORE ANYTHING ELSE TOUCHES BYTES. A source naming a boot-set id (the
  // grammar, boot shadows, the engine core) can never verify — a third party's "plugin" shadowing the
  // fixed floor is precisely what `boot-set-collision` exists to refuse (M3, reused here at publish time
  // rather than only at a recipe's selection).
  //
  // M-d (gp3-episkopos, measured live): an ABSENT or unreadable genesis seed read as "no boot ids" —
  // `readGenesisCasManifest(...)?.blobs ?? []` folds null into an EMPTY set, so moving genesis aside
  // let a source claiming the grammar's own id sign and announce as a PUBLISHER record. An empty
  // protect set must never mean "nothing to guard" (`genesis-artifact.ts`'s own protect-set law) — a
  // null manifest here refuses by name instead, `boot-set-unknown`, rather than failing open.
  const manifest = readGenesisCasManifest(opts.genesisDir);
  if (manifest === null) {
    throw new NexusPublishError(
      "refusing to announce an offering whose boot-set collision cannot be checked (boot-set-unknown): no readable genesis seed at this root",
    );
  }
  const genesisIds = new Set(manifest.blobs.map((b) => b.id));
  for (const blob of blobsIn) {
    if (genesisIds.has(blob.id)) {
      throw new NexusPublishError(`refusing to announce an offering that claims a boot-set id (boot-set-collision): ${blob.id}`);
    }
  }

  // THE BYTES, HASH-CHECKED, BEFORE ANYTHING IS SIGNED OR ANNOUNCED. `missing-bytes`/`corrupt-bytes`,
  // fail-closed by name — a signature over a declared sha256 nobody can produce the bytes for proves
  // nothing a taker could ever redeem.
  const bytesByCid = new Map<string, Uint8Array>();
  const verdict = verifyCasBytes(
    blobsIn.map((b) => b.sha256),
    (cid) => {
      if (bytesByCid.has(cid)) return bytesByCid.get(cid)!;
      const blob = blobsIn.find((b) => b.sha256 === cid);
      const path = blob ? sourceBlobPath(sourceDir, blob) : join(sourceDir, cid);
      if (!existsSync(path)) return null;
      const bytes = new Uint8Array(readFileSync(path));
      bytesByCid.set(cid, bytes);
      return bytes;
    },
    sha256HexBytesSync,
  );
  if (!verdict.ok) {
    const { code, cid } = verdict.failure;
    throw new NexusPublishError(`refusing to announce an offering whose bytes fail closed (${code}): ${cid}`);
  }

  return { handleIndex, blobsIn, bytesByCid, parsedGift: isSignedGift(parsed) ? (parsed as PluginOffering) : null };
}

/** Sign and announce an offering source on this vessel's Nexus publication board. */
export async function runNexusPublishPlugins(
  opts: NexusPublishPluginsOptions,
): Promise<NexusPublishPluginsResult> {
  const src = await readSource(opts);
  const { parsedGift, bytesByCid } = src;
  const casDir = casDirForStorage(opts.storageDir);

  let offering: PluginOffering;
  if (opts.signed !== undefined) {
    // THE HAND'S SIGNATURE FROM THE PŪLAMA lands only over THIS source's own descriptor, under THIS face's root: the land
    // derives the descriptor afresh and compares the signed preimage byte for byte, so a signature over anything else lands nothing.
    if (parsedGift) throw new NexusPublishError("this source carries a signed gift (offering-signed): it announces exactly as signed with apply=true, and lands no hand signature");
    const signed = opts.signed as PluginOffering;
    if (typeof signed !== "object" || signed === null || typeof signed.sig !== "string") throw new NexusPublishError("the hand's answer carries no signed offering (offering-unsigned)");
    const expected = await descriptorOf(src);
    let same = false;
    try { same = signed.kind === PLUGIN_OFFERING_DOMAIN && sameBytes(pluginOfferingBytes(signed), pluginOfferingBytes(expected)); } catch { same = false; }
    if (!same) {
      throw new NexusPublishError(`the signed offering names another descriptor than this source folds to under h${src.handleIndex}'s root (offering-mismatch): sign the terms this source prints`);
    }
    // THE RECORD THAT LANDS is this source's own descriptor beside the hand's signature, and nothing else the answer carried.
    offering = { kind: PLUGIN_OFFERING_DOMAIN, offeror: expected.offeror, pluginsCid: expected.pluginsCid, blobs: canonicalBlobsOf(expected), sig: signed.sig };
  } else if (parsedGift) {
    // A FRIEND'S GIFT — kept EXACTLY as signed, never re-signed, never re-derived.
    offering = parsedGift;
  } else {
    offering = await signPluginOffering(
      await descriptorOf(src),
      // The root signs this one offering under the ward, its seed opened fresh and zeroed after the signature.
      (await wardRootSigner(src.handleIndex, opts.ward, "a nexus publish")).sign,
    );
  }

  const verified = await verifyPluginOffering(offering);
  if (!verified.ok) {
    throw new NexusPublishError(`refusing to announce an offering that does not self-verify: ${verified.reason}`);
  }

  // INTO THE PUBLISHER'S OWN CAS — `nexus offering inspect` and a joinee's take both read bytes held
  // here, keyed by the SAME sha256 the offering's own descriptors declare.
  writeCasEntriesFs(offering.blobs.map((b) => ({ cid: b.sha256, bytes: bytesByCid.get(b.sha256)! })), casDir);

  const vesselKey = await loadVesselVerifyingKey();
  const boardUrl = publicationDocUrl(nodeNexusIsland({ ownVesselKey: vesselKey }));
  const repo = opts.repo;
  try {
    const board = await materializeSharedLarDoc(repo, boardUrl, "board:publication");
    // The key is the complete signed offering CID. Re-running therefore replaces only the same exact
    // projection; a changed collection or signing hand receives a distinct additive address.
    board.change((draft) => writeOfferingAnnounce(draft, offering));
    await repo.flush();
    const offeringCid = pluginOfferingCid(offering);
    return {
      offering,
      offeringCid,
      boardUrl,
      offeror: offering.offeror,
      pluginsCid: offering.pluginsCid,
      blobCount: offering.blobs.length,
    };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}
