import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bootTestWiki } from "./test-wiki.js";
import { runFilterCtsCase } from "./filter-cts-run.js";

const base = path.join(import.meta.dirname, "goldens");
const suite = JSON.parse(readFileSync(path.join(base, "filter-cts.json"), "utf8")) as { world: string; sections: Record<string, Array<Record<string, unknown>>> };
const world = JSON.parse(readFileSync(path.join(base, "worlds", `${suite.world}.json`), "utf8")) as { tiddlers: Record<string, string | string[]>[] };

describe("frozen filter conformance suite", () => {
  it("records engine parse trees and result lists for every section case", async () => {
    const engine = await bootTestWiki({ tiddlers: world.tiddlers });
    for (const tests of Object.values(suite.sections)) for (const test of tests) {
      const { id, world: _world, tags: _tags, since: _since, why: _why, filter, context, "host-bound": _host, ...frozen } = test as Record<string, unknown>;
      expect(runFilterCtsCase(engine, { filter: String(filter), ...(context ? { context: context as Record<string, string> } : {}) }), String(id)).toEqual(frozen);
    }
  });
});
