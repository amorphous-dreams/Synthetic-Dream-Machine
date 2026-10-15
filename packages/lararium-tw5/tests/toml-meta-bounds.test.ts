/**
 * toml-meta-bounds — a `#meta` body arrives from peers, and the TOML reader runs synchronously on the
 * event loop, so a crafted body must read within a bound linear in its size, or refuse. Never stall.
 *
 *   · HUGE: a flat run of dot-free keys, the most ordinary TOML there is. A parser that rescans to the
 *     end of the document for every key line costs O(n²): 256k lines took ~13 s, which pins a core.
 *   · DEEP: nesting past the parser's depth limit refuses with a named warning; it never blows the stack.
 *   · REDEFINED: a body that defines one key thousands of times. `duplicateTomlKeys` re-parses the body
 *     once per redefinition it names, so it names a bounded count and says the rest went unnamed.
 *
 * CONTROL: an ordinary meta body still reads every field, and a single redefinition still reads by name.
 */
import { describe, expect, test } from "vitest";
import { duplicateTomlKeys, parseTaploFields, TOML_REDEFINE_NAMED_MAX } from "../src/toml-ast.js";

/** Generous beside the linear cost (~0.5 s for the 256k-line body), far beneath the quadratic one. */
const BOUND_MS = 4000;

function timed<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
}

describe("★ a crafted #meta body reads within a linear bound, or refuses ★", () => {
  test("HUGE: 256k flat key lines (~2.8 MB) read whole within the bound", () => {
    const lines: string[] = [];
    for (let i = 0; i < 256_000; i += 1) lines.push(`k${i} = 1`);
    const warnings: string[] = [];
    const { value, ms } = timed(() => parseTaploFields(lines.join("\n"), warnings));
    expect(warnings).toEqual([]);
    expect(Object.keys(value).length).toBe(256_000);
    expect(ms, `a 256k-line meta body took ${ms.toFixed(0)} ms`).toBeLessThan(BOUND_MS);
  }, 60_000);

  test("DEEP: nesting past the depth limit refuses with a warning, never a stack overflow", () => {
    const warnings: string[] = [];
    const { value, ms } = timed(() => parseTaploFields(`a = ${"[".repeat(100_000)}${"]".repeat(100_000)}`, warnings));
    expect(value).toEqual({});
    expect(warnings.join("\n")).toMatch(/nested/i);
    expect(ms).toBeLessThan(BOUND_MS);
  }, 60_000);

  test("REDEFINED: 20k redefinitions of one key name a bounded count, within the bound", () => {
    const body = Array.from({ length: 20_000 }, () => "a = 1").join("\n");
    const { value, ms } = timed(() => duplicateTomlKeys(body));
    expect(value.length).toBe(TOML_REDEFINE_NAMED_MAX);
    expect(value[0]).toEqual({ key: "a", line: 2 });
    expect(ms, `naming the redefinitions took ${ms.toFixed(0)} ms`).toBeLessThan(BOUND_MS);

    const warnings: string[] = [];
    const read = timed(() => parseTaploFields(body, warnings));
    expect(read.value).toEqual({});
    expect(warnings.length).toBe(TOML_REDEFINE_NAMED_MAX + 1);
    expect(warnings.at(-1)).toMatch(/any further ones stand unnamed/);
    expect(read.ms).toBeLessThan(BOUND_MS);
  }, 120_000);

  test("CONTROL: an ordinary body reads every field, and one redefinition names its key with no overflow line", () => {
    expect(parseTaploFields('title = "lar:///x"\nmana = 16\n')).toEqual({ title: "lar:///x", mana: "16" });
    const warnings: string[] = [];
    expect(parseTaploFields("a = 1\na = 2\n", warnings)).toEqual({});
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/duplicate key "a" \(line 2\)/);
  });
});
