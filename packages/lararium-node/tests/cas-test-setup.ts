/**
 * cas-test-setup — the CAS-plane test spine: the CID-plane full-boot setup AND the cad
 * carriage-wire gate stubs the wire/relay tests all carry.
 *
 * Two faces, one plane:
 *   · setupCasFromGenesis — a real island worker pulls the engine + plugin bytes by CID from
 *     the local CAS (the CRDT plane carries no bytes). A full-boot test mirrors the genesis CAS
 *     files (genesis/cas/<cid>, indexed by the immutable seed) into a temp fs CAS, gives the
 *     pool a storageRoot (each island's nodefs storage a child of it, deriving `<storageRoot>/cas`),
 *     and passes the plugin CIDs (from the genesis doc's blob METADATA) — the loader-path proof
 *     without the live daemon.
 *   · membershipOf · antigenOf · sealABody — the cad wire fixtures the carriage/relay/cas-wire
 *     tests share: the two gate-input stubs (membership fold · antigen fold) and the one-shot
 *     seal-a-body-into-a-temp-cad-dir fixture. One definition, imported everywhere — a copy in
 *     each test file drifts under revert-verify (a stub that quietly diverges certifies nothing).
 */

import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import {
  bootSetPluginCids, authorizeAddress, openPrivateBody, readContentKey,
  type AntigenRing, type LarDoc, type MembershipEnvelope, type NexusMembership, type PrivateBodyKey,
} from "@lararium/mesh";
import { casDirForStorage, mirrorGenesisCasFs } from "../src/node-cas.js";
import { readGenesisCasManifest, genesisCasDir } from "../src/genesis-artifact.js";
import { makeSealedPlaneRegistry } from "../src/plane-seal.js";
import type { NexusEpochName } from "../src/plane-seal.js";
import type { InstalledSealedBody } from "../src/ciphertext-cas-seal.js";
import { cadSealDir, sealCarrierForFederation } from "../src/seal-carrier-federation.js";

// L9 — this plane pins the repo's OWN tracked genesis dir (`<repo>/genesis`), derived from THIS
// file's own path, never the ambient `LAR_GENESIS`/`LAR_ROOT`-resolved one (`defaultGenesisDir`
// inside genesis-artifact.ts). The house law isolates a dev/smoke boot with a scratch `LAR_ROOT`,
// so a unit suite that leans on the ambient default reads the SCRATCH root's (genesis-less)
// `<LAR_ROOT>/genesis` instead of the tracked seed the moment a caller sets one — "[cas-test-setup]
// genesis seed absent" with no code fault at all. This plane's own fixtures stay isolated from
// that lever: they always mirror the ONE tracked seed, under a scratch LAR_ROOT or none.
const REPO_GENESIS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "genesis");

export interface CasSetup {
  /** Pool storageRoot — the CAS lives at `<storageDir>/cas`. */
  readonly storageDir:  string;
  /** Plugin-tiddler CIDs the island resolves from the CAS. */
  readonly pluginCids:  readonly string[];
  /** Remove the temp storageDir (call in finally). */
  readonly cleanup:     () => void;
}

/**
 * Mirror the genesis CAS files into a temp fs CAS and derive the pool inputs. The
 * bytes come from genesis/cas/<cid> (via the seed-derived inventory), the plugin CIDs from
 * the genesis doc's blob metadata. `genesisDir` defaults to the repo's genesis/ dir.
 */
export function setupCasFromGenesis(genesisDoc: LarDoc, genesisDir: string = REPO_GENESIS_DIR): CasSetup {
  const storageDir = mkdtempSync(join(tmpdir(), "lar-cas-test-"));
  const manifest = readGenesisCasManifest(genesisDir);
  if (!manifest) {
    throw new Error("[cas-test-setup] genesis seed absent or malformed — run: pnpm --filter @lararium/node build:genesis");
  }
  mirrorGenesisCasFs(manifest, genesisCasDir(genesisDir), casDirForStorage(storageDir));
  return {
    storageDir,
    pluginCids: bootSetPluginCids(genesisDoc.blobs),
    cleanup: () => rmSync(storageDir, { recursive: true, force: true }),
  };
}

// ── cad carriage-wire fixtures — the gate stubs + seal fixture the wire/relay tests share ──────

/**
 * Recover a Uint8Array a want-block/answer carried as JSON over the socket — the auth relay JSON-round-trips
 * a Uint8Array to `{0:..,1:..}`, so `Object.values` rebuilds the byte run. The wire shape is non-obvious;
 * one definition keeps every carriage test decoding the answer identically.
 */
export const bytesFromPayload = (env: MembershipEnvelope): Uint8Array =>
  Uint8Array.from(Object.values((env.payload as { bytes?: Record<string, number> }).bytes ?? {}));

/** A membership stub — a peerId is a MEMBER iff it sits in the set (production: the nexus-membership fold). */
export const membershipOf = (members: Iterable<string>): NexusMembership => {
  const set = new Set(members);
  return { holdsCarriagePeer: (peerId) => set.has(peerId) };
};

/** An antigen stub — a peerId IS its own nym here; a nym in `kapaed` draws Mu (production: the quorum-signed fold). */
export const antigenOf = (kapaed: Iterable<string>): AntigenRing => {
  const set = new Set(kapaed);
  return { kapaed: set, presenterNym: (peerId) => peerId };
};

/** The one-shot cad seal fixture — the sealed body every wire test carries, and the key a member opens it with. */
export interface SealedBodyFixture {
  readonly registry:  ReturnType<typeof makeSealedPlaneRegistry>;
  readonly cadDir:    string;
  readonly installed: InstalledSealedBody;
  /** The bag's content key a member holds through its lockbox. It never rides a relay. */
  readonly under:     PrivateBodyKey;
  readonly cleanup:   () => void;
}

/** A synthetic Nexus AID and head epoch CID for a test that seals with no charter standing. */
export const TEST_NEXUS_AID = "nexus-" + "ab".repeat(32);
export const TEST_HEAD_EPOCH = TEST_NEXUS_AID;

/** The synthetic bag a fixture body belongs to, and the Nexus scope its sealed block registers under. */
export const TEST_BAG_ID = "lar:///ha.ka.ba/@test/bags/sealed-fixture";
export const TEST_SCOPE: NexusEpochName = { nexusAid: TEST_NEXUS_AID, epochCid: TEST_HEAD_EPOCH };

/** A fresh content key for the synthetic bag, held in memory alone. */
export function freshTestBodyKey(bagId: string = TEST_BAG_ID): PrivateBodyKey {
  return { bagId, key: readContentKey(new Uint8Array(randomBytes(32)))! };
}

/**
 * Open fetched ciphertext as a member does: the bag's content key, the digest the pointer names, and the address
 * the member itself sealed. Answers the plaintext, or `REFUSED <name>` as text so a vector reads the refusal.
 */
export function openAsMember(ciphertext: Uint8Array, installed: Pick<InstalledSealedBody, "cid" | "ref">, under: PrivateBodyKey): Uint8Array | string {
  const authorized = authorizeAddress(installed.cid, "own-receipt");
  if (authorized === null) return "REFUSED address-malformed";
  const opened = openPrivateBody({ ciphertext, under, ref: installed.ref, authorized });
  return "plaintext" in opened ? opened.plaintext : `REFUSED ${opened.refusal}`;
}

/**
 * Seal one `plaintext` into a temp cad dir under a fresh in-memory content key —
 * the registry + cadDir + InstalledSealedBody a wire test serves, the key a member reads with, and the cleanup.
 */
export function sealABody(plaintext: Uint8Array): SealedBodyFixture {
  const storageDir = mkdtempSync(join(tmpdir(), "lares-caswire-store-"));
  const registry = makeSealedPlaneRegistry();
  const under = freshTestBodyKey();
  const cadDir = cadSealDir(storageDir);
  const installed = sealCarrierForFederation({ registry, cadDir, plaintext, under, scope: TEST_SCOPE });
  const cleanup = () => { rmSync(storageDir, { recursive: true, force: true }); };
  return { registry, cadDir, installed, under, cleanup };
}
