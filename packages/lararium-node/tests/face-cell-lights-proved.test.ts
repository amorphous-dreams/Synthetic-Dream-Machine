/**
 * face-cell-lights-proved — THE NODE'S FACE CELL READS THE FACE THIS VESSEL PROVED, WHICHEVER ROAD PROVED IT.
 *
 * A face stands when it stands proved on this vessel (the operator's unlock), never only when a dial's anchor names it
 * (the sealing scope; the session wears the face). A sovereign node with no Nexus to dial still wears its face: its
 * sessions anchor at its own place (`uds-session-door`), so the face cell reads the place subject of the worn face's
 * atom there, the subject a place session of that face carries. A standing dial's chain names the Nexus subject instead.
 *
 *   C1  RED: a founded, sovereign node that dials nothing lights its face cell: the bag map names the worn face's place
 *       subject and the face's own wiki bags beneath it.
 *   C0  CONTROL: a floor node (no face founded) on the default wiki (`lares`, a floor row) lights none: the map names
 *       no face.
 *
 * The map reads through the vessel's own log line (`[sealed-rest] the map names: …`), each time it moves.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slice 5b, red 6's shore wiring)
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { EventEmitter } from "node:events";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { faceAtomPublicKey, placeProofSubjectRef } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { direct } from "./direct-store.js";
import { TEST_CUSTODY, TEST_SLOT } from "./found-route.js";
import { runInit, runFoundTheFace, foundSeedCharter, openNodeVessel, loadIdentityAnchors, loadPlaceAid, seatFaceRoute, seatWardGatherer } from "../dist/src/index.js";
import { loadFaceAtomOfGroup } from "../dist/src/face-atom-store.js";
import type { NodeVesselResult } from "../dist/src/open-node-vessel.js";

seatFaceRoute(async () => [TEST_SLOT]);
seatWardGatherer(async () => TEST_SLOT.pins.flatMap((pin) => (pin.kind === "passphrase" ? [{ kind: "passphrase" as const, passphrase: pin.passphrase }] : [])));

const leaving: Array<() => Promise<void>> = [];
afterEach(async () => { while (leaving.length) await leaving.pop()!(); vi.restoreAllMocks(); });

/** Every face the bag map named, in order, as the vessel's log line names it. */
function mapLines(): string[] {
  const lines: string[] = [];
  const log = console.log.bind(console);
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    const line = args.map(String).join(" ");
    const named = /^\[sealed-rest\] the map names: (.+)$/.exec(line);
    if (named) lines.push(named[1]!);
    log(...args);
  });
  return lines;
}

/** A vessel composed by `openNodeVessel` with no dial: founded with its face, or left at its floor. */
async function compose(founded: boolean, wikiId: string): Promise<{ root: string; vessel: NodeVesselResult }> {
  const root = mkdtempSync(join(tmpdir(), "face-cell-proved-"));
  const genesisDir = join(root, "genesis");
  const storageDir = join(root, "data", "lares", "vessel");
  cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), genesisDir, { recursive: true });
  let vessel: NodeVesselResult | null = null;
  leaving.push(async () => { if (vessel) await withLarRoot(root, () => vessel!.teardown()); rmSync(root, { recursive: true, force: true }); });
  await withLarRoot(root, () => direct(runInit)({ storageDir, genesisDir, custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
  if (founded) {
    await withLarRoot(root, () => foundSeedCharter({ name: "face cell founder", readBack: async () => {} }));
    await withLarRoot(root, () => direct(runFoundTheFace)({ storageDir, genesisDir }));
  }
  vessel = await withLarRoot(root, () => openNodeVessel({ hostId: "face-cell", wikiId, storageDir, genesisDir, wss: new EventEmitter() as never }));
  await withLarRoot(root, () => vessel!.daemon.workerEa);
  return { root, vessel };
}

describe("the node's face cell reads the proved face", () => {
  test("C1 RED: a sovereign node that dials nothing lights its face cell at its own place", async () => {
    const lines = mapLines();
    const { root } = await compose(true, "face-cell");
    const subject = await withLarRoot(root, async () => {
      const group = (await loadIdentityAnchors(0))?.personaGroupId;
      expect(group, "the founded face names its group").toBeTruthy();
      const seed = await loadFaceAtomOfGroup(group!);
      expect(seed, "the founded face holds its atom").not.toBeNull();
      let atomKey: string;
      try { atomKey = faceAtomPublicKey(seed!); } finally { seed!.fill(0); }
      return placeProofSubjectRef({ atomKey, place: await loadPlaceAid() } as never);
    });
    const lit = lines.filter((named) => named !== "none");
    expect(lit.length, `the map never named a face (it named: ${lines.join(" | ")})`).toBeGreaterThan(0);
    const last = lit.at(-1)!;
    expect(last.startsWith(`${subject.slice(0, 16)}…`), `the map names another face than the worn face's place subject: ${last}`).toBe(true);
    expect(last, "the lit map names the face's own wiki bags").toMatch(/=[0-9A-Za-z]{8}/);
  }, 180_000);

  test("C0 CONTROL: a floor node lights no face", async () => {
    const lines = mapLines();
    await compose(false, "lares");
    expect(lines.filter((named) => named !== "none")).toEqual([]);
  }, 180_000);
});
