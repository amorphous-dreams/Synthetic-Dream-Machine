/**
 * meta-duplicate-key — TOML forbids a key defined twice, so a carrier's meta fence that defines one twice
 * reads NON-CANONICAL, with a named error-grade diagnostic, on every door that reads the fence:
 *
 *   · `duplicateTomlKeys` (toml-ast)    — the redefinitions the spec parser refuses, each named by key and line;
 *   · `parseTaploFields`                — the warning names the duplicate, never a bare "parse error";
 *   · `normalizeMemeSource`             — the result carries an error-grade `faults` entry no gesture closes;
 *   · `memeticIngestOps.deserialize`    — the ingest gate hears `duplicate-meta-key` at error grade.
 *
 * CONTROLS: the same key in two DIFFERENT tables is two keys; a key repeated inside a teaching ```toml fence
 * (not `meta`) names no meta and moves nothing; a canonical carrier carries no fault.
 */
import { describe, expect, test } from "vitest";
import { duplicateTomlKeys, parseTaploFields } from "../src/toml-ast.js";
import { normalizeMemeSource } from "../src/meme-normalize.js";
import { memeticIngestOps } from "../src/ingest-gate.js";

const URI = "lar:///ha.ka.ba/lares/docs/dup-probe";

/** A framed carrier whose root meta body is `meta`, with `extra` in the body. */
function carrier(meta: string[], extra: string[] = []): string {
  return [
    `<<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">>`,
    "",
    `<<^ code="&#x0001;" from="?" -> to="${URI}">>`,
    `<<^ code="&#x0002;">>`,
    "",
    "```toml meta",
    ...meta,
    "```",
    "",
    "! Probe",
    "",
    "Prose.",
    ...extra,
    "",
    `<<^ code="&#x0003;">>`,
    "",
    `<<^ code="&#x0004;" -> to="?">>`,
    "",
  ].join("\n");
}

const BASE = ['role     = "probe"', 'uri-path = "ha.ka.ba/lares/docs/dup-probe"'];
const DUP  = ['role     = "probe"', 'role     = "second"', 'uri-path = "ha.ka.ba/lares/docs/dup-probe"'];

const dupCodes = (text: string) =>
  memeticIngestOps.deserialize(URI, text).diagnostics.filter((d) => d.code === "duplicate-meta-key");

describe("toml-ast — a key defined twice is named", () => {
  test("a duplicate top-level key names the key and its second line", () => {
    expect(duplicateTomlKeys(DUP.join("\n"))).toEqual([{ key: "role", line: 2 }]);
  });

  test("every redefinition is named, not only the first", () => {
    const body = ['a = 1', 'b = 2', 'a = 3', 'b = 4'].join("\n");
    expect(duplicateTomlKeys(body).map((d) => d.key)).toEqual(["a", "b"]);
  });

  test("a table header defined twice is named too", () => {
    expect(duplicateTomlKeys(["[t]", "k = 1", "[t]", "j = 2"].join("\n"))).toEqual([{ key: "[t]", line: 3 }]);
  });

  test("parseTaploFields names the duplicate in its warning", () => {
    const warnings: string[] = [];
    parseTaploFields(DUP.join("\n"), warnings);
    expect(warnings.join("\n")).toMatch(/duplicate key "role"/);
  });

  test("CONTROL: the same key in two different tables is two keys", () => {
    const body = ['role = "top"', "[a]", 'role = "in-a"', "[b]", 'role = "in-b"'].join("\n");
    expect(duplicateTomlKeys(body)).toEqual([]);
    expect(parseTaploFields(body)).toEqual({ role: "top", "a-role": "in-a", "b-role": "in-b" });
  });

  test("CONTROL: a key repeated inside a multi-line string is text", () => {
    expect(duplicateTomlKeys(['s = """', "role = 1", "role = 2", '"""'].join("\n"))).toEqual([]);
  });
});

describe("normalize + ingest — a duplicate meta key reads non-canonical", () => {
  test("★ a duplicate top-level meta key faults normalize at error grade, and the ingest gate hears it ★", () => {
    const text = carrier(DUP);
    const res = normalizeMemeSource(text);
    expect(res.faults).toHaveLength(1);
    expect(res.faults[0]!.code).toBe("duplicate-meta-key");
    expect(res.faults[0]!.message).toMatch(/"role"/);
    const diags = dupCodes(text);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.severity).toBe("error");
    expect(memeticIngestOps.grade(memeticIngestOps.deserialize(URI, text).diagnostics)).toBe("error");
  });

  test("a duplicate inside a slot's own meta fence faults too", () => {
    const text = carrier(BASE, ["", "<<~ ahu #/inner>>", "", "```toml meta", 'l-space = "a"', 'l-space = "b"', "```", "", "Slot.", "", "<<~/ahu>>"]);
    expect(normalizeMemeSource(text).faults.map((f) => f.code)).toEqual(["duplicate-meta-key"]);
    expect(dupCodes(text)).toHaveLength(1);
  });

  test("CONTROL: a canonical carrier carries no fault", () => {
    const text = carrier(BASE);
    expect(normalizeMemeSource(text).faults).toEqual([]);
    expect(dupCodes(text)).toEqual([]);
  });

  test("CONTROL: the same key in two different meta tables carries no fault", () => {
    const text = carrier([...BASE, "", "[reference]", 'role = "cited"']);
    expect(normalizeMemeSource(text).faults).toEqual([]);
    expect(dupCodes(text)).toEqual([]);
  });

  test("CONTROL: a key repeated in a teaching ```toml fence (not meta) is untouched", () => {
    const lesson = ["", "```toml", 'role = "a"', 'role = "b"', "```"];
    const text = carrier(BASE, lesson);
    const res = normalizeMemeSource(text);
    expect(res.faults).toEqual([]);
    expect(res.text).toContain(lesson.join("\n"));
    expect(dupCodes(text)).toEqual([]);
  });
});
