/**
 * ONE SLOT, ONE ADDRESS — `#/a` constitutes an ahu slot. A bare `#a` stays
 * verbatim and diagnostic-bearing; it cannot silently become a child tiddler.
 */
import { describe, test, expect } from "vitest";

import { deserializeCarrier } from "../src/deserializer.js";
import { memeticIngestOps } from "../src/ingest-gate.js";
import { parseMemeText } from "../src/meme-ast/parse.js";

const URI = "lar:///t/spelling";
const carrier = (body: string): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t/spelling"\n\`\`\`\n\n` +
  body + `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;
const bare = carrier("<<~ ahu #a>>\n\n! a\n\n<<~/ahu>>\n");
const rooted = carrier("<<~ ahu #/a>>\n\n<<~ ahu #/c>>\n\n! c\n\n<<~/ahu>>\n\n<<~/ahu>>\n");

describe("the rooted ahu slot law", () => {
  test("a bare slot stays in root bytes and mints no child record", () => {
    const decoded = deserializeCarrier(bare, { title: URI });
    expect(decoded.records.map((r) => r.title)).toEqual([URI]);
    expect(String(decoded.records[0]?.text)).toContain("<<~ ahu #a>>");
    expect([...memeticIngestOps.declaredStructure(bare)]).toEqual([]);
  });

  test("a bare slot surfaces as a partial ahu form instead of disappearing", () => {
    const parsed = parseMemeText(URI, bare);
    expect(parsed.failures.some((f) => f.reason === "partial-form:ahu")).toBe(true);
    expect(JSON.stringify(parsed.nodes)).toContain("<<~ ahu #a>>");
  });

  test("rooted nested slots mint their complete fragment path", () => {
    const decoded = deserializeCarrier(rooted, { title: URI });
    expect(decoded.records.map((r) => r.title).filter((title) => !title.includes("/$")).sort())
      .toEqual([URI, `${URI}#/a`, `${URI}#/a/c`]);
    expect(String(decoded.records.find((r) => r.title === `${URI}#/a`)?.text))
      .toContain("<<~ kahea ahu #/c>>");
  });
});
