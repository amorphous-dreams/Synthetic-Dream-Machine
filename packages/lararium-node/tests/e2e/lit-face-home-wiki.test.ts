/**
 * lit-face-home-wiki — A LIT FACE LANDS ON ITS OWN HOME WIKI, READ AT LIGHT, END TO END.
 *
 * A face's home preference (`$:/config/lares/home/wiki`, research/pin-mu#S2) rests in that face's own daemon wiki's working
 * layer, so only a face that stands lit reads it; the node vessel reads it once its face lights and activates the wiki it
 * names. The parser stands proven alone (lararium-tw5 home-wiki); these vectors light a real face over a real root.
 *
 *   H1  RED: a founded, unlocked root whose face names a home wiki the face minted composes on the floor wiki's ask and,
 *       once the home read settles, stands on the home wiki, chosen by the home preference.
 *   H2  RED: a home preference naming a wiki no row holds leaves the boot's own wiki active once the read settles: a
 *       refused activation never moves the slot.
 *   H0  CONTROL: a lit face with no home preference stays on the boot's own ask.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slice 5b)
 */
import { afterEach, describe, expect, test } from "vitest";
import { EventEmitter } from "node:events";
import { createConnection } from "node:net";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { HOME_WIKI_TITLE, homeWikiFilter } from "@lararium/tw5";
import { withLarRoot } from "../../../../tests/harness/with-lar-root.js";
import { direct } from "../direct-store.js";
import { TEST_CUSTODY, TEST_PASSPHRASE, TEST_SLOT } from "../found-route.js";
import {
  runInit, runFoundTheFace, foundSeedCharter, openNodeVessel, seatFaceRoute, seatWardGatherer,
  FsCustodyIo, makeCustodyHolder, seatCustody, larDataDir, larIdentityDir, larSealHome, loadVesselVerifyingKey,
} from "../../dist/src/index.js";
import type { NodeVesselResult } from "../../dist/src/open-node-vessel.js";
import { makeUdsSeat, serveUdsFront } from "../../dist/src/uds-channel.js";
import { floorVerbsFor } from "../../dist/src/floor-verbs.js";

seatFaceRoute(async () => [TEST_SLOT]);
seatWardGatherer(async () => TEST_SLOT.pins.flatMap((pin) => (pin.kind === "passphrase" ? [{ kind: "passphrase" as const, passphrase: pin.passphrase }] : [])));

const DAEMON_WORKING = wikiSlotUri("daemon", "working");

/** `lares vault unlock` by the test custody route (call inside `withLarRoot`): the vessel key and its faces open. */
async function unlockTestCustody(): Promise<void> {
  const homes = { identity: larIdentityDir(), storage: larDataDir(), seal: larSealHome() };
  const holder = makeCustodyHolder({ io: new FsCustodyIo(homes), homes });
  seatCustody(holder);
  const opened = await holder.unlock([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]);
  if (opened.reading !== "opens") throw new Error(`the test route did not open this root's custody: ${opened.reading}`);
  await holder.unlockFaces([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]);
}

const leaving: Array<() => Promise<void>> = [];
afterEach(async () => { while (leaving.length) await leaving.pop()!(); });

interface Staged { readonly root: string; readonly storageDir: string; readonly genesisDir: string }

/** A scratch root, initialized and founded with its face. */
async function stageFounded(): Promise<Staged> {
  const root = mkdtempSync(join(tmpdir(), "lit-face-home-"));
  const genesisDir = join(root, "genesis");
  const storageDir = join(root, "hearth", "vessel");
  cpSync(join(import.meta.dirname, "..", "..", "..", "..", "genesis"), genesisDir, { recursive: true });
  leaving.push(async () => { rmSync(root, { recursive: true, force: true }); });
  await withLarRoot(root, () => direct(runInit)({ storageDir, genesisDir, custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
  await withLarRoot(root, () => foundSeedCharter({ name: "lit face home founder", readBack: async () => {} }));
  await withLarRoot(root, () => direct(runFoundTheFace)({ storageDir, genesisDir }));
  return { root, storageDir, genesisDir };
}

/**
 * One unlocked composition on the staged root asking for `wikiId`: its face lights as it composes.
 *
 * THE ROOT HOLDS FOR THE VESSEL'S WHOLE LIFE, as a real vessel's process holds `LAR_ROOT` from its start to its stand-down:
 * each island Worker copies the env at its spawn, and the home read (`homeWikiRead`) spawns the home wiki's island after
 * `openNodeVessel` returns, once the daemon's working layer mounts. A window that closed at the return let that island wake
 * with no root (`HouseRootUnnamed` at its manifest), a race any slower mount loses.
 */
async function composeLit(at: Staged, wikiId: string): Promise<{ vessel: NodeVesselResult; down: () => Promise<void> }> {
  await withLarRoot(at.root, () => unlockTestCustody());
  const previous = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = at.root;
  const release = (): void => { if (previous === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = previous; };
  let vessel: NodeVesselResult;
  try {
    vessel = await openNodeVessel({
      hostId: "lit-face-home", wikiId, storageDir: at.storageDir, genesisDir: at.genesisDir, wss: new EventEmitter() as never,
    });
  } catch (err) { release(); throw err; }
  let gone = false;
  const down = async () => { if (!gone) { gone = true; try { await vessel.teardown(); } finally { release(); } } };
  leaving.push(down);
  return { vessel, down };
}

/** The face writes its home preference into its own daemon wiki's working layer, as `lares tiddler put … --recipe default` does. */
async function putHome(at: Staged, vessel: NodeVesselResult, slug: string): Promise<void> {
  await withLarRoot(at.root, () => vessel.daemon.composite.put({ tiddler: { title: HOME_WIKI_TITLE, text: homeWikiFilter(slug) } },
    { kind: "lares-verb", requestId: "lit-face-home-put" } as never, { bag: DAEMON_WORKING }));
}

/** One verb over the vessel's own channel, as the CLI's `call` sends it: a line of JSON in, the outcome's line back. */
function askOverChannel(socketPath: string, inv: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const sock = createConnection(socketPath);
    let buf = "";
    sock.setEncoding("utf8");
    sock.on("connect", () => sock.write(JSON.stringify(inv) + "\n"));
    sock.on("data", (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl !== -1) { sock.end(); resolve(JSON.parse(buf.slice(0, nl)) as Record<string, unknown>); }
    });
    sock.on("error", reject);
  });
}

/** Mint `slug` over the composition's served front, as `lares wiki init` asks it. */
async function mintWiki(at: Staged, vessel: NodeVesselResult, slug: string): Promise<void> {
  const requestedBy = await withLarRoot(at.root, async () => `0x${await loadVesselVerifyingKey()}`);
  const front = serveUdsFront({ claim: vessel.storeClaim });
  front.attach(makeUdsSeat({
    controlHandle: vessel.daemon.controlHandle, control: vessel.daemon.control,
    placeVerb: (o) => vessel.daemon.placeVerb(o), claim: vessel.storeClaim, repo: vessel.repo,
    floorVerbs: floorVerbsFor(vessel.floorKey === "stands"),
  }));
  try {
    const minted = await askOverChannel(vessel.storeClaim.socketPath, { verb: "init-wiki", args: { slug }, requestedBy, requestId: `mint-${slug}` });
    expect(minted["status"], `the face mints its wiki: ${JSON.stringify(minted)}`).toBe("done");
  } finally { await front.close(); }
}

describe("a lit face lands on its own home wiki", () => {
  test("H1 RED: the face's home preference opens its wiki once the face lights", async () => {
    const at = await stageFounded();
    const first = await composeLit(at, "lares");
    await mintWiki(at, first.vessel, "home-own");
    await putHome(at, first.vessel, "home-own");
    await first.down();
    const { vessel } = await composeLit(at, "lares");
    await vessel.homeWikiSettled();
    expect(vessel.activeWikiId, "the lit face lands on its home wiki").toBe("home-own");
    expect(vessel.activeWikiSource).toBe("home-preference");
  }, 600_000);

  test("H2 RED: a home preference naming a wiki no row holds leaves the boot's own wiki active", async () => {
    const at = await stageFounded();
    const first = await composeLit(at, "lares");
    await putHome(at, first.vessel, "no-such-home");
    await first.down();
    const { vessel } = await composeLit(at, "lares");
    await vessel.homeWikiSettled();
    expect(vessel.activeWikiId, "a refused activation moves no slot").toBe("lares");
    expect(vessel.activeWikiSource).not.toBe("home-preference");
  }, 600_000);

  test("H0 CONTROL: a lit face with no home preference stays on the boot's own ask", async () => {
    const at = await stageFounded();
    const { vessel } = await composeLit(at, "lares");
    await vessel.homeWikiSettled();
    expect(vessel.activeWikiId).toBe("lares");
    expect(vessel.activeWikiSource).not.toBe("home-preference");
  }, 600_000);
});
