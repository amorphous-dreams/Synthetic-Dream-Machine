/**
 * spirit-door.test.ts — `lares spirit om | ah | hum | round | residue | otakiage <pet-name>`: the pet name resolves the record,
 * the doors carry every act, the budgets refuse growth by name, and otakiage reads a hand.
 * Wave: lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum
 */
import { afterEach, describe, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown> }>,
  answer: (_verb: string, _args: Record<string, unknown>): Record<string, unknown> => ({}),
}));
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  verbFailure: (err: unknown) => ({ code: "error", message: err instanceof Error ? err.message : String(err) }),
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    const output = h.answer(verb, args);
    // A refusal crosses as the vessel sends one: the verb's own code leads its message.
    if (typeof output["refuse"] === "string") return { status: "error", requestId: "r", errorMessage: output["refuse"] };
    return { status: "done", requestId: "r", results: { summary: { ok: true, output } } };
  },
  runVerbAsFace: async () => { throw new Error("no face session in these tests"); },
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { cmdSpirit, omText, residueOf, slotBody, ashLedgerOf, OM_CAP_CHARS, SLOT_BUDGET_BYTES, MEMORY_PREFIX, RESIDUE_CAP_CHARS } from "../src/commands/spirit.js";
import { COMPACTION_DISPLAY, COMPACTION_WORD } from "../src/spirit-words.js";
import { COMMANDS } from "../src/bin/lares.js";
import type { ParsedArgs } from "../src/parse-args.js";

const URI = `${MEMORY_PREFIX}familiar/lares-alpha`;
const FULL = "sha256:" + "f5".repeat(32);
const NOW = () => new Date("2026-11-24T12:00:00Z");
const HAND = () => ({ admit: "hand" }) as never;
const AI = () => ({ refusal: "hand-act-only" }) as never;

const slots = (over: Record<string, number> = {}) => [
  { slot: "#/entry", bytes: over["#/entry"] ?? 900, first: "entry" },
  { slot: "#/open", bytes: over["#/open"] ?? 400, first: "open" },
  { slot: "#/bodies", bytes: over["#/bodies"] ?? 300, first: "bodies" },
];
const framed = (slot: string, body: string) => `<<~ ahu slot=\`${slot}\`>>\n\n${body}\n\n<<~/ahu>>\n`;

/** A stage holding one familiar record; `bodies` and `open` hold these words, every write answers by its verb. */
function stage(opts: { kind?: "familiar" | "spirit"; slotBytes?: Record<string, number>; bodies?: string; open?: string; patch?: string; put?: string; titles?: string[]; ledgerStands?: boolean } = {}) {
  const kind = opts.kind ?? "familiar";
  const texts: Record<string, string> = { "#/bodies": opts.bodies ?? "!! Bodies\n\n* one", "#/open": opts.open ?? "!! Open\n\n* a loop" };
  h.answer = (verb, args) => {
    if (verb === "tiddler-get" && args["meme"] === true) {
      if (args["title"] !== `${MEMORY_PREFIX}${kind}/lares-alpha`) return { title: args["title"], tiddler: null };
      if (typeof args["slot"] === "string") {
        return { has: "has", meme: { uri: args["title"], slotText: framed(String(args["slot"]), texts[String(args["slot"])] ?? "x"), canonicalHash: `partial:${String(args["slot"])}:${FULL}`, bytes: 1600, slots: slots(opts.slotBytes) } };
      }
      return { has: "<<~ has name=`rec`>>\n<<~ has name=`#/open`>>", meme: { uri: args["title"], canonicalHash: `skinny:${FULL}`, bytes: 1600, slots: slots(opts.slotBytes) } };
    }
    if (verb === "tiddler-get") return { tiddler: { fields: { title: args["title"], text: "first words\nmore" }, textHash: "sha256-ab" } };
    if (verb === "meme-patch") return { decision: opts.patch ?? "ingest", canonicalHash: "sha256:" + "11".repeat(32) };
    if (verb === "tiddler-put") {
      // The tiddler door's own law: an append to a title no record holds refuses unless `create` names it.
      const ledger = String(args["title"]).startsWith(`${MEMORY_PREFIX}state/ashes-`);
      if (ledger && typeof args["append"] === "string" && !opts.ledgerStands && args["create"] !== true) {
        return { refuse: `append-target-missing: no record "${String(args["title"])}" stands to append to; name \`create\` (\`--create\`) to land the words as a new record. Nothing moved.` };
      }
      return { decision: opts.put ?? "put" };
    }
    if (verb === "wiki-filter") return { titles: opts.titles ?? [] };
    if (verb === "tiddler-delete") return { decision: "removed" };
    return {};
  };
}

const argv = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "spirit", positional, options, flags: { json: true } } as unknown as ParsedArgs);

async function run(args: ParsedArgs, seams = {}): Promise<{ exit: number; printed: Record<string, unknown> }> {
  const chunks: string[] = [];
  const out = vi.spyOn(process.stdout, "write").mockImplementation(((c: unknown) => { chunks.push(String(c)); return true; }) as never);
  const log = vi.spyOn(console, "log").mockImplementation((...p: unknown[]) => { chunks.push(p.join(" ") + "\n"); });
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const exit = await cmdSpirit(args, { now: NOW, hand: HAND, ...seams });
    return { exit, printed: JSON.parse(chunks.join("").trim().split("\n").at(-1)!) as Record<string, unknown> };
  } finally { out.mockRestore(); log.mockRestore(); err.mockRestore(); }
}
const data = (r: { printed: Record<string, unknown> }) => r.printed["data"] as Record<string, unknown>;
const error = (r: { printed: Record<string, unknown> }) => r.printed["error"] as { code: string; message: string };

afterEach(() => { h.calls.length = 0; });

describe("the spirit door stands in the command table", () => {
  test("its row names every verb and every option its handler reads", () => {
    const row = COMMANDS.find((c) => c.name === "spirit")!;
    expect(row.verbs).toEqual(["help", "om", "ah", "hum", "otakiage", COMPACTION_WORD, "residue"]);
    expect(row.accepts).toEqual(expect.arrayContaining(["add", "base", "file", "fold", "line", "slot", "text"]));
  });
});

describe("the compaction's word stands in one place", () => {
  test("the door's word and the hooks' twin read one word, and the verb table names it", async () => {
    // The hooks ship as plain .mjs a harness runs unbuilt; the weld loads the module itself.
    const twin = (await import(new URL("../.claude-plugin/hooks/lares-spirit-core.mjs", import.meta.url).href)) as { COMPACTION_WORD: string; COMPACTION_DISPLAY: string };
    expect([twin.COMPACTION_WORD, twin.COMPACTION_DISPLAY]).toEqual([COMPACTION_WORD, COMPACTION_DISPLAY]);
    expect(COMPACTION_WORD).toMatch(/^[a-z]+$/);
    expect(COMMANDS.find((c) => c.name === "spirit")!.verbs).toContain(COMPACTION_WORD);
  });
});

describe("the pet name resolves the record", () => {
  test("familiar/<pet> answers first, on the default recipe at skinny grain", async () => {
    stage();
    const r = await run(argv(["om", "lares-alpha"]));
    expect(r.exit).toBe(0);
    expect(h.calls[0]).toEqual({ verb: "tiddler-get", args: { recipe: "default", title: URI, meme: true, grain: "skinny" } });
    expect(data(r)["uri"]).toBe(URI);
  });

  test("spirit/<pet> answers where no familiar stands", async () => {
    stage({ kind: "spirit" });
    const r = await run(argv(["om", "lares-alpha"]));
    expect(data(r)["uri"]).toBe(`${MEMORY_PREFIX}spirit/lares-alpha`);
  });

  test("a name no record answers refuses spirit-unknown and names the listing", async () => {
    stage();
    const r = await run(argv(["om", "nobody"]));
    expect(r.exit).toBe(3);
    expect(error(r).code).toBe("spirit-unknown");
    expect(error(r).message).toContain("lares wiki filter");
  });

  test("a malformed pet name refuses before any door opens", async () => {
    stage();
    const r = await run(argv(["om", "Bad Name"]));
    expect(error(r).code).toBe("spirit-pet-malformed");
    expect(h.calls).toEqual([]);
  });
});

describe("om wakes under the cap", () => {
  test("the wake text carries the skinny and #/open, and names the doors that true it", async () => {
    stage({ open: "!! Open\n\n* #516 awaits CI" });
    const r = await run(argv(["om", "lares-alpha"]));
    const text = String(data(r)["text"]);
    expect(text).toContain("<<~ has name=`rec`>>");
    expect(text).toContain("#516 awaits CI");
    expect(text).toContain("lares spirit ah lares-alpha");
    expect(text.length).toBeLessThanOrEqual(OM_CAP_CHARS);
    expect(text).toContain(`Latest ${COMPACTION_DISPLAY}: none stands under lares-alpha yet.`);
  });

  test("the wake names the latest landing by title and hash, so the body checks what it inherited", async () => {
    const landing = `${MEMORY_PREFIX}${COMPACTION_WORD}/lares-alpha-0123456789ab`;
    stage({ titles: [landing, `${MEMORY_PREFIX}${COMPACTION_WORD}/lares-alpha-two-ba9876543210`] });
    const r = await run(argv(["om", "lares-alpha"]));
    expect(h.calls.find((c) => c.verb === "wiki-filter")!.args["filter"]).toBe(`[prefix[${MEMORY_PREFIX}${COMPACTION_WORD}/lares-alpha-]!sort[landed]]`);
    expect(data(r)["latest"]).toBe(landing);
    expect(String(data(r)["text"])).toContain(`Latest ${COMPACTION_DISPLAY}: ${landing} (hash 0123456789ab)`);
  });

  test("an #/open past the cap cuts with a pointer to the whole slot", () => {
    const text = omText({ pet: "p", uri: URI, kind: "familiar", has: "has", base: "", bytes: 0, slots: [] }, "x".repeat(20_000));
    expect(text.length).toBeLessThanOrEqual(OM_CAP_CHARS);
    expect(text).toContain("cut at the 9000-char wake cap");
  });
});

describe("ah trues one slot through the meme door", () => {
  test("--text replaces the body under the slot's partial base", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "!! Open\n\n* trued" }));
    expect(r.exit).toBe(0);
    expect(h.calls.at(-1)).toEqual({ verb: "meme-patch", args: { recipe: "default", uri: URI, slot: "#/open", replace: "!! Open\n\n* trued", base: `partial:#/open:${FULL}` } });
  });

  test("--add lands one line at the slot's end", async () => {
    stage({ bodies: "!! Bodies\n\n* one" });
    await run(argv(["ah", "lares-alpha"], { slot: "#/bodies", add: "* two" }));
    expect(h.calls.at(-1)!.args["replace"]).toBe("!! Bodies\n\n* one\n* two");
  });

  test("a stale --base refuses spirit-stale-base and names the read", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "y", base: "sha256:" + "00".repeat(32) }));
    expect(error(r).code).toBe("spirit-stale-base");
    expect(error(r).message).toContain("lares spirit om lares-alpha");
    expect(h.calls.some((c) => c.verb === "meme-patch")).toBe(false);
  });

  test("a matching --base of another grain lands", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "y", base: `skinny:${FULL}` }));
    expect(r.exit).toBe(0);
  });

  test("a write the door answers conflict on refuses spirit-stale-base", async () => {
    stage({ patch: "conflict" });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "y" }));
    expect(error(r).code).toBe("spirit-stale-base");
  });

  test("growth past the slot's budget refuses by name and names hum --fold", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "z".repeat(SLOT_BUDGET_BYTES + 1) }));
    expect(error(r).code).toBe("spirit-slot-over-budget");
    expect(error(r).message).toContain("lares spirit hum lares-alpha --fold '#/open'");
    expect(h.calls.some((c) => c.verb === "meme-patch")).toBe(false);
  });

  test("growth past the record's budget refuses by name", async () => {
    stage({ slotBytes: { "#/entry": 5900 } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "z".repeat(600) }));
    expect(error(r).code).toBe("spirit-record-over-budget");
  });

  test("a shrink lands even where the slot stands over its budget", async () => {
    stage({ open: "w".repeat(2000), slotBytes: { "#/open": 2000 } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "short" }));
    expect(r.exit).toBe(0);
  });

  test("secret-shaped words refuse under the strict reading, bare minted hex included", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: `a ward ticket ${"ab".repeat(32)}` }));
    expect(error(r).code).toBe("spirit-secret-shaped");
    expect(h.calls.some((c) => c.verb === "meme-patch")).toBe(false);
  });

  test("a slot the record lacks refuses spirit-slot-missing and lists the slots", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/nope", text: "y" }));
    expect(error(r).code).toBe("spirit-slot-missing");
    expect(error(r).message).toContain("#/entry #/open #/bodies");
  });

  test("two sources refuse as usage", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "y", add: "z" }));
    expect(r.exit).toBe(2);
  });
});

describe("hum measures and folds", () => {
  test("each slot against its budget, the oversize named", async () => {
    stage({ slotBytes: { "#/entry": 1100 } });
    const r = await run(argv(["hum", "lares-alpha"]));
    expect(data(r)["oversize"]).toEqual(["#/entry"]);
    expect(data(r)["total"]).toBe(1800);
  });

  test("--fold alone numbers the slot's lines", async () => {
    stage({ bodies: "!! Bodies\n\n* one\n* two" });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies" }));
    expect(data(r)["lines"]).toEqual([{ n: 1, text: "!! Bodies" }, { n: 2, text: "" }, { n: 3, text: "* one" }, { n: 4, text: "* two" }]);
  });

  test("the first fold of a month opens its ledger: the append names create, so the door's append-target-missing never answers", async () => {
    stage({ bodies: "!! Bodies\n\n* one\n* two" });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "3" }));
    expect(r.exit).toBe(0);
    const put = h.calls.find((c) => c.verb === "tiddler-put")!;
    expect(put.args).toMatchObject({ title: `${MEMORY_PREFIX}state/ashes-2026-11`, create: true });
    expect(h.calls.filter((c) => c.verb === "tiddler-put")).toHaveLength(1);
  });

  test("a ledger line carries a record's words redacted under the strict reading", async () => {
    stage({ bodies: `!! Bodies\n\n* token ghp_${"A".repeat(36)}\n* two` });
    await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "3" }));
    const append = String(h.calls.find((c) => c.verb === "tiddler-put")!.args["append"]);
    expect(append).not.toContain("ghp_");
  });

  test("--fold --line moves the line to the month's ash ledger first, then out of the record", async () => {
    stage({ bodies: "!! Bodies\n\n* one\n* two" });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "3" }));
    expect(r.exit).toBe(0);
    const verbs = h.calls.map((c) => c.verb);
    expect(verbs.indexOf("tiddler-put")).toBeLessThan(verbs.indexOf("meme-patch"));
    const put = h.calls.find((c) => c.verb === "tiddler-put")!;
    expect(put.args["title"]).toBe(`${MEMORY_PREFIX}state/ashes-2026-11`);
    expect(String(put.args["append"])).toContain("* one");
    expect(h.calls.at(-1)!.args["replace"]).toBe("!! Bodies\n\n* two");
  });

  test("a blank line refuses as usage and names the listing", async () => {
    stage({ bodies: "!! Bodies\n\n* one" });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "2" }));
    expect(r.exit).toBe(2);
    expect(h.calls.some((c) => c.verb === "tiddler-put")).toBe(false);
  });
});

describe("the compaction verb and residue land after the strict secret-shape guard", () => {
  test("a compaction lands at <word>/<pet>-<hash12>, stamped landed, and files one #/bodies line", async () => {
    stage();
    const r = await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "the summary\nclosing\n* a loop" }));
    expect(r.exit).toBe(0);
    const title = String(data(r)["title"]);
    expect(title).toMatch(new RegExp(`^${MEMORY_PREFIX}${COMPACTION_WORD}/lares-alpha-[0-9a-f]{12}$`));
    expect(h.calls.find((c) => c.verb === "tiddler-put")!.args).toMatchObject({ title, create: true, text: "the summary\nclosing\n* a loop", fields: { landed: "2026-11-24T12:00:00.000Z" } });
    expect(String(h.calls.at(-1)!.args["replace"])).toContain(`* ''2026-11-24 (${COMPACTION_DISPLAY} ${title.slice(-12)}):'' ${title}`);
    expect(data(r)["filed"]).toBe(true);
  });

  test("a compaction the bodies budget refuses lands unfiled and says which fold files it", async () => {
    stage({ bodies: "w".repeat(1000), slotBytes: { "#/bodies": 1000 } });
    const r = await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "summary" }));
    expect(r.exit).toBe(0);
    expect(data(r)["filed"]).toBe(false);
    expect(String(data(r)["unfiled"])).toContain("spirit-slot-over-budget");
  });

  test("a secret-shaped summary lands nothing", async () => {
    stage();
    const r = await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "token ghp_" + "A".repeat(36) }));
    expect(error(r).code).toBe("spirit-secret-shaped");
    expect(h.calls.some((c) => c.verb === "tiddler-put")).toBe(false);
  });

  test("the guard reads the uncut text: a secret past the cap still refuses", async () => {
    stage();
    const r = await run(argv(["residue", "om-wright"], { text: `${"x".repeat(RESIDUE_CAP_CHARS + 10)} ghp_${"A".repeat(36)}` }));
    expect(error(r).code).toBe("spirit-secret-shaped");
    expect(h.calls).toEqual([]);
  });

  test("a handback lands at spirit/<pet>-handback-<hash12> with no record behind it", async () => {
    stage();
    const r = await run(argv(["residue", "om-wright"], { text: "Om-Wright: Lares (Tasked Spirit) — PR #600" }));
    expect(String(data(r)["title"])).toMatch(new RegExp(`^${MEMORY_PREFIX}spirit/om-wright-handback-[0-9a-f]{12}$`));
  });

});

describe("otakiage burns the residue and keeps the card", () => {
  const round = `${MEMORY_PREFIX}${COMPACTION_WORD}/lares-alpha-0123456789ab`;
  const hand = `${MEMORY_PREFIX}spirit/lares-alpha-handback-ba9876543210`;
  const other = `${MEMORY_PREFIX}${COMPACTION_WORD}/lares-alpha-two-0123456789ab`;

  test("an AI seat refuses hand-act-only and names the command", async () => {
    stage({ titles: [round] });
    const r = await run(argv(["otakiage", "lares-alpha"]), { hand: AI });
    expect(error(r).code).toBe("hand-act-only");
    expect(error(r).message).toContain("lares spirit otakiage lares-alpha");
    expect(h.calls).toEqual([]);
  });

  test("a hand deletes the pet's residue, then burns a line for each removal to the ash ledger, never the record", async () => {
    stage({ titles: [round, hand, other] });
    const r = await run(argv(["otakiage", "lares-alpha"]));
    expect(data(r)["burned"]).toEqual([round, hand]);
    const deleted = h.calls.filter((c) => c.verb === "tiddler-delete").map((c) => c.args["title"]);
    expect(deleted).toEqual([round, hand]);
    expect(deleted).not.toContain(URI);
    const verbs = h.calls.map((c) => c.verb);
    expect(verbs.lastIndexOf("tiddler-delete")).toBeLessThan(verbs.indexOf("tiddler-put"));
    expect(h.calls.find((c) => c.verb === "tiddler-put")!.args["create"]).toBe(true);
  });

  test("the residue filter reaches no sibling pet's rounds", () => {
    expect(residueOf("lares-alpha", [round, hand, other, URI])).toEqual([round, hand]);
  });
});

describe("the pure parts", () => {
  test("a slot body drops the ahu frame", () => {
    expect(slotBody(framed("#/x", "!! X\n\n* a"))).toBe("!! X\n\n* a");
  });
  test("the ash ledger follows the month", () => {
    expect(ashLedgerOf(new Date("2026-12-02T00:00:00Z"))).toBe(`${MEMORY_PREFIX}state/ashes-2026-12`);
  });
});
