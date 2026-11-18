/**
 * THE LAW MEMES SPEAK THE KUPONO GRAMMAR IN THEIR BODIES.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────────────────────────────────────
 * The law memes (memetic-wikitext and its framing, the sigil laws, the exchange-vector and panel carriers,
 * the voices) teach the house grammar by statement and by example. Train Q's rulings
 * (lar:///ha.ka.ba/lares/docs/pono/grammar-watch#/the-kupono-cut) retire the arrow between values, the
 * whitespace-led at-sign, the quoted or positional value, and the `hud` key with the `~lares` sigil. A law
 * meme that states one grammar and prints another teaches both, and the bulk tool skips these carriers, so
 * their bodies MUST already read cut. Their frame envelope (the declaration, SOH, STX, ETX and EOT lines)
 * keeps the old form until the readers flip; the body, fences included, speaks the new one.
 *
 * ── WHAT THIS HOLDS ───────────────────────────────────────────────────────────────────────────────────────
 * Each law runs as a pure function of a carrier's text and returns its findings. The CONTROLS feed every law
 * a planted fault it MUST name, so a law that reads nothing cannot pass for green. The CORPUS block asserts
 * that each law meme yields no finding.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";

const BAG = new URL("../../../bags/lares/ha.ka.ba/lares/", import.meta.url).pathname;

/** The law memes this row owns, relative to the lares bag. */
const LAW_MEMES = [
  "api/pono/memetic-wikitext.mem",
  "api/pono/memetic-wikitext-framing.mem",
  "api/pono/pranala.mem",
  "api/pono/papalohe.mem",
  "api/mu/ooda-ha.mem",
  "api/pono/dispatcher.mem",
  "api/pono/has.mem",
  "api/pono/lele.mem",
  "docs/pono/lar-uri.mem",
  "docs/tw5-calls-colon-caveat.mem",
  "api/pono/exchange-vector.mem",
  "docs/pono/exchange-vector.mem",
  "api/hud.mem",
  "docs/hud.mem",
  "api/voices.mem",
];

/** A triple-backtick run takes the value that holds a backtick; a single-backtick run takes the rest. */
const TICKED = /```[\s\S]*?```|`[^`]*`/g;
const CALL = /<<(?:(?!<<)(?:[^>\n]|>(?!>)))*>>/g;
const HEAD = /^<<\s*([~^!]?)\s*([^\s>]*)\s*([\s\S]*?)\s*>>$/;

interface Call { line: number; text: string; prefix: string; head: string; rest: string }

/** The body: every line between the STX line and the ETX line. The envelope keeps its old form until the readers flip. */
function bodyOf(text: string): { line: number; text: string }[] {
  const lines = text.split("\n");
  const stx = lines.findIndex((l) => /^<<\^ code=["`]&#x0002;["`]/.test(l));
  let etx = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) if (/^<<\^ code=["`]&#x0003;["`]/.test(lines[i]!)) { etx = i; break; }
  return lines.slice(stx + 1, etx).map((t, i) => ({ line: stx + 2 + i, text: t }));
}

/** Every single-line sigil CALL in the body, inline code and fences included; a plain TW5 macro call, a regex line (head not a word) and a pragma stand outside. */
function callsOf(body: { line: number; text: string }[]): Call[] {
  const out: Call[] = [];
  for (const { line, text } of body) {
    if (text.startsWith("\\procedure") || text.startsWith("\\widget")) continue;
    for (const m of text.matchAll(CALL)) {
      const h = HEAD.exec(m[0]);
      if (!h || h[1] === "" || !/^\/?[A-Za-z]/.test(h[2]!)) continue;
      // A control mark's head is the caret itself: `code=` is its first parameter, not its name.
      const control = h[1] === "^";
      out.push({ line, text: m[0], prefix: h[1]!, head: control ? "^" : h[2]!, rest: control ? `${h[2]} ${h[3]}`.trim() : h[3]! });
    }
  }
  return out;
}

const at = (c: Call, what: string) => `${c.line}: ${what} · ${c.text.slice(0, 70)}`;
const maskTicks = (s: string) => s.replace(TICKED, "T");

/** Cut 1: no bare arrow between values inside a call; an arrow inside a ticked value stays. */
const arrowsBetweenValues = (text: string): string[] =>
  callsOf(bodyOf(text)).filter((c) => maskTicks(c.rest).includes("->")).map((c) => at(c, "bare ->"));

/** Cut 2: no at-sign after whitespace anywhere in the carrier. */
const spacedAtSigns = (text: string): string[] =>
  text.split("\n").flatMap((l, i) => (/(^|\s)@/.test(l) ? [`${i + 1}: spaced @ · ${l.trim().slice(0, 70)}`] : []));

/** Cut 3: every call value rides named in a backtick span; no quoted value, no positional residue. A bare ellipsis stands for elided keys. */
const unnamedOrQuotedValues = (text: string): string[] =>
  callsOf(bodyOf(text)).flatMap((c) => {
    const masked = maskTicks(c.rest);
    const found: string[] = [];
    if (/[a-z0-9-]+="/i.test(masked)) found.push(at(c, 'quoted key="value"'));
    const loose = masked.replace(/[a-z][a-z0-9-]*=T/gi, " ").replace(/…/g, " ").trim();
    for (const tok of loose.split(/\s+/).filter(Boolean))
      found.push(at(c, /^[a-z][a-z0-9-]*=/i.test(tok) ? `unticked value '${tok.slice(0, 24)}'` : `positional residue '${tok.slice(0, 24)}'`));
    return found;
  });

/** Cut 4: the `hud` key and the `~lares` sigil retire, and the standalone gauges with them. */
const retiredFrame = (text: string): string[] =>
  bodyOf(text).flatMap(({ line, text: t }) => {
    const found: string[] = [];
    if (/\bhud=/.test(t)) found.push(`${line}: hud= key · ${t.trim().slice(0, 70)}`);
    if (/<<~\s*lares\b/.test(t)) found.push(`${line}: ~lares call · ${t.trim().slice(0, 70)}`);
    if (/<<~\s*(aperture|ooda-ha|drift-ward)\b/.test(t)) found.push(`${line}: standalone gauge · ${t.trim().slice(0, 70)}`);
    return found;
  });

/** Cut 4: a `set lares=` firing leads with `lares`, seats the ward last (aim, steer) or right after it (yield), and trails `note`. */
const firingOrder = (text: string): string[] =>
  callsOf(bodyOf(text)).flatMap((c) => {
    if (c.head !== "set") return [];
    const keys = [...c.rest.matchAll(/([a-z][a-z0-9-]*)=`/g)].map((m) => m[1]!);
    if (keys[0] !== "lares") return [];
    const kind = /lares=`(aim|steer|yield)`/.exec(c.rest)?.[1];
    if (!kind) return [at(c, "lares names no firing")];
    const found: string[] = [];
    const body = keys.filter((k) => k !== "note");
    const noteAt = keys.indexOf("note");
    if (noteAt >= 0 && noteAt !== keys.length - 1) found.push(at(c, "note does not trail"));
    if (kind === "yield") {
      if (body.includes("drift-ward") && body[1] !== "drift-ward") found.push(at(c, "yield: ward not right after lares"));
      const tail = body.slice(-2);
      if (body.includes("from") && body.includes("to") && (tail[0] !== "from" || tail[1] !== "to")) found.push(at(c, "yield: from and to not last"));
    } else {
      if (body.includes("drift-ward") && body[body.length - 1] !== "drift-ward") found.push(at(c, `${kind}: ward not last`));
      if (kind === "aim" && body.includes("from") && body[1] !== "from") found.push(at(c, "aim: from not right after lares"));
      if (kind === "aim" && body.includes("to") && body[body.indexOf("from") >= 0 ? 2 : 1] !== "to") found.push(at(c, "aim: to not seated after from"));
      if (kind === "steer" && body.includes("from")) found.push(at(c, "steer carries from"));
      if (kind === "steer" && body.includes("to") && body[1] !== "to") found.push(at(c, "steer: to not right after lares"));
    }
    return found;
  });

const LAWS: [string, (t: string) => string[]][] = [
  ["no bare arrow between values", arrowsBetweenValues],
  ["no at-sign after whitespace", spacedAtSigns],
  ["every call value named in a backtick span", unnamedOrQuotedValues],
  ["no hud key, no ~lares call, no standalone gauge", retiredFrame],
  ["a set firing seats its keys in the bracket order", firingOrder],
];

const ENVELOPE = [
  '<<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">>',
  "",
  '<<^ code="&#x0001;" namespace="⊙" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/x">>',
  '<<^ code="&#x0002;">>',
].join("\n");
const FOOT = '\n<<^ code="&#x0003;">>ni:///sha-256;x\n\n<<^ code="&#x0004;" -> to="?">>\n';
const carrier = (body: string) => `${ENVELOPE}\n${body}${FOOT}`;

describe("CONTROLS: each law names the fault planted for it", () => {
  const planted: Record<string, string> = {
    "no bare arrow between values": "<<~ pranala from=`A` -> to=`B`>>",
    "no at-sign after whitespace": "a plane named @daemon here",
    "every call value named in a backtick span": '<<~ loulou "lar:///x">>',
    "no hud key, no ~lares call, no standalone gauge": '<<~ set hud=`aim` aperture=`1/pulse`>>',
    "a set firing seats its keys in the bracket order": "<<~ set lares=`aim` mode=`draft` to=`lar:///a.b.c` from=`lar:///d.e.f` drift-ward=`w`>>",
  };
  for (const [name, law] of LAWS) {
    test(`${name} names its planted fault`, () => {
      expect(law(carrier(planted[name]!)).length).toBeGreaterThan(0);
    });
  }
  test("a positional value and a quoted key are each named", () => {
    expect(unnamedOrQuotedValues(carrier("<<~ ahu #/head>>")).length).toBe(1);
    expect(unnamedOrQuotedValues(carrier('<<~ has entity=`a` name="b">>')).some((f) => f.includes("quoted key"))).toBe(true);
  });
  test("an old-form envelope stands outside the body", () => {
    expect(bodyOf(carrier("x")).map((l) => l.text)).toEqual(["x"]);
    expect(LAWS.flatMap(([, law]) => law(carrier("a clean line")))).toEqual([]);
  });
  test("a cut call, an arrow inside a ticked value and a regex line all pass", () => {
    const clean = [
      "<<~ ahu slot=`#/head`>>",
      "<<~ pranala from=`?` to=`lar:///a` family=`code`>>",
      "<<~ scale name=`x` ranks=`a@0 -> b@1`>>",
      "<<~ scale name=`y` ranks=```a ~ `$slot` -> b```>>",
      "<<~ set lares=`aim` from=`lar:///a.b.c` to=`lar:///d.e.f` mode=`draft` drift-ward=`w`>>",
      "<<~ set lares=`yield` drift-ward=`w` ooda-ha=`closed 0↺ -> open 1φ◇:r` from=`lar:///a.b.c` to=`?`>>",
      "pattern = '<<~\\s*papalohe\\s+(\\S+)\\s*->\\s*(\\S+)>>'",
      "pulse@0..4 and alias:grant@host",
    ].join("\n");
    expect(LAWS.flatMap(([, law]) => law(carrier(clean)))).toEqual([]);
  });
});

describe("CORPUS: each law meme speaks the grammar in its body", () => {
  for (const rel of LAW_MEMES) {
    const text = readFileSync(BAG + rel, "utf8");
    for (const [name, law] of LAWS) {
      test(`${rel}: ${name}`, () => {
        expect(law(text)).toEqual([]);
      });
    }
  }
});
