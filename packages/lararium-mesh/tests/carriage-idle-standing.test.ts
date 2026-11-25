import { describe, expect, test } from "vitest";
import { composeVessel, type CapModule } from "../src/cap-compose.js";
import { CARRIAGE_CAP, carriageCap, type MeshPalaceComponent, type MeshPeer } from "../src/carriage-caps.js";
import { emptyMeshPalaceDoc } from "../src/mesh-palace.js";
import { routingSlots } from "../src/mesh-palace.js";

describe("carriage standing", () => {
  test("a peerless boot settles once; a degree change still damps and publishes", async () => {
    const doc = emptyMeshPalaceDoc();
    let writes = 0;
    const handle = { doc: () => doc, change: (fn: (d: typeof doc) => void) => { writes++; fn(doc); } } as unknown as MeshPalaceComponent["handle"];
    const mesh: CapModule = { id: CARRIAGE_CAP.meshpalace, build: () => ({ handle }) };
    const peers: MeshPeer[] = [];
    const vessel = await composeVessel([mesh, carriageCap({ peers, pullIntervalMs: 1_000_000, selfBearing: "lar:///ha.ka.ba/bags/oracle/node/test", selfCoord: { r: 1, theta: 0 } })]);
    const carriage = vessel.get<{ pullOnce: () => Promise<number> }>(CARRIAGE_CAP.carriage)!;
    for (let i = 0; i < 30; i++) await carriage.pullOnce();
    expect(writes).toBeLessThanOrEqual(1);
    expect(routingSlots(doc)[0]?.r).toBeCloseTo(8);
    for (let i = 0; i < 4; i++) peers.push({ endpoint: `http://peer${i}.test`, gatePubKey: "ab".repeat(32) });
    const before = writes;
    await carriage.pullOnce();
    await carriage.pullOnce();
    const first = routingSlots(doc)[0]!.r;
    expect(first).toBeGreaterThan(5.22);
    expect(first).toBeLessThan(8);
    for (let i = 0; i < 15; i++) await carriage.pullOnce();
    expect(writes).toBeGreaterThan(before);
    expect(routingSlots(doc)[0]!.r).toBeLessThan(first);
    await vessel.dispose();
  });
});
