import { describe, expect, it, vi } from "vitest";
import { persistArchiveFloor } from "../src/archive-floor-write.js";
import { InMemoryEventStore, KeyhiveProvider } from "../src/index.js";

const bytes = new Uint8Array([1, 2, 3]);
const FACE = "group-of-the-mounted-face";

describe("the face archive floor", () => {
  it("refuses a faceless or locked write and export; a lit face writes its veil archive into its own named row", async () => {
    const persistVeilArchive = vi.fn(async (_bytes: Uint8Array, _face: string) => {});
    const exportVeilArchive = vi.fn(async () => bytes);
    const writers = { persistVeilArchive };
    expect(await persistArchiveFloor({ archiveOpens: false, writers, face: FACE, exportVeilArchive })).toMatchObject({ barred: true, wrote: [] });
    expect(exportVeilArchive).not.toHaveBeenCalled();
    expect(persistVeilArchive).not.toHaveBeenCalled();
    expect(await persistArchiveFloor({ archiveOpens: true, writers, face: FACE, exportVeilArchive })).toMatchObject({ barred: false, wrote: ["veil"] });
    expect(persistVeilArchive).toHaveBeenCalledWith(bytes, FACE);
  });

  it("EACH ARCHIVE NAMES ITS FACE: a floor that names no face exports nothing, writes nothing and refuses `face-not-named`", async () => {
    for (const face of [undefined, null, "", "  "]) {
      const persistVeilArchive = vi.fn(async (_bytes: Uint8Array, _face: string) => {});
      const exportVeilArchive = vi.fn(async () => bytes);
      const out = await persistArchiveFloor({ archiveOpens: true, writers: { persistVeilArchive }, face, exportVeilArchive });
      expect(out.wrote).toEqual([]);
      expect(out.refusals.map((r) => r.message).join(" ")).toMatch(/^face-not-named/);
      expect(exportVeilArchive, "no prekey secret reaches the heap").not.toHaveBeenCalled();
      expect(persistVeilArchive).not.toHaveBeenCalled();
    }
  });

  it("A FACE THE WRITER ROUTES NOT MINTS NO CARD: a refusing writer that names the face unrouted takes no export, so no prekey burns", async () => {
    const p = new KeyhiveProvider();
    await p.init({ seed: new Uint8Array(32).fill(0x37), eventStore: new InMemoryEventStore() });
    try {
      const card = vi.spyOn(p, "contactCard");
      const refusing = vi.fn(async (_bytes: Uint8Array, face: string) => { throw new Error(`face-archive-unrouted: ${face.slice(0, 4)}`); });
      const unrouted = await persistArchiveFloor({ archiveOpens: true, face: "a-sibling-group",
        writers: { persistVeilArchive: refusing, routesVeilArchive: (face) => face === FACE },
        exportVeilArchive: () => p.exportArchiveAfterTheCard() });
      expect(unrouted).toMatchObject({ wrote: [], barred: false, refusals: [], unrouted: true });
      expect(card, "no card minted for an Archive no row keeps").not.toHaveBeenCalled();
      expect(refusing).not.toHaveBeenCalled();
      // CONTROL: the same refusing writer with no routing word exports first, and the card mints for nothing.
      const burnt = await persistArchiveFloor({ archiveOpens: true, face: "a-sibling-group",
        writers: { persistVeilArchive: refusing }, exportVeilArchive: () => p.exportArchiveAfterTheCard() });
      expect(burnt.refusals.map((r) => r.message).join(" ")).toMatch(/^face-archive-unrouted/);
      expect(card).toHaveBeenCalledTimes(1);
    } finally { await p.dispose(); }
  });
});
