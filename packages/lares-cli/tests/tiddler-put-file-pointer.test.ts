/**
 * `lares tiddler put --file` — A FILE WHOSE KIND RIDES AS A POINTER LANDS AS ONE.
 *
 * The CLI half of lar:///ha.ka.ba/kahua/memory/course/all-tiddlers-meme-verb-retires steps 5 and 6, on the door suite's own
 * harness (the verb call mocked, the wire read back). A binary file read as words would land mangled; the put stages its raw
 * bytes into the content tier under their SHA-256 and carries a pointer (`_canonical_uri` and `_integrity` naming that
 * digest), which the door seats and verifies. A utf8 file rides as words, as before, and no type lands that the line never named.
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
import { cmdTiddler } from "../src/commands/tiddler.js";
import type { ParsedArgs } from "../src/parse-args.js";

const argv = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "tiddler", positional, options, flags: { json: true } } as unknown as ParsedArgs);

async function run(args: ParsedArgs): Promise<number> {
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((() => true) as never);
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  try { return await cmdTiddler(args); } finally { spy.mockRestore(); log.mockRestore(); err.mockRestore(); }
}

/** A byte run no utf8 reading survives: a PNG signature and noise. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00, 0xfe, 0x01]);
const CID = createHash("sha256").update(PNG).digest("hex");
const NI = niUriSha256FromHex(CID);

let dir = "";
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "put-file-pointer-")); h.casDir = join(dir, "cas"); h.reply = { decision: "put", created: true, changed: ["type"], hash: "sha256-new" }; });
afterEach(() => { h.calls.length = 0; rmSync(dir, { recursive: true, force: true }); });

describe("tiddler put --file: a binary rides as a pointer, staged by its hash", () => {
  test("RED: a .png stages its raw bytes under their SHA-256 and the wire carries the pointer, never mangled words", async () => {
    const file = join(dir, "photo.png");
    writeFileSync(file, PNG);
    expect(await run(argv(["put", "Photo"], { recipe: "default", file }))).toBe(0);
    expect(h.calls.at(-1)).toEqual({ verb: "tiddler-put", args: {
      recipe: "default", title: "Photo",
      fields: { type: "image/png", _canonical_uri: NI, _integrity: NI, size: String(PNG.length) },
      unset: ["text"],
    } });
    // The blob rests under its hash and nothing else: no file name, no version.
    expect(readFileSync(join(h.casDir, CID)).equals(PNG)).toBe(true);
  });

  test("RED: the line's own fields join the pointer; a binary of a kind the registry lacks rides application/octet-stream", async () => {
    const file = join(dir, "blob.unknownkind");
    writeFileSync(file, PNG);
    expect(await run(argv(["put", "Blob"], { recipe: "default", file, fields: "{\"caption\":\"a blob\"}", unset: "stale" }))).toBe(0);
    expect(h.calls.at(-1)!.args).toMatchObject({
      fields: { caption: "a blob", type: "application/octet-stream", _canonical_uri: NI, _integrity: NI, size: String(PNG.length) },
      unset: ["stale", "text"],
    });
    expect(h.calls.at(-1)!.args).not.toHaveProperty("text");
  });

  test("RED: a declared pointer-kind type elects a pointer for utf8 bytes too (an SVG the line calls an image)", async () => {
    const file = join(dir, "mark.svg");
    const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>";
    writeFileSync(file, svg, "utf8");
    const cid = createHash("sha256").update(svg, "utf8").digest("hex");
    expect(await run(argv(["put", "Mark"], { recipe: "default", file, fields: "{\"type\":\"image/svg+xml\"}" }))).toBe(0);
    expect(h.calls.at(-1)!.args).toMatchObject({ fields: { type: "image/svg+xml", _canonical_uri: niUriSha256FromHex(cid), size: String(Buffer.byteLength(svg)) }, unset: ["text"] });
    expect(readFileSync(join(h.casDir, cid), "utf8")).toBe(svg);
  });

  test("CONTROL: a utf8 file rides as words with no type the line never named, and stages nothing", async () => {
    for (const [name, words] of [["note.md", "# a heading\n"], ["data.json", "{\"a\":1}\n"], ["style.css", "body { color: red; }\n"], ["mark.svg", "<svg/>\n"]] as const) {
      const file = join(dir, name);
      writeFileSync(file, words, "utf8");
      expect(await run(argv(["put", "Words"], { recipe: "default", file }))).toBe(0);
      expect(h.calls.at(-1)).toEqual({ verb: "tiddler-put", args: { recipe: "default", title: "Words", text: words } });
    }
    expect(existsSync(h.casDir)).toBe(false);
  });
});
