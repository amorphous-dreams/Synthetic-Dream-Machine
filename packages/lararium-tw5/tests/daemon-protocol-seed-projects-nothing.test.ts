/**
 * daemon-protocol-seed-projects-nothing — the daemon's born-from-source tiddlers never reach the workspace.
 *
 * `seedDaemonProtocol` writes the daemon's UI surfaces and its flow set from source at every boot. Those
 * writes route into the daemon wiki's working layer, and that layer projects under `<root>/wikis/daemon/`.
 * A file there would hold nothing the source lacks, and the next boot's seed would write over any hand's
 * edit to it, so each seeded record carries the per-record opt-out (`disk-projection: "no"`) the
 * projector honours, as a receipt, a summons and a ward audit do. A record in the volatile `$:/temp/`
 * plane never persists, so it needs no opt-out.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection#/bag-roles
 */
import { describe, expect, test } from "vitest";
import { HULLS_FULL, HULLS_TS_ONLY, type RunnableHulls } from "@lararium/mesh";
import { seedDaemonProtocol } from "../src/daemon-protocol-seed.js";
import type { TW5Engine } from "../src/tw5-vm.js";

/** Every record the seed writes, captured at the one door it writes through. */
function seededRecords(hulls: RunnableHulls): Record<string, string>[] {
  const writes: Record<string, string>[] = [];
  const engine = { setTiddler: (fields: Record<string, string>) => { writes.push({ ...fields }); } };
  seedDaemonProtocol(engine as unknown as TW5Engine, hulls);
  return writes;
}

const persisted = (r: Record<string, string>): boolean => !String(r["title"]).startsWith("$:/temp/");

describe("the daemon protocol seed projects nothing", () => {
  test("control: the seed writes the daemon UI surfaces and every flow a full vessel enacts", () => {
    const titles = seededRecords(HULLS_FULL).map((r) => r["title"]);
    expect(titles.filter((t) => String(t).startsWith("$:/lares/ui/")).length).toBe(9);
    expect(titles.filter((t) => String(t).includes("/daemon/flows/")).length).toBe(3);
  });

  test.each([["a full node vessel", HULLS_FULL], ["a ts-only vessel", HULLS_TS_ONLY]] as const)(
    "%s: every persisted record carries the disk opt-out", (_label, hulls) => {
      const records = seededRecords(hulls).filter(persisted);
      expect(records.length).toBeGreaterThan(0);
      const projecting = records.filter((r) => r["disk-projection"] !== "no").map((r) => r["title"]);
      expect(projecting).toEqual([]);
    },
  );

  test("the opt-out moves no other field a reader keys on", () => {
    const flows = seededRecords(HULLS_FULL).filter((r) => r["flow-seed"] === "true");
    expect(flows.map((r) => r["petname"]).sort()).toEqual(["couple", "crystal", "rhythm"]);
    for (const f of flows) expect(f["capStack"]).toMatch(/^\S+:\S+( \S+:\S+)*$/);
  });
});
