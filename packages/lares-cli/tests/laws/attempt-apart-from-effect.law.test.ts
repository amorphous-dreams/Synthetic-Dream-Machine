/**
 * L7 · a retry keeps attempt identity apart from effect identity: each attempt of `lares act` mints a
 * fresh request id while the effect key stays stable for the same effect, so a retried act never
 * doubles its effect and two different effects never share a key. The per-verb table names the
 * fields that count toward an effect; the live verb tables (ACTION_VERBS, isTransferVerb, isBagVerb)
 * check that every action verb owns a row. `runVerb` stands mocked at the options boundary, so no
 * daemon, socket, or clock takes part; the `--change-id` nonce rides in as a field like any other.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { afterEach, beforeEach, describe, expect, test as plain, vi } from "vitest";
import { fc, test } from "@fast-check/vitest";
import { ACTION_VERBS, isBagVerb, isTransferVerb } from "@lararium/mesh";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown>; opts: Record<string, unknown> }>,
}));
vi.mock("../../src/verb-call.js", async (orig) => ({
  ...(await orig<typeof import("../../src/verb-call.js")>()),
  runVerb: async (verb: string, args: Record<string, unknown>, _by: string, opts: Record<string, unknown> = {}) => {
    h.calls.push({ verb, args, opts });
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: { landed: 1 } } } };
  },
}));
vi.mock("../../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../../src/env.js")>()),
  vesselDid: async () => "did:key:ztest-attempt-apart",
}));

import { cmdAct } from "../../src/commands/act.js";
import { parseArgs } from "../../src/parse-args.js";

beforeEach(() => { vi.spyOn(process.stdout, "write").mockImplementation(() => true); });
afterEach(() => { h.calls.length = 0; vi.restoreAllMocks(); });

/** The fields that count toward an effect, per verb (tabulated from act.ts and the census); `change-id` counts for every verb. */
const EFFECT_FIELDS: Record<string, readonly string[]> = {
  ADD: ["title", "from", "to", "change-id"],
  COPY: ["title", "from", "to", "change-id"],
  MOVE: ["title", "from", "to", "change-id"],
  CLEAR: ["bag", "change-id"],
  DROP: ["bag", "change-id"],
  CREATE: ["bag", "plane", "change-id"],
  LOAD: ["source-uri", "to", "change-id"],
};
/** Verbs the act door sends elsewhere: INGEST refuses, REPACK carries no effect key. */
const NOT_THIS_DOOR = new Set(["INGEST", "REPACK"]);

type Fields = Record<string, string>;
const word = fc.stringMatching(/^[a-z0-9]{1,10}$/);
const bag = word.map((w) => `lar:///test/${w}`);
const gen: Record<string, fc.Arbitrary<string>> = {
  title: word, from: bag, to: bag, bag, "change-id": word.map((w) => `cid-${w}`),
  plane: fc.constantFrom("catalog", "oracle"), "source-uri": word.map((w) => `/nonexistent-law-source-${w}`),
};
const fieldsFor = (verb: string): fc.Arbitrary<Fields> =>
  fc.record(Object.fromEntries(EFFECT_FIELDS[verb]!.map((f) => [f, gen[f]!]))) as fc.Arbitrary<Fields>;
const verbs = Object.keys(EFFECT_FIELDS);
const verbAndFields = fc.constantFrom(...verbs).chain((verb) => fieldsFor(verb).map((f) => [verb, f] as const));

const argvOf = (verb: string, f: Fields): ReturnType<typeof parseArgs> =>
  parseArgs(["act", verb, ...Object.entries(f).flatMap(([k, v]) => [`--${k}`, v]), "--yes", "--json"]);

async function attempt(verb: string, f: Fields): Promise<{ requestId: string; effectKey: string }> {
  const before = h.calls.length;
  expect(await cmdAct(argvOf(verb, f))).toBe(0);
  const c = h.calls[before]!;
  return { requestId: String(c.opts["requestId"]), effectKey: String(c.opts["effectKey"]) };
}

/**
 * The wire args each verb submits, built from its fields. A transfer and a LOAD carry their `change-id`
 * on the wire (it names which Work moves where); a bag verb and CREATE carry none, so their nonce rides
 * the CLI alone, folded into the effect key.
 */
function wireOf(verb: string, f: Fields): Record<string, unknown> {
  const cid = f["change-id"] === undefined ? {} : { "change-id": f["change-id"] };
  if (isTransferVerb(verb)) return { title: f["title"], "from-bag": f["from"], "to-bag": f["to"], ...cid };
  if (verb === "LOAD") return { "source-uri": f["source-uri"], "to-bag": f["to"], ...cid };
  if (verb === "CREATE") return { bag: f["bag"], plane: f["plane"] };
  return { bag: f["bag"] };
}

/** The law's reading of two attempts at one effect: ids apart, keys together, neither collapsed onto the other. */
const retryHolds = (a: { requestId: string; effectKey: string }, b: { requestId: string; effectKey: string }): boolean =>
  a.requestId !== b.requestId && a.effectKey === b.effectKey && a.requestId !== a.effectKey && a.effectKey.length > 0;

describe("L7 · live tables name the verbs this law tabulates", () => {
  plain("every action verb the act door serves owns a row, and a row names a live verb", () => {
    const served = ACTION_VERBS.filter((v) => !NOT_THIS_DOOR.has(v));
    expect([...served].sort()).toEqual([...verbs].sort());
    for (const v of verbs) expect(isTransferVerb(v) || isBagVerb(v) || v === "CREATE" || v === "LOAD").toBe(true);
  });
});

describe("L7 · seeds", () => {
  plain("CLEAR: the same --change-id keeps one key across attempts; a fresh one mints another", async () => {
    const f = { bag: "lar:///test/catalog", "change-id": "cid-fixed" };
    const a = await attempt("CLEAR", f);
    const b = await attempt("CLEAR", f);
    expect(retryHolds(a, b)).toBe(true);
    expect((await attempt("CLEAR", { ...f, "change-id": "cid-other" })).effectKey).not.toBe(a.effectKey);
  });
  plain("LOAD: identical args across attempts split the ids and keep the key", async () => {
    const f = { "source-uri": "/nonexistent-law-source-x", to: "lar:///test/catalog", "change-id": "fixed-probe" };
    expect(retryHolds(await attempt("LOAD", f), await attempt("LOAD", f))).toBe(true);
  });
  plain("CREATE: the plane counts toward the effect", async () => {
    const f = { bag: "lar:///test/catalog", plane: "catalog", "change-id": "cid-fixed" };
    const a = await attempt("CREATE", f);
    expect((await attempt("CREATE", { ...f, plane: "oracle" })).effectKey).not.toBe(a.effectKey);
  });
});

describe("L7 · generated", () => {
  test.prop([verbAndFields], { numRuns: 40 })("a retry mints a fresh request id and keeps the effect key", async ([verb, f]) => {
    h.calls.length = 0;
    expect(retryHolds(await attempt(verb, f), await attempt(verb, f))).toBe(true);
  });

  test.prop([verbAndFields, fc.nat(), word], { numRuns: 60 })("changing any counted field changes the effect key", async ([verb, f], pick, salt) => {
    h.calls.length = 0;
    const names = Object.keys(f);
    const name = names[pick % names.length]!;
    const changed = name === "plane" ? (f[name] === "catalog" ? "oracle" : "catalog") : `${f[name]}-${salt}`;
    fc.pre(changed !== f[name]);
    const a = await attempt(verb, f);
    const b = await attempt(verb, { ...f, [name]: changed });
    expect(b.effectKey).not.toBe(a.effectKey);
    expect(b.requestId).not.toBe(a.requestId);
  });

  test.prop([verbAndFields], { numRuns: 30 })("two acts with no --change-id mint two effects", async ([verb, f]) => {
    h.calls.length = 0;
    const { "change-id": _drop, ...bare } = f;
    const a = await attempt(verb, bare);
    const b = await attempt(verb, bare);
    expect(b.effectKey).not.toBe(a.effectKey);
    expect(b.requestId).not.toBe(a.requestId);
  });
});

describe("L7 · the wire carries the verb's fields and no more", () => {
  test.prop([verbAndFields], { numRuns: 40, examples: [
    [["CLEAR", { bag: "lar:///test/catalog", "change-id": "cid-clear-split" }]],   // the nonce stays CLI-side
  ] })("each verb submits exactly its wire fields", async ([verb, f]) => {
    h.calls.length = 0;
    await attempt(verb, f);
    expect(h.calls[0]!.verb).toBe(verb);
    expect(h.calls[0]!.args).toEqual(wireOf(verb, f));
  });
});

describe("L7 · CONTROL", () => {
  plain("a keyer that reuses the request id as the effect key reads red; a keyer that re-mints the key per attempt reads red", () => {
    expect(retryHolds({ requestId: "k", effectKey: "k" }, { requestId: "k", effectKey: "k" })).toBe(false);
    expect(retryHolds({ requestId: "r1", effectKey: "k1" }, { requestId: "r2", effectKey: "k2" })).toBe(false);
    expect(retryHolds({ requestId: "r1", effectKey: "k" }, { requestId: "r1", effectKey: "k" })).toBe(false);
    expect(retryHolds({ requestId: "r1", effectKey: "k" }, { requestId: "r2", effectKey: "k" })).toBe(true);
  });
  plain("a CLEAR whose args leak its change-id reads off the wire table", () => {
    const f = { bag: "lar:///test/catalog", "change-id": "cid-x" };
    expect({ ...wireOf("CLEAR", f), "change-id": "cid-x" }).not.toEqual(wireOf("CLEAR", f));
    expect(wireOf("MOVE", { title: "t", from: "a", to: "b", "change-id": "c" })).toEqual({ title: "t", "from-bag": "a", "to-bag": "b", "change-id": "c" });
  });
});
