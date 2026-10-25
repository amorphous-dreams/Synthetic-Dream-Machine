import { ensureFaceCustodyOfGroup } from "../src/face-route.js";
import { EventEmitter } from "node:events";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test, vi } from "vitest";
import { foundTheFace, foundThePlace, runDeviceAdmitEdge } from "@lararium/keyhive";
import { BAG_IDS, DAEMON_BAG_ID, faceAtomKeyFromSeed, makeIslandRepo, materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix, personaScopedBagIds } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { runFoundTheFace, runInit } from "../src/commands/init.js";
import { standFaceAtom } from "../src/face-atom-store.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";
import { larDataDir } from "../src/vessel-paths.js";
import { openNodeVessel } from "../src/open-node-vessel.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";

import { founderAndJoineeActs, frontierFromFoundingSeed } from "./admit-acts.js";
const capture = vi.hoisted(() => ({
  registerBags: [] as string[][],
}));

vi.mock("../src/open-daemon-vm.js", () => ({
  openDaemonVm: async (opts: { daemonAuth?: { registerBags?: string[] } }) => {
    const bags = opts.daemonAuth?.registerBags;
    if (!bags) throw new Error("capture-register-bags: daemonAuth.registerBags missing");
    capture.registerBags.push([...bags]);
    throw new Error("capture-register-bags");
  },
}));

const foundFace = direct(runFoundTheFace);
const land = direct(runInit);
const roots: string[] = [];
const genesisSource = join(import.meta.dirname, "..", "..", "..", "genesis");
// The vessel's own ground. The live lares and lararium documents rest in the Kahu realm and register only on a
// vessel the realm names (W26); the smoke e2e reads that registration, and this file reads face scoping alone.
const GROUND = [DAEMON_BAG_ID, BAG_IDS.catalog, BAG_IDS.oracle] as const;

function scratchRoot(): { root: string; genesisDir: string } {
  const root = mkdtempSync(join(tmpdir(), "register-mounted-face-bags-"));
  roots.push(root);
  const genesisDir = join(root, "genesis");
  cpSync(genesisSource, genesisDir, { recursive: true });
  return { root, genesisDir };
}

async function withScratchRoot<T>(root: string, act: () => Promise<T>): Promise<T> {
  return withLarRoot(root, async () => {
    try {
      return await act();
    } finally {
      const holder = seatedCustody();
      if (holder) {
        await holder.lock();
        unseatCustody(holder);
      }
    }
  });
}

async function founderForSecondFace() {
  const founderRepo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const vesselSeed = new Uint8Array(32).fill(91);
  const signerSeed = new Uint8Array(32).fill(92);
  const atomSeed = new Uint8Array(32).fill(93);
  const founderKey = faceAtomKeyFromSeed(vesselSeed, "founder-vessel").key;
  const hearthTrueName = "hearth-for-second-face";
  const place = await foundThePlace({ repo: founderRepo, vesselSeed, hearthTrueName });
  const face = await foundTheFace({
    repo: founderRepo,
    daemonHandle: place.daemonHandle,
    vesselVerifyingKey: founderKey,
    vesselDisplayName: "founder B",
    binding: { mode: "self-stood", signerSeed },
    hearthTrueName,
    nexusPubkey: founderKey,
    atomSeed,
  });
  const board = await materializeSharedLarDoc(founderRepo, personaKelBoardDocUrl(founderKey), "board:persona-kel");
  const chain = personaKelChainForPrefix(board.doc(), face.personaKelPrefix);
  if (!chain) throw new Error("second face founder seated no persona KEL chain");
  return {
    groupB: face.personaGroupId,
    admit: async (joineeKey: string) => runDeviceAdmitEdge({
      signerSeed, edgeFrontier: await frontierFromFoundingSeed(signerSeed),
      joineeVerifyingKey: joineeKey,
      personaKelPrefix: face.personaKelPrefix,
      personaKelChain: chain,
      hearthTrueName,
      personaGroupId: face.personaGroupId,
      meshCabalDocIdHex: face.meshCabalDocIdHex,
      syncUrl: null,
      islandDocUrl: null,
      hearthDaemonUrl: place.daemonUrl,
      personaUrl: face.personaUrl,
      personaActs: await founderAndJoineeActs({ face, signerSeed, founderAtomSeed: atomSeed, joineeKey, chain }),
    }),
  };
}

async function captureRegisterBags(root: string): Promise<string[]> {
  const storageDir = larDataDir();
  await expect(openNodeVessel({
    hostId: "register-bags",
    wikiId: "register-bags",
    storageDir,
    rootDir: root,
    wss: new EventEmitter() as never,
    genesisDir: join(root, "genesis"),
  } as never)).rejects.toThrow(/capture-register-bags/);
  const latest = capture.registerBags.at(-1);
  if (!latest) throw new Error("capture-register-bags: openNodeVessel never reached openDaemonVm");
  return latest;
}

function facePlaneBags(personaGroupId: string): string[] {
  const plane = personaScopedBagIds(personaGroupId);
  return [plane.persona, plane.circles, plane.identities, plane.sessions];
}

function assertOneFaceShape(registerBags: readonly string[], groupA: string): void {
  const set = new Set(registerBags);
  const faceA = facePlaneBags(groupA);
  for (const bag of [...GROUND, ...faceA]) {
    expect(set.has(bag), `expected registerBags to include ${bag}`).toBe(true);
  }
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe("registerBags at node open names only the mounted face", () => {
  test("CONTROL: one-face vessel registers vessel ground + mounted face bags (plus wiki bags)", async () => {
    const { root, genesisDir } = scratchRoot();
    await withScratchRoot(root, async () => {
      await foundDirect({ storageDir: larDataDir(), genesisDir });
      await seatSeedCharter();
      const faceA = await foundFace({ storageDir: larDataDir(), genesisDir });

      const bags = await captureRegisterBags(root);
      assertOneFaceShape(bags, faceA.personaGroupId);
    });
  }, 180_000);

  test("RED: two-face vessel still registers B's bags even when A is mounted", async () => {
    const { root, genesisDir } = scratchRoot();
    await withScratchRoot(root, async () => {
      await foundDirect({ storageDir: larDataDir(), genesisDir });
      await seatSeedCharter();
      const faceA = await foundFace({ storageDir: larDataDir(), genesisDir });

      const founderB = await founderForSecondFace();
      await ensureFaceCustodyOfGroup(founderB.groupB);
      const atomSeedB = await standFaceAtom(founderB.groupB);
      const atomB = faceAtomKeyFromSeed(atomSeedB, founderB.groupB);
      const payload = await founderB.admit(atomB.key);
      await land({
        storageDir: larDataDir(),
        genesisDir,
        force: true,
        admitPayload: payload,
        custody: { slots: [] },
      });

      const bags = await captureRegisterBags(root);
      assertOneFaceShape(bags, faceA.personaGroupId);
      const set = new Set(bags);
      for (const bag of facePlaneBags(founderB.groupB)) {
        expect(set.has(bag), `RED witness: current source still includes non-mounted face bag ${bag}`).toBe(false);
      }
    });
  }, 180_000);
});
