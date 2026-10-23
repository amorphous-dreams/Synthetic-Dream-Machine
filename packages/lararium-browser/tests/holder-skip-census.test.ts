import { expect, test } from "vitest";

const sources = import.meta.glob("./*.test.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const allowed = new Set([
  "shared-holder-production.test.ts:Firefox module graph: floor engine names why the holder is unavailable before a peer session",
  "shared-holder-production.test.ts:Firefox module graph: closing the last tab port releases the island lock and house database",
  "shared-holder-production.test.ts:Firefox module graph: pagehide's session:close releases the island lock and house database",
  "shared-holder-production.test.ts:Firefox module graph: CONTROL: a second admitted session keeps the island and Repo after the first closes",
  "shared-holder-production.test.ts:Firefox module graph: separate faces reach separate house workers",
  "shared-holder-production.test.ts:Firefox module graph: wrong house name refuses before island boot",
]);

test("every browser skip names an engine and cause in the allow list", () => {
  const found: string[] = [];
  const marker = new RegExp("\\b(?:test|it|describe)\\.(?:skipIf|skip|todo)\\(", "g");
  for (const [path, source] of Object.entries(sources)) {
    for (const line of source.split("\n")) {
      if (!marker.test(line)) continue;
      marker.lastIndex = 0;
      const title = line.match(/\)\s*\(\s*"([^"]+)"/)?.[1] ?? line.match(/\(\s*"([^"]+)"/)?.[1];
      found.push(`${path.split("/").at(-1)}:${title ?? line.trim()}`);
    }
  }
  expect(found.sort()).toEqual([...allowed].sort());
});
