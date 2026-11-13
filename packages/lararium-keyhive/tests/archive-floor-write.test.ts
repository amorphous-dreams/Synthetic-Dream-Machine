import { describe, expect, it, vi } from "vitest";
import { persistArchiveFloor } from "../src/archive-floor-write.js";

const bytes = new Uint8Array([1, 2, 3]);

describe("the face archive floor", () => {
  it("refuses a faceless or locked write and export; a lit face writes its veil archive", async () => {
    const persistVeilArchive = vi.fn(async (_bytes: Uint8Array) => {});
    const exportVeilArchive = vi.fn(async () => bytes);
    const writers = { persistVeilArchive };
    expect(await persistArchiveFloor({ archiveOpens: false, writers, exportVeilArchive })).toMatchObject({ barred: true, wrote: [] });
    expect(exportVeilArchive).not.toHaveBeenCalled();
    expect(persistVeilArchive).not.toHaveBeenCalled();
    expect(await persistArchiveFloor({ archiveOpens: true, writers, exportVeilArchive })).toMatchObject({ barred: false, wrote: ["veil"] });
    expect(persistVeilArchive).toHaveBeenCalledWith(bytes);
  });
});
