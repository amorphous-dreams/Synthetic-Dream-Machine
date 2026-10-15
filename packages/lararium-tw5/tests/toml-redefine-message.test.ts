/**
 * THE TOML REDEFINITION CONTROL — `duplicateTomlKeys` names every key a meta body defines twice by
 * READING smol-toml's refusal: its message (`TOML_REDEFINE_MESSAGE`) and its `line`. A parser upgrade
 * that rewords that refusal would turn the reader silent — every duplicate would fall back to a bare
 * "TOML parse error" and the `duplicate-meta-key` diagnostic would never name the key. This reads the
 * parser's OWN error, not the reader's answer, so the wording moving reds here first.
 */
import { describe, test, expect } from "vitest";
import { parse as smolParse } from "smol-toml";
import { TOML_REDEFINE_MESSAGE, duplicateTomlKeys } from "../src/toml-ast.js";

function refusalOf(toml: string): { message: string; line: unknown } {
  try {
    smolParse(toml);
  } catch (e) {
    return { message: String((e as Error).message ?? e), line: (e as { line?: unknown }).line };
  }
  throw new Error("smol-toml accepted a body that defines a key twice");
}

describe("★ smol-toml's redefinition refusal still reads as duplicateTomlKeys reads it ★", () => {
  test("a key defined twice: the parser's own message matches the reader's pattern, and names line 2", () => {
    const refusal = refusalOf('a = 1\na = 2\n');
    expect(refusal.message).toMatch(TOML_REDEFINE_MESSAGE);
    expect(refusal.line).toBe(2);
    expect(duplicateTomlKeys('a = 1\na = 2\n')).toEqual([{ key: "a", line: 2 }]);
  });

  test("a table defined twice reads the same way", () => {
    const refusal = refusalOf("[t]\nx = 1\n[t]\ny = 2\n");
    expect(refusal.message).toMatch(TOML_REDEFINE_MESSAGE);
    expect(duplicateTomlKeys("[t]\nx = 1\n[t]\ny = 2\n")).toEqual([{ key: "[t]", line: 3 }]);
  });

  test("CONTROL: a body broken for another reason does not read as a redefinition", () => {
    expect(refusalOf("a = \n").message).not.toMatch(TOML_REDEFINE_MESSAGE);
    expect(duplicateTomlKeys("a = \n")).toEqual([]);
  });
});
