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
  /** The vessel's owed band for one call (`rest`), as the seat stamps it; null: the call's changes sealed. */
  restFor: (_verb: string, _args: Record<string, unknown>): Record<string, unknown> | null => null,
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
    const rest = h.restFor(verb, args);
    return { status: "done", requestId: "r", results: { summary: { ok: true, output } }, ...(rest !== null ? { rest } : {}) };
  },
  // A face session answers as the vessel's own: these suites read what the door asks, never which session carried it.
  runVerbAsFace: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    const output = await h.answer(verb, args);
    if (typeof output["refuse"] === "string") return { status: "error", requestId: "r", errorMessage: output["refuse"] };
    return { status: "done", requestId: "r", results: { summary: { ok: true, output } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { cmdSpirit, shrineCarrier, SHRINE_SLOTS, omText, residueOf, slotBody, ashLedgerOf, OM_CAP_CHARS, WAKING_SLOT_BUDGETS, RECORD_BUDGET_BYTES, MEMORY_PREFIX, RESIDUE_CAP_CHARS } from "../src/commands/spirit.js";
import { COMPACTION_DISPLAY, COMPACTION_WORD } from "../src/spirit-words.js";
import { COMMANDS } from "../src/bin/lares.js";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { bagUri } from "@lararium/mesh/lar-uris";
import { MemoryTiddlerStore, makeTiddlerGetReactor, makeTiddlerPutReactor, makeWikiRenderReactor } from "@lararium/tw5";
import { bootTestWiki, skipNote, wikiSkip } from "../../lararium-tw5/tests/test-wiki.js";
import { normalizeMemeSource } from "@lararium/tw5/meme-normalize";
import type { ParsedArgs } from "../src/parse-args.js";

const URI = `${MEMORY_PREFIX}familiar/lares-alpha`;
const SIDE = `${MEMORY_PREFIX}presence/lares-alpha`;
const CARD_PREFIX = `${MEMORY_PREFIX}spirit-card/`;
const CARD = `${CARD_PREFIX}lares-alpha`;
const ALANA = `${MEMORY_PREFIX}alana/lares-alpha`;
const ONE = "lar:///ha.ka.ba/lares/spirit/lares-alpha";
const MASK = `${MEMORY_PREFIX}mask-card/lares-alpha`;
const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
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
  { slot: "#/instances", bytes: over["#/instances"] ?? 300, first: "instances" },
  ...extra.map((slot) => ({ slot, bytes: over[slot] ?? 100, first: slot })),
];
const framed = (slot: string, body: string) => `<<~ ahu slot=\`${slot}\`>>\n\n${body}\n\n<<~/ahu>>\n`;

interface StageOpts {
  kind?: "familiar" | "spirit" | "both" | "none"; slotBytes?: Record<string, number>; instances?: string; open?: string; patch?: string; put?: string;
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
  /** The carrier the wiki's fold answers the unfold call, by the rank it names; absent, the wiki's skin answers nothing. */
  carrier?: string | ((rank: string) => string);
  /** The render answers its text cut at the byte ceiling. */
  truncated?: boolean;
  /** Slot patches answer `conflict` this many times, a sibling instance's words landing first (`sibling`, by slot) at each. */
  patchConflicts?: number;
  sibling?: Record<string, string>;
  /** The spirit's card (`spirit-card/lares-alpha`) fields, where one stands; a field put on it lands here and moves its hash. */
  card?: Record<string, string>;
  /** The shelf's offering (`alana/lares-alpha`) fields, text included, where one stands; a put on the shelf lands here. */
  offering?: Record<string, string>;
  /** The ONE record (`lares/spirit/lares-alpha`), field-shaped, where one stands; a put on it lands here (patch and unset) and moves its hash. */
  one?: Record<string, string>;
  /** A plain record at the one address that names another pet (or none): no spirit answers there, and no shrine lands over it. */
  stray?: Record<string, string>;
  /** The spirit's mask card (`mask-card/lares-alpha`) fields, where one stands. */
  mask?: Record<string, string>;
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
  let cardRev = 0;
  let plainRev = 0;
  const live = (): string => (rev === 0 ? FULL : "sha256:" + rev.toString(16).padStart(2, "0").repeat(32));
  const isSide = (title: unknown): boolean => String(title).startsWith(`${MEMORY_PREFIX}presence/`);
  const texts: Record<string, string> = { "#/instances": opts.instances ?? "!! Instances\n\n* one", "#/open": opts.open ?? "!! Open\n\n* a loop", ...(opts.slotTexts ?? {}) };
  const extra = Object.keys(opts.slotTexts ?? {}).filter((slot) => !["#/entry", "#/open", "#/instances"].includes(slot));
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
    if (verb === "wiki-render") {
      const rank = /aperture:"([a-z]+)"/.exec(String(args["text"]))?.[1] ?? "";
      return { recipe: args["recipe"], form: args["form"], text: typeof opts.carrier === "function" ? opts.carrier(rank) : opts.carrier ?? "", truncated: opts.truncated === true, next: null };
    }
    for (const [at, held, name] of [[ONE, opts.one, "one"], [MASK, opts.mask, "mask"]] as const) {
      if (args["title"] !== at || !held) continue;
      if (verb === "tiddler-get" && args["meme"] !== true) return { has: `<<~ has name=\`${name}\`>>`, tiddler: { fields: { title: at, ...held }, hash: `sha256-${name}-${plainRev}` } };
      if (verb === "tiddler-put") {
        if (args["base"] !== undefined && args["base"] !== `sha256-${name}-${plainRev}`) return { decision: "conflict" };
        Object.assign(held, (args["fields"] ?? {}) as Record<string, string>);
        for (const gone of (args["unset"] ?? []) as string[]) delete held[gone];
        plainRev++;
        return { decision: "put", hash: `sha256-${name}-${plainRev}` };
      }
    }
    if (verb === "tiddler-get" && args["title"] === CARD && opts.card) return { has: "<<~ has name=`card`>>", tiddler: { fields: { title: CARD, ...opts.card }, hash: `sha256-card-${cardRev}` } };
    if (verb === "tiddler-get" && args["title"] === ALANA) return { tiddler: opts.offering ? { fields: { title: ALANA, ...opts.offering }, hash: "sha256-alana" } : null };
    if (verb === "tiddler-get") {
      if (isSide(args["title"])) return { tiddler: opts.side ? { fields: { title: args["title"], ...opts.side }, hash: "sha256-side" } : null };
      const o = other(args["title"]);
      if (o !== null) return { tiddler: { fields: { title: args["title"], "spirit-id": "fedcba987654", ...(opts.others![o]!.fields ?? {}) }, hash: "sha256-other" } };
      if (standing(args["title"])) return { tiddler: { fields: { title: args["title"], "spirit-id": ID, ...(opts.fields ?? {}) }, hash: "sha256-rec" } };
      if (String(args["title"]).startsWith("lar:///ha.ka.ba/lares/spirit/")) return { tiddler: opts.stray ? { fields: { title: args["title"], ...opts.stray }, hash: "sha256-stray" } : null };
      return { tiddler: { fields: { title: args["title"], text: "first words\nmore", ...(opts.residue?.[String(args["title"])] ?? {}) }, textHash: "sha256-ab" } };
    }
    if (isSlotPut(verb, args)) {
      if (patchConflicts > 0) { patchConflicts--; rev++; Object.assign(texts, opts.sibling ?? {}); return { decision: "conflict", canonicalHash: live() }; }
      // A slot's put checks its partial base against the family's live hash: a field put on the record since the read moves it.
      if (opts.patch === undefined && String(args["base"] ?? "").replace(/^(partial:#\/[^:]+|skinny):/, "") !== live()) return { decision: "conflict", canonicalHash: live() };
      if ((opts.patch ?? "put") === "put") rev++;
      return { decision: opts.patch ?? "put", hash: `sha256-slot-${rev}`, canonicalHash: live() };
    }
    // A whole shrine rides as its root's text put; the family founds there and the answer names its carrier hash.
    if (isShrinePut(verb, args)) return { decision: "put", created: true, hash: "sha256-shrine", canonicalHash: "sha256:" + "22".repeat(32) };
    if (verb === "tiddler-put" && args["title"] === CARD && opts.card) {
      if (args["base"] !== undefined && args["base"] !== `sha256-card-${cardRev}`) return { decision: "conflict" };
      Object.assign(opts.card, (args["fields"] ?? {}) as Record<string, string>);
      for (const gone of (args["unset"] ?? []) as string[]) delete opts.card[gone];
      cardRev++;
      return { decision: "put", hash: `sha256-card-${cardRev}` };
    }
    if (verb === "tiddler-put" && args["title"] === ALANA) {
      opts.offering = { ...(opts.offering ?? {}), ...((args["fields"] ?? {}) as Record<string, string>), ...(typeof args["text"] === "string" ? { text: args["text"] } : {}) };
      return { decision: "put" };
    }
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
/** A shrine slot's write: the plain put of the slot's own title (`<uri>#/x`) carrying its text. */
const isSlotPut = (verb: string, args: Record<string, unknown>): boolean => verb === "tiddler-put" && String(args["title"]).includes("#/") && typeof args["text"] === "string";
/** A whole shrine's landing: the plain put of the one address's root carrying the carrier as its text. */
const isShrinePut = (verb: string, args: Record<string, unknown>): boolean => verb === "tiddler-put" && String(args["title"]).startsWith("lar:///ha.ka.ba/lares/spirit/") && !String(args["title"]).includes("#") && typeof args["text"] === "string";
const slotPuts = () => h.calls.filter((c) => isSlotPut(c.verb, c.args));
const shrinePuts = () => h.calls.filter((c) => isShrinePut(c.verb, c.args));
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
    expect(row.verbs).toEqual(["help", "om", "ah", "hum", "otakiage", COMPACTION_WORD, "residue", "handback", "mandate", "summon"]);
    expect(row.accepts).toEqual(expect.arrayContaining(["add", "aperture", "base", "echo", "file", "fold", "grant", "key", "lane", "line", "mandate", "offer", "record", "slot", "text"]));
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
  test("the one address reads first; with none standing, familiar/<pet> answers on the default recipe at skinny grain", async () => {
    stage();
    const r = await run(argv(["om", "lares-alpha"]));
    expect(r.exit).toBe(0);
    expect(h.calls[0]).toEqual({ verb: "tiddler-get", args: { recipe: "default", title: ONE } });
    expect(h.calls[1]).toEqual({ verb: "tiddler-get", args: { recipe: "default", title: URI, meme: true, grain: "skinny" } });
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
    expect(error(r).message).toContain("lares get filter=");
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

  test("the wake names the latest landing by title and hash, so the instance checks what it inherited", async () => {
    const landing = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-0123456789ab`;
    stage({ titles: [landing, `${MEMORY_PREFIX}${COMPACTION_WORD}/lares-alpha-two-ba9876543210`], residue: { [landing]: { depth: "2", instance: "s-1" } } });
    const r = await run(argv(["om", "lares-alpha"]));
    expect(h.calls.find((c) => c.verb === "wiki-filter")!.args["filter"]).toBe(`[prefix[${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-]] [prefix[${MEMORY_PREFIX}${COMPACTION_WORD}/lares-alpha-]] +[!sort[landed]]`);
    expect(data(r)["latest"]).toBe(landing);
    expect(String(data(r)["text"])).toContain(`Latest ${COMPACTION_DISPLAY} (testimony, never mandate): ${landing} (hash 0123456789ab, depth 2, instance s-1)`);
  });

  test("an #/open past the cap cuts with a pointer to the whole slot", () => {
    const text = omText({ pet: "p", uri: URI, has: "has" }, { open: "x".repeat(20_000) });
    expect(text.length).toBeLessThanOrEqual(OM_CAP_CHARS);
    expect(text).toContain("#/open cut at the 9000-char wake cap");
  });
});

describe("ah trues one slot through the tiddler door's put on the slot's own title", () => {
  test("--text replaces the body under the slot's partial base", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "!! Open\n\n* trued" }));
    expect(r.exit).toBe(0);
    expect(slotPuts().at(-1)).toEqual({ verb: "tiddler-put", args: { recipe: "default", title: `${URI}#/open`, text: "!! Open\n\n* trued", base: `partial:#/open:${FULL}` } });
    expect((puts(SIDE).at(-1)!.args["fields"] as Record<string, string>)["writer-open"]).toBe("a hand at the terminal");
  });

  test("--add lands one line at the slot's end", async () => {
    stage({ instances: "!! Instances\n\n* one" });
    await run(argv(["ah", "lares-alpha"], { slot: "#/instances", add: "* two" }));
    expect(slotPuts().at(-1)!.args["text"]).toBe("!! Instances\n\n* one\n* two");
  });

  test("a stale --base never refuses: both versions land in a conflict stanza for hum to settle", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "y", base: "0000000000000000" }));
    expect(r.exit).toBe(0);
    expect(data(r)["conflict"]).toBe(true);
    expect(String(slotPuts()[0]!.args["text"])).toContain("!! conflict · #/open");
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
    expect(slotPuts().length > 0).toBe(false);
  });

  test("RED: a whole-slot write from a branch nothing attests names its base too; the gate reads the chain, never a mark alone", async () => {
    stage();
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "y" }), { hand: () => ({ refusal: "hand-unattested" }) as never });
    expect(error(r).code).toBe("spirit-base-needed");
    expect(slotPuts().length > 0).toBe(false);
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
    expect(slotPuts().length > 0).toBe(false);
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
    expect(slotPuts().length > 0).toBe(true);
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
    expect(slotPuts().length > 0).toBe(false);
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
    expect(error(r).message).toContain("#/entry #/open #/instances");
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
    stage({ instances: "!! Instances\n\n* one\n* two" });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/instances" }));
    expect(data(r)["lines"]).toEqual(["!! Instances", "", "* one", "* two"].map((text, i) => ({ n: i + 1, text, digest: digest(text) })));
  });

  test("the first fold of a month opens its ledger: the append names create, so the door's append-target-missing never answers", async () => {
    stage({ instances: "!! Instances\n\n* one\n* two" });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/instances", line: "3", expect: digest("* one") }));
    expect(r.exit).toBe(0);
    expect(puts(LEDGER)).toHaveLength(1);
    expect(puts(LEDGER)[0]!.args).toMatchObject({ create: true });
  });

  test("a ledger line carries a record's words redacted under the strict reading", async () => {
    stage({ instances: `!! Instances\n\n* token ghp_${"A".repeat(36)}\n* two` });
    await run(argv(["hum", "lares-alpha"], { fold: "#/instances", line: "3", expect: digest(`* token ghp_${"A".repeat(36)}`) }));
    const append = String(puts(LEDGER)[0]!.args["append"]);
    expect(append).not.toContain("ghp_");
  });

  test("--fold --line moves the line out of the record, then burns it to the month's ash ledger once the patch lands", async () => {
    stage({ instances: "!! Instances\n\n* one\n* two" });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/instances", line: "3", expect: digest("* one") }));
    expect(r.exit).toBe(0);
    const verbs = h.calls.map((c) => `${c.verb}:${String(c.args["title"] ?? c.args["uri"])}`);
    expect(verbs.indexOf(`tiddler-put:${URI}#/instances`)).toBeLessThan(verbs.indexOf(`tiddler-put:${LEDGER}`));
    expect(String(puts(LEDGER)[0]!.args["append"])).toContain("* one");
    expect(slotPuts().at(-1)!.args["text"]).toBe("!! Instances\n\n* two");
    expect((puts(SIDE).at(-1)!.args["fields"] as Record<string, string>)["distilled"]).toBe("2026-11-24T12:00:00.000Z");
  });

  test("--line names the listed line's digest (--expect); a sibling's fold between the listing and this fold refuses spirit-fold-gone", async () => {
    stage({ instances: "!! Instances\n\n* one\n* two" });
    const listed = (data(await run(argv(["hum", "lares-alpha"], { fold: "#/instances" })))["lines"] as Array<{ n: number; text: string; digest: string }>)[2]!;
    expect(listed.text).toBe("* one");
    stage({ instances: "!! Instances\n\n* two" });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/instances", line: "3", expect: listed.digest }));
    expect(error(r).code).toBe("spirit-fold-gone");
    expect(slotPuts().length > 0).toBe(false);
    const bare = await run(argv(["hum", "lares-alpha"], { fold: "#/instances", line: "3" }));
    expect(bare.exit).toBe(2);
  });

  test("a ledger that refuses past its retries after a landed fold puts the line back in the slot and names it", async () => {
    stage({ instances: "!! Instances\n\n* one\n* two", ledgerRefuse: 5 });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/instances", line: "3", expect: digest("* one") }));
    expect(error(r).code).toBe("spirit-ashes-refused");
    expect(error(r).message).toContain("returned to the slot");
    expect(puts(LEDGER)).toHaveLength(3);
    const patches = slotPuts().map((c) => String(c.args["text"]));
    expect(patches).toEqual(["!! Instances\n\n* two", "!! Instances\n\n* one\n* two\n* one"]);
  });

  test("a ledger that refuses once retries and lands", async () => {
    stage({ instances: "!! Instances\n\n* one\n* two", ledgerRefuse: 1 });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/instances", line: "3", expect: digest("* one") }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(puts(LEDGER)).toHaveLength(2);
  });

  test("a blank line refuses as usage and names the listing", async () => {
    stage({ instances: "!! Instances\n\n* one" });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/instances", line: "2" }));
    expect(r.exit).toBe(2);
    expect(h.calls.some((c) => c.verb === "tiddler-put")).toBe(false);
  });
});

describe("the compaction verb and residue land after the strict secret-shape guard", () => {
  test("a carry lands at <word>/<spirit-id>-<hash12> with its lineage, writes nothing to the card, and hands back the #/instances line", async () => {
    stage();
    const r = await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "the summary\nclosing\n* a loop" }));
    expect(r.exit).toBe(0);
    const title = String(data(r)["title"]);
    expect(title).toMatch(new RegExp(`^${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-[0-9a-f]{12}$`));
    expect(puts(title)[0]!.args).toMatchObject({ create: true, text: "the summary\nclosing\n* a loop", fields: { landed: "2026-11-24T12:00:00.000Z", "spirit-id": ID, parent: "", depth: "1", "record-base": FULL } });
    expect(slotPuts().length > 0).toBe(false);
    expect(puts(URI)).toHaveLength(0);
    expect(data(r)["filed"]).toBe(false);
    expect(data(r)["instancesLine"]).toBe(`* ''2026-11-24 (${COMPACTION_DISPLAY} ${title.slice(-12)}) lares-alpha:'' ${title}`);
    expect(String(data(r)["unfiled"])).toContain("lares spirit ah lares-alpha --slot '#/instances' --add");
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
    const r = await run(argv(["residue", "om-wright"], { text: "Om-Wright (Lares Spirit) — PR #600" }));
    expect(String(data(r)["title"])).toMatch(new RegExp(`^${MEMORY_PREFIX}spirit/om-wright-handback-[0-9a-f]{12}$`));
  });

});

describe("handback: the one return door every fire runs", () => {
  const BACK = `${MEMORY_PREFIX}spirit/om-wright-handback-0123456789ab`;
  /** A record standing at `BACK` under a live hash, over the stage's own answers. */
  function standingRecord(hash = "sha256-back") {
    const base = h.answer;
    h.answer = (verb, args) => (verb === "tiddler-get" && args["title"] === BACK ? { tiddler: { fields: { title: BACK, text: "a report" }, hash } } : base(verb, args));
  }
  const edgeSeam = () => {
    const asks: Array<Record<string, unknown>> = [];
    const putsAtAsk: number[] = [];
    const edge = async (ask: Record<string, unknown>) => {
      asks.push(ask);
      putsAtAsk.push(h.calls.filter((c) => c.verb === "tiddler-put").length);
      return { edge: `${MEMORY_PREFIX}summons/0123456789abcdef`, offerer: "hand", decision: "put" as const, lane: "none" as const };
    };
    return { asks, putsAtAsk, edge };
  };

  test("a report lands as the same residue `residue` lands, under the pet's own name, and no edge answers a pet alone", async () => {
    stage();
    const seam = edgeSeam();
    const back = await run(argv(["handback", "om-wright"], { text: "Om-Wright (Lares Spirit)\nreport" }), { edge: seam.edge });
    expect(back.exit).toBe(0);
    const title = String(data(back)["record"]);
    expect(title).toMatch(new RegExp(`^${MEMORY_PREFIX}spirit/om-wright-handback-[0-9a-f]{12}$`));
    expect(puts(title)[0]!.args).toMatchObject({ create: true, text: "Om-Wright (Lares Spirit)\nreport", fields: { pet: "om-wright", landed: "2026-11-24T12:00:00.000Z" } });
    expect(data(back)).toMatchObject({ pet: "om-wright", instance: null, landed: "put", edge: null });
    expect(seam.asks).toEqual([]);
    const residue = await run(argv(["residue", "om-wright"], { text: "Om-Wright (Lares Spirit)\nreport" }));
    expect(data(residue)["title"]).toBe(title);
    expect(h.calls.some((c) => c.args["title"] === URI)).toBe(false);
  });

  test("the same hand-back lands once: a key the line names, else the instance's tag, else the words alone", async () => {
    stage();
    const alone = String(data(await run(argv(["handback", "om-wright"], { text: "report" })))["record"]);
    const two = await run(argv(["handback", "om-wright#2"], { text: "report" }));
    const twoAgain = await run(argv(["handback", "om-wright#2"], { text: "report" }));
    const three = await run(argv(["handback", "om-wright#3"], { text: "report" }));
    const keyed = await run(argv(["handback", "om-wright#2"], { text: "report", key: "s-1:agent-1" }));
    const hooked = await run(argv(["residue", "om-wright"], { text: "report", key: "s-1:agent-1" }));
    expect(data(two)["record"]).toBe(data(twoAgain)["record"]);
    expect(new Set([alone, data(two)["record"], data(three)["record"], data(keyed)["record"]]).size).toBe(4);
    expect(data(keyed)["record"]).toBe(data(hooked)["title"]);
    expect(data(two)["instance"]).toBe("om-wright#2");
    expect(puts(String(data(two)["record"]))[0]!.args).toMatchObject({ fields: { pet: "om-wright", instance: "2" } });
    stage({ put: "exists" });
    const again = await run(argv(["handback", "om-wright#2"], { text: "report" }));
    expect(again.exit).toBe(0);
    expect(data(again)["landed"]).toBe("exists");
  });

  test("the record stands first, then the instance's summons edge names it", async () => {
    stage();
    const seam = edgeSeam();
    const r = await run(argv(["handback", "om-wright#2"], { text: "report" }), { edge: seam.edge });
    expect(r.exit).toBe(0);
    expect(seam.asks).toEqual([{ pet: "om-wright", instance: "2", tag: "om-wright#2", record: data(r)["record"], mandate: null }]);
    expect(seam.putsAtAsk).toEqual([1]);
    expect(data(r)["edge"]).toMatchObject({ offerer: "hand", decision: "put", lane: "none" });
  });

  test("a hand-back no edge answers lands all the same; only a line naming its mandate refuses, and its record stays", async () => {
    stage();
    const free = await run(argv(["handback", "om-wright#2"], { text: "report" }));
    expect(free.exit).toBe(0);
    expect(data(free)["edge"]).toBeNull();
    h.calls.length = 0;
    const named = await run(argv(["handback", "om-wright#2"], { text: "report", mandate: `${MEMORY_PREFIX}mandate/0123456789abcdef@${"ab".repeat(32)}` }));
    expect(named.exit).toBe(4);
    expect(error(named).code).toBe("summons-unknown");
    expect(error(named).message).toMatch(/the hand-back itself stands at .*om-wright-handback-[0-9a-f]{12}/);
    expect(error(named).message).toContain("lares spirit handback 'om-wright#2' --record");
    expect(h.calls.filter((c) => c.verb === "tiddler-put")).toHaveLength(1);
  });

  test("--record names a record already landed: read through the door, nothing written, the edge handed its address", async () => {
    stage();
    standingRecord();
    const seam = edgeSeam();
    const r = await run(argv(["handback", "om-wright#2"], { record: `${BACK}@sha256-back` }), { edge: seam.edge });
    expect(r.exit).toBe(0);
    expect(data(r)).toMatchObject({ record: BACK, landed: "standing", hash: "sha256-back" });
    expect(h.calls.some((c) => c.verb === "tiddler-put")).toBe(false);
    expect(seam.asks[0]).toMatchObject({ record: BACK, tag: "om-wright#2" });
    expect((await run(argv(["handback", "om-wright"], { record: BACK }))).exit).toBe(0);
  });

  test("--record refuses by name where no record stands, or where it reads another hash than the line names, and the edge never hears of it", async () => {
    stage();
    const seam = edgeSeam();
    const gone = await run(argv(["handback", "om-wright#2"], { record: BACK }), { edge: seam.edge });
    expect(error(gone).code).toBe("handback-unknown");
    expect(error(gone).message).toContain("lares spirit handback 'om-wright#2' --file <path|->");
    standingRecord("sha256-moved");
    const moved = await run(argv(["handback", "om-wright#2"], { record: `${BACK}@sha256-back` }), { edge: seam.edge });
    expect(error(moved).code).toBe("handback-moved");
    expect(error(moved).message).toContain("lares get title=");
    expect(seam.asks).toEqual([]);
    expect(h.calls.some((c) => c.verb === "tiddler-put")).toBe(false);
  });

  test("the strict guard reads a hand-back as it reads residue: a secret-shaped report lands nothing and closes no edge", async () => {
    stage();
    const seam = edgeSeam();
    const r = await run(argv(["handback", "om-wright#2"], { text: "token ghp_" + "A".repeat(36) }), { edge: seam.edge });
    expect(error(r).code).toBe("spirit-secret-shaped");
    expect(h.calls).toEqual([]);
    expect(seam.asks).toEqual([]);
  });

  test("a line names exactly one return and a well-formed returner", async () => {
    stage();
    expect((await run(argv(["handback", "om-wright"]))).exit).toBe(2);
    expect((await run(argv(["handback", "om-wright"], { text: "report", record: BACK }))).exit).toBe(2);
    expect((await run(argv(["handback", "om-wright#bad instance"], { text: "report" }))).exit).toBe(2);
    expect((await run(argv(["handback", "om-wright"], { record: "not-a-lar-address" }))).exit).toBe(2);
    expect(error(await run(argv(["handback", "Om Wright"], { text: "report" }))).code).toBe("spirit-pet-malformed");
    expect(h.calls).toEqual([]);
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

describe("fork the instance, fence the card", () => {
  const LEASE = { lease: "inst-a 3 2026-11-24T11:00:00.000Z" };
  test("om --instance from another instance raises the epoch; the holding instance keeps it", async () => {
    stage({ side: LEASE });
    const other = await run(argv(["om", "lares-alpha"], { instance: "inst-b" }));
    expect(data(other)["epoch"]).toBe(4);
    expect(String((puts(SIDE).find((c) => (c.args["fields"] as Record<string, string> | undefined)?.["lease"])!.args["fields"] as Record<string, string>)["lease"])).toMatch(/^inst-b 4 /);
    h.calls.length = 0;
    const same = await run(argv(["om", "lares-alpha"], { instance: "inst-a" }));
    expect(data(same)["epoch"]).toBe(3);
    expect(puts(SIDE).filter((c) => (c.args["fields"] as Record<string, string> | undefined)?.["lease"])).toHaveLength(0);
  });

  test("the epoch orders instances and never refuses: an AI seat's write bearing a stale epoch, or none, lands", async () => {
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

  test("inside its own compaction's crossing, an instance's ah refuses spirit-crossing (advisory, by name); a bare mark (no instance) lets it land; no timer lifts one", async () => {
    stage({ side: { crossing: "inst-a00 2026-11-24T11:58:00.000Z" } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* y", instance: "inst-a00" }));
    expect(error(r).code).toBe("spirit-crossing");
    expect(error(r).message).toContain("advisory");
    for (const at of ["2026-11-24T11:00:00.000Z", "1976-11-24T11:00:00.000Z", "2076-11-24T11:00:00.000Z"]) {
      stage({ side: { crossing: `inst-a00 ${at}` } });
      expect(error(await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* y", instance: "inst-a00" }))).code).toBe("spirit-crossing");
      expect(error(await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* y", instance: "inst-a00" }), { now: () => new Date("2076-11-24T12:00:00Z") })).code).toBe("spirit-crossing");
    }
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
    expect(String(data(r)["text"])).toMatch(/^Lares spirit om · lares-alpha: this instance resumes; the card reads f5f5f5f5f5f5 now, and an earlier wake may read stale/);
    expect(String(data(r)["text"]).split("\n")).toHaveLength(1);
  });

  test("om reads past an owed presence stamp: the card renders whole and the testimony names the stamp that waits", async () => {
    stage({ side: { lease: "inst-a 1 2026-11-24T11:00:00.000Z" } });
    const band = { band: "owed", documents: [{ documentId: "4Z7nNfywXcoGg7zH8y3fUGqCgqBK", refusal: "save-unsealed", error: "record-refused", cause: "signer-refused" }] };
    h.restFor = (verb, args) => (verb === "tiddler-put" && args["title"] === SIDE ? band : null);
    try {
      const r = await run(argv(["om", "lares-alpha"], { source: "startup", instance: "inst-b" }));
      expect(r.exit).toBe(0);
      expect(r.printed["ok"]).toBe(true);
      const text = String(data(r)["text"]);
      expect(text).toContain("a loop");
      expect(text).toContain("This wake's own stamp waits unsealed (the card below reads whole): owed:");
      expect(text).toContain("4Z7nNfywXcoG");
      const owed = data(r)["owed"] as string[];
      expect(owed.length).toBeGreaterThan(0);
      expect(owed.every((line) => line.startsWith("owed: "))).toBe(true);
    } finally { h.restFor = () => null; }
  });

  test("outside the wake's own stamps, a spirit write the vessel answers owed refuses owed (exit 6)", async () => {
    stage({});
    const band = { band: "owed", documents: [{ documentId: "2hUgpNYoRGAkCcCXTgZGecaQBXsp", refusal: "save-unsealed" }] };
    h.restFor = (verb) => (verb === "tiddler-put" ? band : null);
    try {
      const r = await run(argv(["ah", "lares-alpha"], { slot: "#/instances", add: "* two" }));
      expect(r.exit).toBe(6);
      expect(r.printed).toMatchObject({ ok: false, error: { code: "owed" } });
    } finally { h.restFor = () => null; }
  });

  test("a fork wakes framed as a fork, holding the raised epoch", async () => {
    stage({ side: { lease: "inst-a 1 2026-11-24T11:00:00.000Z" } });
    const r = await run(argv(["om", "lares-alpha"], { source: "fork", instance: "inst-b" }));
    expect(String(data(r)["text"])).toMatch(/^You wake as a fork: another instance may still wear lares-alpha, and both write the one card \(wake epoch 2\)/);
  });

  test("a compaction names the carry it inherits by hash and first words", async () => {
    stage({ titles: [carry], residue: { [carry]: { text: "the instance line of the last carry", depth: "1" } } });
    const r = await run(argv(["om", "lares-alpha"], { source: "compact" }));
    expect(String(data(r)["text"])).toContain(`This instance inherits ${carry} (hash 0123456789ab): "the instance line of the last carry"`);
  });

  test("a precompact marks the crossing and hands back the record's carry-shape", async () => {
    stage({ slotTexts: { "#/carry-shape": "!! The carry's shape\n\nkeep what only this instance knew" } });
    const r = await run(argv(["om", "lares-alpha"], { source: "precompact", instance: "inst-p00" }));
    expect(data(r)["carryShape"]).toBe("!! The carry's shape\n\nkeep what only this instance knew");
    expect((puts(SIDE).find((c) => (c.args["fields"] as Record<string, string> | undefined)?.["crossing"])!.args["fields"] as Record<string, string>)["crossing"]).toBe("inst-p00 2026-11-24T12:00:00.000Z 1");
  });

  test("a precompact crossing reads #/kulana beside #/open", async () => {
    stage({ slotTexts: { "#/open": "!! Open\n\nloop-one", "#/kulana": "!! Kūlana\n\nposture-one" } });
    const r = await run(argv(["om", "lares-alpha"], { source: "precompact", instance: "inst-p00" }));
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
    for (const slot of ["#/entry", "#/orders", "#/grant", "#/attention", "#/open", "#/kulana", "#/carry-shape", "#/instances"]) expect(text).toContain(`slot=\`${slot}\``);
    expect(text).toContain("lares spirit ah lares-awakens --new --file -");
    expect(text).not.toContain("#/voice");
  });

  test("ah --new wraps the slot blocks in the house frame, reseals, and lands it once", async () => {
    stage({ kind: "none" });
    const withFlag = { command: "spirit", positional: ["ah", "lares-awakens"], options: { text: "<<~ ahu slot=`#/entry`>>\n\n! Lares-Awakens\n\n<<~/ahu>>" }, flags: { json: true, new: true } } as unknown as ParsedArgs;
    h.calls.length = 0;
    const landed = await run(withFlag);
    expect(landed.exit).toBe(0);
    const put = shrinePuts()[0]!;
    expect(put.args["title"]).toBe("lar:///ha.ka.ba/lares/spirit/lares-awakens");
    expect(String(put.args["text"])).toMatch(/^<<!DOCTYPE/);
    expect(String(put.args["text"])).toMatch(/<<\^ code=`&#x0003;` bcc=`ni:\/\/\/sha-256;[A-Za-z0-9_-]+`>>/);
  });

  test("ah --new where a record stands refuses spirit-exists and names the slot write", async () => {
    stage();
    const r = await run({ command: "spirit", positional: ["ah", "lares-alpha"], options: { text: "x" }, flags: { json: true, new: true } } as unknown as ParsedArgs);
    expect(error(r).code).toBe("spirit-exists");
    expect(shrinePuts().length > 0).toBe(false);
  });
});

describe("the carry lands with its lineage", () => {
  const parent = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-0123456789ab`;
  test("parent, depth, record-base and instance ride the carry, and the instances line it hands back names pet#body8", async () => {
    stage({ titles: [parent], residue: { [parent]: { depth: "2", instance: "0123456789abcdef" } } });
    const r = await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "the summary", instance: "0123456789abcdef" }));
    const title = String(data(r)["title"]);
    expect(puts(title)[0]!.args["fields"]).toMatchObject({ parent: "0123456789ab", depth: "3", instance: "0123456789abcdef", "record-base": FULL });
    expect(String(data(r)["instancesLine"])).toContain(`lares-alpha#01234567:'' ${title}`);
  });

  test("a waking instance ends the crossing the compaction marked", async () => {
    stage({ side: { crossing: "inst-c00 2026-11-24T11:59:00.000Z" } });
    await run(argv(["om", "lares-alpha"], { source: "compact", instance: "inst-c00" }));
    expect(puts(SIDE).some((c) => (c.args["unset"] as string[] | undefined)?.includes("crossing"))).toBe(true);
  });

  test("a resumed instance ends its own crossing too, and a sibling's mark stands", async () => {
    stage({ side: { crossing: "inst-c00 2026-11-24T11:59:00.000Z 1\ninst-d00 2026-11-24T11:59:00.000Z 2" } });
    await run(argv(["om", "lares-alpha"], { source: "resume", instance: "inst-c00" }));
    const left = puts(SIDE).map((c) => (c.args["fields"] as Record<string, string> | undefined)?.["crossing"]).filter(Boolean).at(-1);
    expect(left).toBe("inst-d00 2026-11-24T11:59:00.000Z 2");
  });

  test("a crashed instance's refusal names the hand cure, and the hand's om clears it", async () => {
    stage({ side: { crossing: "inst-a00 2026-11-24T11:58:00.000Z 1" } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* y", instance: "inst-a00" }));
    expect(error(r).message).toContain("lares spirit om lares-alpha --instance inst-a00");
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
    stage({ instances: "!! Instances\n\n* one\n* two\n* three" });
    const mocked = h.answer;
    h.answer = (verb, args) => verb === "tiddler-put" && String(args["title"]).startsWith(`${MEMORY_PREFIX}state/ashes-`) ? real.put(args) : mocked(verb, args);
    const first = await run(argv(["hum", "lares-alpha"], { fold: "#/instances", line: "3", expect: digest("* one") }));
    expect(first.exit, JSON.stringify(first.printed)).toBe(0);
    const second = await run(argv(["hum", "lares-alpha"], { fold: "#/instances", line: "4", expect: digest("* two") }));
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
    expect(String(data(r)["text"])).toContain("A rename renames, never retargets: this instance stays lares-alpha");
  });
});

describe("each familiar its own: a fresh instance's title names its own familiar; a held instance's title renames", () => {
  test("a fresh startup instance whose title no record answers prints the starter as an offer for the title's slug, never the seated card", async () => {
    stage();
    const r = await run(argv(["om", "lares-alpha"], { title: "Lares-Awakens", instance: "s-new" }));
    expect(data(r)["pet"]).toBe("lares-awakens");
    expect([data(r)["starter"], data(r)["offer"]]).toEqual([true, true]);
    expect(String(data(r)["text"])).toContain("An offer, never a seat");
    expect(String(data(r)["text"])).toContain("Lares spirit om · lares-awakens: no record answers this pet name yet");
    expect(String(data(r)["text"])).not.toContain("A rename renames");
    expect(puts(URI)).toHaveLength(0);
  });

  test("a fork's title counts only where it names a standing record: no record, and the fork wakes the pet it was handed", async () => {
    stage();
    const r = await run(argv(["om", "lares-alpha"], { title: "Lares-Awakens", instance: "s-fork", source: "fork" }));
    expect(data(r)["pet"]).toBe("lares-alpha");
    expect(data(r)["starter"]).toBeUndefined();
  });

  test("a fresh instance whose title's slug names a standing familiar wakes that familiar", async () => {
    stage({ others: { "lares-awakens": {} } });
    const r = await run(argv(["om", "lares-alpha"], { title: "Lares-Awakens", instance: "s-new" }));
    expect(data(r)["pet"]).toBe("lares-awakens");
    expect(data(r)["turnedFrom"]).toBe("lares-alpha");
  });

  test("--held never switches: a title another record names as its own reads as an offer", async () => {
    stage({ others: { "lares-awakens": { fields: { aliases: "Lares-Awakens" } } } });
    const r = await run({ ...argv(["om", "lares-alpha"], { title: "Lares-Awakens", instance: "s-held", source: "compact" }), flags: { json: true, held: true } } as unknown as ParsedArgs);
    expect(data(r)["pet"]).toBe("lares-alpha");
    expect(data(r)["turnedFrom"]).toBeUndefined();
    expect(String(data(r)["text"])).toContain("a title only proposes, so this wake stays lares-alpha");
  });

  test("--held with a title no record answers reads the rename of the held familiar", async () => {
    stage();
    const r = await run({ ...argv(["om", "lares-alpha"], { title: "Kahu Night", instance: "s-held" }), flags: { json: true, held: true } } as unknown as ParsedArgs);
    expect(data(r)["pet"]).toBe("lares-alpha");
    expect(String(data(r)["text"])).toContain("A rename renames, never retargets: this instance stays lares-alpha");
  });

  test("the prefix guard stands: a title extending the pet's own name reads as that pet", async () => {
    stage();
    const r = await run(argv(["om", "lares-alpha"], { title: "lares-alpha wakes", instance: "s-new" }));
    expect(data(r)["pet"]).toBe("lares-alpha");
    expect(data(r)["starter"]).toBeUndefined();
  });

  test("a title whose slug runs past a pet name's 62 chars names no familiar, and the wake says so", async () => {
    stage();
    const r = await run(argv(["om", "lares-alpha"], { title: "x".repeat(70), instance: "s-new" }));
    expect(data(r)["pet"]).toBe("lares-alpha");
    expect(String(data(r)["text"])).toContain("runs 70 chars, past the 62 a pet name holds");
  });
});

describe("bunrei: many instances wear one pet, and none locks another out", () => {
  test("the crossing runs per instance: instance A's PreCompact mark holds A's own writes, and instance B's ah lands", async () => {
    stage({ side: { crossing: "inst-a00 2026-11-24T11:58:00.000Z" } });
    const b = await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* b's line", instance: "inst-b00" }));
    expect(b.exit, JSON.stringify(b.printed)).toBe(0);
    const unnamed = await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* a hand's line" }));
    expect(unnamed.exit).toBe(0);
    const a = await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* a's line", instance: "inst-a00" }));
    expect(error(a).code).toBe("spirit-crossing");
    expect(error(a).message).toContain("#inst-a00");
    const fold = await run(argv(["hum", "lares-alpha"], { fold: "#/open", line: "3", instance: "inst-b00", expect: digest("* a loop") }));
    expect(fold.exit, JSON.stringify(fold.printed)).toBe(0);
  });

  test("a precompact marks only its own instance's crossing, keeping a sibling's; that instance's next wake clears only its own", async () => {
    stage({ side: { crossing: "inst-a00 2026-11-24T11:58:00.000Z" } });
    await run(argv(["om", "lares-alpha"], { source: "precompact", instance: "inst-b00" }));
    const marked = puts(SIDE).map((c) => (c.args["fields"] as Record<string, string> | undefined)?.["crossing"]).filter(Boolean).at(-1)!;
    expect(marked).toContain("inst-a00 2026-11-24T11:58:00.000Z");
    expect(marked).toContain("inst-b00 2026-11-24T12:00:00.000Z");
    h.calls.length = 0;
    stage({ side: { crossing: "inst-a00 2026-11-24T11:58:00.000Z\ninst-b00 2026-11-24T11:59:00.000Z" } });
    await run(argv(["om", "lares-alpha"], { source: "compact", instance: "inst-b00" }));
    const left = puts(SIDE).map((c) => (c.args["fields"] as Record<string, string> | undefined)?.["crossing"]).filter(Boolean).at(-1);
    expect(left).toBe("inst-a00 2026-11-24T11:58:00.000Z 0");
  });

  test("the carry's handed-back line names the instance, so its own crossing reaches its own writes", async () => {
    stage();
    const r = await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "the summary", instance: "inst-b00" }));
    expect(String(data(r)["unfiled"])).toContain("--instance inst-b00");
  });

  test("a waking instance adds itself to instances-awake, drops none by age, and om names each sibling awake", async () => {
    stage({ side: { "instances-awake": "lares-alpha#inst-a00 2026-11-24T11:50:00.000Z\nlares-alpha#inst-old 2026-11-24T10:00:00.000Z" } });
    const r = await run(argv(["om", "lares-alpha"], { instance: "inst-b00-long" }));
    expect(String(data(r)["text"])).toContain("3 instances wear lares-alpha: #inst-b00 (you), #inst-a00 since 11:50, #inst-old since 10:00");
    const awake = puts(SIDE).map((c) => (c.args["fields"] as Record<string, string> | undefined)?.["instances-awake"]).filter(Boolean).at(-1)!;
    expect(awake).toContain("lares-alpha#inst-a00 2026-11-24T11:50:00.000Z");
    expect(awake).toContain("lares-alpha#inst-b00-long 2026-11-24T12:00:00.000Z 1");
    expect(awake).toContain("lares-alpha#inst-old 2026-11-24T10:00:00.000Z");
  });

  test("an ah naming an instance refreshes its presence; a clock skewed 50 years drops no sibling", async () => {
    stage({ side: { "instances-awake": "lares-alpha#inst-a00 2026-11-24T11:50:00.000Z" } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* y", instance: "inst-b00" }), { now: () => new Date("2076-11-24T12:00:00Z") });
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const awake = String(puts(SIDE).map((c) => (c.args["fields"] as Record<string, string> | undefined)?.["instances-awake"]).filter(Boolean).at(-1));
    expect(awake).toContain("lares-alpha#inst-b00 2076-11-24T12:00:00.000Z 1");
    expect(awake).toContain("lares-alpha#inst-a00 2026-11-24T11:50:00.000Z");
  });

  test("two instances add #/open lines at once: the later re-reads past the conflict and both lines survive", async () => {
    stage({ open: "!! Open\n\n* a loop", patchConflicts: 1, sibling: { "#/open": "!! Open\n\n* a loop\n* instance a's line" } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* instance b's line" }), { hand: AI });
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const patches = slotPuts();
    expect(String(patches.at(-1)!.args["text"])).toBe("!! Open\n\n* a loop\n* instance a's line\n* instance b's line");
  });

  test("a whole-slot replace whose slot moved under it lands both versions in a conflict stanza naming this instance and the last writer", async () => {
    stage({ open: "!! Open\n\n* a loop", patchConflicts: 1, sibling: { "#/open": "!! Open\n\n* instance a rewrote it" }, side: { "writer-open": "lares-alpha#inst-a00" } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "!! Open\n\n* instance b rewrote it", instance: "inst-b00", base: digest(OPEN) }), { hand: AI });
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const landed = String(slotPuts().at(-1)!.args["text"]);
    expect(landed).toContain("conflict");
    expect(landed).toContain("#inst-b00");
    expect(landed).toContain("lares-alpha#inst-a00 wrote");
    expect(landed).toContain("* instance b rewrote it");
    expect(landed).toContain("* instance a rewrote it");
    expect(data(r)["conflict"]).toBe(true);
  });

  test("a whole-slot replace whose slot held still past a conflict elsewhere retries plain", async () => {
    stage({ open: "!! Open\n\n* a loop", patchConflicts: 1, sibling: { "#/instances": "!! Instances\n\n* one\n* two" } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "!! Open\n\n* mine" }));
    expect(r.exit).toBe(0);
    expect(String(slotPuts().at(-1)!.args["text"])).toBe("!! Open\n\n* mine");
  });

  test("hooili lineage runs per instance: a carry's parent reads that instance's own last carry, never a sibling's", async () => {
    const a = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-aaaaaaaaaaaa`;
    const b = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-bbbbbbbbbbbb`;
    stage({ titles: [a, b], residue: { [a]: { instance: "inst-a00", depth: "4", landed: "2026-11-24T11:59:00.000Z" }, [b]: { instance: "inst-b00", depth: "1", landed: "2026-11-24T11:00:00.000Z" } } });
    const r = await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "the summary", instance: "inst-b00" }));
    expect([data(r)["parent"], data(r)["depth"]]).toEqual([b, 2]);
  });

  test("a wake writes nothing to the card: presence, epoch and crossing ride the sibling record, so om's base holds for the next write", async () => {
    stage({ side: { lease: "inst-a 3 2026-11-24T11:00:00.000Z", crossing: "inst-b00 2026-11-24T11:59:00.000Z" } });
    const woke = await run(argv(["om", "lares-alpha"], { instance: "inst-b00" }));
    await run(argv(["om", "lares-alpha"], { source: "precompact", instance: "inst-b00" }));
    expect(puts(URI)).toHaveLength(0);
    expect(puts(SIDE).length).toBeGreaterThan(0);
    h.calls.length = 0;
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "!! Open\n\n* mine", base: digest(OPEN), instance: "inst-c00" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const patches = slotPuts();
    expect(patches).toHaveLength(1);
    expect(String(patches[0]!.args["base"])).toContain(String(data(woke)["base"]).replace(/^skinny:/, ""));
  });

  test("om hands back each slot's digest; a stale view's whole replace after a sibling's add lands a stanza, never a clobber", async () => {
    stage();
    const woke = await run(argv(["om", "lares-alpha"], { instance: "inst-b00" }));
    const seen = (data(woke)["digests"] as Record<string, string>)["#/open"]!;
    expect(seen).toBe(digest(OPEN));
    stage({ open: `${OPEN}\n* a sibling's added line` });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "!! Open\n\n* my rewrite", base: seen, instance: "inst-b00" }), { hand: AI });
    expect(data(r)["conflict"]).toBe(true);
    const landed = String(slotPuts().at(-1)!.args["text"]);
    expect(landed).toContain("* a sibling's added line");
    expect(landed).toContain("* my rewrite");
  });

  test("a stanza over a standing stanza flattens, never nests", async () => {
    const standing = "!! conflict · #/open: two instances wrote this slot whole at once; settle it with hum (fold the lines that lose)\n\n''lares-alpha#aaaa wrote:''\n\n* a\n\n''lares-alpha#bbbb wrote:''\n\n* b\n\n!! end conflict";
    stage({ open: standing });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "* c", base: "0000000000000000", instance: "cccc" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const landed = String(slotPuts().at(-1)!.args["text"]);
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
    stage({ instances: "!! Instances\n\n* one\n* two", patchConflicts: 1, sibling: { "#/instances": "!! Instances\n\n* zero\n* one\n* two" } });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/instances", line: "3", expect: digest("* one") }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(String(slotPuts().at(-1)!.args["text"])).toBe("!! Instances\n\n* zero\n* two");
    expect(puts(LEDGER)).toHaveLength(1);
    const order = h.calls.map((c) => isSlotPut(c.verb, c.args) ? "patch" : c.args["title"] === LEDGER ? "ash" : "").filter(Boolean);
    expect(order).toEqual(["patch", "patch", "ash"]);
  });

  test("an instance with no chain of its own takes the newest carry as its parent", async () => {
    const a = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-aaaaaaaaaaaa`;
    stage({ titles: [a], residue: { [a]: { instance: "inst-a00", depth: "2" } } });
    const r = await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "the summary", instance: "inst-new" }));
    expect([data(r)["parent"], data(r)["depth"]]).toEqual([a, 3]);
  });

  test("instances-awake keeps at most 16 entries, by count", async () => {
    const many = Array.from({ length: 20 }, (_, i) => `lares-alpha#inst-${String(i).padStart(2, "0")} 2026-11-24T11:${String(30 + i).padStart(2, "0")}:00.000Z ${i + 1}`).join("\n");
    stage({ side: { "instances-awake": many } });
    await run(argv(["om", "lares-alpha"], { instance: "inst-me" }));
    const awake = String(puts(SIDE).map((c) => (c.args["fields"] as Record<string, string> | undefined)?.["instances-awake"]).filter(Boolean).at(-1));
    expect(awake.split("\n")).toHaveLength(16);
    expect(awake).toContain("lares-alpha#inst-me ");
    expect(awake).toContain("lares-alpha#inst-19 ");
    expect(awake).not.toContain("lares-alpha#inst-00 ");
  });

  test("a inst-less om reads the presence off the sibling record", async () => {
    stage({ side: { "instances-awake": "lares-alpha#inst-a00 2026-11-24T11:50:00.000Z" } });
    const r = await run(argv(["om", "lares-alpha"]));
    expect(String(data(r)["text"])).toContain("1 instance wears lares-alpha: #inst-a00 since 11:50");
    expect(puts(SIDE)).toHaveLength(0);
  });

  test("om shows each live instance's chain: its last carry", async () => {
    const a = `${MEMORY_PREFIX}${COMPACTION_WORD}/${ID}-aaaaaaaaaaaa`;
    stage({ side: { "instances-awake": "lares-alpha#inst-a00-full 2026-11-24T11:50:00.000Z" }, titles: [a], residue: { [a]: { instance: "inst-a00-full", depth: "2" } } });
    const r = await run(argv(["om", "lares-alpha"], { instance: "inst-b00" }));
    expect(String(data(r)["text"])).toContain(`#inst-a00's chain: ${a}`);
  });
});

describe("om and hum answer the spirit as a folded carrier the wiki renders", () => {
  const renders = () => h.calls.filter((c) => c.verb === "wiki-render");
  const call = (rank: string, face = "") => ({ verb: "wiki-render", args: { recipe: "default", text: `<<spirit-unfold pet:"lares-alpha" aperture:"${rank}"${face}>>`, form: "text", maxBytes: 262_144 } });

  test("a wiki whose skin answers no fold wakes on the door's own card and names the read that shows it", async () => {
    stage();
    const r = await run(argv(["om", "lares-alpha"]));
    expect(r.exit).toBe(0);
    expect(renders()).toEqual([call("measure")]);
    const text = String(data(r)["text"]);
    expect(text).toContain("<<~ has name=`rec`>>");
    expect(text).toContain("* a loop");
    expect(text).toContain("lares get filter='[[lar:///ha.ka.ba/lararium/tw5/filters/meme-fold]is[shadow]]'");
    expect(data(r)).toMatchObject({ aperture: "measure", folded: false, unfolded: "absent" });
  });

  test("a render door that refuses never fails the wake: om and hum read unfolded and carry the refusal's words", async () => {
    stage({ carrier: () => { throw new Error("cap-denied: read on lar:///ha.ka.ba/wikis/daemon/working required"); } });
    const om = await run(argv(["om", "lares-alpha"]));
    expect(om.exit, JSON.stringify(om.printed)).toBe(0);
    const text = String(data(om)["text"]);
    expect(text).toContain("* a loop");
    expect(text).toContain("The wiki's render door refused the fold (cap-denied: read on lar:///ha.ka.ba/wikis/daemon/working required)");
    expect(text).toContain(`lares get title='${URI}' mu=assert`);
    expect(data(om)).toMatchObject({ folded: false, unfolded: "refused" });
    const hum = await run(argv(["hum", "lares-alpha"]));
    expect(hum.exit).toBe(0);
    expect(data(hum)).toMatchObject({ folded: false, unfolded: "refused", total: 1600 });
  });

  test("a fold cut at the render's ceiling even at pulse names the truncation, never an absent skin", async () => {
    stage({ carrier: "<<a cut carrier", truncated: true });
    const r = await run(argv(["om", "lares-alpha"]));
    expect(renders().map((c) => /aperture:"([a-z]+)"/.exec(String(c.args["text"]))![1])).toEqual(["measure", "beat", "pulse"]);
    const text = String(data(r)["text"]);
    expect(text).toContain("truncated at the cap");
    expect(text).not.toContain("holds none");
    expect(text).not.toContain("<<a cut carrier");
    expect(text).toContain("* a loop");
    expect(data(r)).toMatchObject({ folded: false, unfolded: "truncated" });
  });

  test("om leads the wake with the carrier the wiki folded, the testimony and the doors beneath it", async () => {
    stage({ carrier: "<<carrier at measure>>" });
    const r = await run(argv(["om", "lares-alpha"], { instance: "s-1" }));
    expect(r.exit).toBe(0);
    const text = String(data(r)["text"]);
    expect(text.startsWith("<<carrier at measure>>\n")).toBe(true);
    expect(text).toContain("Slot digests");
    expect(text).toContain("lares spirit om lares-alpha --aperture");
    expect(text).not.toContain("<<~ has name=`rec`>>");
    expect(data(r)).toMatchObject({ aperture: "measure", folded: true, carrier: "<<carrier at measure>>" });
  });

  test("--aperture names the rank the call carries, by word, level or pair, and --face rides the call", async () => {
    stage({ carrier: "<<c>>" });
    await run(argv(["om", "lares-alpha"], { aperture: "theme" }));
    await run(argv(["om", "lares-alpha"], { aperture: "3", face: "1" }));
    await run(argv(["hum", "lares-alpha"], { aperture: "10/measure" }));
    await run(argv(["hum", "lares-alpha"]));
    expect(renders()).toEqual([call("theme"), call("pulse", ' face:"1"'), call("measure"), call("pulse")]);
  });

  test("an aperture naming no rank refuses before any door opens", async () => {
    stage({ carrier: "<<c>>" });
    for (const verb of ["om", "hum"]) {
      const r = await run(argv([verb, "lares-alpha"], { aperture: "wide" }));
      expect(r.exit).toBe(2);
      expect(error(r).message).toContain("pulse · beat · measure · arc · theme");
    }
    expect(h.calls).toEqual([]);
  });

  test("a wake's carrier past the cap folds one grain narrower, whole, and names the wider read", async () => {
    stage({ carrier: (rank) => (rank === "measure" ? "m".repeat(20_000) : `<<carrier at ${rank}>>`) });
    const r = await run(argv(["om", "lares-alpha"]));
    expect(renders()).toEqual([call("measure"), call("beat")]);
    const text = String(data(r)["text"]);
    expect(text.startsWith("<<carrier at beat>>\n")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(OM_CAP_CHARS);
    expect(text).toContain("lares spirit om lares-alpha --aperture measure");
    expect(data(r)).toMatchObject({ aperture: "beat", asked: "measure", folded: true });
  });

  test("an aperture a hand names reads past the wake cap, unnarrowed", async () => {
    stage({ carrier: "t".repeat(20_000) });
    const r = await run(argv(["om", "lares-alpha"], { aperture: "theme" }));
    expect(renders()).toEqual([call("theme")]);
    expect(String(data(r)["carrier"]).length).toBe(20_000);
  });

  test("a card with no shrine wakes on the carrier alone: no starter, no write", async () => {
    stage({ kind: "none", carrier: "<<the card as a carrier>>" });
    const r = await run(argv(["om", "lares-alpha"], { instance: "s-1" }));
    expect(r.exit).toBe(0);
    expect(data(r)).toMatchObject({ pet: "lares-alpha", kind: "card", uri: CARD, aperture: "measure", folded: true, text: "<<the card as a carrier>>" });
    expect(data(r)).not.toHaveProperty("starter");
    expect(h.calls.filter((c) => c.verb === "tiddler-put")).toEqual([]);
  });

  test("a pet no record and no card answers still reads its starter shrine", async () => {
    stage({ kind: "none" });
    const r = await run(argv(["om", "lares-alpha"]));
    expect(data(r)["starter"]).toBe(true);
  });

  test("hum answers the carrier folded at pulse beside the slot measures", async () => {
    stage({ carrier: "<<carrier at pulse>>" });
    const r = await run(argv(["hum", "lares-alpha"]));
    expect(data(r)).toMatchObject({ aperture: "pulse", folded: true, carrier: "<<carrier at pulse>>", total: 1600 });
  });

  test("hum on a card with no shrine answers the carrier alone, and a fold there names the shrine it lacks", async () => {
    stage({ kind: "none", carrier: "<<the card as a carrier>>" });
    const r = await run(argv(["hum", "lares-alpha"]));
    expect(r.exit).toBe(0);
    expect(data(r)).toMatchObject({ pet: "lares-alpha", kind: "card", uri: CARD, carrier: "<<the card as a carrier>>" });
    const fold = await run(argv(["hum", "lares-alpha"], { fold: "#/instances" }));
    expect(error(fold).code).toBe("spirit-unknown");
  });
});

describe.skipIf(wikiSkip)(`the fold renders through the real wiki-render verb${skipNote}`, () => {
  const SHRINE_WORDS = SHRINE_SLOTS.map(([slot, body]) => framed(slot, body).trimEnd()).join("\n\n");
  const SLOT_NAMES = SHRINE_SLOTS.map(([slot]) => slot);
  /** Canonical as `lares meme check` reads it: the normalize law moves nothing and names no fault. */
  const canonical = (text: string): boolean => { const read = normalizeMemeSource(text); return read.faults.length === 0 && read.text === text; };
  const slotCommands = (text: string): string[] => [...text.matchAll(/^`lares get title=\S+ face=1 mu=assert slot='([^']+)'`$/gm)].map((m) => m[1]!);

  async function realRender() {
    const DAEMON = bagUri("daemon");
    const engine = await bootTestWiki({ tiddlers: [{ title: "lar:///ha.ka.ba/lararium/config/current-wiki-bag", text: DAEMON }] });
    // The shrine lands as the wiki's own deserializer splits a carrier: the root and one record per slot.
    for (const record of engine.wiki.deserializeTiddlers("text/memetic-wikitext+tiddlywiki", shrineCarrier("lares-alpha", SHRINE_WORDS), { title: ONE })) engine.setTiddler(record as never);
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON, store: new MemoryTiddlerStore(DAEMON), writable: true });
    const render = makeWikiRenderReactor({ composite, tw5: engine } as never);
    const ctx = { daemon: composite, invocation: { requestId: "r1" }, cap: async () => ({ ok: true }) } as never;
    stage();
    const mocked = h.answer;
    h.answer = (verb, args) => (verb === "wiki-render" ? (render(args, ctx) as Promise<Record<string, unknown>>) : mocked(verb, args));
  }

  test("om's whole answer parses as a canonical carrier and lists one unfold command per folded slot", async () => {
    await realRender();
    const r = await run(argv(["om", "lares-alpha"], { face: "1", instance: "s-1" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const text = String(data(r)["text"]);
    expect(canonical(text), "lares meme check reads the wake's text as canonical").toBe(true);
    expect(canonical(String(data(r)["carrier"]))).toBe(true);
    // `worn: h<N>` leads the wake (om binds every handed command to the face that answered); the carrier follows it.
    expect(text.startsWith("worn: h1 · ")).toBe(true);
    expect(text).toContain("\n\n<<!DOCTYPE type=`memetic-wikitext+tiddlywiki`");
    expect(slotCommands(text)).toEqual(SLOT_NAMES.filter((slot) => !["#/entry", "#/attention", "#/open"].includes(slot)));
    expect(text).toContain("PR numbers, heads, what each waits on");
    expect(text).toContain("Slot digests");
  });

  test("hum's carrier folds every slot at pulse, canonical, one command each", async () => {
    await realRender();
    const r = await run(argv(["hum", "lares-alpha"], { face: "1" }));
    const carrier = String(data(r)["carrier"]);
    expect(canonical(carrier)).toBe(true);
    expect(slotCommands(carrier)).toEqual(SLOT_NAMES);
  });
});

describe("the cold read's cures", () => {
  test("a lease claim writes under the record's live hash and reads again past a conflict", async () => {
    stage({ side: { lease: "inst-a 3 2026-11-24T11:00:00.000Z" }, conflicts: 1 });
    const r = await run(argv(["om", "lares-alpha"], { instance: "inst-b" }));
    expect(data(r)["epoch"]).toBe(4);
    const leasePuts = puts(SIDE).filter((c) => (c.args["fields"] as Record<string, string> | undefined)?.["lease"]);
    expect(leasePuts).toHaveLength(2);
    expect(leasePuts.every((c) => c.args["base"] === "sha256-side")).toBe(true);
  });

  test("every om text names the wake epoch the card stands at, an ordering stamp", async () => {
    stage({ side: { lease: "inst-a 3 2026-11-24T11:00:00.000Z" } });
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

  test("the carry refuses a malformed --instance, lands for a fenced AI seat, and single-quotes the line it hands back", async () => {
    stage({ side: { lease: "inst-a 3 2026-11-24T11:00:00.000Z" } });
    expect((await run(argv([COMPACTION_WORD, "lares-alpha"], { text: "s", instance: "bad instance!" }))).exit).toBe(2);
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

describe("the ʻĀlana Circle: a card answers the slot verbs, a summon offers first, an instance echoes before it writes", () => {
  const CARD_FIELDS = (): Record<string, string> => ({ pet: "lares-alpha", lane: "read a PR cold and return PASS or FAIL", instances: "2026-11-24 · one", text: "{{||lar:///ha.ka.ba/kahua/memory/template/tasked-spirit}}", tags: "stage/spirit-card" });
  const flagged = (positional: string[], options: Record<string, string>, flags: Record<string, boolean>): ParsedArgs =>
    ({ command: "spirit", positional, options, flags: { json: true, ...flags } } as unknown as ParsedArgs);
  const MANDATE = "read PR 564 cold and return PASS or FAIL with file:line findings";
  const offered = (): Record<string, string> => ({ pet: "lares-alpha", text: MANDATE, "mandate-hash": sha(MANDATE), "offer-seq": "1", lane: CARD, grant: "read-only", "offered-by": "seat#s-0" });

  test("a card-only spirit trues a slot as its field: --add appends a line under the card's live hash, and no slot title takes a put", async () => {
    const card = CARD_FIELDS();
    stage({ kind: "none", card });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/instances", add: "2026-11-25 · verb-vesseler#4" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(card["instances"]).toBe("2026-11-24 · one\n2026-11-25 · verb-vesseler#4");
    expect(puts(CARD).at(-1)!.args).toMatchObject({ base: expect.stringMatching(/^sha256-card-/), fields: { instances: card["instances"] } });
    expect(slotPuts()).toEqual([]);
    expect(data(r)).toMatchObject({ uri: CARD, slot: "#/instances", decision: "put" });
  });

  test("a card trues a field no slot held yet (#/open), and refuses its identity fields by name", async () => {
    const card = CARD_FIELDS();
    stage({ kind: "none", card });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/open", text: "* a loop" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(card["open"]).toBe("* a loop");
    for (const slot of ["#/pet", "#/title", "#/text"]) {
      const held = await run(argv(["ah", "lares-alpha"], { slot, text: "x" }));
      expect(error(held).code).toBe("spirit-slot-held");
    }
    expect(card["pet"]).toBe("lares-alpha");
  });

  test("a card's om with an instance joins the presence as <pet>#<instance> and names the card", async () => {
    stage({ kind: "none", card: CARD_FIELDS(), carrier: "<<the card as a carrier>>" });
    const r = await run(argv(["om", "lares-alpha"], { instance: "s-1" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(data(r)).toMatchObject({ pet: "lares-alpha", kind: "card", uri: CARD });
    expect(String(puts(SIDE).find((p) => (p.args["fields"] as Record<string, string> | undefined)?.["instances-awake"])?.args["fields"]?.["instances-awake" as never] ?? "")).toContain("lares-alpha#s-1 ");
  });

  test("hum --fold numbers a card field's lines", async () => {
    stage({ kind: "none", card: { ...CARD_FIELDS(), instances: "one\ntwo" } });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/instances" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect((data(r)["lines"] as Array<{ text: string }>).map((l) => l.text)).toEqual(["one", "two"]);
  });

  test("ʻālana: a summon lands the offering on the shelf (the mandate, its hash, the lane's memory, the grant) and wakes no instance", async () => {
    const o: StageOpts = { kind: "none", card: CARD_FIELDS() };
    stage(o);
    const r = await run(flagged(["ah", "lares-alpha"], { text: MANDATE, lane: "lar:///ha.ka.ba/kahua/memory/wave/w1", grant: "read-only" }, { offer: true }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(puts(ALANA)).toHaveLength(1);
    expect(o.offering).toMatchObject({ text: MANDATE, "mandate-hash": sha(MANDATE), "offer-seq": "1", lane: "lar:///ha.ka.ba/kahua/memory/wave/w1", grant: "read-only" });
    expect(data(r)).toMatchObject({ uri: ALANA, mandate: sha(MANDATE), seq: 1 });
    expect(puts(SIDE)).toEqual([]);
  });

  test("a summon naming no words offers the card's own lane, and a second offering mints the next seq", async () => {
    const o: StageOpts = { kind: "none", card: CARD_FIELDS() };
    stage(o);
    await run(flagged(["ah", "lares-alpha"], {}, { offer: true }));
    expect(o.offering).toMatchObject({ text: CARD_FIELDS()["lane"], lane: CARD, "offer-seq": "1" });
    const again = await run(flagged(["ah", "lares-alpha"], { text: MANDATE }, { offer: true }));
    expect(data(again)).toMatchObject({ seq: 2 });
  });

  test("a summon naming no words refuses where the card seals its lane, and lands nothing; CONTROL: the words given still offer (sealed-lane-offer-fallback)", async () => {
    const o: StageOpts = { kind: "none", card: { ...CARD_FIELDS(), sealed: "lane" } };
    stage(o);
    const bare = await run(flagged(["ah", "lares-alpha"], {}, { offer: true }));
    expect(bare.exit).not.toBe(0);
    expect(error(bare).code).toBe("spirit-lane-sealed");
    expect(error(bare).message).toContain("--file");
    expect(puts(ALANA)).toEqual([]);
    const given = await run(flagged(["ah", "lares-alpha"], { text: MANDATE }, { offer: true }));
    expect(given.exit, JSON.stringify(given.printed)).toBe(0);
    expect(o.offering).toMatchObject({ text: MANDATE });
  });

  test("hoʻāla: an instance's om hands back the mandate's hash and the echo it asks", async () => {
    stage({ kind: "none", card: CARD_FIELDS(), offering: offered() });
    const r = await run(argv(["om", "lares-alpha"], { instance: "s-1" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(data(r)["mandate"]).toMatchObject({ hash: sha(MANDATE), seq: 1, echoed: false });
    expect(String(data(r)["text"])).toContain(`lares spirit ah lares-alpha --echo ${sha(MANDATE)} --instance s-1`);
    expect(String(data(r)["text"])).toContain(MANDATE);
  });

  test("a receipt, never a gate (ruling 2026-11-25-one-spirit-record): an unechoed instance's slot write lands and carries the unechoed notice", async () => {
    const card = CARD_FIELDS();
    stage({ kind: "none", card, offering: offered() });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/instances", add: "x", instance: "s-1" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(card["instances"]).toContain("x");
    expect(data(r)["unechoed"]).toBe(`unechoed: lares-alpha#s-1 has not read mandate ${sha(MANDATE)}`);
  });

  test("om names the unechoed notice for an instance that has not echoed the standing mandate, and none once it has", async () => {
    stage({ kind: "none", card: CARD_FIELDS(), offering: offered() });
    const r = await run(argv(["om", "lares-alpha"], { instance: "s-1" }));
    expect(String(data(r)["text"])).toContain(`unechoed: lares-alpha#s-1 has not read mandate ${sha(MANDATE)}`);
    stage({ kind: "none", card: CARD_FIELDS(), offering: offered(), side: { echoes: `lares-alpha#s-1 ${sha(MANDATE)} 1` } });
    const echoed = await run(argv(["om", "lares-alpha"], { instance: "s-1" }));
    expect(String(data(echoed)["text"])).not.toContain("unechoed:");
  });

  test("an instance echoes the hash: the echo lands as <pet>#<instance> <hash> <seq> on the sibling record, beside its presence", async () => {
    stage({ kind: "none", card: CARD_FIELDS(), offering: offered() });
    const r = await run(argv(["ah", "lares-alpha"], { echo: sha(MANDATE), instance: "s-1" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const fields = puts(SIDE).map((p) => p.args["fields"] as Record<string, string>);
    expect(fields.some((f) => f["echoes"] === `lares-alpha#s-1 ${sha(MANDATE)} 1`)).toBe(true);
    expect(fields.some((f) => String(f["instances-awake"] ?? "").startsWith("lares-alpha#s-1 "))).toBe(true);
    expect(data(r)).toMatchObject({ instance: "lares-alpha#s-1", echo: sha(MANDATE), seq: 1 });
  });

  test("an echoed instance writes clean; an echo of an older mandate carries the notice once a fresh offering stands", async () => {
    const card = CARD_FIELDS();
    stage({ kind: "none", card, offering: offered(), side: { echoes: `lares-alpha#s-1 ${sha(MANDATE)} 1` } });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/instances", add: "x", instance: "s-1" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(data(r)).not.toHaveProperty("unechoed");
    const fresh = "a fresh mandate";
    stage({ kind: "none", card, offering: { ...offered(), text: fresh, "mandate-hash": sha(fresh), "offer-seq": "2" }, side: { echoes: `lares-alpha#s-1 ${sha(MANDATE)} 1` } });
    const stale = await run(argv(["ah", "lares-alpha"], { slot: "#/instances", add: "y", instance: "s-1" }));
    expect(stale.exit, JSON.stringify(stale.printed)).toBe(0);
    expect(data(stale)["unechoed"]).toBe(`unechoed: lares-alpha#s-1 has not read mandate ${sha(fresh)}`);
  });

  test("an echo naming another hash refuses spirit-echo-mismatch; an echo with no offering refuses spirit-unoffered; an echo names its instance", async () => {
    stage({ kind: "none", card: CARD_FIELDS(), offering: offered() });
    expect(error(await run(argv(["ah", "lares-alpha"], { echo: "0".repeat(64), instance: "s-1" }))).code).toBe("spirit-echo-mismatch");
    expect((await run(argv(["ah", "lares-alpha"], { echo: sha(MANDATE) }))).exit).toBe(2);
    stage({ kind: "none", card: CARD_FIELDS() });
    expect(error(await run(argv(["ah", "lares-alpha"], { echo: sha(MANDATE), instance: "s-1" }))).code).toBe("spirit-unoffered");
  });

  test("under an offering, an AI seat naming no instance writes with the notice; a person's terminal writes clean; a spirit no summon offered writes as before", async () => {
    const card = CARD_FIELDS();
    stage({ kind: "none", card, offering: offered() });
    const seat = await run(argv(["ah", "lares-alpha"], { slot: "#/instances", add: "x" }), { seat: () => true, hand: AI });
    expect(seat.exit).toBe(0);
    expect(String(data(seat)["unechoed"])).toContain(`has not read mandate ${sha(MANDATE)}`);
    const hand = await run(argv(["ah", "lares-alpha"], { slot: "#/instances", add: "x" }));
    expect(hand.exit).toBe(0);
    expect(data(hand)).not.toHaveProperty("unechoed");
    stage();
    expect((await run(argv(["ah", "lares-alpha"], { slot: "#/open", add: "* y", instance: "s-1" }))).exit).toBe(0);
  });

  test("hum's fold of a line carries the notice too", async () => {
    stage({ kind: "none", card: { ...CARD_FIELDS(), instances: "one\ntwo" }, offering: offered() });
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/instances", line: "1", expect: digest("one"), instance: "s-1" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(data(r)["unechoed"]).toBe(`unechoed: lares-alpha#s-1 has not read mandate ${sha(MANDATE)}`);
  });

  test("the card's frame fields hold: lane, model, feeds, wave and waits refuse spirit-slot-held, so no slot write rewrites the lane a bare offer takes", async () => {
    for (const slot of ["#/lane", "#/model", "#/feeds", "#/wave", "#/waits"]) {
      const card = CARD_FIELDS();
      stage({ kind: "none", card });
      const r = await run(argv(["ah", "lares-alpha"], { slot, text: "{{$:/temp/lares/secret}}" }));
      expect(error(r).code, slot).toBe("spirit-slot-held");
      expect(puts(CARD), slot).toEqual([]);
    }
  });

  test("an offering records who offered (a seat's instance, or a hand) and om names the offerer; a seat offering names its instance", async () => {
    const o: StageOpts = { kind: "none", card: CARD_FIELDS() };
    stage(o);
    expect((await run(flagged(["ah", "lares-alpha"], { text: MANDATE }, { offer: true }), { hand: AI })).exit).toBe(2);
    const r = await run(flagged(["ah", "lares-alpha"], { text: MANDATE, instance: "s-9" }, { offer: true }), { hand: AI });
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(o.offering).toMatchObject({ "offered-by": "seat#s-9" });
    stage({ kind: "none", card: CARD_FIELDS(), ...(o.offering !== undefined ? { offering: o.offering } : {}) });
    const om = await run(argv(["om", "lares-alpha"], { instance: "s-1" }));
    expect(data(om)["mandate"]).toMatchObject({ offeredBy: "seat#s-9" });
    expect(String(data(om)["text"])).toContain("offered by seat#s-9");
  });

  test("a re-offer over a standing mandate refuses spirit-offer-held unless the same offerer or a hand offers it", async () => {
    const o: StageOpts = { kind: "none", card: CARD_FIELDS(), offering: offered() };
    stage(o);
    const other = await run(flagged(["ah", "lares-alpha"], { text: "take it over", instance: "s-7" }, { offer: true }), { hand: AI });
    expect(error(other).code).toBe("spirit-offer-held");
    expect(error(other).message).toContain("seat#s-0");
    expect(puts(ALANA)).toEqual([]);
    const same = await run(flagged(["ah", "lares-alpha"], { text: "a second word", instance: "s-0" }, { offer: true }), { hand: AI });
    expect(same.exit, JSON.stringify(same.printed)).toBe(0);
    const hand = await run(flagged(["ah", "lares-alpha"], { text: "the hand's word" }, { offer: true }));
    expect(hand.exit, JSON.stringify(hand.printed)).toBe(0);
    expect(o.offering).toMatchObject({ "offered-by": "hand", text: "the hand's word" });
  });

  test("a damaged offering (its hash disagrees with its words) fails closed: an instance's write and its echo refuse spirit-offering-damaged, and om names it", async () => {
    const damaged = { ...offered(), text: "words someone changed" };
    stage({ kind: "none", card: CARD_FIELDS(), offering: damaged, side: { echoes: `lares-alpha#s-1 ${sha(MANDATE)} 1` } });
    const write = await run(argv(["ah", "lares-alpha"], { slot: "#/instances", add: "x", instance: "s-1" }));
    expect(error(write).code).toBe("spirit-offering-damaged");
    expect(error(write).message).toContain("--offer");
    expect(error(await run(argv(["ah", "lares-alpha"], { echo: sha(MANDATE), instance: "s-1" }))).code).toBe("spirit-offering-damaged");
    const om = await run(argv(["om", "lares-alpha"], { instance: "s-1" }));
    expect(data(om)["mandate"]).toMatchObject({ damaged: true });
  });

  test("the terminal's exemption reads the hand gate, never the harness mark alone: an unmarked seat the hand gate refuses carries the notice", async () => {
    stage({ kind: "none", card: CARD_FIELDS(), offering: offered() });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/instances", add: "x" }), { seat: () => false, hand: AI });
    expect(r.exit).toBe(0);
    expect(String(data(r)["unechoed"])).toContain("has not read mandate");
  });

  // THE FACE JOINT (plan/companion-context S1-S3): the island names the face each answer came from, as face-lane stamps it.
  const answering = { face: 1 };
  const facedStage = (o: StageOpts): void => {
    stage(o);
    const base = h.answer;
    h.answer = async (verb, args) => {
      const out = await base(verb, args);
      return typeof out["refuse"] === "string" ? out : { ...out, face: answering.face };
    };
  };

  test("S1: an echo names the face that answered it as the line's fourth word", async () => {
    answering.face = 1;
    facedStage({ kind: "none", card: CARD_FIELDS(), offering: offered() });
    const r = await run(argv(["ah", "lares-alpha"], { echo: sha(MANDATE), instance: "s-1" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const fields = puts(SIDE).map((p) => p.args["fields"] as Record<string, string>);
    expect(fields.some((f) => f["echoes"] === `lares-alpha#s-1 ${sha(MANDATE)} 1 h1`)).toBe(true);
    expect(data(r)).toMatchObject({ instance: "lares-alpha#s-1", face: 1 });
  });

  test("S2: a turned mount refuses a face-less ah, hum and re-echo by name (spirit-face-turned, the cure --face 1), and nothing lands; --face 1 lands", async () => {
    const card = { ...CARD_FIELDS(), instances: "one\ntwo" };
    facedStage({ kind: "none", card, offering: offered(), side: { echoes: `lares-alpha#s-1 ${sha(MANDATE)} 1 h1` } });
    answering.face = 2;
    const turned = await run(argv(["ah", "lares-alpha"], { slot: "#/instances", add: "x", instance: "s-1" }));
    expect(turned.exit).toBe(4);
    expect(error(turned).code).toBe("spirit-face-turned");
    expect(error(turned).message).toContain("lares-alpha#s-1 echoed its mandate under h1, and h2 answered; nothing landed");
    expect(error(turned).message).toContain("--face 1");
    expect(card["instances"]).toBe("one\ntwo");
    expect(puts(CARD)).toEqual([]);
    const fold = await run(argv(["hum", "lares-alpha"], { fold: "#/instances", line: "1", expect: digest("one"), instance: "s-1" }));
    expect(error(fold).code).toBe("spirit-face-turned");
    const reEcho = await run(argv(["ah", "lares-alpha"], { echo: sha(MANDATE), instance: "s-1" }));
    expect(error(reEcho).code).toBe("spirit-face-turned");
    expect(puts(SIDE)).toEqual([]);
    expect(card["instances"]).toBe("one\ntwo");
    // The instance names its own face: the session of h1 answers, and the write lands clean.
    answering.face = 1;
    const named = await run(argv(["ah", "lares-alpha"], { slot: "#/instances", add: "x", instance: "s-1", face: "1" }));
    expect(named.exit, JSON.stringify(named.printed)).toBe(0);
    expect(card["instances"]).toBe("one\ntwo\nx");
    expect(data(named)).not.toHaveProperty("unechoed");
  });

  /** A spirit command or a recipe-default read that names no `--face 1`. */
  const UNBOUND = /\blares spirit (?:om|ah|hum|hooili|residue|otakiage) lares-alpha(?![a-z0-9-])(?! --face 1)|--recipe default(?![\w-])(?! --face 1)/;

  test("S3: om under a worn h1 leads with the worn line and binds every command it hands back to --face 1, the fold included", async () => {
    answering.face = 1;
    facedStage({ kind: "none", card: CARD_FIELDS(), offering: offered() });
    const r = await run(argv(["om", "lares-alpha"], { instance: "s-1" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const text = String(data(r)["text"]);
    expect(text).toContain("worn: h1");
    expect(text).toContain(`lares spirit ah lares-alpha --face 1 --echo ${sha(MANDATE)} --instance s-1`);
    expect(text).not.toMatch(UNBOUND);
    expect(data(r)).toMatchObject({ face: 1 });
    expect(String(h.calls.find((c) => c.verb === "wiki-render")?.args["text"] ?? "")).toContain(`face:"1"`);
  });

  test("S3: om --face 1 binds a folded shrine's doors the same way", async () => {
    answering.face = 1;
    facedStage({ carrier: "<<~ ahu slot=`#/entry`>>\n\nentry\n\n<<~/ahu>>" });
    const r = await run(argv(["om", "lares-alpha"], { instance: "s-1", face: "1" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    const text = String(data(r)["text"]);
    expect(text).toContain("worn: h1");
    expect(text).toContain("lares spirit hum lares-alpha --face 1");
    expect(text).not.toMatch(UNBOUND);
  });
});

describe("one spirit record: a pet name answers at lares/spirit/<pet>, holding a stack of what it holds", () => {
  const LANE = "lar:///spirit.lane.holds";
  const FACE = "lar:///spirit.face.serves";
  const CANON = "lar:///spirit.canon.transcludes";
  const one = (): Record<string, string> => ({ pet: "lares-alpha", tags: `stage/spirit ${LANE}`, lane: "read a PR cold and return PASS or FAIL", model: "sonnet", instances: "2026-11-24 · one", text: "{{||lar:///ha.ka.ba/kahua/memory/template/tasked-spirit}}" });
  const mask = (): Record<string, string> => ({ pet: "lares-alpha", canon: "lar:///ha.ka.ba/elyncia/lindwyrm", keepers: "the table", stage: "10", instances: "", text: "{{||lar:///ha.ka.ba/kahua/memory/template/mask-spirit}}" });
  const stackOf = (r: { printed: Record<string, unknown> }) => (data(r)["stack"] as Array<{ cap: string; value: string }>).map((h) => `${h.cap} ${h.value}`.trim());

  test("om wakes the one record: its address, its profiles, its stack, and the stack as one has line ahead of the wake", async () => {
    stage({ kind: "none", one: one() });
    const r = await run(argv(["om", "lares-alpha"]));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(data(r)).toMatchObject({ pet: "lares-alpha", uri: ONE, profiles: ["tasked"] });
    expect(stackOf(r)).toEqual([`${LANE} read a PR cold and return PASS or FAIL`]);
    expect(String(data(r)["text"])).toContain("<<~ has entity=`spirit` name=`lares-alpha` params=`kind/tasked lane.holds/[[read a PR cold and return PASS or FAIL]]");
    expect((data(r)["digests"] as Record<string, string>)["#/has"]).toBe(digest(`${LANE} read a PR cold and return PASS or FAIL`));
  });

  test("the one record answers ahead of a legacy shrine and a legacy card under the same pet name", async () => {
    stage({ kind: "familiar", one: one(), card: { pet: "lares-alpha", lane: "an older lane" } });
    const r = await run(argv(["om", "lares-alpha"]));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(data(r)["uri"]).toBe(ONE);
    expect(h.calls.some((c) => c.verb === "tiddler-get" && c.args["title"] === URI)).toBe(false);
  });

  test("the three kinds read through the one stack with no record moved: a shrine reads familiar, a card tasked, a mask card masked", async () => {
    stage();
    const familiar = await run(argv(["om", "lares-alpha"]));
    expect(data(familiar)).toMatchObject({ uri: URI, profiles: ["familiar"] });
    expect(stackOf(familiar)).toEqual([FACE]);
    stage({ kind: "none", card: { pet: "lares-alpha", lane: "read cold" } });
    const tasked = await run(argv(["om", "lares-alpha"]));
    expect(data(tasked)).toMatchObject({ uri: CARD, profiles: ["tasked"] });
    stage({ kind: "none", mask: mask() });
    const masked = await run(argv(["om", "lares-alpha"]));
    expect(masked.exit, JSON.stringify(masked.printed)).toBe(0);
    expect(data(masked)).toMatchObject({ uri: MASK, kind: "card", profiles: ["masked"] });
    expect(stackOf(masked)).toEqual([`${CANON} lar:///ha.ka.ba/elyncia/lindwyrm`]);
    expect(h.calls.filter((c) => c.verb === "tiddler-put" && [URI, CARD, MASK].includes(String(c.args["title"])) && (c.args["fields"] as Record<string, string> | undefined)?.["tags"] !== undefined)).toEqual([]);
  });

  test("a mask's frame stays its keepers': no slot verb writes canon, keepers, stage, look or voice", async () => {
    stage({ kind: "none", mask: mask() });
    for (const slot of ["#/canon", "#/keepers", "#/stage", "#/look", "#/voice", "#/handle", "#/goals"]) {
      expect(error(await run(argv(["ah", "lares-alpha"], { slot, text: "x" }))).code).toBe("spirit-slot-held");
    }
    const instances = await run(argv(["ah", "lares-alpha"], { slot: "#/instances", add: "2026-11-25 · a wearer" }));
    expect(instances.exit, JSON.stringify(instances.printed)).toBe(0);
  });

  test("ah --add strings a cap by a hand: the tag and the field land in one write under the record's live hash", async () => {
    const rec = one();
    stage({ kind: "none", one: rec });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/has", add: "spirit.face.serves 1" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(rec["face"]).toBe("1");
    expect(rec["tags"]).toBe(`stage/spirit ${LANE} ${FACE}`);
    expect(puts(ONE).at(-1)!.args).toMatchObject({ base: "sha256-one-0", fields: { face: "1", tags: `stage/spirit ${LANE} ${FACE}` } });
    expect(data(r)).toMatchObject({ uri: ONE, slot: "#/has", decision: "put" });
    expect(slotPuts()).toEqual([]);
  });

  test("any instance strings a profile's cap, the familiar's included (a cap asks for attention and grants nothing); the mandate's cap lands by the door's own act alone", async () => {
    const rec = one();
    stage({ kind: "none", one: rec });
    const face = await run(argv(["ah", "lares-alpha"], { slot: "#/has", add: "spirit.face.serves 1", instance: "s-1" }), { hand: AI, seat: () => true });
    expect(face.exit, JSON.stringify(face.printed)).toBe(0);
    expect(rec["face"]).toBe("1");
    const feed = await run(argv(["ah", "lares-alpha"], { slot: "#/has", add: "lar:///custody.hand.admits", instance: "s-1" }), { hand: AI, seat: () => true });
    expect(feed.exit, JSON.stringify(feed.printed)).toBe(0);
    expect(rec["tags"]).toBe(`stage/spirit ${LANE} ${FACE} lar:///custody.hand.admits`);
    const before = puts(ONE).length;
    const doors = await run(argv(["ah", "lares-alpha"], { slot: "#/has", add: `spirit.mandate.offers ${"ab".repeat(32)}` }));
    expect(error(doors).code).toBe("spirit-cap-held");
    expect(error(doors).message).toContain("--offer");
    expect(puts(ONE).length).toBe(before);
  });

  test("the stack takes one cap per --add: a whole-slot write, a malformed line and a secret-shaped value each refuse", async () => {
    stage({ kind: "none", one: one() });
    const whole = await run(argv(["ah", "lares-alpha"], { slot: "#/has", text: `${LANE} x` }));
    expect(whole.exit).not.toBe(0);
    expect(JSON.stringify(whole.printed)).toContain("--add");
    expect(error(await run(argv(["ah", "lares-alpha"], { slot: "#/has", add: "not a cap" }))).code).toBe("spirit-cap-malformed");
    expect(error(await run(argv(["ah", "lares-alpha"], { slot: "#/has", add: "spirit.grant.attenuates ghp_abcdefghijklmnopqrstuvwxyz0123456789" }))).code).toBe("spirit-secret-shaped");
    expect(puts(ONE)).toEqual([]);
  });

  test("hum measures the stack, numbers #/has cap by cap, and an instance's fold unstrings one cap to the ash ledger", async () => {
    const rec = { ...one(), tags: `stage/spirit ${LANE} ${FACE}`, face: "1" };
    stage({ kind: "none", one: rec, ledgerStands: true });
    const measured = await run(argv(["hum", "lares-alpha"]));
    expect(data(measured)).toMatchObject({ uri: ONE, profiles: ["familiar", "tasked"] });
    const listed = await run(argv(["hum", "lares-alpha"], { fold: "#/has" }));
    expect((data(listed)["lines"] as Array<{ text: string }>).map((l) => l.text)).toEqual([`${FACE} 1`, `${LANE} read a PR cold and return PASS or FAIL`]);
    const r = await run(argv(["hum", "lares-alpha"], { fold: "#/has", line: "1", expect: digest(`${FACE} 1`), instance: "s-1" }), { hand: AI, seat: () => true });
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(rec["face"]).toBeUndefined();
    expect(rec["tags"]).toBe(`stage/spirit ${LANE}`);
    expect(String(puts(LEDGER).at(-1)!.args["append"])).toContain(`${FACE} 1`);
  });

  test("a legacy shrine takes a cap on its own root, and the cap its address signs never unstrings", async () => {
    stage({ ledgerStands: true });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/has", add: "spirit.face.serves 1" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(puts(URI).at(-1)!.args).toMatchObject({ fields: { face: "1", tags: FACE } });
    const seated = await run(argv(["hum", "lares-alpha"], { fold: "#/has", line: "1", expect: digest(FACE) }));
    expect(error(seated).code).toBe("spirit-cap-seated");
  });

  test("ah --new never lands over a plain record at the one address that names another pet", async () => {
    stage({ kind: "none", stray: { pet: "someone-else", text: "a note that stood here first" } });
    const text = SHRINE_SLOTS.map(([slot, prompt]) => framed(slot, prompt)).join("\n");
    const r = await run({ ...argv(["ah", "lares-alpha"], { text }), flags: { json: true, new: true } } as unknown as ParsedArgs);
    expect(error(r).code).toBe("spirit-exists");
    expect(error(r).message).toContain("lares get title=");
    expect(shrinePuts().length > 0).toBe(false);
  });

  test("a sealed hold names itself and nothing more: om, hum and the #/has listing never carry its value, and a stack write leaves it home", async () => {
    const rec = { ...one(), tags: `stage/spirit ${LANE} lar:///spirit.grant.attenuates`, grant: "the hoard's true name", sealed: "grant" };
    stage({ kind: "none", one: rec });
    const woke = await run(argv(["om", "lares-alpha"]));
    const measured = await run(argv(["hum", "lares-alpha"]));
    const listed = await run(argv(["hum", "lares-alpha"], { fold: "#/has" }));
    for (const r of [woke, measured, listed]) expect(JSON.stringify(r.printed)).not.toContain("the hoard's true name");
    expect((data(listed)["lines"] as Array<{ text: string }>).map((l) => l.text)).toContain("lar:///spirit.grant.attenuates");
    const add = await run(argv(["ah", "lares-alpha"], { slot: "#/has", add: "lar:///custody.hand.admits" }));
    expect(add.exit, JSON.stringify(add.printed)).toBe(0);
    expect(rec["grant"]).toBe("the hoard's true name");
  });

  test("ah --new lands a fresh shrine at the one address, and refuses over a record standing there", async () => {
    stage({ kind: "none" });
    const text = SHRINE_SLOTS.map(([slot, prompt]) => framed(slot, prompt)).join("\n");
    const r = await run({ ...argv(["ah", "lares-alpha"], { text }), flags: { json: true, new: true } } as unknown as ParsedArgs);
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(data(r)).toMatchObject({ uri: ONE, created: true });
    const put = shrinePuts()[0]!;
    expect(put.args["title"]).toBe(ONE);
    expect(put.args["create"]).toBe(true);
    expect(put.args).not.toHaveProperty("meme");
    expect(String(put.args["text"])).toContain(`title     = "${ONE}"`);
    stage({ kind: "none", one: one() });
    const again = await run({ ...argv(["ah", "lares-alpha"], { text }), flags: { json: true, new: true } } as unknown as ParsedArgs);
    expect(error(again).code).toBe("spirit-exists");
  });
});

describe.skipIf(wikiSkip)(`the one record lands and holds its stack through the real tiddler and meme verbs${skipNote}`, () => {
  const LANE = "lar:///spirit.lane.holds";
  const DAEMON = bagUri("daemon");
  /** Every verb over the one address rides the real reactors in one wiki; the sibling record and the rest stay staged. */
  async function realOne() {
    const engine = await bootTestWiki({ tiddlers: [{ title: "lar:///ha.ka.ba/lararium/config/current-wiki-bag", text: DAEMON }] });
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON, store: new MemoryTiddlerStore(DAEMON), writable: true });
    const deps = { composite, tw5: engine } as never;
    const real: Record<string, (args: Record<string, unknown>, ctx: never) => unknown> = {
      "tiddler-get": makeTiddlerGetReactor(deps) as never, "tiddler-put": makeTiddlerPutReactor(deps) as never,
    };
    const ctx = { daemon: composite, invocation: { requestId: "r1" }, cap: async () => ({ ok: true }) } as never;
    stage({ kind: "none" });
    const mocked = h.answer;
    h.answer = (verb, args) => (real[verb] && String(args["title"] ?? args["uri"] ?? "").startsWith(ONE) ? (real[verb]!(args, ctx) as Promise<Record<string, unknown>>) : mocked(verb, args));
    return engine;
  }

  test("ah --new lands the shrine at the one address, a hand strings a cap on its root, and om reads the stack back", async () => {
    const engine = await realOne();
    const text = SHRINE_SLOTS.map(([slot, prompt]) => framed(slot, prompt)).join("\n");
    const landed = await run({ ...argv(["ah", "lares-alpha"], { text }), flags: { json: true, new: true } } as unknown as ParsedArgs);
    expect(landed.exit, JSON.stringify(landed.printed)).toBe(0);
    expect(engine.wiki.getTiddler(ONE)).toBeDefined();
    const strung = await run(argv(["ah", "lares-alpha"], { slot: "#/has", add: "spirit.lane.holds read a PR cold" }));
    expect(strung.exit, JSON.stringify(strung.printed)).toBe(0);
    const root = engine.wiki.getTiddler(ONE)!.fields as Record<string, unknown>;
    expect(root["lane"]).toBe("read a PR cold");
    expect(engine.wiki.filterTiddlers(`[tag[${LANE}]]`)).toEqual([ONE]);
    const woke = await run(argv(["om", "lares-alpha"]));
    expect(woke.exit, JSON.stringify(woke.printed)).toBe(0);
    expect(data(woke)).toMatchObject({ uri: ONE, kind: "shrine", profiles: ["tasked"] });
    expect(String(data(woke)["text"])).toContain("<<~ has entity=`spirit` name=`lares-alpha` params=`kind/tasked lane.holds/[[read a PR cold]]");
  });
});

describe("the instance names a spirit's model stream (ruling 2026-11-25-body-becomes-instance)", () => {
  const MANDATE = "read PR 575 cold and return PASS or FAIL";
  const offered = (): Record<string, string> => ({ pet: "lares-alpha", text: MANDATE, "mandate-hash": sha(MANDATE), "offer-seq": "1", lane: CARD, grant: "read-only", "offered-by": "hand" });
  const card = (): Record<string, string> => ({ pet: "lares-alpha", lane: "read a PR cold", text: "{{||lar:///ha.ka.ba/kahua/memory/template/tasked-spirit}}", tags: "stage/spirit-card" });

  test("the spirit row accepts --instance and refuses --body by name", () => {
    const row = COMMANDS.find((c) => c.name === "spirit") as unknown as { accepts: string[] };
    expect(row.accepts).toContain("instance");
    expect(row.accepts).not.toContain("body");
  });

  test("an instance echoes: the receipt names <pet>#<instance>, and the presence lands as instances-awake", async () => {
    stage({ kind: "none", card: card(), offering: offered() });
    const r = await run(argv(["ah", "lares-alpha"], { echo: sha(MANDATE), instance: "s-1" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(data(r)).toMatchObject({ instance: "lares-alpha#s-1" });
    const fields = puts(SIDE).map((p) => p.args["fields"] as Record<string, string>);
    expect(fields.some((f) => String(f["instances-awake"] ?? "").startsWith("lares-alpha#s-1 "))).toBe(true);
  });

  test("a card's #/instances reads and writes its `instances` field alone: a `bodies` field stays an ordinary field", async () => {
    const held: Record<string, string> = { ...card(), bodies: "2026-11-24 · one" };
    stage({ kind: "none", card: held });
    const r = await run(argv(["ah", "lares-alpha"], { slot: "#/instances", add: "2026-11-25 · circle-keeper#4" }));
    expect(r.exit, JSON.stringify(r.printed)).toBe(0);
    expect(held["instances"]).toBe("2026-11-25 · circle-keeper#4");
    expect(held["bodies"]).toBe("2026-11-24 · one");
  });

  test("om under an offering names the unechoed instance and asks for --instance", async () => {
    stage({ kind: "none", card: card(), offering: offered() });
    const r = await run(argv(["om", "lares-alpha"], { instance: "s-1" }));
    const text = String(data(r)["text"]);
    expect(text).toContain(`unechoed: lares-alpha#s-1 has not read mandate ${sha(MANDATE)}`);
    expect(text).toContain("1 instance wears lares-alpha");
  });
});
