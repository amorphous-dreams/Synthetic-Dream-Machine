/**
 * meme-command.test.ts — `lares meme`, the one family for every law over meme text.
 *
 * A VERB DECLARES ITS SEAT. `normalize` · `check` · `project --to md` run LOCAL over a file with no daemon
 * in reach — the offline re-stamp of a stale block check keeps working with no socket. `put` · `get` ·
 * `project --to html|tid|json`, and `project` over a `lar:` uri, ride the daemon verb. Proven here: the
 * argument law (both targets refuse; a bare `lares meme` prints usage and returns 2), the verb args the
 * daemon receives, the exit classes a receipt maps to (a CONFLICT exits as `conflict`, an absent meme on
 * get as `not-found`), that the local seats put NOTHING on the wire, and that `project --to md` over a
 * file writes the pair `projectSubmission` renders, byte for byte.
 */
import { afterEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectSubmission } from "@lararium/tw5/meme-markdown";
import { verifyBcc } from "@lararium/tw5";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown> }>,
  reply: {} as Record<string, unknown>,
  refuse: "" as string,
}));
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    if (h.refuse) return { status: "error", requestId: "r", errorMessage: h.refuse };
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.reply } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { cmdMeme, memePlan, projectPlan } from "../src/commands/meme.js";
import type { ParsedArgs } from "../src/parse-args.js";

const memeArgs = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "meme", positional, options, flags: { json: true, ...flags } } as unknown as ParsedArgs);

const REPO = new URL("../../..", import.meta.url).pathname;
/** A real carrier, so the local seats read every mark a hand-built stub would lack. */
const PRISM = join(REPO, "bags/lares/ha.ka.ba/lares/api/pono/prism.mem");

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); h.calls.length = 0; h.refuse = ""; });
const tmpFile = (text: string): string => {
  const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
  const p = join(d, "x.mem"); writeFileSync(p, text, "utf8"); return p;
};

describe("memePlan — the argument law, no daemon", () => {
  test("bare targets: neither flag names nothing (the daemon reads `recipe: default`)", () => {
    expect(memePlan("get", memeArgs(["get", "lar:///t/x"]))).toEqual({ verb: "meme-get", args: { uri: "lar:///t/x" } });
  });
  test("--recipe and --bag ride through as bare slugs", () => {
    expect(memePlan("get", memeArgs(["get", "lar:///t/x"], { recipe: "sdm" })).args).toEqual({ uri: "lar:///t/x", recipe: "sdm" });
    expect(memePlan("get", memeArgs(["get", "lar:///t/x"], { bag: "sdm" })).args).toEqual({ uri: "lar:///t/x", bag: "sdm" });
  });
  test("★ --recipe AND --bag together refuse ★", () => {
    expect(() => memePlan("get", memeArgs(["get", "lar:///t/x"], { recipe: "sdm", bag: "sdm" }))).toThrow(/one of/);
  });
  test("a missing uri refuses", () => {
    expect(() => memePlan("get", memeArgs(["get"]))).toThrow(/uri/);
  });
  test("put carries --base", () => {
    expect(memePlan("put", memeArgs(["put", "lar:///t/x"], { base: "sha256:abc" })).args).toEqual({ uri: "lar:///t/x", base: "sha256:abc" });
  });
});

describe("lares meme put", () => {
  test("★ reads the meme off --file and dispatches meme-put with uri · text · target · base ★", async () => {
    h.reply = { uri: "lar:///t/x", decision: "ingest", grade: "clean", landed: ["lar:///t/x"], tombstoned: [], canonicalHash: "sha256:1", warnings: [], diagnostics: [] };
    const file = tmpFile("<<^ code=\"&#x0001;\">> hello");
    const code = await cmdMeme(memeArgs(["put", "lar:///t/x"], { file, bag: "sdm", base: "sha256:0" }));
    expect(code).toBe(0);
    expect(h.calls).toEqual([{ verb: "meme-put", args: { uri: "lar:///t/x", text: "<<^ code=\"&#x0001;\">> hello", bag: "sdm", base: "sha256:0" } }]);
  });

  test("a CONFLICT receipt exits as the conflict class", async () => {
    h.reply = { uri: "lar:///t/x", decision: "conflict", grade: "clean", landed: [], tombstoned: [], canonicalHash: "sha256:2", warnings: ["moved"], diagnostics: [] };
    expect(await cmdMeme(memeArgs(["put", "lar:///t/x"], { file: tmpFile("x") }))).toBe(4);
  });

  test("CONTROL: a REFUSE receipt exits as verb-error, not conflict", async () => {
    h.reply = { uri: "lar:///t/x", decision: "refuse", grade: "error", landed: [], tombstoned: [], warnings: ["bad frame"], diagnostics: [] };
    expect(await cmdMeme(memeArgs(["put", "lar:///t/x"], { file: tmpFile("x") }))).toBe(4);
  });
});

describe("lares meme get", () => {
  test("dispatches meme-get and returns 0 on a hit", async () => {
    h.reply = { uri: "lar:///t/x", meme: { text: "T", canonicalHash: "sha256:9" } };
    expect(await cmdMeme(memeArgs(["get", "lar:///t/x"], { recipe: "sdm" }))).toBe(0);
    expect(h.calls).toEqual([{ verb: "meme-get", args: { uri: "lar:///t/x", recipe: "sdm" } }]);
  });
  test("★ an absent meme exits not-found ★", async () => {
    h.reply = { uri: "lar:///t/x", meme: null };
    expect(await cmdMeme(memeArgs(["get", "lar:///t/x"]))).toBe(3);
  });
});

describe("lares meme list — roots by default, --tree nests the slots", () => {
  test("★ dispatches meme-list with the container alone; --tree rides as `tree: true` ★", async () => {
    h.reply = { bag: "lar:///ha.ka.ba/bags/sdm", roots: [{ uri: "lar:///t/x", canonicalHash: "sha256:1" }] };
    expect(await cmdMeme(memeArgs(["list"], { bag: "sdm" }))).toBe(0);
    expect(h.calls).toEqual([{ verb: "meme-list", args: { bag: "sdm" } }]);
    h.calls.length = 0;
    expect(await cmdMeme(memeArgs(["list"], {}, { tree: true }))).toBe(0);
    expect(h.calls).toEqual([{ verb: "meme-list", args: { tree: true } }]);
  });
  test("★ --recipe AND --bag together refuse; nothing reaches the wire ★", async () => {
    expect(await cmdMeme(memeArgs(["list"], { recipe: "sdm", bag: "sdm" }))).toBe(2);
    expect(h.calls).toEqual([]);
  });
  test("the human form prints one line per root: hash then uri, slots indented under --tree", async () => {
    h.reply = { bag: "b", roots: [{ uri: "lar:///t/x", canonicalHash: "sha256:1", slots: [{ slot: "#/a", uri: "lar:///t/x#/a", slots: [{ slot: "#/b", uri: "lar:///t/x#/a/b", slots: [] }] }] }] };
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((m: unknown) => { lines.push(String(m)); });
    await cmdMeme(memeArgs(["list"], {}, { json: false, tree: true }));
    spy.mockRestore();
    expect(lines).toEqual(["sha256:1  lar:///t/x", "  #/a", "    #/b"]);
  });
});

describe("lares meme delete — the removal, over the daemon verb", () => {
  test("★ dispatches meme-delete with uri · target · --if-match as `base` ★", async () => {
    h.reply = { uri: "lar:///t/x", decision: "removed", tombstoned: ["lar:///t/x", "lar:///t/x#/a"], canonicalHash: "sha256:1" };
    expect(await cmdMeme(memeArgs(["delete", "lar:///t/x"], { recipe: "sdm", "if-match": "sha256:1" }))).toBe(0);
    expect(h.calls).toEqual([{ verb: "meme-delete", args: { uri: "lar:///t/x", recipe: "sdm", base: "sha256:1" } }]);
  });
  test("★ CONTROL: a stale --if-match answers conflict — exit class conflict, nothing moved ★", async () => {
    h.reply = { uri: "lar:///t/x", decision: "conflict", tombstoned: [], canonicalHash: "sha256:2" };
    expect(await cmdMeme(memeArgs(["delete", "lar:///t/x"], { "if-match": "sha256:1" }))).toBe(4);
  });
  test("an absent root exits not-found; a missing uri refuses as usage", async () => {
    h.reply = { uri: "lar:///t/x", decision: "absent", tombstoned: [] };
    expect(await cmdMeme(memeArgs(["delete", "lar:///t/x"]))).toBe(3);
    expect(await cmdMeme(memeArgs(["delete"]))).toBe(2);
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
    for (const sub of ["put", "get", "list", "delete", "normalize", "check", "project"]) expect(usage).toMatch(new RegExp(`lares meme ${sub} `));
    expect(usage).toMatch(/--to <mem\|md\|html\|tid\|json>/);
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
    // the ETX sigil and strips only the trailer, so a span stands for a check to cover. Read-optional,
    // emit-always is the fault it cures — the grammar rules the BCC optional on READ while the emitter
    // mints one unconditionally, so a hand-authored carrier lands legal on every gate its author runs
    // and red on the one they do not.
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    const bare = join(d, "bare.mem");
    const src = readFileSync(PRISM, "utf8").replace(/^ni:\/\/\/[^\n]*$/m, "").replace(/<<\^ code="&#x0003;">>[^\n]*/, "<<^ code=\"&#x0003;\">>");
    writeFileSync(bare, src, "utf8");
    expect(verifyBcc(readFileSync(bare, "utf8")), "the fixture never lost its trailer").toBe("unchecked");
    vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdMeme(memeArgs(["normalize", bare]));
    vi.restoreAllMocks();
    expect(verifyBcc(readFileSync(bare, "utf8"))).toBe("ok");
  });
});

describe("projectPlan — the seat law, no daemon", () => {
  test("a file with --to md seats LOCAL", () => {
    expect(projectPlan(memeArgs(["project", "x.mem"], { to: "md" })).seat).toBe("local");
  });
  test("★ a file with any other target, or a lar: uri, seats DAEMON ★", () => {
    for (const to of ["html", "tid", "json", "mem"]) {
      expect(projectPlan(memeArgs(["project", "x.mem"], { to })).seat, `file --to ${to}`).toBe("daemon");
    }
    expect(projectPlan(memeArgs(["project", "lar:///t/x"], { to: "md" })).seat).toBe("daemon");
  });
  test("a target off the list refuses; a missing --to refuses; --recipe with --bag refuses", () => {
    expect(() => projectPlan(memeArgs(["project", "x.mem"], { to: "pdf" }))).toThrow(/--to/);
    expect(() => projectPlan(memeArgs(["project", "x.mem"]))).toThrow(/--to/);
    expect(() => projectPlan(memeArgs(["project", "lar:///t/x"], { to: "html", recipe: "sdm", bag: "sdm" }))).toThrow(/one of/);
  });
});

describe("lares meme project --to md over a file — local, byte for byte", () => {
  test("★ writes <name>.md + <name>.md.meta as projectSubmission renders them, and touches no wire ★", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await cmdMeme(memeArgs(["project", PRISM], { to: "md", out: d }));
    vi.restoreAllMocks();
    expect(code).toBe(0);
    const want = projectSubmission(readFileSync(PRISM, "utf8"));
    expect(readFileSync(join(d, "prism.md"), "utf8")).toBe(want.markdown);
    expect(readFileSync(join(d, "prism.md.meta"), "utf8")).toBe(want.meta);
    expect(h.calls).toEqual([]);
  });
  test("--title-base mounts the pair under a shelf address", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdMeme(memeArgs(["project", PRISM], { to: "md", out: d, "title-base": "lar:///t/shelf" }));
    vi.restoreAllMocks();
    const want = projectSubmission(readFileSync(PRISM, "utf8"), { title: "lar:///t/shelf/prism" });
    expect(readFileSync(join(d, "prism.md.meta"), "utf8")).toBe(want.meta);
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
    expect(await cmdMeme(memeArgs(["project", "lar:///t/x"], { to: "md", out }))).toBe(0);
    expect(readFileSync(out, "utf8")).toBe("# x\n");
    expect(readFileSync(`${out}.meta`, "utf8")).toBe("uri-path = \"t/x\"\n");
  });
  test("a file with a daemon target rides by its DECLARED address", async () => {
    h.reply = { uri: "lar:///ha.ka.ba/lares/api/pono/prism", to: "tid", text: "T", contentType: "text/plain" };
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(await cmdMeme(memeArgs(["project", PRISM], { to: "tid" }))).toBe(0);
    vi.restoreAllMocks();
    expect(h.calls).toEqual([{ verb: "meme-project", args: { uri: "lar:///ha.ka.ba/lares/api/pono/prism", to: "tid" } }]);
  });
  test("a refusal exits verb-error, and no output file lands", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    const out = join(d, "x.json");
    h.refuse = "no meme at lar:///t/x";
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cmdMeme(memeArgs(["project", "lar:///t/x"], { to: "json", out }))).toBe(4);
    vi.restoreAllMocks();
    expect(existsSync(out)).toBe(false);
  });
});

/**
 * THE COMPOSITION VERDICT REACHES THE OPERATOR WHO ASKED FOR IT.
 *
 * `readCarrierShape` reads a fault that exists NOWHERE in the records it composes: a guest pastes a whole
 * framed carrier into an `ahu` section, the child's bytes read as a legal carrier, the root's bytes read as
 * a legal carrier, and `expandRefs` joins them into an illegal one carrying TWO text frames where only the
 * first verifies. The paste GRADES CLEAN — measured, `child-grade-decision.mem` #/measured row 11 — and the
 * shape reading, which catches it (row 13), had exactly ONE production caller in the whole tree: the
 * `--gradient` survey. No door, no gate, no route, no projector read it.
 *
 * SO THE COST ROUTED FROM THE ACTOR'S PRESENT TO A STRANGER'S FUTURE. Four months on, a reader on another
 * peer meets a carrier with two heads and an `unchecked` verdict, with no author left to ask.
 *
 * `project --to mem` is where a human stands waiting on a command they JUST TYPED, and it is the one target
 * whose output IS a carrier, so that is where the reading belongs.
 *
 * AND IT REPORTS RATHER THAN REFUSES — see the ruling in `memeProject`. These tests pin both halves: the
 * bytes still land, and the fault still reaches BOTH channels with a non-zero exit.
 */
describe("project --to mem reads the composition it just rendered", () => {
  /** The two-frame smuggle, as `expandRefs` composes it. Assembled at read time — it declares nothing on disk. */
  const HEAD = [
    `<<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">>`,
    ``,
    `<<^ code="&#x0001;" namespace="&#x2299;" from="?" -> to="lar:///t/two-heads">>`,
    "```toml meta",
    `type     = "text/memetic-wikitext+tiddlywiki"`,
    `uri-path = "t/two-heads"`,
    "```",
    ``,
  ].join("\n");
  const TWO_FRAMES = HEAD + [
    `<<^ code="&#x0002;">>`, ``, `body one`, ``,
    `<<^ code="&#x0002;">>`, ``, `body two`, ``,
    `<<^ code="&#x0003;">>ni:///sha-256;AAAA`,
    `<<^ code="&#x0004;" -> to="?">>`, ``,
  ].join("\n");
  const TORN = HEAD + [`<<^ code="&#x0002;">>`, ``, `body one`, ``].join("\n");

  /** Run the door on the human channel, gathering what each stream carried. */
  async function human(reply: Record<string, unknown>, options: Record<string, string> = {}): Promise<{ code: number; out: string; err: string }> {
    h.calls.length = 0; h.refuse = "";
    h.reply = reply;
    const out: string[] = []; const err: string[] = [];
    const so = vi.spyOn(process.stdout, "write").mockImplementation(((l: unknown) => { out.push(String(l)); return true; }) as never);
    const ce = vi.spyOn(console, "error").mockImplementation(((...a: unknown[]) => { err.push(a.map(String).join(" ")); }) as never);
    const cl = vi.spyOn(console, "log").mockImplementation(((...a: unknown[]) => { out.push(a.map(String).join(" ")); }) as never);
    const code = await cmdMeme(memeArgs(["project", "lar:///t/two-heads"], { to: "mem", ...options }, { json: false }));
    so.mockRestore(); ce.mockRestore(); cl.mockRestore();
    return { code, out: out.join("\n"), err: err.join("\n") };
  }

  test("★ RED — a composed render carrying TWO text frames reaches the operator's channel ★", async () => {
    const r = await human({ uri: "lar:///t/two-heads", to: "mem", text: TWO_FRAMES, contentType: "text/memetic-wikitext+tiddlywiki" });
    // THE FAULT REACHES A HUMAN, in the words the reading itself uses.
    expect(r.err).toMatch(/2 text frames stand where the grammar admits one/);
    // …and the BYTES STILL LAND. A reading that ate the operator's render would drop bytes to protect the
    // grammar — the one thing the diagnostics ladder forbids.
    expect(r.out).toContain("body two");
    // …and a hook can catch it: the render happened, the reading faulted, the exit says so.
    expect(r.code).not.toBe(0);
  });

  test("the fault rides the --json channel too (vitest is never a TTY, so `emit` renders JSON on the flag)", async () => {
    h.calls.length = 0; h.refuse = "";
    h.reply = { uri: "lar:///t/two-heads", to: "mem", text: TWO_FRAMES, contentType: "text/memetic-wikitext+tiddlywiki" };
    const lines: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(((l: unknown) => { lines.push(String(l)); return true; }) as never);
    const code = await cmdMeme(memeArgs(["project", "lar:///t/two-heads"], { to: "mem" }, { json: true }));
    spy.mockRestore();
    const reply = JSON.parse(lines.find((l) => l.startsWith("{")) ?? "{}") as { ok?: boolean; data?: Record<string, unknown> };
    const shape = reply.data?.["shape"] as { faults?: string[] } | undefined;
    expect(shape?.faults?.join(" ")).toMatch(/2 text frames stand where the grammar admits one/);
    // `ok` names whether the ACT landed; the exit code names what the READING found. Two facts, two
    // channels — the same custody ⊥ secret-kind separation, one altitude along.
    expect(reply.ok).toBe(true);
    expect(reply.data?.["text"]).toBe(TWO_FRAMES);
    expect(code).not.toBe(0);
  });

  test("CONTROL: a clean carrier projects silently and BYTE-IDENTICALLY, exactly as before", async () => {
    const clean = readFileSync(PRISM, "utf8");
    const r = await human({ uri: "lar:///ha.ka.ba/lares/api/pono/prism", to: "mem", text: clean, contentType: "text/memetic-wikitext+tiddlywiki" });
    expect(r.code).toBe(0);
    expect(r.err).toBe("");                 // not one line of shape noise on a carrier at its floor
    expect(r.out).toBe(clean);              // byte-identical, and nothing else on stdout
  });

  test("CONTROL: a clean carrier's --out file lands byte-identical and the exit stays 0", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    const out = join(d, "clean.mem");
    const clean = readFileSync(PRISM, "utf8");
    const r = await human({ uri: "lar:///ha.ka.ba/lares/api/pono/prism", to: "mem", text: clean, contentType: "text/memetic-wikitext+tiddlywiki" }, { out });
    expect(r.code).toBe(0);
    expect(readFileSync(out, "utf8")).toBe(clean);
  });

  test("CONTROL: a TORN frame reads DISTINCT from a two-frame smuggle — truncated is never unchecked", async () => {
    const torn = await human({ uri: "lar:///t/two-heads", to: "mem", text: TORN, contentType: "text/memetic-wikitext+tiddlywiki" });
    expect(torn.err).toMatch(/the frame opens and never closes — STX stands without ETX/);
    expect(torn.err).not.toMatch(/2 text frames/);
    const two = await human({ uri: "lar:///t/two-heads", to: "mem", text: TWO_FRAMES, contentType: "text/memetic-wikitext+tiddlywiki" });
    expect(two.err).not.toMatch(/opens and never closes/);
  });

  test("CONTROL: the OTHER targets read no carrier shape — an html render is not a carrier", async () => {
    h.calls.length = 0; h.refuse = "";
    h.reply = { uri: "lar:///t/x", to: "html", text: "<p>not a carrier at all</p>", contentType: "text/html" };
    const lines: string[] = [];
    const so = vi.spyOn(process.stdout, "write").mockImplementation(((l: unknown) => { lines.push(String(l)); return true; }) as never);
    const code = await cmdMeme(memeArgs(["project", "lar:///t/x"], { to: "html" }, { json: true }));
    so.mockRestore();
    const reply = JSON.parse(lines.find((l) => l.startsWith("{")) ?? "{}") as { data?: Record<string, unknown> };
    expect("shape" in (reply.data ?? {})).toBe(false);
    expect(code).toBe(0);
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
    await cmdMeme(memeArgs(["project", "lar:///t/x"], { to: "html" }, { json: true }));
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
    const file = tmpFile(governed(["lifecycle/standing"], "<<~ ahu #/leans>>\n\n# unruled. `-> ?`\n\n<<~/ahu>>"));
    const out = say();
    const code = await cmdMeme(memeArgs(["check", file]));
    const text = out.done();
    expect(code).toBe(1);
    expect(text).toMatch(/an open lean `-> \?` stands in #\/leans/);
  });

  test("CONTROL — the same carrier tagged designed reads clean and exits 0", async () => {
    const file = tmpFile(governed(["lifecycle/designed"], "<<~ ahu #/leans>>\n\n# unruled. `-> ?`\n\n<<~/ahu>>"));
    const out = say();
    const code = await cmdMeme(memeArgs(["check", file]));
    out.done();
    expect(code).toBe(0);
  });

  /** The whole shelf declines the ladder; a check over an UNGOVERNED carrier enforces nothing new. */
  test("CONTROL — an untagged carrier carrying the same open lean enforces nothing new", async () => {
    const file = tmpFile(governed(["api/pono/meme"], "<<~ ahu #/leans>>\n\n# unruled. `-> ?`\n\n<<~/ahu>>"));
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
    const folded = tmpFile(governed(["lifecycle/folded"], "<<~ ahu #/one>>\n\nfolded to lar:///ha.ka.ba/lares/api/pono/meme\n\n<<~/ahu>>"));
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
    const folded = tmpFile(governed(["lifecycle/folded"], "<<~ ahu #/one>>\n\nfolded to lar:///ha.ka.ba/lares/api/pono/meme\n\n<<~/ahu>>"));
    const addr = /^uri-path = "([^"]+)"/m.exec(readFileSync(folded, "utf8"))![1]!;
    const namer = tmpFile(governed(["api/pono/meme"], `<<~ loulou "lar:///${addr}">>`));
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
