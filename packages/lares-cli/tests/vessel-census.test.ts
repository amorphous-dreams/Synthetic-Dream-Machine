/**
 * `lares vessel census` — what a stop would drop, named item by item.
 *
 *   V1  a save held in memory and a carrier the projector has not settled each print one line; exit 3.
 *   V2  a clean vessel answers clean; exit 0, and the JSON names empty lists.
 *   V3  a line that cannot answer (no socket, a silent custody door, an island that refuses) exits 2 by name and
 *       never reads clean.
 *   V4  the shore census reads both islands' pages; an island that mounts no projection holds none.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { VERB_RESULT_KEY } from "@lararium/mesh";
import { cmdCensus, readCensus, type CensusLines } from "../src/commands/census.js";
import { askShoreCensus } from "../src/shore-core.js";
import type { ParsedArgs } from "../src/parse-args.js";
import type { SubmitResult } from "../src/verb-result.js";

const args = (json: boolean): ParsedArgs => ({ command: "vessel", positional: [], flags: { json } }) as unknown as ParsedArgs;
const lines = (over: Partial<CensusLines>): CensusLines => ({
  socketPresent: () => true,
  custody: async () => ({ op: "census", held: [], standing: "hearth" }),
  shore: async () => ({ carriers: [], unanswered: [] }),
  ...over,
});
afterEach(() => { vi.restoreAllMocks(); });

function capture(): { out: string[]; err: string[] } {
  const out: string[] = [], err: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { err.push(a.join(" ")); });
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => { out.push(String(chunk)); return true; });
  return { out, err };
}

describe("the vessel census", () => {
  test("V1 — a held save and an unsettled carrier each print one line, and the census exits 3", async () => {
    const c = capture();
    const code = await cmdCensus(args(false), lines({
      custody: async () => ({ op: "census", held: [{ documentId: "doc-heron", refusal: "save-unbooked", saves: 2, bagId: "lar:///ha.ka.ba/bags/notes" }], standing: "hearth" }),
      shore: async () => ({ carriers: [{ state: "pending", uri: "lar:///ha.ka.ba/notes/pond", bagId: "notes", island: "wiki" }], unanswered: [] }),
    }));
    expect(code).toBe(3);
    expect(c.out).toEqual([
      "held-save  save-unbooked  doc doc-heron  2 save(s) in memory  bag lar:///ha.ka.ba/bags/notes",
      "carrier  pending  lar:///ha.ka.ba/notes/pond  bag notes  island wiki",
    ]);
    expect(c.err.join("\n")).toMatch(/2 item\(s\) rest nowhere yet/);
  });

  test("V2 — a clean vessel answers clean and exits 0; the JSON names empty lists", async () => {
    const c = capture();
    expect(await cmdCensus(args(false), lines({}))).toBe(0);
    expect(c.out).toEqual(["census: clean — no save waits in memory, and the disk projector owes no carrier"]);
    c.out.length = 0;
    expect(await cmdCensus(args(true), lines({}))).toBe(0);
    expect(JSON.parse(c.out.join(""))).toEqual({ ok: true, data: { census: { clean: true, items: [], unanswered: [] } } });
  });

  test("V3 — a line that cannot answer exits 2 by name and never reads clean", async () => {
    capture();
    const noSocket = await readCensus(lines({ socketPresent: () => false }));
    expect(noSocket.clean).toBe(false);
    expect(noSocket.unanswered[0]!.why).toMatch(/no vessel answers/);
    const silent = await readCensus(lines({ custody: async () => null }));
    expect(silent.clean).toBe(false);
    expect(silent.unanswered[0]).toMatchObject({ part: "the sealed rest" });
    const recomposing = await readCensus(lines({ custody: async () => ({ op: "census", held: null, standing: "recomposing" }) }));
    expect(recomposing.unanswered[0]!.why).toMatch(/no composition sits/);
    const older = await readCensus(lines({ custody: async () => ({ op: "census", status: "error", errorMessage: "unknown frame" }) }));
    expect(older.clean).toBe(false);
    const island = await readCensus(lines({ shore: async () => { throw new Error("daemon unreachable"); } }));
    expect(island.unanswered).toEqual([{ part: "the disk projector", why: "daemon unreachable" }]);
    expect(await cmdCensus(args(false), lines({ custody: async () => null }))).toBe(2);
  });
});

describe("the shore census", () => {
  const answer = (output: Record<string, unknown>, requestId = "r"): SubmitResult =>
    ({ status: "done", requestId, results: { [VERB_RESULT_KEY]: { ok: true, output } } }) as SubmitResult;

  test("V4 — both islands' pages read to the end; an island with no projection holds none", async () => {
    const seen: Array<{ name: string; after: unknown }> = [];
    const run = async (name: string, a: Record<string, unknown>): Promise<SubmitResult> => {
      const shoreArgs = name === "wiki-act" ? (a["args"] as Record<string, unknown>) : a;
      seen.push({ name, after: shoreArgs["after"] });
      if (name === "wiki-act") {
        return shoreArgs["after"] === undefined
          ? answer({ ok: true, op: "census", carriers: [{ state: "failed", uri: "lar:///a/one", bagId: "b" }], carrierCount: 2, drained: true, next: "c1" })
          : answer({ ok: true, op: "census", carriers: [{ state: "pending", uri: "lar:///a/two", bagId: null }], carrierCount: 2, drained: true, next: null });
      }
      return answer({ ok: false, refusal: "no-disk-shore", why: "this island mounts no disk projection" });
    };
    const census = await askShoreCensus("did:test", run);
    expect(census).toEqual({
      carriers: [
        { state: "failed", uri: "lar:///a/one", bagId: "b", island: "wiki" },
        { state: "pending", uri: "lar:///a/two", bagId: null, island: "wiki" },
      ],
      unanswered: [],
    });
    expect(seen).toEqual([{ name: "wiki-act", after: undefined }, { name: "wiki-act", after: "c1" }, { name: "shore", after: undefined }]);
  });

  test("V4 CONTROL — an island that refuses, or answers no carrier array, lands unanswered", async () => {
    const run = async (name: string): Promise<SubmitResult> => name === "wiki-act"
      ? answer({ ok: true, op: "list" })
      : answer({ ok: false, refusal: "shore-op-unknown", why: "no census here" });
    const census = await askShoreCensus("did:test", run);
    expect(census.carriers).toEqual([]);
    expect(census.unanswered.map((u) => u.part)).toEqual(["the active wiki's island's disk projector", "the daemon island's disk projector"]);
  });
});
