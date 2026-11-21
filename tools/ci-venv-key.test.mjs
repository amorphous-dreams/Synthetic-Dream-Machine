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
    const id = /steps\.([\w-]+)\.outputs\.python-version/.exec(key)?.[1];
    assert.ok(id, key);
    assert.match(yml, new RegExp(`\\n\\s+id: ${id}\\n`), `a step carries id ${id} so its output is readable`);
  });
}

// A job container (the Playwright image) mounts the runner's hostedtoolcache, and setup-python's build there links
// the runner image's OpenSSL, which the container's own libraries do not carry: its `ssl` fails to import and pip
// cannot reach PyPI. The container cells therefore stand the venv on the image's own python3, setup-python runs on
// the bare-runner cells alone, and every interpreter the venv stands on must answer `import ssl` or fail by name.
{
  const yml = code(readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8"));
  const cells = /\n  test-cells:\n[\s\S]*?(?=\n  [\w-]+:\n)/.exec(yml)?.[0] ?? "";
  const step = (head) => new RegExp(`${head}[^\\n]*\\n(?:\\s{8,}[^\\n]*\\n|\\n)*?(?=\\s{6}- )`).exec(cells)?.[0] ?? "";
  const setupPy = step("- uses: actions/setup-python@");
  const stand = step("- name: Stand the holder venv \\(~/\\.venv\\)");

  test("ci.yml test-cells: the job runs container cells and stands a holder venv (control)", () => {
    assert.match(cells, /container: \$\{\{ matrix\.container \}\}/);
    assert.ok(setupPy, "test-cells carries a setup-python step");
    assert.ok(stand, "test-cells carries the venv step");
  });

  test("ci.yml test-cells: setup-python runs on the bare-runner cells alone", () => {
    assert.match(setupPy, /\n\s+if: \$\{\{ !matrix\.container(?: && contains\(needs\.scope\.outputs\.cells, matrix\.cell\))? \}\}\n/, setupPy);
  });

  test("ci.yml test-cells: the interpreter that stands the venv must carry ssl, failing by name", () => {
    assert.match(cells, /python3 -c ['"]import ssl['"][^\n]*\|\|[^\n]*::error[^\n]*ssl/, "a missing ssl module names itself");
  });

  test("ci.yml test-cells: a restored venv whose interpreter lacks ssl stands again", () => {
    assert.match(stand, /CACHE_HIT" = 'true' \] && ~\/\.venv\/bin\/python3 -c ['"]import ssl['"]/, stand);
  });

  test("ci.yml test-cells: a pip-less interpreter (the image's python3) bootstraps pip into the venv", () => {
    assert.match(stand, /python3 -m venv --without-pip ~\/\.venv/, stand);
    assert.match(stand, /get-pip\.py/, stand);
  });
}
