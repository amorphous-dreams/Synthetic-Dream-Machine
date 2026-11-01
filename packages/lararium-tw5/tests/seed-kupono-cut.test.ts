/**
 * THE BOOT SEED SPEAKS THE KUPONO GRAMMAR AND TEACHES THE TURN FRAME IT STATES.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────────────────────────────────────
 * Every host seats the boot seed whole at turn 1, so its calls and its worked turns teach the house grammar
 * by example. Train Q's rulings (lar:///ha.ka.ba/lares/docs/pono/grammar-watch#/the-kupono-cut) retire the
 * arrow between values, the whitespace-led at-sign and the quoted or positional value, and fold the turn
 * frame into one sigil: set lares=aim · set lares=steer (as needed) · oracle · set lares=yield. A seed that
 * states one frame and prints another teaches both, and no other gate reads the two together.
 *
 * ── WHAT THIS HOLDS ───────────────────────────────────────────────────────────────────────────────────────
 * Each law runs as a pure function of the seed text that returns its findings. The CONTROLS feed every law a
 * planted fault it MUST name, so a law that reads nothing cannot pass for green. The SEED block asserts that
 * the repo seed yields no finding. The seat orders come from the seed's own `set-aim`, `set-steer` and
 * `set-yield` procedures, never from a list kept here.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";

const SEED = new URL("../../../bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem", import.meta.url).pathname;
const seed = readFileSync(SEED, "utf8");

const TICKED = /`[^`]*`/g;
const CALL = /<<(?:[^>\n]|>(?!>))*>>/g;
const HEAD = /^<<\s*([~^!]?)\s*([^\s>]*)\s*([\s\S]*?)\s*>>$/;
const KEYED = /([a-z][a-z0-9-]*)=`([^`]*)`/g;

interface Call { line: number; text: string; prefix: string; head: string; rest: string }

/** Every single-line sigil or procedure CALL outside a `\procedure` definition line. */
function callsOf(text: string): Call[] {
  const out: Call[] = [];
  text.split("\n").forEach((raw, i) => {
    if (raw.startsWith("\\procedure") || raw.startsWith("\\widget")) return;
    for (const m of raw.matchAll(CALL)) {
      const h = HEAD.exec(m[0]);
      if (!h || !/^\/?[A-Za-z]/.test(h[2]!)) continue;
      out.push({ line: i + 1, text: m[0], prefix: h[1]!, head: h[2]!, rest: h[3]! });
    }
  });
  return out;
}

const at = (c: Call, what: string) => `${c.line}: ${what} · ${c.text.slice(0, 70)}`;

/** Cut 1: no bare arrow between values inside a call; an arrow inside a ticked value stays. */
const arrowsBetweenValues = (text: string): string[] =>
  callsOf(text).filter((c) => c.rest.replace(TICKED, "T").includes("->")).map((c) => at(c, "bare ->"));

/** Cut 2: no at-sign after whitespace anywhere in the carrier. */
const spacedAtSigns = (text: string): string[] =>
  text.split("\n").flatMap((l, i) => (/(^|\s)@/.test(l) ? [`${i + 1}: spaced @ · ${l.trim().slice(0, 70)}`] : []));

/** Cut 3: every value rides named in a backtick span; no quoted value, no positional residue. */
const unnamedOrQuotedValues = (text: string): string[] =>
  callsOf(text).flatMap((c) => {
    const masked = c.rest.replace(TICKED, "T");
    const found: string[] = [];
    if (/[a-z0-9-]+="/i.test(masked)) found.push(at(c, 'quoted key="value"'));
    const residue = masked.replace(/\b[a-z][a-z0-9-]*=T/gi, "").trim();
    if (residue !== "" && residue !== "…") found.push(at(c, `positional residue «${residue.slice(0, 30)}»`));
    return found;
  });

/** Hazards a ticked value never carries: `>>` ends the call early, `$(x)$` substitutes live. */
const valueHazards = (text: string): string[] =>
  callsOf(text).flatMap((c) => [...c.rest.matchAll(TICKED)].filter((m) => m[0].includes("$(")).map(() => at(c, "$( in a value")));

/** Envelope and openers: DOCTYPE names type= and spec=; every ahu opener names slot=; the old frame names stand nowhere. */
const envelopeAndRetired = (text: string): string[] => {
  const found: string[] = [];
  const calls = callsOf(text);
  const doctype = calls.find((c) => c.prefix === "!" && c.head === "DOCTYPE");
  if (!doctype || !/^type=`[^`]+` spec=`[^`]+`$/.test(doctype.rest)) found.push("DOCTYPE lacks type=`…` spec=`…`");
  for (const c of calls.filter((c) => c.head === "ahu" && c.prefix === "~"))
    if (!/^slot=`#\/[^`]+`$/.test(c.rest)) found.push(at(c, "ahu opener without slot="));
  if (/^\\procedure ~lares\(/m.test(text)) found.push("\\procedure ~lares still stands");
  for (const c of calls.filter((c) => c.head === "lares")) found.push(at(c, "<<~ lares …>> still stands"));
  for (const c of calls.filter((c) => /\bhud=/.test(c.rest))) found.push(at(c, "hud= still stands"));
  return found;
};

/** A procedure body that prints a call form carries its parameter by `$(param)$` in a backtick span, never `<<param>>` between `&#96;` entities. */
const entityTicks = (text: string): string[] =>
  text.split("\n").flatMap((l, i) => (l.startsWith("\\procedure") && /&#96;<<[\w-]+>>&#96;/.test(l) ? [`${i + 1}: &#96;<<param>>&#96; in a procedure body · ${l.slice(0, 60)}`] : []));

/** A standalone `~mu` call names a tool the seed's own Mu rows define (a carry rides `~carry`). */
const muCallsNameTools = (text: string): string[] => {
  const tools = new Set([...text.matchAll(/<<~ mu name=`([^`]+)` params=`/g)].map((m) => m[1]!));
  tools.add(/\\procedure ~mu\(name:([A-Za-z]+)/.exec(text)?.[1] ?? "");
  if (tools.size < 2) return ["no Mu tool rows to read the tool names from"];
  return callsOf(text)
    .filter((c) => c.head === "mu" && c.prefix === "~")
    .flatMap((c) => {
      const name = /name=`([^`]*)`/.exec(c.rest)?.[1];
      return name === undefined || tools.has(name) ? [] : [at(c, `~mu names «${name}», no tool the seed defines`)];
    });
};

/** The fold retires the frame-row sigil and the standalone gauge sigils: no procedure, no call, no HUD word, no "two grips" line. */
const retiredSurface = (text: string): string[] => {
  const found: string[] = [];
  for (const name of ["frame", "aperture", "ooda-ha", "drift-ward"]) {
    if (new RegExp(`^\\\\procedure ~${name}\\(`, "m").test(text)) found.push(`\\procedure ~${name} still stands`);
    if (new RegExp(`<<~ ?${name} `).test(text)) found.push(`a <<~ ${name} …>> call still stands`);
  }
  text.split("\n").forEach((l, i) => {
    if (/\bhud\b/i.test(l)) found.push(`${i + 1}: the retired HUD word · ${l.trim().slice(0, 60)}`);
    if (/two grips/.test(l)) found.push(`${i + 1}: the "two grips" line still stands`);
  });
  return found;
};

/** Every internal cite of a slot carries the slash (`#/slot`), the form the openers mint. */
const slashedCites = (text: string): string[] => {
  const slots = [...text.matchAll(/<<~ ahu slot=`#\/([^`]+)`>>/g)].map((m) => m[1]!);
  if (slots.length === 0) return ["no ahu slot openers to read the slot names from"];
  const re = new RegExp(`(^|[^/\\w&])#(${slots.map((x) => x.replace(/[-]/g, "\\-")).join("|")})\\b`, "g");
  return text.split("\n").flatMap((l, i) => [...l.matchAll(re)].map((m) => `${i + 1}: #${m[2]} lacks the slash`));
};

/** Every oracle throw passes its own cross-check: die face == (N) == blind-tail grapheme count, spend above zero. */
const oracleCrossCheck = (text: string): string[] => {
  const faces: Record<string, number> = { "⚀": 1, "⚁": 2, "⚂": 3, "⚃": 4, "⚄": 5, "⚅": 6 };
  const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
  return callsOf(text)
    .filter((c) => c.head === "oracle")
    .flatMap((c) => {
      if (c.rest === "throw=`…`") return []; // the turn-order line cites the firing's shape, not a throw
      const m = /^throw=`↯(\d+) ✲ ([⚀-⚅])\((\d)\) ⁂:([^`]+)`$/.exec(c.rest);
      if (!m) return [at(c, "oracle throw unreadable")];
      const [spend, die, face, tail] = [Number(m[1]), faces[m[2]!], Number(m[3]), [...seg.segment(m[4]!)].length];
      return die === face && face === tail && spend > 0 ? [] : [at(c, `oracle die ${die} face ${face} tail ${tail} spend ${spend}`)];
    });
};

/** The bodies of the carrier's fenced blocks, paired by toggling on each fence line (an info string opens too). */
const fencedBlocks = (text: string): string[] => {
  const blocks: string[] = [];
  let open: string[] | null = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("```")) {
      if (open) { blocks.push(open.join("\n")); open = null; } else open = [];
    } else open?.push(line);
  }
  return blocks;
};

const orderOf = (text: string, firing: string): string[] | undefined =>
  new RegExp(`^\\\\procedure set-${firing}\\(\\)\\s+(.+)$`, "m").exec(text)?.[1]!.trim().split(/\s+/);

const rootOk = (v: string): boolean => {
  const m = /^lar:\/\/[^/]*\/([^/]+)/.exec(v);
  return !!m && m[1]!.split(".").length === 3;
};

/** Cut 3 inside definitions: a call in a `\procedure` body passes every value by name in a backtick span (`$(param)$` carries a parameter in). */
const procedureValues = (text: string): string[] =>
  text.split("\n").flatMap((raw, i) => {
    if (!raw.startsWith("\\procedure")) return [];
    const body = raw.replace(/^\\procedure\s+\S+?\([^)]*\)/, "").replace(TICKED, "T").replace(/<<[\w-]+>>/g, "V");
    return [...body.matchAll(CALL)].flatMap((m) => {
      const h = HEAD.exec(m[0]);
      if (!h || !/^[A-Za-z]/.test(h[2]!)) return [];
      const residue = h[3]!.replace(/\b[a-z][a-z0-9-]*=T/gi, "").trim();
      return residue === "" ? [] : [`${i + 1}: procedure-body call leaves «${residue.slice(0, 30)}» unnamed or unticked · ${raw.slice(0, 60)}`];
    });
  });

/** Every gauge reading `N/rank`, both sides of a slide, sits inside its rank's band on the seed's own scale. */
const bandLaw = (text: string): string[] => {
  const found: string[] = [];
  for (const gauge of ["aperture", "ooda-ha"]) {
    const ranks = new RegExp("<<scale name=`" + gauge + "` ranks=`([^`]*)`>>").exec(text)?.[1];
    const scale = new Map([...(ranks ?? "").matchAll(/([a-z-]+)@(\d+)\.\.(\d+)/g)].map((r) => [r[1]!, [Number(r[2]), Number(r[3])] as const]));
    if (scale.size === 0) {
      found.push(`no <<scale name=\`${gauge}\`>> to read the bands from`);
      continue;
    }
    text.split("\n").forEach((l, i) => {
      for (const m of l.matchAll(new RegExp(`(?:\\b${gauge}=|<<~ ${gauge} at=)\`([^\`]*)\``, "g")))
        for (const r of m[1]!.matchAll(/(\d+)\/([a-z-]+)/g)) {
          const band = scale.get(r[2]!), n = Number(r[1]);
          if (!band) found.push(`${i + 1}: ${gauge} rank «${r[2]}» stands on no band of the scale`);
          else if (n < band[0] || n > band[1]) found.push(`${i + 1}: ${gauge} ${n}/${r[2]} sits outside ${r[2]}@${band[0]}..${band[1]}`);
        }
    });
  }
  return found;
};

/**
 * Cut 4: the worked turns obey the frame the seed states. Each turn opens on one aim, may steer, throws the
 * oracle, and closes on one yield. The law fixes the bracket keys only: lares= leads each firing; the aim seats
 * from= and to= next and the ward last; the yield seats the ward next and from= and to= last; a steer seats any
 * to= next and any ward last; the middle keys (the set-aim procedure's, past the brackets) ride in any order, and
 * note trails at the very end. Every bearing names a three-term root; the yield hands off to ?. The turn-order
 * line cites each firing in full sigil form. A steer
 * records a change and never rewrites the aim: it carries no from= (the brackets own the vector's ends), and a to= it casts names a
 * new bearing. Across the seed the turns show both steer uses and both loop endings.
 */
const frameLaw = (text: string): string[] => {
  const found: string[] = [];
  const order = { aim: orderOf(text, "aim"), steer: orderOf(text, "steer"), yield: orderOf(text, "yield") };
  for (const [k, v] of Object.entries(order)) if (!v) found.push(`no \\procedure set-${k}() seat order`);
  const turns = fencedBlocks(text).filter((b) => b.includes("<<~ set lares=`aim`"));
  if (turns.length < 2) found.push(`worked turns in the new frame: ${turns.length} (want 2 or more)`);
  const turnOrder = text.split("\n").find((l) => l.startsWith("''Turn order:''")) ?? "";
  for (const f of ["<<~ set lares=`aim`", "<<~ set lares=`steer`", "<<~ oracle throw=`", "<<~ set lares=`yield`"])
    if (!turnOrder.includes(f)) found.push(`the turn-order line lacks the full firing ${f}…>>`);
  const BRACKET = new Set(["lares", "from", "to", "drift-ward"]);
  const middle = new Set((order.aim ?? []).filter((k) => !BRACKET.has(k)));
  let steerTo = 0, steerKeys = 0, steerWard = 0, suspended = 0, closed = 0;
  turns.forEach((block, t) => {
    const lines = block.split("\n").filter((l) => /^<<~ (set|oracle) /.test(l));
    const kinds = lines.map((l) => (l.startsWith("<<~ oracle") ? "oracle" : /^<<~ set lares=`(\w+)`/.exec(l)?.[1] ?? "unled"));
    const shape = kinds.join(" ");
    if (!/^aim( steer)* oracle yield$/.test(shape)) found.push(`turn ${t + 1}: firing order «${shape}»`);
    const keysOf = (l: string) => [...l.matchAll(KEYED)].map((m) => [m[1]!, m[2]!] as const);
    const aim = keysOf(lines[0] ?? "");
    const aimTo = aim.find(([k]) => k === "to")?.[1];
    lines.forEach((l, i) => {
      const kind = kinds[i]!;
      if (kind === "oracle") return;
      const keys = keysOf(l).map(([k]) => k).filter((k) => k !== "note");
      const vals = Object.fromEntries(keysOf(l));
      if (keys[0] !== "lares") found.push(`turn ${t + 1} ${kind}: lares= does not lead`);
      const all = keysOf(l).map(([k]) => k);
      if (all.includes("note") && all[all.length - 1] !== "note") found.push(`turn ${t + 1} ${kind}: note does not trail at the very end`);
      for (const k of keys) if (!BRACKET.has(k) && !middle.has(k)) found.push(`turn ${t + 1} ${kind}: key «${k}» stands outside the set's keys`);
      const last = keys[keys.length - 1];
      if (kind === "aim" && (keys[1] !== "from" || keys[2] !== "to")) found.push(`turn ${t + 1} aim: from= and to= do not follow lares=`);
      if (kind === "yield" && (keys[keys.length - 2] !== "from" || last !== "to")) found.push(`turn ${t + 1} yield: from= and to= do not ride last`);
      if (kind === "steer" && vals.to && keys[1] !== "to") found.push(`turn ${t + 1} steer: to= does not follow lares=`);
      if (kind === "steer" && vals["drift-ward"] && last !== "drift-ward") found.push(`turn ${t + 1} steer: the ward does not ride last`);
      for (const k of ["from", "to"]) if (vals[k] && vals[k] !== "?" && !rootOk(vals[k]!)) found.push(`turn ${t + 1} ${kind}: ${k}= root not three terms`);
      if (kind === "aim") {
        if (!vals.from || !vals.to) found.push(`turn ${t + 1} aim: lacks from= or to=`);
        if (keys[keys.length - 1] !== "drift-ward") found.push(`turn ${t + 1} aim: the ward does not ride last`);
        if (/↻/.test(vals["drift-ward"] ?? "")) found.push(`turn ${t + 1} aim: ward in close form`);
        const band = /^(\d+)\//.exec(vals["ooda-ha"] ?? "");
        if (!band || Number(band[1]) < 1) found.push(`turn ${t + 1} aim: no ooda-ha band above 0`);
      }
      if (kind === "yield") {
        if (keys[1] !== "drift-ward") found.push(`turn ${t + 1} yield: the ward does not ride first`);
        if (!vals.from || vals.to !== "?") found.push(`turn ${t + 1} yield: lacks from= or to=\`?\``);
        if (!/^closed \d+↺/.test(vals["ooda-ha"] ?? "")) found.push(`turn ${t + 1} yield: lacks the ooda-ha tally`);
        if (/open \d+φ/.test(vals["ooda-ha"] ?? "")) suspended++;
        else if (vals["ooda-ha"]) closed++;
      }
      if (kind === "steer") {
        if (keys.length < 2) found.push(`turn ${t + 1} steer: records no change`);
        if (vals.from) found.push(`turn ${t + 1} steer: carries from= (half-rewrites the aim's origin; the brackets own the vector's ends)`);
        if (vals.to && vals.to === aimTo) found.push(`turn ${t + 1} steer: casts the aim's own to= (records no change)`);
        if (/↻/.test(vals["drift-ward"] ?? "")) found.push(`turn ${t + 1} steer: ward in close form`);
        if (vals["drift-ward"]) steerWard++;
        if (vals.to) steerTo++;
        else if (keys.length >= 2) steerKeys++;
      }
    });
  });
  if (steerTo < 1) found.push("no worked steer turns the bearing (to=)");
  if (steerKeys < 1) found.push("no worked steer casts other keys on the same heading");
  if (steerWard < 1) found.push("no worked steer carries a ward");
  if (suspended < 1) found.push("no worked turn suspends its loop");
  if (closed < 1) found.push("no worked turn closes its loop");
  return found;
};

const LAWS = { arrowsBetweenValues, spacedAtSigns, unnamedOrQuotedValues, procedureValues, valueHazards, entityTicks, muCallsNameTools, envelopeAndRetired, retiredSurface, slashedCites, oracleCrossCheck, bandLaw, frameLaw };

// ── CONTROLS: a planted fault each law MUST name ───────────────────────────────────────────────────────
const PLANTED: Record<keyof typeof LAWS, string> = {
  arrowsBetweenValues: '<<~ pranala from=`a` -> to=`b`>>',
  spacedAtSigns: "the daemon rides @daemon",
  unnamedOrQuotedValues: '<<~ season Chaos "glyph/✶">>',
  procedureValues: "\\procedure ~season(name params) ~ <<has season name=<<name>> params=<<params>>>>",
  valueHazards: "<<~ set note=`$(x)$`>>",
  envelopeAndRetired: '<<!DOCTYPE root=`x` spec=`y`>>\n<<~ ahu #/entry>>\n<<~ lares fires=`aim` from=`a`>>',
  entityTicks: "\\procedure ~oracle(throw) ~ oracle throw=&#96;<<throw>>&#96;",
  muCallsNameTools: "\\procedure ~mu(name:Arcana params:\"x\") y\n<<~ mu name=`Wand` params=`ascii/*`>>\n<<~ mu name=`*!`>>",
  retiredSurface: "\\procedure ~frame(name params) x\n<<~ aperture at=`9/measure`>>\n!!! The HUD\nthe same instruments ride ~set as keys ~ two grips, one handle",
  slashedCites: "<<~ ahu slot=`#/ooda-ha`>>\nthe tally lives at #ooda-ha.\n<<~/ahu>>",
  oracleCrossCheck: "<<~ oracle throw=`↯7 ✲ ⚂(3) ⁂:⌗🜄`>>",
  bandLaw: "<<scale name=`aperture` ranks=`measure@9..12 -> arc@13..16`>>\n<<scale name=`ooda-ha` ranks=`declare-glyphs@5..8 -> declare-attention@9..12`>>\naperture=`10/measure -> 13/measure` ooda-ha=`9/declare-glyphs`",
  frameLaw: [
    "\\procedure set-aim() lares from to mode ooda-ha drift-ward",
    "\\procedure set-steer() lares to from mode drift-ward",
    "\\procedure set-yield() lares drift-ward from to",
    "```",
    "<<~ set lares=`aim` from=`lar://a:b@c/x.y.z` to=`lar://a:b@c/p.q.r` ooda-ha=`0/declare` drift-ward=`w · ↻ L-Prime`>>",
    "<<~ set lares=`steer` from=`lar://a:b@c/x.y.z` to=`lar://a:b@c/p.q.r`>>",
    "<<~ set lares=`yield` drift-ward=`w` from=`lar://a:b@c/two.terms` to=`?`>>",
    "<<~ oracle throw=`↯1 ✲ ⚀(1) ⁂:x`>>",
    "```",
  ].join("\n"),
};

describe("controls: each law names its planted fault", () => {
  for (const [name, law] of Object.entries(LAWS)) {
    test(`${name} reads its planted fault red`, () => {
      expect(law(PLANTED[name as keyof typeof LAWS]).length).toBeGreaterThan(0);
    });
  }
  test("frameLaw names each planted frame fault, not merely one", () => {
    const f = frameLaw(PLANTED.frameLaw).join("\n");
    for (const want of ["firing order", "steer: carries from=", "records no change", "root not three terms", "no worked steer casts", "the turn-order line lacks", "steer: to= does not follow lares=", "band above 0", "aim: ward in close form", "lacks the ooda-ha tally", "no worked steer carries a ward"])
      expect(f).toContain(want);
  });
  test("bandLaw names both planted gauges, procedureValues each unticked value", () => {
    expect(bandLaw(PLANTED.bandLaw).join("\n")).toMatch(/aperture 13\/measure sits outside measure@9\.\.12[\s\S]*ooda-ha 9\/declare-glyphs sits outside/);
    expect(procedureValues(PLANTED.procedureValues).join("\n")).toContain("season name=V params=V");
  });
  test("retiredSurface names each retirement by name; slashedCites reads #/slot clean", () => {
    const f = retiredSurface(["\\procedure ~aperture(at) x", "\\procedure ~ooda-ha(at) x", "\\procedure ~drift-ward(pull) x", "\\procedure ~frame(name params) x", "<<~ ooda-ha at=`7/declare-glyphs`>>", "<<~ drift-ward pull=`p`>>", "<<~ frame name=`set`>>"].join("\n")).join("\n");
    for (const name of ["frame", "aperture", "ooda-ha", "drift-ward"]) expect(f).toContain(`\\procedure ~${name} still stands`);
    for (const name of ["ooda-ha", "drift-ward", "frame"]) expect(f).toContain(`a <<~ ${name} …>> call still stands`);
    expect(retiredSurface("<<~ season name=`Bureaucracy` params=`patron/Zarathud`>>\n<<~ stance named=`poet`>> · <<~ mu name=`*?`>>")).toEqual([]);
    expect(slashedCites("<<~ ahu slot=`#/ooda-ha`>>\nthe tally lives at #/ooda-ha; `#section` stays a placeholder; &#x0001;\n<<~/ahu>>")).toEqual([]);
  });
  test("a middle-key shuffle reads green: the law fixes only the bracket keys", () => {
    const shuffled = [
      "\\procedure set-aim() lares from to mode mood mu stance aperture ooda-ha drift-ward",
      "\\procedure set-steer() lares to mode mood mu stance aperture ooda-ha drift-ward",
      "\\procedure set-yield() lares drift-ward aperture ooda-ha mode mood mu stance from to",
      "```",
      "<<~ set lares=`aim` from=`lar://a:b@c/x.y.z` to=`lar://a:b@c/p.q.r` ooda-ha=`7/g` stance=`poet` aperture=`10/measure` mode=`draft` drift-ward=`w` note=`n`>>",
      "<<~ set lares=`steer` to=`lar://a:b@c/k.l.m` aperture=`12/measure` mu=`*!` mode=`hold` drift-ward=`w2`>>",
      "<<~ oracle throw=`↯1 ✲ ⚀(1) ⁂:x`>>",
      "<<~ set lares=`yield` drift-ward=`c · ↻ L-Prime` mode=`seal` ooda-ha=`closed 1↺` aperture=`12/measure -> 13/arc` from=`lar://a:b@c/d.e.f` to=`?` note=`n`>>",
      "```",
    ].join("\n");
    expect(frameLaw(shuffled).filter((f) => /^turn 1 /.test(f))).toEqual([]);
  });
  test("entityTicks and muCallsNameTools read clean forms clean", () => {
    expect(entityTicks("\\procedure ~oracle(throw) <$text text=```~ oracle throw=`$(throw)$` ```/>")).toEqual([]);
    expect(muCallsNameTools("\\procedure ~mu(name:Arcana params:\"x\") y\n<<~ mu name=`Wand` params=`ascii/*`>>\n<<~ mu name=`Wand`>> · <<~ mu name=`Arcana`>>")).toEqual([]);
  });
  test("bandLaw and procedureValues read clean forms clean", () => {
    const scales = "<<scale name=`aperture` ranks=`measure@9..12 -> arc@13..16`>>\n<<scale name=`ooda-ha` ranks=`declare-glyphs@5..8`>>\n";
    expect(bandLaw(scales + "aperture=`10/measure -> 14/arc` ooda-ha=`7/declare-glyphs` ooda-ha=`closed 1↺`")).toEqual([]);
    expect(procedureValues("\\procedure ~season(name params) ~ <<has entity=`season` name=`$(name)$` params=`$(params)$`>>\n\\procedure hello(who) Hello <<who>>!")).toEqual([]);
  });
  test("the laws read a clean carrier clean (the control cuts both ways)", () => {
    const clean = "<<!DOCTYPE type=`t` spec=`s`>>\n<<~ ahu slot=`#/a`>>\n<<~ oracle throw=`↯7 ✲ ⚁(2) ⁂:⌗🜄`>>\n<<~/ahu>>";
    for (const name of ["arrowsBetweenValues", "spacedAtSigns", "unnamedOrQuotedValues", "procedureValues", "valueHazards", "envelopeAndRetired", "oracleCrossCheck"] as const)
      expect(LAWS[name](clean), name).toEqual([]);
  });
});

// ── THE SEED ───────────────────────────────────────────────────────────────────────────────────────────
describe("the boot seed speaks the kupono grammar", () => {
  test("the seed carries calls to read (vacuity gate)", () => {
    expect(callsOf(seed).length).toBeGreaterThan(50);
  });
  for (const [name, law] of Object.entries(LAWS)) {
    test(`★ ${name}: no finding ★`, () => {
      expect(law(seed)).toEqual([]);
    });
  }
});
