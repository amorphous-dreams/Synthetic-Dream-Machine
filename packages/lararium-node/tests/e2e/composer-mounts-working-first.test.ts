/**
 * composer-mounts-working-first — slice 5b's red 3: THE COMPOSER MOUNTS THE HOST WORKING LAYER ITSELF, BEFORE ANY INTERNAL ASK.
 *
 * Boot-Wright measured the boot hang (`seat-settle-before-mount.test.ts` S1): the node composer registered
 * `workerEa.then(() => seatSettler.onFold())`, so the vessel's own `seat-duties` ask fired before the boot caller (main.ts)
 * mounted the daemon working layer, and the island answered into a document the daemon composite did not read. The vessel
 * reported `live` with no working layer under it, and only a caller's later mount let the ask read its answer. The cure moves
 * the mount into the one composer: the composition mounts the layer itself once the island answers verbs, its own asks wait
 * on that mount, and the result returns only once the layer stands as the composite's default writable.
 *
 *   R3a  RED: the composed vessel returns with the daemon working layer mounted as the composite's default writable, and the
 *        settle the boot owes reports by name with no caller mount; the outcome reads through the composite.
 *   R3b  RED (static): no boot caller mounts the host working layer (main.ts's lararium and herm branches): one owner, the
 *        composer.
 *   R3c  CONTROL: a caller's mount over a composed vessel stands idempotent (the layer stays the default writable), and a
 *        vessel whose board owes no raise asks nothing.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slice 5b) · Boot-Wright S1/S2
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { EventEmitter } from "node:events";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DocHandle, Repo } from "@automerge/automerge-repo";
import { OUTCOME_URI_PREFIX, plainField, wikiSlotUri } from "@lararium/mesh";
import { withLarRoot } from "../../../../tests/harness/with-lar-root.js";
import { direct } from "../direct-store.js";
import { TEST_CUSTODY, TEST_SLOT } from "../found-route.js";
import { runInit, runFoundTheFace, foundSeedCharter, openNodeVessel, runEdgeKapae, seatFaceRoute, seatWardGatherer } from "../../dist/src/index.js";
import type { NodeVesselResult } from "../../dist/src/open-node-vessel.js";

seatFaceRoute(async () => [TEST_SLOT]);
seatWardGatherer(async () => TEST_SLOT.pins.flatMap((pin) => (pin.kind === "passphrase" ? [{ kind: "passphrase" as const, passphrase: pin.passphrase }] : [])));

const WORKING = wikiSlotUri("daemon", "working");
const leaving: Array<() => Promise<void>> = [];
afterEach(async () => { while (leaving.length) await leaving.pop()!(); vi.restoreAllMocks(); });

/** A founded, sovereign vessel, composed by `openNodeVessel` alone: no caller mount follows it. */
async function compose(owesRaise: boolean): Promise<{ root: string; vessel: NodeVesselResult }> {
  const root = mkdtempSync(join(tmpdir(), "mounts-working-first-"));
  const genesisDir = join(root, "genesis");
  const storageDir = join(root, "hearth", "vessel");
  cpSync(join(import.meta.dirname, "..", "..", "..", "..", "genesis"), genesisDir, { recursive: true });
  let vessel: NodeVesselResult | null = null;
  leaving.push(async () => { if (vessel) await withLarRoot(root, () => vessel!.teardown()); rmSync(root, { recursive: true, force: true }); });
  await withLarRoot(root, () => direct(runInit)({ storageDir, genesisDir, custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
  await withLarRoot(root, () => foundSeedCharter({ name: "mounts founder", readBack: async () => {} }));
  await withLarRoot(root, () => direct(runFoundTheFace)({ storageDir, genesisDir }));
  if (owesRaise) await withLarRoot(root, () => direct(runEdgeKapae)({ device: "ab".repeat(32), raised: true }));
  vessel = await withLarRoot(root, () => openNodeVessel({ hostId: "mounts", wikiId: "mounts", storageDir, genesisDir, wss: new EventEmitter() as never }));
  return { root, vessel };
}

type Doc = { tiddlers?: Record<string, unknown> };
const handlesOf = (repo: Repo): DocHandle<Doc>[] => Object.values((repo as unknown as { handles: Record<string, DocHandle<Doc>> }).handles);
function seatDutiesOutcomes(repo: Repo): string[] {
  const found: string[] = [];
  for (const handle of handlesOf(repo)) {
    let doc: Doc | undefined;
    try { doc = handle.doc(); } catch { continue; }
    for (const [title, raw] of Object.entries(doc?.tiddlers ?? {})) {
      if (!title.startsWith(OUTCOME_URI_PREFIX)) continue;
      const status = plainField(raw as never, "status");
      if (plainField(raw as never, "verb") === "seat-duties" && (status === "done" || status === "error")) found.push(title);
    }
  }
  return found;
}

/** The settler's own report lines, and a promise of the first. */
function edgeSeatsLines(): { lines: string[]; first: Promise<string> } {
  const lines: string[] = [];
  let said: (line: string) => void = () => {};
  const first = new Promise<string>((resolve) => { said = resolve; });
  const log = console.log.bind(console);
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    const line = args.map(String).join(" ");
    if (line.startsWith("[edge-seats]")) { lines.push(line); said(line); }
    log(...args);
  });
  return { lines, first };
}

describe("red 3: the composer mounts the host working layer before any internal ask", () => {
  test("R3a RED: the vessel returns with its working layer mounted, and the owed settle reports with no caller mount", async () => {
    const report = edgeSeatsLines();
    const { vessel } = await compose(true);
    // NO EARLY READY: the composition that returns stands on its working layer, the default writable.
    expect(vessel.daemon.composite.hasBag(WORKING), "the vessel returned with no host working layer").toBe(true);
    expect(vessel.daemon.composite.defaultWritableBagId()).toBe(WORKING);
    expect(await report.first).toMatch(/^\[edge-seats\] (settled on a fold: 1 raise\(s\) owed|1 raise\(s\) stay owed: the key shore did not run \(.+\))/);
    const [title] = seatDutiesOutcomes(vessel.repo);
    expect(title, "the settle reported with no seat-duties outcome").toBeDefined();
    expect(await vessel.daemon.composite.get(title!)).not.toBeNull();
  }, 180_000);

  test("R3b RED (static): no boot caller mounts the host working layer; the composer owns the mount", () => {
    const main = readFileSync(fileURLToPath(new URL("../../src/main.ts", import.meta.url)), "utf8");
    expect(main, "main.ts boots its vessels").toMatch(/openNodeVessel\(|openNodeHerm\(/);
    expect(main, "main.ts mounts the host working layer itself").not.toMatch(/mountHostWorkingLayer\(/);
  });

  test("R3c CONTROL: a caller's mount stands idempotent, and a board that owes no raise asks nothing", async () => {
    const report = edgeSeatsLines();
    const { root, vessel } = await compose(false);
    await withLarRoot(root, () => vessel.daemon.workerEa);
    await withLarRoot(root, () => vessel.daemon.mountHostWorkingLayer());
    expect(vessel.daemon.composite.defaultWritableBagId()).toBe(WORKING);
    expect(seatDutiesOutcomes(vessel.repo)).toEqual([]);
    expect(report.lines).toEqual([]);
  }, 180_000);
});
