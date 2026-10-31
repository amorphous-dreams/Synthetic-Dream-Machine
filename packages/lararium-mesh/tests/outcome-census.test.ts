/** The outcome census reads what it counted and catches a planted pairing; a clean record set reads clean. */
import { expect, test } from "vitest";
import { censusOutcomeLinkage, OUTCOME_URI_PREFIX } from "../src/index.js";

const ATOM = `0x${"a7".repeat(32)}`;
const LEAF = "1eaf".repeat(16);
// Each record in the shape a daemon document keeps it: `{ tiddler, meta }`.
const outcome = (id: string, verb: string, extra: Record<string, unknown>) =>
  [`${OUTCOME_URI_PREFIX}${id}`, { tiddler: { title: `${OUTCOME_URI_PREFIX}${id}`, "request-id": id, verb, status: "done", ...extra }, meta: {} }] as const;
const output = (o: Record<string, unknown>) => ({ results: JSON.stringify({ summary: { ok: true, output: o } }) });

test("KNOWN POSITIVE: an outcome pairing a requester with a leaf (either spelling), and any outcome of a socket-only verb, each read linked", () => {
  const tiddlers = Object.fromEntries([
    outcome("p-1", "load", { "requested-by": ATOM, ...output({ writer: `0x${LEAF}` }) }),
    outcome("p-2", "load", { face: "proof-a", ...output({ writer: LEAF.toUpperCase() }) }),
    outcome("p-3", "cabal-face", output({ n: 1 })),
    outcome("p-4", "load", { "requested-by": ATOM, ...output({ n: 1 }) }),
    ["lar:///ha.ka.ba/bags/daemon/slots/x", { title: "x", text: LEAF, "requested-by": ATOM }],
  ]);
  const r = censusOutcomeLinkage(tiddlers, { socketOnly: new Set(["cabal-face"]), keys: [LEAF] });
  expect(r.outcomes).toBe(4);
  expect(r.linked.map((l) => [l.title.slice(OUTCOME_URI_PREFIX.length), l.why]))
    .toEqual([["p-1", "requester-beside-key"], ["p-2", "requester-beside-key"], ["p-3", "socket-only-verb"]]);
});

test("KNOWN POSITIVE: a bare field map reads as its own fields", () => {
  const title = `${OUTCOME_URI_PREFIX}b-1`;
  expect(censusOutcomeLinkage({ [title]: { title, verb: "cabal-face" } }, { socketOnly: new Set(["cabal-face"]), keys: [] }).linked)
    .toEqual([{ title, verb: "cabal-face", why: "socket-only-verb" }]);
});

test("KNOWN POSITIVE: an outcome whose strings rest wrapped, as Automerge hands them out, reads by its plain values", () => {
  const wrap = (val: string) => ({ val, [Symbol.for("_am_immutableString")]: true });
  const title = `${OUTCOME_URI_PREFIX}w-1`;
  const tiddlers = { [title]: { tiddler: { title, verb: wrap("cabal-face") }, meta: {} },
    [`${title}b`]: { tiddler: { title: `${title}b`, verb: wrap("load"), "requested-by": wrap(ATOM), results: wrap(JSON.stringify({ writer: LEAF })) }, meta: {} } };
  expect(censusOutcomeLinkage(tiddlers, { socketOnly: new Set(["cabal-face"]), keys: [LEAF] }).linked.map((l) => l.why))
    .toEqual(["socket-only-verb", "requester-beside-key"]);
});

test("CONTROL: a key with no requester beside it, and a requester with no key, read clean", () => {
  const tiddlers = Object.fromEntries([outcome("c-1", "realm-feed", output({ leaf: LEAF })), outcome("c-2", "load", { "requested-by": ATOM })]);
  expect(censusOutcomeLinkage(tiddlers, { socketOnly: new Set(["cabal-face"]), keys: [LEAF] })).toEqual({ outcomes: 2, linked: [] });
});
