/**
 * nexus-publish — production boundary tests for the local immutable gift door (H3, F2-3).
 *
 * `runNexusPublishPlugins` reads a LOCAL OFFERING SOURCE, never genesis — genesis carries the boot set
 * alone since the Streams retirement (`3d38cb691`), and reading `$:/plugins/*` off it folded to an
 * EMPTY gift the instant genesis stopped carrying any (H3's live finding: a `blobCount: 0` offering
 * that still signed, verified, and announced). These tests build real `--source` directories: an
 * UNSIGNED descriptor this persona signs fresh, and a pre-SIGNED gift kept exactly as signed.
 */
import { seatSuiteWard } from "./support/scratch-custody-setup.js";
// This suite stands as the person at the terminal: its root acts carry no ward route, and the suite's person answers (seat-harness#/the-ward).
seatSuiteWard();

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Repo } from "@automerge/automerge-repo";
import { restEvery, restingRepo } from "./resting-repo.js";
import {
  computePluginsCid,
  crossroadsDocUrl,
  publicationDocUrl,
  ed25519SignerFromSeed,
  ed25519VerifyingKeyFromSeed,
  GENESIS_CID_ENGINE_TIDDLER,
  GENESIS_CID_GRAMMAR_TIDDLER,
  GENESIS_CID_PLUGINS_TIDDLER,
  materializeSharedLarDoc,
  offeringAnnouncesFromDoc,
  pluginOfferingBytes,
  pluginOfferingCid,
  signPluginOffering,
  verifyPluginOffering,
  type GenesisSeed,
  type OfferedBlob,
  type PluginProvenance,
} from "@lararium/mesh";
import {
  runNexusPublishPlugins,
  runNexusPublishTerms,
  storeVerbNeedsWard,
  NexusPublishError,
  readCasBlobFromFs,
  casDirForStorage,
} from "../src/index.js";
import {
  loadPersonaGroupRootVerifyingKey as loadPersonaRootKey,
  generateOrLoadPersonaGroupRoot,
  generateOrLoadVesselIdentity,
  loadVesselVerifyingKey,
} from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { wardRootSigner } from "../src/ward-signer.js";
import { offeringTermsOf } from "../src/pulama-hand.js";
import type { Repo as StoreRepo } from "@automerge/automerge-repo";
import { direct } from "./direct-store.js";
import { seedFaceAtom } from "./atom-fixture.js";

let root: string;
let priorRoot: string | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-offering-"));
  priorRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
});

afterEach(async () => {
  // Every Repo this suite opened rests (its adapter closed) before the directory leaves: no save of theirs can land after.
  await restEvery();
  if (priorRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorRoot;
  rmSync(root, { recursive: true, force: true });
});

/** A minimal, READABLE genesis seed carrying the boot set's region witnesses alone — no blobs, so it
 *  never collides with any test's own synthetic offering ids. M-d: `boot-set-collision` now refuses
 *  (`boot-set-unknown`) when genesis is absent entirely, so every publish here needs ONE of these. */
function seedMinimalGenesis(): void {
  const genesisDir = join(root, "genesis");
  mkdirSync(genesisDir, { recursive: true });
  const seed: GenesisSeed = {
    format: "lararium-genesis-seed", actorSeed: "actor-seed",
    blobs: {},
    tiddlers: {
      [GENESIS_CID_ENGINE_TIDDLER]: { tiddler: { cid: "e".repeat(64) } },
      [GENESIS_CID_GRAMMAR_TIDDLER]: { tiddler: { cid: "b".repeat(64) } },
      [GENESIS_CID_PLUGINS_TIDDLER]: { tiddler: { cid: computePluginsCid([]) } },
    },
  };
  writeFileSync(join(genesisDir, "seed.json"), JSON.stringify(seed));
}

const PROVENANCE: PluginProvenance = {
  source: "https://example.test/example-one", commit: "a".repeat(40), path: "plugins/example/one", licence: "MIT",
};

/** An UNSIGNED source descriptor directory: `offering.json` plus the blob's bytes at `file`. */
function seedUnsignedSource(opts: { readonly file?: string; readonly corruptBytes?: boolean; readonly omitFile?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "lares-offering-source-"));
  const bytes = Buffer.from("example plugin bytes", "utf8");
  const sha256 = Buffer.from(
    require("node:crypto").createHash("sha256").update(bytes).digest(),
  ).toString("hex");
  const file = opts.file ?? "plugin.bin";
  const descriptor = {
    blobs: [{ id: "$:/plugins/example/one", version: "v1", sha256, provenance: PROVENANCE, file }],
  };
  writeFileSync(join(dir, "offering.json"), JSON.stringify(descriptor), "utf8");
  if (!opts.omitFile) writeFileSync(join(dir, file), opts.corruptBytes ? Buffer.from("tampered bytes") : bytes);
  return dir;
}

/** An EMPTY source descriptor — no blobs at all. */
function seedEmptySource(): string {
  const dir = mkdtempSync(join(tmpdir(), "lares-offering-source-"));
  writeFileSync(join(dir, "offering.json"), JSON.stringify({ blobs: [] }), "utf8");
  return dir;
}

/** A pre-SIGNED gift directory: `offering.json` already carries `sig`/`offeror`/`pluginsCid`, and its
 *  one blob's bytes sit at `<sha256>` (the signed-gift convention — the record itself carries no
 *  `file` field to ride unsigned on the same CID). Signed with a throwaway TEST seed, never a real
 *  persona's root — the whole point is that `--apply` must NOT re-sign it with ITS persona's key. */
async function seedSignedGift(): Promise<{ readonly dir: string; readonly offeror: string }> {
  const dir = mkdtempSync(join(tmpdir(), "lares-offering-source-"));
  const bytes = Buffer.from("a friend's plugin bytes", "utf8");
  const sha256 = Buffer.from(
    require("node:crypto").createHash("sha256").update(bytes).digest(),
  ).toString("hex");
  writeFileSync(join(dir, sha256), bytes);
  const seed = new TextEncoder().encode("nexus-publish.test.ts — a friend's test seed, never ours").slice(0, 32);
  const offeror = await ed25519VerifyingKeyFromSeed(seed);
  const blobs: readonly OfferedBlob[] = [{ id: "$:/plugins/friend/gift", version: "v1", sha256, provenance: PROVENANCE }];
  const offering = await signPluginOffering(
    { offeror, pluginsCid: computePluginsCid(blobs), blobs },
    ed25519SignerFromSeed(seed),
  );
  writeFileSync(join(dir, "offering.json"), JSON.stringify(offering), "utf8");
  return { dir, offeror };
}

async function standPersona(): Promise<void> {
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  await generateOrLoadPersonaGroupRoot(0);
}

describe("runNexusPublishPlugins — immutable offering boundary (H3, F2-3)", () => {
  it("signs an UNSIGNED source as PUBLISHER, announces, and retrieves the exact gift from the persisted publication board, and the mirrored crossroads document carries no announce", async () => {
    const source = seedUnsignedSource();
    seedMinimalGenesis();
    await standPersona();

    const first = await direct(runNexusPublishPlugins)({ source, storageDir: larDataDir() });
    expect(first.offeringCid).toBe(pluginOfferingCid(first.offering));
    expect(first.boardUrl).toBe(publicationDocUrl(await loadVesselVerifyingKey()));
    expect(first.blobCount).toBe(1);
    // The bytes landed in THIS publisher's own CAS, keyed by the SAME sha256 the offering declares.
    const blobSha = first.offering.blobs[0]!.sha256;
    expect(readCasBlobFromFs(blobSha, casDirForStorage(larDataDir()))).not.toBeNull();

    const second = await direct(runNexusPublishPlugins)({ source, storageDir: larDataDir() });
    expect(second.offeringCid).toBe(first.offeringCid);
    expect(second.offering).toEqual(first.offering);

    const repo = restingRepo(larDataDir());
    const board = await materializeSharedLarDoc(repo, first.boardUrl, "board:publication");
    const records = offeringAnnouncesFromDoc(board.doc());
    expect(records).toHaveLength(1);
    // The crossroads document mirrors to its canon source; an announce written there would land in the tracked tree.
    const crossroads = await materializeSharedLarDoc(repo, crossroadsDocUrl(await loadVesselVerifyingKey()), "board:crossroads");
    expect(offeringAnnouncesFromDoc(crossroads.doc()), "the crossroads mirror would write it to disk").toEqual([]);
    expect(records[0]?.offeringCid).toBe(first.offeringCid);
    expect(records[0]?.offering).toEqual(first.offering);
    await repo.rest();
  });

  it("a SIGNED gift is announced EXACTLY as signed — never re-signed under this vessel's own persona", async () => {
    const { dir: source, offeror } = await seedSignedGift();
    seedMinimalGenesis();
    await standPersona();
    const vesselKey = await loadVesselVerifyingKey();

    const result = await direct(runNexusPublishPlugins)({ source, storageDir: larDataDir() });
    expect(result.offeror).toBe(offeror);                          // the FRIEND's offeror, never the standing persona's
    expect(result.offeror).not.toBe(vesselKey);
    const announced = JSON.parse(readFileSync(join(source, "offering.json"), "utf8"));
    expect(result.offering).toEqual(announced);                     // byte-identical to what the gift already carried
  });

  it("RED: refuses by name when several faces stand and none is named; CONTROL: the face named signs", async () => {
    const source = seedUnsignedSource();
    seedMinimalGenesis();
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    for (const face of [0, 1]) { await generateOrLoadPersonaGroupRoot(face); await seedFaceAtom(face); }

    const unnamed = direct(runNexusPublishPlugins)({ source, storageDir: larDataDir() });
    await expect(unnamed).rejects.toBeInstanceOf(NexusPublishError);
    await expect(unnamed).rejects.toThrow(/--face N/);
    const named = await direct(runNexusPublishPlugins)({ source, storageDir: larDataDir(), handleIndex: 1 });
    expect(named.blobCount).toBe(1);
  });

  it("refuses when the offering source is absent", async () => {
    await standPersona();
    await expect(direct(runNexusPublishPlugins)({ source: join(root, "no-such-source"), storageDir: larDataDir() }))
      .rejects.toBeInstanceOf(NexusPublishError);
  });

  it("MUTATION PROOF — empty-offering: a source with no blobs refuses by name, never announcing a vacuous gift", async () => {
    const source = seedEmptySource();
    await standPersona();
    await expect(direct(runNexusPublishPlugins)({ source, storageDir: larDataDir() }))
      .rejects.toThrow(/empty-offering|no blobs names nothing to take/);
  });

  it("MUTATION PROOF — missing-bytes: a declared blob whose file never arrived refuses by name before anything is signed", async () => {
    const source = seedUnsignedSource({ omitFile: true });
    seedMinimalGenesis();
    await standPersona();
    await expect(direct(runNexusPublishPlugins)({ source, storageDir: larDataDir() }))
      .rejects.toThrow(/missing-bytes/);
  });

  it("MUTATION PROOF — corrupt-bytes: a blob file that does not hash to its declared sha256 refuses by name", async () => {
    const source = seedUnsignedSource({ corruptBytes: true });
    seedMinimalGenesis();
    await standPersona();
    await expect(direct(runNexusPublishPlugins)({ source, storageDir: larDataDir() }))
      .rejects.toThrow(/corrupt-bytes/);
  });

  it("CONTROL: a source naming no boot-set id publishes cleanly with a readable genesis present", async () => {
    const source = seedUnsignedSource();
    const genesisDir = join(root, "genesis-separate");
    mkdirSync(genesisDir, { recursive: true });
    const seed: GenesisSeed = {
      format: "lararium-genesis-seed", actorSeed: "actor-seed",
      blobs: {},
      tiddlers: {
        [GENESIS_CID_ENGINE_TIDDLER]: { tiddler: { cid: "e".repeat(64) } },
        [GENESIS_CID_GRAMMAR_TIDDLER]: { tiddler: { cid: "b".repeat(64) } },
        [GENESIS_CID_PLUGINS_TIDDLER]: { tiddler: { cid: computePluginsCid([]) } },
      },
    };
    writeFileSync(join(genesisDir, "seed.json"), JSON.stringify(seed));
    await standPersona();
    const result = await direct(runNexusPublishPlugins)({ source, storageDir: larDataDir(), genesisDir });
    expect(result.blobCount).toBe(1);
  });

  it("MUTATION PROOF (M-d) — boot-set-unknown: an ABSENT genesis refuses the collision check rather than failing open", async () => {
    // No seedMinimalGenesis() here — the whole point. Before M-d's fix, an absent/torn genesis read
    // as "no boot ids at all" and let a source claiming the grammar's own id sign and announce.
    // A root holding no seed now reaches the build's shipped genesis (genesis-resolve), so "absent" is declared:
    // an explicit LAR_GENESIS naming a dir with no seed never falls back.
    const priorGenesis = process.env["LAR_GENESIS"];
    process.env["LAR_GENESIS"] = join(root, "declared-absent-genesis");
    try {
      const source = seedUnsignedSource();
      await standPersona();
      await expect(direct(runNexusPublishPlugins)({ source, storageDir: larDataDir() }))
        .rejects.toThrow(/boot-set-unknown/);
    } finally {
      if (priorGenesis === undefined) delete process.env["LAR_GENESIS"];
      else process.env["LAR_GENESIS"] = priorGenesis;
    }
  });

  it("boot-set-collision: a source naming a real boot-set id refuses, WITH genesis readable", async () => {
    const genesisDir = join(root, "genesis");
    mkdirSync(genesisDir, { recursive: true });
    const bootBlobId = "$:/boot/the-grammar";
    const seed: GenesisSeed = {
      format: "lararium-genesis-seed", actorSeed: "actor-seed",
      blobs: { [bootBlobId]: { id: bootBlobId, sha256: "f".repeat(64), mimeType: "application/json", version: "v1" } },
      tiddlers: {
        [GENESIS_CID_ENGINE_TIDDLER]: { tiddler: { cid: "e".repeat(64) } },
        [GENESIS_CID_GRAMMAR_TIDDLER]: { tiddler: { cid: "b".repeat(64) } },
        [GENESIS_CID_PLUGINS_TIDDLER]: { tiddler: { cid: computePluginsCid([]) } },
      },
    };
    writeFileSync(join(genesisDir, "seed.json"), JSON.stringify(seed));
    const source = mkdtempSync(join(tmpdir(), "lares-offering-source-"));
    const bytes = Buffer.from("boot-colliding bytes", "utf8");
    const sha256 = require("node:crypto").createHash("sha256").update(bytes).digest("hex");
    writeFileSync(join(source, "plugin.bin"), bytes);
    writeFileSync(join(source, "offering.json"), JSON.stringify({
      blobs: [{ id: bootBlobId, version: "v1", sha256, provenance: PROVENANCE, file: "plugin.bin" }],
    }));
    await standPersona();
    await expect(direct(runNexusPublishPlugins)({ source, storageDir: larDataDir() }))
      .rejects.toThrow(/boot-set-collision/);
  });
});

/** The terms read, through an owned store as every act here runs (it reads the face's roster and opens no ward). */
const terms = direct(async (o: { readonly repo: StoreRepo; readonly source: string; readonly storageDir: string; readonly handleIndex?: number }) => runNexusPublishTerms(o));

describe("UNDER A PŪLAMA: the terms the hand door signs, and the land of the offering it signed", () => {
  it("RED: `terms` answers the face and the CLOSED descriptor the root signs (the hand door's own check reads it whole), and signs, writes and announces nothing", async () => {
    const source = seedUnsignedSource();
    seedMinimalGenesis();
    await standPersona();
    const read = await terms({ source, storageDir: larDataDir() });
    expect(read.face).toBe(0);
    expect(Object.keys(read.offering).sort()).toEqual(["blobs", "offeror", "pluginsCid"]);
    expect(read.offering.offeror).toBe((await loadPersonaRootKey())!.toLowerCase());
    expect(read.offering.pluginsCid).toBe(computePluginsCid(read.offering.blobs));
    // THE DOOR'S CLOSED SHAPE takes exactly what the terms name, so no field the vessel adds reaches the root unsigned.
    expect(await offeringTermsOf(read.offering)).toEqual({ terms: read.offering });
    // The descriptor carries no LOCAL `file` path: what the root signs equals what the vessel's own signing would sign.
    expect(JSON.stringify(read.offering)).not.toContain("plugin.bin");
    expect(readCasBlobFromFs(read.offering.blobs[0]!.sha256, casDirForStorage(larDataDir()))).toBeNull();
  });

  it("RED: the offering the face root signed over the terms LANDS: it verifies, announces, and equals the one the vessel's own signing makes; CONTROL: the descriptor matches byte for byte", async () => {
    const source = seedUnsignedSource();
    seedMinimalGenesis();
    await standPersona();
    const read = await terms({ source, storageDir: larDataDir() });
    // THE PŪLAMA'S HAND, as its door signs: the face root over the descriptor's offering preimage.
    const signed = await signPluginOffering(read.offering, (await wardRootSigner(0, undefined, "the test's hand")).sign);
    const landed = await direct(runNexusPublishPlugins)({ source, storageDir: larDataDir(), signed: JSON.parse(JSON.stringify(signed)) });
    expect(await verifyPluginOffering(landed.offering)).toEqual({ ok: true });
    expect(landed.offering).toEqual(signed);
    expect(landed.offeringCid).toBe(pluginOfferingCid(signed));
    expect(readCasBlobFromFs(read.offering.blobs[0]!.sha256, casDirForStorage(larDataDir()))).not.toBeNull();
    // The vessel's own signing (no pūlama) makes the same descriptor: the hand door signs exactly what `--apply` would.
    const own = await direct(runNexusPublishPlugins)({ source, storageDir: larDataDir() });
    expect(Buffer.from(pluginOfferingBytes(own.offering)).equals(Buffer.from(pluginOfferingBytes(signed)))).toBe(true);
  });

  it("RED: a signature over another descriptor, under another key, or riding an extra field lands nothing; a signed gift asks no terms and lands no hand signature", async () => {
    const source = seedUnsignedSource();
    seedMinimalGenesis();
    await standPersona();
    const read = await terms({ source, storageDir: larDataDir() });
    const root = (await wardRootSigner(0, undefined, "the test's hand")).sign;
    const moved = await signPluginOffering({ ...read.offering, blobs: read.offering.blobs.map((b) => ({ ...b, version: "v2" })) }, root);
    await expect(direct(runNexusPublishPlugins)({ source, storageDir: larDataDir(), signed: moved })).rejects.toThrow(/offering-mismatch/);
    const stranger = new Uint8Array(32).fill(5);
    const foreign = await signPluginOffering(read.offering, ed25519SignerFromSeed(stranger));
    await expect(direct(runNexusPublishPlugins)({ source, storageDir: larDataDir(), signed: foreign })).rejects.toThrow(/does not self-verify/);
    await expect(direct(runNexusPublishPlugins)({ source, storageDir: larDataDir(), signed: { blobs: "x" } })).rejects.toThrow(/offering-unsigned/);
    // An extra field the answer carried never rides the announce: the record that lands is the source's descriptor and the signature.
    const good = await signPluginOffering(read.offering, (await wardRootSigner(0, undefined, "the test's hand")).sign);
    const landed = await direct(runNexusPublishPlugins)({ source, storageDir: larDataDir(), signed: { ...good, rider: "unsigned" } });
    expect(Object.keys(landed.offering).sort()).toEqual(["blobs", "kind", "offeror", "pluginsCid", "sig"]);
    const { dir: gift } = await seedSignedGift();
    await expect(terms({ source: gift, storageDir: larDataDir() })).rejects.toThrow(/offering-signed/);
    await expect(direct(runNexusPublishPlugins)({ source: gift, storageDir: larDataDir(), signed: good })).rejects.toThrow(/offering-signed/);
  });

  it("RED: the terms read and the land open no ward (the hand signed at the pūlama); CONTROL: the vessel's own publish stays a ward act", () => {
    expect(storeVerbNeedsWard("nexus-publish", { source: "s", terms: true })).toBe(false);
    expect(storeVerbNeedsWard("nexus-publish", { source: "s", signed: {} })).toBe(false);
    expect(storeVerbNeedsWard("nexus-publish", { source: "s" })).toBe(true);
  });
});
