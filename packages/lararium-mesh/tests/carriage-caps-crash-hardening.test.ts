/**
 * carriage-caps crash-hardening — the fire-and-forget carriage tick (`void pullOnce().finally(schedule)`,
 * carriage-caps.ts) must NEVER let a synchronous/async throw out of the underlying automerge handle
 * (the "Module terminated" WASM death after an OOM'd sync-decode) escape as an unhandled rejection that
 * kills the whole daemon process. A dead-module `.change()` throw must be CONTAINED: logged, and the
 * timer loop keeps rescheduling — not propagated to crash the caller.
 *
 * RED (pre-fix): the self-fired `void pullOnce().finally(schedule)` at build time calls a `.change()`
 * that throws; nothing catches it, so it surfaces as an unhandled promise rejection on `process`.
 * GREEN (post-fix): the tick's body is guarded — the throw is logged via `onLog`, never surfaces as an
 * unhandled rejection, and the loop still reschedules (does not stop()).
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/vessel-caps#lares-viales
 */

import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { composeVessel, type CapModule } from "../src/cap-compose.js";
import { CARRIAGE_CAP, carriageCap, type MeshPalaceComponent } from "../src/carriage-caps.js";
import { emptyMeshPalaceDoc, type MeshPalaceDoc } from "../src/mesh-palace.js";

/** A meshpalace-providing cap wired to a handle whose `.change()` throws — simulating a dead WASM
 *  module post-OOM ("Module terminated") on the very next carriage tick. */
const deadModuleMeshpalace = (): CapModule => {
  const real = new Repo({ sharePolicy: async () => true }).create<MeshPalaceDoc>(emptyMeshPalaceDoc());
  const handle = {
    doc: () => real.doc(),
    change: () => { throw new Error("Module terminated"); },
  } as unknown as MeshPalaceComponent["handle"];
  return { id: CARRIAGE_CAP.meshpalace, build: () => ({ handle }) as MeshPalaceComponent };
};

describe("carriage tick — a dead-module throw is CONTAINED, not an unhandled rejection", () => {
  test("a handle whose .change() throws does not escape the fire-and-forget tick as an unhandled rejection", async () => {
    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown): void => { rejections.push(reason); };
    process.on("unhandledRejection", onUnhandled);

    const logs: string[] = [];
    // selfBearing + selfCoord so the tick reaches the r-publish `handle.change()` site unconditionally.
    // Starting rCurrent=1 (far from the degree-0 target ~8) guarantees the very first tick's damped
    // move exceeds R_DEADBAND (0.5), so `handle.change()` fires on tick one regardless of peers.
    const vessel = await composeVessel([
      deadModuleMeshpalace(),
      carriageCap({
        peers: [], pullIntervalMs: 1_000_000,
        selfBearing: "lar:///ha.ka.ba/bags/oracle/node/test", selfCoord: { r: 1, theta: 0 },
        onLog: (line) => logs.push(line),
      }),
    ]);

    // Let the self-fired build-time tick (`void pullOnce().finally(schedule)`) and its microtasks run —
    // this is the exact fire-and-forget boundary the cure guards (not the exposed `pullOnce()` manual
    // call, which callers still `await`/`catch` themselves).
    await new Promise((r) => setTimeout(r, 50));

    process.off("unhandledRejection", onUnhandled);
    await vessel.dispose();

    expect(rejections).toEqual([]); // the throw never escaped as an unhandled rejection
    expect(logs.some((l) => /Module terminated|contained|failed/i.test(l))).toBe(true); // logged, not silent
  });

  test("CONTROL — a healthy handle still merges + reschedules unchanged", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const handle = repo.create<MeshPalaceDoc>(emptyMeshPalaceDoc());
    const healthy: CapModule = { id: CARRIAGE_CAP.meshpalace, build: () => ({ handle }) as MeshPalaceComponent };
    const logs: string[] = [];
    const vessel = await composeVessel([
      healthy,
      carriageCap({
        peers: [], pullIntervalMs: 1_000_000,
        selfBearing: "lar:///ha.ka.ba/bags/oracle/node/healthy", selfCoord: { r: 1, theta: 0 },
        onLog: (line) => logs.push(line),
      }),
    ]);
    const carriage = vessel.get<{ pullOnce: () => Promise<number> }>(CARRIAGE_CAP.carriage)!;
    const merged = await carriage.pullOnce();
    expect(merged).toBe(0); // no peers to merge from, but no throw either
    expect(logs.some((l) => /standing/i.test(l))).toBe(true); // the r-publish path still ran normally
    await vessel.dispose();
  });
});
