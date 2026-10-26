/**
 * found-hearth-restore — A RESTORE AS PERSONA ZERO, through the Stable founding act (`found --hearth` from a bundle;
 * lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings, a restore as persona zero). Every act runs the real
 * founding, the real cut and the real restore over real stores under scratch roots: hearth A founds and cuts its
 * persona zero's bundle, A's whole home gets destroyed, and a fresh root founds its hearth FROM that bundle.
 *
 *   F1 · the founding lands the bundle's face as persona zero under its own fixed prefix and pet-name, seats a FRESH
 *        seed charter with a fresh chair that face holds, and lights the face bound to the new AID; the face stands
 *        provisional, and no restore row stays pending.
 *   F2 · a founding that stops at its card resumes only its own root: a bare founding refuses while the restore
 *        stands pending, another face's bundle refuses `restore-pending`, and the same bundle completes; run again,
 *        it moves nothing.
 *   F3 · a root that differs at h0 (a bare founding stopped at its card) refuses, and nothing mints over it.
 *   F4 · over a standing hearth the founding lands no restored face as persona zero (`hearth-stands`).
 *                                                    control: the bare founding, F2's second run, completes as it stood
 *
 * Scratch roots, synthetic names. Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-restore
 */
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { mintBundleKey, sealMemorySection } from "@lararium/mesh";
import { HearthFoundingRefused } from "../src/commands/found-hearth.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { cutFaceBundle } from "../src/face-bundle-cut.js";
import { readProvisionalMark } from "../src/face-provisional.js";
import { aFaceBinds } from "../src/hearth-aid.js";
import { loadIdentityAnchors } from "../src/identity-anchors.js";
import { readNexusDoc } from "../src/nexus-doc.js";
import { listPersonaRosterLines, makeNodePersonaPetnameStore } from "../src/node-vessel-identity.js";
import { ownedStore } from "../src/owned-store.js";
import { readLocalPersonaKelChain } from "../src/local-persona-kel.js";
import { heldSeatKey } from "../src/seat-key-store.js";
import { faceRowNames } from "./face-paths.js";
import { RESTORE_PENDING_FILE } from "../src/vault-carriers.js";
import { larDataDir, larIdentityDir, larSealHome } from "../src/vessel-paths.js";
import { foundHearthDirect } from "./found-route.js";

vi.setConfig({ testTimeout: 600_000, hookTimeout: 600_000 });

const REPO_GENESIS = join(import.meta.dirname, "..", "..", "..", "genesis");
const withRepo = <T>(act: Parameters<typeof ownedStore<T>>[1]): Promise<T> => ownedStore(larDataDir(), act);
const roots: string[] = [];
const priorRoot = process.env["LAR_ROOT"];

async function leave(): Promise<void> {
  const holder = seatedCustody();
  if (holder) { await holder.lock(); unseatCustody(holder); }
}
/** Stand in a fresh scratch root, its genesis copied in; nothing founds yet. */
async function freshRoot(label: string): Promise<string> {
  await leave();
  const root = mkdtempSync(join(tmpdir(), `lar-hearth-restore-${label}-`));
  roots.push(root);
  process.env["LAR_ROOT"] = root;
  cpSync(REPO_GENESIS, join(root, "genesis"), { recursive: true, filter: (s) => !s.endsWith("social-bootstrap.json") });
  return root;
}
const found = (root: string, extra: Partial<Parameters<typeof foundHearthDirect>[0]> = {}) =>
  foundHearthDirect({ storageDir: larDataDir(), genesisDir: join(root, "genesis"), ...extra });
afterEach(async () => {
  vi.restoreAllMocks();
  await leave();
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

interface Bundle { readonly sealedBody: Uint8Array; readonly bundleKey: Uint8Array; readonly rootKey: string; readonly prefix: string; readonly nexusAid: string; readonly seatKey: string }
/** Found hearth `label` with persona zero named `name`, cut persona zero's bundle, and DESTROY the hearth's home. */
async function cutAndDestroy(label: string, name: string): Promise<Bundle> {
  const root = await freshRoot(label);
  const founded = await found(root, { name });
  const rootKey = (await listPersonaRosterLines()).find((l) => l.handleIndex === 0)!.verifyingKey;
  const prefix = (await loadIdentityAnchors(0))!.personaKelPrefix!;
  const bundleKey = mintBundleKey();
  const cut = await cutFaceBundle({
    face: 0, bundleKey,
    door: {
      wornFace: () => 0, ownEdgeShadowed: async () => false,
      cutMemory: async (to) => ({ section: Buffer.from(sealMemorySection([], to)).toString("base64"), holds: [] }),
      kel: (p) => withRepo((repo) => readLocalPersonaKelChain(repo, p)),
      memoryDoor: null, importMemory: null,
    },
  });
  await leave();
  rmSync(root, { recursive: true, force: true });
  expect(existsSync(root)).toBe(false);
  return { sealedBody: cut.sealedBody, bundleKey, rootKey, prefix, nexusAid: founded.nexusAid, seatKey: founded.seatKey };
}
const refusalOf = async (p: Promise<unknown>): Promise<string> => {
  const e = await p.then(() => null, (err: unknown) => err);
  return e === null ? "LANDED" : e instanceof HearthFoundingRefused ? e.restoreRefusal ?? "hearth-founding-refused" : `threw: ${(e as Error).message.slice(0, 160)}`;
};
const pendingStands = (): boolean => faceRowNames().some((n) => RESTORE_PENDING_FILE.test(n));
const stopAtCard = async (cards: ReadonlyArray<{ readonly chair: string }>): Promise<void> => { if (cards[0]?.chair === "place") return; throw new Error("the card did not read back"); };

describe("a restore as persona zero, through the founding act", () => {
  test("F1 — the bundle's face stands as persona zero of a fresh seed charter, bound to its new AID, provisional", async () => {
    const a = await cutAndDestroy("a", "the gardener");
    const root = await freshRoot("b");
    const founded = await found(root, { name: "", restore: { sealedBody: a.sealedBody, bundleKey: a.bundleKey } });

    expect(founded.restored).toMatchObject({ face: { handleIndex: 0, verifyingKey: a.rootKey }, prefix: a.prefix, resumed: false });
    expect((await listPersonaRosterLines()).map((l) => [l.handleIndex, l.verifyingKey])).toEqual([[0, a.rootKey]]);
    expect((await loadIdentityAnchors(0))?.personaKelPrefix).toBe(a.prefix);
    expect(await (await makeNodePersonaPetnameStore()).get(0)).toBe("the gardener");
    // A FRESH CHARTER AND A FRESH CHAIR: the lost hearth's chair carries no authority here.
    expect(founded.charterSeated).toBe(true);
    expect(founded.nexusAid).not.toBe(a.nexusAid);
    expect(founded.seatKey).not.toBe(a.seatKey);
    expect(readNexusDoc(larSealHome())!.sealLineage![0]!.epochCid).toBe(founded.nexusAid);
    expect(heldSeatKey(founded.seatKey)?.handleIndex).toBe(0);
    expect(await aFaceBinds(founded.nexusAid)).toBe(true);
    expect(founded.face.alreadyStood).toBe(true);
    // THE FACE STANDS PROVISIONAL, and the restore's commit row left.
    expect(await readProvisionalMark(0)).toMatchObject({ prefix: a.prefix, head: { seq: 0 }, from: "bundle" });
    expect(pendingStands()).toBe(false);
  });

  test("F2 — a founding that stops at its card resumes only its own root, and completes", async () => {
    const a = await cutAndDestroy("a", "the gardener");
    const other = await cutAndDestroy("o", "a stranger");
    const root = await freshRoot("b");
    const restore = { sealedBody: a.sealedBody, bundleKey: a.bundleKey };

    expect(await refusalOf(found(root, { name: "", restore, readBack: stopAtCard }))).toBe("threw: the card did not read back");
    expect(pendingStands(), "the restore's commit row holds the founding's own root").toBe(true);
    expect((await listPersonaRosterLines()).map((l) => l.verifyingKey)).toEqual([a.rootKey]);
    expect(readNexusDoc(larSealHome())).toBeNull();

    // A BARE FOUNDING mints no root over the pending restore; ANOTHER FACE'S BUNDLE refuses by name.
    expect(await refusalOf(found(root, { name: "keeper" }))).toBe("hearth-founding-refused");
    expect(await refusalOf(found(root, { name: "", restore: { sealedBody: other.sealedBody, bundleKey: other.bundleKey } }))).toBe("restore-pending");
    expect((await listPersonaRosterLines()).map((l) => l.verifyingKey)).toEqual([a.rootKey]);
    expect(readNexusDoc(larSealHome())).toBeNull();

    // THE SAME BUNDLE completes, from the commit row.
    const done = await found(root, { name: "", restore });
    expect(done.restored).toMatchObject({ face: { handleIndex: 0, verifyingKey: a.rootKey }, resumed: true });
    expect(done.charterSeated).toBe(true);
    expect(pendingStands()).toBe(false);
    expect(await aFaceBinds(done.nexusAid)).toBe(true);

    // RUN AGAIN, it moves nothing: the charter and the face stand as they stood.
    const again = await found(root, { name: "", restore });
    expect(again).toMatchObject({ nexusAid: done.nexusAid, seatKey: done.seatKey, charterSeated: false, restored: null });
    expect(again.face.alreadyStood).toBe(true);
    // CONTROL: the bare founding over the same hearth answers as it stood.
    expect(await found(root, { name: "keeper" })).toMatchObject({ nexusAid: done.nexusAid, charterSeated: false, restored: null });
  });

  test("F3 + F4 — a root that differs at h0 refuses, and over a standing hearth the founding lands no persona zero", async () => {
    const a = await cutAndDestroy("a", "the gardener");
    const restore = { sealedBody: a.sealedBody, bundleKey: a.bundleKey };

    const c = await freshRoot("c");
    expect(await refusalOf(found(c, { name: "keeper", readBack: stopAtCard }))).toBe("threw: the card did not read back");
    const minted = (await listPersonaRosterLines()).map((l) => l.verifyingKey);
    expect(minted).toHaveLength(1);
    expect(minted[0]).not.toBe(a.rootKey);
    expect(await refusalOf(found(c, { name: "", restore }))).toBe("roster-names-another-key");
    expect((await listPersonaRosterLines()).map((l) => l.verifyingKey)).toEqual(minted);
    expect(readNexusDoc(larSealHome())).toBeNull();
    expect(pendingStands()).toBe(false);

    const d = await freshRoot("d");
    const hearth = await found(d, { name: "keeper" });
    expect(await refusalOf(found(d, { name: "", restore }))).toBe("hearth-stands");
    expect(nexusAidAt()).toBe(hearth.nexusAid);
    expect((await listPersonaRosterLines()).map((l) => l.verifyingKey)).not.toContain(a.rootKey);
    expect(pendingStands()).toBe(false);
  });
});

function nexusAidAt(): string | undefined {
  return readNexusDoc(larSealHome())?.sealLineage?.[0]?.epochCid;
}
