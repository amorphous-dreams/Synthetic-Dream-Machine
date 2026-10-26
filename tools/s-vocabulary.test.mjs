import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { trackedCode, retiredWords } from "./s-vocabulary.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// The retired abbreviation, spelled only by joining letters, so this file passes its own check.
const lo = "v" + "k";
const up = "V" + "K";
const cap = "V" + "k";

test("KNOWN POSITIVE: the check catches every spelling, in code, in a comment and in a string", () => {
  const planted = [
    `const ${lo} = 1;`, `function mint${cap}() {}`, `type Vessel${cap} = number;`, `const ${up}_SEAL_MAGIC = 1;`, `const new${cap} = 2;`,
    `obj.${lo}Check = 3;`, `class Tree${cap}Refusal {}`, `export { open${cap} };`, `let old${up} = 4;`,
    `// the ${up} retired`, `/* a ${up}-sealed carrier */ const a = 1;`, `const info = "${lo}-check";`, `const text = 'the ${up} opens';`,
  ];
  for (const line of planted) assert.ok(retiredWords(line).length > 0, `the check misses: ${line}`);
});

test("CONTROL: unrelated words read clean", () => {
  const clean = [
    "const prevKeys = 1; const recvKey = 2;", "const treeKey = 3; const S_SEAL_MAGIC = 4; const VERIFYING_KEY = 5; const keyCheck = 6;",
    "// the S key opens the gate root", 'const info = "tree-key-check";', "const tkv = 7; const vkx = 8;".replace("vkx", "vxk"),
  ];
  for (const line of clean) assert.deepEqual(retiredWords(line), [], `the check flags a clean line: ${line}`);
});

test("no word in tracked code, comment or string spells the retired omnibus key", () => {
  const hits = [];
  for (const f of trackedCode()) {
    for (const h of retiredWords(readFileSync(join(ROOT, f), "utf8"))) hits.push(`${f}:${h.line}  ${h.word}`);
  }
  assert.deepEqual(hits, []);
});
