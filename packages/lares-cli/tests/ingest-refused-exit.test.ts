/**
 * AN INGEST THAT REFUSED A FILE ENDS NON-ZERO.
 *
 * `refusedCarriers` reads the island's per-carrier rows: each row whose decision reads `refuse` names a
 * file the run did not take. One refused row ends `lares ingest --apply` with the `verb-error` exit (4);
 * every row still prints. Control: a run of ingests, noops and a conflict refuses none.
 */
import { describe, expect, test } from "vitest";
import { refusedCarriers } from "../src/commands/ingest.js";
import { exitFor } from "../src/render.js";

describe("an ingest that refused a file ends non-zero", () => {
  test("each refuse row names its carrier; any other decision names none", () => {
    const rows = [
      { uri: "lar:///a", decision: "ingest", grade: "clean" },
      { uri: "lar:///b", decision: "refuse", code: "never-projected-path", reason: "never projects" },
      { uri: "lar:///c", decision: "noop", reason: "disk-matches-synced" },
      { uri: "lar:///d", decision: "refuse", grade: "error" },
      { uri: "lar:///e", decision: "conflict", grade: "clean" },
    ];
    expect(refusedCarriers(rows)).toEqual(["lar:///b", "lar:///d"]);
    expect(exitFor("verb-error")).toBe(4);
  });

  test("CONTROL: a run with no refused row refuses none", () => {
    expect(refusedCarriers([{ uri: "lar:///a", decision: "ingest" }, { uri: "lar:///c", decision: "noop" }, { uri: "lar:///e", decision: "conflict" }])).toEqual([]);
    expect(refusedCarriers([])).toEqual([]);
  });
});
