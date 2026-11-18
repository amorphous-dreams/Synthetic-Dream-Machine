import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bootTestWiki } from "./test-wiki.js";
import { comparableAnswer, runFilterCtsCase } from "./filter-cts-run.js";

const base = path.join(import.meta.dirname, "goldens");
const suite = JSON.parse(readFileSync(path.join(base, "filter-cts.json"), "utf8")) as { world: string; sections: Record<string, Array<Record<string, unknown>>> };
const world = JSON.parse(readFileSync(path.join(base, "worlds", `${suite.world}.json`), "utf8")) as { tiddlers: Record<string, string | string[]>[] };

const worldTitles = new Set(world.tiddlers.map((t) => String(t["title"])));
const comparable = (answer: Parameters<typeof comparableAnswer>[0], hostBound: boolean, titles: ReadonlySet<string> = worldTitles) => comparableAnswer(answer, hostBound, titles);

/** One case's recorded answer and the engine's, in the form the suite compares them. */
function reading(engine: Awaited<ReturnType<typeof bootTestWiki>>, test: Record<string, unknown>) {
  const { id, world: _world, tags: _tags, since: _since, why: _why, filter, context, "host-bound": hostBound, ...frozen } = test as Record<string, unknown>;
  const got = runFilterCtsCase(engine, { filter: String(filter), ...(context ? { context: context as Record<string, string> } : {}) });
  return { id: String(id), got: comparable(got, hostBound === true), want: comparable(frozen as never, hostBound === true) };
}

describe("frozen filter conformance suite", () => {
  it("records engine parse trees and result lists for every section case", async () => {
    const engine = await bootTestWiki({ tiddlers: world.tiddlers });
    for (const tests of Object.values(suite.sections)) for (const test of tests) {
      const { id, got, want } = reading(engine, test);
      expect(got, id).toEqual(want);
    }
  });

  it("a host-bound case pins what the frozen world owns and never the engine's own store", async () => {
    // An engine whose store holds a title the frozen world never named stands in for a rebuilt house plugin.
    const engine = await bootTestWiki({ tiddlers: [...world.tiddlers, { title: "Aaa-extra", text: "x" }] });
    const row = Object.values(suite.sections).flat().find((t) => t["id"] === "added-049-sense-48")!;
    expect(row["host-bound"]).toBe(true);
    const raw = runFilterCtsCase(engine, { filter: String(row["filter"]) });
    expect(raw, "CONTROL: the extra title does reach the engine's raw answer").not.toEqual({ parse: row["parse"], results: row["results"] });
    const { got, want } = reading(engine, row);
    expect(got).toEqual(want);
  });

  it("CONTROL: a host-bound case still reds when a title the world owns drifts", () => {
    const frozen = { parse: [], results: ["Alpha", "Beta"] };
    expect(comparable({ parse: [], results: ["Alpha", "Gamma"] }, true, new Set(["Alpha", "Beta", "Gamma"]))).not.toEqual(comparable(frozen, true, new Set(["Alpha", "Beta", "Gamma"])));
    expect(comparable({ parse: [], results: ["Alpha", "Beta", "$:/engine-own"] }, true, new Set(["Alpha", "Beta"]))).toEqual(comparable(frozen, true, new Set(["Alpha", "Beta"])));
    expect(comparable({ parse: [], results: ["Alpha", "Beta", "$:/engine-own"] }, false, new Set(["Alpha", "Beta"]))).not.toEqual(comparable(frozen, false, new Set(["Alpha", "Beta"])));
  });
});
