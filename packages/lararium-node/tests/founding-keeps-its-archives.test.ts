/**
 * founding-keeps-its-archives — a founding leaves every keyhive Archive it stood at rest, sealed under the vessel
 * key, per face; the veil derives from the sealed custody root; and a creator re-stands from its own Archive.
 *
 * Every act runs the real doors (`runInit`, `runFoundTheFace`) over a real store under a scratch `LAR_ROOT`.
 *
 *   F1  a place founding seals the vessel's keyhive archive from its first act.
 *                                           control: before the founding no archive stands
 *   F2  THREE FACES KEEP THREE VEIL ARCHIVES. Each face founding seals its own group row; each reads
 *       back its own bytes; no two rows hold the same bytes; a later face's founding leaves an earlier face's row
 *       byte-identical.
 *   F3  THE VEIL DERIVES FROM THE SEALED CUSTODY ROOT. The founder dyad's veil DID equals the one the custody
 *       root derives under the face's tag, and differs from the one the floor vessel key would derive.
 *   F4  A CREATOR RE-STANDS FROM ITS SEALED ARCHIVE. A fresh provider stood over the veil's seed and the bytes
 *       its row opens to (no event replay) holds the PersonaGroup it created and seats a new member in it.
 *                                           control: the same seed with NO archive and no events holds no group
 *   F5  AT THE FLOOR A FACE FOUNDING WRITES NOTHING PRIVATE. With the holder locked the founding refuses
 *       `CustodyLocked`; no anchors row, no veil archive and no persona plane entry lands, and every standing
 *       sealed row keeps its bytes.         control: unlocked, the same founding lands all of them
 *   F6  THE SEED CHARTER, AT THE FLOOR, MINTS NO ROOT. On a place that holds no face, the seed charter (whose
 *       seat claim persona zero's root stands for) with the holder locked refuses before any persona root lands.
 *                                           control: unlocked, the charter seats, h0 founds and its root stands
 *   F7  A PLACE FOUNDED AGAIN KEEPS ITS ARCHIVE. A re-seed (`force`) over a standing archive restores from it:
 *       the archive at rest afterwards still knows a sentinel only the kept archive held.
 *                                           control: a provider stood from the seed alone knows no such agent
 *   F8  REMOVING A COMPLETED FACE'S BOOTSTRAP ENTRY STARTS A FRESH FOUNDING. The old group's atom and archive
 *       stay with it; the new group receives its own atom and archive.
 *                                           control: with the entry standing, the same call answers already-stood
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { KeyhiveProvider, InMemoryEventStore } from "@lararium/keyhive";
import * as ed from "@noble/ed25519";
import {
  DAEMON_BAG_ID, faceAtomKeyFromSeed, didFromVerifyingKey, hex, personaScopedBagIds, readVkCarrier, readFckCarrier, vesselDyads, type LarDoc,
} from "@lararium/mesh";
import { runFoundTheFace } from "../src/commands/init.js";
import { loadFaceAtomOfGroup } from "../src/face-atom-store.js";
import { CustodyLocked } from "../src/custody-holder.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import {
  archivePath, loadIdentityAnchors, loadIdentityArchive, loadVeilArchive, listAnchoredPersonas, persistIdentityArchive, veilArchivePath,
} from "../src/identity-anchors.js";
import { loadVesselSigningSeed } from "../src/node-vessel-identity.js";
import { ownedStore } from "../src/owned-store.js";
import { faceDir, listFaceFiles, readFaceIndexSync } from "../src/face-index.js";
import { larBootstrapPath, larDataDir, larIdentityDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { faceRowNames, handleRowPath } from "./face-paths.js";
import { foundDirect, seatSeedCharter, TEST_PASSPHRASE } from "./found-route.js";

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const REPO_GENESIS = join(import.meta.dirname, "..", "..", "..", "genesis");
const foundFace = direct(runFoundTheFace);
let root = "";
let priorRoot: string | undefined;
let archiveAbsentBefore = false;

const sealedFiles = (): Record<string, Buffer> => {
  const out: Record<string, Buffer> = {};
  for (const f of readdirSync(larIdentityDir())) {
    if (/^(anchor-roster\.json|keyhive-archive\.bin)$/.test(f)) out[f] = readFileSync(join(larIdentityDir(), f));
  }
  for (const f of faceRowNames().filter((name) => /^anchors-h\d+\.json$/.test(name))) out[f] = readFileSync(handleRowPath(f));
  for (const [fcid, f] of listFaceFiles(larIdentityDir(), readFaceIndexSync(larIdentityDir()))) {
    if (/^veil-archive-g[0-9a-f]{64}\.bin$/.test(f)) out[f] = readFileSync(join(faceDir(larIdentityDir(), fcid), f));
  }
  return out;
};

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "lar-founding-archives-"));
  priorRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  cpSync(REPO_GENESIS, join(root, "genesis"), { recursive: true });
  archiveAbsentBefore = !existsSync(archivePath());
  await foundDirect({ storageDir: larDataDir(), genesisDir: join(root, "genesis") });
  // A face binds its hearth: the seed charter seats before any face founds, as the Stable founding act seats it.
  await seatSeedCharter();
});
/** Every provider a case stands, so the file hands each back before it returns. */
const providers: KeyhiveProvider[] = [];
const standing = (p: KeyhiveProvider): KeyhiveProvider => { providers.push(p); return p; };

afterAll(async () => {
  // THE FILE LEAVES NOTHING STANDING: each provider disposes before the custody locks, so no line prints after
  // the last assertion.
  for (const p of providers.splice(0)) await p.dispose();
  const holder = seatedCustody();
  if (holder) { await holder.lock(); unseatCustody(holder); }
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  rmSync(root, { recursive: true, force: true });
});

describe("a founding keeps its archives, sealed per face", () => {
  test("F1 the place founding seals the vessel's keyhive archive", async () => {
    expect(archiveAbsentBefore).toBe(true);
    expect(readVkCarrier(readFileSync(archivePath()))).toBe("sealed");
    const bytes = await loadIdentityArchive();
    expect(bytes && bytes.length).toBeGreaterThan(0);
    // The archive restores the vessel's own individual.
    const p = standing(new KeyhiveProvider());
    await p.init({ seed: await loadVesselSigningSeed(), eventStore: new InMemoryEventStore(), archiveBytes: bytes! });
    expect((await p.whoami()).length).toBeGreaterThan(0);
  });

  test("F2 three faces keep three veil archives, each its own, none disturbed by a later founding", async () => {
    const genesisDir = join(root, "genesis");
    const kept: Buffer[] = [];
    const groups: string[] = [];
    for (const n of [0, 1, 2]) {
      const face = await foundFace({ genesisDir, handleIndex: n });
      expect(face.alreadyStood).toBe(false);
      groups.push(face.personaGroupId);
      expect(readFckCarrier(readFileSync(veilArchivePath(face.personaGroupId)))).toBe("sealed");
      kept.push(readFileSync(veilArchivePath(face.personaGroupId)));
      for (let earlier = 0; earlier < n; earlier++) {
        expect(readFileSync(veilArchivePath(groups[earlier]!)).equals(kept[earlier]!), `h${earlier}'s row never moved while h${n} founded`).toBe(true);
      }
    }
    const opened = await Promise.all(groups.map((group) => loadVeilArchive(group)));
    for (const o of opened) expect(o && o.length).toBeGreaterThan(0);
    expect(Buffer.from(opened[0]!).equals(Buffer.from(opened[1]!))).toBe(false);
    expect(Buffer.from(opened[1]!).equals(Buffer.from(opened[2]!))).toBe(false);
    expect(await listAnchoredPersonas()).toEqual([0, 1, 2]);
  });

  test("F3 the founder dyad names its sealed atom, never the floor key", async () => {
    const anchors = (await loadIdentityAnchors(0))!;
    const atomSeed = (await loadFaceAtomOfGroup(anchors.personaGroupId))!;
    const atom = faceAtomKeyFromSeed(atomSeed, anchors.personaGroupId);
    const floorDid = didFromVerifyingKey(hex(await ed.getPublicKeyAsync(await loadVesselSigningSeed())));
    expect(atom.did).not.toBe(floorDid);
    const packed = JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, { text: string }> };
    const daemonUrl = packed.tiddlers[DAEMON_BAG_ID]!.text;
    const dyads = await ownedStore(larDataDir(), async (repo) => {
      const handle = await repo.find<LarDoc>(daemonUrl as AutomergeUrl);
      return vesselDyads(handle.doc() as LarDoc);
    });
    const atomDids = dyads.map((d) => d.ref.deviceDid);
    expect(atomDids).toContain(atom.did);
    expect(atomDids).not.toContain(floorDid);
  });

  test("F4 the creator re-stands from its sealed archive and seats a member", async () => {
    const anchors = (await loadIdentityAnchors(1))!;
    const atomSeed = (await loadFaceAtomOfGroup(anchors.personaGroupId))!;
    const restood = standing(new KeyhiveProvider());
    await restood.init({ seed: atomSeed, eventStore: new InMemoryEventStore(), archiveBytes: (await loadVeilArchive(anchors.personaGroupId))! });
    const guest = standing(new KeyhiveProvider());
    await guest.init({ seed: new Uint8Array(32).fill(99), eventStore: new InMemoryEventStore() });
    const { id: guestId } = await restood.receiveContactCard(await guest.contactCard());
    await restood.addGroupMember(guestId, anchors.personaGroupId);
    expect(await restood.groupMembers(anchors.personaGroupId)).toContain(guestId);

    // control: the same seed with no archive and no events holds no such group
    const bare = standing(new KeyhiveProvider());
    await bare.init({ seed: atomSeed, eventStore: new InMemoryEventStore() });
    await expect(bare.addGroupMember(guestId, anchors.personaGroupId)).rejects.toThrow();
  });

  test("F5 at the floor a face founding refuses CustodyLocked and lands nothing private", async () => {
    const genesisDir = join(root, "genesis");
    const holder = seatedCustody()!;
    const before = sealedFiles();
    const bootstrapBefore = readFileSync(larBootstrapPath(), "utf8");
    await holder.lock();
    await expect(foundFace({ genesisDir, handleIndex: 3 })).rejects.toThrow(CustodyLocked);
    expect(faceRowNames()).not.toContain("anchors-h3.json");
    expect(readFileSync(larBootstrapPath(), "utf8")).toBe(bootstrapBefore);
    const after = sealedFiles();
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    for (const f of Object.keys(before)) expect(after[f]!.equals(before[f]!), `${f} never moved`).toBe(true);

    // control: unlocked by the founding route, the same founding lands its rows
    expect((await holder.unlock([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }])).reading).toBe("opens");
    const face = await foundFace({ genesisDir, handleIndex: 3 });
    expect(face.alreadyStood).toBe(false);
    expect(readFckCarrier(readFileSync(veilArchivePath(face.personaGroupId)))).toBe("sealed");
    expect(await listAnchoredPersonas()).toEqual([0, 1, 2, 3]);
  });

  test("F6 the seed charter at the floor refuses before it mints persona zero's root", async () => {
    const second = mkdtempSync(join(tmpdir(), "lar-founding-floor-"));
    const outer = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = second;
    try {
      cpSync(REPO_GENESIS, join(second, "genesis"), { recursive: true });
      await foundDirect({ storageDir: larDataDir(), genesisDir: join(second, "genesis") });
      const holder = seatedCustody()!;
      const roots = (): string[] => faceRowNames().filter((f) => f.startsWith(".persona-group-root"));
      await holder.lock();
      await expect(seatSeedCharter()).rejects.toThrow(CustodyLocked);
      expect(roots()).toEqual([]);
      // control
      expect((await holder.unlock([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }])).reading).toBe("opens");
      await seatSeedCharter();
      expect((await foundFace({ genesisDir: join(second, "genesis"), handleIndex: 0 })).alreadyStood).toBe(false);
      expect(roots().length).toBe(1);
      await holder.lock();
      unseatCustody(holder);
    } finally {
      if (outer === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = outer;
      rmSync(second, { recursive: true, force: true });
    }
  });

  test("F7 a place founded again restores from its standing archive", async () => {
    const third = mkdtempSync(join(tmpdir(), "lar-founding-again-"));
    const outer = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = third;
    try {
      const genesisDir = join(third, "genesis");
      cpSync(REPO_GENESIS, genesisDir, { recursive: true });
      await foundDirect({ storageDir: larDataDir(), genesisDir });
      const seed = await loadVesselSigningSeed();
      const stand = async (archiveBytes?: Uint8Array): Promise<KeyhiveProvider> => {
        const p = standing(new KeyhiveProvider());
        await p.init({ seed, eventStore: new InMemoryEventStore(), ...(archiveBytes ? { archiveBytes } : {}) });
        return p;
      };
      // Something only the kept archive holds: a sentinel the vessel individual created after its founding.
      const kept = await stand((await loadIdentityArchive())!);
      const marker = await kept.createSentinelDoc("lar:///t.witness/kept-by-the-archive");
      await persistIdentityArchive(await kept.exportArchive());
      await foundDirect({ storageDir: larDataDir(), genesisDir, force: true });
      const after = await stand((await loadIdentityArchive())!);
      expect(await after.knowsAgent(marker.agentIdHex), "the re-seed kept what the standing archive held").toBe(true);
      // control: the seed alone, with no archive, knows no such agent
      expect(await (await stand()).knowsAgent(marker.agentIdHex)).toBe(false);
      const holder = seatedCustody()!;
      await holder.lock();
      unseatCustody(holder);
    } finally {
      if (outer === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = outer;
      rmSync(third, { recursive: true, force: true });
    }
  });

  test("F8 removing a completed face's bootstrap entry founds a fresh group", async () => {
    const genesisDir = join(root, "genesis");
    const holder = seatedCustody()!;
    if (!holder.isUnlocked()) expect((await holder.unlock([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }])).reading).toBe("opens");
    const before = (await loadIdentityAnchors(2))!;
    const atomBefore = (await loadFaceAtomOfGroup(before.personaGroupId))!;
    const orphanArchive = readFileSync(veilArchivePath(before.personaGroupId));
    // control: the whole face answers already-stood
    expect((await foundFace({ genesisDir, handleIndex: 2 })).alreadyStood).toBe(true);
    // The completed face loses its plane entry; its group and sealed rows remain an orphan's own.
    const plugin = JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string };
    const packed = JSON.parse(plugin.text) as { tiddlers: Record<string, { text: string }> };
    const planes = personaScopedBagIds(before.personaGroupId);
    const stale = [planes.identities, planes.circles, planes.sessions, planes.persona].filter((title) => packed.tiddlers[title]);
    expect(stale.length, "the face's plane entries stand").toBe(4);
    for (const title of stale) delete packed.tiddlers[title];
    writeFileSync(larBootstrapPath(), JSON.stringify({ ...plugin, text: JSON.stringify(packed) }, null, 2));

    const again = await foundFace({ genesisDir, handleIndex: 2 });
    expect(again.alreadyStood).toBe(false);
    const after = (await loadIdentityAnchors(2))!;
    expect(after.personaGroupId, "the next founding mints another group").not.toBe(before.personaGroupId);
    expect(hex((await loadFaceAtomOfGroup(after.personaGroupId))!), "the next group mints another atom").not.toBe(hex(atomBefore));
    expect(hex((await loadFaceAtomOfGroup(before.personaGroupId))!), "the orphan keeps its atom").toBe(hex(atomBefore));
    expect(readFileSync(veilArchivePath(before.personaGroupId)).equals(orphanArchive), "the orphan keeps its archive bytes").toBe(true);
    expect(readFileSync(veilArchivePath(after.personaGroupId)).equals(orphanArchive), "the new group seals its own archive").toBe(false);
    const now = JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, unknown> };
    expect(now.tiddlers[personaScopedBagIds(after.personaGroupId).identities], "the entry landed").toBeTruthy();
    expect((await foundFace({ genesisDir, handleIndex: 2 })).alreadyStood).toBe(true);
  });
});
