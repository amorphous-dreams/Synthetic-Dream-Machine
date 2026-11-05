// playwright-image-digest.test.mjs — every Playwright image reference pins its content by digest.
// A tag moves: `v1.64.1-noble` can name different bytes tomorrow, and the harness image runs the QA walks and
// the capability probe. `<tag>@sha256:<64 hex>` keeps the tag for the reader and the digest for the pull.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FILES = ["Dockerfile", "docker-compose.capability-probe.yml", "docker-compose.mesh.yml"];
const REF = /mcr\.microsoft\.com\/playwright:[^\s"']+/g;

test("the scan finds the Playwright image references (control)", () => {
  const total = FILES.flatMap((f) => readFileSync(join(ROOT, f), "utf8").replace(/^\s*#.*$/gm, "").match(REF) ?? []);
  assert.ok(total.length >= 4, `found ${total.length}`);
});

for (const file of FILES) {
  test(`${file}: every Playwright image reference carries @sha256:<digest>`, () => {
    const refs = readFileSync(join(ROOT, file), "utf8").replace(/^\s*#.*$/gm, "").match(REF) ?? [];
    assert.ok(refs.length > 0, `${file} holds no reference`);
    for (const ref of refs) assert.match(ref, /^mcr\.microsoft\.com\/playwright:[\w.-]+@sha256:[0-9a-f]{64}$/, ref);
  });
}
