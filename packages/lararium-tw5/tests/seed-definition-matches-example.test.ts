/**
 * A PROCEDURE RENDERS WHAT THE EXAMPLES BESIDE IT SHOW.
 *
 * ── THE SEAM NOTHING GUARDED ─────────────────────────────────────────────────────────────────────────────
 * The boot seed defines its frame sigils as procedures and then prints worked exchanges using them. Both
 * stand in one carrier, a few lines apart, and no gate compared them.
 *
 * MEASURED (before the kupono cut): `~lares` rendered `<<fires>> <<from>> <<arrow>> <<to>>` — the bare
 * positional form — while every exchange below it wrote `from=… -> to=…`. A node reading the definition
 * rendered one form; a node reading the examples rendered another; every existing gate stayed green.
 *
 * ── WHAT THIS HOLDS (the turn frame is one sigil since the cut: `set`, plus `oracle`) ─────────────────────
 *   · every key a `set` example writes is a parameter `~set` declares, and every FIRING writes its keys
 *     inside the canonical order its `set-aim` / `set-steer` / `set-yield` procedure lists — a key the
 *     order omits renders nowhere;
 *   · every key an `oracle` example writes stands in the `~oracle` body, and the body's own markers stand
 *     in every example — neither side leads.
 *
 * The examples' keys are read through the one attribute reader, after the call's own wrapper strips:
 * every value is a tick run now, so a scan blanking `<<…>>` spans would blank the whole call and read
 * no markers at all (measured: the cut seed read 12 "lacks" lines that way, a false red).
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";

import { readSigilAttrs } from "../src/sigil-attrs.js";

const SEED = new URL("../../../bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem", import.meta.url).pathname;
const seed = readFileSync(SEED, "utf8");

/** The parameter names a `\procedure ~name(…)` declares, defaults dropped. */
function paramsOf(name: string): string[] {
  const m = new RegExp(`^\\\\procedure ~${name}\\(([^)]*)\\)`, "m").exec(seed);
  expect(m, `the seed defines ~${name}`).toBeTruthy();
  return m![1]!.split(/\s+/).filter(Boolean).map((p) => p.replace(/[:=].*$/, ""));
}

/** The text after `\procedure ~name(…)` on its own line — a one-line body. */
function definitionBody(name: string): string {
  const m = new RegExp(`^\\\\procedure ~${name}\\([^)]*\\)(.*)$`, "m").exec(seed);
  expect(m, `the seed defines ~${name}`).toBeTruthy();
  return m![1]!;
}

/** The keys a firing order lists: `\procedure set-aim() lares from to …`. */
function orderOf(proc: string): string[] {
  const m = new RegExp(`^\\\\procedure ${proc}\\(\\)\\s+(.*)$`, "m").exec(seed);
  expect(m, `the seed defines ${proc}`).toBeTruthy();
  return m![1]!.trim().split(/\s+/);
}

/** Every one-line `<<~ name …>>` call in the seed, each read to its named keys and values. */
function examplesOf(name: string): Array<{ text: string; keys: Map<string, string> }> {
  return [...seed.matchAll(new RegExp(`<<~ ${name}(?: (?:[^>\\n]|>(?!>))*)?>>`, "g"))].map((m) => {
    const inner = m[0].replace(new RegExp(`^<<~ ${name}`), "").replace(/>>$/, "");
    return { text: m[0], keys: new Map(readSigilAttrs(inner).map((a) => [a.name, a.value])) };
  });
}

/** The literal `word=` markers a body emits. */
const markersOf = (s: string): Set<string> => new Set([...s.matchAll(/\b([a-z][a-z0-9-]*)=/g)].map((m) => m[1]!));

describe("the seed's frame procedures render what their examples show", () => {
  test("the seed presents both definitions and examples (vacuity gate)", () => {
    expect(paramsOf("set").length).toBeGreaterThan(0);
    expect(examplesOf("set").filter((e) => e.keys.size > 0).length).toBeGreaterThan(0);
    expect(definitionBody("oracle").length).toBeGreaterThan(0);
    expect(examplesOf("oracle").length).toBeGreaterThan(0);
  });

  test("★ every key a `set` example writes is a parameter `~set` declares ★", () => {
    const params = new Set(paramsOf("set"));
    for (const ex of examplesOf("set")) {
      for (const key of ex.keys.keys()) expect(params, `${ex.text.slice(0, 70)}… writes ${key}=`).toContain(key);
    }
  });

  test("★ every firing's keys stand in its own canonical order ★", () => {
    const firings = examplesOf("set").filter((e) => e.keys.has("lares"));
    expect(firings.length, "the seed shows firings").toBeGreaterThan(0);
    for (const ex of firings) {
      const firing = ex.keys.get("lares")!;
      expect(["aim", "steer", "yield"], `${ex.text.slice(0, 60)}… fires ${firing}`).toContain(firing);
      const order = new Set([...orderOf(`set-${firing}`), "note"]);
      for (const key of ex.keys.keys()) expect(order, `${ex.text.slice(0, 70)}… writes ${key}= outside set-${firing}`).toContain(key);
    }
  });

  test("★ every marker the ~oracle body emits stands in its examples, and back ★", () => {
    const body = markersOf(definitionBody("oracle"));
    expect(body.size, "the ~oracle body emits a marker").toBeGreaterThan(0);
    const params = new Set(paramsOf("oracle"));
    for (const ex of examplesOf("oracle")) {
      for (const key of ex.keys.keys()) {
        expect(body, `the ~oracle body emits no ${key}=`).toContain(key);
        expect(params, `~oracle declares no ${key}`).toContain(key);
      }
      for (const marker of body) {
        if (marker === "text") continue;   // the <$text> widget's own attribute, never a call key
        expect([...ex.keys.keys()], `${ex.text.slice(0, 60)}… lacks ${marker}=`).toContain(marker);
      }
    }
  });
});
