/**
 * kahua-layer-seam — an island resolves `bags/kahua` from its manifest grant alone; the catalog never answers for it.
 *
 * SECURITY CLASS (authority input: the catalog row). Red: the grant's url mounts and the catalog goes unasked.
 * Controls: a catalog row naming a stage with no grant beside it mounts nothing; every other library bag still
 * resolves through the catalog.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { KAHUA_BAG, CROSSROADS_DOC_URI } from "@lararium/mesh";
import { librarySlotUrl } from "../src/kahua-layer.js";

const catalogNaming = (url: string) => {
  const asked: string[] = [];
  return { asked, lookup: async (slot: string) => { asked.push(slot); return url; } };
};

describe("the kahua layer resolves from the grant alone", () => {
  test("RED: the grant's url mounts and the catalog goes unasked", async () => {
    const c = catalogNaming("automerge:forged");
    expect(await librarySlotUrl(KAHUA_BAG, { kahuaUrl: "automerge:granted" }, c.lookup)).toBe("automerge:granted");
    expect(c.asked).toEqual([]);
  });

  test("CONTROL: a catalog row naming a stage, with no grant, mounts nothing", async () => {
    const c = catalogNaming("automerge:forged");
    expect(await librarySlotUrl(KAHUA_BAG, {}, c.lookup)).toBeNull();
    expect(await librarySlotUrl(KAHUA_BAG, { kahuaUrl: null }, c.lookup)).toBeNull();
    expect(c.asked).toEqual([]);
  });

  test("CONTROL: every other library bag resolves through the catalog", async () => {
    const c = catalogNaming("automerge:crossroads");
    expect(await librarySlotUrl(CROSSROADS_DOC_URI, { kahuaUrl: "automerge:granted" }, c.lookup)).toBe("automerge:crossroads");
    expect(await librarySlotUrl(CROSSROADS_DOC_URI, {}, null)).toBeNull();
    expect(c.asked).toEqual([CROSSROADS_DOC_URI]);
  });
});
