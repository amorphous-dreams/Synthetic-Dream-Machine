// vm-grammar-boundary: exempt — drives memeticWikitextDeserializer (the blessed entry point)
// for every record-shape assertion; it calls parseMemeText ONLY to reach a diagnostic
// (`partial-form:ahu`, the raw node tree's Ahu count) the deserializer's own surface never
// exposes — the same compile-layer-diagnostic reasoning as waiho-equals-separator.test.ts and
// fence-mask-info-string.test.ts.
/**
 * A single carrier may use both first-class ahu spellings. The worksite is
 * path-addressed, so authored surface cannot change the projected tree.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { stampCarrier } from "@lararium/memetic-frame";

import { expandMemeRefs, memeticWikitextDeserializer } from "../src/deserializer.js";
import { parseMemeText } from "../src/meme-ast/parse.js";

const URI = "lar:///test/mixed-ahu-fragment-tree";
const FIXTURE = fileURLToPath(new URL("./fixtures/mixed-ahu-fragment-tree.mem", import.meta.url));

/**
 * THE AUTHORED BYTES ARE BUILT HERE. The fixture rests canonical (every slot a sharktooth `ahu`), because
 * the staged-carrier gate folds the English mirror on write and a fixture holding it cannot land. This
 * suite authors the mixed surface from it — the slots below re-spelled `<<fragment …>>` with their own
 * closers — and re-stamps the check, so the bytes under test still carry both spellings.
 */
const ENGLISH = new Set(["#/ridge/fern", "#/tide", "#/tide/reef/fish", "#/sky/cloud"]);
function authoredMixed(canonical: string): string {
  const stack: boolean[] = [];
  const lines = canonical.split("\n").map((line) => {
    const open = /^<<~ ahu slot=`([^`]+)`>>$/.exec(line);
    if (open) {
      const english = ENGLISH.has(open[1]!);
      stack.push(english);
      return english ? `<<fragment slot=\`${open[1]}\`>>` : line;
    }
    if (line === "<<~/ahu>>") return stack.pop() ? "<</fragment>>" : line;
    return line;
  });
  return stampCarrier(lines.join("\n"));
}
const carrier = authoredMixed(readFileSync(FIXTURE, "utf8"));

const addressed = [
  URI,
  `${URI}#/ridge`,
  `${URI}#/ridge/fern`,
  `${URI}#/ridge/fern/spore`,
  `${URI}#/tide`,
  `${URI}#/tide/reef`,
  `${URI}#/tide/reef/fish`,
  `${URI}#/sky`,
  `${URI}#/sky/cloud`,
].sort();

/** Both forms become `Ahu` nodes; nesting lives in their `body`, not the root list. */
function ahuCount(nodes: readonly { kind: string; body?: readonly { kind: string; body?: unknown[] }[] }[]): number {
  return nodes.reduce((count, node) => count + (node.kind === "Ahu" ? 1 : 0) +
    (Array.isArray(node.body) ? ahuCount(node.body) : 0), 0);
}

describe("mixed ahu/fragment carrier tree", () => {
  test("both spellings project one complete rooted address tree", () => {
    const records = memeticWikitextDeserializer(carrier, { title: URI });
    // Preamble/postamble carriage records preserve interstitial bytes; they are
    // not declared ahu worksites, so this witness compares addressable nodes.
    expect(records.map((record) => String(record.title)).filter((title) => !title.includes("/$")).sort())
      .toEqual(addressed);
  });

  test("both spellings lower to the same ahu AST intent", () => {
    const parsed = parseMemeText(URI, carrier);
    expect(parsed.failures).toEqual([]);
    expect(ahuCount(parsed.nodes)).toBe(8);
  });

  test("the shared intent backend round-trips the authored carrier bytes", () => {
    const records = memeticWikitextDeserializer(carrier, { title: URI });
    const reader = (title: string) => records.find((record) => record.title === title);
    const rendered = expandMemeRefs(reader, URI);

    const fern = records.find((record) => record.title === `${URI}#/ridge/fern`);
    expect(Object.keys(fern ?? {}).some((key) => key.startsWith("$worksite-"))).toBe(false);
    expect(records.find((record) => record.title === `${URI}#/ridge/fern/$worksite-open`)?.text)
      .toContain("<<fragment");
    expect(rendered).toBe(carrier);
  });
});
