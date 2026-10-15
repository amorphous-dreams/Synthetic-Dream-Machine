/**
 * doctype-render-parity — a migration verified by parse and block check, never by a RENDER.
 *
 * 738 carriers had their declaration's two positionals quoted. Both readers were measured — the host's
 * attribute binding and every block check — and the wiki was never asked. `lar-declaration` consumes
 * that line as a BLOCK rule and returns it as literal text, so the rest of a carrier should render
 * byte-identical either way; nothing proved it.
 *
 * The declaration's own line differs by its quotes and stands excluded. Every other byte must hold.
 *
 * ── THE FIXTURE IS THE VINTAGE, NEVER THE CLONE'S HISTORY ───────────────────────────────────────
 * The comparison holds one carrier's bare-declaration form against its quoted form at the sweep that
 * moved it. Reading those two forms from git — the sweep commit and its parent — ties a RENDER test to
 * whatever depth a clone happened to fetch: a depth-1 checkout holds neither commit, and absence of
 * history then reads as a carrier fault, which names the wrong thing. The two forms do not change once
 * the sweep lands, so this suite reads them from committed fixtures instead (`fixtures/doctype-render-
 * parity/<slug>.json`, captured once from the sweep commit and its parent) — the comparison runs the
 * same whether the clone is shallow or whole, and a shallow CI runner proves exactly what a full clone
 * would.
 *
 * THE FIXTURE IS JSON, NEVER `.mem` — ON PURPOSE. Each fixture freezes a carrier at a PAST vintage,
 * which the TODAY's canonical-form check (`meme-check-staged`, `tools/meme-check-staged.sh`) has no
 * reason to agree with: canon's own shape has moved since that commit. A `.mem` fixture would read as
 * a live carrier drifted from today's form and refuse every commit that touches it. The JSON wrapper
 * keeps the frozen bytes exactly what they were while staying outside that glob.
 *
 * Each fixture pair is RENDERED HERE, with the live engine, every run — a frozen pair of SOURCE texts,
 * never a frozen render. A future grammar or renderer change that moves how either form renders still
 * shows up as a mismatch, which is the property this suite exists to hold: the migration's declaration
 * quoting must stay invisible to the render, under whatever engine is live today.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const FIXTURE_DIR = path.resolve(__dirname, "fixtures", "doctype-render-parity");

interface FixturePair { before: string; after: string; }

const SLUGS = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -".json".length))
  .sort();

describe.skipIf(wikiSkip)(`doctype render parity ${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki(); });

  test("fixture pairs exist — a suite with none proves nothing", () => {
    expect(SLUGS.length).toBeGreaterThan(0);
  });

  test("every migrated carrier renders what it rendered before, past its own declaration", () => {
    const faults: string[] = [];
    for (const slug of SLUGS) {
      const pair: FixturePair = JSON.parse(readFileSync(path.join(FIXTURE_DIR, `${slug}.json`), "utf8"));
      const { before: was, after: now } = pair;
      if (!/^<<!DOCTYPE [^"]/m.test(was)) { faults.push(`${slug}: the "before" fixture already carries quotes, so this proves nothing`); continue; }
      // THE RENDER ESCAPES ITS OWN ANGLES. A strip written against the SOURCE form matches nothing
      // in HTML, and the declaration line then reads as the only divergence — which is the one
      // divergence this test exists to exclude.
      const strip = (h: string) => h
        .replace(/(?:<<|&lt;&lt;)!DOCTYPE[\s\S]*?(?:>>|&gt;&gt;)/g, "")
        .replace(/&quot;/g, "");
      const a = strip(engine.renderText(was, "text/memetic-wikitext+tiddlywiki"));
      const b = strip(engine.renderText(now, "text/memetic-wikitext+tiddlywiki"));
      if (a !== b) {
        let i = 0; while (i < a.length && a[i] === b[i]) i += 1;
        faults.push(`${slug}: render moved at ${i} — ${JSON.stringify(a.slice(i, i + 60))} vs ${JSON.stringify(b.slice(i, i + 60))}`);
      }
    }
    expect(faults).toEqual([]);
  });
});
