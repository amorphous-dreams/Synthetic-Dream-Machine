/**
 * A JOINED FACE'S ISLAND RESTS WITH ITS OVERLAY: a reload reads the board its landing seeded.
 *
 * The walk that bricked (2026-11-14): a browser at its floor lands a fleet-join answer whose reach names a CHARTER island;
 * the landing seats the face's persona-KEL chain on that island's board; the tab reloads with no admit in hand. The boot then
 * resolved its island from the vessel's own key (`own`, a private nexus of one) and the Binding Gate read a blank board:
 * "persona-KEL chain … absent from the local board". The admit carried the island for exactly one boot.
 *
 *   JR1  RED      the reload resolves the island the landing seeded, and the gate's own read finds the chain there.
 *   JR2  CONTROL  a face founded here seats on the vessel's own island and reads there after a reload.
 *   JR3           a face founded BESIDE a joined one seats on the vessel's own island (never the joined face's), a reload
 *                 wearing it reads there, and a reload wearing the joined face reads the admitted island.
 *   JR4  CONTROL  a joined face whose custody left this browser falls back to the floor's own island.
 *
 * The vessel runs for real over IndexedDB; the admit ceremony stands faked beneath it (`wire-vessel-rig`) and seats one real
 * inception event on the board the boot handed it, as the real ceremony does. The island each boot resolved reads off the
 * crossing decision every boot makes with it (`hearthCrossingOf`), and the gate's read (`personaKelChainForPrefix` over
 * `personaKelBoardDocUrl(island)`) runs over this browser's own store once the boot has stood down.
 */
import { describe, expect, test, vi } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import * as ed from "@noble/ed25519";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { BootHalted, admitNaming } from "./wire-vessel-rig.js";
import { bindSyntheticBrowserCustodySlot, bindSyntheticFace, fixtureWardDialog } from "./browser-custody-fixture.js";
import { openBrowserVessel, type BrowserVesselOptions } from "../src/open-browser-vessel.js";
import { openVesselIdb, generateOrLoadBrowserVesselIdentity } from "../src/browser-vessel-identity.js";
import { clearFaceCustody } from "../src/browser-face-custody.js";
import { admittedJoineeIsland, materializeSharedLarDoc, mintPersonaInception, personaKelBoardDocUrl, personaKelChainForPrefix, writePersonaKelEvent } from "@lararium/mesh";

/** What the faked seams saw: the island each landing's ceremony seeded, and the island each boot's crossing decision read. */
const seen = vi.hoisted(() => ({ landed: [] as string[], islands: [] as string[], seat: null as null | ((repo: unknown, island: string) => Promise<void>) }));
/** The prefix the gate's read looks for after each boot. */
let watched: string | null = null;

const opKey = Array.from(await ed.getPublicKeyAsync(new Uint8Array(32).fill(51)), (b) => b.toString(16).padStart(2, "0")).join("");
const inception = mintPersonaInception(opKey, "ab".repeat(32));
seen.seat = async (repo, island) => {
  (await materializeSharedLarDoc(repo as Repo, personaKelBoardDocUrl(island), "board:persona-kel")).change((d) => writePersonaKelEvent(d, inception));
};

vi.mock("@lararium/keyhive", async (orig) => {
  const rig = await import("./wire-vessel-rig.js");
  return {
    ...(await orig<object>()),
    runApplyAdmitPayload: async (input: { repo: unknown; nexusPubkey: string; payload: { deviceEdge?: unknown } }) => {
      seen.landed.push(input.nexusPubkey);
      await seen.seat!(input.repo, input.nexusPubkey);
      return rig.fakeAdmitResult(input);
    },
  };
});
vi.mock("../src/hearth-canon.js", async (orig) => {
  const real = await orig<typeof import("../src/hearth-canon.js")>();
  return { ...real, hearthCrossingOf: (at: Parameters<typeof real.hearthCrossingOf>[0]) => { seen.islands.push(at.nexusPubkey); return real.hearthCrossingOf(at); } };
});

const SLOW = 180_000;
const CHARTER = `nexus-${"e7".repeat(32)}`;
const HEARTH = "cd".repeat(32);

const halted = (extra: Partial<BrowserVesselOptions>): BrowserVesselOptions =>
  ({ onPhase: (phase: string) => { if (phase === "bootstrap-kept") throw new BootHalted(); }, ...extra }) as BrowserVesselOptions;
/** The gate's read, over this browser's own store: how many KEL events stand for `prefix` on `island`'s board (null: none). */
async function chainOn(idbName: string, island: string, prefix: string): Promise<number | null> {
  const repo = new Repo({ storage: new IndexedDBStorageAdapter(`${idbName}:repo`), network: [] });
  try { return personaKelChainForPrefix((await materializeSharedLarDoc(repo, personaKelBoardDocUrl(island), "board:persona-kel")).doc(), prefix)?.length ?? null; }
  finally { await repo.shutdown(); }
}
async function boot(extra: Partial<BrowserVesselOptions> & { idbName: string }): Promise<{ island: string; chain: number | null }> {
  const before = seen.islands.length;
  await expect(openBrowserVessel(halted(extra))).rejects.toBeInstanceOf(BootHalted);
  expect(seen.islands.length, "each boot resolves one island").toBe(before + 1);
  const island = seen.islands[before]!;
  return { island, chain: watched === null ? null : await chainOn(extra.idbName, island, watched) };
}
type Record_ = { personaGroupId?: string; personaKelPrefix?: string };
async function recordOf(idbName: string): Promise<Record_ | undefined> {
  const idb = await openVesselIdb(idbName);
  try {
    return await new Promise((resolve, reject) => { const q = idb.transaction("bootstrap").objectStore("bootstrap").getAll(); q.onsuccess = () => resolve((q.result as Record_[])[0]); q.onerror = () => reject(q.error); });
  } finally { idb.close(); }
}
const ownKeyOf = async (idbName: string): Promise<string> => (await generateOrLoadBrowserVesselIdentity(idbName, undefined, {})).verifyingKey;

/** A carried admit whose reach names the CHARTER island, as the steward's answer did on the live walk. */
const charterAdmit = () => ({ ...admitNaming(HEARTH, {}), hearthIslandKind: "charter", hearthIslandScope: CHARTER, personaKelPrefix: inception.prefix }) as ReturnType<typeof admitNaming>;

/** Stand a floor, then land the charter admit over it. Answers the island the landing seeded. */
async function joined(idbName: string): Promise<{ island: string; group: string }> {
  await boot({ idbName });
  await bindSyntheticBrowserCustodySlot(idbName);
  const admit = charterAdmit();
  await bindSyntheticFace(idbName, admit.personaGroupId);
  seen.landed.length = 0;
  const landing = await boot({ idbName, admit });
  const island = admittedJoineeIsland({ hearthGatePubKey: HEARTH, hearthIslandKind: "charter", hearthIslandScope: CHARTER, ownVesselKey: await ownKeyOf(idbName) });
  expect(island, "the charter kind names the charter's island, never the gate key or this vessel's own").toBe(CHARTER);
  expect(seen.landed, "CONTROL: the landing's ceremony seeds the admitted island's board").toEqual([island]);
  expect(landing.island, "CONTROL: the landing boot stands on the admitted island").toBe(island);
  return { island, group: admit.personaGroupId };
}

describe("a joined face's island rests with its overlay", () => {
  test("JR1 RED the reload reads the island the landing seeded, and the Binding Gate's read finds the chain there", async () => {
    const idbName = `joined-reload-${crypto.randomUUID()}`;
    watched = inception.prefix;
    const { island } = await joined(idbName);
    expect(await chainOn(idbName, island, inception.prefix), "CONTROL: the landing's chain rests on the admitted island's board").toBe(1);
    // THE RELOAD: the same storage, no admit in hand.
    const reload = await boot({ idbName });
    expect(reload.island, "the reload stands on the island the landing resolved").toBe(island);
    expect(reload.chain, "the gate's read reaches the chain the landing seated (null here reads as the fail-closed throw)").toBe(1);
    // Idempotent by intent: a third boot reads the same.
    expect(await boot({ idbName })).toEqual(reload);
  }, SLOW);

  test("JR2 CONTROL a face founded here seats on the vessel's own island and reads there after a reload", async () => {
    const idbName = `founded-reload-${crypto.randomUUID()}`;
    watched = null;
    await boot({ idbName });
    await bindSyntheticBrowserCustodySlot(idbName);
    const founding = await boot({ idbName, foundFace: true, askWardRoute: fixtureWardDialog });
    expect(founding.island).toBe(await ownKeyOf(idbName));
    watched = (await recordOf(idbName))!.personaKelPrefix!;
    const reload = await boot({ idbName });
    expect(reload.island).toBe(founding.island);
    expect(reload.chain, "the founded chain stands on the board the reload reads").toBe(1);
  }, SLOW);

  test("JR3 a face founded beside a joined one seats on the vessel's own island, and each face's reload reads its own", async () => {
    const idbName = `beside-reload-${crypto.randomUUID()}`;
    watched = null;
    const { island, group } = await joined(idbName);
    const own = await ownKeyOf(idbName);
    await bindSyntheticBrowserCustodySlot(idbName);
    const founding = await boot({ idbName, foundFace: { beside: [group] }, askWardRoute: fixtureWardDialog });
    expect(founding.island, "the founding seats its chain on this vessel's own island, never on the joined face's").toBe(own);
    const founded = (await recordOf(idbName))!;
    expect(founded.personaGroupId).not.toBe(group);
    watched = founded.personaKelPrefix!;
    const wearsFounded = await boot({ idbName });
    expect(wearsFounded).toEqual({ island: own, chain: 1 });
    watched = inception.prefix;
    const wearsJoined = await boot({ idbName, face: group });
    expect(wearsJoined).toEqual({ island, chain: 1 });
  }, SLOW);

  test("JR4 CONTROL a joined face whose custody left this browser falls back to the floor's own island", async () => {
    const idbName = `burned-reload-${crypto.randomUUID()}`;
    watched = null;
    const { island, group } = await joined(idbName);
    const cleared = await clearFaceCustody(idbName, group, [{ kind: "passphrase", passphrase: "browser fixture custody slot" }], () => true);
    expect(cleared.reading, "the face's tree left this browser").toBe("cleared");
    const floor = await boot({ idbName });
    expect(floor.island, "the floor stands on the vessel's own key").toBe(await ownKeyOf(idbName));
    expect(floor.island).not.toBe(island);
    expect((await recordOf(idbName))?.personaGroupId, "the burned face's overlay left the record").toBeUndefined();
  }, SLOW);
});
