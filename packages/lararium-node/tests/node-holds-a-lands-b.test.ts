import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { afterAll, describe, expect, test } from "vitest";
import { runDeviceAdmitEdge, foundTheFace, foundThePlace } from "@lararium/keyhive";
import {
  DAEMON_BAG_ID, DEVICE_DELEGATION_SELF_TIDDLER, HEARTH_TRUE_NAME_TIDDLER,
  PERSONA_GROUP_ID_TIDDLER, PERSONA_KEL_PREFIX_TIDDLER, SIGNER_DID_TIDDLER,
  faceAtomKeyFromSeed, makeIslandRepo, materializeSharedLarDoc, personaKelBoardDocUrl,
  personaKelChainForPrefix, personaScopedBagIds, type LarDoc,
} from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { runFoundTheFace, runInit } from "../src/commands/init.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { loadFaceAtomOfGroup, keepFaceAtom, standFaceAtom } from "../src/face-atom-store.js";
import { loadIdentityAnchors, loadVeilArchive } from "../src/identity-anchors.js";
import { ownedStore } from "../src/owned-store.js";
import { larBootstrapPath, larDataDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";

import { founderAndJoineeActs } from "./admit-acts.js";
const genesisSource = join(import.meta.dirname, "..", "..", "..", "genesis");
const foundFace = direct(runFoundTheFace);
const land = direct(runInit);
const roots: string[] = [];
let sharedPayload: Awaited<ReturnType<typeof runDeviceAdmitEdge>>;
let sharedSeedB: Uint8Array;
const mountPins = [
  SIGNER_DID_TIDDLER, PERSONA_KEL_PREFIX_TIDDLER, DEVICE_DELEGATION_SELF_TIDDLER,
  HEARTH_TRUE_NAME_TIDDLER, PERSONA_GROUP_ID_TIDDLER,
] as const;

function scratchRoot(): { root: string; genesisDir: string } {
  const root = mkdtempSync(join(tmpdir(), "lar-holds-a-lands-b-"));
  roots.push(root);
  const genesisDir = join(root, "genesis");
  cpSync(genesisSource, genesisDir, { recursive: true });
  return { root, genesisDir };
}

function packedBootstrap(): Record<string, { text: string }> {
  const plugin = JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string };
  return (JSON.parse(plugin.text) as { tiddlers: Record<string, { text: string }> }).tiddlers;
}

async function daemonMountPins(): Promise<Record<string, string>> {
  const daemonUrl = packedBootstrap()[DAEMON_BAG_ID]?.text;
  if (!daemonUrl) throw new Error("the place names no daemon doc");
  return ownedStore(larDataDir(), async (repo) => {
    const daemon = await repo.find<LarDoc>(daemonUrl as AutomergeUrl);
    return Object.fromEntries(mountPins.map((title) => [title, JSON.stringify(daemon.doc().tiddlers[title] ?? null)]));
  });
}

async function founderForB() {
  // A second repo founds B and signs the edge to the atom held by the joining place.
  const founderRepo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const vesselSeed = new Uint8Array(32).fill(91);
  const signerSeed = new Uint8Array(32).fill(92);
  const atomSeed = new Uint8Array(32).fill(93);
  const founderKey = faceAtomKeyFromSeed(vesselSeed, "founder-vessel").key;
  const hearthTrueName = "hearth-for-face-b";
  const place = await foundThePlace({ repo: founderRepo, vesselSeed, hearthTrueName });
  const face = await foundTheFace({
    repo: founderRepo, daemonHandle: place.daemonHandle,
    vesselVerifyingKey: founderKey, vesselDisplayName: "founder B",
    binding: { mode: "self-stood", signerSeed }, hearthTrueName,
    nexusPubkey: founderKey, atomSeed,
  });
  const board = await materializeSharedLarDoc(founderRepo, personaKelBoardDocUrl(founderKey), "board:persona-kel");
  const chain = personaKelChainForPrefix(board.doc(), face.personaKelPrefix);
  if (!chain) throw new Error("founder B seated no persona KEL chain");
  const admit = async (joineeKey: string) => runDeviceAdmitEdge({
    signerSeed, joineeVerifyingKey: joineeKey,
    personaKelPrefix: face.personaKelPrefix, personaKelChain: chain,
    hearthTrueName, personaGroupId: face.personaGroupId,
    meshCabalDocIdHex: face.meshCabalDocIdHex,
    syncUrl: null, islandDocUrl: null,
    hearthDaemonUrl: place.daemonUrl, personaUrl: face.personaUrl,
    personaActs: await founderAndJoineeActs({ face, signerSeed, founderAtomSeed: atomSeed, joineeKey, chain }),
  });
  return { groupB: face.personaGroupId, admit };
}

afterAll(async () => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

async function inScratchRoot(root: string, act: () => Promise<void>): Promise<void> {
  await withLarRoot(root, async () => {
    try { await act(); }
    finally {
      const holder = seatedCustody();
      if (holder) { await holder.lock(); unseatCustody(holder); }
    }
  });
}

describe("a node holds A while B lands", () => {
  test("an admit stands B at h1 beside A and preserves every mounted A row", async () => {
    const { root, genesisDir } = scratchRoot();
    await inScratchRoot(root, async () => {
      await foundDirect({ storageDir: larDataDir(), genesisDir });
      await seatSeedCharter();
      const faceA = await foundFace({ storageDir: larDataDir(), genesisDir });
      const groupA = faceA.personaGroupId;
      const anchorsA = await loadIdentityAnchors(0);
      const seedA = await loadFaceAtomOfGroup(groupA);
      const archiveA = await loadVeilArchive(groupA);
      if (!anchorsA || !seedA || !archiveA) throw new Error("face A did not finish founding");
      const atomA = faceAtomKeyFromSeed(seedA, groupA);
      const before = packedBootstrap();
      const planesA = personaScopedBagIds(groupA);
      const planeTitlesA = [planesA.identities, planesA.circles, planesA.sessions, planesA.persona];
      const planeEntriesA = Object.fromEntries(planeTitlesA.map((title) => [title, before[title]]));
      const pinA = before[PERSONA_GROUP_ID_TIDDLER];
      const daemonPinsA = await daemonMountPins();

      const founder = await founderForB();
      const groupB = founder.groupB;
      const seedB = await standFaceAtom(groupB);
      const atomB = faceAtomKeyFromSeed(seedB, groupB);
      const payload = await founder.admit(atomB.key);
      sharedPayload = payload;
      sharedSeedB = Uint8Array.from(seedB);

      await land({ storageDir: larDataDir(), genesisDir, force: true, admitPayload: payload, custody: { slots: [] } });

      // A's anchors, atom, archive, planes and singular mount remain exactly as they stood.
      expect(await loadIdentityAnchors(0)).toEqual(anchorsA);
      expect(await loadFaceAtomOfGroup(groupA)).toEqual(seedA);
      expect(await loadVeilArchive(groupA)).toEqual(archiveA);
      const after = packedBootstrap();
      expect(after[PERSONA_GROUP_ID_TIDDLER]).toEqual(pinA);
      for (const title of planeTitlesA) expect(after[title]).toEqual(planeEntriesA[title]);
      expect(await daemonMountPins()).toEqual(daemonPinsA);

      // B receives its own compartment while A keeps the mounted group pin.
      expect((await loadIdentityAnchors(1))?.personaGroupId).toBe(groupB);
      expect(await loadFaceAtomOfGroup(groupB)).toEqual(seedB);
      expect(seedB).not.toEqual(seedA);
      const archiveB = await loadVeilArchive(groupB);
      expect(archiveB?.length).toBeGreaterThan(0);
      expect(archiveB).not.toEqual(archiveA);
      const planesB = personaScopedBagIds(groupB);
      for (const title of [planesB.identities, planesB.circles, planesB.sessions, planesB.persona]) {
        expect(after[title]?.text).toBeTruthy();
      }
      expect(after[PERSONA_GROUP_ID_TIDDLER]?.text).toBe(groupA);
      expect(atomB.key).not.toBe(atomA.key);
    });
  }, 180_000);

  test("the same admit lands B at h0 on a faceless place", async () => {
    const { root, genesisDir } = scratchRoot();
    await inScratchRoot(root, async () => {
      await foundDirect({ storageDir: larDataDir(), genesisDir });
      const payload = sharedPayload;
      if (!payload || !sharedSeedB) throw new Error("the B admit did not stand in the first case");
      await keepFaceAtom(payload.personaGroupId, sharedSeedB);
      await land({ storageDir: larDataDir(), genesisDir, force: true, admitPayload: payload, custody: { slots: [] } });
      expect((await loadIdentityAnchors(0))?.personaGroupId).toBe(payload.personaGroupId);
      expect((await loadVeilArchive(payload.personaGroupId))?.length).toBeGreaterThan(0);
      const packed = packedBootstrap();
      expect(packed[PERSONA_GROUP_ID_TIDDLER]?.text).toBe(payload.personaGroupId);
      const planes = personaScopedBagIds(payload.personaGroupId);
      for (const title of [planes.identities, planes.circles, planes.sessions, planes.persona]) {
        expect(packed[title]?.text).toBeTruthy();
      }
      const pins = await daemonMountPins();
      for (const title of mountPins) expect(pins[title]).not.toBe("null");
    });
  }, 180_000);
});
