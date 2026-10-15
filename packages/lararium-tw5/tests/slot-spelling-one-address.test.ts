// vm-grammar-boundary: exempt — drives memeticWikitextDeserializer (the blessed entry point)
// for every record-shape assertion; it calls parseMemeText ONLY to reach a diagnostic
// (`partial-form:ahu`, the raw node tree's Ahu count) the deserializer's own surface never
// exposes — the same compile-layer-diagnostic reasoning as waiho-equals-separator.test.ts and
// fence-mask-info-string.test.ts.
/**
 * ONE SLOT, ONE ADDRESS — `#/a` constitutes an ahu slot. A bare `#a` stays
 * verbatim and diagnostic-bearing; it cannot silently become a child tiddler.
 */
import { describe, test, expect } from "vitest";

import { deserializeCarrier, memeticWikitextDeserializer } from "../src/deserializer.js";
import { memeticIngestOps } from "../src/ingest-gate.js";
import { parseMemeText } from "../src/meme-ast/parse.js";
import { checkCarrier } from "../src/carrier-check.js";

const URI = "lar:///t/spelling";
const carrier = (body: string): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t/spelling"\n\`\`\`\n\n` +
  body + `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;
const bare = carrier("<<~ ahu #a>>\n\n! a\n\n<<~/ahu>>\n");
// CANON: a nested open carries its WHOLE path from the carrier root — `#/a/c` nested inside `#/a`
// names its own full address, a strict descendant, never a leaf to append.
const rooted = carrier("<<~ ahu #/a>>\n\n<<~ ahu #/a/c>>\n\n! c\n\n<<~/ahu>>\n\n<<~/ahu>>\n");
// The RETIRED tolerance: `#/c` nested inside `#/a` is a RELATIVE form (unnormalized authoring) —
// the reader takes it verbatim (never re-prefixed to `#/a/c`), and the check names the fault.
const relative = carrier("<<~ ahu #/a>>\n\n<<~ ahu #/c>>\n\n! c\n\n<<~/ahu>>\n\n<<~/ahu>>\n");

describe("the rooted ahu slot law", () => {
  test("a bare slot stays in root bytes and mints no child record", () => {
    const decoded = { records: memeticWikitextDeserializer(bare, { title: URI }) };
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
    const decoded = { records: memeticWikitextDeserializer(rooted, { title: URI }) };
    expect(decoded.records.map((r) => r.title).filter((title) => !title.includes("/$")).sort())
      .toEqual([URI, `${URI}#/a`, `${URI}#/a/c`]);
    expect(String(decoded.records.find((r) => r.title === `${URI}#/a`)?.text))
      .toContain("<<~ kahea ahu #/a/c>>");
  });

  // READ relation (never MINT): a nested open's own path is taken verbatim — never re-composed
  // against its enclosing slot's prefix. A RELATIVE authored form reads as its OWN address, never
  // silently appended under its parent (the retired overcollapse).
  test("a RELATIVE nested open reads verbatim — never silently appended under its parent", () => {
    const decoded = { records: memeticWikitextDeserializer(relative, { title: URI }) };
    expect(decoded.records.map((r) => r.title).filter((title) => !title.includes("/$")).sort())
      .toEqual([URI, `${URI}#/a`, `${URI}#/c`]);
    // CONTROL: the tolerant double-prefix form a re-composing reader would have minted never appears.
    expect(decoded.records.map((r) => r.title)).not.toContain(`${URI}#/a/c`);
  });

  test("a RELATIVE nested open names a CHECK fault — nested-slot-outside-parent", () => {
    const diagnostics = checkCarrier(deserializeCarrier(relative, { title: URI }));
    const fault = diagnostics.find((d) => d.code === "nested-slot-outside-parent");
    expect(fault).toBeTruthy();
    expect(fault?.severity).toBe("error");
  });

  test("an address equal to its parent faults too — a collision, not a resolution", () => {
    const equal = carrier("<<~ ahu #/a>>\n\n<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n\n<<~/ahu>>\n");
    const diagnostics = checkCarrier(deserializeCarrier(equal, { title: URI }));
    expect(diagnostics.some((d) => d.code === "nested-slot-outside-parent")).toBe(true);
  });
});
