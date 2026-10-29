/**
 * face-bundle-rehearsal — THE END-TO-END REHEARSAL of a face's backup bundle, on scratch roots and real doors.
 *
 *   found a vessel · light a face · seal a private body · cut the bundle · write a second body under the SAME
 *   key version after the cut · set the sealed bytes aside · DESTROY the vessel's whole home · found a fresh
 *   vessel · restore · (the restore re-admits: a new seat under the same fixed prefix) · stand the fresh vessel's
 *   island · import the memory section · OPEN both bodies · refuse a second restore · refuse another identity.
 *
 * Real founding (`runInit`), real face rite (`runFoundTheFace`), real cut, real restore, and the vessel's own key
 * island booted through the real `operatorDaemonOptions` over each root, with real Keyhive identities and the
 * node's own sealed-store shore. The session proof stands composed as the sealed store's own vessel vectors compose
 * it: no production path opens a session signer yet, so a production mint and a production import stand SPECIFIED.
 *
 * Also here, the bundle's own promise about what it never carries: every 32-byte secret an opened bundle holds
 * stands a Keyhive identity that holds no seat the lost vessel held, so nothing a bundle carries signs as an old seat.
 *
 * Scratch roots, synthetic names and keys. Canon: lar:///ha.ka.ba/lararium/mesh/custody
 */
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { InMemoryEventStore, KeyhiveProvider } from "@lararium/keyhive";
import {
  MEMORY_CUT_SHADOW_READ, bundleMemoryKeypair, hex, hexToBytes, isVerbRefusal, mintBundleKey, openFaceBundleBody, openMemorySection, readFaceBundleBody,
} from "@lararium/mesh";
import { runFoundTheFace } from "../src/commands/init.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { loadFaceAtomOfGroup } from "../src/face-atom-store.js";
import { cutFaceBundle, type BackupDoor } from "../src/face-bundle-cut.js";
import { ImportRefused, RestoreRefused, importFaceBundleMemory, restoreFaceBundle } from "../src/face-bundle-restore.js";
import { loadIdentityAnchors } from "../src/identity-anchors.js";
import { IslandVerbRefused } from "../src/island-verb-ask.js";
import { listPersonaRosterLines, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { readVerifiedCasBlobFromFs, casDirForStorage } from "../src/node-cas.js";
import { ownedStore } from "../src/owned-store.js";
import { readLocalPersonaKelChain } from "../src/local-persona-kel.js";
import { larDataDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";
import { standRootIsland, suiteSessionProof, type RootIsland } from "./stand-root-island.js";

vi.setConfig({ testTimeout: 900_000, hookTimeout: 900_000 });

const REPO_GENESIS = join(import.meta.dirname, "..", "..", "..", "genesis");
const BAG = "lar:///ha.ka.ba/@test/bags/SEARCH-ME-garden-notes";
const PRIVATE = "a private note, sealed before the cut";
const LATER = "a second note, sealed after the cut under the same key version";
const foundFace = direct(runFoundTheFace);
const withRepo = <T>(act: Parameters<typeof ownedStore<T>>[1]): Promise<T> => ownedStore(larDataDir(), act);

const roots: string[] = [];
const priorRoot = process.env["LAR_ROOT"];
async function leave(): Promise<void> {
  const holder = seatedCustody();
  if (holder) { await holder.lock(); unseatCustody(holder); }
}
/** A fresh vessel under a fresh root: a HEARTH (place, seed charter, persona zero's face), or its seed charter alone. */
async function foundVessel(label: string, as: "hearth" | "charter" = "hearth"): Promise<string> {
  await leave();
  const root = mkdtempSync(join(tmpdir(), `lar-rehearsal-${label}-`));
  roots.push(root);
  process.env["LAR_ROOT"] = root;
  cpSync(REPO_GENESIS, join(root, "genesis"), { recursive: true });
  await foundDirect({ storageDir: larDataDir(), genesisDir: join(root, "genesis") });
  await seatSeedCharter({ name: `${label}-keeper` });
  if (as === "hearth") await foundFace({ genesisDir: join(root, "genesis"), handleIndex: 0 });
  return root;
}
afterEach(async () => {
  await leave();
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** Place one memory verb as the vessel's main thread does: a refusal of the island's rides out as `IslandVerbRefused`, its name in `reason`. */
async function ask(island: RootIsland, verb: string, act: "cut" | "door" | "import", facts: Record<string, unknown>): Promise<Record<string, unknown>> {
  try { return await island.run(verb, facts, { act, facts }); }
  catch (err) {
    if (isVerbRefusal(err)) throw new IslandVerbRefused(verb, err.message, err.reason);
    throw err;
  }
}

/** What a standing vessel lends a cut and an import, over one island the suite stood. */
function doorOver(island: RootIsland, repo: Parameters<Parameters<typeof ownedStore>[1]>[0], face = 0): BackupDoor {
  return {
    wornFace: () => face,
    ownEdgeShadowed: async () => false,
    cutMemory: async (to) => {
      const facts = { to: hex(to), shadow: MEMORY_CUT_SHADOW_READ };
      const out = await ask(island, "sealed-memory-cut", "cut", facts);
      return { section: String(out["section"]), holds: out["holds"] as Array<{ bagId: string; founding: string; keyVersion: string }> };
    },
    kel: (prefix) => readLocalPersonaKelChain(repo, prefix),
    memoryDoor: async () => hexToBytes(String((await ask(island, "sealed-memory-door", "door", {}))["door"])),
    importMemory: async (section, secret) => {
      const facts = { section, secret };
      return (await ask(island, "sealed-memory-import", "import", facts))["results"] as Array<{ bagId: string; keyVersion: string; outcome: string }>;
    },
  };
}
const said = async (p: Promise<unknown>): Promise<string> => {
  const e = await p.then(() => null, (err: unknown) => err);
  if (e === null) return "ANSWERED";
  if (e instanceof RestoreRefused || e instanceof ImportRefused) return e.reason;
  return isVerbRefusal(e) ? `island:${e.reason}` : `threw: ${(e as Error).constructor.name}: ${(e as Error).message.slice(0, 120)}`;
};
/** The plaintext an island's `sealed-open` landed in this root's cleartext-local tier. */
async function opened(island: RootIsland, ref: unknown): Promise<string> {
  const out = await island.run("sealed-open", { bag: BAG, ref: String(ref) });
  const bytes = await readVerifiedCasBlobFromFs(String(out["cid"]), casDirForStorage(larDataDir()));
  return Buffer.from(bytes!).toString("utf8");
}
/** The Keyhive identifier a 32-byte seed stands as, read off a real provider. */
async function identityOf(seed: Uint8Array): Promise<string> {
  const p = new KeyhiveProvider();
  try {
    await p.init({ seed, eventStore: new InMemoryEventStore() });
    return String(await p.whoami()).toLowerCase();
  } finally { await p.dispose(); }
}

test("THE REHEARSAL — found, light, seal, cut, destroy, found fresh, restore, re-admit, import, open; a second restore and another identity refuse", async () => {
  const proof = await suiteSessionProof("rehearsal");

  // ── VESSEL A: found, light a face, seal a private body, cut ─────────────────────────────────────────────────
  const rootA = await foundVessel("a");
  const rootKey = (await listPersonaRosterLines())[0]!.verifyingKey;
  const anchorsA = (await loadIdentityAnchors(0))!;
  const oldSeats = [
    await loadVesselVerifyingKey(),
    await identityOf((await loadFaceAtomOfGroup(anchorsA.personaGroupId))!),
  ];
  const vesselKeyA = await loadVesselVerifyingKey();
  const bundleKey = mintBundleKey();
  const aside = mkdtempSync(join(tmpdir(), "lar-rehearsal-aside-"));
  roots.push(aside);
  const a = await withRepo(async (repo) => {
    const island = await standRootIsland({ repo, handleIndex: 0, bags: [BAG], sessionProof: proof });
    try {
      const first = await island.run("sealed-seal", { bag: BAG, text: PRIVATE });
      const cut = await cutFaceBundle({ face: 0, bundleKey, door: doorOver(island, repo) });
      // AFTER THE CUT, the writer keeps sealing under the same head: no roll moved it.
      const second = await island.run("sealed-seal", { bag: BAG, text: LATER });
      expect(second["keyVersion"]).toBe(first["keyVersion"]);
      // CONTROL: the vessel that sealed them opens both.
      expect(await opened(island, first["ref"])).toBe(PRIVATE);
      return { cut, first, second };
    } finally { await island.down(); }
  });
  expect(a.cut.holds).toEqual([{ bagId: BAG, founding: a.first["founding"], keyVersion: a.first["keyVersion"] }]);

  // THE SEALED BYTES SURVIVE ELSEWHERE: the bundle holds the keys, and a copy of the vessel's rests holds the bytes.
  for (const tier of ["sealed", "cad"]) cpSync(join(larDataDir(), tier), join(aside, tier), { recursive: true });

  // ── THE BUNDLE HOLDS NO SEAT KEY ────────────────────────────────────────────────────────────────────────────
  // Every 32-byte secret an opened bundle carries, stood as a real Keyhive identity, holds no seat vessel A held.
  const body = readFaceBundleBody(openFaceBundleBody(a.cut.sealedBody, bundleKey)!)!;
  const pair = bundleMemoryKeypair(bundleKey);
  const entries = openMemorySection(Uint8Array.from(Buffer.from(body.memory.section, "base64")), pair.secret)!;
  const carried: Uint8Array[] = [
    hexToBytes(body.root.signingKey), ...body.faceProofKeys.map((k) => hexToBytes(k.secret)), hexToBytes(body.addressSecret!), Uint8Array.from(bundleKey), Uint8Array.from(pair.secret),
    ...entries.map((e) => Uint8Array.from(e.key)),
  ];
  expect(entries).toHaveLength(1);
  expect(carried.length).toBeGreaterThanOrEqual(4);
  const stood = await Promise.all(carried.map(identityOf));
  // CONTROL: the hunt finds a seat where one stands (the vessel's own seed stands as an old seat).
  expect(oldSeats).toContain(await loadVesselVerifyingKey());
  expect(stood.filter((id) => oldSeats.includes(id))).toEqual([]);
  // No word of the vessel's own seat rides the body: its place key, atom seed, group or device edge.
  const text = JSON.stringify(body).toLowerCase();
  for (const word of [vesselKeyA, hex((await loadFaceAtomOfGroup(anchorsA.personaGroupId))!), anchorsA.personaGroupId, anchorsA.meshCabalDocIdHex]) {
    expect(text.includes(word.toLowerCase()), `the body names ${word.slice(0, 16)}…`).toBe(false);
  }

  // ── DESTROY THE SCRATCH HOME ────────────────────────────────────────────────────────────────────────────────
  await leave();
  rmSync(rootA, { recursive: true, force: true });
  expect(existsSync(rootA)).toBe(false);

  // ── VESSEL B: a fresh hearth, restore beside its persona zero (the restore re-admits) ─────────────────────────
  await foundVessel("b");
  const restored = await restoreFaceBundle({ sealedBody: a.cut.sealedBody, bundleKey, as: 1, withRepo });
  expect(restored.face).toEqual({ handleIndex: 1, verifyingKey: rootKey });
  expect(restored.holds).toEqual(a.cut.holds);
  const anchorsB = (await loadIdentityAnchors(1))!;
  expect(anchorsB.personaKelPrefix).toBe(anchorsA.personaKelPrefix);
  expect(anchorsB.personaGroupId, "a NEW seat: another key group").not.toBe(anchorsA.personaGroupId);
  expect(await loadVesselVerifyingKey()).not.toBe(vesselKeyA);
  // The sealed bytes return from where they survived.
  for (const tier of ["sealed", "cad"]) cpSync(join(aside, tier), join(larDataDir(), tier), { recursive: true });

  await withRepo(async (repo) => {
    const island = await standRootIsland({ repo, handleIndex: 1, bags: [BAG], sessionProof: proof });
    try {
      const door = doorOver(island, repo, 1);
      // CONTROL: before the import the restored seat holds no key, and the body stays shut.
      expect(await said(island.run("sealed-open", { bag: BAG, ref: String(a.first["ref"]) }))).not.toBe("ANSWERED");

      // ── IMPORT ────────────────────────────────────────────────────────────────────────────────────────────
      const imported = await importFaceBundleMemory({ sealedBody: a.cut.sealedBody, bundleKey, door });
      expect(imported.face).toEqual({ handleIndex: 1, verifyingKey: rootKey });
      expect(imported.results).toEqual([{ bagId: BAG, keyVersion: a.first["keyVersion"], outcome: "imported" }]);

      // ── OPEN: the body sealed before the cut, and the one sealed AFTER it under the same version ─────────────
      expect(await opened(island, a.first["ref"])).toBe(PRIVATE);
      expect(await opened(island, a.second["ref"])).toBe(LATER);

      // The same section again: the vessel holds that version, and nothing changes.
      const again = await importFaceBundleMemory({ sealedBody: a.cut.sealedBody, bundleKey, door });
      expect(again.results).toEqual([{ bagId: BAG, keyVersion: a.first["keyVersion"], outcome: "held" }]);
    } finally { await island.down(); }
  });

  // ── A SECOND RESTORE OVER IT REFUSES ────────────────────────────────────────────────────────────────────────
  expect(await said(restoreFaceBundle({ sealedBody: a.cut.sealedBody, bundleKey, withRepo }))).toBe("face-already-held");

  // ── ANOTHER IDENTITY REFUSES ────────────────────────────────────────────────────────────────────────────────
  // A second face, cut on a vessel of its own, meets the vessel that mounts the restored face.
  await foundVessel("c");
  const otherKey = mintBundleKey();
  const other = await withRepo(async (repo) => {
    const island = await standRootIsland({ repo, handleIndex: 0, bags: [BAG], sessionProof: proof });
    try { return await cutFaceBundle({ face: 0, bundleKey: otherKey, door: doorOver(island, repo) }); } finally { await island.down(); }
  });
  expect(other.face.verifyingKey).not.toBe(rootKey);
  await leave();
  // Back on vessel B, which mounts the restored face.
  process.env["LAR_ROOT"] = roots.find((r) => r.includes("lar-rehearsal-b-"))!;
  const { openTestCustody } = await import("./found-route.js");
  await openTestCustody();
  await withRepo(async (repo) => {
    const island = await standRootIsland({ repo, handleIndex: 1, bags: [BAG], sessionProof: proof });
    try {
      expect(await said(importFaceBundleMemory({ sealedBody: other.sealedBody, bundleKey: otherKey, door: doorOver(island, repo, 1) }))).toBe("another-face");
      // Its lineage, too: the index holds persona zero, so the other face's restore names the roster line.
      expect(await said(restoreFaceBundle({ sealedBody: other.sealedBody, bundleKey: otherKey, withRepo: (act) => act(repo) }))).toBe("roster-names-another-key");
      // CONTROL: the restored face's own bundle still imports as held.
      expect((await importFaceBundleMemory({ sealedBody: a.cut.sealedBody, bundleKey, door: doorOver(island, repo, 1) })).results[0]!.outcome).toBe("held");
    } finally { await island.down(); }
  });
});

test("ON A VESSEL WHOSE ISLAND HOLDS NO SESSION SIGNER, the import refuses by name and lands nothing: a production import stands SPECIFIED", async () => {
  const proof = await suiteSessionProof("rehearsal-unsigned");
  await foundVessel("a");
  const bundleKey = mintBundleKey();
  const cut = await withRepo(async (repo) => {
    const island = await standRootIsland({ repo, handleIndex: 0, bags: [BAG], sessionProof: proof });
    try {
      await island.run("sealed-seal", { bag: BAG, text: PRIVATE });
      return await cutFaceBundle({ face: 0, bundleKey, door: doorOver(island, repo) });
    } finally { await island.down(); }
  });
  await foundVessel("b");
  await restoreFaceBundle({ sealedBody: cut.sealedBody, bundleKey, as: 1, withRepo });
  await withRepo(async (repo) => {
    // The island a production vessel stands today: no session proof composed.
    const island = await standRootIsland({ repo, handleIndex: 1, bags: [BAG], sessionProof: null });
    try {
      expect(await said(importFaceBundleMemory({ sealedBody: cut.sealedBody, bundleKey, door: doorOver(island, repo, 1) }))).toBe("signer-unavailable");
    } finally { await island.down(); }
  });
});
