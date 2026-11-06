/**
 * seat-settle-before-mount — THE BOOT'S OWN ASK, PLACED BEFORE THE HOST WORKING LAYER MOUNTS, SETTLES ONCE IT MOUNTS.
 *
 * A sovereign vessel whose fleet board counts a raise it has not seen through settles on the first fold:
 * `openNodeVessel` registers `workerEa.then(() => seatSettler.onFold())`, so the settle places `seat-duties` on the
 * daemon island before the boot caller (main.ts) mounts the host's daemon working layer. The island writes the
 * outcome into that working document, which the daemon composite does not yet read. The ask checked once, found
 * nothing, and waits on the composite's change events with no timer.
 *
 *   S1  THE WINDOW CLOSED (slice 5b, red 3: `composer-mounts-working-first.test.ts`): the composer now mounts the layer
 *       before the settle asks and before `openNodeVessel` returns, so the outcome reads through the composite as it
 *       lands, and the settle reports by name (`[edge-seats] settled on a fold …` or `… stay owed: the key shore did
 *       not run (<reason>)`), never hangs; a caller's later mount stands idempotent. The composite still hands every
 *       title a late layer holds to its subscribers (`CompositeStore.addLayer`), the cure this file first pinned.
 *   S2  CONTROL: a vessel whose board owes no raise places no `seat-duties` before the mount; the same instrument
 *       that reads S1's one outcome reads none here.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { EventEmitter } from "node:events";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DocHandle, Repo } from "@automerge/automerge-repo";
import { OUTCOME_URI_PREFIX, plainField } from "@lararium/mesh";
import { withLarRoot } from "../../../../tests/harness/with-lar-root.js";
import { direct } from "../direct-store.js";
import { TEST_CUSTODY, TEST_SLOT } from "../found-route.js";
import { runInit, runFoundTheFace, foundSeedCharter, openNodeVessel, runEdgeKapae, seatFaceRoute, seatWardGatherer } from "../../dist/src/index.js";
import type { NodeVesselResult } from "../../dist/src/open-node-vessel.js";

seatFaceRoute(async () => [TEST_SLOT]);
seatWardGatherer(async () => TEST_SLOT.pins.flatMap((pin) => (pin.kind === "passphrase" ? [{ kind: "passphrase" as const, passphrase: pin.passphrase }] : [])));

const leaving: Array<() => Promise<void>> = [];
afterEach(async () => { while (leaving.length) await leaving.pop()!(); vi.restoreAllMocks(); });

/** A founded, sovereign vessel, stood the way main.ts stands it up to (not including) the host working layer's mount. */
async function stand(owesRaise: boolean): Promise<{ root: string; vessel: NodeVesselResult }> {
  const root = mkdtempSync(join(tmpdir(), "settle-before-mount-"));
  const genesisDir = join(root, "genesis");
  const storageDir = join(root, "data", "lares", "vessel");
  cpSync(join(import.meta.dirname, "..", "..", "..", "..", "genesis"), genesisDir, { recursive: true });
  let vessel: NodeVesselResult | null = null;
  leaving.push(async () => { if (vessel) await withLarRoot(root, () => vessel!.teardown()); rmSync(root, { recursive: true, force: true }); });
  await withLarRoot(root, () => direct(runInit)({ storageDir, genesisDir, custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
  await withLarRoot(root, () => foundSeedCharter({ name: "settle founder", readBack: async () => {} }));
  await withLarRoot(root, () => direct(runFoundTheFace)({ storageDir, genesisDir }));
  // The owed raise: another device's edge raised on this face's fleet board, which this vessel has not seen through.
  if (owesRaise) await withLarRoot(root, () => direct(runEdgeKapae)({ device: "ab".repeat(32), raised: true }));
  vessel = await withLarRoot(root, () => openNodeVessel({ hostId: "settle", wikiId: "settle", storageDir, genesisDir, wss: new EventEmitter() as never }));
  await vessel.daemon.workerEa;
  return { root, vessel };
}

type Doc = { tiddlers?: Record<string, unknown> };
const handlesOf = (repo: Repo): DocHandle<Doc>[] => Object.values((repo as unknown as { handles: Record<string, DocHandle<Doc>> }).handles);

/** Every terminal `seat-duties` outcome any document in this Repo holds. */
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

/** Resolves on the change that first leaves a terminal `seat-duties` outcome in this Repo (the island's working document syncing in). */
function seatDutiesOutcomeLands(repo: Repo): Promise<string> {
  return new Promise((resolve) => {
    const watched = new Set<DocHandle<Doc>>();
    const read = (): void => { const [title] = seatDutiesOutcomes(repo); if (title) resolve(title); };
    const watch = (handle: DocHandle<Doc>): void => { if (watched.has(handle)) return; watched.add(handle); handle.on("change", read); };
    repo.on("document", ({ handle }) => { watch(handle as DocHandle<Doc>); read(); });
    for (const handle of handlesOf(repo)) watch(handle);
    read();
  });
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

describe("the boot's own seat-duties ask, placed before the host working layer mounts", () => {
  test("S1 — the outcome reads through the composite, and the settle reports by name; a caller's mount stands idempotent", async () => {
    const report = edgeSeatsLines();
    const { root, vessel } = await stand(true);
    const title = await seatDutiesOutcomeLands(vessel.repo);
    expect(seatDutiesOutcomes(vessel.repo)).toEqual([title]);
    await withLarRoot(root, () => vessel.daemon.mountHostWorkingLayer());
    expect(await report.first).toMatch(/^\[edge-seats\] (settled on a fold: 1 raise\(s\) owed|1 raise\(s\) stay owed: the key shore did not run \(.+\))/);
    expect(await vessel.daemon.composite.get(title)).not.toBeNull();
  }, 180_000);

  test("S2 — CONTROL: a vessel whose board owes no raise asks nothing before the mount", async () => {
    const report = edgeSeatsLines();
    const { root, vessel } = await stand(false);
    await withLarRoot(root, () => vessel.daemon.mountHostWorkingLayer());
    expect(seatDutiesOutcomes(vessel.repo)).toEqual([]);
    expect(report.lines).toEqual([]);
  }, 180_000);
});
