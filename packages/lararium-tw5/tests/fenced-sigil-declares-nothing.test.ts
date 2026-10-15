/**
 * fenced-sigil-declares-nothing — a carrier that QUOTES a sigil compiles no sigil.
 *
 * ── THE FAILURE THAT PAID FOR THIS ───────────────────────────────────────────────────────────────
 * Three readers in one session took text a carrier was merely SHOWING for text it was SAYING: the
 * closer walk claimed a quoted `<<^ code="&#x0003;">>` and truncated fifteen `ahu` sections mid-body
 * across seven hundred carriers while every render read clean; the doctype finder read a fenced
 * worked EXAMPLE of a declaration as the carrier's own; a framing regex anchored on `^<<` and missed
 * a whole table whose lines opened with an emoji.
 *
 * The render side already rules this: a fenced sigil calls nothing. The COMPILE side owes the same
 * answer — a teaching carrier that shows `<<~ ahu #example>>` opens no scope, grades no fault, and
 * lends no stratum to the sensorium.
 *
 * ── MEASURED ────────────────────────────────────────────────────────────────────────────────────
 * Over the 718 declared carriers the island scan raised 15,666 events, of which 739 stood inside a
 * quoted span past its opening character — 122 carriers affected, led by the grammar specs that
 * teach the sigils they name.
 *
 * ── A SCAN WHOSE TARGET *IS* A FENCE STILL FIRES ────────────────────────────────────────────────
 * The meta block spells itself ```toml, so a mask that refused every span would erase 840 of the
 * corpus's 852 meta reads and take the carriers' identity with them. The law admits a match landing
 * exactly ON a span's opening character and refuses only the interior — so a carrier's own meta
 * block reads, and a ````-quoted ```toml example does not.
 *
 * Surfaces: the VM parse-diagnostics contract (core's own ladder) and the sensorium stratifier.
 * Both stand blessed; neither reaches past a shore into the compile layer.
 */

import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { stratify } from "../src/memetic-wikitext-sensorium.js";

const MEMETIC = "text/memetic-wikitext+tiddlywiki";
const TICKS = "```";
const QUAD = "````";

/** A carrier that TEACHES an unknown sigil inside a fence and says nothing else. */
const TEACHES = `A carrier explaining the form.

${TICKS}
<<~ zzzznotasigil something>>
${TICKS}

And that is the whole lesson.
`;

/** The CONTROL — the same sigil standing in the open. */
const SAYS = `A carrier holding <<~ zzzznotasigil something>> in its body.
`;

describe("the sensorium stratifier reads a quoted sigil as prose", () => {
  test("a fenced sigil lends no red stratum, and the fence stands as a black anchor", () => {
    const strata = stratify(TEACHES).strata;
    expect(strata.map((s) => s.sigilName)).toEqual([]);
    // the lesson survives as skeletal prose rather than vanishing
    expect(stratify(TEACHES).skeletal.length).toBeGreaterThan(0);
  });

  test("CONTROL — the same sigil unfenced does raise its stratum", () => {
    expect(stratify(SAYS).strata.map((s) => s.sigilName)).toEqual(["zzzznotasigil"]);
  });

  test("a fenced scope opener opens no scope, and its closer closes none", () => {
    const teaching = `Shown, never opened.

${TICKS}
<<~ ahu #example>>
body of the example
<<~/ahu>>
${TICKS}

Past the fence the carrier still speaks.
`;
    expect(stratify(teaching).strata.map((s) => s.sigilName)).toEqual([]);
  });

  test("the meta block spells itself with a fence and still reads; a quoted one does not", () => {
    const own = `${TICKS}toml meta
uri-path = "ha.ka.ba/lares/probe"
${TICKS}

Body.
`;
    expect(stratify(own).strata.map((s) => s.sigilName)).toEqual(["toml"]);

    const quoted = `Here is how a meta block looks:

${QUAD}
${TICKS}toml meta
uri-path = "ha.ka.ba/lares/probe"
${TICKS}
${QUAD}

Body.
`;
    expect(stratify(quoted).strata.map((s) => s.sigilName)).toEqual([]);
  });
});

describe.skipIf(wikiSkip)(
  `a teaching carrier grades clean on core's own ladder${skipNote}`,
() => {
  let engine: TW5Engine;

  beforeAll(async () => {
    engine = await bootTestWiki();
    engine.setTiddler({ title: "carrier-teaches", type: MEMETIC, text: TEACHES });
    engine.setTiddler({ title: "carrier-says",    type: MEMETIC, text: SAYS });
  }, 60_000);

  test("the carrier that only SHOWS an unreadable sigil carries no diagnostic", () => {
    expect(engine.wiki.filterTiddlers("[[carrier-teaches]parse-diagnostics[]]")).toEqual([]);
    expect(engine.wiki.filterTiddlers("[[carrier-teaches]parse-diagnostics:grade[]]")).toEqual(["clean"]);
  });

  test("CONTROL — the carrier that SAYS it still grades on the ladder", () => {
    expect(engine.wiki.filterTiddlers("[[carrier-says]parse-diagnostics[]]")).toEqual(["carrier-says"]);
  });
});
