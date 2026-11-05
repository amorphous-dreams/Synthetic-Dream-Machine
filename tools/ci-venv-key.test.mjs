// ci-venv-key.test.mjs — the holder venv's cache key names every input the venv stands on.
// `hashFiles` reads files, and the mempalace submodule is one gitlink: its pyproject does not change when the
// pinned commit moves a source file the editable install carries. The key therefore folds the submodule
// COMMIT (read off the index by a step ahead of the cache) and the interpreter's exact version (the
// setup-python step's output, not its `3.12` range), so a moved pin or a new python patch restands the venv.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const code = (yml) => yml.replace(/^\s*#.*$/gm, "");
const flows = ["ci.yml", "e2e-shards.yml"];

for (const name of flows) {
  const yml = code(readFileSync(join(ROOT, ".github/workflows", name), "utf8"));
  const key = /key:\s*(holder-venv-[^\n]+)/.exec(yml)?.[1] ?? "";

  test(`${name}: the holder venv key exists (control)`, () => {
    assert.match(key, /^holder-venv-\$\{\{ runner\.os \}\}/);
    assert.match(key, /hashFiles\(/);
  });

  test(`${name}: the holder venv key folds the mempalace submodule commit`, () => {
    assert.match(key, /steps\.[\w-]+\.outputs\.(?:mempalace|sha|commit)[\w-]*/, key);
    assert.match(yml, /git rev-parse (?:HEAD:mempalace|:mempalace)/, "a step reads the gitlink commit before the cache");
  });

  test(`${name}: the holder venv key folds the exact python version`, () => {
    assert.match(key, /steps\.[\w-]+\.outputs\.python-version/, key);
    assert.match(yml, /- uses: actions\/setup-python@[^\n]+\n\s+id: [\w-]+/, "setup-python carries an id so its output is readable");
  });
}
