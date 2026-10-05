/**
 * weave-xml2rfc-heldout — a held-out toolchain witness over the kramdown-rfc2629 shelf.
 *
 * The shelf at bags/lares/ha.ka.ba/lares/api/pono/submissions holds projected .md + .md.meta
 * pairs; the house specs among them are the pairs whose .md.meta records
 * `variant: kramdown-rfc2629` — derived here by reading every *.md.meta on the shelf, never
 * hand-listed. Each derived .md already carries kramdown-rfc YAML frontmatter (projectSubmission
 * in src/weave/index.ts). This witness feeds that frontmatter through the REAL external
 * toolchain — `kramdown-rfc` (or its gem alias `kramdown-rfc2629`) to compile the YAML+markdown
 * into RFC XML, then `xml2rfc` to render that XML — held out from the repo's own grammar: a pass
 * here proves the shelf's output is actually consumable by the IETF tools an eventual submission
 * needs, not merely shaped like their input.
 *
 * Detection: `kramdown-rfc --version` (falling back to `kramdown-rfc2629 --version`) and
 * `xml2rfc --version`, each via spawnSync; exit 0 means present, ENOENT means absent. When either
 * tool is absent the toolchain tests report skipped, naming which tool is missing and how an
 * operator installs it:
 *   - ruby:   gem install --user-install kramdown-rfc
 *   - python: ~/.venv/bin/pip install xml2rfc   (the house's one venv)
 * Installing either tool is an operator choice this witness never makes for them — it NEVER
 * shells out to gem/pip itself.
 *
 * The CONTROL below always runs, with no tool required: it proves the derived set is non-empty
 * and that every member's frontmatter actually carries the RFC identity keys the toolchain needs
 * (docname/cat/ipr) — so a 'skipped' toolchain run never hides behind an empty or malformed set.
 */
import { describe, test, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = new URL("../../..", import.meta.url).pathname;
const SHELF = join(REPO, "bags/lares/ha.ka.ba/lares/api/pono/submissions");

const INSTALL_KRAMDOWN = "gem install --user-install kramdown-rfc";
const INSTALL_XML2RFC = "~/.venv/bin/pip install xml2rfc";

/** Derives the kramdown-rfc2629 shelf pairs by reading every .md.meta on the shelf — never a
 * hand-listed set — and keeping those whose sidecar records `variant: kramdown-rfc2629`. */
function deriveKramdownShelf(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md.meta"))
    .filter((f) => readFileSync(join(dir, f), "utf8").includes("variant: kramdown-rfc2629"))
    .map((f) => f.slice(0, -".meta".length))
    .sort();
}

type ToolProbe = { present: boolean; command: string };

function probe(primary: string, fallback?: string): ToolProbe {
  const tryOne = (cmd: string): boolean => {
    const r = spawnSync(cmd, ["--version"], { encoding: "utf8" });
    return r.error === undefined && r.status === 0;
  };
  if (tryOne(primary)) return { present: true, command: primary };
  if (fallback && tryOne(fallback)) return { present: true, command: fallback };
  return { present: false, command: primary };
}

const kramdown = probe("kramdown-rfc", "kramdown-rfc2629");
const xml2rfc = probe("xml2rfc");

const missing: string[] = [];
if (!kramdown.present) missing.push(`kramdown-rfc (ruby: \`${INSTALL_KRAMDOWN}\`)`);
if (!xml2rfc.present) missing.push(`xml2rfc (python: \`${INSTALL_XML2RFC}\`)`);
const skipReason = missing.length > 0
  ? `toolchain absent: ${missing.join("; ")} — installing is an operator choice`
  : "";

describe("CONTROL: the kramdown-rfc2629 shelf derivation itself, no external tool required", () => {
  test("the derived set is non-empty and every member carries docname/cat/ipr", () => {
    const pairs = deriveKramdownShelf(SHELF);
    expect(pairs.length).toBeGreaterThan(0);
    for (const md of pairs) {
      const body = readFileSync(join(SHELF, md), "utf8");
      expect(body).toMatch(/\bdocname:\s*"/);
      expect(body).toMatch(/\bcat:\s*"/);
      expect(body).toMatch(/\bipr:\s*"/);
    }
  });

  test("RED-PROOF: an empty derivation surfaces as a red CONTROL, not a silent zero", () => {
    // Proves the CONTROL above cannot pass vacuously: pointed at a scratch dir with no shelf
    // pairs, the same assertion the CONTROL runs must fail loudly.
    const emptyDir = mkdtempSync(join(tmpdir(), "weave-xml2rfc-empty-"));
    try {
      expect(() => expect(deriveKramdownShelf(emptyDir).length).toBeGreaterThan(0)).toThrow();
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

describe.skipIf(missing.length > 0)("held-out toolchain: kramdown-rfc then xml2rfc over the shelf", () => {
  if (missing.length > 0) {
    test.skip(skipReason, () => {});
  }

  const pairs = deriveKramdownShelf(SHELF);

  for (const md of pairs) {
    test(`${md}: kramdown-rfc compiles to XML, xml2rfc renders it, both exit 0`, () => {
      const dir = mkdtempSync(join(tmpdir(), "weave-xml2rfc-"));
      try {
        const src = readFileSync(join(SHELF, md), "utf8");
        const mdPath = join(dir, md);
        const xmlPath = mdPath.replace(/\.md$/, ".xml");
        writeFileSync(mdPath, src, "utf8");

        const compile = spawnSync(kramdown.command, [mdPath], {
          encoding: "utf8",
          timeout: 120_000,
        });
        expect(
          compile.status,
          `kramdown-rfc exit ${compile.status}, stderr:\n${compile.stderr}`,
        ).toBe(0);
        expect(compile.stderr).not.toMatch(/Error/);
        writeFileSync(xmlPath, compile.stdout, "utf8");

        const render = spawnSync(xml2rfc.command, ["--text", xmlPath], {
          encoding: "utf8",
          timeout: 120_000,
          cwd: dir,
        });
        expect(
          render.status,
          `xml2rfc exit ${render.status}, stderr:\n${render.stderr}`,
        ).toBe(0);
        expect(render.stderr).not.toMatch(/Error/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  test("NEGATIVE CONTROL: stripping `docname` from the frontmatter makes the toolchain fail", () => {
    const [md] = pairs;
    expect(md).toBeDefined();
    const dir = mkdtempSync(join(tmpdir(), "weave-xml2rfc-neg-"));
    try {
      const src = readFileSync(join(SHELF, md!), "utf8");
      const broken = src
        .split("\n")
        .filter((line) => !/^docname:\s*"/.test(line))
        .join("\n");
      const mdPath = join(dir, md!);
      writeFileSync(mdPath, broken, "utf8");

      const compile = spawnSync(kramdown.command, [mdPath], {
        encoding: "utf8",
        timeout: 120_000,
      });
      // kramdown-rfc without a docname either exits non-zero or emits an xml2rfc-rejectable
      // document; either way the eventual xml2rfc step must not report success.
      if (compile.status === 0) {
        const xmlPath = mdPath.replace(/\.md$/, ".xml");
        writeFileSync(xmlPath, compile.stdout, "utf8");
        const render = spawnSync(xml2rfc.command, ["--text", xmlPath], {
          encoding: "utf8",
          timeout: 120_000,
          cwd: dir,
        });
        expect(render.status).not.toBe(0);
      } else {
        expect(compile.status).not.toBe(0);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
