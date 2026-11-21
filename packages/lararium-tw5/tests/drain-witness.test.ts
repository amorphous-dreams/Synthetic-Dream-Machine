/**
 * The Drain grep witness. The drain module completes through ONE macrotask schedule() site; a microtask hop or a `.then(` that
 * re-requests inside it reads red. The peeled machinery of the earlier rounds stays deleted from the shore sources.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const src = join(__dirname, "..", "src");
const read = (f: string): string => readFileSync(join(src, f), "utf8");
const code = (s: string): string => s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

describe("drain witness", () => {
  test("the drain module holds no queueMicrotask and no re-requesting .then", () => {
    const body = code(read("drain.ts"));
    expect(body).not.toMatch(/queueMicrotask\s*\(/);
    expect(body).not.toMatch(/\.then\s*\(/);
    expect(body.match(/setImmediate|MessageChannel/g)?.length ?? 0).toBeGreaterThan(0);
  });

  test("the witness reads a known positive: a planted microtask hop turns the pattern red", () => {
    expect("x(); queueMicrotask(() => pump());").toMatch(/queueMicrotask\s*\(/);
    expect("p.then(() => this.request())").toMatch(/\.then\s*\(/);
  });

  test("the shore sources no longer carry the peeled machinery", () => {
    for (const f of readdirSync(src).filter((n) => n.endsWith(".ts"))) {
      const body = code(read(f));
      expect(body, f).not.toMatch(/\bdeferredRemovals\b/);
      expect(body, f).not.toMatch(/\bpendingHand\b/);
      expect(body, f).not.toMatch(/\bretryOnFailure\b/);
    }
    expect(code(read("island-adaptor.ts"))).not.toMatch(/queueMicrotask\s*\(\s*\(\)\s*=>\s*this\.requestDrain/);
  });
});
