/**
 * PLANE LABELS DERIVE FROM ONE CONSTANT (Train Q, Cut 2).
 *
 * An `@` after whitespace triggers a file import in the house's own harness, so the plane and slot
 * names drop it: `daemon-plane`, `oracle-floor`, `personal-slot`, bare `lares`. Docs and code name the
 * same planes, so a text rename that left a code literal behind would desync the two. Every label the
 * code prints, asserts or keys a diagnostic by reads `PLANE_LABELS`; a spaced `@name` literal left in a
 * named source reads red here.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// Imported lazily, so the source scan and its control run on a tree where the constant does not stand yet.
const labels = await import("../src/plane-labels.js").catch((e: Error) => e);

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "../../..");

/** The sources that print, key or assert a plane label (transform-wright §2e, re-measured). */
const SOURCES = [
  "packages/lararium-node/src/open-daemon-vm.ts",
  "packages/lararium-node/src/open-node-vessel.ts",
  "packages/lararium-mesh/src/open-vessel-core.ts",
  "packages/lararium-mesh/src/effect-record.ts",
  "packages/lararium-tw5/src/sovereign-kernel.ts",
  "packages/lares-cli/src/command-help.ts",
];

const OLD = "daemon|crossroads|catalog|persona|circles|identities|sessions|intents|oracle|lares|lararium|personal|working|draft|temp";
/** A string literal (`"…"`, `'…'`, `` `…` ``) holding a spaced or leading `@name`. Comments never count. */
function spacedPlaneLiterals(src: string): string[] {
  const out: string[] = [];
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const lit = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;
  const at = new RegExp(`(?:^|\\s)@(?:\\$\\{[^}]*\\}|(?:${OLD})(?![\\w/.-]))`);
  for (const m of code.matchAll(lit)) if (at.test(m[0].slice(1, -1))) out.push(m[0]);
  return out;
}

describe("★ one constant names every plane ★", () => {
  test("the labels the cut rules", () => {
    if (labels instanceof Error) throw labels;
    const { PLANE_LABELS, planeLabelOf } = labels;
    expect(PLANE_LABELS).toEqual({
      daemon: "daemon-plane", crossroads: "crossroads-plane", catalog: "catalog-plane",
      persona: "persona-plane", circles: "circles-plane", identities: "identities-plane",
      sessions: "sessions-plane", intents: "intents-plane", oracle: "oracle-floor",
      personal: "personal-slot", working: "working-slot", draft: "draft-slot", temp: "temp-slot",
      lares: "lares", lararium: "lararium",
    });
    expect(planeLabelOf("circles", "kin")).toBe("circles-plane-kin");
    expect(planeLabelOf("intents", "kin")).toBe("intents-plane-kin");
    for (const v of Object.values(PLANE_LABELS)) expect(v).not.toContain("@");
  });

  test("no named source prints a spaced `@plane` literal", () => {
    const found = SOURCES.flatMap((rel) =>
      spacedPlaneLiterals(readFileSync(path.join(REPO, rel), "utf8")).map((l) => `${rel}: ${l}`));
    expect(found).toEqual([]);
  });

  test("CONTROL: the scan finds a known positive and passes a comment, an npm scope and a session host", () => {
    expect(spacedPlaneLiterals('const a = { label: "@daemon" };')).toEqual(['"@daemon"']);
    expect(spacedPlaneLiterals("const m = `minted in @${x} plane`;")).toHaveLength(1);
    expect(spacedPlaneLiterals('// the @daemon plane\nimport "@lararium/mesh";\nconst h = "alias:grant@crossroads";')).toEqual([]);
  });
});
