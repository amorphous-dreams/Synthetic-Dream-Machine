/**
 * kahu-reach-founded-island — W26 slice 3's first red: no production path called `kahuCabalCanonAccess`. A one-seat
 * hearth's founded island now reads system canon through it, with each of its two facts read apart:
 *
 *   · the COUNTED ADMISSION: the shore's board (charter roster plus the acts its carriage board carries),
 *   · the SENTINEL MEMBERSHIP: this island's own Keyhive provider, over the REAL founded face.
 *
 * Proven: the founded face's group, admitted at the one seat, holds the reach; CONTROLS each lose one fact and refuse
 * by the reason the predicate names: a board with no admission (`joined-without-admission`), a provider that never
 * saw the group (`admitted-not-joined`), a vessel with no board reader or no charter (a stranger). The island's
 * group rides the one accessor (`kahuRealmGroup`), so the `0x` PersonaGroup id and the cabal's bare hex agree.
 */
import { afterEach, describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { DaemonEventStore, KeyhiveProvider, kahuReachSourceOf } from "@lararium/keyhive";
import { hex, hexToBytes, kahuRealmGroup, kahuReachAccess, openKahuCabalAct, signKahuCabalAct, type KahuCabalBoardReader, type KahuQuorumSeats } from "@lararium/mesh";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { kahuCabalCanonAccess } from "@lararium/mesh";
import { standFoundedIsland } from "./stand-founded-island.js";
import { foundHearthDirect } from "./found-route.js";
import { readKahuCabalBoard } from "../src/commands/nexus-cabal.js";
import { loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { ownedStore } from "../src/owned-store.js";
import { larDataDir, larSealHome } from "../src/vessel-paths.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";

const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) { try { teardown.pop()!(); } catch { /* best-effort */ } } });

const NEXUS = "nexus-" + "ab".repeat(32);
const SEAT = new Uint8Array(32).fill(9);

async function boardFor(group: string | null): Promise<KahuCabalBoardReader> {
  const roster: KahuQuorumSeats = { keys: [hex(await ed.getPublicKeyAsync(SEAT))], threshold: 1, sealEpochCid: "epoch-founded-1" };
  const acts = group === null ? [] : [await signKahuCabalAct(
    openKahuCabalAct({ nexus: NEXUS, group, action: "admit", roster }),
    [{ signer: roster.keys[0]!, sign: (b) => ed.signAsync(b, SEAT).then(hex) }], roster)];
  return () => ({ nexus: NEXUS, roster, acts });
}

/** The face's own veil provider over its sealed archive: the one that created, and so can read, the sentinel. */
async function veilOf(st: Awaited<ReturnType<typeof standFoundedIsland>>): Promise<KeyhiveProvider> {
  const v = new KeyhiveProvider();
  await v.init({
    seed: hexToBytes(st.veil.atom.seed), eventStore: new DaemonEventStore({ daemon: st.ctx.composite, face: st.daemonAuth.personaGroupId }),
    archiveBytes: st.veil.veilArchiveBytes,
  } as never);
  await v.hydrateFromEventStore();
  return v;
}

describe("a one-seat founded island reads system canon through kahuCabalCanonAccess", () => {
  test("the founded face's group, admitted at the one seat, holds the reach", async () => {
    const st = await standFoundedIsland(teardown);
    const group = kahuRealmGroup(st.daemonAuth.personaGroupId);
    const veil = await veilOf(st);
    const source = kahuReachSourceOf({
      board: await boardFor(group), personaGroupId: st.daemonAuth.personaGroupId, meshCabalDocIdHex: st.daemonAuth.meshCabalDocIdHex,
      sentinelProvider: () => veil,
    });
    expect(await kahuReachAccess(source)).toMatchObject({ held: true, standing: "admitted", reason: "admitted-and-joined" });
  }, 60_000);

  test("CONTROLS: a board with no admission, a provider that never saw the group, and no shore at all each refuse", async () => {
    const st = await standFoundedIsland(teardown);
    const group = kahuRealmGroup(st.daemonAuth.personaGroupId);
    const veil = await veilOf(st);
    const base = { personaGroupId: st.daemonAuth.personaGroupId, meshCabalDocIdHex: st.daemonAuth.meshCabalDocIdHex };
    // the sentinel member nobody admitted
    expect(await kahuReachAccess(kahuReachSourceOf({ ...base, board: await boardFor(null), sentinelProvider: () => veil })))
      .toMatchObject({ held: false, reason: "joined-without-admission" });
    // admitted, yet this provider holds no membership of the group in the sentinel
    const stranger = new KeyhiveProvider();
    await stranger.init({ seed: new Uint8Array(32).fill(5) } as never);
    expect(await kahuReachAccess(kahuReachSourceOf({ ...base, board: await boardFor(group), sentinelProvider: () => stranger })))
      .toMatchObject({ held: false, reason: "admitted-not-joined" });
    // no board reader: the island composes no source, so every door reads a stranger
    expect(kahuReachSourceOf({ ...base, board: undefined, sentinelProvider: () => veil })).toBeUndefined();
    expect((await kahuReachAccess(undefined)).held).toBe(false);
    // a board that finds no charter
    expect((await kahuReachAccess(kahuReachSourceOf({ ...base, board: () => null, sentinelProvider: () => veil }))).held).toBe(false);
  }, 60_000);
});

describe("the shore's reader of a REAL one-seat founding", () => {
  test("the board it reads carries the founding's counted admission for the founded face's group; a place with no charter reads null (CONTROL)", async () => {
    const genesis = join(import.meta.dirname, "..", "..", "..", "genesis");
    const root = mkdtempSync(join(tmpdir(), "lar-kahu-board-"));
    const bare = mkdtempSync(join(tmpdir(), "lar-kahu-bare-"));
    cpSync(genesis, join(root, "genesis"), { recursive: true, filter: (src) => !src.endsWith("social-bootstrap.json") });
    try {
      const founded = await withLarRoot(root, () => foundHearthDirect({ storageDir: join(root, "data", "lares", "vessel"), genesisDir: join(root, "genesis") }));
      await withLarRoot(root, async () => {
        const vesselKey = await loadVesselVerifyingKey();
        const board = await ownedStore(larDataDir(), (repo) => readKahuCabalBoard(repo, larSealHome(), vesselKey));
        expect(board).not.toBeNull();
        expect(board!.nexus).toBe(founded.nexusAid);
        const group = kahuRealmGroup(founded.face.personaGroupId);
        // The sentinel half is the island's own read; with it asserted, the founding's admission alone decides the rest.
        expect(kahuCabalCanonAccess({ group, nexus: board!.nexus, roster: board!.roster, acts: board!.acts, sentinelMember: true }))
          .toMatchObject({ held: true, standing: "admitted" });
        expect(kahuCabalCanonAccess({ group: "ab".repeat(32), nexus: board!.nexus, roster: board!.roster, acts: board!.acts, sentinelMember: true }))
          .toMatchObject({ held: false, reason: "joined-without-admission" });
      });
      await withLarRoot(bare, async () => {
        expect(await ownedStore(larDataDir(), (repo) => readKahuCabalBoard(repo, larSealHome(), "ab".repeat(32)))).toBeNull();
      });
    } finally { rmSync(root, { recursive: true, force: true }); rmSync(bare, { recursive: true, force: true }); }
  }, 120_000);
});
