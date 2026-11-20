/**
 * hand-verb-answer-shape — every hand-verb answer (`lei show|kui|unstring|restring|land`, `rite keep|kukulu`) reads ONE shape on a
 * terminal or a pipe: the one-line envelope on stdout; a terminal adds one line of prose on stderr; `--no-json` asks the prose.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { emitAnswer } from "../src/render.js";
import { parseArgs } from "../src/parse-args.js";

const withTty = async (tty: boolean, run: () => void): Promise<{ out: string[]; err: string[]; log: string[] }> => {
  const was = process.stdout.isTTY, out: string[] = [], err: string[] = [], log: string[] = [];
  Object.defineProperty(process.stdout, "isTTY", { value: tty, configurable: true });
  vi.spyOn(process.stdout, "write").mockImplementation((c: string | Uint8Array) => { out.push(String(c)); return true; });
  vi.spyOn(console, "error").mockImplementation((l: unknown) => { err.push(String(l)); });
  vi.spyOn(console, "log").mockImplementation((l: unknown) => { log.push(String(l)); });
  try { run(); } finally { Object.defineProperty(process.stdout, "isTTY", { value: was, configurable: true }); }
  return { out, err, log };
};
afterEach(() => { vi.restoreAllMocks(); });

describe("hand-verb answers read one shape", () => {
  it("RED: a terminal and a pipe both print the one-line envelope; only the terminal adds one stderr line of prose", async () => {
    const e = { ok: true, data: { rite: "keep" }, human: () => console.log("bare") };
    const tty = await withTty(true, () => emitAnswer(parseArgs(["lei", "show"]), e, "lares lei show: done"));
    const pipe = await withTty(false, () => emitAnswer(parseArgs(["lei", "show"]), e, "lares lei show: done"));
    expect(tty.out).toEqual([`{"ok":true,"data":{"rite":"keep"}}\n`]);
    expect(pipe.out).toEqual(tty.out);
    expect(tty.err).toEqual(["lares lei show: done"]);
    expect(pipe.err).toEqual([]);
    expect(tty.log.concat(pipe.log)).toEqual([]);
  });

  it("RED: a refusal reads the same envelope shape on both, and --no-json asks the prose route", async () => {
    const e = { ok: false, error: { code: "swarm-lei-forked", message: "name the tip" }, human: () => console.error("prose") };
    const tty = await withTty(true, () => emitAnswer(parseArgs(["lei", "kui"]), e, "lares lei: name the tip"));
    expect(tty.out).toEqual([`{"ok":false,"error":{"code":"swarm-lei-forked","message":"name the tip"}}\n`]);
    expect(tty.err).toEqual(["lares lei: name the tip"]);
    const prose = await withTty(true, () => emitAnswer(parseArgs(["lei", "kui", "--no-json"]), e, "unused"));
    expect(prose.out).toEqual([]);
    expect(prose.err).toEqual(["prose"]);
  });
});
