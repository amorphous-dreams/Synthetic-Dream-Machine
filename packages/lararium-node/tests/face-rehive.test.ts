/**
 * face-rehive — a face whose veil-archive row holds another identity's Archive stands its hive again from its own seed, on a
 * real founded scratch root (real `runInit`, real face rite, the vessel's own key island through `operatorDaemonOptions`).
 *
 *   R1  H1'S SHAPE: face 1's row holds face 0's Archive and no `.prev` stands. The face's boot refuses
 *       `ArchiveIdentityMismatch`; the rehive moves the row aside (never deleted, the foreign bytes kept whole), the next boot
 *       stands the face from its seed, the archive floor writes the face's own new Archive, and the face's island answers a verb.
 *   R2  a row that restores the face's own identity refuses `row-is-own`, and nothing moves; a route that opens no slot of
 *       the face refuses `face-refused`, and nothing moves.
 *   R3  a row of another identity beside a `.prev` of the face's own: the rehive restores that generation (`restored-prev`).
 *
 * Scratch roots, synthetic names and keys. Canon: lar:///ha.ka.ba/lararium/mesh/custody
 */
import { seatSuiteWard } from "./support/scratch-custody-setup.js";
seatSuiteWard();
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { ArchiveIdentityMismatch, archiveIsOf } from "@lararium/keyhive";
import { runFoundTheFace } from "../src/commands/init.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { loadFaceAtomOfGroup } from "../src/face-atom-store.js";
import { rehiveShutFace, RehiveRefused } from "../src/face-rehive.js";
import { loadIdentityAnchors, loadVeilArchive, loadVeilArchivePrev, veilArchiveFile, veilArchivePrevFile } from "../src/identity-anchors.js";
import { ownedStore } from "../src/owned-store.js";
import { vesselCustodyHomes } from "../src/vault-carriers.js";
import { larDataDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { TEST_PASSPHRASE, foundDirect, seatSeedCharter } from "./found-route.js";
import { standRootIsland, suiteSessionProof } from "./stand-root-island.js";

vi.setConfig({ testTimeout: 900_000, hookTimeout: 900_000 });

const REPO_GENESIS = join(import.meta.dirname, "..", "..", "..", "genesis");
const BAG = "lar:///ha.ka.ba/@test/bags/rehive-notes";
const foundFace = direct(runFoundTheFace);
const withRepo = <T>(act: Parameters<typeof ownedStore<T>>[1]): Promise<T> => ownedStore(larDataDir(), act);
const ROUTE = [{ kind: "passphrase" as const, passphrase: TEST_PASSPHRASE }];

const roots: string[] = [];
const priorRoot = process.env["LAR_ROOT"];
async function leave(): Promise<void> {
  const holder = seatedCustody();
  if (holder) { await holder.lock(); unseatCustody(holder); }
}
/** A hearth with two faces: persona zero and face 1. */
async function twoFaces(label: string): Promise<{ g0: string; g1: string }> {
  await leave();
  const root = mkdtempSync(join(tmpdir(), `lar-rehive-${label}-`));
  roots.push(root);
  process.env["LAR_ROOT"] = root;
  cpSync(REPO_GENESIS, join(root, "genesis"), { recursive: true });
  await foundDirect({ storageDir: larDataDir(), genesisDir: join(root, "genesis") });
  await seatSeedCharter({ name: `${label}-keeper` });
  await foundFace({ genesisDir: join(root, "genesis"), handleIndex: 0 });
  await foundFace({ genesisDir: join(root, "genesis"), handleIndex: 1 });
  return { g0: (await loadIdentityAnchors(0))!.personaGroupId, g1: (await loadIdentityAnchors(1))!.personaGroupId };
}
afterEach(async () => {
  await leave();
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** The pre-cure misroute, as it left the operator's h1: another face's Archive sealed straight into this face's row. */
async function misroute(bytes: Uint8Array, group: string): Promise<void> {
  await seatedCustody()!.writeRecord("identity", veilArchiveFile(group), bytes);
}
const rehive = (ordinal: number, credentials = ROUTE) => rehiveShutFace({ io: new FsCustodyIo(vesselCustodyHomes()), homes: vesselCustodyHomes(), ordinal, credentials });
const reasonOf = (e: unknown): string | null => (e instanceof RehiveRefused ? e.reason : null);

test("R1 h1's shape: a foreign row and no .prev moves aside, the next boot stands the face from its seed, and the face answers", async () => {
  const proof = await suiteSessionProof("rehive");
  const { g0, g1 } = await twoFaces("h1");
  const seed1 = (await loadFaceAtomOfGroup(g1))!;
  const foreign = (await loadVeilArchive(g0))!;
  await misroute(foreign, g1);
  expect(await loadVeilArchivePrev(g1), "h1's shape: no generation back stands").toBeNull();
  // THE RED: the face's boot refuses on the row.
  const refused = await withRepo((repo) => standRootIsland({ repo, handleIndex: 1, bags: [BAG], sessionProof: proof }).then(async (i) => { await i.down(); return null; }, (e: unknown) => e));
  expect(refused).toBeInstanceOf(ArchiveIdentityMismatch);

  const out = await rehive(1);
  expect(out.outcome).toBe("stood-from-seed");
  expect(out.aside).toMatch(new RegExp(`^${veilArchiveFile(g1).replace(/\./g, "\\.")}\\.mismatch-[0-9a-f]{16}$`));
  expect(out.foreignIdentity).not.toBe(out.ownIdentity);
  expect(await loadVeilArchive(g1), "the row left").toBeNull();
  // THE ROW MOVED ASIDE, NEVER DELETED: the foreign bytes stand whole under the face's key.
  const kept = await seatedCustody()!.readRecord("identity", out.aside);
  expect(kept.reading).toBe("opens");
  expect(Buffer.from((kept as { plaintext: Uint8Array }).plaintext).equals(Buffer.from(foreign))).toBe(true);

  // THE NEXT BOOT stands the face from its seed; the archive floor writes the face's own Archive, and the face answers a verb.
  await withRepo(async (repo) => {
    const island = await standRootIsland({ repo, handleIndex: 1, bags: [BAG], sessionProof: proof });
    try {
      const sealed = await island.run("sealed-seal", { bag: BAG, text: "the rehived face seals again" });
      expect(sealed["keyVersion"]).toBeTruthy();
    } finally { await island.down(); }
  });
  const fresh = await loadVeilArchive(g1);
  expect(fresh, "the floor wrote the face's own new Archive").not.toBeNull();
  expect(await archiveIsOf(seed1, fresh!)).toBe(true);
  // And it stands again on the row it wrote.
  await withRepo(async (repo) => { const island = await standRootIsland({ repo, handleIndex: 1, bags: [BAG], sessionProof: proof }); await island.down(); });
  seed1.fill(0);
});

test("R2 an own row refuses row-is-own and a wrong route refuses face-refused; nothing moves", async () => {
  const { g0, g1 } = await twoFaces("own");
  const own = (await loadVeilArchive(g1))!;
  expect(reasonOf(await rehive(1).catch((e: unknown) => e))).toBe("row-is-own");
  expect(Buffer.from((await loadVeilArchive(g1))!).equals(Buffer.from(own))).toBe(true);
  await misroute((await loadVeilArchive(g0))!, g1);
  expect(reasonOf(await rehive(1, [{ kind: "passphrase", passphrase: "not-this-face's-route" }]).catch((e: unknown) => e))).toBe("face-refused");
  expect(await loadVeilArchive(g1), "a refused route moved nothing").not.toBeNull();
  expect(reasonOf(await rehive(7).catch((e: unknown) => e))).toBe("face-not-standing");
});

test("R3 a foreign row beside an own .prev restores that generation", async () => {
  const { g0, g1 } = await twoFaces("prev");
  const own = (await loadVeilArchive(g1))!;
  await seatedCustody()!.writeRecord("identity", veilArchivePrevFile(g1), own);
  await misroute((await loadVeilArchive(g0))!, g1);
  const out = await rehive(1);
  expect(out.outcome).toBe("restored-prev");
  expect(Buffer.from((await loadVeilArchive(g1))!).equals(Buffer.from(own))).toBe(true);
});
