import { seatSuiteWard } from "./support/scratch-custody-setup.js";
// This suite stands as the person at the terminal: its root acts carry no ward route, and the suite's person answers (seat-harness#/the-ward).
seatSuiteWard();
/**
 * THE VESSEL'S SECRET HOME, BY PLACEMENT (operator ruling 2026-11-09, "placement over patterns"). Group-secret seals,
 * dyads and Keyhive cap event bytes rest in one vessel-held document, sealed under the held key the vessel's custody
 * keeps. The founding order: custody seats, the home enrolls on the holder's rest (mapped BEFORE its first byte), its
 * address lands in custody after the document rests, and only then does any seal, dyad or cap event write.
 */
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo, type AutomergeUrl, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { afterAll, describe, expect, test } from "vitest";
import { foundTheFace, foundThePlace, runDeviceAdmitEdge } from "@lararium/keyhive";
import {
  DAEMON_BAG_ID, SECRET_HOME_ID, SealedDocumentStore, bindSecretHomeRest, vesselHeldHomes, faceAtomKeyFromSeed, groupSecretSealTitle,
  makeIslandRepo, materializeSharedLarDoc, controlHomeUrlOf, controlHomeRefusal, standControlHome, CONTROL_HOME_UNNAMED, personaKelBoardDocUrl, personaKelChainForPrefix, plainRecord,
  type HeldRestKey, type LarDoc,
} from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { runFoundTheFace, runInit } from "../src/commands/init.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { ensureFaceCustodyOfGroup } from "../src/face-route.js";
import { standFaceAtom } from "../src/face-atom-store.js";
import { ownedStore } from "../src/owned-store.js";
import { SECRET_HOME_FILE, openVesselSecretHome, readSecretHomeAddress, standVesselSecretHome } from "../src/secret-home-store.js";
import { larBootstrapPath, larDataDir, larIdentityDir } from "../src/vessel-paths.js";
import { DurableNodeFSStorageAdapter } from "../src/durable-storage-adapter.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";
import { founderAndJoineeActs, frontierFromFoundingSeed } from "./admit-acts.js";
import { testVesselTagDoor } from "../../lararium-mesh/tests/vessel-tag-fixture.js";
import { memorySecretHome } from "../../lararium-mesh/tests/secret-home-fixture.js";

const genesisSource = join(import.meta.dirname, "..", "..", "..", "genesis");
const foundFace = direct(runFoundTheFace);
const land = direct(runInit);
const roots: string[] = [];
const MAGIC = [0x85, 0x6f, 0x4a, 0x83];

function scratchRoot(): { root: string; genesisDir: string } {
  const root = mkdtempSync(join(tmpdir(), "lar-secret-home-"));
  roots.push(root);
  const genesisDir = join(root, "genesis");
  cpSync(genesisSource, genesisDir, { recursive: true });
  return { root, genesisDir };
}

afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });

async function inScratchRoot(root: string, act: () => Promise<void>): Promise<void> {
  await withLarRoot(root, async () => {
    try { await act(); }
    finally {
      const holder = seatedCustody();
      if (holder) { await holder.lock(); unseatCustody(holder); }
    }
  });
}

function packedBootstrap(): Record<string, { text: string }> {
  const plugin = JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string };
  return (JSON.parse(plugin.text) as { tiddlers: Record<string, { text: string }> }).tiddlers;
}

/** Every file under `dir`, recursively. */
function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) out.push(...filesUnder(path));
    else if (st.isFile()) out.push(path);
  }
  return out;
}

const holds = (hay: Buffer, needle: Buffer): boolean => hay.indexOf(needle) >= 0;

/** A founder B on its own storage-less Repo, signing an admit to a joinee atom. */
async function founderForB() {
  const founderRepo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const vesselSeed = new Uint8Array(32).fill(71);
  const signerSeed = new Uint8Array(32).fill(72);
  const atomSeed = new Uint8Array(32).fill(73);
  const founderKey = faceAtomKeyFromSeed(vesselSeed, "founder-vessel").key;
  const hearthTrueName = "hearth-for-secret-home";
  const place = await foundThePlace({ repo: founderRepo, hearthTrueName });
  const face = await foundTheFace({ vesselTag: testVesselTagDoor(1),
    repo: founderRepo, daemonHandle: place.daemonHandle, ...memorySecretHome(founderRepo),
    placeVerifyingKey: founderKey, vesselDisplayName: "founder B",
    binding: { mode: "self-stood", signerSeed }, hearthTrueName,
    nexusPubkey: founderKey, atomSeed,
  });
  const board = await materializeSharedLarDoc(founderRepo, personaKelBoardDocUrl(founderKey), "board:persona-kel");
  const chain = personaKelChainForPrefix(board.doc(), face.personaKelPrefix);
  if (!chain) throw new Error("founder B seated no persona KEL chain");
  const admit = async (joineeKey: string) => runDeviceAdmitEdge({
    signerSeed, edgeFrontier: await frontierFromFoundingSeed(signerSeed), joineeVerifyingKey: joineeKey,
    personaKelPrefix: face.personaKelPrefix, personaKelChain: chain,
    hearthTrueName, personaGroupId: face.personaGroupId,
    meshCabalDocIdHex: face.meshCabalDocIdHex,
    syncUrl: null, islandDocUrl: null,
    hearthDaemonUrl: place.daemonUrl, personaUrl: face.personaUrl,
    personaActs: await founderAndJoineeActs({ face, signerSeed, founderAtomSeed: atomSeed, joineeKey, chain }),
  });
  return { groupB: face.personaGroupId, admit };
}

/** A recording rest over the vessel's own store: it names each enrollment and each save, in order. */
function recordingHolder(storageDir: string) {
  const events: string[] = [];
  const held = new Map<string, HeldRestKey>();
  const durable = new DurableNodeFSStorageAdapter(storageDir);
  const inner: StorageAdapterInterface = {
    load: (key: StorageKey) => durable.load(key),
    loadRange: (prefix: StorageKey): Promise<Chunk[]> => durable.loadRange(prefix),
    remove: (key: StorageKey) => durable.remove(key),
    removeRange: (prefix: StorageKey) => durable.removeRange(prefix),
    save: async (key: StorageKey, data: Uint8Array) => {
      if (held.has(key[0]!)) events.push(`save:${key[0]}:row=${existsSync(join(larIdentityDir(), SECRET_HOME_FILE))}:clear=${MAGIC.every((b, i) => data[i] === b)}`);
      return durable.save(key, data);
    },
  };
  const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
  const homes = vesselHeldHomes();
  const store = new SealedDocumentStore({
    inner, bagOf: (id) => homes.bagOf(id),
    sessionFace: () => null, sessionOf: () => null, seal: refuse, open: refuse, refuseClearOverSealed: true,
  });
  const repo = new Repo({ storage: store, network: [] });
  const rest = homes.rest((documentId) => store.holdsSealed(documentId));
  bindSecretHomeRest(repo, {
    ...rest,
    enroll: (documentId, key) => { events.push(`enroll:${documentId}`); held.set(documentId, key); rest.enroll(documentId, key); },
    enrollBeside: (documentId, bagId) => { events.push(`enroll-beside:${documentId}`); const keyed = rest.enrollBeside(documentId, bagId); if (keyed) held.set(documentId, held.values().next().value!); return keyed; },
  });
  return { repo, events };
}

describe("the vessel's secret home, by placement", () => {
  test("RED ORDER: the home maps on the rest before its first byte, every byte rests sealed, and its address lands in custody only after", async () => {
    const { root, genesisDir } = scratchRoot();
    await inScratchRoot(root, async () => {
      // The place founding stood custody and minted no home (the face mints it); this suite stands one on a recording rest.
      await foundDirect({ storageDir: larDataDir(), genesisDir });
      expect(existsSync(join(larIdentityDir(), SECRET_HOME_FILE))).toBe(false);
      const { repo, events } = recordingHolder(join(root, "recorded-store"));
      const home = await standVesselSecretHome(repo);
      await repo.shutdown();
      const id = home.handle.documentId;
      const saves = events.filter((e) => e.startsWith(`save:${id}`));
      expect(events[0]).toBe(`enroll:${id}`);
      expect(saves.length).toBeGreaterThan(0);
      // Every save of the home came after its enrollment, rested sealed, and landed before the address row did.
      for (const save of saves) expect(save).toBe(`save:${id}:row=false:clear=false`);
      expect((await readSecretHomeAddress())?.documentId).toBe(id);
    });
  }, 180_000);

  test("RED (Gaia Thursday): a place founding (a herm, no face) mints no secret home and no control document; its custody row names none, and a control act refuses `control-home-unnamed`", async () => {
    const { root, genesisDir } = scratchRoot();
    await inScratchRoot(root, async () => {
      await foundDirect({ storageDir: larDataDir(), genesisDir });
      expect(await readSecretHomeAddress()).toBeNull();
      expect(existsSync(join(larIdentityDir(), SECRET_HOME_FILE))).toBe(false);
      const daemonUrl = packedBootstrap()[DAEMON_BAG_ID]!.text;
      const refused = await ownedStore(larDataDir(), async (repo) => {
        const daemon = await repo.find<LarDoc>(daemonUrl as AutomergeUrl);
        expect(controlHomeUrlOf(daemon.doc())).toBeNull();
        return standControlHome(repo, daemon).catch((e: unknown) => e);
      });
      expect(refused).toMatchObject({ name: "ControlHomeUnavailable", refusal: CONTROL_HOME_UNNAMED });
    });
  }, 180_000);

  test("CONTROL (hearth founding): the face's founding mints the secret home and the control document together; the custody row and the daemon document name the same control document", async () => {
    const { root, genesisDir } = scratchRoot();
    await inScratchRoot(root, async () => {
      await foundDirect({ storageDir: larDataDir(), genesisDir });
      await seatSeedCharter();
      await foundFace({ storageDir: larDataDir(), genesisDir });
      const address = await readSecretHomeAddress();
      expect(address?.controlId).toBeDefined();
      const daemonUrl = packedBootstrap()[DAEMON_BAG_ID]!.text;
      const named = await ownedStore(larDataDir(), async (repo) => {
        const daemon = await repo.find<LarDoc>(daemonUrl as AutomergeUrl);
        const control = await standControlHome(repo, daemon);
        return { pointer: controlHomeUrlOf(daemon.doc()), control: control.documentId, refused: controlHomeRefusal(control) };
      });
      expect(named.pointer).toBe(`automerge:${address!.controlId}`);
      expect(named.control).toBe(address!.controlId);
      expect(named.refused).toBeNull();
    });
  }, 180_000);

  test("RED ORDER: a Repo whose holder bound no sealed rest refuses the face's founding by name, before any secret write", async () => {
    const { root, genesisDir } = scratchRoot();
    await inScratchRoot(root, async () => {
      await foundDirect({ storageDir: larDataDir(), genesisDir });
      await seatSeedCharter();
      const bare = new Repo({ storage: new DurableNodeFSStorageAdapter(larDataDir()), network: [] });
      await expect(runFoundTheFace({ repo: bare, genesisDir })).rejects.toThrow(/secret-home-unavailable/);
      await bare.shutdown();
      // The place's own daemon document holds no seal, dyad or cap event.
      const daemonUrl = packedBootstrap()[DAEMON_BAG_ID]!.text;
      const titles = await ownedStore(larDataDir(), async (repo) => Object.keys((await repo.find<LarDoc>(daemonUrl as AutomergeUrl)).doc().tiddlers));
      expect(titles.filter((t) => t.startsWith(`${SECRET_HOME_ID}/`) || t.includes("/group-secret/") || t.includes("/dreamnet/dyad/"))).toEqual([]);
    });
  }, 180_000);

  test("no secret family's bytes reach any plaintext file under the root after a founding, an admission and a restart", async () => {
    const { root, genesisDir } = scratchRoot();
    await inScratchRoot(root, async () => {
      await foundDirect({ storageDir: larDataDir(), genesisDir });
      await seatSeedCharter();
      const faceA = await foundFace({ storageDir: larDataDir(), genesisDir });
      // An admission lands face B beside A: its dyad, seal and cap events rest in the same home.
      const founder = await founderForB();
      await ensureFaceCustodyOfGroup(founder.groupB);
      const seedB = await standFaceAtom(founder.groupB);
      const payload = await founder.admit(faceAtomKeyFromSeed(seedB, founder.groupB).key);
      await land({ storageDir: larDataDir(), genesisDir, force: true, admitPayload: payload, custody: { slots: [] } });

      // THE RESTART: a fresh holder reopens the home from its custody row alone.
      const secrets = await ownedStore(larDataDir(), async (repo) => {
        const home = await openVesselSecretHome(repo);
        const records = Object.entries(home.handle.doc().tiddlers).map(([title, rec]) => ({ title, text: String(plainRecord(rec as never).tiddler.text ?? "") }));
        const daemonUrl = packedBootstrap()[DAEMON_BAG_ID]!.text;
        const daemonTitles = Object.keys((await repo.find<LarDoc>(daemonUrl as AutomergeUrl)).doc().tiddlers);
        return { records, documentId: home.handle.documentId, daemonTitles };
      });
      const titles = secrets.records.map((r) => r.title);
      // The setup took: both faces' seals, at least one dyad, and cap events rest in the home.
      expect(titles).toContain(groupSecretSealTitle(faceA.personaGroupId));
      expect(titles).toContain(groupSecretSealTitle(founder.groupB));
      expect(titles.some((t) => t.includes("/dreamnet/dyad/"))).toBe(true);
      expect(titles.some((t) => t.startsWith(`${SECRET_HOME_ID}/cap/`))).toBe(true);
      // None of them rests in the daemon document.
      expect(secrets.daemonTitles.filter((t) => titles.includes(t))).toEqual([]);

      // No file under the root carries any of their bytes, and the home's own chunks rest sealed.
      const needles = secrets.records.map((r) => r.text).filter((t) => t.length >= 32).map((t) => Buffer.from(t, "utf8"));
      expect(needles.length).toBeGreaterThanOrEqual(titles.length - 1);
      const files = filesUnder(root).filter((f) => !f.startsWith(genesisDir));
      const leaks = files.filter((f) => { const bytes = readFileSync(f); return needles.some((n) => holds(bytes, n)); });
      expect(leaks).toEqual([]);
      const homeChunks = files.filter((f) => f.includes(secrets.documentId.slice(2)) || f.includes(secrets.documentId));
      for (const f of homeChunks) expect(MAGIC.every((b, i) => readFileSync(f)[i] === b)).toBe(false);
    });
  }, 240_000);
});
