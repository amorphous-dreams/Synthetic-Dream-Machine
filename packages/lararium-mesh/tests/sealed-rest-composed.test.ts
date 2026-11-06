/**
 * sealed-rest-composed — a census of the production composition (sealed-store#/owed, R1 and R2): each vessel's own
 * Repo stands on the sealed rest, each daemon island answers the document store's door beside its holder, and the
 * node island hands its seat the fresh base's cut. Behaviour reads in `sealed-rest.test.ts` (the door over a modelled
 * key shore) and `packages/lararium-node/tests/sealed-rest-vessel.test.ts` (a real founded island); this census pins
 * the call sites a rename or a revert would drop.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const stripped = (path: readonly string[]): string => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", ...path), "utf8");
  const out = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // THE STRIP LEFT SOMETHING: a file stripped to nothing would green every absence.
  expect(out.length).toBeGreaterThan(1_000);
  return out;
};
const count = (text: string, pattern: RegExp): number => (text.match(new RegExp(pattern.source, "g")) ?? []).length;

describe("each vessel's Repo stands on the sealed rest", () => {
  it("the node's standing vessel composes its Repo over the sealed rest, and its lock flushes before a signer drops", () => {
    const node = stripped(["lararium-node", "src", "open-node-vessel.ts"]);
    expect(count(node, /composeSealedRest(<[^>]*>)?\(/)).toBe(1);
    expect(node).toMatch(/new Repo\(\{\s*storage:\s*sealedRest\.store,/);
    const uds = stripped(["lararium-node", "src", "uds-channel.ts"]);
    expect(uds).toMatch(/await opts\.beforeSignerDrops\?\.\(/);
  });

  it("the browser's vessel worker composes its Repo over the sealed rest, and its lock flushes before the lift drops", () => {
    const browser = stripped(["lararium-browser", "src", "open-browser-vessel.ts"]);
    expect(count(browser, /composeSealedRest(<[^>]*>)?\(/)).toBe(1);
    expect(browser).toMatch(/new Repo\(\{\s*storage:\s*sealedRest\.store,/);
    expect(browser).toMatch(/await sealedRest\.lock\(\)[\s\S]{0,80}lift\.drop\(\)/);
  });

  it("each daemon island answers the document store's door beside its holder", () => {
    expect(stripped(["lararium-node", "src", "node-daemon-island.ts"])).toMatch(/docStoreDoor\s*:/);
    expect(stripped(["lararium-browser", "src", "daemon-island-start.ts"])).toMatch(/docStoreDoor\s*:/);
    expect(stripped(["lararium-keyhive", "src", "operator-daemon-behavior.ts"])).toMatch(/answerDocStoreAsks\(/);
  });
});
