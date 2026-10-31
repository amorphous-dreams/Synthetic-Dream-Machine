/**
 * kahu-steward-succession — THE KAHU STEWARD READS AS ITS KEY LINE, so a leaf re-issue never strands the canon (road `P26`).
 *
 * Canon (kahu.mem, the gate's shape): "the face's lineage re-issues that key by a hand-over the standing key and its
 * successor both sign … a gate stands a presenter under the HEAD of that key's line alone and reads a line that forks
 * as denied". The hearth's Kahu steward is persona zero's per-Nexus key, and the canon counted only rows sealed by
 * exactly the key the row holds now: after `lares persona reissue` the steward read the successor, no row and no kept
 * file matched it, and `standKahuCanon` stood none.
 *
 *   C0  CONTROL: before any re-issue the founding stands both documents.
 *   R1  RED: after a real re-issue of persona zero's key at the hearth's Nexus, the canon stands the same documents.
 *   R2  RED: the head re-seals the steward's registrations: the realm row under the head stands, the predecessor's row
 *       retires, and the kept file names the head.
 *   R3  RED: a line that forks (a second hand-over from the admitted key) stands none, and names no rogue document.
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LARARIUM_DOC_URI, LARES_DOC_URI, PERSONA_GROUP_ID_TIDDLER, carriageDocUrl, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
  materializeSharedLarDoc, realmBagKey, realmDocUrl, signNexusKeyHandOver, writeNexusKeyHandOver, type RealmBagRegistration,
} from "@lararium/mesh";
import { standKahuCanon } from "../src/kahu-realm.js";
import { readNexusDoc } from "../src/nexus-doc.js";
import { readNexusKey, nexusKeyPublicOf } from "../src/face-key-custody.js";
import { runNexusKeyReissue } from "../src/nexus-key-reissue.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { ownedStore } from "../src/owned-store.js";
import { larBootstrapPath, larDataDir, larSealHome } from "../src/vessel-paths.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { foundHearthDirect } from "./found-route.js";

vi.setConfig({ testTimeout: 300_000, hookTimeout: 300_000 });
const GENESIS = join(import.meta.dirname, "..", "..", "..", "genesis");
const r = mkdtempSync(join(tmpdir(), "lar-kahu-succession-"));
cpSync(GENESIS, join(r, "genesis"), { recursive: true, filter: (s) => !s.endsWith("social-bootstrap.json") });
afterAll(() => { rmSync(r, { recursive: true, force: true }); });
const groupPin = (): string => (JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, { text: string }> }).tiddlers[PERSONA_GROUP_ID_TIDDLER]!.text;

type Repo = Parameters<typeof standKahuCanon>[0]["repo"];
let founded: Promise<void> | null = null;
/** The founding's documents, read once before any re-issue (C0), for every later case to compare against. */
let canon: { lares?: string; lararium?: string } = {};
/** The key persona zero held at the founding: the line's admitted key. Its seed stays for R3's fork. */
let admittedSeed: Uint8Array | null = null;

async function onHearth(fn: (s: { repo: Repo; aid: string; sealHome: string; stand: () => ReturnType<typeof standKahuCanon> }) => Promise<void>): Promise<void> {
  founded ??= withLarRoot(r, () => foundHearthDirect({ storageDir: join(r, "data", "lares", "vessel"), genesisDir: join(r, "genesis") })).then(() => undefined);
  await founded;
  await withLarRoot(r, async () => {
    const vesselKey = await loadVesselVerifyingKey();
    const sealHome = larSealHome();
    const aid = readNexusDoc(sealHome)!.sealLineage![0]!.epochCid;
    await ownedStore(larDataDir(), async (repo) => {
      await fn({ repo, aid, sealHome, stand: () => standKahuCanon({ repo, sealHome, vesselKey, personaGroupId: groupPin() }) });
    });
  });
}

const keptOf = (sealHome: string, aid: string, bag: string): RealmBagRegistration =>
  JSON.parse(readFileSync(join(sealHome, "nexus", "kahu-realm", aid, `${encodeURIComponent(bag)}.json`), "utf8")) as RealmBagRegistration;

describe("the Kahu steward reads as its key line", () => {
  test("C0 — CONTROL: before any re-issue the founding stands both documents", async () => {
    await onHearth(async ({ aid, stand }) => {
      canon = await stand();
      expect(canon.lares && canon.lararium).toBeTruthy();
      admittedSeed = await readNexusKey(0, aid);
      expect(admittedSeed).not.toBeNull();
    });
  });

  test("R1 — after a re-issue of persona zero's key, the canon stands the same documents", async () => {
    await onHearth(async ({ repo, aid, sealHome, stand }) => {
      const done = await runNexusKeyReissue({ sealHome, repo, nexusAid: aid, face: 0 });
      expect(done.from).toBe(nexusKeyPublicOf(admittedSeed!));
      expect(await stand()).toEqual(canon);
    });
  });

  test("R2 — the head re-seals: its row stands, the predecessor's row retires, the kept file names the head", async () => {
    await onHearth(async ({ repo, aid, sealHome, stand }) => {
      await stand();
      const head = nexusKeyPublicOf((await readNexusKey(0, aid))!);
      const before = nexusKeyPublicOf(admittedSeed!);
      expect(head).not.toBe(before);
      const realm = await materializeSharedLarDoc(repo, realmDocUrl(aid), "realm");
      for (const bag of [LARES_DOC_URI, LARARIUM_DOC_URI]) {
        expect(realm.doc()?.tiddlers?.[realmBagKey(bag, head)], `${bag}: the head's row`).toBeDefined();
        expect(realm.doc()?.tiddlers?.[realmBagKey(bag, before)], `${bag}: the predecessor's row`).toBeUndefined();
        expect(keptOf(sealHome, aid, bag).keptBy).toEqual([head]);
      }
    });
  });

  test("R3 — a line that forks stands none, and names no rogue document", async () => {
    await onHearth(async ({ repo, aid, sealHome, stand }) => {
      const rogueSeed = new Uint8Array(32).fill(91);
      const rogue = (await ed25519VerifyingKeyFromSeed(rogueSeed)).toLowerCase();
      const fork = await signNexusKeyHandOver({ nexus: aid, from: nexusKeyPublicOf(admittedSeed!), to: rogue },
        ed25519SignerFromSeed(admittedSeed!), ed25519SignerFromSeed(rogueSeed));
      const island = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome });
      const board = await materializeSharedLarDoc(repo, carriageDocUrl(island), "board:carriage-contracts");
      board.change((d) => writeNexusKeyHandOver(d, fork));
      expect(await stand()).toEqual({});
    });
  });
});
