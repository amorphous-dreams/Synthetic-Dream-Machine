/**
 * meme-command.test.ts — `lares meme`, the one family for every law over meme text.
 *
 * A VERB DECLARES ITS SEAT. `normalize` · `check` · `project --to md` run LOCAL over a file with no daemon
 * in reach — the offline re-stamp of a stale block check keeps working with no socket. `project --to html|tid|json`,
 * and `project` over a `lar:` uri, ride the daemon verb. A family moves through the call door (`lares put title=…`
 * lands a carrier or one slot, `lares delete title=… family=true` removes it, `lares get meme=true` lists). Proven
 * here: the argument law (both targets refuse; a bare `lares meme` prints usage and returns 2), the verb args the
 * daemon receives, the exit classes a receipt maps to (a CONFLICT exits as `conflict`, an absent family as
 * `not-found`), that the local seats put NOTHING on the wire, and that `project --to md` over a file writes the pair
 * `projectSubmission` renders, byte for byte.
 */
import { afterEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectSubmission } from "@lararium/tw5/weave";
import { stampCarrier, verifyBcc } from "@lararium/memetic-frame";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown>; face?: number }>,
  reply: {} as Record<string, unknown>,
  refuse: "" as string,
  /** A reply chosen per call, for a verb a door asks more than once; null reads `reply`. */
  replyFor: null as null | ((args: Record<string, unknown>) => Record<string, unknown>),
}));
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  verbFailure: (err: unknown) => ({ code: "error", message: err instanceof Error ? err.message : String(err) }),
  runVerbAsFace: async (verb: string, args: Record<string, unknown>, face: number) => {
    h.calls.push({ verb, args, face });
    if (h.refuse) return { status: "error", requestId: "r", errorMessage: h.refuse };
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: { ...(h.replyFor ? h.replyFor(args) : h.reply), face } } } };
  },
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    if (h.refuse) return { status: "error", requestId: "r", errorMessage: h.refuse };
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.replyFor ? h.replyFor(args) : h.reply } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { cmdMeme, projectPlan, bagsResolver } from "../src/commands/meme.js";
import { cmdCall, callPlan, type CallSources } from "../src/commands/call.js";
import { repoRoot } from "@lararium/mesh/node";
import { parseArgs, type ParsedArgs } from "../src/parse-args.js";

const memeArgs = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "meme", positional, options, flags: { json: true, ...flags } } as unknown as ParsedArgs);
/** A call line as a terminal types it (`lares put title=… file=…`), `--json` asked unless the line names `--no-json`. */
const callArgs = (...tokens: string[]): ParsedArgs => {
  const parsed = parseArgs(tokens);
  return parsed.flags["json"] === undefined ? { ...parsed, flags: { ...parsed.flags, json: true } } : parsed;
};
/** The call a line sends the vessel: its verb word, its params as they crossed, the surface `cli`. */
const sent = (verb: string, params: Record<string, string>) => ({ verb: "call", args: { verb, params, surface: "cli" } });
/** The carrier stamp a call's answer carries, so the door prints it by the carrier that shaped it. */
const by = (address: string): Record<string, unknown> => ({ carrier: { carrier: `lar:///ha.ka.ba/lares/afford/${address}`, hash: "sha256:c" } });
/** No host crossing reached. */
const NO_SOURCES: CallSources = { read: () => { throw new Error("no file read"); }, stdin: async () => { throw new Error("no stdin read"); } };

/** Run a door and hand back its exit, the one JSON line `--json` printed (if any), and every human line. */
async function said(run: () => Promise<number>): Promise<{ code: number; json: Record<string, unknown> | null; lines: string[]; errors: string[] }> {
  const out: string[] = [];
  const lines: string[] = [];
  const errors: string[] = [];
  const write = vi.spyOn(process.stdout, "write").mockImplementation((m: unknown) => { out.push(String(m)); return true; });
  const log = vi.spyOn(console, "log").mockImplementation((...m: unknown[]) => { lines.push(m.join(" ")); out.push(m.join(" ") + "\n"); });
  const err = vi.spyOn(console, "error").mockImplementation((...m: unknown[]) => { errors.push(m.join(" ")); });
  try {
    const code = await run();
    const last = out.join("").trim().split("\n").filter((l) => l.startsWith("{")).at(-1);
    return { code, json: last ? JSON.parse(last) as Record<string, unknown> : null, lines, errors };
  } finally { write.mockRestore(); log.mockRestore(); err.mockRestore(); }
}

const REPO = new URL("../../..", import.meta.url).pathname;
/** A real carrier, so the local seats read every mark a hand-built stub would lack. */
const PRISM = join(REPO, "bags/lares/ha.ka.ba/lares/api/pono/prism.mem");

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); h.calls.length = 0; h.refuse = ""; h.replyFor = null; });
const tmpFile = (text: string): string => {
  const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
  const p = join(d, "x.mem"); writeFileSync(p, text, "utf8"); return p;
};

describe("the meme door's argument law, no daemon", () => {
  test("the meme door names no family write: put, patch, list and delete read as any unknown sub-verb (the call door holds them)", async () => {
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const sub of ["put", "patch", "list", "delete"]) {
      expect(await cmdMeme(memeArgs([sub, "lar:///t/x"], { recipe: "default" }))).toBe(2);
    }
    stderr.mockRestore();
    expect(h.calls).toEqual([]);
  });
  test("ONE DOOR READS: `lares get title=<uri> aperture=arc` reads a meme; the meme door names no get", async () => {
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cmdMeme(memeArgs(["get", "lar:///t/x"], { recipe: "default" }, { json: false }))).toBe(2);
    expect(stderr.mock.calls.flat().join(" ")).toMatch(/unknown sub-verb "get"/);
    stderr.mockRestore();
    expect(h.calls).toEqual([]);
  });
  test("CONTROL: every store planner forwards exactly either explicit target", async () => {
    for (const verb of ["put", "delete"] as const) {
      expect((await callPlan(parseArgs([verb, "title=lar:///t/x", "recipe=r"]), NO_SOURCES)).plan).toEqual(sent(verb, { title: "lar:///t/x", recipe: "r" }));
      expect((await callPlan(parseArgs([verb, "title=lar:///t/x", "bag=b"]), NO_SOURCES)).plan).toEqual(sent(verb, { title: "lar:///t/x", bag: "b" }));
    }
    expect(projectPlan(memeArgs(["project", "lar:///t/x"], { to: "md", recipe: "r" })).container).toEqual({ recipe: "r" });
    expect(projectPlan(memeArgs(["project", "lar:///t/x"], { to: "md", bag: "b" })).container).toEqual({ bag: "b" });
  });
  test("the family listing rides the call door: `lares get meme=true` sends its container and tree= as params", async () => {
    expect((await callPlan(parseArgs(["get", "meme=true", "bag=sdm"]), NO_SOURCES)).plan).toEqual(sent("get", { meme: "true", bag: "sdm" }));
    expect((await callPlan(parseArgs(["get", "meme=true", "recipe=lares", "tree=true", "face=2"]), NO_SOURCES))).toEqual({ plan: sent("get", { meme: "true", recipe: "lares", tree: "true" }), face: "2" });
  });
  test("a bag beside realm= names that bag's realm: both ride the call as written, for the VM to bind", async () => {
    const realm = "c1ab".repeat(16);
    expect((await callPlan(parseArgs(["put", "title=lar:///t/x", "bag=sdm", `realm=${realm}`]), NO_SOURCES)).plan).toEqual(sent("put", { title: "lar:///t/x", bag: "sdm", realm }));
  });
});

describe("lares put — a family's carrier and its slots ride the plain put", () => {
  const landed = { recipe: "default", title: "lar:///t/x", decision: "put", created: false, changed: ["text"], hash: "sha256-record", position: "root", canonicalHash: "sha256:1", landed: ["lar:///t/x"], kept: [], tombstoned: [], warnings: [], ...by("engine.record.puts") };

  test("★ a whole carrier off file= sends one put: title · text · bag · base ★", async () => {
    h.reply = landed;
    const file = tmpFile("<<^ code=`&#x0001;`>> hello");
    const { code } = await said(() => cmdCall(callArgs("put", "title=lar:///t/x", `file=${file}`, "bag=sdm", "base=sha256:0")));
    expect(code).toBe(0);
    expect(h.calls).toEqual([sent("put", { title: "lar:///t/x", text: "<<^ code=`&#x0001;`>> hello", bag: "sdm", base: "sha256:0" })]);
  });

  test("EACH HAT REACHED BY NAME: `face=1` rides a session of face h1 (never the one-shot), and the answer names the face it landed in", async () => {
    h.reply = landed;
    const { code, json } = await said(() => cmdCall(callArgs("put", "title=lar:///t/x", `file=${tmpFile("hello")}`, "bag=lar:///ha.ka.ba/bags/daemon-r1", "face=1")));
    expect(code).toBe(0);
    expect(h.calls).toEqual([{ ...sent("put", { title: "lar:///t/x", text: "hello", bag: "lar:///ha.ka.ba/bags/daemon-r1" }), face: 1 }]);
    expect(json).toMatchObject({ ok: true, data: { face: 1 } });
  });

  test("a SHUT face refuses `face-not-open` by name; a malformed `face=` refuses before any door opens", async () => {
    h.refuse = "face-not-open: face h3 stands shut on this vessel (face-locked)";
    const shut = await said(() => cmdCall(callArgs("put", "title=lar:///t/x", `file=${tmpFile("x")}`, "face=3")));
    expect(shut.code).not.toBe(0);
    expect(shut.json).toMatchObject({ ok: false, error: { code: "face-not-open" } });
    h.refuse = ""; h.calls.length = 0;
    const malformed = await said(() => cmdCall(callArgs("put", "title=lar:///t/x", `file=${tmpFile("x")}`, "face=one")));
    expect(malformed.code).toBe(2);
    expect(JSON.stringify(malformed.json)).toMatch(/face-malformed/);
    expect(h.calls).toEqual([]);
  });

  test("a CONFLICT answer exits as the conflict class; so does `exists` under create=true", async () => {
    h.reply = { ...landed, decision: "conflict", landed: [], hash: "sha256-moved" };
    expect((await said(() => cmdCall(callArgs("put", "title=lar:///t/x", `file=${tmpFile("x")}`)))).code).toBe(4);
    h.reply = { ...landed, decision: "exists", landed: [] };
    const exists = await said(() => cmdCall(callArgs("put", "title=lar:///t/x", `file=${tmpFile("x")}`, "create=true")));
    expect(exists.code).toBe(4);
    expect((h.calls.at(-1)!.args["params"] as Record<string, unknown>)["create"]).toBe("true");
  });

  test("a gate refusal crosses by its own code, never as a landing", async () => {
    h.refuse = "family-gate-refused: the text reads as no one carrier";
    const out = await said(() => cmdCall(callArgs("put", "title=lar:///t/x", `file=${tmpFile("x")}`)));
    expect(out.code).toBe(4);
    expect(out.json).toMatchObject({ ok: false, error: { hint: "refusal: family-gate-refused" } });
  });

  test("a put naming no container sends none: the carrier's #/takes binds recipe=default in the VM", async () => {
    h.reply = landed;
    expect((await said(() => cmdCall(callArgs("put", "title=lar:///t/x", "text=x")))).code).toBe(0);
    expect(h.calls).toEqual([sent("put", { title: "lar:///t/x", text: "x" })]);
  });
});

describe("lares put slot= — a slot's text needs no base", () => {
  const slotLanded = { recipe: "default", title: "lar:///t/x#/a", decision: "put", created: false, changed: ["text"], hash: "sha256-slot", position: "slot", canonicalHash: "sha256:2", landed: ["lar:///t/x#/a"], kept: ["lar:///t/x#/b"], tombstoned: [], warnings: [], ...by("engine.record.puts") };

  test("★ append=- on a slot reads stdin and sends the slot beside the title, the append its words ★", async () => {
    h.reply = slotLanded;
    const stdin: CallSources = { read: () => { throw new Error("no file read"); }, stdin: async () => Buffer.from("* a new bullet\n") };
    expect((await said(() => cmdCall(callArgs("put", "title=lar:///t/x", "slot=#/a", "append=-"), stdin))).code).toBe(0);
    expect(h.calls).toEqual([sent("put", { title: "lar:///t/x", slot: "#/a", append: "* a new bullet\n" })]);
  });

  test("★ a slot's file= with no base= sends cleanly; the human answer names the counts and both bases, each by its use ★", async () => {
    h.reply = slotLanded;
    const out = await said(() => cmdCall(callArgs("put", "title=lar:///t/x", "slot=#/a", `file=${tmpFile("new body")}`, "bag=sdm", "--no-json")));
    expect(out.code).toBe(0);
    expect(h.calls).toEqual([sent("put", { title: "lar:///t/x", slot: "#/a", text: "new body", bag: "sdm" })]);
    expect(out.lines).toContain("  landed 1 · kept 1 · tombstoned 0");
    expect(out.lines.some((l) => l.startsWith("  base: sha256-slot (record"))).toBe(true);
    expect(out.lines.some((l) => l.startsWith("  base: sha256:2 (carrier"))).toBe(true);
  });

  test("a partial base a slot read handed back rides the put as written", async () => {
    h.reply = slotLanded;
    await said(() => cmdCall(callArgs("put", "title=lar:///t/x#/a", "text=new body", "base=partial:#/a:sha256:1")));
    expect(h.calls).toEqual([sent("put", { title: "lar:///t/x#/a", text: "new body", base: "partial:#/a:sha256:1" })]);
  });
});

describe("lares delete family=true — the removal, in a recipe or a bag", () => {
  test("★ sends title · container · base · family ★", async () => {
    h.reply = { recipe: "sdm", title: "lar:///t/x", decision: "removed", tombstoned: [], retracted: ["lar:///t/x", "lar:///t/x#/a"], canonicalHash: "sha256:1", ...by("engine.record.removes") };
    expect((await said(() => cmdCall(callArgs("delete", "title=lar:///t/x", "recipe=sdm", "base=sha256:1", "family=true")))).code).toBe(0);
    expect(h.calls).toEqual([sent("delete", { title: "lar:///t/x", recipe: "sdm", base: "sha256:1", family: "true" })]);
  });
  test("★ family=true bag= takes the family out of one bag ★", async () => {
    h.reply = { bag: "sdm", title: "lar:///t/x", decision: "removed", tombstoned: [], retracted: ["lar:///t/x"], ...by("engine.record.removes") };
    const out = await said(() => cmdCall(callArgs("delete", "title=lar:///t/x", "bag=sdm", "family=true", "--no-json")));
    expect(out.code).toBe(0);
    expect(h.calls).toEqual([sent("delete", { title: "lar:///t/x", bag: "sdm", family: "true" })]);
    expect(out.lines).toContain("  tombstoned 0 · retracted 1");
  });
  test("a slot's title deletes plainly: the door lands it as the cut on its parent", async () => {
    h.reply = { recipe: "default", title: "lar:///t/x#/a", decision: "removed", tombstoned: [], retracted: ["lar:///t/x#/a"], ...by("engine.record.removes") };
    expect((await said(() => cmdCall(callArgs("delete", "title=lar:///t/x#/a")))).code).toBe(0);
    expect(h.calls).toEqual([sent("delete", { title: "lar:///t/x#/a" })]);
  });
  test("★ CONTROL: a stale base= answers conflict — exit class conflict, nothing moved ★", async () => {
    h.reply = { recipe: "default", title: "lar:///t/x", decision: "conflict", tombstoned: [], hash: "sha256:2", ...by("engine.record.removes") };
    expect((await said(() => cmdCall(callArgs("delete", "title=lar:///t/x", "base=sha256:1", "family=true")))).code).toBe(4);
  });
  test("an absent root exits not-found", async () => {
    h.reply = { bag: "sdm", title: "lar:///t/x", decision: "absent", tombstoned: [], ...by("engine.record.removes") };
    expect((await said(() => cmdCall(callArgs("delete", "title=lar:///t/x", "bag=sdm", "family=true")))).code).toBe(3);
  });
});

describe("lares meme (bare)", () => {
  test("prints usage and returns 2; an unknown sub-verb the same", async () => {
    expect(await cmdMeme(memeArgs([]))).toBe(2);
    expect(await cmdMeme(memeArgs(["frob"]))).toBe(2);
    expect(h.calls).toEqual([]);
  });
  test("the usage names every sub-verb and its seat", async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((m: unknown) => { lines.push(String(m)); });
    await cmdMeme(memeArgs([]));
    spy.mockRestore();
    const usage = lines.join("\n");
    for (const sub of ["normalize", "check", "project"]) expect(usage).toMatch(new RegExp(`lares meme ${sub} `));
    expect(usage).toMatch(/lares meme project  render a meme to a target: md, html, tid or json/);
  });
});

/** A copy of the prism carrier with one byte moved inside its checked span — the check alone disagrees. */
const staledPrism = (): string => {
  const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
  const p = join(d, "prism.mem");
  writeFileSync(p, readFileSync(PRISM, "utf8").replace("The node summons it.", "The node summons it, once."), "utf8");
  return p;
};

describe("lares meme check — the read-alone seat, local, no daemon", () => {
  test("★ a staled check reads as drift, exits 1, writes nothing, and puts nothing on the wire ★", async () => {
    const file = staledPrism();
    const before = readFileSync(file, "utf8");
    expect(verifyBcc(before)).toBe("mismatch");
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((m: unknown) => { lines.push(String(m)); });
    const code = await cmdMeme(memeArgs(["check", file]));
    spy.mockRestore();
    expect(code).toBe(1);
    expect(lines.join("\n")).toMatch(/would re-stamp/);
    expect(readFileSync(file, "utf8")).toBe(before);
    expect(h.calls).toEqual([]);
  });
  test("CONTROL: a canonical carrier reads clean and exits 0", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await cmdMeme(memeArgs(["check", PRISM]))).toBe(0);
    vi.restoreAllMocks();
  });
  test("RED: a root meta holding file-path reads as drift; CONTROL: the same carrier without it reads clean", async () => {
    // Residency rides the envelope: the check names the field, whatever the seal says, and the
    // carrier stripped of it (re-sealed) reads canonical.
    const src = readFileSync(PRISM, "utf8").replace(/^file-path[ \t]*=.*\n/m, "");
    const without = stampCarrier(src);
    const withField = stampCarrier(without.replace(/^(cacheable[ \t]*=.*\n)/m, `$1file-path = "bags/x/prism.mem"\n`));
    expect(withField).toMatch(/^file-path = /m);
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((m: unknown) => { lines.push(String(m)); });
    expect(await cmdMeme(memeArgs(["check", tmpFile(withField)]))).toBe(1);
    expect(lines.join("\n")).toMatch(/file-path/);
    expect(await cmdMeme(memeArgs(["check", tmpFile(without)]))).toBe(0);
    spy.mockRestore();
    expect(h.calls).toEqual([]);
  });
  test("--gradient and --edges ride check: read alone, write nothing", async () => {
    const file = staledPrism();
    const before = readFileSync(file, "utf8");
    vi.spyOn(console, "log").mockImplementation(() => {});
    // The gradient reading names the staled check as a fault (exit 1); the edges reading names the
    // addresses this one carrier points at that no file in the run holds (exit 1) — both read alone.
    expect(await cmdMeme(memeArgs(["check", file], {}, { gradient: true }))).toBe(1);
    expect(await cmdMeme(memeArgs(["check", PRISM], {}, { gradient: true }))).toBe(0);
    expect(await cmdMeme(memeArgs(["check", file], {}, { edges: true }))).toBe(1);
    vi.restoreAllMocks();
    expect(readFileSync(file, "utf8")).toBe(before);
    expect(h.calls).toEqual([]);
  });
  test("--edges reads a link into the founding road as homed in the kahu workbench, never as naming nothing", async () => {
    const base = stampCarrier(readFileSync(PRISM, "utf8").replace(/^file-path[ \t]*=.*\n/m, ""));
    const withRoad = stampCarrier(base.replace(/(\n<<\^ code=`&#x0003;`)/, "\n<<~ loulou uri=`lar:///ha.ka.ba/lares/docs/road/rank-4j`>>\n$1"));
    expect(withRoad).toContain("docs/road/rank-4j");
    const read = async (src: string): Promise<[number, number, number]> => {
      const lines: string[] = [];
      vi.spyOn(console, "log").mockImplementation((m: unknown) => { lines.push(String(m)); });
      await cmdMeme(memeArgs(["check", tmpFile(src)], {}, { edges: true }));
      vi.restoreAllMocks();
      const m = /(\d+) edge\(s\) · (\d+) homed in the kahu workbench · (\d+) naming nothing/.exec(lines.join("\n"));
      expect(m, lines.join("\n")).not.toBeNull();
      return [Number(m![1]), Number(m![2]), Number(m![3])];
    };
    const [e0, w0, n0] = await read(base);
    const [e1, w1, n1] = await read(withRoad);
    expect([e1 - e0, w1 - w0, n1 - n0]).toEqual([1, 1, 0]);
  });
  test("no file names usage", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cmdMeme(memeArgs(["check"]))).toBe(2);
    vi.restoreAllMocks();
  });
});

describe("lares meme normalize — the write seat, local, no daemon", () => {
  test("★ re-stamps the check over the body it follows, and the gesture repeats clean ★", async () => {
    const file = staledPrism();
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await cmdMeme(memeArgs(["normalize", file]))).toBe(0);
    expect(verifyBcc(readFileSync(file, "utf8"))).toBe("ok");
    expect(await cmdMeme(memeArgs(["check", file]))).toBe(0);
    vi.restoreAllMocks();
    expect(h.calls).toEqual([]);
  });
  test("★ a FRAMED carrier holding NO check gets one MINTED — minting on absent reads pono ★", async () => {
    // The operator ruling, and this fixture is the one that always exercised the case honestly: it keeps
    // the ETX sigil and strips only the slot value, so a span stands for a check to cover. Read-optional,
    // emit-always is the fault it cures — the grammar rules the BCC optional on READ while the emitter
    // mints one unconditionally, so a hand-authored carrier lands legal on every gate its author runs
    // and red on the one they do not.
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    const bare = join(d, "bare.mem");
    const src = readFileSync(PRISM, "utf8").replace(/ bcc=`ni:\/\/\/[^`\n]*`/, "");
    writeFileSync(bare, src, "utf8");
    expect(verifyBcc(readFileSync(bare, "utf8")), "the fixture never lost its slot value").toBe("unchecked");
    vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdMeme(memeArgs(["normalize", bare]));
    vi.restoreAllMocks();
    expect(verifyBcc(readFileSync(bare, "utf8"))).toBe("ok");
  });
});

describe("projectPlan — the seat law, no daemon", () => {
  test("a target off the list refuses; a missing --to refuses; --recipe with --bag refuses", () => {
    expect(() => projectPlan(memeArgs(["project", "x.mem"], { to: "pdf" }))).toThrow(/--to/);
    // The carrier itself reads through the one door (`lares get title=<uri> aperture=arc`): `mem` left the targets.
    expect(() => projectPlan(memeArgs(["project", "lar:///t/x"], { to: "mem", recipe: "default" }))).toThrow(/--to names the target, one of md · html · tid · json/);
    expect(() => projectPlan(memeArgs(["project", "x.mem"]))).toThrow(/--to/);
    expect(() => projectPlan(memeArgs(["project", "lar:///t/x"], { to: "html", recipe: "sdm", bag: "sdm" }))).toThrow(/no-container/);
  });
  test("local file projection refuses two named containers before creating output", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    const source = join(d, "source.mem");
    const output = join(d, "rendered");
    writeFileSync(source, "<<^ code=`&#x0001;`>> local\n", "utf8");
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cmdMeme(memeArgs(["project", source], { to: "md", out: output, recipe: "a", bag: "b" }, { json: false }))).toBe(2);
    expect(stderr.mock.calls.flat().join(" ")).toMatch(/no-container.*--recipe.*--bag/s);
    stderr.mockRestore();
    expect(existsSync(join(output, "source.md"))).toBe(false);
    expect(existsSync(join(output, "source.md.meta"))).toBe(false);
    expect(h.calls).toEqual([]);
  });
});

describe("lares meme project --to md over a file — local, byte for byte", () => {
  test("★ writes <name>.md + <name>.md.meta as projectSubmission renders them, and touches no wire ★", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await cmdMeme(memeArgs(["project", PRISM], { to: "md", out: d }));
    vi.restoreAllMocks();
    expect(code).toBe(0);
    const want = projectSubmission(readFileSync(PRISM, "utf8"), { resolve: bagsResolver(repoRoot) });
    expect(readFileSync(join(d, "prism.md"), "utf8")).toBe(want.markdown);
    expect(readFileSync(join(d, "prism.md.meta"), "utf8")).toBe(want.meta);
    expect(h.calls).toEqual([]);
  });
  test("with no flag the pair's title takes the ruled form `submissions/<name>`", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdMeme(memeArgs(["project", PRISM], { to: "md", out: d }));
    vi.restoreAllMocks();
    expect(readFileSync(join(d, "prism.md.meta"), "utf8")).toContain("title: lar:///ha.ka.ba/lares/api/pono/submissions/prism\n");
  });

  test("--dialect GFM writes frontmatter-carrying markdown PLUS the .md.meta sidecar (LOOP 6: every profile keeps one)", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await cmdMeme(memeArgs(["project", PRISM], { to: "md", out: d, dialect: "GFM" }));
    vi.restoreAllMocks();
    expect(code).toBe(0);
    const body = readFileSync(join(d, "prism.md"), "utf8");
    expect(body.startsWith("---\n")).toBe(true);
    expect(body).toContain('variant: "GFM"');
    expect(existsSync(join(d, "prism.md.meta"))).toBe(true);
    const meta = readFileSync(join(d, "prism.md.meta"), "utf8");
    expect(meta).toContain("variant: GFM");
  });

  // prism.mem pins RFC-2119 by `kanawai` (binding), retargeted (LOOP 7, Canon-Scribe's sibling
  // work) to the reference meme `lar:///ha.ka.ba/lares/ref/RFC-2119` — no fragment. Under
  // CommonMark it weaves as a citation-plus-pin (a kramdown-only special case fires the BCP 14
  // boilerplate instead; see weave.test.ts). Rendering follows the TARGET, never position.
  test("a frozen `kanawai` PINS for real: local weave resolves against the repo's own bags/ corpus", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await cmdMeme(memeArgs(["project", PRISM], { to: "md", out: d }));
    vi.restoreAllMocks();
    expect(code).toBe(0);
    const body = readFileSync(join(d, "prism.md"), "utf8");
    expect(body).toContain("- `kanawai lar:///ha.ka.ba/lares/ref/RFC-2119` — pinned `ni:///sha-256;");
    expect(body).not.toContain("unresolved — no corpus to pin");
  });

  test("--tongue en weaves the `kanawai` pin as `law`, its head name's primary mirror for English", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await cmdMeme(memeArgs(["project", PRISM], { to: "md", out: d, tongue: "en" }));
    vi.restoreAllMocks();
    expect(code).toBe(0);
    const body = readFileSync(join(d, "prism.md"), "utf8");
    expect(body).toContain("- `law lar:///ha.ka.ba/lares/ref/RFC-2119` — pinned `ni:///sha-256;");
    expect(body).not.toContain("- `kanawai ");
  });

  test("CONTROL: with NO --tongue, the same `kanawai` pin weaves under its canonical name, byte-identical to before", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await cmdMeme(memeArgs(["project", PRISM], { to: "md", out: d }));
    vi.restoreAllMocks();
    expect(code).toBe(0);
    const body = readFileSync(join(d, "prism.md"), "utf8");
    expect(body).toContain("- `kanawai lar:///ha.ka.ba/lares/ref/RFC-2119` — pinned `ni:///sha-256;");
    expect(body).not.toContain("- `law ");
  });

  test("--tongue en --dialect GFM: frontmatter carries lang and tongue: \"x-lares>en\"", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await cmdMeme(memeArgs(["project", PRISM], { to: "md", out: d, tongue: "en", dialect: "GFM" }));
    vi.restoreAllMocks();
    expect(code).toBe(0);
    const body = readFileSync(join(d, "prism.md"), "utf8");
    expect(body).toContain('lang: "en"');
    expect(body).toContain('tongue: "x-lares>en"');
    expect(body).toContain("- `law ");
  });

  test("CONTROL: an unrecognized --dialect refuses, naming the registered variants", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await cmdMeme(memeArgs(["project", PRISM], { to: "md", out: d, dialect: "markdown-extra" }));
    vi.restoreAllMocks();
    expect(code).not.toBe(0);
  });
});

describe("lares meme project store targets", () => {
  test("a store project naming no container reads the worn face's daemon wiki (recipe default), a uri or a file alike", () => {
    expect(projectPlan(memeArgs(["project", "lar:///t/x"], { to: "html" })).container).toEqual({ recipe: "default" });
    expect(projectPlan(memeArgs(["project", "/path/that/must/not/be/read"], { to: "html" })).container).toEqual({ recipe: "default" });
    // CONTROL: a local md projection over a file names no container at all.
    expect(projectPlan(memeArgs(["project", "/path/that/must/not/be/read"], { to: "md" })).container).toEqual({});
  });
});

/**
 * A bare re-project over an EXISTING pair reads its own `.md.meta`'s `variant:`/`tongue:` as the
 * default target — the pair already names what it was woven for, the same record `--check` reads
 * back. Before this clause, a bare re-project always fell to CommonMark/no-tongue and clobbered a
 * standalone profile's frontmatter + normative list (operator ruling 1). A real kramdown-shaped
 * corpus carrier (`docs/pono/lar-uri.mem` — pinned ground, same as weave.test.ts's own use of it)
 * proves it rather than a hand-built stub.
 */
describe("lares meme project --to md — a bare re-project reads the pair's OWN recorded target", () => {
  const LAR_URI = join(REPO, "bags/lares/ha.ka.ba/lares/docs/pono/lar-uri.mem");

  test("★ RED→GREEN: a bare re-project of a standing kramdown pair keeps its dialect — no flags, no clobber ★", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    // Mint the pair once, explicitly, under kramdown-rfc2629 + a tongue.
    await cmdMeme(memeArgs(["project", LAR_URI], { to: "md", out: d, dialect: "kramdown-rfc2629", tongue: "en" }));
    const metaBefore = readFileSync(join(d, "lar-uri.md.meta"), "utf8");
    expect(metaBefore).toContain("variant: kramdown-rfc2629");
    expect(metaBefore).toContain("tongue: en");

    // Re-project BARE — no --dialect, no --tongue. The fix: read the pair's own meta back.
    const code = await cmdMeme(memeArgs(["project", LAR_URI], { to: "md", out: d }));
    vi.restoreAllMocks();
    expect(code).toBe(0);
    const body = readFileSync(join(d, "lar-uri.md"), "utf8");
    // The frontmatter + normative list are what the bug clobbered — gone entirely under a silent
    // fall to CommonMark.
    expect(body.startsWith("---\n")).toBe(true);
    expect(body).toContain('variant: "kramdown-rfc2629"');
    expect(body).toContain('docname: "draft-fontany-lar-uri-scheme-00"');
    expect(body).toContain("normative:");
    // lar-uri.mem pins the BCP 14 key-words source by `kanawai`; under kramdown-rfc2629 that fires
    // the boilerplate special case (weave.test.ts's own ground) — its presence proves the dialect
    // (never CommonMark's plain citation bullet) survived the bare re-project.
    expect(body).toContain('The key words "MUST"');
    expect(readFileSync(join(d, "lar-uri.md.meta"), "utf8")).toBe(metaBefore);
  });

  test("CONTROL: an explicit --dialect on the re-project wins over the pair's own recorded variant, field by field", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdMeme(memeArgs(["project", LAR_URI], { to: "md", out: d, dialect: "kramdown-rfc2629", tongue: "en" }));
    // Only --dialect given this time — no --tongue. Each flag defaults from meta INDEPENDENTLY
    // (operator ruling 1: "explicit flags still win", read per field), so the recorded tongue
    // "en" still carries even though the dialect flag overrides the recorded variant.
    const code = await cmdMeme(memeArgs(["project", LAR_URI], { to: "md", out: d, dialect: "GFM" }));
    vi.restoreAllMocks();
    expect(code).toBe(0);
    const meta = readFileSync(join(d, "lar-uri.md.meta"), "utf8");
    expect(meta).toContain("variant: GFM");
    expect(meta).toContain("tongue: en");
    const body = readFileSync(join(d, "lar-uri.md"), "utf8");
    expect(body).toContain('variant: "GFM"');
    // Outside kramdown-rfc2629's BCP-14 special case, a `kanawai` pin weaves its ordinary citation
    // bullet under the tongue's own head-word mirror ("law", English) — proof the recorded tongue
    // carried through this GFM re-project.
    expect(body).toContain("- `law ");
  });

  test("CONTROL: a pair with NO recorded meta (a first projection) keeps today's CommonMark default", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await cmdMeme(memeArgs(["project", LAR_URI], { to: "md", out: d }));
    vi.restoreAllMocks();
    expect(code).toBe(0);
    const body = readFileSync(join(d, "lar-uri.md"), "utf8");
    expect(body.startsWith("---\n")).toBe(false);
    const meta = readFileSync(join(d, "lar-uri.md.meta"), "utf8");
    expect(meta).not.toContain("variant:");
  });
});

/**
 * The `project --to md --check <file|dir>` door
 * re-projects each named pair's SOURCE (read off the meta's `source:` field, resolved against the
 * repo's `bags/lares` tree) and compares in memory — no write, no wire. `PRISM`'s own declared
 * address (`lar:///ha.ka.ba/lares/api/pono/prism`) resolves back to itself, so a pair projected
 * from it here proves current against the real corpus file, exactly as the shelf's pairs do.
 */
describe("lares meme project --to md --check — the fold of submission-parity", () => {
  const clean = (d: string): void => {
    void cmdMeme(memeArgs(["project", PRISM], { to: "md", out: d }));
  };

  test("★ a clean pair reads 0 out of step, and touches neither wire nor disk ★", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await clean(d);
    const mdBefore = readFileSync(join(d, "prism.md"), "utf8");
    const metaBefore = readFileSync(join(d, "prism.md.meta"), "utf8");
    const code = await cmdMeme(memeArgs(["project"], { to: "md", check: d }));
    vi.restoreAllMocks();
    expect(code).toBe(0);
    expect(readFileSync(join(d, "prism.md"), "utf8")).toBe(mdBefore);
    expect(readFileSync(join(d, "prism.md.meta"), "utf8")).toBe(metaBefore);
    expect(h.calls).toEqual([]);
  });

  // LOOP 6: the pair reads AS PROJECTED — `--check` never takes a `--dialect`/`--tongue` flag; it
  // reads the recorded `variant: GFM` (and `tongue:`, when one wove) off the pair's OWN
  // `.md.meta` and re-projects with THAT target.
  test("★ a pair recording a target re-projects WITH that target, no flag at check time ★", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdMeme(memeArgs(["project", PRISM], { to: "md", out: d, dialect: "GFM", tongue: "en" }));
    const mdBefore = readFileSync(join(d, "prism.md"), "utf8");
    const code = await cmdMeme(memeArgs(["project"], { to: "md", check: d }));
    vi.restoreAllMocks();
    expect(code).toBe(0);
    expect(readFileSync(join(d, "prism.md"), "utf8")).toBe(mdBefore);
    expect(mdBefore).toContain('variant: "GFM"');
    expect(mdBefore).toContain("- `law ");
  });

  test("the bare-flag spelling names its target off the normal source position", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await clean(d);
    const code = await cmdMeme(memeArgs(["project", d], { to: "md" }, { check: true }));
    vi.restoreAllMocks();
    expect(code).toBe(0);
  });

  test("a single <name>.md file names one pair, not the whole directory", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await clean(d);
    const code = await cmdMeme(memeArgs(["project"], { to: "md", check: join(d, "prism.md") }));
    vi.restoreAllMocks();
    expect(code).toBe(0);
  });

  test("★ a hand-edited pair reads DRIFTED — hand edits do not survive re-projection ★", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    await clean(d);
    writeFileSync(join(d, "prism.md"), readFileSync(join(d, "prism.md"), "utf8") + "\nhand-added line\n");
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((l: string) => { logs.push(l); });
    const code = await cmdMeme(memeArgs(["project"], { to: "md", check: d }));
    vi.restoreAllMocks();
    expect(code).toBe(1);
    expect(logs.some((l) => l.includes("prism") && l.includes("DRIFTED"))).toBe(true);
  });

  test("CONTROL: a pair whose meta names no source, and one missing its .md.meta, each name themselves", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    writeFileSync(join(d, "orphan.md"), "# orphan\n");
    writeFileSync(join(d, "no-source.md"), "# no-source\n");
    writeFileSync(join(d, "no-source.md.meta"), "title: x\ntype: text/markdown\n");
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((l: string) => { logs.push(l); });
    const code = await cmdMeme(memeArgs(["project"], { to: "md", check: d }));
    vi.restoreAllMocks();
    expect(code).toBe(1);
    expect(logs.some((l) => l.includes("orphan") && l.includes("no .md.meta"))).toBe(true);
    expect(logs.some((l) => l.includes("no-source") && l.includes("names no source"))).toBe(true);
  });

  test("a source that no longer exists reads GONE", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    writeFileSync(join(d, "ghost.md"), "# ghost\n");
    writeFileSync(join(d, "ghost.md.meta"), "title: x\ntype: text/markdown\nsource: lar:///nowhere/at/all\n");
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((l: string) => { logs.push(l); });
    const code = await cmdMeme(memeArgs(["project"], { to: "md", check: d }));
    vi.restoreAllMocks();
    expect(code).toBe(1);
    expect(logs.some((l) => l.includes("ghost") && l.includes("GONE"))).toBe(true);
  });

  test("a target naming no .md pair at all reads 1, not a crash", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await cmdMeme(memeArgs(["project"], { to: "md", check: d }));
    vi.restoreAllMocks();
    expect(code).toBe(1);
  });

  test("no target names usage; a non-md --to refuses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cmdMeme(memeArgs(["project"], {}, { check: true }))).toBe(2);
    expect(await cmdMeme(memeArgs(["project"], { to: "html", check: "somewhere" }))).toBe(2);
    vi.restoreAllMocks();
  });

  /**
   * `--root` overrides where the source resolves from — the one door a scratch-tree pre-commit gate
   * needs, since `repoRoot` anchors on the built module's own on-disk location and never on `cwd`.
   */
  test("--root reads the source from the named root instead of the real repo tree", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    await clean(d);

    const emptyRoot = mkdtempSync(join(tmpdir(), "lares-meme-root-")); dirs.push(emptyRoot);
    let logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((l: string) => { logs.push(l); });
    let code = await cmdMeme(memeArgs(["project"], { to: "md", check: d, root: emptyRoot }));
    vi.restoreAllMocks();
    expect(code).toBe(1);
    expect(logs.some((l) => l.includes("prism") && l.includes("GONE"))).toBe(true);

    const editedRoot = mkdtempSync(join(tmpdir(), "lares-meme-root-"))
    dirs.push(editedRoot);
    const srcDir = join(editedRoot, "bags/lares/ha.ka.ba/lares/api/pono");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "prism.mem"), readFileSync(PRISM, "utf8") + "\nan edit the shelf pair never saw\n");
    logs = [];
    vi.spyOn(console, "log").mockImplementation((l: string) => { logs.push(l); });
    code = await cmdMeme(memeArgs(["project"], { to: "md", check: d, root: editedRoot }));
    vi.restoreAllMocks();
    expect(code).toBe(1);
    expect(logs.some((l) => l.includes("prism") && l.includes("DRIFTED"))).toBe(true);
  });
});

describe("lares meme project — the daemon seat rides meme-project", () => {
  test("★ a lar: uri dispatches meme-project with uri · to · container, and writes the text to --out ★", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    const out = join(d, "x.html");
    h.reply = { uri: "lar:///t/x", to: "html", text: "<p>x</p>", contentType: "text/html" };
    expect(await cmdMeme(memeArgs(["project", "lar:///t/x"], { to: "html", recipe: "sdm", out }))).toBe(0);
    expect(h.calls).toEqual([{ verb: "meme-project", args: { uri: "lar:///t/x", to: "html", recipe: "sdm" } }]);
    expect(readFileSync(out, "utf8")).toBe("<p>x</p>");
  });
  test("★ a daemon-seated md carries its sidecar: --out <name>.md lands <name>.md.meta beside it ★", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    const out = join(d, "x.md");
    h.reply = { uri: "lar:///t/x", to: "md", text: "# x\n", contentType: "text/markdown", meta: "uri-path = \"t/x\"\n" };
    expect(await cmdMeme(memeArgs(["project", "lar:///t/x"], { to: "md", out, recipe: "default" }))).toBe(0);
    expect(readFileSync(out, "utf8")).toBe("# x\n");
    expect(readFileSync(`${out}.meta`, "utf8")).toBe("uri-path = \"t/x\"\n");
  });
  test("a file with a daemon target rides by its DECLARED address", async () => {
    h.reply = { uri: "lar:///ha.ka.ba/lares/api/pono/prism", to: "tid", text: "T", contentType: "text/plain" };
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(await cmdMeme(memeArgs(["project", PRISM], { to: "tid", recipe: "default" }))).toBe(0);
    vi.restoreAllMocks();
    expect(h.calls).toEqual([{ verb: "meme-project", args: { uri: "lar:///ha.ka.ba/lares/api/pono/prism", to: "tid", recipe: "default" } }]);
  });
  test("a refusal exits verb-error, and no output file lands", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    const out = join(d, "x.json");
    h.refuse = "no meme at lar:///t/x";
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cmdMeme(memeArgs(["project", "lar:///t/x"], { to: "json", out, recipe: "default" }))).toBe(4);
    vi.restoreAllMocks();
    expect(existsSync(out)).toBe(false);
  });
});


/**
 * THE SIDECAR RIDES THE JSON REPLY. The daemon's `meme-project` answers `{ text, meta }` for md — a carrier in
 * two files — and the CLI's `--json` reply carried `text` alone unless `--out` wrote the `.meta` to disk, so a
 * JSON consumer (the MCP twin, the docker check, an AI at the QA lab) read half the pair. Measured on the docker
 * meme scenario: "B projects it to md — the check wants a `meta` key the projection never answers".
 */
describe("project --to md over the daemon — the pair in the reply", () => {
  test("`meta` reaches the JSON data beside `text`", async () => {
    h.calls.length = 0; h.refuse = "";
    h.reply = { uri: "lar:///t/x", to: "md", text: "# a\n", meta: "type: text/markdown\n", contentType: "text/markdown" };
    const lines: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(((l: unknown) => { lines.push(String(l)); return true; }) as never);
    const code = await cmdMeme(memeArgs(["project", "lar:///t/x"], { to: "md", bag: "sdm" }, { json: true }));
    spy.mockRestore();
    expect(code).toBe(0);
    const reply = JSON.parse(lines.find((l) => l.startsWith("{")) ?? "{}") as { data?: Record<string, unknown> };
    expect(reply.data?.["text"]).toBe("# a\n");
    expect(reply.data?.["meta"], "the sidecar half of the pair").toBe("type: text/markdown\n");
  });

  /** CONTROL: a target with no sidecar (html) carries no `meta` key — nothing invented. */
  test("an html projection carries no meta", async () => {
    h.reply = { uri: "lar:///t/x", to: "html", text: "<!doctype html>", contentType: "text/html" };
    const lines: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(((l: unknown) => { lines.push(String(l)); return true; }) as never);
    await cmdMeme(memeArgs(["project", "lar:///t/x"], { to: "html", recipe: "default" }, { json: true }));
    spy.mockRestore();
    const reply = JSON.parse(lines.find((l) => l.startsWith("{")) ?? "{}") as { data?: Record<string, unknown> };
    expect("meta" in (reply.data ?? {})).toBe(false);
  });
});

// ── the lifecycle: the tag family, the stage law, and the called fire ──────────────────────────

/** A carrier built from parts at read time — nothing here declares, so no sweep enrols the fixture. */
const governed = (tags: string[], body = "", extraMeta: string[] = []): string => {
  const rows: Array<[string, string]> = [
    ...extraMeta.map((l) => l.split(/\s*=\s*/, 2) as [string, string]),
    ["tags", `[${tags.map((t) => `"${t}"`).join(", ")}]`],
    ["uri-path", `"ha.ka.ba/t/${tags.join("-").replace(/[^a-z]+/g, "-")}"`],
  ];
  // The column law, so a fixture never reads as DRIFT and hides the fault the case is about.
  const pad = Math.max(...rows.map(([k]) => k.length));
  return ["```" + "toml meta", ...rows.map(([k, v]) => `${k.padEnd(pad)} = ${v}`), "```", "", body, ""].join("\n");
};

const say = (): { lines: string[]; done: () => string } => {
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((m: unknown) => { lines.push(String(m)); });
  return { lines, done: () => { vi.restoreAllMocks(); return lines.join("\n"); } };
};

describe("lares meme check — the stage law, enforced only where the tag stands", () => {
  test("★ a standing carrier holding an open lean faults, and exits 1 ★", async () => {
    const file = tmpFile(governed(["lifecycle/standing"], "<<~ ahu slot=`#/leans`>>\n\n# unruled. ``to=`?` ``\n\n<<~/ahu>>"));
    const out = say();
    const code = await cmdMeme(memeArgs(["check", file]));
    const text = out.done();
    expect(code).toBe(1);
    expect(text).toMatch(/an open lean ``to=`\?` `` stands in #\/leans/);
  });

  test("CONTROL — the same carrier tagged designed reads clean and exits 0", async () => {
    const file = tmpFile(governed(["lifecycle/designed"], "<<~ ahu slot=`#/leans`>>\n\n# unruled. ``to=`?` ``\n\n<<~/ahu>>"));
    const out = say();
    const code = await cmdMeme(memeArgs(["check", file]));
    out.done();
    expect(code).toBe(0);
  });

  /** The whole shelf declines the ladder; a check over an UNGOVERNED carrier enforces nothing new. */
  test("CONTROL — an untagged carrier carrying the same open lean enforces nothing new", async () => {
    const file = tmpFile(governed(["api/pono/meme"], "<<~ ahu slot=`#/leans`>>\n\n# unruled. ``to=`?` ``\n\n<<~/ahu>>"));
    const out = say();
    const code = await cmdMeme(memeArgs(["check", file]));
    out.done();
    expect(code).toBe(0);
  });

  test("a harvest carrier naming no living bag faults", async () => {
    const file = tmpFile(governed(["lifecycle/harvest"]));
    const out = say();
    expect(await cmdMeme(memeArgs(["check", file]))).toBe(1);
    expect(out.done()).toMatch(/no harvest-to/);
  });

  test("`status` and `retain` pass through check unchanged", async () => {
    const file = tmpFile(governed(["lifecycle/standing"], "", [`status = "standing"`, "retain = true"]));
    const before = readFileSync(file, "utf8");
    const out = say();
    expect(await cmdMeme(memeArgs(["check", file]))).toBe(0);
    const text = out.done();
    expect(text).not.toMatch(/retired/);
    expect(readFileSync(file, "utf8")).toBe(before);
  });
});

describe("lares meme sitting — the fire is CALLED, and this call burns nothing", () => {
  test("★ names every folded and retiring carrier nothing points at, and writes nothing ★", async () => {
    const folded = tmpFile(governed(["lifecycle/folded"], "<<~ ahu slot=`#/one`>>\n\nfolded to lar:///ha.ka.ba/lares/api/pono/meme\n\n<<~/ahu>>"));
    const before = readFileSync(folded, "utf8");
    const out = say();
    const code = await cmdMeme(memeArgs(["sitting", folded]));
    const text = out.done();
    expect(code).toBe(0);
    expect(text).toMatch(/candidate/);
    expect(text).toContain(folded);
    expect(existsSync(folded)).toBe(true);
    expect(readFileSync(folded, "utf8")).toBe(before);
    expect(h.calls).toEqual([]);
  });

  /** THE WELD COMES FIRST AND THE FIRE SECOND. A carrier something still names is not a candidate. */
  test("★ CONTROL: a folded carrier something still names is HELD, never a candidate ★", async () => {
    const folded = tmpFile(governed(["lifecycle/folded"], "<<~ ahu slot=`#/one`>>\n\nfolded to lar:///ha.ka.ba/lares/api/pono/meme\n\n<<~/ahu>>"));
    const addr = /^uri-path = "([^"]+)"/m.exec(readFileSync(folded, "utf8"))![1]!;
    const namer = tmpFile(governed(["api/pono/meme"], `<<~ loulou uri=\`lar:///${addr}\`>>`));
    const out = say();
    const code = await cmdMeme(memeArgs(["sitting", folded, namer]));
    const text = out.done();
    expect(code).toBe(0);
    expect(text).toMatch(/held — 1 carrier\(s\) still name/);
    expect(text).not.toMatch(/^candidate/m);
  });

  test("CONTROL — an empty harvest room is the witness, and the sitting says so", async () => {
    const plain = tmpFile(governed(["api/pono/meme"], "nothing stands here."));
    const out = say();
    const code = await cmdMeme(memeArgs(["sitting", plain]));
    const text = out.done();
    expect(code).toBe(0);
    expect(text).toMatch(/sitting: 1 carrier\(s\) read · 0 candidate\(s\) · 0 held/);
  });
});

describe("a lit face receives visits: target= reads, and a write naming one rides to the carrier that refuses it (Sol M1)", () => {
  test("a read carries target=; a put (a slot's too) and a delete carry it as written, and the write carrier refuses it in the VM", async () => {
    expect((await callPlan(parseArgs(["get", "meme=true", "target=h1"]), NO_SOURCES)).plan).toEqual(sent("get", { meme: "true", target: "h1" }));
    for (const verb of ["put", "delete"] as const) {
      expect((await callPlan(parseArgs([verb, "title=lar:///t/x", "target=h1"]), NO_SOURCES)).plan, verb).toEqual(sent(verb, { title: "lar:///t/x", target: "h1" }));
    }
    expect((await callPlan(parseArgs(["put", "title=lar:///t/x", "target=h1", "slot=#/a", "append=n"]), NO_SOURCES)).plan).toEqual(sent("put", { title: "lar:///t/x", target: "h1", slot: "#/a", append: "n" }));
    // The refusal the VM answers crosses back by its own code.
    h.refuse = "param-unknown: the put carrier takes no target";
    const out = await said(() => cmdCall(callArgs("put", "title=lar:///t/x", "target=h1", "text=x")));
    expect(out.json).toMatchObject({ ok: false, error: { hint: "refusal: param-unknown" } });
  });
});

