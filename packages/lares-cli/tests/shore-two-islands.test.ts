/**
 * `lares shore` reaches BOTH islands that mount a disk shore.
 *
 * The active wiki's island answers the shore verb through `wiki-act`; the daemon island mounts a projector
 * of its own (the daemon wiki's working layer, crossroads) and answers the verb itself. A standoff or a
 * pending removal the daemon island holds took no answer while the door sent one line. `askShore` sends the
 * act to both and answers as one shore: the list names each row's island, the counts add, the settle word
 * stands where both gave it, and an answer goes to the island that holds its state.
 *
 * Controls: an island that mounts no projection lists nothing and refuses nothing; an act the active wiki's
 * island answers never reaches the daemon island.
 */
import { describe, test, expect } from "vitest";
import { VERB_RESULT_KEY } from "@lararium/mesh";
import { askShore, readShoreList, askSettle, SETTLE_PAGE } from "../src/shore-core.js";
import type { SubmitResult } from "../src/verb-result.js";

type Island = (args: Record<string, unknown>) => Record<string, unknown>;

const page = (rows: { standoffs?: Array<Record<string, unknown>>; pending?: Array<Record<string, unknown>> }): Record<string, unknown> => ({
  ok: true, op: "list", standoffs: rows.standoffs ?? [], standoffCount: (rows.standoffs ?? []).length,
  pending: rows.pending ?? [], pendingCount: (rows.pending ?? []).length, mark: "m", next: null,
});
const NO_SHORE: Record<string, unknown> = { ok: false, refusal: "no-disk-shore", why: "this island mounts no disk projection" };

/** A vessel: the two islands as functions of the shore args; each line the door sends gets logged. */
function vessel(wiki: Island, daemon: Island | "unregistered") {
  const sent: Array<{ island: "wiki" | "daemon"; op: unknown }> = [];
  const run = async (name: string, args: Record<string, unknown>): Promise<SubmitResult> => {
    const island = name === "wiki-act" ? "wiki" : "daemon";
    const shoreArgs = island === "wiki" ? (args["args"] as Record<string, unknown>) : args;
    sent.push({ island, op: shoreArgs["op"] });
    if (island === "wiki") expect(args["verb"]).toBe("shore"); else expect(name).toBe("shore");
    if (island === "daemon" && daemon === "unregistered") return { status: "error", requestId: "req", errorMessage: "no handler for verb shore" } as SubmitResult;
    const output = (island === "wiki" ? wiki : daemon as Island)(shoreArgs);
    return { status: "done", requestId: `req-${island}`, results: { [VERB_RESULT_KEY]: { ok: true, output } } } as SubmitResult;
  };
  return { run, sent };
}

/** Carriers as a settle ask names them. */
const carriersOf = (uris: string[]) => uris.map((uri) => ({ uri, records: "h" }));
/** An island that mirrors the bag and reads each carrier of the page it gets as `kindOf` says, rows and counts. */
function settleIsland(kindOf: (uri: string) => "settled" | "elsewhere" | "superseded", onPage?: (n: number) => void): Island {
  return (a) => {
    const page = (a["carriers"] as Array<{ uri: string }>).map((c) => c.uri);
    onPage?.(page.length);
    const of = (k: string) => page.filter((u) => kindOf(u) === k);
    return { ok: true, op: "settle", mirrored: true, settled: of("settled"), settledCount: of("settled").length, elsewhere: of("elsewhere"), elsewhereCount: of("elsewhere").length, superseded: of("superseded"), supersededCount: of("superseded").length };
  };
}

const wikiRow = { bagId: "lar:///ha.ka.ba/bags/lares", uri: "lar:///a/w", path: "/m/w.mem" };
const daemonRow = { bagId: "lar:///ha.ka.ba/wikis/daemon/working", uri: "lar:///a/d", path: "/m/d.mem" };

describe("the list reads both islands as one shore", () => {
  test("a pending removal the daemon island holds lists beside the active wiki's, each naming its island", async () => {
    const v = vessel(() => page({ pending: [wikiRow] }), () => page({ pending: [daemonRow], standoffs: [{ ...daemonRow, standoff: "k1", kind: "sides" }] }));
    const listed = await readShoreList((a) => askShore(a, "did:test", v.run), {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.pending).toEqual([{ ...wikiRow, island: "wiki" }, { ...daemonRow, island: "daemon" }]);
    expect(listed.standoffs).toMatchObject([{ uri: daemonRow.uri, standoff: "k1", island: "daemon" }]);
    expect(v.sent).toEqual([{ island: "wiki", op: "list" }, { island: "daemon", op: "list" }]);
  });

  test("CONTROL: an island that mounts no projection lists nothing; the other's rows stand", async () => {
    const v = vessel(() => NO_SHORE, () => page({ pending: [daemonRow] }));
    const listed = await readShoreList((a) => askShore(a, "did:test", v.run), {});
    expect(listed.ok ? listed.pending : []).toEqual([{ ...daemonRow, island: "daemon" }]);
  });

  test("a daemon island that does not answer refuses the list by name: a list over an unread island states nothing", async () => {
    const v = vessel(() => page({ pending: [wikiRow] }), "unregistered");
    const listed = await readShoreList((a) => askShore(a, "did:test", v.run), {});
    expect(listed).toMatchObject({ ok: false, refusal: "verb-error" });
    expect(listed.ok ? "" : listed.why).toContain("daemon island");
  });
});

describe("sense and settle reach both islands", () => {
  test("sense: each island looks, and the counts add", async () => {
    const v = vessel(() => ({ ok: true, op: "sense", standoffCount: 1, pendingCount: 2 }), () => ({ ok: true, op: "sense", standoffCount: 0, pendingCount: 3 }));
    expect((await askShore({ op: "sense", uris: ["u"] }, "did:test", v.run)).output).toEqual({ ok: true, op: "sense", standoffCount: 1, pendingCount: 5 });
  });

  test("settle: the island that mirrors the bag gives the word; the other answers it mirrors nothing", async () => {
    const v = vessel(() => ({ ok: true, op: "settle", mirrored: false, settledCount: 0, elsewhereCount: 0, supersededCount: 0 }), settleIsland((u) => (u === "c" ? "superseded" : "settled")));
    expect((await askShore({ op: "settle", bag: "b", carriers: carriersOf(["a", "b", "c"]) }, "did:test", v.run)).output).toMatchObject({ ok: true, shore: true, mirrored: true, settledCount: 2, supersededCount: 1 });
  });

  test("F3.1 settle: two islands that mirror one bag count each carrier ONCE", async () => {
    const both = settleIsland(() => "settled");
    const v = vessel(both, both);
    expect((await askShore({ op: "settle", bag: "b", carriers: carriersOf(["a", "b"]) }, "did:test", v.run)).output).toMatchObject({ settledCount: 2, elsewhereCount: 0 });
    // A carrier one island projects and the other reads under a higher bag stands settled, once.
    const split = vessel(settleIsland(() => "settled"), settleIsland(() => "elsewhere"));
    expect((await askShore({ op: "settle", bag: "b", carriers: carriersOf(["a"]) }, "did:test", split.run)).output).toMatchObject({ settledCount: 1, elsewhereCount: 0 });
  });

  test("settle: carriers past a page ride in pages under the row cap, and every carrier counts", async () => {
    const uris = Array.from({ length: 2 * SETTLE_PAGE + 6 }, (_, i) => `lar:///a/c${i}`);
    const seen: number[] = [];
    const island = settleIsland(() => "settled", (n) => seen.push(n));
    const v = vessel(island, () => NO_SHORE);
    expect((await askShore({ op: "settle", bag: "b", carriers: carriersOf(uris) }, "did:test", v.run)).output).toMatchObject({ settledCount: uris.length });
    expect(seen).toEqual([SETTLE_PAGE, SETTLE_PAGE, 6]);
  });

  test("F3.2 settle: no island mounts a disk shore, and the reading says so instead of a settle over nothing", async () => {
    const v = vessel(() => NO_SHORE, () => NO_SHORE);
    const out = (await askShore({ op: "settle", bag: "b", carriers: carriersOf(["a"]) }, "did:test", v.run)).output;
    expect(out).toMatchObject({ ok: true, shore: false, mirrored: false, settledCount: 0 });
    const read = await askSettle((a) => askShore(a, "did:test", v.run), "b", [{ uri: "a", records: "h" }]);
    expect(read).toMatchObject({ settled: true, shore: false, mirrored: false });
  });

  test("CONTROL: an island whose settle answer carries no whole rows refuses by name, never counts", async () => {
    const v = vessel(() => ({ ok: true, op: "settle", mirrored: true, settledCount: 2, elsewhereCount: 0, supersededCount: 0, settled: ["a"], elsewhere: [], superseded: [] }), () => NO_SHORE);
    expect(await askShore({ op: "settle", bag: "b", carriers: carriersOf(["a", "b"]) }, "did:test", v.run)).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
  });

  test("an island whose rows miss a carrier, name one twice, or name one never asked refuses by name", async () => {
    const short = vessel(() => ({ ok: true, op: "settle", mirrored: true, settled: [], settledCount: 0, elsewhere: [], elsewhereCount: 0, superseded: [], supersededCount: 0 }), () => NO_SHORE);
    expect(await askShore({ op: "settle", bag: "b", carriers: carriersOf(["a"]) }, "did:test", short.run)).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    const twice = vessel(() => ({ ok: true, op: "settle", mirrored: true, settled: ["a"], settledCount: 1, elsewhere: ["a"], elsewhereCount: 1, superseded: [], supersededCount: 0 }), () => NO_SHORE);
    expect(await askShore({ op: "settle", bag: "b", carriers: carriersOf(["a"]) }, "did:test", twice.run)).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    const stranger = vessel(() => ({ ok: true, op: "settle", mirrored: true, settled: ["z"], settledCount: 1, elsewhere: [], elsewhereCount: 0, superseded: [], supersededCount: 0 }), () => NO_SHORE);
    expect(await askShore({ op: "settle", bag: "b", carriers: carriersOf(["a"]) }, "did:test", stranger.run)).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
  });

  test("the weld: a settle page never exceeds the outcome's row cap, and a full page's rows ride whole", async () => {
    const { boundOutcomeOutput, AUDIT_ARRAY_CAP } = await import(new URL("../../lararium-tw5/dist/verb-vm.js", import.meta.url).href) as {
      boundOutcomeOutput: (o: Record<string, unknown>) => Record<string, unknown>; AUDIT_ARRAY_CAP: number;
    };
    expect(SETTLE_PAGE).toBeGreaterThan(0);
    expect(SETTLE_PAGE).toBeLessThanOrEqual(AUDIT_ARRAY_CAP);
    const rows = Array.from({ length: SETTLE_PAGE }, (_, i) => `lar:///a/c${i}`);
    expect(Array.isArray(boundOutcomeOutput({ settled: rows })["settled"])).toBe(true);
    // CONTROL: one row past the cap rides as a summary.
    expect(Array.isArray(boundOutcomeOutput({ settled: [...rows, ...Array.from({ length: AUDIT_ARRAY_CAP + 1 - SETTLE_PAGE }, (_, i) => `x${i}`)] })["settled"])).toBe(false);
  });

  test("settle: an island that stopped before its carriers settled refuses the word by name", async () => {
    const v = vessel(settleIsland(() => "settled"), () => ({ ok: false, refusal: "projector-stopped", why: "stopped" }));
    expect(await askShore({ op: "settle", bag: "b", carriers: carriersOf(["a"]) }, "did:test", v.run)).toMatchObject({ ok: false, refusal: "projector-stopped" });
  });
});

describe("an answer goes to the island whose list holds its state", () => {
  const standoff = (row: Record<string, unknown>, key: string) => ({ ...row, standoff: key, kind: "sides" });
  /** An island that lists `rows` and answers any act with `act`. */
  const island = (rows: Parameters<typeof page>[0], act: Island = () => { throw new Error("this island never takes the act"); }): Island =>
    (a) => (a["op"] === "list" ? page(rows) : act(a));
  const acts = (sent: Array<{ island: string; op: unknown }>) => sent.filter((s) => s.op !== "list");

  test("take-records under a key the daemon island holds reaches it, though the active wiki's island holds another key for the same carrier", async () => {
    const v = vessel(island({ standoffs: [standoff({ ...daemonRow, bagId: wikiRow.bagId }, "k-wiki")] }),
      island({ standoffs: [standoff(daemonRow, "k1")] }, (a) => ({ ok: true, op: "take-records", uri: a["uri"], key: a["key"], bag: daemonRow.bagId, took: "records" })));
    expect(await askShore({ op: "take-records", uri: daemonRow.uri, key: "k1" }, "did:test", v.run)).toMatchObject({ ok: true, output: { took: "records", bag: daemonRow.bagId } });
    expect(acts(v.sent)).toEqual([{ island: "daemon", op: "take-records" }]);
  });

  test("a key that stands at both islands refuses by name, and neither island takes it", async () => {
    const v = vessel(island({ standoffs: [standoff(daemonRow, "k1")] }), island({ standoffs: [standoff(daemonRow, "k1")] }));
    expect(await askShore({ op: "take-records", uri: daemonRow.uri, key: "k1" }, "did:test", v.run)).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    expect(acts(v.sent)).toEqual([]);
  });

  test("a key that stands at neither island, beside other keys for the carrier, refuses as moved and names the keys that stand", async () => {
    const v = vessel(island({ standoffs: [standoff(daemonRow, "k-a")] }), island({ standoffs: [standoff(daemonRow, "k-b")] }));
    const a = await askShore({ op: "take-records", uri: daemonRow.uri, key: "k-old" }, "did:test", v.run);
    expect(a).toMatchObject({ ok: false, refusal: "standoff-key-moved" });
    expect(a.why).toContain("k-a");
    expect(a.why).toContain("k-b");
  });

  test("restore of a carrier the daemon island holds pending reaches it", async () => {
    const v = vessel(island({}), island({ pending: [daemonRow] }, () => ({ ok: true, op: "restore", bag: daemonRow.bagId, done: [daemonRow.uri], doneCount: 1, left: [], leftCount: 0 })));
    expect(await askShore({ op: "restore", uris: [daemonRow.uri] }, "did:test", v.run)).toMatchObject({ ok: true, output: { done: [daemonRow.uri] } });
    expect(acts(v.sent)).toEqual([{ island: "daemon", op: "restore" }]);
  });

  test("a set of carriers split across the islands refuses by name, and neither island acts", async () => {
    const v = vessel(island({ pending: [wikiRow] }), island({ pending: [daemonRow] }));
    expect(await askShore({ op: "remove", uris: [wikiRow.uri, daemonRow.uri], count: 2 }, "did:test", v.run)).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    expect(acts(v.sent)).toEqual([]);
  });

  test("an answer over all, with no bag or with a bag both islands hold pending, refuses by name", async () => {
    const v = vessel(island({ pending: [wikiRow] }), island({ pending: [daemonRow] }));
    expect(await askShore({ op: "remove", all: true, count: 1 }, "did:test", v.run)).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    const same = { ...daemonRow, bagId: wikiRow.bagId };
    const w = vessel(island({ pending: [wikiRow] }), island({ pending: [same] }));
    expect(await askShore({ op: "restore", all: true, count: 1, bag: wikiRow.bagId }, "did:test", w.run)).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    expect([...acts(v.sent), ...acts(w.sent)]).toEqual([]);
  });

  test("neither island holds the state: the active wiki's island answers, and its refusal names it", async () => {
    const v = vessel(island({}, () => ({ ok: false, refusal: "no-standoff-stands", why: "none here" })), island({}));
    const a = await askShore({ op: "take-records", uri: "u", key: "k" }, "did:test", v.run);
    expect(a).toMatchObject({ ok: false, refusal: "no-standoff-stands" });
    expect(a.why).toContain("active wiki's island");
  });

  test("CONTROL: an act the active wiki's island holds goes there alone; the daemon island only lists; an island's own refusal keeps its name", async () => {
    const v = vessel(island({ pending: [wikiRow] }, () => ({ ok: true, op: "restore", bag: wikiRow.bagId, done: [wikiRow.uri], left: [] })), island({}));
    expect(await askShore({ op: "restore", uris: [wikiRow.uri] }, "did:test", v.run)).toMatchObject({ ok: true });
    expect(acts(v.sent)).toEqual([{ island: "wiki", op: "restore" }]);
    const w = vessel(island({ pending: [wikiRow] }, () => ({ ok: false, refusal: "pending-count-moved", why: "3 stand", count: 3 })), island({}));
    expect(await askShore({ op: "restore", all: true, count: 2, bag: wikiRow.bagId }, "did:test", w.run)).toMatchObject({ ok: false, refusal: "pending-count-moved" });
  });
});
