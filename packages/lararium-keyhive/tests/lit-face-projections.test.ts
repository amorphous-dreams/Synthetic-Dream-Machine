/**
 * lit-face-projections — the daemon island's seat for EVERY LIT FACE PROJECTS ITS OWN WRITES.
 *
 *   P1 — a face that lights with its own grants mounts one projection over ITS OWN engine
 *   P2 — a face with no grant (no folder) mounts nothing; a face whose engine composes none (shut) mounts nothing
 *   P3 — a drop stops the face's projection, and a light again mounts afresh
 *   P4 — a light over a standing projection keeps the one that stands
 *   P5 — a drop that lands while the engine composes leaves nothing mounted
 *   P6 — a mount that faults never holds the light: the face stands unprojected
 *   P7 — THE RECOMPOSE: the engine rebuilds (its working slot bound late); the projector stops over the old engine first, the
 *        face stays lit, and the projection mounts again over the new engine
 */
import { describe, expect, test } from "vitest";
import { litFaceProjections } from "../src/lit-face-projections.js";

const grants = (segment: string) => [{ bagId: "lar:///ha.ka.ba/wikis/daemon/working", mirrorRoot: `/lar/projections/faces/${segment}/wikis/daemon`, scope: "daemon" }];
let generation = 0;
const engineOf = (face: number) => ({ tw5: { face, generation } as never, composite: { face } as never });

function rig(opts: { engines?: Record<number, boolean>; slow?: Promise<void>; fault?: boolean } = {}) {
  const mounted: { face: number; engine: unknown; roots: string[] }[] = [];
  const stopped: number[] = [];
  const seat = litFaceProjections({
    engine: async (face) => { if (opts.slow) await opts.slow; return opts.engines?.[face] === false ? null : engineOf(face); },
    mount: (face, engine) => {
      if (opts.fault) throw new Error("the disk refused");
      mounted.push({ face: face.handleIndex, engine, roots: (face.diskMirrors ?? []).map((m) => m.mirrorRoot) });
      return async () => { stopped.push(face.handleIndex); };
    },
  });
  return { seat, mounted, stopped };
}

describe("lit-face-projections", () => {
  test("a light that triggers its own engine rebuild completes and can drop", async () => {
    let closed = false;
    let calls = 0;
    const mounted: number[] = [];
    const stopped: number[] = [];
    const seat = litFaceProjections({
      engine: async () => {
        if (calls++ === 0) {
          await Promise.resolve();
          await seat.rebuilding(1);
          closed = true;
          void seat.rebuilt(1);
          return engineOf(1);
        }
        return engineOf(1);
      },
      mount: () => { mounted.push(1); return async () => { stopped.push(1); }; },
    });
    const bounded = async (work: Promise<void>) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timed out")), 300); })]); }
      finally { if (timer) clearTimeout(timer); }
    };
    await bounded(seat.light("k1", { handleIndex: 1, diskMirrors: grants("h-one") }));
    expect(closed).toBe(true);
    expect(mounted).toEqual([1]);
    await bounded(seat.drop("k1"));
    expect(stopped).toEqual([1]);
  });
  test("P1 — a lit face mounts over its own engine, under its own grants", async () => {
    const { seat, mounted } = rig();
    await seat.light("k1", { handleIndex: 1, diskMirrors: grants("h-one") });
    await seat.light("k2", { handleIndex: 2, diskMirrors: grants("h-two") });
    expect(mounted).toEqual([
      { face: 1, engine: engineOf(1), roots: ["/lar/projections/faces/h-one/wikis/daemon"] },
      { face: 2, engine: engineOf(2), roots: ["/lar/projections/faces/h-two/wikis/daemon"] },
    ]);
    expect(seat.standing()).toEqual(["k1", "k2"]);
  });

  test("P2 — no grant, or no engine (a shut face), mounts nothing", async () => {
    const { seat, mounted } = rig({ engines: { 3: false } });
    await seat.light("k1", { handleIndex: 1 });
    await seat.light("k1b", { handleIndex: 1, diskMirrors: [] });
    await seat.light("k3", { handleIndex: 3, diskMirrors: grants("h-three") });
    await seat.light("kx", { diskMirrors: grants("h-x") });
    expect(mounted).toEqual([]);
    expect(seat.standing()).toEqual([]);
  });

  test("P3 — a drop stops the projection; a light again mounts afresh", async () => {
    const { seat, mounted, stopped } = rig();
    await seat.light("k1", { handleIndex: 1, diskMirrors: grants("h-one") });
    await seat.drop("k1");
    expect(stopped).toEqual([1]);
    expect(seat.standing()).toEqual([]);
    await seat.drop("k1");
    expect(stopped).toEqual([1]);
    await seat.light("k1", { handleIndex: 1, diskMirrors: grants("h-one") });
    expect(mounted).toHaveLength(2);
  });

  test("P4 — a light over a standing projection keeps it", async () => {
    const { seat, mounted } = rig();
    await seat.light("k1", { handleIndex: 1, diskMirrors: grants("h-one") });
    await seat.light("k1", { handleIndex: 1, diskMirrors: grants("h-one") });
    expect(mounted).toHaveLength(1);
  });

  test("P5 — a drop during the engine's composition leaves nothing mounted", async () => {
    let release!: () => void;
    const slow = new Promise<void>((resolve) => { release = resolve; });
    const { seat, mounted, stopped } = rig({ slow });
    const lighting = seat.light("k1", { handleIndex: 1, diskMirrors: grants("h-one") });
    const dropping = seat.drop("k1");
    release();
    await Promise.all([lighting, dropping]);
    expect(mounted).toEqual([]);
    expect(stopped).toEqual([]);
    expect(seat.standing()).toEqual([]);
  });

  test("P6 — a faulting mount leaves the face lit and unprojected", async () => {
    const { seat, mounted } = rig({ fault: true });
    await expect(seat.light("k1", { handleIndex: 1, diskMirrors: grants("h-one") })).resolves.toBeUndefined();
    expect(mounted).toEqual([]);
    expect(seat.standing()).toEqual([]);
  });

  test("P7 — a rebuild stops the old projector first, keeps the face lit, and mounts over the new engine", async () => {
    generation = 0;
    const order: string[] = [];
    const { seat, mounted, stopped } = rig();
    await seat.light("k1", { handleIndex: 1, diskMirrors: grants("h-one") });
    expect(mounted.map((m) => m.engine)).toEqual([{ tw5: { face: 1, generation: 0 }, composite: { face: 1 } }]);
    await seat.rebuilding(1);
    order.push(`stopped ${stopped.length}`);
    expect(stopped, "the projector stops before the old engine closes").toEqual([1]);
    expect(seat.standing(), "the face stays lit through the rebuild").toEqual(["k1"]);
    generation = 1;
    await seat.rebuilt(1);
    expect(mounted.map((m) => m.engine)).toEqual([
      { tw5: { face: 1, generation: 0 }, composite: { face: 1 } },
      { tw5: { face: 1, generation: 1 }, composite: { face: 1 } },
    ]);
    expect(seat.standing()).toEqual(["k1"]);
    await seat.drop("k1");
    expect(stopped, "the drop stops the new projector once, never the old one again").toEqual([1, 1]);
    await seat.rebuilding(9);
    await seat.rebuilt(9);
    expect(mounted).toHaveLength(2);
    expect(order).toEqual(["stopped 1"]);
  });
});
