/**
 * `lares vessel census` — what a stop would drop, named item by item.
 *
 *   V1  a save held in memory and a carrier the projector has not settled each print one line; exit 3.
 *   V1b a peer's unasked push (`save-unnamed`) reads under `unasked` by document, never as an item: clean, exit 0; beside it
 *       an owed save still blocks (V1c).
 *   V2  a clean vessel answers clean; exit 0, and the JSON names empty lists.
 *   V3  a line that cannot answer (no socket, a silent custody door, an island that refuses) exits 2 by name and
 *       never reads clean.
 *   V4  the shore census reads both islands' pages; an island that mounts no projection holds none.
 *   V7  a file a mirror's checkout never tracked reads by path, an owed commit like an unsealed save: one line, exit 3,
 *       the JSON item names the path; both islands naming one path read it once, and a checkout git cannot read lands
 *       unanswered by its root.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { VERB_RESULT_KEY } from "@lararium/mesh";
import { cmdCensus, readCensus, type CensusLines } from "../src/commands/census.js";
import { askShoreCensus, type ShoreCensus } from "../src/shore-core.js";
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

  test("V1b RED — a save-unnamed row reads as an unasked push naming its document: never an unreadable shape, never an item a stop drops", async () => {
    const unnamed = lines({ custody: async () => ({ op: "census", held: [{ documentId: "doc-peer", refusal: "save-unnamed", saves: 3, bagId: null }], standing: "hearth" }) });
    const reading = await readCensus(unnamed);
    expect(reading.unanswered).toEqual([]);
    // The peer that pushed it unasked keeps its own copy: a stop here drops nothing this house owns, so neither down nor the keep refuses.
    expect(reading.items).toEqual([]);
    expect(reading.clean).toBe(true);
    expect(reading.unasked).toEqual([{ documentId: "doc-peer", saves: 3 }]);
    const c = capture();
    expect(await cmdCensus(args(false), unnamed)).toBe(0);
    expect(c.out).toEqual(["census: clean — no save waits in memory, and the disk projector owes no carrier"]);
    expect(c.err.join("\n")).toContain("census: unasked  doc doc-peer  3 save(s) a peer pushed wait for a name; the peer keeps its copy, so a stop drops nothing here");
    c.out.length = 0;
    expect(await cmdCensus(args(true), unnamed)).toBe(0);
    expect(JSON.parse(c.out.join("")).data.census).toEqual({ clean: true, items: [], unanswered: [], unasked: [{ documentId: "doc-peer", saves: 3 }] });
  });

  test("V1c CONTROL — beside an unasked push, a save this vessel owes still blocks: exit 3, the owed save alone an item", async () => {
    const c = capture();
    const code = await cmdCensus(args(false), lines({
      custody: async () => ({ op: "census", standing: "hearth", held: [
        { documentId: "doc-peer", refusal: "save-unnamed", saves: 1, bagId: null },
        { documentId: "doc-heron", refusal: "save-unsealed", saves: 1, bagId: "lar:///ha.ka.ba/bags/notes" },
      ] }),
    }));
    expect(code).toBe(3);
    expect(c.out).toEqual(["held-save  save-unsealed  doc doc-heron  1 save(s) in memory  bag lar:///ha.ka.ba/bags/notes"]);
    expect(c.err.join("\n")).toMatch(/1 item\(s\) rest nowhere yet/);
    expect(c.err.join("\n")).toContain("census: unasked  doc doc-peer");
  });

  test("V7 — a file the checkout never tracked prints by path, an owed commit, and the census exits 3", async () => {
    const c = capture();
    const PATH = "/lar/workspaces/sdm/wikis/lares/ha.ka.ba/lares/docs/history/first-contact.mem";
    const owed = lines({ shore: async () => ({ carriers: [], untracked: [{ path: PATH, bagId: "lares", island: "wiki" }], unanswered: [] }) });
    expect(await cmdCensus(args(false), owed)).toBe(3);
    expect(c.out).toEqual([`untracked  ${PATH}  bag lares  island wiki  (an owed commit: commit it, or remove it by hand)`]);
    expect(c.err.join("\n")).toMatch(/1 item\(s\) rest nowhere yet/);
    c.out.length = 0;
    expect(await cmdCensus(args(true), owed)).toBe(3);
    expect(JSON.parse(c.out.join("")).data.census.items).toEqual([{ kind: "untracked", path: PATH, bagId: "lares", island: "wiki" }]);
  });

  test("V2 — a clean vessel answers clean and exits 0; the JSON names empty lists", async () => {
    const c = capture();
    expect(await cmdCensus(args(false), lines({}))).toBe(0);
    expect(c.out).toEqual(["census: clean — no save waits in memory, and the disk projector owes no carrier"]);
    c.out.length = 0;
    expect(await cmdCensus(args(true), lines({}))).toBe(0);
    expect(JSON.parse(c.out.join(""))).toEqual({ ok: true, data: { census: { clean: true, items: [], unanswered: [] } } });
  });

  test("G4 — a face standing locked under a held key reads unanswered by name: \"h2 stands locked; unlock it\", and the census exits 2", async () => {
    const c = capture();
    const reading = await readCensus(lines({ custody: async () => ({ op: "census", held: [], standing: "hearth", locked: false, facesLocked: [2] }) }));
    expect(reading.clean).toBe(false);
    expect(reading.unanswered).toEqual([{ part: "the face h2", why: "h2 stands locked; unlock it (`lares vault unlock --face 2`), then down" }]);
    expect(await cmdCensus(args(false), lines({ custody: async () => ({ op: "census", held: [], standing: "hearth", locked: false, facesLocked: [2] }) }))).toBe(2);
    expect(c.err.join("\n")).toMatch(/h2 stands locked; unlock it/);
  });

  test("G5 — the lit set reads by name: h0 and h1 open, h2 shut; the open faces never read as unanswered", async () => {
    capture();
    const reading = await readCensus(lines({ custody: async () => ({ op: "census", held: [], standing: "hearth", locked: false, facesLit: [0, 1], facesLocked: [2] }) }));
    expect(reading.facesLit).toEqual([0, 1]);
    expect(reading.unanswered).toEqual([{ part: "the face h2", why: "h2 stands locked; unlock it (`lares vault unlock --face 2`), then down" }]);
  });

  test("V6 census-names-none-worn: faces lit and none worn, the census says so and names the wear; CONTROL: a worn face names none", async () => {
    const c = capture();
    const unsettled: ShoreCensus = { carriers: [{ state: "pending", uri: "lar:///ha.ka.ba/notes/pond", bagId: "notes", island: "wiki" }], unanswered: [] };
    const noneWorn = lines({ custody: async () => ({ op: "census", held: [], standing: "hearth", locked: false, facesLit: [0, 1, 2] }), shore: async () => unsettled });
    expect((await readCensus(noneWorn)).worn).toBeNull();
    expect(await cmdCensus(args(false), noneWorn)).toBe(3);
    expect(c.err.join("\n")).toMatch(/^census: no face worn \(h0, h1, h2 stand open\): wear one \(`lares wear N`\), then down$/m);
    c.err.length = 0;
    const worn = lines({ custody: async () => ({ op: "census", held: [], standing: "hearth", locked: false, facesLit: [0, 1, 2], worn: 1 }), shore: async () => unsettled });
    expect((await readCensus(worn)).worn).toBe(1);
    expect(await cmdCensus(args(false), worn)).toBe(3);
    expect(c.err.join("\n")).not.toMatch(/no face worn/);
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

  test("V5 — a locked hearth's census says unlock first, then down, in one line; never a bare 'could not answer'", async () => {
    const c = capture();
    const lockedLines = lines({
      custody: async () => ({ op: "census", held: null, standing: "hearth", locked: true }),
      shore: async () => ({ carriers: [], unanswered: [{ part: "the daemon island's disk projector", why: "vessel-locked: the vessel's key stays shut" }] }),
    });
    const reading = await readCensus(lockedLines);
    expect(reading.clean).toBe(false);
    expect(reading.unanswered).toEqual([{ part: "the vessel", why: "vessel locked: run `lares vault unlock`, then down" }]);
    expect(await cmdCensus(args(false), lockedLines)).toBe(2);
    expect(c.err.join("\n")).toMatch(/^census: vessel locked: run `lares vault unlock`, then down$/m);
    // CONTROL: an open key with a refusing island keeps naming that island.
    const open = await readCensus(lines({ custody: async () => ({ op: "census", held: [], standing: "hearth", locked: false }),
      shore: async () => ({ carriers: [], unanswered: [{ part: "the daemon island's disk projector", why: "shore-op-unknown" }] }) }));
    expect(open.unanswered.map((u) => u.part)).toEqual(["the daemon island's disk projector"]);
    // CONTROL: a herm never unlocks, so its census never names the unlock.
    const herm = await readCensus(lines({ custody: async () => ({ op: "census", held: [], standing: "herm", locked: true }) }));
    expect(herm.unanswered).toEqual([]);
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
          ? answer({ ok: true, op: "census", carriers: [{ state: "failed", uri: "lar:///a/one", bagId: "b" }], carrierCount: 2, drained: true, next: "c1",
            untracked: [{ path: "/lar/workspaces/sdm/wikis/lares/ha.ka.ba/lares/docs/history/first-contact.mem", bagId: "lares" }] })
          : answer({ ok: true, op: "census", carriers: [{ state: "pending", uri: "lar:///a/two", bagId: null }], carrierCount: 2, drained: true, next: null });
      }
      return answer({ ok: true, op: "census", carriers: [], carrierCount: 0, drained: true, next: null,
        untracked: [{ path: "/lar/workspaces/sdm/wikis/lares/ha.ka.ba/lares/docs/history/first-contact.mem", bagId: "lares" }],
        untrackedUnread: [{ root: "/lar/workspaces/sdm/bags/lares", why: "git cannot run in this runtime" }] });
    };
    const census = await askShoreCensus("did:test", run);
    expect(census).toEqual({
      carriers: [
        { state: "failed", uri: "lar:///a/one", bagId: "b", island: "wiki" },
        { state: "pending", uri: "lar:///a/two", bagId: null, island: "wiki" },
      ],
      untracked: [{ path: "/lar/workspaces/sdm/wikis/lares/ha.ka.ba/lares/docs/history/first-contact.mem", bagId: "lares", island: "wiki" }],
      unanswered: [{ part: "the checkout under /lar/workspaces/sdm/bags/lares", why: "git cannot run in this runtime" }],
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
  test("R9 — a face served by custody and dark here prints its cause and clearing line, and leaves a clean census clean", async () => {
    const c = capture();
    const NOTE = "h1 served by custody, dark here: its light refused (daemon-down); clear it with `lares vault unlock` (it replays the lend), or the next custody event";
    const code = await cmdCensus(args(false), lines({
      custody: async () => ({ op: "census", held: [], standing: "hearth", facesLit: [0, 1], worn: 0, facesDark: [{ face: 1, cause: "daemon-down", note: NOTE }] }),
    }));
    expect(code).toBe(0);
    expect(c.err).toContain(`census: ${NOTE}`);
    expect((await readCensus(lines({ custody: async () => ({ op: "census", held: [], standing: "hearth", facesLit: [0, 1], worn: 0, facesDark: [{ face: 1, cause: "daemon-down", note: NOTE }] }) }))).facesDark)
      .toEqual([{ face: 1, cause: "daemon-down", note: NOTE }]);
  });
});
