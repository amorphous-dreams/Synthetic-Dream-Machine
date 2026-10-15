/**
 * bags-file-uri.test.ts — the address siting rule run backward (the ingest scan leg):
 * `bags/<sub-path>.mem` ⇄ `lar:///ha.ka.ba/<sub-path>`; outside bags/ or
 * non-.mem → null (the gesture reports skipped, never guesses).
 */

import { describe, test, expect } from "vitest";
import { bagsFileToUri, mirrorDirFileToUri } from "../src/bag-paths.js";

const ROOT = "/srv/vessel";

describe("bagsFileToUri — address reverse-derivation (full-path-inside-bag)", () => {
  test("residency dir strips; the interior IS the name", () => {
    expect(bagsFileToUri(ROOT, "/srv/vessel/bags/lares/ha.ka.ba/lares/api/pono/meme.mem"))
      .toBe("lar:///ha.ka.ba/lares/api/pono/meme");
  });

  test("a foreign name held in another bag derives losslessly", () => {
    expect(bagsFileToUri(ROOT, "/srv/vessel/bags/draft/ha.ka.ba/lares/api/pono/meme.mem"))
      .toBe("lar:///ha.ka.ba/lares/api/pono/meme");
  });

  test("any registered filetype derives — the ruling: bags/ holds ALL TW5 filetypes", () => {
    // a .tid (or any registered filetype) strips its extension exactly as .mem does
    expect(bagsFileToUri(ROOT, "/srv/vessel/bags/sdm/ha.ka.ba/sdm/tags/x.tid"))
      .toBe("lar:///ha.ka.ba/sdm/tags/x");
    expect(bagsFileToUri(ROOT, "/srv/vessel/bags/sdm/ha.ka.ba/sdm/api/data.json"))
      .toBe("lar:///ha.ka.ba/sdm/api/data");
  });

  test("rootless interior, .meta sidecar, no-extension, outside bags/ → null", () => {
    expect(bagsFileToUri(ROOT, "/srv/vessel/bags/lares/api/pono/meme.mem")).toBeNull();
    // a .meta sidecar rides with its content file, never a carrier root
    expect(bagsFileToUri(ROOT, "/srv/vessel/bags/sdm/ha.ka.ba/sdm/api/data.json.meta")).toBeNull();
    // an extension-less file is not a projected carrier file
    expect(bagsFileToUri(ROOT, "/srv/vessel/bags/sdm/ha.ka.ba/sdm/api/bare")).toBeNull();
    expect(bagsFileToUri(ROOT, "/elsewhere/bags/x/ha.ka.ba/bags/x/v1/y.mem")).toBeNull();
    expect(bagsFileToUri(ROOT, "/srv/vessel/genesis/seed.json")).toBeNull();
  });
});

describe("mirrorDirFileToUri — the mirror directory given itself", () => {
  test("a bags dir outside the vessel root derives the same URI", () => {
    expect(mirrorDirFileToUri("/workspace/bags", "/workspace/bags/x/ha.ka.ba/x/y.mem")).toBe("lar:///ha.ka.ba/x/y");
  });
  test("a file outside the given dir is null; bagsFileToUri still reads <root>/bags", () => {
    expect(mirrorDirFileToUri("/workspace/bags", "/state/bags/x/ha.ka.ba/x/y.mem")).toBeNull();
    expect(bagsFileToUri("/srv/v", "/srv/v/bags/x/ha.ka.ba/x/y.mem")).toBe("lar:///ha.ka.ba/x/y");
  });
});
