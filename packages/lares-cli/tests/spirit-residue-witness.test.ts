/**
 * spirit-residue-witness.test.ts — `lares spirit residue <pet> --witness [--transcripts <dir|file>]`: every hand-back landed
 * under the pet and every hand-back the named transcripts carry, read for the frame and the Personas. One receipt line per
 * reading and one tally; the command exits 0 on every reading, an unreadable transcript answering a named unread line.
 * The door rides a mock stage; transcripts stand synthetic in a scratch directory, in the shape a subagent transcript takes.
 * Plan: lar:///ha.ka.ba/kahua/memory/plan/the-house-summons (H4)
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown> }>,
  /** The stage: each record's fields, text among them. */
  store: new Map<string, Record<string, string>>(),
}));
vi.mock("../src/verb-call.js", () => {
  const answer = (verb: string, args: Record<string, unknown>): Record<string, unknown> => {
    const title = String(args["title"] ?? "");
    if (verb === "tiddler-get") {
      const held = h.store.get(title);
      return { tiddler: held ? { fields: { title, ...held }, hash: `sha256-${title.slice(-6)}` } : null };
    }
    if (verb === "wiki-filter") {
      const prefixes = [...String(args["filter"]).matchAll(/\[prefix\[([^\]]+)\]\]/g)].map((m) => m[1]!);
      return { titles: [...h.store.keys()].filter((t) => prefixes.some((p) => t.startsWith(p))) };
    }
    if (verb === "tiddler-put") return { decision: "put" };
    return {};
  };
  const ran = async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: answer(verb, args) } } };
  };
  return { DaemonUnreachable: class extends Error {}, verbFailure: (err: unknown) => ({ code: "error", message: err instanceof Error ? err.message : String(err) }), runVerb: ran, runVerbAsFace: ran };
});
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { cmdSpirit } from "../src/commands/spirit.js";
import { COMMANDS } from "../src/bin/lares.js";
import { compactionTitle, residueTitle } from "@lararium/mesh/spirit-shrine";
import { FILING_LINE, frameWitness } from "@lararium/mesh/spirit-witness";
import type { ParsedArgs } from "../src/parse-args.js";

const NOW = () => new Date("2026-11-26T12:00:00Z");
const HAND = () => ({ admit: "hand" }) as never;

const FRAMED = [
  "cold-reader#2: (Lares Spirit)",
  "<<~ set lares=`aim` from=`lar://op:operator@house/operator.asks.a-read` to=`lar://arm:agent@house/arm.reads.the-tree` ooda-ha=`5/declare-glyphs` drift-ward=`everything I hold rides the brief`>>",
  "Ink-Clerk (Lorekeeper): ->✶ the tree holds three readers.",
  "Lares (Council): ->↺ the third one carries the seam.",
  "<<~ oracle throw=`↯9 ✲ ⚂(3) ⁂:🜄⛰️〰️`>>",
  "<<~ set lares=`yield` drift-ward=`the parser never met a live stream · ↻ L-Prime` ooda-ha=`closed 1↺` from=`lar://arm:agent@house/read.lands.whole` to=`?`>>",
].join("\n\n");
const BARE = "cold-reader#3: (Lares Spirit)\n\nI read the tree; three readers stand.";

const argv = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "spirit", positional, options, flags: { json: true, ...flags } } as unknown as ParsedArgs);

async function run(args: ParsedArgs): Promise<{ exit: number; printed: Record<string, unknown> }> {
  const chunks: string[] = [];
  const out = vi.spyOn(process.stdout, "write").mockImplementation(((c: unknown) => { chunks.push(String(c)); return true; }) as never);
  const log = vi.spyOn(console, "log").mockImplementation((...p: unknown[]) => { chunks.push(p.join(" ") + "\n"); });
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const exit = await cmdSpirit(args, { now: NOW, hand: HAND });
    return { exit, printed: JSON.parse(chunks.join("").trim().split("\n").at(-1)!) as Record<string, unknown> };
  } finally { out.mockRestore(); log.mockRestore(); err.mockRestore(); }
}
const data = (r: { printed: Record<string, unknown> }) => r.printed["data"] as { lines: string[]; tally: Record<string, unknown>; readings: Array<Record<string, unknown>> };
const witness = (options: Record<string, string> = {}) => run(argv(["residue", "cold-reader"], options, { witness: true }));

/** One assistant event of a subagent transcript, as the harness writes it. */
const event = (agent: string, id: string, content: unknown) => JSON.stringify({ type: "assistant", agentId: agent, isSidechain: true, message: { id, role: "assistant", type: "message", content } });
const handbackCall = (agent: string, message: string) => event(agent, `m-${agent}`, [{ type: "tool_use", id: `t-${agent}`, name: "SubagentHandback", input: { message } }]);

let scratch: string;
beforeEach(() => { h.store.clear(); scratch = mkdtempSync(join(tmpdir(), "residue-witness-")); });
afterEach(() => { h.calls.length = 0; rmSync(scratch, { recursive: true, force: true }); });

describe("the command table names the witness", () => {
  test("residue accepts --witness and --transcripts", () => {
    const row = COMMANDS.find((c) => c.name === "spirit")!;
    expect(row.accepts).toEqual(expect.arrayContaining(["witness", "transcripts"]));
  });
});

describe("the witness reads the landed hand-backs", () => {
  test("each hand-back under the pet reads as one receipt line, a carry and another pet's record never; one tally; exit 0", async () => {
    const clean = residueTitle("cold-reader", "a".repeat(64));
    const bare = residueTitle("cold-reader", "b".repeat(64));
    h.store.set(clean, { text: FRAMED, pet: "cold-reader" });
    h.store.set(bare, { text: BARE, pet: "cold-reader" });
    h.store.set(compactionTitle("cold-reader", "c".repeat(64)), { text: "a carry" });
    h.store.set(residueTitle("cold-reader-two", "d".repeat(64)), { text: BARE });
    const r = await witness();
    expect(r.exit).toBe(0);
    const d = data(r);
    expect(d.lines).toHaveLength(2);
    expect(d.lines[0]).toMatch(new RegExp(`^stands ${clean} · cold-reader#2 `));
    expect(d.lines[1]).toMatch(new RegExp(`^tells ${bare} · cold-reader#3 `));
    expect(d.lines[1]).toContain("no-aim → #/exchange-protocol");
    expect(d.lines[1]).toContain("no-yield → #/exchange-protocol");
    expect(d.lines[1]).toContain("no-persona → #/personas");
    expect(d.tally).toMatchObject({ read: 2, stands: 1, tells: 1, unread: 0 });
  });
  test("the witness lists and reads through the tiddler door on the default recipe and writes nothing", async () => {
    h.store.set(residueTitle("cold-reader", "a".repeat(64)), { text: FRAMED });
    await witness();
    expect(h.calls[0]).toMatchObject({ verb: "wiki-filter", args: { recipe: "default" } });
    expect(h.calls.map((c) => c.verb).filter((v) => v !== "wiki-filter" && v !== "tiddler-get")).toEqual([]);
  });
  test("a record holding no words reads as an unread line naming the read that cures it", async () => {
    const empty = residueTitle("cold-reader", "e".repeat(64));
    h.store.set(empty, { text: "" });
    const r = await witness();
    expect(r.exit).toBe(0);
    expect(data(r).lines[0]).toBe(`unread ${empty} · the record holds no words; read it: lares tiddler get '${empty}' --recipe default`);
  });
  test("no residue reads an empty tally, exit 0", async () => {
    const r = await witness();
    expect(r.exit).toBe(0);
    expect(data(r).lines).toEqual([]);
    expect(data(r).tally).toMatchObject({ read: 0, line: "witness cold-reader: 0 read · 0 stand · 0 tell · 0 elsewhere · 0 unread" });
  });
});

describe("--transcripts reads hand-backs from disk", () => {
  test("a directory reads its *.jsonl files by name; each agent's hand-back reads once; another pet reads elsewhere", async () => {
    writeFileSync(join(scratch, "b-agent.jsonl"), handbackCall("b1", BARE.replace("cold-reader#3", "other-arm#1")));
    writeFileSync(join(scratch, "a-agent.jsonl"), [event("a1", "m0", [{ type: "text", text: "early" }]), handbackCall("a1", FRAMED)].join("\n"));
    writeFileSync(join(scratch, "notes.txt"), "not a transcript");
    const r = await witness({ transcripts: scratch });
    expect(r.exit).toBe(0);
    expect(data(r).lines).toEqual([
      expect.stringMatching(/^stands a-agent\.jsonl · cold-reader#2 /),
      expect.stringMatching(/^elsewhere b-agent\.jsonl · files as other-arm#1; .*lares spirit residue other-arm --witness$/),
    ]);
  });
  test("an unreadable path, a file of no JSON and a stream with no text each read as a named unread line; exit 0", async () => {
    const missing = join(scratch, "absent.jsonl");
    expect(data(await witness({ transcripts: missing })).lines[0]).toMatch(/^unread .*absent\.jsonl · the path reads nothing \(ENOENT\); read it: ls -l /);
    writeFileSync(join(scratch, "junk.jsonl"), "garbage\n");
    writeFileSync(join(scratch, "silent.jsonl"), event("s1", "m1", [{ type: "tool_use", id: "t", name: "Bash", input: {} }]));
    const r = await witness({ transcripts: scratch });
    expect(r.exit).toBe(0);
    expect(data(r).lines).toEqual([
      expect.stringMatching(/^unread junk\.jsonl · the transcript holds no JSON event; read it: head -n 1 /),
      expect.stringMatching(/^unread silent\.jsonl · the agent's stream ends with no hand-back text; read it: tail -n 2 /),
    ]);
    expect(data(r).tally).toMatchObject({ unread: 2 });
  });
  test("an empty directory reads one unread line", async () => {
    expect(data(await witness({ transcripts: scratch })).lines).toEqual([expect.stringMatching(/^unread .* · the directory holds no \*\.jsonl transcript; read it: ls /)]);
  });
});

describe("one reader of the filing line", () => {
  type Filing = { role: string; line: RegExp; verb: string };
  type HookCore = { FILING: Filing; filingOf: (message: string) => { pet: string; instance: string | null } | null };
  const hookCore = async (): Promise<HookCore> =>
    (await import(new URL("../.claude-plugin/hooks/lares-spirit-core.mjs", import.meta.url).href)) as HookCore;

  test("the witness's FILING_LINE equals the hooks' FILING table, pattern and flags", async () => {
    const { FILING } = await hookCore();
    expect(FILING_LINE.source).toBe(FILING.line.source);
    expect(FILING_LINE.flags).toBe(FILING.line.flags);
    expect(FILING.role).toBe("(Lares Spirit)");
  });

  test("both readers file the seed's line alike: bare, an instance, a colon, and a line that files nothing", async () => {
    const { filingOf } = await hookCore();
    const lines: Array<[string, { pet: string; instance: string | null } | null]> = [
      ["cold-reader (Lares Spirit)", { pet: "cold-reader", instance: null }],
      ["cold-reader#2 (Lares Spirit)", { pet: "cold-reader", instance: "2" }],
      ["cold-reader#2: (Lares Spirit)", { pet: "cold-reader", instance: "2" }],
      ["Here is what I found.", null],
    ];
    for (const [line, filed] of lines) {
      expect(filingOf(`${line}\n\nreport`), line).toEqual(filed);
      expect(frameWitness(`${line}\n\nreport`).filing, line).toEqual(filed);
    }
  });
});
