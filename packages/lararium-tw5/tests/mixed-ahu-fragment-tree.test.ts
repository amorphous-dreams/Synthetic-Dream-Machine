/**
 * A single carrier may use both first-class ahu spellings. The worksite is
 * path-addressed, so authored surface cannot change the projected tree.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { expandMemeRefs, memeticWikitextDeserializer } from "../src/deserializer.js";
import { parseMemeText } from "../src/meme-ast/parse.js";

const URI = "lar:///test/mixed-ahu-fragment-tree";
const FIXTURE = fileURLToPath(new URL("./fixtures/mixed-ahu-fragment-tree.mem", import.meta.url));
const carrier = readFileSync(FIXTURE, "utf8");

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
