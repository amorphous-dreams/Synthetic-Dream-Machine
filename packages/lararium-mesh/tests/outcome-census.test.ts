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
  const r = censusOutcomeLinkage(tiddlers as never, { socketOnly: new Set(["cabal-face"]), keys: [LEAF] });
  expect(r.outcomes).toBe(4);
  expect(r.linked.map((l) => [l.title.slice(OUTCOME_URI_PREFIX.length), l.why]))
    .toEqual([["p-1", "requester-beside-key"], ["p-2", "requester-beside-key"], ["p-3", "socket-only-verb"]]);
});

test("KNOWN POSITIVE: an identity nested in the body beside a key reads linked, with no top-level requester; a tombstone still counts", () => {
  const tiddlers = Object.fromEntries([
    outcome("n-1", "load", output({ bond: { atom: ATOM, leaf: LEAF } })),
    outcome("n-2", "load", { "error-message": `writer ${LEAF} is not ${ATOM}` }),
  ]);
  (tiddlers[`${OUTCOME_URI_PREFIX}n-2`] as { meta: Record<string, unknown> }).meta = { deleted: true };
  const r = censusOutcomeLinkage(tiddlers as never, { socketOnly: new Set(), keys: [LEAF], identities: [ATOM] });
  expect(r.linked.map((l) => [l.title.slice(OUTCOME_URI_PREFIX.length), l.why])).toEqual([["n-1", "identity-beside-key"], ["n-2", "identity-beside-key"]]);
  // CONTROL: with no identity named, the same body carries no requester the census can read.
  expect(censusOutcomeLinkage(tiddlers as never, { socketOnly: new Set(), keys: [LEAF] }).linked).toEqual([]);
});

test("KNOWN POSITIVE: an outcome whose strings rest wrapped, as Automerge hands them out, reads by its plain values", () => {
  const wrap = (val: string) => ({ val, [Symbol.for("_am_immutableString")]: true });
  const title = `${OUTCOME_URI_PREFIX}w-1`;
  const tiddlers = { [title]: { tiddler: { title, verb: wrap("cabal-face") }, meta: {} },
    [`${title}b`]: { tiddler: { title: `${title}b`, verb: wrap("load"), "requested-by": wrap(ATOM), results: wrap(JSON.stringify({ writer: LEAF })) }, meta: {} } };
  expect(censusOutcomeLinkage(tiddlers as never, { socketOnly: new Set(["cabal-face"]), keys: [LEAF] }).linked.map((l) => l.why))
    .toEqual(["socket-only-verb", "requester-beside-key"]);
});

test("CONTROL: a key with no requester beside it, and a requester with no key, read clean", () => {
  const tiddlers = Object.fromEntries([outcome("c-1", "realm-feed", output({ leaf: LEAF })), outcome("c-2", "load", { "requested-by": ATOM })]);
  expect(censusOutcomeLinkage(tiddlers as never, { socketOnly: new Set(["cabal-face"]), keys: [LEAF] })).toEqual({ outcomes: 2, linked: [] });
});
