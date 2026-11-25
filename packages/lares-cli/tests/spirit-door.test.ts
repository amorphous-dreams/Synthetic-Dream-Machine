/**
 * spirit-door.test.ts — `lares spirit om | ah | hum | round | residue | otakiage <pet-name>`: the pet name resolves the record,
 * the doors carry every act, the budgets refuse growth by name, and otakiage reads a hand.
 * Wave: lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum
 */
import { createHash } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown> }>,
  answer: (_verb: string, _args: Record<string, unknown>): Record<string, unknown> | Promise<Record<string, unknown>> => ({}),
}));
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  verbFailure: (err: unknown) => ({ code: "error", message: err instanceof Error ? err.message : String(err) }),
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    let output: Record<string, unknown>;
    // A verb that throws (the real reactor's refusal) crosses as the vessel sends it: its code leads the message.
    try { output = await h.answer(verb, args); } catch (e) { return { status: "error", requestId: "r", errorMessage: e instanceof Error ? e.message : String(e) }; }
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

import { cmdSpirit, omText, residueOf, slotBody, ashLedgerOf, OM_CAP_CHARS, WAKING_SLOT_BUDGETS, RECORD_BUDGET_BYTES, MEMORY_PREFIX, RESIDUE_CAP_CHARS } from "../src/commands/spirit.js";
import { COMPACTION_DISPLAY, COMPACTION_WORD } from "../src/spirit-words.js";
import { COMMANDS } from "../src/bin/lares.js";
import { CompositeStore, bagUri } from "@lararium/mesh";
import { MemoryTiddlerStore, makeTiddlerPutReactor } from "@lararium/tw5";
import { bootTestWiki, skipNote, wikiSkip } from "../../lararium-tw5/tests/test-wiki.js";
import type { ParsedArgs } from "../src/parse-args.js";

const URI = `${MEMORY_PREFIX}familiar/lares-alpha`;
const SIDE = `${MEMORY_PREFIX}presence/lares-alpha`;
/** A slot's digest as the door hands it back: the first 16 hex of the sha256 of its body. */
const digest = (body: string): string => createHash("sha256").update(body).digest("hex").slice(0, 16);
const OPEN_CAP = WAKING_SLOT_BUDGETS["#/open"]!;
const OPEN = "!! Open\n\n* a loop";
const LEDGER_TITLE = `${MEMORY_PREFIX}state/ashes-2026-11`;
const FULL = "sha256:" + "f5".repeat(32);
const NOW = () => new Date("2026-11-24T12:00:00Z");
const HAND = () => ({ admit: "hand" }) as never;
const AI = () => ({ refusal: "hand-act-only" }) as never;

const ID = "abcdef012345";
const slots = (over: Record<string, number> = {}, extra: readonly string[] = []) => [
  { slot: "#/entry", bytes: over["#/entry"] ?? 900, first: "entry" },
  { slot: "#/open", bytes: over["#/open"] ?? 400, first: "open" },
  { slot: "#/bodies", bytes: over["#/bodies"] ?? 300, first: "bodies" },
  ...extra.map((slot) => ({ slot, bytes: over[slot] ?? 100, first: slot })),
];
const framed = (slot: string, body: string) => `<<~ ahu slot=\`${slot}\`>>\n\n${body}\n\n<<~/ahu>>\n`;

interface StageOpts {
  kind?: "familiar" | "spirit" | "both" | "none"; slotBytes?: Record<string, number>; bodies?: string; open?: string; patch?: string; put?: string;
  titles?: string[]; ledgerStands?: boolean; fields?: Record<string, string>; residue?: Record<string, Record<string, string>>;
  backlinks?: Record<string, string[]>; slotTexts?: Record<string, string>; rows?: Array<{ title: string; fields: Record<string, string> }>;
  /** Other familiars whose records stand, by pet name, each with its fields and its #/entry. */
  others?: Record<string, { fields?: Record<string, string>; entry?: string }>;
  /** Records a `[search[...]]` finds naming a title. */
  mentions?: Record<string, string[]>;
  /** The record's field puts answer `conflict` this many times before they land. */
  conflicts?: number;
  /** The sibling presence record's fields (presence, wake epoch, crossing, distill mark, last writers); absent, none stands. */
  side?: Record<string, string>;
  /** The ash ledger's appends answer `refused` this many times before they land. */
  ledgerRefuse?: number;
  /** Slot patches answer `conflict` this many times, a sibling body's words landing first (`sibling`, by slot) at each. */
  patchConflicts?: number;
  sibling?: Record<string, string>;
}

/** A stage holding one familiar record (or two, or none); its slots hold these words, its fields these, every write answers by its verb. */
function stage(opts: StageOpts = {}) {
  const kind = opts.kind ?? "familiar";
  const own = (title: unknown): boolean => kind === "both" ? [URI, `${MEMORY_PREFIX}spirit/lares-alpha`].includes(String(title))
    : kind === "none" ? false : title === `${MEMORY_PREFIX}${kind}/lares-alpha`;
  const other = (title: unknown): string | null => {
    const t = String(title);
    const pet = t.startsWith(`${MEMORY_PREFIX}familiar/`) ? t.slice(`${MEMORY_PREFIX}familiar/`.length) : null;
    return pet !== null && opts.others?.[pet] ? pet : null;
  };
  const standing = (title: unknown): boolean => own(title) || other(title) !== null;
  let conflicts = opts.conflicts ?? 0;
  let patchConflicts = opts.patchConflicts ?? 0;
  let ledgerRefuse = opts.ledgerRefuse ?? 0;
  // The card's live canonical hash: its fields render into the carrier's meta, so a field put on the card moves it, as a slot patch does.
  let rev = 0;
  const live = (): string => (rev === 0 ? FULL : "sha256:" + rev.toString(16).padStart(2, "0").repeat(32));
  const isSide = (title: unknown): boolean => String(title).startsWith(`${MEMORY_PREFIX}presence/`);
  const texts: Record<string, string> = { "#/bodies": opts.bodies ?? "!! Bodies\n\n* one", "#/open": opts.open ?? "!! Open\n\n* a loop", ...(opts.slotTexts ?? {}) };
  const extra = Object.keys(opts.slotTexts ?? {}).filter((slot) => !["#/entry", "#/open", "#/bodies"].includes(slot));
  h.answer = (verb, args) => {
    if (verb === "tiddler-get" && args["meme"] === true) {
      if (!standing(args["title"])) return { title: args["title"], tiddler: null };
      if (typeof args["slot"] === "string") {
        const o = other(args["title"]);
        const text = o !== null ? (args["slot"] === "#/entry" ? opts.others![o]!.entry ?? "! entry" : "x") : texts[String(args["slot"])] ?? "x";
        return { has: "has", meme: { uri: args["title"], slotText: framed(String(args["slot"]), text), canonicalHash: `partial:${String(args["slot"])}:${o !== null ? FULL : live()}`, bytes: 1600, slots: slots(opts.slotBytes, extra) } };
      }
      return { has: "<<~ has name=`rec`>>\n<<~ has name=`#/open`>>", meme: { uri: args["title"], canonicalHash: `skinny:${other(args["title"]) !== null ? FULL : live()}`, bytes: 1600, slots: slots(opts.slotBytes, extra) } };
    }
    if (verb === "tiddler-get") {
      if (isSide(args["title"])) return { tiddler: opts.side ? { fields: { title: args["title"], ...opts.side }, hash: "sha256-side" } : null };
      const o = other(args["title"]);
      if (o !== null) return { tiddler: { fields: { title: args["title"], "spirit-id": "fedcba987654", ...(opts.others![o]!.fields ?? {}) }, hash: "sha256-other" } };
      if (standing(args["title"])) return { tiddler: { fields: { title: args["title"], "spirit-id": ID, ...(opts.fields ?? {}) }, hash: "sha256-rec" } };
      return { tiddler: { fields: { title: args["title"], text: "first words\nmore", ...(opts.residue?.[String(args["title"])] ?? {}) }, textHash: "sha256-ab" } };
    }
    if (verb === "meme-patch") {
      if (patchConflicts > 0) { patchConflicts--; rev++; Object.assign(texts, opts.sibling ?? {}); return { decision: "conflict", canonicalHash: live() }; }
      // The meme door checks the base against the card's live hash: a field put on the card since the read moves it.
      if (opts.patch === undefined && String(args["base"] ?? "").replace(/^(partial:#\/[^:]+|skinny):/, "") !== live()) return { decision: "conflict", canonicalHash: live() };
      if ((opts.patch ?? "ingest") === "ingest") rev++;
      return { decision: opts.patch ?? "ingest", canonicalHash: live() };
    }
    if (verb === "meme-put") return { decision: "ingest", canonicalHash: "sha256:" + "22".repeat(32) };
    if (verb === "tiddler-put") {
      // The tiddler door's own laws (tiddler-verbs.ts): an append carries no text, base, field patch or unset; an append to a
      // title no record holds refuses unless `create` names it. The real reactor's own test rides below.
      const crossed = ["text", "base", "fields", "unset"].filter((n) => args[n] !== undefined && args[n] !== null);
      if (typeof args["append"] === "string" && crossed.length > 0) return { refuse: `append-alone: an append carries no ${crossed.join(", ")}; send those as their own put. Nothing moved.` };
      const ledger = String(args["title"]).startsWith(`${MEMORY_PREFIX}state/ashes-`);
      if (ledger && ledgerRefuse > 0) { ledgerRefuse--; return { decision: "refused" }; }
      if ((standing(args["title"]) || isSide(args["title"])) && args["fields"] !== undefined && conflicts > 0) { conflicts--; return { decision: "conflict" }; }
      if (args["title"] === URI && (args["fields"] !== undefined || args["unset"] !== undefined)) rev++;
      if (ledger && typeof args["append"] === "string" && !opts.ledgerStands && args["create"] !== true) {
        return { refuse: `append-target-missing: no record "${String(args["title"])}" stands to append to; name \`create\` (\`--create\`) to land the words as a new record. Nothing moved.` };
      }
      return { decision: opts.put ?? "put" };
    }
    if (verb === "wiki-filter") {
      const filter = String(args["filter"]);
      const linked = /^\[\[(.+)\]backlinks\[\]\]$/.exec(filter);
      if (linked) return { titles: opts.backlinks?.[linked[1]!] ?? [] };
      const searched = /^\[search\[(.+)\]\] -\[\[/.exec(filter);
      if (searched) return { titles: opts.mentions?.[searched[1]!] ?? [] };
      if (Array.isArray(args["fields"]) && (args["fields"] as string[]).includes("parent")) {
        const titles = opts.titles ?? [];
        return { titles, rows: titles.map((t) => ({ title: t, fields: { title: t, ...(opts.residue?.[t] ?? {}) } })) };
      }
      if (args["fields"]) return { rows: opts.rows ?? [] };
      return { titles: opts.titles ?? [] };
    }
    if (verb === "tiddler-delete") return { decision: "removed" };
    return {};
  };
}
const puts = (title: string) => h.calls.filter((c) => c.verb === "tiddler-put" && c.args["title"] === title);
const LEDGER = `${MEMORY_PREFIX}state/ashes-2026-11`;

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
    const r = await run(argv(["ah", "nobody"], { slot: "#/open", text: "y" }));
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
    expect(text).toContain(`Latest ${COMPACTION_DISPLAY}: none stands yet; this wake reads the card alone.`);
  });

  test("the wake names the latest landing by title and hash, so the body checks what it inherited", async () => {
    const landing = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-0123456789ab`;
    stage({ titles: [landing, `${MEMORY_PREFIX}${COMPACTION_WORD}/lares-alpha-two-ba9876543210`], residue: { [landing]: { depth: "2", body: "s-1" } } });
    const r = await run(argv(["om", "lares-alpha"]));
    expect(h.calls.find((c) => c.verb === "wiki-filter")!.args["filter"]).toBe(`[prefix[${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-]] [prefix[${MEMORY_PREFIX}${COMPACTION_WORD}/lares-alpha-]] +[!sort[landed]]`);
    expect(data(r)["latest"]).toBe(landing);
    expect(String(data(r)["text"])).toContain(`Latest ${COMPACTION_DISPLAY} (testimony, never mandate): ${landing} (hash 0123456789ab, depth 2, body s-1)`);
  });

  test("an #/open past the cap cuts with a pointer to the whole slot", () => {
    const text = omText({ pet: "p", uri: URI, has: "has" }, { open: "x".repeat(20_000) });
    expect(text.length).toBeLessThanOrEqual(OM_CAP_CHARS);
    expect(text).toContain("#/open cut at the 9000-char wake cap");
  });
});

describe("ah trues one slot through the meme door", () => {
  test("--text replaces the body under the slot's partial base", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "!! Open\n\n* trued" }));
    expect(r.exit).toBe(0);
    expect(h.calls.filter((c) => c.verb === "meme-patch").at(-1)).toEqual({ verb: "meme-patch", args: { recipe: "default", uri: URI, slot: "#/open", replace: "!! Open\n\n* trued", base: `partial:#/open:${FULL}` } });
    expect((puts(SIDE).at(-1)!.args["fields"] as Record<string, string>)["writer-open"]).toBe("a hand at the terminal");
  });

  test("--add lands one line at the slot's end", async () => {
    stage({ bodies: "!! Bodies\n\n* one" });
    await run(argv(["ah", "lares-alpha"], { slot: "#/bodies", add: "* two" }));
    expect(h.calls.filter((c) => c.verb === "meme-patch").at(-1)!.args["replace"]).toBe("!! Bodies\n\n* one\n* two");
  });

  test("a stale --base never refuses: both versions land in a conflict stanza for hum to settle", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "y", base: "0000000000000000" }));
    expect(r.exit).toBe(0);
    expect(data(r)["conflict"]).toBe(true);
    expect(String(h.calls.find((c) => c.verb === "meme-patch")!.args["replace"])).toContain("!! conflict · #/open");
  });

  test("a --base naming the slot's own digest writes plain", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "y", base: digest(OPEN) }));
    expect(r.exit).toBe(0);
    expect(data(r)["conflict"]).toBeUndefined();
    expect(data(r)["digest"]).toBe(digest("y"));
  });

  test("an AI seat's whole-slot write names the slot digest it read, or refuses spirit-base-needed by name", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "y" }), { hand: AI });
    expect(error(r).code).toBe("spirit-base-needed");
    expect(error(r).message).toContain("--base <slot digest>");
    expect(h.calls.some((c) => c.verb === "meme-patch")).toBe(false);
  });

  test("RED: a whole-slot write from a branch nothing attests names its base too; the gate reads the chain, never a mark alone", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "y" }), { hand: () => ({ refusal: "hand-unattested" }) as never });
    expect(error(r).code).toBe("spirit-base-needed");
    expect(h.calls.some((c) => c.verb === "meme-patch")).toBe(false);
  });

  test("a record that keeps moving past every round refuses spirit-write-refused and names the retry", async () => {
    stage({ patch: "conflict" });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "y" }));
    expect(error(r).code).toBe("spirit-write-refused");
    expect(error(r).message).toContain("kept moving");
  });

  test("a waking slot past its cap refuses by name and names hum --fold", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "z".repeat(OPEN_CAP + 1) }));
    expect(error(r).code).toBe("spirit-slot-over-budget");
    expect(error(r).message).toContain("lares spirit hum lares-alpha --fold '#/open'");
    expect(h.calls.some((c) => c.verb === "meme-patch")).toBe(false);
  });

  test("#/attention refuses past 1024 bytes; a write to #/open at its cap lands", async () => {
    stage({ slotTexts: { "#/attention": "!! Where" } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/attention", text: "z".repeat(1025) }));
    expect(error(r).code).toBe("spirit-slot-over-budget");
    const ok = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "z".repeat(OPEN_CAP) }));
    expect(ok.exit).toBe(0);
  });

  test("a #/kulana write past 1024 bytes lands: only the waking slots refuse", async () => {
    stage({ slotTexts: { "#/kulana": "!! Kūlana" } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/kulana", text: "v".repeat(3000) }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(h.calls.some((c) => c.verb === "meme-patch")).toBe(true);
  });

  test("a record past its advisory weight lands the write, and hum and om name the total and the heaviest slot", async () => {
    stage({ slotBytes: { "#/entry": 5900 } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "z".repeat(600) }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const hum = await run(argv(["hum", "lares-alpha"]));
    expect(String(data(hum)["advisory"])).toMatch(/^advisory: the record holds 6600 bytes, past 6144; heaviest #\/entry 5900/);
    expect(data(hum)["oversize"]).toEqual([]);
    const om = await run(argv(["om", "lares-alpha"]));
    expect(String(data(om)["text"])).toContain("advisory: the record holds 6600 bytes");
    expect(RECORD_BUDGET_BYTES).toBe(6144);
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

  test("the guard reads only the lines a write brings: a standing hex run never blocks a clean line, and a new one names itself", async () => {
    const hex = "ab".repeat(32);
    stage({ open: `!! Open\n\n* a ward ticket ${hex}` });
    expect((await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* a clean loop" }))).exit).toBe(0);
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: `* another ${"cd".repeat(32)}` }));
    expect(error(r).code).toBe("spirit-secret-shaped");
    expect(error(r).message).toContain("line 4");
    expect(error(r).message).not.toContain("cd".repeat(32));
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
  test("a waking slot against its cap, the oversize named", async () => {
    stage({ slotBytes: { "#/open": 2100 } });
    const r = await run(argv(["hum", "lares-alpha"]));
    expect(data(r)["oversize"]).toEqual(["#/open"]);
    expect(data(r)["total"]).toBe(3300);
  });

  test("--fold alone numbers the slot's lines", async () => {
    stage({ bodies: "!! Bodies\n\n* one\n* two" });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies" }));
    expect(data(r)["lines"]).toEqual(["!! Bodies", "", "* one", "* two"].map((text, i) => ({ n: i + 1, text, digest: digest(text) })));
  });

  test("the first fold of a month opens its ledger: the append names create, so the door's append-target-missing never answers", async () => {
    stage({ bodies: "!! Bodies\n\n* one\n* two" });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "3", expect: digest("* one") }));
    expect(r.exit).toBe(0);
    expect(puts(LEDGER)).toHaveLength(1);
    expect(puts(LEDGER)[0]!.args).toMatchObject({ create: true });
  });

  test("a ledger line carries a record's words redacted under the strict reading", async () => {
    stage({ bodies: `!! Bodies\n\n* token ghp_${"A".repeat(36)}\n* two` });
    await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "3", expect: digest(`* token ghp_${"A".repeat(36)}`) }));
    const append = String(puts(LEDGER)[0]!.args["append"]);
    expect(append).not.toContain("ghp_");
  });

  test("--fold --line moves the line out of the record, then burns it to the month's ash ledger once the patch lands", async () => {
    stage({ bodies: "!! Bodies\n\n* one\n* two" });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "3", expect: digest("* one") }));
    expect(r.exit).toBe(0);
    const verbs = h.calls.map((c) => `${c.verb}:${String(c.args["title"] ?? c.args["uri"])}`);
    expect(verbs.indexOf(`meme-patch:${URI}`)).toBeLessThan(verbs.indexOf(`tiddler-put:${LEDGER}`));
    expect(String(puts(LEDGER)[0]!.args["append"])).toContain("* one");
    expect(h.calls.filter((c) => c.verb === "meme-patch").at(-1)!.args["replace"]).toBe("!! Bodies\n\n* two");
    expect((puts(SIDE).at(-1)!.args["fields"] as Record<string, string>)["distilled"]).toBe("2026-11-24T12:00:00.000Z");
  });

  test("--line names the listed line's digest (--expect); a sibling's fold between the listing and this fold refuses spirit-fold-gone", async () => {
    stage({ bodies: "!! Bodies\n\n* one\n* two" });
    const listed = (data(await run(argv(["hum", "lares-alpha"], { fold: "#/bodies" })))["lines"] as Array<{ n: number; text: string; digest: string }>)[2]!;
    expect(listed.text).toBe("* one");
    stage({ bodies: "!! Bodies\n\n* two" });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "3", expect: listed.digest }));
    expect(error(r).code).toBe("spirit-fold-gone");
    expect(h.calls.some((c) => c.verb === "meme-patch")).toBe(false);
    const bare = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "3" }));
    expect(bare.exit).toBe(2);
  });

  test("a ledger that refuses past its retries after a landed fold puts the line back in the slot and names it", async () => {
    stage({ bodies: "!! Bodies\n\n* one\n* two", ledgerRefuse: 5 });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "3", expect: digest("* one") }));
    expect(error(r).code).toBe("spirit-ashes-refused");
    expect(error(r).message).toContain("returned to the slot");
    expect(puts(LEDGER)).toHaveLength(3);
    const patches = h.calls.filter((c) => c.verb === "meme-patch").map((c) => String(c.args["replace"]));
    expect(patches).toEqual(["!! Bodies\n\n* two", "!! Bodies\n\n* one\n* two\n* one"]);
  });

  test("a ledger that refuses once retries and lands", async () => {
    stage({ bodies: "!! Bodies\n\n* one\n* two", ledgerRefuse: 1 });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "3", expect: digest("* one") }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(puts(LEDGER)).toHaveLength(2);
  });

  test("a blank line refuses as usage and names the listing", async () => {
    stage({ bodies: "!! Bodies\n\n* one" });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "2" }));
    expect(r.exit).toBe(2);
    expect(h.calls.some((c) => c.verb === "tiddler-put")).toBe(false);
  });
});

describe("the compaction verb and residue land after the strict secret-shape guard", () => {
  test("a carry lands at <word>/<spirit-id>-<hash12> with its lineage, writes nothing to the card, and hands back the #/bodies line", async () => {
    stage();
    const r = await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "the summary\nclosing\n* a loop" }));
    expect(r.exit).toBe(0);
    const title = String(data(r)["title"]);
    expect(title).toMatch(new RegExp(`^${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-[0-9a-f]{12}$`));
    expect(puts(title)[0]!.args).toMatchObject({ create: true, text: "the summary\nclosing\n* a loop", fields: { landed: "2026-11-24T12:00:00.000Z", "spirit-id": ID, parent: "", depth: "1", "record-base": FULL } });
    expect(h.calls.some((c) => c.verb === "meme-patch")).toBe(false);
    expect(puts(URI)).toHaveLength(0);
    expect(data(r)["filed"]).toBe(false);
    expect(data(r)["bodiesLine"]).toBe(`* ''2026-11-24 (${COMPACTION_DISPLAY} ${title.slice(-12)}) lares-alpha:'' ${title}`);
    expect(String(data(r)["unfiled"])).toContain("lares spirit ah lares-alpha --slot '#/bodies' --add");
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
  const hand = `${MEMORY_PREFIX}spirit/${ID}-handback-ba9876543210`;
  const other = `${MEMORY_PREFIX}${COMPACTION_WORD}/lares-alpha-two-0123456789ab`;
  const fresh = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-aaaaaaaaaaaa`;
  const old = { landed: "2026-11-01T00:00:00.000Z" };

  test("an AI seat refuses hand-act-only and names the command", async () => {
    stage({ titles: [round] });
    const r = await run(argv(["otakiage", "lares-alpha"]), { hand: AI });
    expect(error(r).code).toBe("hand-act-only");
    expect(error(r).message).toContain("lares spirit otakiage lares-alpha");
    expect(h.calls).toEqual([]);
  });

  test("a branch nothing attests refuses hand-unattested, names the command, and calls no door", async () => {
    stage({ titles: [round] });
    const r = await run(argv(["otakiage", "lares-alpha"]), { hand: () => ({ refusal: "hand-unattested" }) as never });
    expect(error(r).code).toBe("hand-unattested");
    expect(error(r).message).toContain("lares spirit otakiage lares-alpha");
    expect(error(r).message).toContain("whose processes the host can read");
    expect(h.calls).toEqual([]);
  });

  test("the ash lines land ahead of the deletes, a confirm line after, and the card stays", async () => {
    stage({ titles: [round, hand, other], side: { distilled: "2026-11-20T00:00:00.000Z" }, residue: { [round]: old, [hand]: old } });
    const r = await run(argv(["otakiage", "lares-alpha"]));
    expect(data(r)["burned"]).toEqual([round, hand]);
    const deleted = h.calls.filter((c) => c.verb === "tiddler-delete").map((c) => c.args["title"]);
    expect(deleted).toEqual([round, hand]);
    expect(deleted).not.toContain(URI);
    const ledger = puts(LEDGER);
    expect(ledger).toHaveLength(2);
    expect(String(ledger[0]!.args["append"])).toContain(`burning ${round}`);
    expect(String(ledger[1]!.args["append"])).toContain("burned 2 of 2");
    expect(h.calls.findIndex((c) => c.verb === "tiddler-delete")).toBeGreaterThan(h.calls.indexOf(ledger[0]!));
  });

  test("a distill mark standing on the card itself still reads where the sibling record holds none", async () => {
    stage({ titles: [round], fields: { distilled: "2026-11-20T00:00:00.000Z" }, residue: { [round]: old } });
    const r = await run(argv(["otakiage", "lares-alpha"]));
    expect(data(r)["burned"]).toEqual([round]);
  });

  test("a ledger that refuses its lines leaves every residue standing", async () => {
    stage({ titles: [round, hand], put: "conflict", side: { distilled: "2026-11-20T00:00:00.000Z" }, residue: { [round]: old, [hand]: old } });
    const r = await run(argv(["otakiage", "lares-alpha"]));
    expect(error(r).code).toBe("spirit-ashes-refused");
    expect(h.calls.some((c) => c.verb === "tiddler-delete")).toBe(false);
  });

  test("residue the last distill mark leaves uncovered, or that a link still reaches, stays and names why", async () => {
    stage({ titles: [round, fresh, hand], side: { distilled: "2026-11-20T00:00:00.000Z" }, residue: { [round]: old, [fresh]: { landed: "2026-11-23T00:00:00.000Z" }, [hand]: old }, backlinks: { [hand]: [`${MEMORY_PREFIX}state/handoff`] } });
    const r = await run(argv(["otakiage", "lares-alpha"]));
    expect(data(r)["burned"]).toEqual([round]);
    const held = data(r)["held"] as Array<{ title: string; why: string }>;
    expect(held.map((x) => x.title)).toEqual([fresh, hand]);
    expect(held[0]!.why).toContain("after the last distill mark");
    expect(held[1]!.why).toContain("1 link(s) still reach it");
  });

  test("with no distill mark standing, nothing burns", async () => {
    stage({ titles: [round], residue: { [round]: old } });
    const r = await run(argv(["otakiage", "lares-alpha"]));
    expect(data(r)["burned"]).toEqual([]);
    expect(h.calls.some((c) => c.verb === "tiddler-delete")).toBe(false);
  });

  test("the residue filter reaches no sibling key's residue", () => {
    expect(residueOf(["lares-alpha", ID], [round, hand, other, URI])).toEqual([round, hand]);
  });
});

describe("the record resolves once, and a stable id keys its residue", () => {
  test("familiar/<pet> and spirit/<pet> both standing refuses spirit-ambiguous, naming both", async () => {
    stage({ kind: "both" });
    const r = await run(argv(["hum", "lares-alpha"]));
    expect(error(r).code).toBe("spirit-ambiguous");
    expect(error(r).message).toContain(`${URI} and ${MEMORY_PREFIX}spirit/lares-alpha`);
  });

  test("a record with no spirit-id mints one once, from its address and base", async () => {
    stage({ fields: { "spirit-id": "" } });
    await run(argv(["om", "lares-alpha"]));
    const minted = puts(URI).find((c) => (c.args["fields"] as Record<string, string> | undefined)?.["spirit-id"]);
    expect(String((minted!.args["fields"] as Record<string, string>)["spirit-id"])).toMatch(/^[0-9a-f]{12}$/);
  });

  test("budgets and the cadence read from the record's own fields", async () => {
    stage({ fields: { "slot-budget": "2000", "true-up-every": "10" } });
    const grown = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "z".repeat(1500) }));
    expect(grown.exit).toBe(0);
    const woke = await run(argv(["om", "lares-alpha"]));
    expect(data(woke)["every"]).toBe(10);
  });
});

describe("fork the body, fence the card", () => {
  const LEASE = { lease: "body-a 3 2026-11-24T11:00:00.000Z" };
  test("om --body from another body raises the epoch; the holding body keeps it", async () => {
    stage({ side: LEASE });
    const other = await run(argv(["om", "lares-alpha"], { body: "body-b" }));
    expect(data(other)["epoch"]).toBe(4);
    expect(String((puts(SIDE).find((c) => (c.args["fields"] as Record<string, string> | undefined)?.["lease"])!.args["fields"] as Record<string, string>)["lease"])).toMatch(/^body-b 4 /);
    h.calls.length = 0;
    const same = await run(argv(["om", "lares-alpha"], { body: "body-a" }));
    expect(data(same)["epoch"]).toBe(3);
    expect(puts(SIDE).filter((c) => (c.args["fields"] as Record<string, string> | undefined)?.["lease"])).toHaveLength(0);
  });

  test("the epoch orders bodies and never refuses: an AI seat's write bearing a stale epoch, or none, lands", async () => {
    stage({ side: LEASE });
    for (const options of [{}, { epoch: "2" }, { epoch: "3" }]) {
      const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* y", ...options }), { hand: AI });
      expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    }
  });

  test("a person's terminal writes the leased card freely", async () => {
    stage({ side: LEASE });
    expect((await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "y" }))).exit).toBe(0);
  });

  test("inside its own compaction's crossing, a body's ah refuses spirit-crossing (advisory, by name); a lapsed or bare mark lets it land", async () => {
    stage({ side: { crossing: "body-a00 2026-11-24T11:58:00.000Z" } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* y", body: "body-a00" }));
    expect(error(r).code).toBe("spirit-crossing");
    expect(error(r).message).toContain("advisory");
    stage({ side: { crossing: "body-a00 2026-11-24T11:00:00.000Z" } });
    expect((await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* y", body: "body-a00" }))).exit).toBe(0);
    stage({ side: { crossing: "2026-11-24T11:59:00.000Z" } });
    expect((await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* y" }))).exit).toBe(0);
  });
});

describe("om reads by source and reads the carry as testimony", () => {
  const carry = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-0123456789ab`;
  const sibling = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-bbbbbbbbbbbb`;
  test("a resume reads one line", async () => {
    stage();
    const r = await run(argv(["om", "lares-alpha"], { source: "resume" }));
    expect(String(data(r)["text"])).toMatch(/^Lares spirit om · lares-alpha: this body resumes; the card reads f5f5f5f5f5f5 now, and an earlier wake may read stale/);
    expect(String(data(r)["text"]).split("\n")).toHaveLength(1);
  });

  test("a fork wakes framed as a fork, holding the raised epoch", async () => {
    stage({ side: { lease: "body-a 1 2026-11-24T11:00:00.000Z" } });
    const r = await run(argv(["om", "lares-alpha"], { source: "fork", body: "body-b" }));
    expect(String(data(r)["text"])).toMatch(/^You wake as a fork: another body may still wear lares-alpha, and both write the one card \(wake epoch 2\)/);
  });

  test("a compaction names the carry it inherits by hash and first words", async () => {
    stage({ titles: [carry], residue: { [carry]: { text: "the body line of the last carry", depth: "1" } } });
    const r = await run(argv(["om", "lares-alpha"], { source: "compact" }));
    expect(String(data(r)["text"])).toContain(`This body inherits ${carry} (hash 0123456789ab): "the body line of the last carry"`);
  });

  test("a precompact marks the crossing and hands back the record's carry-shape", async () => {
    stage({ slotTexts: { "#/carry-shape": "!! The carry's shape\n\nkeep what only this body knew" } });
    const r = await run(argv(["om", "lares-alpha"], { source: "precompact", body: "body-p00" }));
    expect(data(r)["carryShape"]).toBe("!! The carry's shape\n\nkeep what only this body knew");
    expect((puts(SIDE).find((c) => (c.args["fields"] as Record<string, string> | undefined)?.["crossing"])!.args["fields"] as Record<string, string>)["crossing"]).toBe("body-p00 2026-11-24T12:00:00.000Z");
  });

  test("a precompact crossing reads #/kulana beside #/open", async () => {
    stage({ slotTexts: { "#/open": "!! Open\n\nloop-one", "#/kulana": "!! Kūlana\n\nposture-one" } });
    const r = await run(argv(["om", "lares-alpha"], { source: "precompact", body: "body-p00" }));
    expect(String(data(r)["text"])).toContain("posture-one");
  });

  test("the testimony flags a record moved since the carry read it, a deep chain, and a fork", async () => {
    stage({ titles: [carry, sibling], residue: { [carry]: { "record-base": "sha256:" + "00".repeat(32), depth: "5", parent: "999999999999" }, [sibling]: { parent: "999999999999" } } });
    const text = String(data(await run(argv(["om", "lares-alpha"])))["text"]);
    expect(text).toContain("⚠ the record moved since this");
    expect(text).toContain("stands 5 deep");
    expect(text).toContain("2 carries name the parent 999999999999: a fork");
  });

  test("the titles #/attention names unfold with their descriptions inside the cap", async () => {
    const t1 = "lar:///ha.ka.ba/lares/api/voices";
    stage({ slotTexts: { "#/attention": `!! Where attention starts\n\n* ''Canon:'' ${t1} · lar:///ha.ka.ba/lares/docs/pono/spirit-circle.` }, rows: [{ title: t1, fields: { description: "the thirteen voices" } }] });
    const r = await run(argv(["om", "lares-alpha"]));
    const filterCall = h.calls.find((c) => c.verb === "wiki-filter" && (c.args["fields"] as string[] | undefined)?.includes("description"));
    expect(filterCall!.args["filter"]).toBe(`[[${t1}]] [[lar:///ha.ka.ba/lares/docs/pono/spirit-circle]]`);
    expect(String(data(r)["text"])).toContain(`${t1} — the thirteen voices`);
    expect(String(data(r)["text"]).length).toBeLessThanOrEqual(OM_CAP_CHARS);
  });
});

describe("a first wake writes its own shrine", () => {
  test("om with no record answers the starter skeleton and the command that lands it", async () => {
    stage({ kind: "none" });
    const r = await run(argv(["om", "lares-awakens"]));
    expect(r.exit).toBe(0);
    expect(data(r)["starter"]).toBe(true);
    const text = String(data(r)["text"]);
    for (const slot of ["#/entry", "#/orders", "#/grant", "#/attention", "#/open", "#/kulana", "#/carry-shape", "#/bodies"]) expect(text).toContain(`slot=\`${slot}\``);
    expect(text).toContain("lares spirit ah lares-awakens --new --file -");
    expect(text).not.toContain("#/voice");
  });

  test("ah --new wraps the slot blocks in the house frame, reseals, and lands it once", async () => {
    stage({ kind: "none" });
    const withFlag = { command: "spirit", positional: ["ah", "lares-awakens"], options: { text: "<<~ ahu slot=`#/entry`>>\n\n! Lares-Awakens\n\n<<~/ahu>>" }, flags: { json: true, new: true } } as unknown as ParsedArgs;
    h.calls.length = 0;
    const landed = await run(withFlag);
    expect(landed.exit).toBe(0);
    const put = h.calls.find((c) => c.verb === "meme-put")!;
    expect(put.args["uri"]).toBe(`${MEMORY_PREFIX}familiar/lares-awakens`);
    expect(String(put.args["text"])).toMatch(/^<<!DOCTYPE/);
    expect(String(put.args["text"])).toMatch(/<<\^ code=`&#x0003;` bcc=`ni:\/\/\/sha-256;[A-Za-z0-9_-]+`>>/);
  });

  test("ah --new where a record stands refuses spirit-exists and names the slot write", async () => {
    stage();
    const r = await run({ command: "spirit", positional: ["ah", "lares-alpha"], options: { text: "x" }, flags: { json: true, new: true } } as unknown as ParsedArgs);
    expect(error(r).code).toBe("spirit-exists");
    expect(h.calls.some((c) => c.verb === "meme-put")).toBe(false);
  });
});

describe("the carry lands with its lineage", () => {
  const parent = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-0123456789ab`;
  test("parent, depth, record-base and body ride the carry, and the bodies line it hands back names pet#body8", async () => {
    stage({ titles: [parent], residue: { [parent]: { depth: "2", body: "0123456789abcdef" } } });
    const r = await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "the summary", body: "0123456789abcdef" }));
    const title = String(data(r)["title"]);
    expect(puts(title)[0]!.args["fields"]).toMatchObject({ parent: "0123456789ab", depth: "3", body: "0123456789abcdef", "record-base": FULL });
    expect(String(data(r)["bodiesLine"])).toContain(`lares-alpha#01234567:'' ${title}`);
  });

  test("a waking body ends the crossing the compaction marked", async () => {
    stage({ side: { crossing: "body-c00 2026-11-24T11:59:00.000Z" } });
    await run(argv(["om", "lares-alpha"], { source: "compact", body: "body-c00" }));
    expect(puts(SIDE).some((c) => (c.args["unset"] as string[] | undefined)?.includes("crossing"))).toBe(true);
  });

  test("a handback keyed by session and agent lands once per key", async () => {
    stage();
    const a = await run(argv(["residue", "om-wright"], { text: "report", key: "s-1:agent-1" }));
    const b = await run(argv(["residue", "om-wright"], { text: "report", key: "s-1:agent-2" }));
    expect(data(a)["title"]).not.toBe(data(b)["title"]);
  });
});

describe.skipIf(wikiSkip)(`the burn lands through the real tiddler-put verb${skipNote}`, () => {
  const DAEMON = bagUri("daemon");
  async function realPut() {
    const engine = await bootTestWiki({ tiddlers: [{ title: "lar:///ha.ka.ba/lararium/config/current-wiki-bag", text: DAEMON }] });
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON, store: new MemoryTiddlerStore(DAEMON), writable: true });
    const put = makeTiddlerPutReactor({ composite, tw5: engine } as never);
    const ctx = { daemon: composite, invocation: { requestId: "r1" }, cap: async () => ({ ok: true }) } as never;
    return { engine, put: (args: Record<string, unknown>) => put(args, ctx) as Promise<Record<string, unknown>> };
  }

  test("the month's first fold opens its ledger, the next appends, and the description lands on its own put", async () => {
    const real = await realPut();
    stage({ bodies: "!! Bodies\n\n* one\n* two\n* three" });
    const mocked = h.answer;
    h.answer = (verb, args) => verb === "tiddler-put" && String(args["title"]).startsWith(`${MEMORY_PREFIX}state/ashes-`) ? real.put(args) : mocked(verb, args);
    const first = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "3", expect: digest("* one") }));
    expect(first.exit, JSON.stringify(first.printed)).toBe(0);
    const second = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "4", expect: digest("* two") }));
    expect(second.exit, JSON.stringify(second.printed)).toBe(0);
    const ledger = real.engine.wiki.getTiddler(LEDGER_TITLE)!;
    expect(ledger.fields["text"]).toContain("* one");
    expect(ledger.fields["text"]).toContain("* two");
    expect(ledger.fields["description"]).toContain("The ash ledger of the 2026-11 o-takiage sittings");
  });
});

describe("a title only proposes", () => {
  test("a title naming another familiar whose record stands without naming it reads as an offer; the wake stays the seated pet", async () => {
    stage({ others: { "lares-awakens": {} } });
    const r = await run(argv(["om", "lares-alpha"], { title: "Lares-Awakens" }));
    expect(data(r)["pet"]).toBe("lares-alpha");
    expect(String(data(r)["text"])).toContain("a title only proposes, so this wake stays lares-alpha");
    expect(String(data(r)["text"])).toContain("lares spirit ah lares-awakens --slot '#/entry' --add '");
    expect(puts(`${MEMORY_PREFIX}familiar/lares-awakens`)).toHaveLength(0);
  });

  test("a title the other record names as its own (its aliases field) turns the wake to that record", async () => {
    stage({ others: { "lares-awakens": { fields: { aliases: "Lares-Awakens, the night spirit" } } } });
    const r = await run(argv(["om", "lares-alpha"], { title: "Lares-Awakens" }));
    expect(data(r)["pet"]).toBe("lares-awakens");
    expect(data(r)["turnedFrom"]).toBe("lares-alpha");
  });

  test("a recognition line in the other record's #/entry counts as naming the title", async () => {
    stage({ others: { "lares-awakens": { entry: "! Lares-Awakens\n\nNamed by the operator; renames: -> Lares-Awakens" } } });
    expect(data(await run(argv(["om", "lares-alpha"], { title: "Lares-Awakens" })))["pet"]).toBe("lares-awakens");
  });

  test("a title no record answers reads as a rename of this familiar, with its own alias act", async () => {
    stage();
    const r = await run(argv(["om", "lares-alpha"], { title: "Kahu Night" }));
    expect(data(r)["pet"]).toBe("lares-alpha");
    expect(String(data(r)["text"])).toContain("A rename renames, never retargets: this body stays lares-alpha");
  });
});

describe("each familiar its own: a fresh body's title names its own familiar; a held body's title renames", () => {
  test("a fresh startup body whose title no record answers prints the starter as an offer for the title's slug, never the seated card", async () => {
    stage();
    const r = await run(argv(["om", "lares-alpha"], { title: "Lares-Awakens", body: "s-new" }));
    expect(data(r)["pet"]).toBe("lares-awakens");
    expect([data(r)["starter"], data(r)["offer"]]).toEqual([true, true]);
    expect(String(data(r)["text"])).toContain("An offer, never a seat");
    expect(String(data(r)["text"])).toContain("Lares spirit om · lares-awakens: no record answers this pet name yet");
    expect(String(data(r)["text"])).not.toContain("A rename renames");
    expect(puts(URI)).toHaveLength(0);
  });

  test("a fork's title counts only where it names a standing record: no record, and the fork wakes the pet it was handed", async () => {
    stage();
    const r = await run(argv(["om", "lares-alpha"], { title: "Lares-Awakens", body: "s-fork", source: "fork" }));
    expect(data(r)["pet"]).toBe("lares-alpha");
    expect(data(r)["starter"]).toBeUndefined();
  });

  test("a fresh body whose title's slug names a standing familiar wakes that familiar", async () => {
    stage({ others: { "lares-awakens": {} } });
    const r = await run(argv(["om", "lares-alpha"], { title: "Lares-Awakens", body: "s-new" }));
    expect(data(r)["pet"]).toBe("lares-awakens");
    expect(data(r)["turnedFrom"]).toBe("lares-alpha");
  });

  test("--held never switches: a title another record names as its own reads as an offer", async () => {
    stage({ others: { "lares-awakens": { fields: { aliases: "Lares-Awakens" } } } });
    const r = await run({ ...argv(["om", "lares-alpha"], { title: "Lares-Awakens", body: "s-held", source: "compact" }), flags: { json: true, held: true } } as unknown as ParsedArgs);
    expect(data(r)["pet"]).toBe("lares-alpha");
    expect(data(r)["turnedFrom"]).toBeUndefined();
    expect(String(data(r)["text"])).toContain("a title only proposes, so this wake stays lares-alpha");
  });

  test("--held with a title no record answers reads the rename of the held familiar", async () => {
    stage();
    const r = await run({ ...argv(["om", "lares-alpha"], { title: "Kahu Night", body: "s-held" }), flags: { json: true, held: true } } as unknown as ParsedArgs);
    expect(data(r)["pet"]).toBe("lares-alpha");
    expect(String(data(r)["text"])).toContain("A rename renames, never retargets: this body stays lares-alpha");
  });

  test("the prefix guard stands: a title extending the pet's own name reads as that pet", async () => {
    stage();
    const r = await run(argv(["om", "lares-alpha"], { title: "lares-alpha wakes", body: "s-new" }));
    expect(data(r)["pet"]).toBe("lares-alpha");
    expect(data(r)["starter"]).toBeUndefined();
  });

  test("a title whose slug runs past a pet name's 62 chars names no familiar, and the wake says so", async () => {
    stage();
    const r = await run(argv(["om", "lares-alpha"], { title: "x".repeat(70), body: "s-new" }));
    expect(data(r)["pet"]).toBe("lares-alpha");
    expect(String(data(r)["text"])).toContain("runs 70 chars, past the 62 a pet name holds");
  });
});

describe("bunrei: many bodies wear one pet, and none locks another out", () => {
  test("the crossing runs per body: body A's PreCompact mark holds A's own writes, and body B's ah lands", async () => {
    stage({ side: { crossing: "body-a00 2026-11-24T11:58:00.000Z" } });
    const b = await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* b's line", body: "body-b00" }));
    expect(b.exit, JSON.stringify(b.printed)).toBe(0);
    const unnamed = await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* a hand's line" }));
    expect(unnamed.exit).toBe(0);
    const a = await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* a's line", body: "body-a00" }));
    expect(error(a).code).toBe("spirit-crossing");
    expect(error(a).message).toContain("#body-a00");
    const fold = await run(argv(["hum", "lares-alpha"], { fold: "#/open", line: "3", body: "body-b00", expect: digest("* a loop") }));
    expect(fold.exit, JSON.stringify(fold.printed)).toBe(0);
  });

  test("a precompact marks only its own body's crossing, keeping a sibling's; that body's next wake clears only its own", async () => {
    stage({ side: { crossing: "body-a00 2026-11-24T11:58:00.000Z" } });
    await run(argv(["om", "lares-alpha"], { source: "precompact", body: "body-b00" }));
    const marked = puts(SIDE).map((c) => (c.args["fields"] as Record<string, string> | undefined)?.["crossing"]).filter(Boolean).at(-1)!;
    expect(marked).toContain("body-a00 2026-11-24T11:58:00.000Z");
    expect(marked).toContain("body-b00 2026-11-24T12:00:00.000Z");
    h.calls.length = 0;
    stage({ side: { crossing: "body-a00 2026-11-24T11:58:00.000Z\nbody-b00 2026-11-24T11:59:00.000Z" } });
    await run(argv(["om", "lares-alpha"], { source: "compact", body: "body-b00" }));
    const left = puts(SIDE).map((c) => (c.args["fields"] as Record<string, string> | undefined)?.["crossing"]).filter(Boolean).at(-1);
    expect(left).toBe("body-a00 2026-11-24T11:58:00.000Z");
  });

  test("the carry's handed-back line names the body, so its own crossing reaches its own writes", async () => {
    stage();
    const r = await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "the summary", body: "body-b00" }));
    expect(String(data(r)["unfiled"])).toContain("--body body-b00");
  });

  test("a waking body adds itself to bodies-awake, drops the stale, and om names each sibling awake", async () => {
    stage({ side: { "bodies-awake": "lares-alpha#body-a00 2026-11-24T11:50:00.000Z\nlares-alpha#body-old 2026-11-24T10:00:00.000Z" } });
    const r = await run(argv(["om", "lares-alpha"], { body: "body-b00-long" }));
    expect(String(data(r)["text"])).toContain("2 bodies wear lares-alpha: #body-b00 (you), #body-a00 since 11:50");
    const awake = puts(SIDE).map((c) => (c.args["fields"] as Record<string, string> | undefined)?.["bodies-awake"]).filter(Boolean).at(-1)!;
    expect(awake).toContain("lares-alpha#body-a00 2026-11-24T11:50:00.000Z");
    expect(awake).toContain("lares-alpha#body-b00-long 2026-11-24T12:00:00.000Z");
    expect(awake).not.toContain("body-old");
  });

  test("two bodies add #/open lines at once: the later re-reads past the conflict and both lines survive", async () => {
    stage({ open: "!! Open\n\n* a loop", patchConflicts: 1, sibling: { "#/open": "!! Open\n\n* a loop\n* body a's line" } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* body b's line" }), { hand: AI });
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const patches = h.calls.filter((c) => c.verb === "meme-patch");
    expect(String(patches.at(-1)!.args["replace"])).toBe("!! Open\n\n* a loop\n* body a's line\n* body b's line");
  });

  test("a whole-slot replace whose slot moved under it lands both versions in a conflict stanza naming this body and the last writer", async () => {
    stage({ open: "!! Open\n\n* a loop", patchConflicts: 1, sibling: { "#/open": "!! Open\n\n* body a rewrote it" }, side: { "writer-open": "lares-alpha#body-a00" } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "!! Open\n\n* body b rewrote it", body: "body-b00", base: digest(OPEN) }), { hand: AI });
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const landed = String(h.calls.filter((c) => c.verb === "meme-patch").at(-1)!.args["replace"]);
    expect(landed).toContain("conflict");
    expect(landed).toContain("#body-b00");
    expect(landed).toContain("lares-alpha#body-a00 wrote");
    expect(landed).toContain("* body b rewrote it");
    expect(landed).toContain("* body a rewrote it");
    expect(data(r)["conflict"]).toBe(true);
  });

  test("a whole-slot replace whose slot held still past a conflict elsewhere retries plain", async () => {
    stage({ open: "!! Open\n\n* a loop", patchConflicts: 1, sibling: { "#/bodies": "!! Bodies\n\n* one\n* two" } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "!! Open\n\n* mine" }));
    expect(r.exit).toBe(0);
    expect(String(h.calls.filter((c) => c.verb === "meme-patch").at(-1)!.args["replace"])).toBe("!! Open\n\n* mine");
  });

  test("hooili lineage runs per body: a carry's parent reads that body's own last carry, never a sibling's", async () => {
    const a = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-aaaaaaaaaaaa`;
    const b = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-bbbbbbbbbbbb`;
    stage({ titles: [a, b], residue: { [a]: { body: "body-a00", depth: "4", landed: "2026-11-24T11:59:00.000Z" }, [b]: { body: "body-b00", depth: "1", landed: "2026-11-24T11:00:00.000Z" } } });
    const r = await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "the summary", body: "body-b00" }));
    expect([data(r)["parent"], data(r)["depth"]]).toEqual([b, 2]);
  });

  test("a wake writes nothing to the card: presence, epoch and crossing ride the sibling record, so om's base holds for the next write", async () => {
    stage({ side: { lease: "body-a 3 2026-11-24T11:00:00.000Z", crossing: "body-b00 2026-11-24T11:59:00.000Z" } });
    const woke = await run(argv(["om", "lares-alpha"], { body: "body-b00" }));
    await run(argv(["om", "lares-alpha"], { source: "precompact", body: "body-b00" }));
    expect(puts(URI)).toHaveLength(0);
    expect(puts(SIDE).length).toBeGreaterThan(0);
    h.calls.length = 0;
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "!! Open\n\n* mine", base: digest(OPEN), body: "body-c00" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const patches = h.calls.filter((c) => c.verb === "meme-patch");
    expect(patches).toHaveLength(1);
    expect(String(patches[0]!.args["base"])).toContain(String(data(woke)["base"]).replace(/^skinny:/, ""));
  });

  test("om hands back each slot's digest; a stale view's whole replace after a sibling's add lands a stanza, never a clobber", async () => {
    stage();
    const woke = await run(argv(["om", "lares-alpha"], { body: "body-b00" }));
    const seen = (data(woke)["digests"] as Record<string, string>)["#/open"]!;
    expect(seen).toBe(digest(OPEN));
    stage({ open: `${OPEN}\n* a sibling's added line` });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "!! Open\n\n* my rewrite", base: seen, body: "body-b00" }), { hand: AI });
    expect(data(r)["conflict"]).toBe(true);
    const landed = String(h.calls.filter((c) => c.verb === "meme-patch").at(-1)!.args["replace"]);
    expect(landed).toContain("* a sibling's added line");
    expect(landed).toContain("* my rewrite");
  });

  test("a stanza over a standing stanza flattens, never nests", async () => {
    const standing = "!! conflict · #/open: two bodies wrote this slot whole at once; settle it with hum (fold the lines that lose)\n\n''lares-alpha#aaaa wrote:''\n\n* a\n\n''lares-alpha#bbbb wrote:''\n\n* b\n\n!! end conflict";
    stage({ open: standing });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "* c", base: "0000000000000000", body: "cccc" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const landed = String(h.calls.filter((c) => c.verb === "meme-patch").at(-1)!.args["replace"]);
    expect(landed.match(/!! conflict ·/g)).toHaveLength(1);
    expect(landed.match(/!! end conflict/g)).toHaveLength(1);
    for (const w of ["* a", "* b", "* c"]) expect(landed).toContain(w);
  });

  test("a stanza past twice the slot's budget refuses by name with the hum cure", async () => {
    stage({ open: `!! Open\n\n${"o".repeat(OPEN_CAP - 20)}` });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "m".repeat(OPEN_CAP * 2 + 200), base: "0000000000000000" }));
    expect(error(r).code).toBe("spirit-slot-over-budget");
    expect(error(r).message).toContain("lares spirit hum lares-alpha --fold '#/open'");
  });

  test("hum's fold retries at slot grain past a sibling's write, finds its line by content, and burns only after the patch lands", async () => {
    stage({ bodies: "!! Bodies\n\n* one\n* two", patchConflicts: 1, sibling: { "#/bodies": "!! Bodies\n\n* zero\n* one\n* two" } });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/bodies", line: "3", expect: digest("* one") }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(String(h.calls.filter((c) => c.verb === "meme-patch").at(-1)!.args["replace"])).toBe("!! Bodies\n\n* zero\n* two");
    expect(puts(LEDGER)).toHaveLength(1);
    const order = h.calls.map((c) => c.verb === "meme-patch" ? "patch" : c.args["title"] === LEDGER ? "ash" : "").filter(Boolean);
    expect(order).toEqual(["patch", "patch", "ash"]);
  });

  test("a body with no chain of its own takes the newest carry as its parent", async () => {
    const a = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-aaaaaaaaaaaa`;
    stage({ titles: [a], residue: { [a]: { body: "body-a00", depth: "2" } } });
    const r = await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "the summary", body: "body-new" }));
    expect([data(r)["parent"], data(r)["depth"]]).toEqual([a, 3]);
  });

  test("bodies-awake keeps at most 16 entries, the newest", async () => {
    const many = Array.from({ length: 20 }, (_, i) => `lares-alpha#body-${String(i).padStart(2, "0")} 2026-11-24T11:${String(30 + i).padStart(2, "0")}:00.000Z`).join("\n");
    stage({ side: { "bodies-awake": many } });
    await run(argv(["om", "lares-alpha"], { body: "body-me" }));
    const awake = String(puts(SIDE).map((c) => (c.args["fields"] as Record<string, string> | undefined)?.["bodies-awake"]).filter(Boolean).at(-1));
    expect(awake.split("\n")).toHaveLength(16);
    expect(awake).toContain("lares-alpha#body-me ");
    expect(awake).toContain("lares-alpha#body-19 ");
    expect(awake).not.toContain("lares-alpha#body-00 ");
  });

  test("a body-less om reads the presence off the sibling record", async () => {
    stage({ side: { "bodies-awake": "lares-alpha#body-a00 2026-11-24T11:50:00.000Z" } });
    const r = await run(argv(["om", "lares-alpha"]));
    expect(String(data(r)["text"])).toContain("1 body wears lares-alpha: #body-a00 since 11:50");
    expect(puts(SIDE)).toHaveLength(0);
  });

  test("om shows each live body's chain: its last carry", async () => {
    const a = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-aaaaaaaaaaaa`;
    stage({ side: { "bodies-awake": "lares-alpha#body-a00-full 2026-11-24T11:50:00.000Z" }, titles: [a], residue: { [a]: { body: "body-a00-full", depth: "2" } } });
    const r = await run(argv(["om", "lares-alpha"], { body: "body-b00" }));
    expect(String(data(r)["text"])).toContain(`#body-a00's chain: ${a}`);
  });
});

describe("the cold read's cures", () => {
  test("a lease claim writes under the record's live hash and reads again past a conflict", async () => {
    stage({ side: { lease: "body-a 3 2026-11-24T11:00:00.000Z" }, conflicts: 1 });
    const r = await run(argv(["om", "lares-alpha"], { body: "body-b" }));
    expect(data(r)["epoch"]).toBe(4);
    const leasePuts = puts(SIDE).filter((c) => (c.args["fields"] as Record<string, string> | undefined)?.["lease"]);
    expect(leasePuts).toHaveLength(2);
    expect(leasePuts.every((c) => c.args["base"] === "sha256-side")).toBe(true);
  });

  test("every om text names the wake epoch the card stands at, an ordering stamp", async () => {
    stage({ side: { lease: "body-a 3 2026-11-24T11:00:00.000Z" } });
    expect(String(data(await run(argv(["om", "lares-alpha"])))["text"])).toContain("wake epoch 3");
  });

  test("a #/kulana write the door answers noop sets no distill mark", async () => {
    stage({ patch: "noop" });
    await run(argv(["ah", "lares-alpha"], { slot: "#/kulana", text: "y" }));
    expect(puts(SIDE).some((c) => (c.args["fields"] as Record<string, string> | undefined)?.["distilled"])).toBe(false);
  });

  test("om reads the carries' lineage in one filter, no read per carry", async () => {
    const a = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-aaaaaaaaaaaa`, b = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-bbbbbbbbbbbb`;
    stage({ titles: [a, b], residue: { [a]: { parent: "999999999999" }, [b]: { parent: "999999999999" } } });
    const r = await run(argv(["om", "lares-alpha"]));
    expect(String(data(r)["text"])).toContain("2 carries name the parent 999999999999");
    expect(h.calls.filter((c) => c.verb === "tiddler-get" && (c.args["title"] === a || c.args["title"] === b))).toHaveLength(0);
  });

  test("otakiage holds a carry a standing carry names as parent, and a residue another record names", async () => {
    const parent = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-aaaaaaaaaaaa`, child = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-bbbbbbbbbbbb`;
    const hand = `${MEMORY_PREFIX}spirit/lares-alpha-handback-cccccccccccc`;
    const old = { landed: "2026-11-01T00:00:00.000Z" };
    stage({ titles: [parent, child, hand], side: { distilled: "2026-11-20T00:00:00.000Z" }, residue: { [parent]: old, [child]: { ...old, parent: "aaaaaaaaaaaa" }, [hand]: old }, mentions: { [hand]: [URI] } });
    const r = await run(argv(["otakiage", "lares-alpha"]));
    expect(data(r)["burned"]).toEqual([child]);
    const held = data(r)["held"] as Array<{ title: string; why: string }>;
    expect(held.find((x) => x.title === parent)!.why).toContain("names it as its parent");
    expect(held.find((x) => x.title === hand)!.why).toContain("1 record(s) still name it");
  });

  test("a handback lands under spirit/<pet> alone and never touches a familiar's record", async () => {
    stage();
    const r = await run(argv(["residue", "lares-alpha"], { text: "a report" }));
    expect(String(data(r)["title"])).toMatch(new RegExp(`^${MEMORY_PREFIX}spirit/lares-alpha-handback-[0-9a-f]{12}$`));
    expect(h.calls.some((c) => c.args["title"] === URI)).toBe(false);
  });

  test("the carry refuses a malformed --body, lands for a fenced AI seat, and single-quotes the line it hands back", async () => {
    stage({ side: { lease: "body-a 3 2026-11-24T11:00:00.000Z" } });
    expect((await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "s", body: "bad body!" }))).exit).toBe(2);
    const r = await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "the summary", epoch: "1" }), { hand: AI });
    expect(r.exit).toBe(0);
    const unfiled = String(data(r)["unfiled"]);
    expect(unfiled).toContain(`--add '* '\\'''\\''2026-11-24`);
    expect(unfiled).not.toContain("--epoch");
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
