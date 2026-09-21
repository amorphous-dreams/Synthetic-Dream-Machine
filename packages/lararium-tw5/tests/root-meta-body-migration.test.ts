import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { bccOfSpan } from "../src/carrier-check.js";
import { checkedSpan } from "../src/block-check.js";
import { deserializeCarrier, expandMemeRefs, memeticWikitextDeserializer, type TiddlerFields } from "../src/deserializer.js";

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
    const good = checkedSpan(rendered)!;
    expect(rendered.slice(rendered.indexOf("ni:///"))).toContain(bccOfSpan(good, "⊙"));
    const mutated = rendered.replace("root-authority", "root-mutated");
    const diagnostic = deserializeCarrier(mutated, { title: URI }).diagnostics;
    expect(diagnostic.some((d) => d.code === "block-check-mismatch")).toBe(true);
  });
});

describe("legacy root metadata remains recoverable but is not emitted", () => {
  test("pre-STX metadata surfaces a diagnostic and body survives", () => {
    const legacy = readFileSync(FIXTURE, "utf8").replace(
      '<<^ code="&#x0001;" from="?" -> to="lar:///tests/root-meta-body">>\n<<^ code="&#x0002;">>\n\n```toml meta',
      '<<^ code="&#x0001;" from="?" -> to="lar:///tests/root-meta-body">>\n```toml meta',
    ).replace('```\n\nRoot prose', '```\n\n<<^ code="&#x0002;">>\n\nRoot prose');
    const map = records(legacy);
    expect(map.get(URI)!.text).toContain("Root prose");
    const warning = [...map.values()].find((r) => String(r.tags ?? "").includes("parse-warning"));
    expect(warning?.text).toMatch(/outside|STX|legacy|meta/i);
  });
});
