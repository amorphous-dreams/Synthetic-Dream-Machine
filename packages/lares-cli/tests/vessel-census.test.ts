/**
 * `lares vessel census` — what a stop would drop, named item by item.
 *
 *   V1  a save held in memory and a carrier whose reconcile failed each print one line; exit 3. A carrier the queue
 *       still owes a write (`pending`, its record at rest in the store) reads under `owed`, never as an item (V1h).
 *   V1b an unnamed row of sync states alone (`save-unnamed`, `contentFree`) reads under `unasked` (document, saves, bytes,
 *       age), never as an item: clean, exit 0; beside it an owed save still blocks (V1c); an unnamed row holding any content
 *       save, whoever made it, or one that names no `contentFree`, blocks as owed and names its ways on (V1d, fail closed).
 *   V2  a clean vessel answers clean; exit 0, and the JSON names empty lists.
 *   V3  a line that cannot answer (no socket, a silent custody door, an island that refuses) exits 2 by name and
 *       never reads clean.
 *   V4  the shore census reads both islands' pages; an island that mounts no projection holds none.
 *   V7  a file a mirror's checkout never tracked reads by path, an owed commit like an unsealed save: one line, exit 3,
 *       the JSON item names the path; both islands naming one path read it once, and a checkout git cannot read lands
 *       unanswered by its root.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { VERB_RESULT_KEY } from "@lararium/mesh/verb-tiddler";
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
  test("V1 — a held save and a failed carrier each print one line, and the census exits 3", async () => {
    const c = capture();
    const code = await cmdCensus(args(false), lines({
      custody: async () => ({ op: "census", held: [{ documentId: "doc-heron", refusal: "save-unbooked", saves: 2, bagId: "lar:///ha.ka.ba/bags/notes" }], standing: "hearth" }),
      shore: async () => ({ carriers: [{ state: "failed", uri: "lar:///ha.ka.ba/notes/pond", bagId: "notes", island: "wiki" }], unanswered: [] }),
    }));
    expect(code).toBe(3);
    expect(c.out).toEqual([
      "held-save  save-unbooked  doc doc-heron  2 save(s) in memory  bag lar:///ha.ka.ba/bags/notes",
      "carrier  failed  lar:///ha.ka.ba/notes/pond  bag notes  island wiki",
    ]);
    expect(c.err.join("\n")).toMatch(/2 item\(s\) rest nowhere yet/);
  });

  test("V1h — a carrier the queue still owes a write reads owed, never an item: its record rests in the store, so the census reads clean and a stop proceeds", async () => {
    const pending = lines({ shore: async () => ({ carriers: [{ state: "pending", uri: "lar:///ha.ka.ba/notes/pond", bagId: "notes", island: "wiki" }], unanswered: [] }) });
    const reading = await readCensus(pending);
    expect([reading.clean, reading.items]).toEqual([true, []]);
    expect(reading.owed).toEqual([{ uri: "lar:///ha.ka.ba/notes/pond", bagId: "notes", island: "wiki" }]);
    const c = capture();
    expect(await cmdCensus(args(false), pending)).toBe(0);
    expect(c.err.join("\n")).toContain("census: owed  carrier lar:///ha.ka.ba/notes/pond  bag notes  island wiki");
    // CONTROL: a failed reconcile beside it still blocks.
    const failed = lines({ shore: async () => ({ carriers: [{ state: "failed", uri: "lar:///a/f", bagId: "b", island: "daemon" }, { state: "pending", uri: "lar:///a/p", bagId: "b", island: "daemon" }], unanswered: [] }) });
    const both = await readCensus(failed);
    expect(both.items.map((i) => (i.kind === "carrier" ? i.uri : null))).toEqual(["lar:///a/f"]);
    expect(both.owed?.map((o) => o.uri)).toEqual(["lar:///a/p"]);
    expect(await cmdCensus(args(false), failed)).toBe(3);
  });

  test("V1b RED — a save-unnamed row of sync states alone (contentFree) reads unasked (document, saves, bytes, age): never an unreadable shape, never an item a stop drops", async () => {
    const row = { documentId: "doc-heads", refusal: "save-unnamed", saves: 3, bagId: null, bytes: 6, contentFree: true, heldAcross: 9 };
    const unnamed = lines({ custody: async () => ({ op: "census", held: [row], standing: "hearth" }) });
    const reading = await readCensus(unnamed);
    expect(reading.unanswered).toEqual([]);
    expect(reading.items).toEqual([]);
    expect(reading.clean).toBe(true);
    expect(reading.unasked).toEqual([{ documentId: "doc-heads", saves: 3, bytes: 6, heldAcross: 9 }]);
    const c = capture();
    expect(await cmdCensus(args(false), unnamed)).toBe(0);
    expect(c.out).toEqual(["census: clean — no save waits in memory, and no carrier's reconcile failed"]);
    expect(c.err.join("\n")).toContain("census: unasked  doc doc-heads  3 save(s), 6 byte(s), held across 9 later save(s): sync states alone, peers' heads and no change, so a stop drops no content here");
    c.out.length = 0;
    expect(await cmdCensus(args(true), unnamed)).toBe(0);
    expect(JSON.parse(c.out.join("")).data.census).toEqual({ clean: true, items: [], unanswered: [], unasked: [{ documentId: "doc-heads", saves: 3, bytes: 6, heldAcross: 9 }] });
  });

  test("V1c CONTROL — beside an unasked row, a save this vessel owes still blocks: exit 3, the owed save alone an item", async () => {
    const c = capture();
    const code = await cmdCensus(args(false), lines({
      custody: async () => ({ op: "census", standing: "hearth", held: [
        { documentId: "doc-heads", refusal: "save-unnamed", saves: 1, bagId: null, bytes: 2, contentFree: true, heldAcross: 0 },
        { documentId: "doc-heron", refusal: "save-unsealed", saves: 1, bagId: "lar:///ha.ka.ba/bags/notes" },
      ] }),
    }));
    expect(code).toBe(3);
    expect(c.out).toEqual(["held-save  save-unsealed  doc doc-heron  1 save(s) in memory  bag lar:///ha.ka.ba/bags/notes"]);
    expect(c.err.join("\n")).toMatch(/1 item\(s\) rest nowhere yet/);
    expect(c.err.join("\n")).toContain("census: unasked  doc doc-heads");
  });

  test("V1e — a held row names how many of its saves rest sealed-pending and whether its document stands at its ceiling; one that names no kept still blocks the stop", async () => {
    const row = { documentId: "doc-busy", refusal: "save-unsealed", saves: 64, bagId: "lar:///ha.ka.ba/wikis/daemon/working", pending: 64, atBound: true };
    const c = capture();
    const reading = await readCensus(lines({ custody: async () => ({ op: "census", held: [row], standing: "hearth" }) }));
    expect(reading.clean).toBe(false);
    expect(reading.items).toEqual([{ kind: "held-save", refusal: "save-unsealed", documentId: "doc-busy", saves: 64, bagId: row.bagId, pending: 64, atBound: true }]);
    expect(await cmdCensus(args(false), lines({ custody: async () => ({ op: "census", held: [row], standing: "hearth" }) }))).toBe(3);
    const line = c.out.join("\n");
    expect(line).toContain("held-save  save-unsealed  doc doc-busy  64 save(s) in memory  bag lar:///ha.ka.ba/wikis/daemon/working");
    expect(line).toContain("64 of them rest sealed-pending under the vessel's key: a stop keeps those");
    expect(line).toContain("AT ITS CEILING: a further save of this document refuses (held-bound)");
    expect(line).toContain("`lares vault unlock`");
  });

  test("V1d RED — FAIL CLOSED: an unnamed row holding any content save (a peer's push, a local change), or one from a vessel that names no contentFree, blocks the stop and names its ways on", async () => {
    for (const row of [
      { documentId: "doc-peer-content", refusal: "save-unnamed", saves: 2, bagId: null, bytes: 90, contentFree: false, heldAcross: 1 },
      { documentId: "doc-shape-unread", refusal: "save-unnamed", saves: 1, bagId: null },
    ]) {
      const c = capture();
      const reading = await readCensus(lines({ custody: async () => ({ op: "census", held: [row], standing: "hearth" }) }));
      expect(reading.clean, row.documentId).toBe(false);
      expect(reading.unasked, row.documentId).toBeUndefined();
      expect(reading.items, row.documentId).toEqual([{ kind: "held-save", refusal: "save-unnamed", documentId: row.documentId, saves: row.saves, bagId: null }]);
      expect(await cmdCensus(args(false), lines({ custody: async () => ({ op: "census", held: [row], standing: "hearth" }) })), row.documentId).toBe(3);
      expect(c.out.join("\n"), row.documentId).toContain(`held-save  save-unnamed  doc ${row.documentId}  ${row.saves} save(s) in memory  bag (none mapped)  (no map or roster names it, and the vessel's key stood out of reach as it arrived: \`lares vault unlock\` rests it in the vessel's inbox; or read who carries it with \`lares vessel census --docs\` and open the bag that owns it so its saves land)`);
      expect(c.out.join("\n"), row.documentId).not.toMatch(/accept-loss/);
      vi.restoreAllMocks();
    }
  });

  test("V1f RED — THE MEASURED CASE: an unsolicited peer push the store reads kept (its content at rest in the vessel's inbox) counts landed: exit 0, named, never an item", async () => {
    const pushed = { documentId: "2ieLtAdTzp8jRAwUFaEDx8h3brkj", refusal: "save-unnamed", saves: 2, bagId: null, bytes: 900, contentFree: false, heldAcross: 1, pending: 2, kept: true };
    const ownWrite = { documentId: "doc-own-write", refusal: "save-unsealed", saves: 3, bagId: "lar:///ha.ka.ba/wikis/daemon/working", pending: 3, kept: true };
    const census = lines({ custody: async () => ({ op: "census", standing: "hearth", held: [pushed, ownWrite] }) });
    const reading = await readCensus(census);
    expect(reading.clean).toBe(true);
    expect(reading.items).toEqual([]);
    expect(reading.kept).toEqual([
      { documentId: pushed.documentId, refusal: "save-unnamed", saves: 2, bagId: null },
      { documentId: "doc-own-write", refusal: "save-unsealed", saves: 3, bagId: ownWrite.bagId },
    ]);
    const c = capture();
    expect(await cmdCensus(args(false), census)).toBe(0);
    expect(c.out).toEqual(["census: clean — no save waits in memory, and no carrier's reconcile failed"]);
    expect(c.err.join("\n")).toContain(`census: kept  save-unnamed  doc ${pushed.documentId}  2 save(s)  bag (none mapped): at rest under the vessel's key, so a stop keeps them and the next boot carries them back`);
    expect(c.err.join("\n")).toContain("census: kept  save-unsealed  doc doc-own-write  3 save(s)");
  });

  test("V1g CONTROL — FAIL CLOSED: a row that names kept beside no pending save, or a pending row a content save of which waits in memory alone, stays owed", async () => {
    for (const row of [
      { documentId: "doc-kept-without-pending", refusal: "save-unnamed", saves: 1, bagId: null, bytes: 9, contentFree: false, heldAcross: 0, kept: true },
      { documentId: "doc-partly-at-rest", refusal: "save-unbooked", saves: 2, bagId: "lar:///ha.ka.ba/bags/notes", pending: 1 },
    ]) {
      const reading = await readCensus(lines({ custody: async () => ({ op: "census", held: [row], standing: "hearth" }) }));
      expect(reading.clean, row.documentId).toBe(false);
      expect(reading.kept, row.documentId).toBeUndefined();
      expect(reading.items.map((i) => i.kind === "held-save" ? i.documentId : null), row.documentId).toEqual([row.documentId]);
    }
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
    expect(c.out).toEqual(["census: clean — no save waits in memory, and no carrier's reconcile failed"]);
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
    const unsettled: ShoreCensus = { carriers: [{ state: "failed", uri: "lar:///ha.ka.ba/notes/pond", bagId: "notes", island: "wiki" }], unanswered: [] };
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
