/**
 * spirit-summon.test.ts — `lares spirit mandate | summon | handback <pet>#<n>` and `om --mandate`: the house reads a mandate
 * through the door, verifies its hash, holds custody and the coordinator's lanes, lands the edge, and starts the instance through
 * the launch cap with the one wake line. The launch cap rides a stub in every case: no test starts a model.
 * Plan: lar:///ha.ka.ba/kahua/memory/plan/mandate-summons
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown> }>,
  /** The stage: each record's fields (text among them) and how many writes it took. */
  store: new Map<string, { fields: Record<string, string>; rev: number }>(),
  /** The face the island names on every answer; null: it names none. */
  face: null as number | null,
}));
vi.mock("../src/verb-call.js", () => {
  const answer = (verb: string, args: Record<string, unknown>): Record<string, unknown> => {
    const faced = h.face === null ? {} : { face: h.face };
    const title = String(args["title"] ?? "");
    if (verb === "tiddler-get") {
      if (args["meme"] === true) return { ...faced, title, tiddler: null };
      const held = h.store.get(title);
      return { ...faced, tiddler: held ? { fields: { title, ...held.fields }, hash: `sha256-${title.slice(-6)}-${held.rev}` } : null };
    }
    if (verb === "tiddler-put") {
      const held = h.store.get(title) ?? { fields: {}, rev: 0 };
      if (args["base"] !== undefined && args["base"] !== `sha256-${title.slice(-6)}-${held.rev}`) return { ...faced, decision: "conflict" };
      h.store.set(title, { fields: { ...held.fields, ...((args["fields"] ?? {}) as Record<string, string>), ...(typeof args["text"] === "string" ? { text: args["text"] } : {}) }, rev: held.rev + 1 });
      return { ...faced, decision: "put" };
    }
    if (verb === "wiki-filter") {
      // The two filters the summons door sends: a tag, one field's value, and (for open lanes) no hand-back.
      const m = /^\[tag\[([^\]]+)\]field:([a-z-]+)\[([^\]]+)\](!has\[handback\])?\]$/.exec(String(args["filter"]));
      if (!m) return { ...faced, titles: [], rows: [] };
      const titles = [...h.store].filter(([, r]) => r.fields["tags"] === m[1] && r.fields[m[2]!] === m[3] && (m[4] === undefined || !r.fields["handback"])).map(([t]) => t);
      return { ...faced, titles };
    }
    if (verb === "wiki-render") return { ...faced, text: "", truncated: false };
    return { ...faced };
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
import type { LaunchAnswer, LaunchAsk } from "../src/commands/spirit-summon.js";
import { COMMANDS } from "../src/bin/lares.js";
import { mandateWrite, refLine, summonsOf, type MandateField } from "@lararium/mesh/spirit-summons";
import type { ParsedArgs } from "../src/parse-args.js";

const M = "lar:///ha.ka.ba/kahua/memory/";
const NOW = () => new Date("2026-11-26T12:00:00Z");
const HAND = () => ({ admit: "hand" }) as never;
const SEAT = () => ({ refusal: "hand-act-only" }) as never;
const WORDS = "Read PR 412 cold and hand back three findings.";

/** A mandate standing on the stage, as `lares spirit mandate` lands one. */
function stands(covered: Partial<Record<MandateField, string>>, text = WORDS): { uri: string; hash: string; ref: string } {
  const w = mandateWrite(covered, text);
  h.store.set(w.uri, { fields: { ...w.fields, text: w.text }, rev: 1 });
  return { uri: w.uri, hash: w.hash, ref: refLine(w.uri, w.hash) };
}
const coordinator = (over: Partial<Record<MandateField, string>> = {}) => stands({ pet: "lares-alpha", instance: "00001", offerer: "hand", grants: "summons", lanes: "2", ...over }, "Coordinate the arms.");
const arm = (parent: { ref: string } | null, n = "00002", over: Partial<Record<MandateField, string>> = {}) =>
  stands({ pet: "cold-reader", instance: n, offerer: parent === null ? "hand" : "lares-alpha#00001", ...(parent === null ? {} : { parent: parent.ref }), model: "claude-fable-5-2", ...over }, `${WORDS} (${n})`);

/** The launch cap, stubbed: it records what it got asked and starts nothing. */
function stub(answer: LaunchAnswer = { ok: true, pid: 4242 }) {
  const asks: LaunchAsk[] = [];
  return { asks, launch: async (ask: LaunchAsk) => { asks.push(ask); return answer; } };
}

const argv = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "spirit", positional, options, flags: { json: true } } as unknown as ParsedArgs);

async function run(args: ParsedArgs, seams: Record<string, unknown> = {}): Promise<{ exit: number; printed: Record<string, unknown> }> {
  const chunks: string[] = [];
  const out = vi.spyOn(process.stdout, "write").mockImplementation(((c: unknown) => { chunks.push(String(c)); return true; }) as never);
  const log = vi.spyOn(console, "log").mockImplementation((...p: unknown[]) => { chunks.push(p.join(" ") + "\n"); });
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const exit = await cmdSpirit(args, { now: NOW, hand: HAND, launch: stub().launch, ...seams });
    return { exit, printed: JSON.parse(chunks.join("").trim().split("\n").at(-1)!) as Record<string, unknown> };
  } finally { out.mockRestore(); log.mockRestore(); err.mockRestore(); }
}
const data = (r: { printed: Record<string, unknown> }) => r.printed["data"] as Record<string, unknown>;
const error = (r: { printed: Record<string, unknown> }) => r.printed["error"] as { code: string; message: string };
const fieldsOf = (title: string) => h.store.get(title)?.fields ?? null;

beforeEach(() => { h.store.clear(); h.face = null; });
afterEach(() => { h.calls.length = 0; });

describe("the command table names the summons verbs", () => {
  test("mandate, summon and handback stand among the spirit door's verbs, their options accepted", () => {
    const row = COMMANDS.find((c) => c.name === "spirit")!;
    expect(row.verbs).toEqual(expect.arrayContaining(["mandate", "summon", "handback"]));
    expect(row.accepts).toEqual(expect.arrayContaining(["cap", "caps", "grants", "handback", "lanes", "links", "mandate", "model", "parent", "paths", "reads", "record"]));
  });
});

describe("summon reads, verifies and starts", () => {
  test("the launch cap gets exactly the one wake line and the model the mandate names", async () => {
    const m = arm(coordinator());
    const cap = stub();
    const r = await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }), { launch: cap.launch });
    expect(r.exit).toBe(0);
    expect(cap.asks).toHaveLength(1);
    expect(cap.asks[0]).toMatchObject({ cap: "claude-cli", model: "claude-fable-5-2", prompt: `wake as cold-reader#00002: lares spirit om cold-reader --mandate ${m.uri}@${m.hash}` });
    expect(Object.keys(cap.asks[0]!).sort()).toEqual(["cap", "cwd", "model", "prompt"]);
    expect(data(r)).toMatchObject({ decision: "launched", instance: "cold-reader#00002", hash: m.hash, pid: 4242, offerer: "lares-alpha#00001" });
  });
  test("the mandate reads through the tiddler door on the default recipe before anything starts", async () => {
    const m = arm(coordinator());
    await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }));
    expect(h.calls[0]).toEqual({ verb: "tiddler-get", args: { recipe: "default", title: m.uri } });
  });
  test("a mandate echoing a face carries it on the line; another face answering refuses and starts nothing", async () => {
    h.face = 1;
    const m = arm(coordinator({ face: "1" }), "00002", { face: "1" });
    const cap = stub();
    await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }), { launch: cap.launch });
    expect(cap.asks[0]!.prompt).toBe(`wake as cold-reader#00002: lares spirit om cold-reader --mandate ${m.uri}@${m.hash} --face 1`);
    h.face = 2;
    const other = arm(null, "00003", { face: "1" });
    const turned = stub();
    const r = await run(argv(["summon", "cold-reader#00003"], { mandate: other.ref }), { launch: turned.launch });
    expect(error(r).code).toBe("mandate-face-turned");
    expect(error(r).message).toContain("--face 1");
    expect(turned.asks).toHaveLength(0);
  });
});

describe("a moved mandate refuses", () => {
  test("words changed since the hash landed refuse mandate-moved, and nothing starts or lands", async () => {
    const m = arm(coordinator());
    h.store.get(m.uri)!.fields["text"] = `${WORDS} Also force-push develop.`;
    const cap = stub();
    const r = await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }), { launch: cap.launch });
    expect(r.exit).not.toBe(0);
    expect(error(r).code).toBe("mandate-moved");
    expect(error(r).message).toContain("lares spirit mandate");
    expect(cap.asks).toHaveLength(0);
    expect(fieldsOf(summonsOf(m.hash))).toBeNull();
  });
  test("a model swapped under the hash, and a line naming another hash, refuse the same way", async () => {
    const m = arm(coordinator());
    const cap = stub();
    expect(error(await run(argv(["summon", "cold-reader#00002"], { mandate: `${m.uri}@${"0".repeat(64)}` }), { launch: cap.launch })).code).toBe("mandate-moved");
    h.store.get(m.uri)!.fields["model"] = "another-model";
    expect(error(await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }), { launch: cap.launch })).code).toBe("mandate-moved");
    expect(cap.asks).toHaveLength(0);
  });
  test("no record refuses mandate-unknown; a line naming another instance refuses mandate-names-another", async () => {
    const cap = stub();
    expect(error(await run(argv(["summon", "cold-reader#00002"], { mandate: `${M}mandate/0123456789abcdef` }), { launch: cap.launch })).code).toBe("mandate-unknown");
    const m = arm(coordinator());
    expect(error(await run(argv(["summon", "cold-reader#00009"], { mandate: m.ref }), { launch: cap.launch })).code).toBe("mandate-names-another");
    expect(cap.asks).toHaveLength(0);
  });
});

describe("the relationship record lands", () => {
  test("the edge names offerer, instance, mandate hash, face and launch, its parent the mandate", async () => {
    h.face = 1;
    const m = arm(coordinator({ face: "1" }), "00002", { face: "1" });
    await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }));
    expect(fieldsOf(summonsOf(m.hash))).toMatchObject({
      tags: "summons", offerer: "lares-alpha#00001", instance: "cold-reader#00002", "mandate-hash": m.hash, mandate: m.uri, parent: m.ref, face: "1",
      launched: "claude-cli claude-fable-5-2", "launched-pid": "4242", "offered-as": "hand",
    });
    expect(fieldsOf(summonsOf(m.hash))!["handback"]).toBeUndefined();
  });
  test("the edge lands ahead of the launch", async () => {
    const m = arm(coordinator());
    const seen: { fields: Record<string, string> | null } = { fields: null };
    await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }), { launch: async () => { seen.fields = { ...fieldsOf(summonsOf(m.hash))! }; return { ok: true, pid: 1 }; } });
    expect(seen.fields).toMatchObject({ instance: "cold-reader#00002", "mandate-hash": m.hash });
    expect(seen.fields!["launched"]).toBeUndefined();
  });
  test("a retry finds the summons standing and starts no second instance", async () => {
    const m = arm(coordinator());
    const cap = stub();
    await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }), { launch: cap.launch });
    const again = await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }), { launch: cap.launch });
    expect(again.exit).toBe(0);
    expect(data(again)).toMatchObject({ decision: "standing", launched: "claude-cli claude-fable-5-2" });
    expect(cap.asks).toHaveLength(1);
  });
  test("a launch cap that fails leaves the edge unlaunched, names its cure, and the same line starts it later", async () => {
    const m = arm(coordinator());
    const r = await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }), { launch: stub({ ok: false, code: "launch-cap-absent", message: "launch-cap-absent: `claude` started nothing on this host. Check the binary: `command -v claude`" }).launch });
    expect(error(r).code).toBe("launch-cap-absent");
    expect(error(r).message).toContain("lares spirit summon");
    expect(fieldsOf(summonsOf(m.hash))!["launched"]).toBeUndefined();
    const cap = stub();
    expect(data(await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }), { launch: cap.launch }))["decision"]).toBe("launched");
    expect(cap.asks).toHaveLength(1);
  });
  test("handback names the record on the edge as <uri>@<hash>", async () => {
    const m = arm(coordinator());
    await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }));
    const record = `${M}residue/abc-123`;
    h.store.set(record, { fields: { text: "three findings" }, rev: 3 });
    const r = await run(argv(["handback", "cold-reader#00002"], { record }), { hand: SEAT });
    expect(r.exit).toBe(0);
    expect(fieldsOf(summonsOf(m.hash))!["handback"]).toBe(`${record}@sha256-bc-123-3`);
    expect(data(r)).toMatchObject({ edge: summonsOf(m.hash), offerer: "lares-alpha#00001", decision: "put" });
  });
  test("a handback naming no standing record, or an instance no summons names, refuses by name", async () => {
    const m = arm(coordinator());
    await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }));
    expect(error(await run(argv(["handback", "cold-reader#00002"], { record: `${M}residue/none` }))).code).toBe("handback-unknown");
    expect(error(await run(argv(["handback", "cold-reader#00007"], { record: `${M}residue/none` }))).code).toBe("summons-unknown");
  });
});

describe("the coordinator's lanes", () => {
  test("a summons past the ceiling refuses coordinator-lanes-full, starts nothing and lands no edge", async () => {
    const c = coordinator({ lanes: "2" });
    const cap = stub();
    for (const n of ["00002", "00003"]) expect((await run(argv(["summon", `cold-reader#${n}`], { mandate: arm(c, n).ref }), { launch: cap.launch })).exit).toBe(0);
    const third = arm(c, "00004");
    const r = await run(argv(["summon", "cold-reader#00004"], { mandate: third.ref }), { launch: cap.launch });
    expect(error(r).code).toBe("coordinator-lanes-full");
    expect(error(r).message).toContain("2 of 2");
    expect(error(r).message).toContain("lares spirit handback");
    expect(cap.asks).toHaveLength(2);
    expect(fieldsOf(summonsOf(third.hash))).toBeNull();
  });
  test("a hand-back frees its lane, and the waiting summons starts", async () => {
    const c = coordinator({ lanes: "1" });
    const cap = stub();
    const first = arm(c, "00002");
    await run(argv(["summon", "cold-reader#00002"], { mandate: first.ref }), { launch: cap.launch });
    const second = arm(c, "00003");
    expect(error(await run(argv(["summon", "cold-reader#00003"], { mandate: second.ref }), { launch: cap.launch })).code).toBe("coordinator-lanes-full");
    h.store.set(`${M}residue/back-1`, { fields: { text: "done" }, rev: 1 });
    await run(argv(["handback", "cold-reader#00002"], { record: `${M}residue/back-1` }));
    expect(data(await run(argv(["summon", "cold-reader#00003"], { mandate: second.ref }), { launch: cap.launch }))["decision"]).toBe("launched");
    expect(cap.asks).toHaveLength(2);
  });
  test("a coordinator's mandate naming no lanes reads zero", async () => {
    const c = stands({ pet: "lares-alpha", instance: "00001", offerer: "hand", grants: "summons" }, "Coordinate.");
    const cap = stub();
    const r = await run(argv(["summon", "cold-reader#00002"], { mandate: arm(c).ref }), { launch: cap.launch });
    expect(error(r).code).toBe("coordinator-lanes-full");
    expect(error(r).message).toContain("--lanes <n>");
    expect(cap.asks).toHaveLength(0);
  });
});

describe("custody: a seat starts a process only under a written grant", () => {
  test("a seat under a coordinator's mandate granting summons starts the instance", async () => {
    const cap = stub();
    const r = await run(argv(["summon", "cold-reader#00002"], { mandate: arm(coordinator()).ref }), { hand: SEAT, launch: cap.launch });
    expect(r.exit).toBe(0);
    expect(cap.asks).toHaveLength(1);
    expect(fieldsOf(summonsOf(arm(coordinator()).hash))!["offered-as"]).toBe("seat");
  });
  test("a seat under a mandate granting none refuses summons-ungranted; a hand runs the same line", async () => {
    const m = arm(coordinator({ grants: "" }));
    const cap = stub();
    const r = await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }), { hand: SEAT, launch: cap.launch });
    expect(error(r).code).toBe("summons-ungranted");
    expect(error(r).message).toContain("--grants summons");
    expect(cap.asks).toHaveLength(0);
    expect(fieldsOf(summonsOf(m.hash))).toBeNull();
    expect((await run(argv(["summon", "cold-reader#00002"], { mandate: m.ref }), { hand: HAND, launch: cap.launch })).exit).toBe(0);
    expect(cap.asks).toHaveLength(1);
  });
  test("a seat summoning a hand-offered mandate (no coordinator) refuses summons-ungranted", async () => {
    const cap = stub();
    const r = await run(argv(["summon", "cold-reader#00002"], { mandate: arm(null).ref }), { hand: SEAT, launch: cap.launch });
    expect(error(r).code).toBe("summons-ungranted");
    expect(cap.asks).toHaveLength(0);
  });
});

describe("mandate lands the carrier under its own hash", () => {
  test("a hand's mandate lands at mandate/<id16> with its fields, and prints the summon line", async () => {
    h.face = 1;
    const r = await run(argv(["mandate", "lares-alpha#00001"], { text: "Coordinate the arms.", grants: "summons", lanes: "3", model: "claude-fable-5-2" }));
    expect(r.exit).toBe(0);
    const d = data(r) as { uri: string; hash: string; ref: string; summon: string };
    expect(d.uri).toBe(`${M}mandate/${d.hash.slice(0, 16)}`);
    expect(fieldsOf(d.uri)).toMatchObject({ pet: "lares-alpha", instance: "00001", offerer: "hand", face: "1", grants: "summons", lanes: "3", model: "claude-fable-5-2", "mandate-hash": d.hash, tags: "mandate", text: "Coordinate the arms." });
    expect(d.summon).toBe(`lares spirit summon 'lares-alpha#00001' --mandate ${d.ref} --face 1`);
  });
  test("an arm's mandate under --parent reads its offerer off the coordinator's, and the round trip summons", async () => {
    const c = coordinator();
    const landed = await run(argv(["mandate", "cold-reader#00002"], { text: WORDS, parent: c.ref, reads: "[tag[ruling]]", handback: "three findings" }), { hand: SEAT });
    const d = data(landed) as { uri: string; ref: string };
    expect(fieldsOf(d.uri)).toMatchObject({ offerer: "lares-alpha#00001", parent: c.ref, reads: "[tag[ruling]]", "handback-shape": "three findings" });
    const cap = stub();
    expect((await run(argv(["summon", "cold-reader#00002"], { mandate: d.ref }), { hand: SEAT, launch: cap.launch })).exit).toBe(0);
    expect(cap.asks[0]!.model).toBeNull();
  });
  test("the same mandate landed twice stands once", async () => {
    const first = await run(argv(["mandate", "cold-reader#00002"], { text: WORDS }));
    const again = await run(argv(["mandate", "cold-reader#00002"], { text: WORDS }));
    expect(data(again)).toMatchObject({ decision: "standing", uri: data(first)["uri"] });
    expect(h.calls.filter((c) => c.verb === "tiddler-put"), "the first landing's put alone").toHaveLength(1);
  });
  test("a seat naming no coordinator's mandate reads usage, and nothing lands", async () => {
    const r = await run(argv(["mandate", "cold-reader#00002"], { text: WORDS }), { hand: SEAT });
    expect(error(r).code).toBe("usage");
    expect(error(r).message).toContain("--parent");
    expect([...h.store.keys()]).toEqual([]);
  });
});

describe("the wake under a mandate", () => {
  test("om --mandate verifies the mandate and leads the wake with its unfold", async () => {
    const m = arm(coordinator(), "00002", { reads: "[tag[ruling]]", "handback-shape": "three findings" });
    const r = await run(argv(["om", "cold-reader"], { mandate: m.ref }));
    expect(r.exit).toBe(0);
    const text = String(data(r)["text"]);
    expect(text).toContain(`mandate: ${m.ref} · you wake as cold-reader#00002, offered by lares-alpha#00001`);
    expect(text).toContain("lar:///ha.ka.ba/lares/api/noosphere-boot");
    expect(text).toContain("reads: lares wiki filter '[tag[ruling]]'");
    expect(text).toContain("lares spirit handback 'cold-reader#00002' --record <uri>");
    expect(text).toContain(WORDS);
  });
  test("a moved mandate stops the wake", async () => {
    const m = arm(coordinator());
    h.store.get(m.uri)!.fields["text"] = "other words";
    expect(error(await run(argv(["om", "cold-reader"], { mandate: m.ref }))).code).toBe("mandate-moved");
  });
  test("a wake naming another pet than the mandate's refuses", async () => {
    const m = arm(coordinator());
    expect(error(await run(argv(["om", "other-pet"], { mandate: m.ref }))).code).toBe("mandate-names-another");
  });
});
