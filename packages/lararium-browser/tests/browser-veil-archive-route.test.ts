/**
 * browser-veil-archive-route — the browser's archive writer and the floor's routing word read ONE predicate, so they cannot
 * drift: for every face, the floor routes it exactly where the writer keeps it, and a face the writer refuses mints no card.
 */
import { describe, expect, test, vi } from "vitest";
import { persistArchiveFloor } from "@lararium/keyhive";
import { browserRoutesVeilArchive, browserVeilArchiveWriters } from "../src/browser-veil-archive-route.js";

const WORN = "group-of-the-worn-face";
const bytes = new Uint8Array([4, 4]);

describe("the browser's one archive route", () => {
  test("the writer keeps exactly the faces the routing word routes, for every face and every worn reading", async () => {
    for (const worn of [WORN, undefined, null, ""]) {
      const write = vi.fn(async () => {});
      const writers = browserVeilArchiveWriters(worn, write);
      for (const face of [WORN, "group-of-a-sibling", ""]) {
        const kept = await writers.persistVeilArchive(bytes, face).then(() => true, () => false);
        expect(kept, `worn ${String(worn)} · face ${face}`).toBe(writers.routesVeilArchive(face));
        expect(browserRoutesVeilArchive(worn)(face)).toBe(writers.routesVeilArchive(face));
      }
    }
  });

  test("a sibling's floor exports nothing (no card mints); the worn face's lands", async () => {
    const write = vi.fn(async () => {});
    const writers = browserVeilArchiveWriters(WORN, write);
    const exportVeilArchive = vi.fn(async () => bytes);
    const sibling = await persistArchiveFloor({ archiveOpens: true, writers, face: "group-of-a-sibling", exportVeilArchive });
    expect(sibling).toMatchObject({ wrote: [], refusals: [], unrouted: true });
    expect(exportVeilArchive).not.toHaveBeenCalled();
    const worn = await persistArchiveFloor({ archiveOpens: true, writers, face: WORN, exportVeilArchive });
    expect(worn.wrote).toEqual(["veil"]);
    expect(write).toHaveBeenCalledWith(bytes, WORN);
  });
});
