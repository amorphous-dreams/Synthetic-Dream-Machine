/**
 * custody-opens-during-light — the lift's custody gate opens for a face whose island light runs in flight, and only then.
 *
 * A sibling's archive floor rests its Archive inside the island light (after its card), before the host stands its session,
 * so the gate opens for that face while its light still reads live. The window stays the light's own:
 *
 *   W1  a write during the light lands in the face's row.
 *   W2  a sibling with no session and no light in flight takes no write: `face-not-open`.
 *   W3  the window shuts after a light throws, and after its light stops reading live mid-flight.
 *   W4  an overlapping light's settle never shuts another light's window.
 */
import { describe, expect, test, vi } from "vitest";
import { custodyOpens, duringLight, faceNamedCustodyWrite } from "../src/face-named-custody-write.js";

const FACE = "sibling-group";
const bytes = new Uint8Array([7, 7, 7]);

function gate() {
  const lighting = new Map<string, () => boolean>();
  const siblingFaces = new Map<string, unknown>();
  const siblingSessions = new Map<string, unknown>();
  const write = vi.fn(async (_bytes: Uint8Array, _face: string) => {});
  const custody = faceNamedCustodyWrite({ opens: (face) => custodyOpens(face, { mounted: "mounted-group", lighting, siblingFaces, siblingSessions }), write, warn: () => {} });
  return { lighting, siblingFaces, siblingSessions, write, custody };
}

describe("the custody gate during a light", () => {
  test("W1: a write during the light lands in the face's own row", async () => {
    const g = gate();
    await duringLight(g.lighting, FACE, () => true, () => g.custody("veil", bytes, FACE));
    expect(g.write).toHaveBeenCalledWith(bytes, FACE);
    expect(g.lighting.has(FACE)).toBe(false);
  });

  test("W2: a sibling with no session and no light in flight takes no write", async () => {
    const g = gate();
    g.siblingFaces.set(FACE, {});
    await expect(g.custody("veil", bytes, FACE)).rejects.toThrow(/^face-not-open/);
    expect(g.write).not.toHaveBeenCalled();
    // CONTROL: its session stands, and the write lands.
    g.siblingSessions.set(FACE, {});
    await g.custody("veil", bytes, FACE);
    expect(g.write).toHaveBeenCalledTimes(1);
  });

  test("W3: the window shuts after a light throws, and when its light stops reading live", async () => {
    const g = gate();
    await expect(duringLight(g.lighting, FACE, () => true, async () => { throw new Error("the light refused"); })).rejects.toThrow("the light refused");
    await expect(g.custody("veil", bytes, FACE)).rejects.toThrow(/^face-not-open/);
    let live = true;
    await duringLight(g.lighting, FACE, () => live, async () => {
      live = false;   // the face closed while it lit
      await expect(g.custody("veil", bytes, FACE)).rejects.toThrow(/^face-not-open/);
    });
    expect(g.write).not.toHaveBeenCalled();
  });

  test("W4: an overlapping light's settle never shuts another light's window", async () => {
    const g = gate();
    let releaseFirst!: () => void;
    const first = duringLight(g.lighting, FACE, () => true, () => new Promise<void>((r) => { releaseFirst = r; }));
    await duringLight(g.lighting, FACE, () => true, async () => {});
    // The second light settled; the first opened its window earlier, and the second's took its place and left with it.
    // A third light now opens and the first settles: the third's window stands.
    let releaseThird!: () => void;
    const third = duringLight(g.lighting, FACE, () => true, () => new Promise<void>((r) => { releaseThird = r; }));
    releaseFirst(); await first;
    await g.custody("veil", bytes, FACE);
    expect(g.write).toHaveBeenCalledTimes(1);
    releaseThird(); await third;
    await expect(g.custody("veil", bytes, FACE)).rejects.toThrow(/^face-not-open/);
  });
});
