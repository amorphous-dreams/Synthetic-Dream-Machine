import { describe, expect, it, vi } from "vitest";
import { persistArchiveFloor } from "../src/archive-floor-write.js";

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
});
