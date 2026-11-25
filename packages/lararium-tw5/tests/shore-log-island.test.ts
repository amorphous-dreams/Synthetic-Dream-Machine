/**
 * shore-log-island — the daemon island writes the vessel's log records into the worn face's daemon temp layer, keeps a
 * hand's ack across every later write, drops a placement that reads malformed, and writes nothing where no temp layer
 * stands writable.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */
import { describe, test, expect } from "vitest";
import { ShoreLogRing, shoreLogPlacements } from "@lararium/mesh/shore-log";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { shoreLogLanding, writeShoreLog } from "../src/shore-log-island.js";
import type { IslandContext } from "../src/island-context.js";

const placementOf = (times: number) => {
  const ring = new ShoreLogRing({ boot: "b", now: () => "t" });
  for (let i = 0; i < times; i++) ring.take("[sealed-rest] save-unsealed: 3xYqAbCdEfGh… waits");
  return shoreLogPlacements(ring.records())[0]!;
};

function fakeCtx(opts: { writable: boolean; prior?: Record<string, Record<string, unknown>> }) {
  const puts: Array<{ fields: Record<string, unknown>; bag: string | undefined }> = [];
  const ctx = {
    recipe: { wikiSlug: "daemon" },
    composite: {
      hasWritableBag: (bag: string) => opts.writable && bag === wikiSlotUri("daemon", "temp"),
      put: async (record: { tiddler: Record<string, unknown> }, _origin: unknown, o?: { bag?: string }) => { puts.push({ fields: record.tiddler, bag: o?.bag }); },
    },
    tw5: { $tw: { wiki: { getTiddler: (title: string) => (opts.prior?.[title] ? { fields: opts.prior[title]! } : undefined) } } },
  } as unknown as IslandContext;
  return { ctx, puts };
}

describe("the island writes the log records", () => {
  test("each record lands in the daemon temp layer, by its own title", async () => {
    const p = placementOf(3);
    const { ctx, puts } = fakeCtx({ writable: true });
    expect(await writeShoreLog(ctx, [p])).toBe(1);
    expect(puts).toEqual([{ fields: { ...p.fields }, bag: wikiSlotUri("daemon", "temp") }]);
  });
  test("a hand's ack stays across a later write; the sink never sets one", () => {
    const p = placementOf(2);
    expect(shoreLogLanding(p, { ack: "1" })["ack"]).toBe("1");
    expect(shoreLogLanding({ ...p, fields: { ...p.fields, ack: "99" } }, undefined)["ack"]).toBeUndefined();
  });
  test("the prior record's ack rides the write", async () => {
    const p = placementOf(4);
    const { ctx, puts } = fakeCtx({ writable: true, prior: { [p.title]: { ack: "2" } } });
    await writeShoreLog(ctx, [p]);
    expect(puts[0]!.fields["ack"]).toBe("2");
    expect(puts[0]!.fields["count"]).toBe("4");
  });
  test("a malformed placement drops; no writable temp layer writes nothing", async () => {
    const { ctx, puts } = fakeCtx({ writable: true });
    expect(await writeShoreLog(ctx, [{ title: "$:/elsewhere", fields: {} }, "nope"])).toBe(0);
    expect(puts).toHaveLength(0);
    const shut = fakeCtx({ writable: false });
    expect(await writeShoreLog(shut.ctx, [placementOf(1)])).toBe(0);
    expect(shut.puts).toHaveLength(0);
  });
});

describe("the shore log page rides the lararium skin", () => {
  test("$:/lares/shore/log reads the records by the prefix the sink writes, with ack, fold and open", async () => {
    const { readFileSync } = await import("node:fs");
    const { SHORE_LOG_PREFIX, SHORE_LOG_ASH_PREFIX } = await import("@lararium/mesh/shore-log");
    const text = readFileSync(new URL("../tiddlers-lararium/shore-log.tid", import.meta.url), "utf8");
    expect(text.split("\n")[0]).toBe("title: $:/lares/shore/log");
    expect(text).toContain(`[prefix[${SHORE_LOG_PREFIX}]]`);
    expect(text).toContain(SHORE_LOG_ASH_PREFIX);
    expect(text).toContain("compare:number:lt{!!last-seq}");   // held: no ack, or recurred past it
    for (const act of ["shore.log.ack", "shore.log.fold", "shore.log.open"]) expect(text).toContain(`<<${act}>>`);
  });
});
