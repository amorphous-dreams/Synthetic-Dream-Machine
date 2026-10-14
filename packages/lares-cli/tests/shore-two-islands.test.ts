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
import { askShore, readShoreList } from "../src/shore-core.js";
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
    const v = vessel(() => ({ ok: true, op: "settle", mirrored: false, settledCount: 0, elsewhereCount: 0 }), () => ({ ok: true, op: "settle", mirrored: true, settledCount: 2, elsewhereCount: 0 }));
    expect((await askShore({ op: "settle", bag: "b", carriers: [] }, "did:test", v.run)).output).toMatchObject({ ok: true, mirrored: true, settledCount: 2 });
  });

  test("settle: an island that stopped before its carriers settled refuses the word by name", async () => {
    const v = vessel(() => ({ ok: true, op: "settle", mirrored: true, settledCount: 1, elsewhereCount: 0 }), () => ({ ok: false, refusal: "projector-stopped", why: "stopped" }));
    expect(await askShore({ op: "settle", bag: "b", carriers: [] }, "did:test", v.run)).toMatchObject({ ok: false, refusal: "projector-stopped" });
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
