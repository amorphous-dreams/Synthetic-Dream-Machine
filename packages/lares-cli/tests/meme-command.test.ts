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
  test("an unchecked carrier is never given a check it did not claim", async () => {
    const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
    const bare = join(d, "bare.mem");
    const src = readFileSync(PRISM, "utf8").replace(/^ni:\/\/\/[^\n]*$/m, "").replace(/<<\^ code="&#x0003;">>[^\n]*/, "<<^ code=\"&#x0003;\">>");
    writeFileSync(bare, src, "utf8");
    vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdMeme(memeArgs(["normalize", bare]));
    vi.restoreAllMocks();
    expect(verifyBcc(readFileSync(bare, "utf8"))).toBe("unchecked");
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
