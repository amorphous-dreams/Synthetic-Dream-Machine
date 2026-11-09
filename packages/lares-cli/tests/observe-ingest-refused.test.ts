/**
 * observe-ingest-refused — the observe plane (`<projections>/observe/`) reads one way: no ingest takes a file from it.
 * The house's `projections/bags` and `projections/wikis` read back as the canon and wikis planes read.
 */
import { describe, expect, test } from "vitest";
import { join } from "node:path";
import { fileToUriForSource, refuseObserveSource, ObserveIngestRefused } from "../src/ingest-core.js";

const P = "/house/projections";
const dirs = { bags: "/checkout/bags", wikis: "/checkout/wikis", projections: P };

describe("the observe plane refuses ingest by name", () => {
  test("a source under projections/observe refuses with ObserveIngestRefused", () => {
    expect(() => refuseObserveSource(join(P, "observe", "daemon"), dirs)).toThrow(ObserveIngestRefused);
    expect(() => refuseObserveSource(join(P, "observe", "daemon", "outcomes", "o-1.json"), dirs)).toThrow(/observe-ingest-refused/);
  });
  test("an observe file derives no address, whatever source names it", () => {
    const toUri = fileToUriForSource("/house", P, dirs);
    expect(toUri("/house", join(P, "observe", "daemon", "ha.ka.ba", "t", "x.json"))).toBeNull();
  });
  test("CONTROL: projections/wikis and projections/bags read back as their planes; the checkout still reads", () => {
    expect(() => refuseObserveSource(join(P, "wikis", "notes"), dirs)).not.toThrow();
    expect(fileToUriForSource("/house", join(P, "wikis", "notes"), dirs)("/house", join(P, "wikis", "notes", "ha.ka.ba", "t", "x.mem"))).toBe("lar:///ha.ka.ba/t/x");
    expect(fileToUriForSource("/house", join(P, "bags", "mine"), dirs)("/house", join(P, "bags", "mine", "ha.ka.ba", "t", "y.mem"))).toBe("lar:///ha.ka.ba/t/y");
    expect(fileToUriForSource("/house", "/checkout/bags/lares", dirs)("/house", "/checkout/bags/lares/ha.ka.ba/t/z.mem")).toBe("lar:///ha.ka.ba/t/z");
  });
});
