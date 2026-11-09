/**
 * floor-user-wiki-refuses — A FLOOR ASKED FOR A USER WIKI STANDS, SERVES ITS FLOOR WIKI, AND NAMES THE ONE THAT WAITS.
 *
 * Before a face lights, every wiki content store rests sealed and the floor catalog names public bags alone (the sealing
 * scope, stable-founding-road#/rulings, 2026-11-06): a user wiki's bag rests on a face's half, so a floor composition can
 * neither load nor rest its documents. And every boot rests at the floor (stable-founding-road#/cold-start): a verb that
 * needs sovereign state refuses at a STANDING floor and names `lares vault unlock`. So the floor never ends its process
 * over a wiki that needs a face, which would leave the operator no unlock door: it refuses THAT wiki by name, mounts its
 * floor wiki (`lares`) instead, and names the waiting wiki where the page and the CLI read it; the unlock's composition
 * mounts it.
 *
 *   W1  RED: a floor node (no face founded) asked for a user wiki (`--wiki floor-user`, no floor row) stands on `lares`
 *       and names `floor-user` waiting (`wiki-awaits-face`, chosen by the boot's own ask), never mounting it.
 *   W2  RED: a founded node whose daemon active-wiki marker names a user wiki stands at the floor on `lares` and names
 *       that wiki waiting, chosen by the marker.
 *   W3  CONTROL: the same root after the unlock (the test custody route): the composition mounts the marker's wiki and
 *       names none waiting.
 *   W0  CONTROL: a floor node asked for a floor row's wiki (`lares`) boots at the floor and names none waiting.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slice 5b)
 */
import { afterEach, describe, expect, test } from "vitest";
import { EventEmitter } from "node:events";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DAEMON_BAG_ID } from "@lararium/mesh";
import { buildActiveWikiRecord } from "@lararium/tw5";
import { withLarRoot } from "../../../../tests/harness/with-lar-root.js";
import { direct } from "../direct-store.js";
import { TEST_CUSTODY, TEST_PASSPHRASE, TEST_SLOT } from "../found-route.js";
import {
  runInit, runFoundTheFace, foundSeedCharter, openNodeVessel, seatFaceRoute, seatWardGatherer,
  FsCustodyIo, makeCustodyHolder, seatCustody, larDataDir, larIdentityDir, larSealHome,
} from "../../dist/src/index.js";
import type { NodeOpenPhase, NodeVesselResult } from "../../dist/src/open-node-vessel.js";

seatFaceRoute(async () => [TEST_SLOT]);
seatWardGatherer(async () => TEST_SLOT.pins.flatMap((pin) => (pin.kind === "passphrase" ? [{ kind: "passphrase" as const, passphrase: pin.passphrase }] : [])));

/** A fresh boot's custody (call inside `withLarRoot`): a holder seated over the root's tree, holding no key. */
function lockedCustody() {
  const homes = { identity: larIdentityDir(), storage: larDataDir(), seal: larSealHome() };
  const holder = makeCustodyHolder({ io: new FsCustodyIo(homes), homes });
  seatCustody(holder);
  return holder;
}

/** `lares vault unlock` by the test custody route (call inside `withLarRoot`): the vessel key and its faces open. */
async function unlockTestCustody(): Promise<void> {
  const holder = lockedCustody();
  const opened = await holder.unlock([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]);
  if (opened.reading !== "opens") throw new Error(`the test route did not open this root's custody: ${opened.reading}`);
  await holder.unlockFaces([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]);
}

const leaving: Array<() => Promise<void>> = [];
afterEach(async () => { while (leaving.length) await leaving.pop()!(); });

interface Staged { readonly root: string; readonly storageDir: string; readonly genesisDir: string }

/** A scratch root, initialized; founded with its face when `founded`. */
async function stage(founded: boolean): Promise<Staged> {
  const root = mkdtempSync(join(tmpdir(), "floor-user-wiki-"));
  const genesisDir = join(root, "genesis");
  const storageDir = join(root, "hearth", "vessel");
  cpSync(join(import.meta.dirname, "..", "..", "..", "..", "genesis"), genesisDir, { recursive: true });
  leaving.push(async () => { rmSync(root, { recursive: true, force: true }); });
  await withLarRoot(root, () => direct(runInit)({ storageDir, genesisDir, custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
  if (founded) {
    await withLarRoot(root, () => foundSeedCharter({ name: "floor wiki founder", readBack: async () => {} }));
    await withLarRoot(root, () => direct(runFoundTheFace)({ storageDir, genesisDir }));
  }
  return { root, storageDir, genesisDir };
}

/** One composition on a staged root for `wikiId`: at the floor (`sovereign: null`), else as the seated custody opens it. */
async function compose(at: Staged, wikiId: string, floor: boolean): Promise<{ phases: NodeOpenPhase[]; vessel: NodeVesselResult; down: () => Promise<void> }> {
  const phases: NodeOpenPhase[] = [];
  const vessel = await withLarRoot(at.root, () => openNodeVessel({
    hostId: "floor-user-wiki", wikiId, storageDir: at.storageDir, genesisDir: at.genesisDir, wss: new EventEmitter() as never,
    ...(floor ? { sovereign: null } : {}), onPhase: (p) => { phases.push(p); },
  }));
  let gone = false;
  const down = async () => { if (!gone) { gone = true; await withLarRoot(at.root, () => vessel.teardown()); } };
  leaving.push(down);
  return { phases, vessel, down };
}

/** A founded root whose daemon active-wiki marker names a user wiki (the operator's last `wiki open`), every composition down. */
async function markedRoot(): Promise<Staged> {
  const at = await stage(true);
  const first = await compose(at, "lares", false);
  await withLarRoot(at.root, () => first.vessel.daemon.composite.put(buildActiveWikiRecord("marker-user", "lares-cli:wiki-open"),
    { kind: "lares-verb", requestId: "floor-user-wiki-marker" } as never, { bag: DAEMON_BAG_ID }));
  await first.down();
  return at;
}

type Waiting = { name?: string; reason?: string; wikiId?: string; source?: string; message?: string };
/** The waiting wiki the composition names: `absent` where the result carries no such reading at all. */
const waiting = (v: NodeVesselResult): Waiting | null | "absent" => {
  const w = (v as { wikiAwaitsFace?: Waiting | null }).wikiAwaitsFace;
  return w === undefined ? "absent" : w === null ? null : { name: w.name, reason: w.reason, wikiId: w.wikiId, source: w.source, message: w.message };
};

describe("a floor asked for a user wiki stands and names the wiki that waits", () => {
  test("W1 RED: a user wiki asked at the floor waits by name; the floor stands on `lares`", async () => {
    const { phases, vessel } = await compose(await stage(false), "floor-user", true);
    expect(vessel.activeWikiId, "the floor mounts its floor wiki").toBe("lares");
    expect(phases, "the floor wiki mounted").toContain("wiki-ready");
    const w = waiting(vessel);
    expect(w).toMatchObject({ name: "FloorWikiRefusal", reason: "wiki-awaits-face", wikiId: "floor-user", source: "boot-arg" });
    expect((w as Waiting).message, "the line names the wiki and the unlock").toMatch(/floor-user.*awaits your face.*lares vault unlock/);
  }, 300_000);

  test("W2 RED: the marker's user wiki waits by name at the floor; the floor stands on `lares`", async () => {
    const at = await markedRoot();
    // A fresh boot holds no key: the floor composes.
    await withLarRoot(at.root, async () => { lockedCustody(); });
    const { phases, vessel } = await compose(at, "lares", true);
    expect(vessel.activeWikiId, "the floor mounts its floor wiki").toBe("lares");
    expect(phases, "the floor wiki mounted").toContain("wiki-ready");
    expect(waiting(vessel)).toMatchObject({ name: "FloorWikiRefusal", reason: "wiki-awaits-face", wikiId: "marker-user", source: "daemon-marker" });
  }, 600_000);

  test("W3 CONTROL: after the unlock, the marker's wiki mounts and nothing waits", async () => {
    const at = await markedRoot();
    // `lares vault unlock`: the test custody route opens the vessel key and its faces, and the vessel composes again.
    await withLarRoot(at.root, () => unlockTestCustody());
    const { phases, vessel } = await compose(at, "lares", false);
    expect(vessel.activeWikiId, "the unlock mounts the waiting wiki").toBe("marker-user");
    expect(phases).toContain("wiki-ready");
    expect([null, "absent"], "nothing waits once the face stands").toContain(waiting(vessel));
  }, 600_000);

  test("W0 CONTROL: a floor row's wiki boots at the floor and names none waiting", async () => {
    const { phases, vessel } = await compose(await stage(false), "lares", true);
    expect(vessel.activeWikiId).toBe("lares");
    expect(phases).toContain("wiki-ready");
    expect([null, "absent"]).toContain(waiting(vessel));
  }, 300_000);
});
