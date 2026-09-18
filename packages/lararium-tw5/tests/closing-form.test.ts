/**
 * closing-form — A TAUGHT CLOSER MUST BE A CLOSER THE ENGINE WOULD ACCEPT.
 *
 * ── THE LAW ──────────────────────────────────────────────────────────────────────────────────────
 * A block sigil closes the way an HTML tag closes: the slash rides tight against the mark and the
 * name follows it immediately — `<<~/ahu>>`. `BLOCK_CLOSERS` holds that literal and `findCloseEnd`
 * searches for it with `indexOf`, so ANY other spelling closes nothing at all.
 *
 * ── WHY THIS WALKS THE DOCS AND NOT ONLY THE CODE ────────────────────────────────────────────────
 * A closer the engine refuses is silent: the block simply never closes, and the carrier reads as an
 * unterminated open. The engine's own forms were correct — 4005 `<<~/ahu>>` stand in this corpus. It
 * was the TEACHING that drifted: sigil tiddlers and spec carriers showed `<<~/ wehe>>` and
 * `<<~/ \procedure>>`, spellings no reader could have used successfully.
 *
 * A grammar that documents a form it cannot parse teaches a reader to write a carrier it will refuse.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { BLOCK_CLOSERS } from "../src/wikirules/lar-sigil-shared.js";
import { carrierFiles } from "../src/carrier-files.js";

const REPO = join(new URL("..", import.meta.url).pathname, "../..");

/**
 * THE TWO SPELLINGS THAT CLOSE NOTHING — a space after the slash, or a backslash before the name.
 * `findCloseEnd` searches for the literal `<<~/name`, so either one misses by exactly one character
 * and the block never closes.
 *
 * The bare mark `<<~/` names the TOKEN and appears in a spec table and inside a documented regex; it
 * opens no claim about a name, so this reader passes over it. A law that flagged the token itself
 * would forbid the grammar from writing its own vocabulary down.
 */
const BROKEN_CLOSER = /<<~\/(?:\s+[\\]?[\w-]+|\\[\w-]+)/g;
const ANY_CLOSER = /<<~\/[\w-]*/g;

/**
 * TWO SOURCES, TWO QUESTIONS. The CORPUS comes from the one finder — a file counts because it
 * DECLARES, never because a path matched. The grammar's own sigil-definition tiddlers declare nothing
 * and are not corpus, yet they TEACH the closing form to every reader who opens one, so they are
 * named here as a second source rather than folded into the corpus answer.
 */
function taught(): Array<{ rel: string; text: string }> {
  const defs = execSync('git ls-files "packages/lararium-tw5/tiddlers/*.tid"', { cwd: REPO, encoding: "utf8" })
    .split("\n").filter(Boolean);
  const files = [...new Set([...carrierFiles(REPO), ...defs])];
  return files.map((rel) => ({ rel, text: readFileSync(join(REPO, rel), "utf8") }));
}

describe("★ a closer closes the way the engine reads one ★", () => {
  const all = taught();

  test("the walk presents files", () => {
    // THE FLOOR IS THE INSTRUMENT: a walker that stopped seeing its subject reports the cleanest run.
    expect(all.length).toBeGreaterThan(400);
  });

  test("BLOCK_CLOSERS itself carries the tight form", () => {
    for (const [name, tag] of Object.entries(BLOCK_CLOSERS)) expect(tag).toBe(`<<~/${name}`);
  });

  test("★ every closer taught anywhere is one the engine would accept ★", () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const { rel, text } of all) {
      ANY_CLOSER.lastIndex = 0;
      while (ANY_CLOSER.exec(text) !== null) seen++;
      BROKEN_CLOSER.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = BROKEN_CLOSER.exec(text)) !== null) {
        if (offenders.length < 14) offenders.push(`${rel}  ${JSON.stringify(m[0].slice(0, 30))}`);
      }
    }
    expect(seen, "no closer found at all — the walker lost its subject").toBeGreaterThan(1000);
    expect(offenders, "these spellings close nothing the engine can find").toEqual([]);
  });
});
