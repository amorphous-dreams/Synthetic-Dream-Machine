/**
 * place-session-seals — A SOVEREIGN NODE WITH NO NEXUS SEALS UNDER ITS PLACE SESSION.
 *
 * A session reads (face, anchor), and the anchor reads a Nexus or the place (session-contract#/the-hands). Every change
 * books the session that wrote it and its save signs under that session; an unbooked save refuses and waits in memory,
 * never written clear (stable-founding-road#/rulings, "A timer save signs under its session"). A vessel that dials
 * nothing still wears its face at its own place, so its saves seal under that place session and reach rest: holding them
 * in memory for a later dial would lose them at a restart.
 *
 *   P1  RED: a founded, sovereign node that dials nothing writes into its face's own wiki bag: the save books the place
 *       session, seals and reaches rest (the stand-down counts no waiting save, the disk holds no clear byte of it), and
 *       a restart reads it back.
 *
 * Its control stands at the book (`@lararium/mesh` tests/place-anchor-seals A0): with no place standing (a floor, a
 * locked face), a place session's ask refuses and signs nothing, so its save waits, never written clear.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { afterEach, describe, expect, test } from "vitest";
import { EventEmitter } from "node:events";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withLarRoot } from "../../../../tests/harness/with-lar-root.js";
import { direct } from "../direct-store.js";
import { TEST_CUSTODY, TEST_SLOT } from "../found-route.js";
import { runInit, runFoundTheFace, foundSeedCharter, openNodeVessel, seatFaceRoute, seatWardGatherer } from "../../dist/src/index.js";
import type { NodeVesselResult } from "../../dist/src/open-node-vessel.js";

seatFaceRoute(async () => [TEST_SLOT]);
seatWardGatherer(async () => TEST_SLOT.pins.flatMap((pin) => (pin.kind === "passphrase" ? [{ kind: "passphrase" as const, passphrase: pin.passphrase }] : [])));

const WIKI = "place-seal";
const TITLE = "place-seal-note";
const leaving: Array<() => Promise<void>> = [];
afterEach(async () => { while (leaving.length) await leaving.pop()!(); });

/** Every file under `dir`, read whole. */
function tree(dir: string): Buffer[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? tree(path) : [readFileSync(path)];
  });
}
const restsClear = (dir: string, secret: string): boolean => tree(dir).some((bytes) => bytes.includes(Buffer.from(secret, "utf8")));

/** One founded node's root, its face founded, no dial. */
async function found(): Promise<{ root: string; storageDir: string; genesisDir: string }> {
  const root = mkdtempSync(join(tmpdir(), "place-seal-"));
  const genesisDir = join(root, "genesis");
  const storageDir = join(root, "data", "lares", "vessel");
  cpSync(join(import.meta.dirname, "..", "..", "..", "..", "genesis"), genesisDir, { recursive: true });
  leaving.push(async () => { rmSync(root, { recursive: true, force: true }); });
  await withLarRoot(root, () => direct(runInit)({ storageDir, genesisDir, custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
  await withLarRoot(root, () => foundSeedCharter({ name: "place seal founder", readBack: async () => {} }));
  await withLarRoot(root, () => direct(runFoundTheFace)({ storageDir, genesisDir }));
  return { root, storageDir, genesisDir };
}
async function open(at: { root: string; storageDir: string; genesisDir: string }): Promise<NodeVesselResult> {
  const vessel = await withLarRoot(at.root, () => openNodeVessel({ hostId: "place-seal", wikiId: WIKI, storageDir: at.storageDir, genesisDir: at.genesisDir, wss: new EventEmitter() as never }));
  await withLarRoot(at.root, () => vessel.daemon.workerEa);
  return vessel;
}
/** Write one tiddler into the face's own wiki bag (the active wiki's document) and flush the Repo. */
async function write(vessel: NodeVesselResult, text: string): Promise<void> {
  const handle = await vessel.repo.find(vessel.wikiDocUrl as never);
  handle.change((d: { tiddlers: Record<string, unknown> }) => { d.tiddlers[TITLE] = { tiddler: { title: TITLE, text } }; });
  await vessel.repo.flush();
}
async function readBack(vessel: NodeVesselResult): Promise<string | null> {
  const handle = await vessel.repo.find(vessel.wikiDocUrl as never);
  const record = (handle.doc() as { tiddlers?: Record<string, { tiddler?: { text?: unknown } }> }).tiddlers?.[TITLE];
  return typeof record?.tiddler?.text === "string" ? record.tiddler.text : null;
}

describe("a sovereign node with no Nexus seals under its place session", () => {
  test("P1 RED: the face's save books the place session, seals, reaches rest, and a restart reads it back", async () => {
    const at = await found();
    const SECRET = "the-heron-keeps-the-place-ledger";
    const first = await open(at);
    let waiting: number;
    try {
      await write(first, SECRET);
      waiting = await withLarRoot(at.root, () => first.sealedRestStandDown());
    } finally { await withLarRoot(at.root, () => first.teardown()); }
    expect(waiting, "no save waits in memory: the place session sealed every one").toBe(0);
    expect(restsClear(at.storageDir, SECRET), "the disk holds no clear byte of the face's save").toBe(false);
    const again = await open(at);
    try {
      expect(await readBack(again), "the restart reads the sealed save back").toBe(SECRET);
    } finally { await withLarRoot(at.root, () => again.teardown()); }
  }, 300_000);
});
