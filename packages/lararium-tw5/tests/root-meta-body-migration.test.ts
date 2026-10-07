import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { bccOfSpan, checkSpan } from "@lararium/memetic-frame";
import { expandMemeRefs, memeticWikitextDeserializer, type TiddlerFields } from "../src/deserializer.js";
import { memeticIngestOps } from "../src/ingest-gate.js";

const URI = "lar:///tests/root-meta-body";
const FIXTURE = new URL("./fixtures/root-meta-body.mem", import.meta.url).pathname;

function records(text: string): Map<string, TiddlerFields> {
  return new Map(memeticWikitextDeserializer(text, { title: URI }).map((r) => [String(r.title), r]));
}

function reader(map: Map<string, TiddlerFields>) {
  return (title: string) => map.get(title);
}

describe("root metadata is authored body", () => {
  test("projects every serializable parent field, including title", () => {
    const map = records(readFileSync(FIXTURE, "utf8"));
    const root = map.get(URI)!;
    expect(root.title).toBe(URI);
    expect(root["uri-path"]).toBe("tests/root-meta-body");
    expect(root.type).toBe("text/memetic-wikitext+tiddlywiki");
    expect(root.custom).toBe("root-authority");
    expect(root.text).toContain("Root prose is inside the checked body.");
    expect(map.has(`${URI}#/one`)).toBe(true);
    expect(map.has(`${URI}#/one/two`)).toBe(true);
  });

  test("emits root TOML immediately after STX and retains it on reparse", () => {
    const map = records(readFileSync(FIXTURE, "utf8"));
    const rendered = expandMemeRefs(reader(map), URI)!;
    expect(rendered.indexOf('code="&#x0002;">>\n\n```toml meta')).toBeGreaterThanOrEqual(0);
    expect(rendered).not.toMatch(/SOH[\s\S]*```toml meta/);
    const reparsed = records(rendered);
    expect(reparsed.get(URI)!["custom"]).toBe("root-authority");
    expect(reparsed.get(URI)!.title).toBe(URI);
  });

  test("a root TOML byte mutation mismatches the BCC", () => {
    const map = records(readFileSync(FIXTURE, "utf8"));
    const rendered = expandMemeRefs(reader(map), URI)!;
    const span = checkSpan(rendered)!;
    const good = rendered.slice(span.start, span.end);
    // ADJACENT: the check follows the ETX sigil with nothing between.
    expect(rendered.slice(span.end).startsWith(bccOfSpan(good))).toBe(true);
    const mutated = rendered.replace("root-authority", "root-mutated");
    const diagnostic = memeticIngestOps.deserialize(URI, mutated).diagnostics;
    // GRADED A WARNING, never an error: a stale check on a human's disk edit is an edit, never
    // tampering (ingest law (a)) — it still surfaces on the shared diagnostics channel.
    expect(diagnostic.some((d) => d.code === "block-check-mismatch" && d.severity === "warning")).toBe(true);
  });
});

describe("★ root metadata before STX is a frame fault, never recovered ★", () => {
  const preStx = readFileSync(FIXTURE, "utf8").replace(
    '<<^ code="&#x0001;" from="?" -> to="lar:///tests/root-meta-body">>\n<<^ code="&#x0002;">>\n\n```toml meta',
    '<<^ code="&#x0001;" from="?" -> to="lar:///tests/root-meta-body">>\n```toml meta',
  ).replace('```\n\nRoot prose', '```\n\n<<^ code="&#x0002;">>\n\nRoot prose');

  test("the gate refuses it on the frame fault `meta-before-stx`", () => {
    const diagnostics = memeticIngestOps.deserialize(URI, preStx).diagnostics;
    expect(diagnostics.filter((d) => d.severity === "error").map((d) => d.code)).toEqual(["meta-before-stx"]);
  });

  test("the deserializer lifts no field from it — the torn carrier holds verbatim as ONE flagged record", () => {
    const held = memeticWikitextDeserializer(preStx, { title: URI });
    expect(held).toHaveLength(1);
    expect(held[0]!.title).toBe(URI);
    expect(held[0]!.text).toBe(preStx);
    expect(held[0]!.type).toBe("text/plain");
    expect(held[0]!["custom"]).toBeUndefined();
    expect(held[0]!["uri-path"]).toBeUndefined();
    expect(String(held[0]!["$torn"])).toContain("toml meta fence stands before STX");
  });
});
