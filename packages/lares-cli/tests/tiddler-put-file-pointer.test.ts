/**
 * `lares put title=<T> file=<path|->` — A FILE WHOSE KIND RIDES AS A POINTER LANDS AS ONE.
 *
 * The CLI half of lar:///ha.ka.ba/kahua/memory/course/all-tiddlers-meme-verb-retires steps 5 and 6, on the door suite's own
 * harness (the verb call mocked, the wire read back). A binary file read as words would land mangled; the put stages its raw
 * bytes into the content tier under their SHA-256 and carries a pointer (`_canonical_uri` and `_integrity` naming that
 * digest), which the door seats and verifies. A utf8 file rides as words, as before, and no type lands that the line never named.
 * The call door reads the host's bytes on this side alone (`crossHost`): `file=-` and `append=-` read stdin, and everything else
 * crosses as the params the line wrote (`fields` as its JSON, `unset` as its comma list), bound in the VM.
 */
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown> }>,
  reply: {} as Record<string, unknown>,
  casDir: "",
}));
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  verbFailure: (err: unknown) => ({ code: "error", message: err instanceof Error ? err.message : String(err) }),
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.reply } } };
  },
  runVerbAsFace: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.reply } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
  larCasDir: () => h.casDir,
}));

import { niUriSha256FromHex } from "@lararium/mesh/crypto";
import { cmdCall, crossHost, type CallSources } from "../src/commands/call.js";
import { DoorUsage } from "../src/commands/door-call.js";
import { parseArgs } from "../src/parse-args.js";

/** One put line as a terminal types it, `json=true` asked. */
async function run(...tokens: string[]): Promise<number> {
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((() => true) as never);
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  try { return await cmdCall(parseArgs(["put", ...tokens, "json=true"])); } finally { spy.mockRestore(); log.mockRestore(); err.mockRestore(); }
}

/** The call a put sends: the params as they crossed, the surface `cli`. */
const put = (params: Record<string, string>) => ({ verb: "call", args: { verb: "put", params, surface: "cli" } });
const paramsOf = (args: Record<string, unknown>): Record<string, unknown> => args["params"] as Record<string, unknown>;
/** The pointer fields a put carries, read back from its JSON param. */
const fieldsOf = (args: Record<string, unknown>): Record<string, unknown> => JSON.parse(String(paramsOf(args)["fields"])) as Record<string, unknown>;

/** Host crossings a test seats: stdin holds `bytes`; a file read refuses unless the test names the file. */
function sources(bytes: Buffer | string, files: Record<string, Buffer> = {}): CallSources & { reads: number } {
  const seat = {
    reads: 0,
    read: (path: string): Buffer => { const held = files[path]; if (!held) throw new Error(`ENOENT ${path}`); return held; },
    stdin: async (): Promise<Buffer> => { seat.reads++; return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, "utf8"); },
  };
  return seat;
}

/** A byte run no utf8 reading survives: a PNG signature and noise. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00, 0xfe, 0x01]);
const CID = createHash("sha256").update(PNG).digest("hex");
const NI = niUriSha256FromHex(CID);

let dir = "";
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "put-file-pointer-")); h.casDir = join(dir, "cas"); h.reply = { decision: "put", created: true, changed: ["type"], hash: "sha256-new" }; });
afterEach(() => { h.calls.length = 0; rmSync(dir, { recursive: true, force: true }); });

describe("put file=<path>: a binary rides as a pointer, staged by its hash", () => {
  test("RED: a .png stages its raw bytes under their SHA-256 and the call carries the pointer, never mangled words", async () => {
    const file = join(dir, "photo.png");
    writeFileSync(file, PNG);
    expect(await run("title=Photo", `file=${file}`)).toBe(0);
    expect(h.calls.at(-1)).toEqual(put({
      title: "Photo",
      fields: JSON.stringify({ type: "image/png", _canonical_uri: NI, _integrity: NI, size: String(PNG.length) }),
      unset: "text",
    }));
    // The blob rests under its hash and nothing else: no file name, no version.
    expect(readFileSync(join(h.casDir, CID)).equals(PNG)).toBe(true);
  });

  test("RED: the line's own fields join the pointer; a binary of a kind the registry lacks rides application/octet-stream", async () => {
    const file = join(dir, "blob.unknownkind");
    writeFileSync(file, PNG);
    expect(await run("title=Blob", `file=${file}`, "fields={\"caption\":\"a blob\"}", "unset=stale")).toBe(0);
    const args = h.calls.at(-1)!.args;
    expect(fieldsOf(args)).toEqual({ caption: "a blob", type: "application/octet-stream", _canonical_uri: NI, _integrity: NI, size: String(PNG.length) });
    expect(paramsOf(args)["unset"]).toBe("stale,text");
    expect(paramsOf(args)).not.toHaveProperty("text");
    expect(paramsOf(args)).not.toHaveProperty("file");
  });

  test("RED: a declared pointer-kind type elects a pointer for utf8 bytes too (an SVG the line calls an image)", async () => {
    const file = join(dir, "mark.svg");
    const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>";
    writeFileSync(file, svg, "utf8");
    const cid = createHash("sha256").update(svg, "utf8").digest("hex");
    expect(await run("title=Mark", `file=${file}`, "fields={\"type\":\"image/svg+xml\"}")).toBe(0);
    expect(fieldsOf(h.calls.at(-1)!.args)).toMatchObject({ type: "image/svg+xml", _canonical_uri: niUriSha256FromHex(cid), size: String(Buffer.byteLength(svg)) });
    expect(paramsOf(h.calls.at(-1)!.args)["unset"]).toBe("text");
    expect(readFileSync(join(h.casDir, cid), "utf8")).toBe(svg);
  });

  test("CONTROL: a utf8 file rides as words with no type the line never named, and stages nothing", async () => {
    for (const [name, words] of [["note.md", "# a heading\n"], ["data.json", "{\"a\":1}\n"], ["style.css", "body { color: red; }\n"], ["mark.svg", "<svg/>\n"]] as const) {
      const file = join(dir, name);
      writeFileSync(file, words, "utf8");
      expect(await run("title=Words", `file=${file}`)).toBe(0);
      expect(h.calls.at(-1)).toEqual(put({ title: "Words", text: words }));
    }
    expect(existsSync(h.casDir)).toBe(false);
  });
});

describe("the call door's host crossings: file= and append= read the bytes a terminal holds", () => {
  test("★ file=- reads stdin as the text; a binary on stdin rides as an octet-stream pointer ★", async () => {
    expect(await crossHost({ title: "T", file: "-" }, sources("words from a pipe\n"))).toEqual({ title: "T", text: "words from a pipe\n" });
    const crossed = await crossHost({ title: "Blob", file: "-" }, sources(PNG));
    expect(JSON.parse(crossed["fields"]!)).toEqual({ type: "application/octet-stream", _canonical_uri: NI, _integrity: NI, size: String(PNG.length) });
    expect(crossed["unset"]).toBe("text");
    expect(crossed).not.toHaveProperty("text");
  });

  test("★ append=- reads stdin as the words to append; append=<words> rides as written and reads nothing ★", async () => {
    expect(await crossHost({ title: "Ledger", append: "-" }, sources("a dated note\n"))).toEqual({ title: "Ledger", append: "a dated note\n" });
    const seat = sources("never read");
    expect(await crossHost({ title: "Ledger", append: "a dated note" }, seat)).toEqual({ title: "Ledger", append: "a dated note" });
    expect(seat.reads).toBe(0);
  });

  test("file=<path> reads through the seated file reader; a file it cannot read refuses as usage, naming the path", async () => {
    expect(await crossHost({ title: "T", file: "/h/body.mem" }, sources("", { "/h/body.mem": Buffer.from("alpha\n") }))).toEqual({ title: "T", text: "alpha\n" });
    await expect(crossHost({ title: "T", file: "/h/absent.mem" }, sources(""))).rejects.toThrow(/cannot read file=\/h\/absent\.mem/);
  });

  test("★ text= beside file= refuses, and so does an empty file=, before any byte is read ★", async () => {
    const seat = sources("never read");
    await expect(crossHost({ title: "T", file: "-", text: "x" }, seat)).rejects.toThrow(DoorUsage);
    await expect(crossHost({ title: "T", file: "-", text: "x" }, seat)).rejects.toThrow(/name one text source: text=<words> or file=<path>, never both/);
    await expect(crossHost({ title: "T", file: "" }, seat)).rejects.toThrow(/file= names no host file/);
    expect(seat.reads).toBe(0);
  });

  test("CONTROL: a line naming neither file= nor append=- crosses its params untouched and reads nothing", async () => {
    const seat = sources("never read");
    expect(await crossHost({ title: "T", text: "w", fields: "{\"a\":\"b\"}", unset: "x" }, seat)).toEqual({ title: "T", text: "w", fields: "{\"a\":\"b\"}", unset: "x" });
    expect(seat.reads).toBe(0);
  });

  test("the door refuses text= beside file= as usage (exit 2) and nothing rides the wire", async () => {
    const file = join(dir, "body.mem");
    writeFileSync(file, "alpha\n", "utf8");
    expect(await run("title=T", "text=x", `file=${file}`)).toBe(2);
    expect(h.calls).toEqual([]);
  });
});
