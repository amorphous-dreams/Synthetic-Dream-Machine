/**
 * mesh-barrel-witness.test.mjs — no reader loads the `@lararium/mesh` barrel; each names the subpath it uses.
 *
 * WHY. A barrel import loads every module the barrel re-exports, so the pūlama closure hashes all of mesh for any
 * file that names it, and a browser worker pulls the whole mesh before it can greet. The barrel-to-subpath rewrite
 * (lar:///ha.ka.ba/kahua/memory/ruling/2026-11-24-mesh-homes) moved every reader onto `@lararium/mesh/<module>`;
 * this witness keeps the floor there, and keeps each named subpath standing in mesh's `exports` map (a subpath the
 * map never names resolves under the typecheck's `paths` and fails only where the binary reads dist).
 *
 * The barrel itself stays as a thin re-export: the isomorphic hull walks its graph, and the shell-embedded S6
 * helper in `tools/contract-witness.sh` reads it whole over dist.
 *
 * Proven:
 *   · RED: a fixture holding each barrel form (static, multi-line, side-effect, export-from, dynamic, type-position,
 *     vi.mock, vi.importActual) reads every one;
 *   · CONTROL: subpath imports, `import.meta.resolve("@lararium/mesh")` (a location anchor, never a load) and a
 *     barrel import quoted inside a string read clean;
 *   · LIVE: the tree holds no barrel reader beyond the named exceptions, each exception still holds the import it
 *     names (a healed one leaves the list), and every subpath a reader names stands in mesh's exports map.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SELF = "tools/mesh-barrel-witness.test.mjs";
const BARREL_SOURCE = "packages/lararium-mesh/src/index.ts";

/** Readers that still name the barrel, each with the reason it waits. A healed one must leave this list. */
const EXCEPTIONS = new Map([
  ["packages/lararium-node/debug-arrows.mts",
    "a dead debug script: it imports `parsePranalaEdges` and `@lararium/tldraw`, neither of which stands; it waits on a retire-or-revive ruling, not a path rewrite"],
  ["packages/lararium-tw5/tests/recipe-watch.test.ts",
    "`TEMP_BAG` left the barrel when slots went per-wiki (928d415d2); the import reads `undefined` and the suite runs over it, so seating it on a subpath where it never stood would hide that until the suite trues its temp layer"],
]);

/** Files whose subpath strings stand as fixtures for another instrument, never as imports. */
const SUBPATH_FIXTURES = new Map([
  ["packages/lararium-mesh/tests/keyslot-internal-door.test.ts", "its REACH matcher reads a planted `@lararium/mesh/keyslot.js` specifier as the breach it guards"],
]);

/** Internal subpaths no exports entry names on purpose: suites reach them through the source alias, production never. */
const INTERNAL_SUBPATHS = new Map([
  ["keyslot", "`mintKdfPort` leaves by no door (`keyslot-door` carries the public names); packages/lararium-mesh/tests/keyslot-internal-door.test.ts keeps production off it"],
]);

const FORMS = [
  ["static", /^\s*(?:import|export)\s[^;]*?\bfrom\s*(["'])@lararium\/mesh\1/gm],
  ["side-effect", /^\s*import\s*(["'])@lararium\/mesh\1/gm],
  ["import()", /\bimport\(\s*(["'])@lararium\/mesh\1\s*\)/g],
  ["vi", /\bvi\.(?:mock|doMock|unmock|importActual)\s*(?:<[^>]*>)?\(\s*(["'])@lararium\/mesh\1/g],
];

/** Every barrel load a source text holds, as `form@line`. */
export function barrelLoads(text) {
  const hits = [];
  for (const [form, re] of FORMS) {
    for (const m of text.matchAll(re)) hits.push(`${form}@${text.slice(0, m.index).split("\n").length + (m[0].match(/^\s*/)[0].split("\n").length - 1)}`);
  }
  return hits.sort();
}

/** Every `@lararium/mesh/<subpath>` a source text names. */
export function subpathsNamed(text) {
  return [...text.matchAll(/(["'])@lararium\/mesh\/([\w./-]+)\1/g)].map((m) => m[2]);
}

const SKIP = new Set(["node_modules", "dist", "dist-plugin", "tw5-core", ".git", "coverage"]);
function* sources(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* sources(p);
    else if (/\.(?:ts|tsx|mts|cts|mjs|js|cjs)$/.test(e.name)) yield p;
  }
}
function liveTree() {
  const out = [];
  for (const top of ["packages", "tools", "tests"]) {
    const dir = join(ROOT, top);
    if (!existsSync(dir)) continue;
    for (const file of sources(dir)) {
      const rel = relative(ROOT, file);
      if (rel === SELF || rel === BARREL_SOURCE) continue;
      out.push([rel, readFileSync(file, "utf8")]);
    }
  }
  return out;
}

test("RED: every barrel form reads as a load", () => {
  const fixture = [
    `import { a } from "@lararium/mesh";`,
    `import {`,
    `  b,`,
    `  type C,`,
    `} from '@lararium/mesh';`,
    `import "@lararium/mesh";`,
    `export { d } from "@lararium/mesh";`,
    `export type { E } from "@lararium/mesh";`,
    `const m = await import("@lararium/mesh");`,
    `let t: import("@lararium/mesh").T;`,
    `vi.mock("@lararium/mesh", async (real) => ({ ...(await real()) }));`,
    `const x = await vi.importActual<typeof import("@lararium/mesh")>("@lararium/mesh");`,
  ].join("\n");
  assert.deepEqual(barrelLoads(fixture), [
    "import()@10", "import()@12", "import()@9",
    "side-effect@6",
    "static@1", "static@2", "static@7", "static@8",
    "vi@11", "vi@12",
  ]);
});

test("CONTROL: subpaths, a location anchor and a quoted import read clean", () => {
  const fixture = [
    `import { a } from "@lararium/mesh/lar-uris";`,
    `import { type B } from "@lararium/mesh/automerge";`,
    `const m = await import("@lararium/mesh/face-atom");`,
    `vi.mock("@lararium/mesh/island-repo", async (real) => ({ ...(await real()) }));`,
    `const req = createRequire(import.meta.resolve("@lararium/mesh"));`,
    "expect(REACH.test(`import { nobleKdf } from \"@lararium/mesh\";`)).toBe(false);",
  ].join("\n");
  assert.deepEqual(barrelLoads(fixture), []);
  assert.deepEqual(subpathsNamed(fixture), ["lar-uris", "automerge", "face-atom", "island-repo"]);
});

test("LIVE: no reader loads the barrel beyond the named exceptions, and each exception still holds", () => {
  const readers = liveTree().filter(([, text]) => barrelLoads(text).length).map(([rel]) => rel).sort();
  const strays = readers.filter((rel) => !EXCEPTIONS.has(rel));
  assert.deepEqual(strays, [], `these files load the @lararium/mesh barrel; name the subpath instead (\`@lararium/mesh/<module>\`, the module that declares the name)`);
  const healed = [...EXCEPTIONS.keys()].filter((rel) => !readers.includes(rel));
  assert.deepEqual(healed, [], "these exceptions no longer load the barrel; take them off EXCEPTIONS");
});

test("LIVE: every subpath a reader names stands in mesh's exports map", () => {
  const exportsMap = JSON.parse(readFileSync(join(ROOT, "packages/lararium-mesh/package.json"), "utf8")).exports;
  const named = new Map();
  for (const [rel, text] of liveTree()) if (!SUBPATH_FIXTURES.has(rel)) for (const sub of subpathsNamed(text)) if (!named.has(sub)) named.set(sub, rel);
  assert.ok(named.size > 100, `the scan reads only ${named.size} subpaths; an empty scan would pass vacuously`);
  const missing = [...named].filter(([sub, rel]) => !(`./${sub}` in exportsMap) && !(INTERNAL_SUBPATHS.has(sub) && !rel.includes("/src/"))).map(([sub, rel]) => `${sub} (first named in ${rel})`);
  assert.deepEqual(missing, [], "add each to packages/lararium-mesh/package.json `exports`: { import: ./dist/<sub>.js, types: ./dist/<sub>.d.ts }");
});
