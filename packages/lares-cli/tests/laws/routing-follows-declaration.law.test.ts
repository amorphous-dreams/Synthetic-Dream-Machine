/**
 * L8 · Routing follows the declared destination: every act and verb reaches the destination its
 * declaration names (the daemon, the local process, a wiki island), and the command x destination
 * matrix holds whole.
 *
 * Three matrices, each read from a live declaration:
 *   - `act`: every ACTION verb (mesh's ACTION_VERBS) x every destination shape -> daemon verb or wiki-act
 *   - `meme project`: every PROJECT_TARGETS entry x source shape -> local or daemon seat (projectPlan)
 *   - `meme put|get|delete|list`: every sub -> its declared daemon verb, container riding along
 *
 * `act` mocks only the wire (`runVerb`) and records which verb the command submits: the destination
 * the routing decision chose, with the routing code itself running real.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const calls = vi.hoisted(() => [] as Array<{ verb: string; args: Record<string, unknown> }>);
vi.mock("../../src/verb-call.js", async (orig) => ({
  ...(await orig<typeof import("../../src/verb-call.js")>()),
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    calls.push({ verb, args });
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: {} } } };
  },
}));
vi.mock("../../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { ACTION_VERBS } from "@lararium/mesh";
import { cmdAct } from "../../src/commands/act.js";
import { listPlan, memePlan, projectPlan, PROJECT_TARGETS } from "../../src/commands/meme.js";
import type { ParsedArgs } from "../../src/parse-args.js";

const ROOT = "lar:///ha.ka.ba";
const CANON = `${ROOT}/bags/witness`;
const OTHER_CANON = `${ROOT}/bags/other`;
const SLOT_NAMES = ["temp", "draft", "personal", "working"] as const;
const witnessSlot = (n: string) => `${ROOT}/wikis/witness/${n}`;
const daemonSlot = (n: string) => `${ROOT}/wikis/daemon/${n}`;

type Dest = "daemon" | "wiki";
const WIKI = "wiki-act";

/** Verbs the matrix drives: the act door answers INGEST and REPACK by their own doors. */
const DRIVEN = ACTION_VERBS.filter((v) => v !== "INGEST");

/**
 * The declared matrix: where a verb lands when its DESTINATION bag names a slot of a witness wiki.
 * Transfer and load verbs carry a destination; the bag verbs name their bag and stay on the daemon.
 */
const SLOT_DESTINATION: Record<string, Dest> = {
  ADD: "wiki", COPY: "wiki", MOVE: "wiki", LOAD: "wiki", CLEAR: "daemon", DROP: "daemon", CREATE: "daemon",
};

/** The argv a verb takes with `bag` as its destination (its `--to`, or its `--bag`). */
function actOn(verb: string, bag: string, extra: { from?: string; flags?: Record<string, boolean> } = {}): ParsedArgs {
  const options: Record<string, string> = {};
  if (verb === "ADD" || verb === "COPY" || verb === "MOVE") {
    options["title"] = "lar:///witness/book/title"; options["from"] = extra.from ?? CANON; options["to"] = bag;
  } else if (verb === "LOAD") {
    options["source-uri"] = "https://example.invalid/book"; options["to"] = bag;
  } else options["bag"] = bag;
  return { command: "act", positional: [verb], options, flags: { json: true, yes: true, ...extra.flags } } as unknown as ParsedArgs;
}

async function route(argv: ParsedArgs): Promise<{ verb: string; wiki: unknown; inner: unknown }> {
  calls.length = 0;
  await cmdAct(argv);
  expect(calls, "one submission per act").toHaveLength(1);
  const c = calls[0]!;
  return { verb: c.verb, wiki: c.args["wiki"], inner: c.args["verb"] };
}

beforeEach(() => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { calls.length = 0; vi.restoreAllMocks(); });

describe("L8 · act: the destination bag decides the reach, for every ACTION verb", () => {
  test("the matrix covers every driven ACTION verb the live table names", () => {
    expect(Object.keys(SLOT_DESTINATION).sort()).toEqual([...DRIVEN].sort());
  });

  for (const verb of DRIVEN) {
    for (const slot of SLOT_NAMES) {
      test(`${verb} -> a witness ${slot} slot reaches ${SLOT_DESTINATION[verb]}`, async () => {
        const r = await route(actOn(verb, witnessSlot(slot)));
        if (SLOT_DESTINATION[verb] === "wiki") {
          expect(r).toEqual({ verb: WIKI, wiki: "witness", inner: verb });
        } else {
          expect(r.verb).toBe(verb);
          expect(r.wiki).toBeUndefined();
        }
      });
      test(`${verb} -> a daemon ${slot} slot keeps the daemon's reach`, async () => {
        const r = await route(actOn(verb, daemonSlot(slot)));
        expect(r.verb).toBe(verb);
      });
    }
    test(`${verb} -> a canon bag reaches the daemon`, async () => {
      expect((await route(actOn(verb, CANON))).verb).toBe(verb);
    });
    test(`${verb} --in-wiki wraps for the active wiki and names no wiki`, async () => {
      const r = await route(actOn(verb, CANON, { flags: { "in-wiki": true } }));
      expect(r).toEqual({ verb: WIKI, wiki: undefined, inner: verb });
    });
  }

  test("MOVE from a witness slot reaches that wiki whatever the destination; from a daemon slot reaches the daemon", async () => {
    for (const to of [CANON, OTHER_CANON]) {
      for (const slot of SLOT_NAMES) {
        expect(await route(actOn("MOVE", to, { from: witnessSlot(slot) }))).toEqual({ verb: WIKI, wiki: "witness", inner: "MOVE" });
        expect((await route(actOn("MOVE", to, { from: daemonSlot(slot) }))).verb).toBe("MOVE");
      }
    }
  });

  test("seed: a source slot beside a COPY or ADD never moves the reach (only MOVE reads its source)", async () => {
    for (const verb of ["COPY", "ADD"]) {
      expect((await route(actOn(verb, CANON, { from: witnessSlot("working") }))).verb).toBe(verb);
    }
  });

  test("CONTROL: the recorder tells the two destinations apart", async () => {
    const wiki = await route(actOn("LOAD", witnessSlot("working")));
    const daemon = await route(actOn("LOAD", CANON));
    expect(wiki.verb).not.toBe(daemon.verb);
  });
});

describe("L8 · meme project: the target and source shape decide the seat", () => {
  const args = (positional: string[], options: Record<string, string>): ParsedArgs =>
    ({ command: "meme", positional, options, flags: { json: true } }) as unknown as ParsedArgs;

  /** Declared: a file over `md` renders in-process; every other pairing rides the daemon. */
  const SEAT = (source: "file" | "uri", to: string): "local" | "daemon" => (source === "file" && to === "md" ? "local" : "daemon");

  for (const to of PROJECT_TARGETS) {
    for (const source of ["file", "uri"] as const) {
      test(`${source} --to ${to} seats ${SEAT(source, to)}`, () => {
        const positional = ["project", source === "file" ? "x.mem" : "lar:///t/x"];
        const plan = projectPlan(args(positional, to === "md" && source === "file" ? { to } : { to, recipe: "default" }));
        expect(plan.seat).toBe(SEAT(source, to));
        expect(plan.to).toBe(to);
      });
    }
  }

  test("CONTROL: the matrix holds both seats", () => {
    const seats = new Set(PROJECT_TARGETS.flatMap((to) => (["file", "uri"] as const).map((s) => SEAT(s, to))));
    expect([...seats].sort()).toEqual(["daemon", "local"]);
  });
});

describe("L8 · meme put|get|delete|list: each sub reaches its declared daemon verb with the container", () => {
  const args = (positional: string[], options: Record<string, string>, flags: Record<string, boolean> = {}): ParsedArgs =>
    ({ command: "meme", positional, options, flags: { json: true, ...flags } }) as unknown as ParsedArgs;
  const VERB_OF = { put: "meme-put", get: "meme-get", delete: "meme-delete" } as const;

  for (const sub of ["put", "get", "delete"] as const) {
    for (const container of [{ recipe: "sdm" }, { bag: "lares" }]) {
      test(`${sub} ${Object.keys(container)[0]} -> ${VERB_OF[sub]}`, () => {
        const plan = memePlan(sub, args([sub, "lar:///t/x"], container));
        expect(plan.verb).toBe(VERB_OF[sub]);
        expect(plan.args).toEqual({ uri: "lar:///t/x", ...container });
      });
    }
    test(`${sub} names no container: refuses before any route`, () => {
      expect(() => memePlan(sub, args([sub, "lar:///t/x"], {}))).toThrow(/no-container/);
    });
  }
  test("list addresses the seat, never one meme", () => {
    expect(listPlan(args(["list"], { bag: "lares" })).verb).toBe("meme-list");
    expect(listPlan(args(["list"], { recipe: "sdm" }, { tree: true })).args).toEqual({ recipe: "sdm", tree: true });
  });
  test("seed: the delete base rides as `base` from --if-match; put reads --base", () => {
    expect(memePlan("delete", args(["delete", "lar:///t/x"], { bag: "b", "if-match": " h " })).args["base"]).toBe("h");
    expect(memePlan("put", args(["put", "lar:///t/x"], { bag: "b", base: "h" })).args["base"]).toBe("h");
  });
  test("CONTROL: two subs reach two different verbs", () => {
    const a = memePlan("get", args(["get", "lar:///t/x"], { bag: "b" })).verb;
    const b = memePlan("put", args(["put", "lar:///t/x"], { bag: "b" })).verb;
    expect(a).not.toBe(b);
  });
});
