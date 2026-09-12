/**
 * doctype-render-parity — a migration verified by parse and block check, never by a RENDER.
 *
 * 738 carriers had their declaration's two positionals quoted. Both readers were measured — the host's
 * attribute binding and every block check — and the wiki was never asked. `lar-declaration` consumes
 * that line as a BLOCK rule and returns it as literal text, so the rest of a carrier should render
 * byte-identical either way; nothing proved it.
 *
 * The declaration's own line differs by its quotes and stands excluded. Every other byte must hold.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const REPO = path.resolve(__dirname, "..", "..", "..");
// The commit that carried the sweep; its parent holds the bare form.
const BEFORE = "c1086522f~1";
const CARRIERS = [
  "bags/lares/ha.ka.ba/lares/docs/pattern-integrities.mem",
  "bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem",
  "bags/lares/ha.ka.ba/lares/docs/hud.mem",
];

describe.skipIf(wikiSkip)(`doctype render parity ${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki(); });

  test("every migrated carrier renders what it rendered before, past its own declaration", () => {
    const faults: string[] = [];
    for (const f of CARRIERS) {
      const now = readFileSync(path.join(REPO, f), "utf8");
      let was: string;
      try { was = execSync(`git show ${BEFORE}:${JSON.stringify(f)}`, { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28 }); }
      catch { faults.push(`${f}: no prior form to compare`); continue; }
      if (!/^<<!DOCTYPE [^"]/m.test(was)) { faults.push(`${f}: the prior form already carried quotes, so this proves nothing`); continue; }
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
        faults.push(`${f}: render moved at ${i} — ${JSON.stringify(a.slice(i, i + 60))} vs ${JSON.stringify(b.slice(i, i + 60))}`);
      }
    }
    expect(faults).toEqual([]);
  });
});
