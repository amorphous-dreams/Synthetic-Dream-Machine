/**
 * tw5-file-info-parity — the house's pure port sites the SAME file TiddlyWiki's own filesystem
 * module sites, for the same tiddler under the same `$:/config/FileSystemPaths` and
 * `$:/config/FileSystemExtensions` cascades.
 *
 * ── THE ORACLE IS THE FORK, NEVER A HAND-WRITTEN PATH ───────────────────────────────────────────
 * `TiddlyWiki5/core-server/filesystem.js` is Node-only and absent from the island's core blob, so
 * the house re-implements its pure half (`tw5-file-info.ts`). A hand-written expectation would pin
 * whatever the port does; this suite LOADS the fork's module against the booted engine's own `$tw`
 * and drives `generateTiddlerFileInfo` for every vector, so the expectation IS the fork's answer.
 * The uniquifier (`fs.existsSync`) is the one Node leg the port does not carry; `overwrite: true`
 * switches it off on the oracle side.
 *
 * ── WHY PARITY HERE MATTERS ─────────────────────────────────────────────────────────────────────
 * A stock `tiddlywiki --listen` writes through the filesystem adaptor; a lararium island writes
 * through the projector. The same record MUST land at the same relative path with the same bytes
 * on both, or the two doors disagree about what a folder wiki holds.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

import { describe, expect, test, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { bootTestWiki, wikiSkip, skipNote, REPO } from "./test-wiki.js";
import { makeTw5FileInfo } from "../src/tw5-file-info.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { TW5Instance } from "../src/types/tiddlywiki.js";

const FORK_FILESYSTEM = path.join(REPO, "TiddlyWiki5/core-server/filesystem.js");
const DIRECTORY = "/oracle";

interface ForkFileInfo { filepath: string; type: string; hasMetaFile: boolean; encoding?: string }
interface ForkFilesystem {
  generateTiddlerFileInfo(tiddler: unknown, options: Record<string, unknown>): ForkFileInfo;
}

/** Load the fork's Node-only module against the booted engine's `$tw` — its own code, its own utils. */
function loadForkFilesystem($tw: { utils: object }): ForkFilesystem {
  const src = readFileSync(FORK_FILESYSTEM, "utf8");
  const exports: Record<string, unknown> = {};
  // TW5 installs a `utils-node` module's exports onto `$tw.utils`, and the module calls its siblings
  // through that surface (`$tw.utils.generateTiddlerFilepath`). A prototype-chained `$tw` gives the
  // oracle that surface without touching the engine's own.
  const utils = Object.create($tw.utils) as Record<string, unknown>;
  const oracleTw = Object.create($tw) as { utils: Record<string, unknown> };
  oracleTw.utils = utils;
  const fn = new Function("exports", "require", "$tw", "module", src);
  fn(exports, createRequire(import.meta.url), oracleTw, { exports });
  Object.assign(utils, exports);
  return exports as unknown as ForkFilesystem;
}

/** The siting rule the house's loci law spells as a filter: a `lar:///w.w.w/…` root sites at its uri-path. */
const LOCI_PATH_RULE = "[prefix[lar:///]regexp[^lar:///\\w+\\.\\w+\\.\\w+/(?:(?!#).)*$]removeprefix[lar:///]]";

const PATH_CASCADES: ReadonlyArray<readonly string[]> = [
  [],
  [LOCI_PATH_RULE],
  ["[tag[x]addprefix[x/]]", LOCI_PATH_RULE],
  ["[is[system]addprefix[system/]]"],
];
const EXT_CASCADES: ReadonlyArray<readonly string[]> = [
  [],
  ["[type[text/markdown]then[.md]]"],
  ["[tag[x]then[.tid]]"],
  ["[tag[x]then[.json]]"],
];

const VECTORS: ReadonlyArray<Record<string, string>> = [
  { title: "lar:///ha.ka.ba/lares/api/pono/thing", text: "wikitext" },
  { title: "lar:///ha.ka.ba/lares/parity/note", type: "text/markdown", text: "# note", tags: "x" },
  { title: "lar:///ha.ka.ba/lares/parity/photo", type: "image/png", text: "iVBORw0KGgo=" },
  { title: "lar:///ha.ka.ba/lares/parity/data", type: "application/json", text: "{\"a\":1}" },
  { title: "HelloThere", text: "content" },
  { title: "Shopping List", text: "spaces" },
  { title: "$:/SiteTitle", text: "system" },
  { title: "sub/CON", text: "a reserved device name inside a segment" },
  { title: "trailing. ", text: "trailing dots and spaces" },
  { title: "back\\slash", text: "a backslash" },
  { title: "...dots", text: "leading dots" },
  { title: "a:b|c?d*e", text: "illegal characters" },
  { title: "ünïcödé", text: "transliteration" },
  { title: "unsafe", "weird:name": "v", text: "an unsafe field name → json" },
  { title: "leading", tags: " padded ", text: "an unsafe field value → json" },
  { title: "lar:///ha.ka.ba/lares/parity/carrier#/slot", text: "a fragment record" },
];

describe.skipIf(wikiSkip)(`tw5-file-info parity — the port sites what the fork sites${skipNote}`, () => {
  let engine: TW5Engine;
  let fork: ForkFilesystem;
  let $tw: TW5Instance;

  beforeAll(async () => {
    engine = await bootTestWiki({ tiddlers: VECTORS });
    $tw = engine.$tw as unknown as TW5Instance;
    fork = loadForkFilesystem($tw as unknown as { utils: object });
  }, 120_000);

  for (const pathFilters of PATH_CASCADES) {
    for (const extFilters of EXT_CASCADES) {
      const label = `paths=${JSON.stringify(pathFilters)} exts=${JSON.stringify(extFilters)}`;
      test(`★ every vector sites and types as the fork does — ${label} ★`, () => {
        for (const fields of VECTORS) {
          const tiddler = new $tw.Tiddler(fields as Record<string, string>);
          const oracle = fork.generateTiddlerFileInfo(tiddler, {
            directory: DIRECTORY,
            pathFilters: pathFilters.length ? [...pathFilters] : undefined,
            extFilters: extFilters.length ? [...extFilters] : undefined,
            wiki: $tw.wiki,
            fileInfo: { overwrite: true },
          });
          const port = makeTw5FileInfo($tw, fields["title"]!, fields, { pathFilters, extFilters });
          const oracleRel = path.relative(DIRECTORY, oracle.filepath);
          expect(port.relPath, `${fields["title"]}: path`).toBe(oracleRel);
          expect(port.type, `${fields["title"]}: type`).toBe(oracle.type);
          expect(port.hasMetaFile, `${fields["title"]}: hasMetaFile`).toBe(oracle.hasMetaFile);
        }
      });
    }
  }

  test("the loci rule sites a lar:///w.w.w/ root at its uri-path, and a fragment falls through", () => {
    const info = makeTw5FileInfo($tw, "lar:///ha.ka.ba/lares/parity/note", VECTORS[1]!, { pathFilters: [LOCI_PATH_RULE] });
    expect(info.relPath).toBe("ha.ka.ba/lares/parity/note.md");
    expect(info.pathRuled).toBe(true);
    const frag = makeTw5FileInfo($tw, "lar:///ha.ka.ba/lares/parity/carrier#/slot", VECTORS[15]!, { pathFilters: [LOCI_PATH_RULE] });
    expect(frag.pathRuled).toBe(false);
  });
});
