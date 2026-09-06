/**
 * turn-harvest — the graceful-gradient harvester.
 *
 * The grammar manifests PROVISIONALLY: clean turns harvest whole, degraded/partial/novel turns
 * record gracefully down to the floor, and all-prose turns abstain on structure while keeping their
 * raw source. These tests walk that gradient.
 *
 * FOUR ISLANDS. A turn carries a bearing, Voices, panel firings, mid-turn phase markers, and every
 * other sigil as itself. The gauges are NAMED KEYS inside one panel — so these tests read keys, never
 * a field per gauge.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/turn-harvest
 */

import { describe, test, expect } from "vitest";
import {
  harvestTurnGradient,
  aftermathClosed,
  closingPanel,
  HARVEST_FLOOR,
} from "../src/index.js";

const CLEAN_TURN = `<<~ lares aim from=lar://mara:operator@crossroads/operator.weighs.deps -> to=lar://compita:agent@crossroads/council.options.cuts>>
<<~ set hud="aim" mode="draft" mu="_!" stance="🏛️🗡️" focus="11/measure" feedback="9/declare-attention" drift-ward="* · I hold a preferred answer already">>

Lares (Council): ->⏿ two libraries, both viable. ->◇ the fork holds.

<<~ oracle "↯11 ✲ ⚃(4) ⁂:⬡🌖◈⟁">>
<<~ set hud="yield" drift-ward="! · the velocity read rides on a README I never opened · ↻ L-Prime" focus="11/measure -> 12/measure" feedback="closed 1↺">>
<<~ lares yield from=lar://compita:agent@crossroads/council.fork.named -> to=?>>`;

describe("clean turn — harvests whole", () => {
  const h = harvestTurnGradient(CLEAN_TURN);

  test("reads the aim/yield bearing", () => {
    expect(h.bearing).not.toBeNull();
  });

  test("surfaces the Voice with its role", () => {
    expect(h.voices.length).toBe(1);
    expect(h.voices[0]!.name).toBe("Lares");
    expect(h.voices[0]!.role).toBe("Council");
  });

  test("captures both panel firings and tells them apart by `hud`", () => {
    expect(h.panels.length).toBe(2);
    expect(h.panels.map((p) => p.hud)).toEqual(["aim", "yield"]);
  });

  test("reads every named key the panel carried, verbatim", () => {
    const open = h.panels[0]!;
    expect(open.keys["focus"]).toBe("11/measure");
    expect(open.keys["feedback"]).toBe("9/declare-attention");
    expect(open.keys["mode"]).toBe("draft");
    expect(open.keys["mu"]).toBe("_!");
    // the value is taken WHOLE and never re-parsed — the ward's mark rides inside it
    expect(open.keys["drift-ward"]).toBe("* · I hold a preferred answer already");
  });

  test("the closing panel is the one that reports", () => {
    const close = closingPanel(h);
    expect(close).not.toBeNull();
    expect(close!.keys["feedback"]).toBe("closed 1↺");
    expect(close!.keys["focus"]).toBe("11/measure -> 12/measure");
  });

  test("a closed loop reads closed", () => {
    expect(aftermathClosed(h)).toBe(true);
  });

  test("the mid-turn phase markers harvest, in reading order", () => {
    expect(h.phases.map((p) => p.glyph)).toEqual(["⏿", "◇"]);
    expect(h.phases[0]!.offset).toBeLessThan(h.phases[1]!.offset);
  });

  test("every other sigil lands under its own head", () => {
    expect(h.sigils.map((s) => s.head)).toContain("oracle");
  });

  test("stands well clear of the floor, no raw fallback", () => {
    expect(h.standing).toBeGreaterThan(HARVEST_FLOOR);
    expect(h.recordRaw).toBe(false);
  });
});

describe("a suspension does not read as a close", () => {
  const turn = `<<~ lares aim from=lar:///a.b.c/x -> to=lar:///d.e.f/y>>
Lares (Council): ->◇ the fork belongs to the operator.
<<~ set hud="yield" drift-ward="! · take it to contact · ↻ L-Prime" feedback="closed 0↺ -> open 1φ @◇:fork.depends-on.operator-budget">>
<<~ lares yield from=lar:///d.e.f/y -> to=?>>`;
  const h = harvestTurnGradient(turn);

  test("zero closed with one hanging reads OPEN, never closed", () => {
    expect(aftermathClosed(h)).toBe(false);
    expect(closingPanel(h)!.keys["feedback"]).toContain("open 1φ @◇");
  });
});

describe("a panel key this reader never heard of still harvests", () => {
  // The key map is carried verbatim, so a key the frame adds costs no parse and loses no signal.
  const h = harvestTurnGradient(`<<~ set hud="aim" mood="wry" tempo="unhurried">>`);

  test("an unknown key rides through untouched", () => {
    expect(h.panels[0]!.keys["mood"]).toBe("wry");
    expect(h.panels[0]!.keys["tempo"]).toBe("unhurried");
  });
});

describe("degraded grammar — partial frame records gracefully", () => {
  const turn = `<<~ lares aim from=lar:///a.b.c/x -> to=?>>
Map-Wisp (Scryer): the shape holds but the close never landed.`;
  const h = harvestTurnGradient(turn);

  test("a one-sided frame still yields a bearing, at a lower standing", () => {
    expect(h.bearing).not.toBeNull();
    expect(h.recordRaw).toBe(false);
  });

  test("the Voice surfaces even in a degraded turn", () => {
    expect(h.voices.map((v) => v.name)).toContain("Map-Wisp");
  });
});

describe("missing grammar — all prose, no sigils → record raw", () => {
  const h = harvestTurnGradient("just a plain message with no frame and no voice at all");

  test("abstains on structure but never drops the source", () => {
    expect(h.bearing).toBeNull();
    expect(h.panels).toEqual([]);
    expect(h.recordRaw).toBe(true);
    expect(h.driftFlags).toContain("frame:none");
  });
});

describe("water — unrecognized <<~ openers are counted, not dropped", () => {
  const turn = `<<~ lares aim from=lar:///a.b.c/x -> to=lar:///d.e.f/y>>
<<~ vorpal-snicker something entirely new>>
<<~ lares yield from=lar:///d.e.f/y -> to=?>>`;
  const h = harvestTurnGradient(turn);

  test("the novel sigil reads as water and drags the gauge", () => {
    expect(h.waterCount).toBeGreaterThan(0);
    expect(h.driftFlags.some((f) => f.startsWith("water:"))).toBe(true);
  });
});

describe("Voice precision — a prose parenthetical is not a Voice", () => {
  test("a long verb-phrase in parens reads as water, never a Voice", () => {
    const h = harvestTurnGradient("\nSomething Long (end your reply with the sigil): text");
    expect(h.voices).toEqual([]);
  });

  test("a real header still surfaces, and an earned name with a short role too", () => {
    const h = harvestTurnGradient("\nBreach-Watch (Triage): the fire\n\nTelarus (Scryer): the read");
    expect(h.voices.map((v) => v.name)).toEqual(["Breach-Watch", "Telarus"]);
  });
});

describe("empty input", () => {
  test("returns a raw record, never throws", () => {
    const h = harvestTurnGradient("");
    expect(h.recordRaw).toBe(true);
    expect(h.standing).toBe(0);
    expect(h.driftFlags).toContain("empty");
  });
});

describe("a turn from before the gauges became panel keys", () => {
  // A CORPUS STATES ONE GRAMMAR; A READER TOLERATES EVERY GRAMMAR IT WILL MEET. Transcripts carry
  // whatever shape was standing when they were written, and refusing one reads a gauged turn as
  // ungauged — a silence no downstream reader can tell from a turn that skipped the instrument.
  const PRE_PANEL = `<<~ lares aim from=lar://mara:operator@crossroads/operator.weighs.deps -> to=lar://compita:agent@crossroads/council.options.cuts>>
<<~ hud Aperture(11) OODA-HA(9)>>
<<~ ward * L-Prime>>

Lares (Council): two libraries, both viable. <<~ confidence Synthesis 11/20>> the fork holds.

<<~ oracle ↯11 ⁂ ⚃ (4) ✲⬡◈⟁>>
<<~ ward ! · ↻ L-Prime>>
<<~ lares yield from=lar://compita:agent@crossroads/council.fork.named -> to=?>>`;

  const h = harvestTurnGradient(PRE_PANEL);

  test("the retired heads still classify as sigils, in turn order", () => {
    expect(h.sigils.map((s) => s.head)).toEqual(["hud", "ward", "confidence", "oracle", "ward"]);
  });

  test("none of it reads as water", () => {
    expect(h.waterCount).toBe(0);
  });

  test("the turn stands clear of the floor, never at it", () => {
    expect(h.standing).toBeGreaterThan(HARVEST_FLOOR);
    expect(h.recordRaw).toBe(false);
  });
});
