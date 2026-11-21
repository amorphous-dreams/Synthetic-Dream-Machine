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
 *   R4  NOTHING HALF-DONE: a run stopped after the copy aside and before the row's replace leaves the foreign row whole beside
 *       its copy, and a retry finishes it; a write that lands between the read and the replace refuses `row-moved`, and the row
 *       keeps that write; a retry over the marker answers the rehive done (R1).
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
import { faceRowPortOf, rehiveFaceRows, rehiveShutFace, RehiveRefused, type FaceRowPort } from "../src/face-rehive.js";
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
/** The door's act over the seated holder: the face shuts first (a rehive runs only on a shut face), as the operator locks it. */
async function rehive(ordinal: number, credentials = ROUTE) {
  const holder = seatedCustody()!;
  const at = await holder.faceStanding({ ordinal });
  if (at?.unlocked) await holder.lockFace(at.fcid);
  return rehiveShutFace({ holder, io: new FsCustodyIo(vesselCustodyHomes()), ordinal, credentials });
}
/** Open face `ordinal` again in the seated holder, as the next wear does, so a reader reads its rows. */
async function reopen(ordinal: number): Promise<void> {
  await seatedCustody()!.unlockFace({ ordinal }, ROUTE);
}
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
  await reopen(1);
  expect(out.outcome).toBe("stood-from-seed");
  expect(out.aside).toMatch(new RegExp(`^${veilArchiveFile(g1).replace(/\./g, "\\.")}\\.mismatch-[0-9a-f]{16}$`));
  expect(out.foreignIdentity).not.toBe(out.ownIdentity);
  expect(await loadVeilArchive(g1), "the row reads as no Archive: the marker stands in its place").toBeNull();
  expect(await loadVeilArchivePrev(g1), "a marker never rotates into .prev").toBeNull();
  // A RETRY OVER THE MARKER reads the rehive as done and answers it again; nothing moves.
  const again = await rehive(1);
  await reopen(1);
  expect(again).toMatchObject({ outcome: "stood-from-seed", aside: out.aside, foreignIdentity: out.foreignIdentity, resumed: true });
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
  await reopen(1);
  expect(Buffer.from((await loadVeilArchive(g1))!).equals(Buffer.from(own))).toBe(true);
  await misroute((await loadVeilArchive(g0))!, g1);
  // A wrong route spends the face's own attempt budget, as an unlock's does, and moves nothing.
  const wrong = await rehive(1, [{ kind: "passphrase", passphrase: "not-this-face's-route" }]).catch((e: unknown) => e);
  expect(reasonOf(wrong)).toBe("face-refused");
  expect(String((wrong as Error).message)).toMatch(/attempt\(s\) left this boot for this face/);
  await reopen(1);
  expect(Buffer.from((await loadVeilArchive(g1))!).equals(Buffer.from((await loadVeilArchive(g0))!)), "a refused route moved nothing").toBe(true);
  expect(reasonOf(await rehive(7).catch((e: unknown) => e))).toBe("face-not-standing");
});

test("R3 a foreign row beside an own .prev restores that generation", async () => {
  const { g0, g1 } = await twoFaces("prev");
  const own = (await loadVeilArchive(g1))!;
  await seatedCustody()!.writeRecord("identity", veilArchivePrevFile(g1), own);
  await misroute((await loadVeilArchive(g0))!, g1);
  const out = await rehive(1);
  await reopen(1);
  expect(out.outcome).toBe("restored-prev");
  expect(Buffer.from((await loadVeilArchive(g1))!).equals(Buffer.from(own))).toBe(true);
});

/** The rehive over face `ordinal`'s rows through a port `wrap` may stop or race, under a key opened for the act alone. */
async function rehiveThrough(ordinal: number, wrap: (port: FaceRowPort) => FaceRowPort) {
  const holder = seatedCustody()!;
  const at = await holder.faceStanding({ ordinal });
  if (at?.unlocked) await holder.lockFace(at.fcid);
  const opened = await holder.openFaceForAct!({ ordinal }, ROUTE);
  if (opened.reading !== "opens") throw new Error(`the face did not open: ${opened.reading}`);
  try { return await rehiveFaceRows(wrap(faceRowPortOf({ io: new FsCustodyIo(vesselCustodyHomes()), homes: holder.homes, fcid: opened.fcid, fck: opened.fck })), opened.groupDigest!); }
  finally { opened.fck.fill(0); }
}

test("R4 nothing half-done: a stop before the replace leaves the foreign row whole, a retry finishes; a racing write refuses row-moved", async () => {
  const { g0, g1 } = await twoFaces("half");
  const foreign = (await loadVeilArchive(g0))!;
  await misroute(foreign, g1);
  // THE STOP: the copy aside lands, and the run stops before the row's replace.
  const stopped = await rehiveThrough(1, (port) => ({ ...port, replace: async () => { throw new Error("the vessel stopped here"); } })).catch((e: unknown) => e);
  expect(String(stopped)).toContain("the vessel stopped here");
  await reopen(1);
  expect(Buffer.from((await loadVeilArchive(g1))!).equals(Buffer.from(foreign)), "the row never stands absent mid-act").toBe(true);
  // THE RETRY finishes it over the copy the stopped run left.
  const done = await rehive(1);
  await reopen(1);
  expect(done).toMatchObject({ outcome: "stood-from-seed", resumed: true });
  expect(await loadVeilArchive(g1)).toBeNull();

  // THE RACE: a write lands between the read and the replace; the replace refuses and the row keeps that write.
  const { g0: h0, g1: h1 } = await twoFaces("race");
  const foreign2 = (await loadVeilArchive(h0))!;
  const own2 = (await loadVeilArchive(h1))!;
  await misroute(foreign2, h1);
  const raced = await rehiveThrough(1, (port) => ({ ...port, replace: async (file, expected, next) => { await port.write(file, own2); return port.replace(file, expected, next); } })).catch((e: unknown) => e);
  expect(reasonOf(raced)).toBe("row-moved");
  await reopen(1);
  expect(Buffer.from((await loadVeilArchive(h1))!).equals(Buffer.from(own2)), "the racing write stands").toBe(true);
});

