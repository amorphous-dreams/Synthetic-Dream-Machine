import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = join(import.meta.dirname, "..");

test("CONTROL: the roster still names its container witness holdout", async () => {
  const source = await readFile(join(ROOT, "tools/witness-all.sh"), "utf8");
  assert.match(source, /\[civic-witness\]="stands containerized vessels — run it directly"/);
});

test("tree-clean is held out because CI shards run e2e and local vessel writes dirty the tracked tree", async () => {
  const source = await readFile(join(ROOT, "tools/witness-all.sh"), "utf8");
  assert.match(source, /\[tree-clean-witness\]=["']the e2e set runs through the CI shards; a local run stages vessels and reads any write into the tracked tree as red["']/);
  assert.match(source, /for path in tools\/\*witness\*\.sh/);
});
