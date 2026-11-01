#!/usr/bin/env node
/**
 * grammar-cut — the kupono grammar cut (Train Q, row Q8), carried across the bags in one pass.
 *
 * ── WHAT IT CUTS ────────────────────────────────────────────────────────────────────────────────
 * Cut 1: the arrow leaves every sigil; `from=` and `to=` carry the relation. An arrow INSIDE a
 *        value stays (ladders, slides, the closing gauge).
 * Cut 2: no `@` after whitespace. The phase glyph fuses onto φ (`1φ @◇:x` -> `1φ◇:x`); a plane
 *        name renames by the map file (tools/grammar-cut-planes.json); a handle `@name@host`
 *        strips to `name@host`; npm scopes and the map's OUT names stay; an unmapped name REDS.
 * Cut 3: every value rides named, in backticks (`name=`value``; a value holding a tick takes the
 *        triple form). Positional values take the parameter names the sigil tiddlers declare,
 *        read at runtime from packages/lararium-tw5/tiddlers/sigil-*.tid (definitions first,
 *        then the named groups of the tiddler's patterns, then its example).
 * Cut 4: the turn frame folds into one sigil: `<<~ lares aim …>>` + `<<~ set hud="aim" …>>`
 *        becomes `<<~ set lares=`aim` from to … drift-ward>>`; the yield mirrors it (ward first,
 *        from and to last); a lone `~aperture`/`~ooda-ha`/`~drift-ward` becomes a steer.
 * Cut 5: the `file-path` meta key retires (operator ruling, 2026-11-01): residency rides the
 *        envelope, so every `file-path = …` line leaves every meta fence, a quoted one included.
 *        It rides with the envelope, so Canon's hand-cut carriers take it too.
 *
 * ── WHAT IT NEVER GUESSES ───────────────────────────────────────────────────────────────────────
 * It REFUSES and lists, leaving the sigil byte-for-byte: a head with no tiddler (`unsigned`), a
 * prose voice tag, a parameter still named `pN`, an arrow with no from/to slot, more positionals
 * than slots, a relation call whose params hold no has-value, a URI slot fed a bare word, a
 * value TW5 would substitute (`$(x)$`, `${…}$`), a value no tick run can hold, a nested call, a
 * sigil straddling a code span, a turn it cannot map mechanically (it never invents a bearing).
 *
 * ── THE ORACLE DECIDES, NEVER THE PATTERN ───────────────────────────────────────────────────────
 * Every changed sigil parses twice through the real TiddlyWiki parser: BEFORE, the parser's
 * values must equal this tool's own reading of the call as written (so a tokenizer slip cannot pass);
 * AFTER, the parser must hand back exactly the named, substituted values the tool meant to write.
 * A sigil that fails either check is refused and left as it stands.
 *
 * ── SCOPE ───────────────────────────────────────────────────────────────────────────────────────
 * Default files: every tracked `bags/**\/*.mem` plus the Elyncia referee guide, minus the seed
 * (row Q7 lands it). Canon's hand-cut carriers (the diff 9f15dc896..084752cd1, less the three it
 * touched but never cut, CANON_CUT_WHOLE) take the ENVELOPE
 * only (DOCTYPE and the frame marks, then the seal); their bodies must already read as cut, and
 * any body change counts as a red. `--outside` lists, never writes, the sigils still owed in
 * CHANGELOG.md, README.md, packages/AGENTS.md and .claude/.
 *
 * Usage: node tools/grammar-cut.mjs [--write] [--check] [--census] [--outside] [--out <dir>] [--hand-reviewed]
 *                                   [--planes <map.json>] [--files <path> …]
 * Dry run by default. Exit 1 on a red: an unmapped at-name, an oracle disagreement, a Canon body
 * change, a seal that does not verify. `--write` also refuses until the frame package declares
 * the DOCTYPE names (Reader's shore flip, row Q4) and while any target file sits dirty. `--check`
 * (the witness) also exits 1 while any file still owes the cut.
 * Idempotent: a second run writes nothing, so a lane that rebases over the bulk commit re-runs
 * `--write --files <its carriers>`.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SEED_REL = "bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem";
export const CANON_RANGE = ["9f15dc896", "084752cd1"];
/** Carriers in Canon's range that Canon touched but never cut (lead ruling, 2026-11-01): cut whole. */
export const CANON_CUT_WHOLE = new Set([
  "bags/lares/ha.ka.ba/lares/api/art-sigils/spec.mem",
  "bags/lares/ha.ka.ba/lares/api/pono/system-pattern-integrities.mem",
  "bags/lares/ha.ka.ba/lares/docs/pono/otakiage.mem",
]);
export const GUIDE_REL = "elyncia/Elyncia_04_The_Referee_Noosphere_Guide.md";
export const OUTSIDE = ["CHANGELOG.md", "README.md", "packages/AGENTS.md", ".claude"];
/** Prose voice tags (F4): a play line or a voice, never a call. Listed for a hand pass. */
export const PROSE_VOICES = new Set(["operator", "scene", "enters", "Telarus", "Coffee-Talk"]);
/** The turn-frame heads Cut 4 retired; their calls fold into `set lares=` or list. */
export const RETIRED = new Set(["lares", "hud", "frame", "aperture", "ooda-ha", "drift-ward"]);
const GAUGES = new Set(["aperture", "ooda-ha", "drift-ward"]);
const PHASES = "_✶⏿◇▶";
/** A cited placeholder (`<<~ set lares=`aim` …>>`): prose standing in for values, never a value. */
const ELLIPSIS = /^(…|\.\.\.)$/;

const SIGIL = /<<(?:[~^!][ \t]*)?[A-Za-z&#][\w&#;-]*(?:[^>]|>(?!>))*>>/g;
const SUBSTITUTION = /\$\([^)]*\)\$|\$\{[\s\S]*?\}\$/;
const DEFINITION_LINE = /^\s*\\(?:procedure|define|widget|function|end)\b/;
/** Cut 5: a retired `file-path` meta line, whole. */
export const FILE_PATH_LINE = /^file-path[ \t]*=[^\n]*\n/gm;

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Context: signatures, the frame shore, the TW5 oracle, the plane map — all read at runtime.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Parameter names from a TW5 signature's parenthesised list (defaults may be quoted). */
function paramNames(list) {
  const names = [];
  for (const m of list.matchAll(/([\w-]+)(?::(?:"[^"]*"|'[^']*'|\S*))?/g)) names.push(m[1]);
  return names;
}

/** Every sigil tiddler's signature: head -> { params, source }. */
export function loadSignatures(repo) {
  const dir = join(repo, "packages/lararium-tw5/tiddlers");
  const sigs = {};
  for (const f of readdirSync(dir).filter((n) => /^sigil-.*\.tid$/.test(n)).sort()) {
    const text = readFileSync(join(dir, f), "utf8");
    let found = false;
    for (const m of text.matchAll(/^\\(?:procedure|widget|function)\s+~([\w~-]+)\(([^)]*)\)/gm)) {
      sigs[m[1]] = { params: paramNames(m[2]), source: f };
      found = true;
    }
    if (found) continue;
    // A head declared by its patterns alone (metadata heads): the pattern's named keys, in order.
    const head = /^lar-(?:open-)?pattern:\s*<<~\\s\*([\w-]+)/m.exec(text)?.[1]
      ?? /^lar-(?:open-)?pattern:\s*<<~!\?\\s\*([\w-]+)/m.exec(text)?.[1]
      ?? f.replace(/^sigil-|\.tid$/g, "");
    if (/^(family|frame)-/.test(head)) continue;
    const fields = [...text.matchAll(/^lar-(?:open-)?pattern:(.*)$/gm)].map((m) => m[1].replace(/\\[sSdDwWbB]/g, " ")).join(" ");
    let params = [...new Set([...fields.matchAll(/([A-Za-z][\w-]*)=`/g)].map((m) => m[1]))];
    if (!params.length) {
      const ex = /^lar-example:(.*)$/m.exec(text)?.[1] ?? "";
      params = [...new Set([...ex.matchAll(/([A-Za-z][\w-]*)=`/g)].map((m) => m[1]))];
    }
    if (params.length) sigs[head] = { params, source: f };
  }
  return sigs;
}

/** The bare procedures the seed itself defines (`has`, `scale`, `hello`): calls the house owns. */
export function loadBareHouse(repo) {
  const bare = {};
  const seed = join(repo, SEED_REL);
  if (!existsSync(seed)) return bare;
  for (const m of readFileSync(seed, "utf8").matchAll(/^\\procedure\s+([A-Za-z][\w-]*)\(([^)]*)\)/gm)) {
    if (m[1].startsWith("set-")) continue;
    bare[m[1]] = { params: paramNames(m[2]), source: "seed" };
  }
  return bare;
}

export async function loadContext({ repo, planes, planesPath } = {}) {
  repo = repo ?? join(HERE, "..");
  const corpus = await import(pathToFileURL(join(repo, "tools/corpus-read.mjs")).href);
  const frame = await corpus.distModule(repo, join(repo, "packages/lararium-memetic-frame/dist/index.js"),
    "grammar-cut", "pnpm --filter @lararium/memetic-frame build");
  const { wiki } = await corpus.bootTW5Engine(join(repo, "packages/lararium-tw5/dist"), "grammar-cut");
  // THE ONE FINDER. The bags corpus comes from the shore every reader calls (it skips the frozen
  // specimens and the submodules); a glob of this tool's own would re-open a second answer.
  const { carrierFiles } = await corpus.distCarrierFiles(repo, "grammar-cut");
  const declared = [...frame.CARRIER_DECLARATION.matchAll(/([A-Za-z][\w-]*)=`/g)].map((m) => m[1]);
  const doctype = declared.length === 2
    ? { names: declared, fromFrame: true }
    : { names: ["type", "spec"], fromFrame: false };
  const map = planes ?? JSON.parse(readFileSync(planesPath ?? join(repo, "tools/grammar-cut-planes.json"), "utf8"));
  const parse = (src) => {
    const walk = (ns) => {
      for (const n of ns ?? []) {
        if (n.type === "transclude" && n.attributes) return n;
        const r = walk(n.children);
        if (r) return r;
      }
      return null;
    };
    try { return walk(wiki.parseText("text/vnd.tiddlywiki", src, { parseAsInline: false }).tree); } catch { return null; }
  };
  return {
    repo, frame, parse, doctype, carrierFiles,
    sigs: loadSignatures(repo),
    bare: loadBareHouse(repo),
    planes: {
      rename: map.rename ?? {}, tagged: map.tagged ?? {},
      slug: new Set([...(map.slug ?? []), ...(map.strip ?? [])]), scopes: new Set(map.scopes ?? []), out: new Set(map.out ?? []),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Reading a sigil
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Tokens of a sigil body, each with the whitespace before it and its span in the body. */
export function tokenize(body) {
  const out = [];
  let i = 0;
  const n = body.length;
  const val = () => {
    for (const q of ["```", '"""']) {
      if (body.startsWith(q, i)) {
        const j = body.indexOf(q, i + 3);
        const e = j < 0 ? n : j;
        const v = body.slice(i + 3, e);
        i = j < 0 ? n : e + 3;
        return { qs: q, v, open: j < 0 };
      }
    }
    const c = body[i];
    if (c === '"' || c === "'" || c === "`") {
      const j = body.indexOf(c, i + 1);
      const e = j < 0 ? n : j;
      const v = body.slice(i + 1, e);
      i = j < 0 ? n : e + 1;
      return { qs: c, v, open: j < 0 };
    }
    if (body.startsWith("<<", i)) {
      const j = body.indexOf(">>", i);
      const e = j < 0 ? n : j + 2;
      const v = body.slice(i, e); i = e;
      return { qs: "<<>>", v };
    }
    if (body.startsWith("{{", i)) {
      const j = body.indexOf("}}", i);
      const e = j < 0 ? n : j + 2;
      const v = body.slice(i, e); i = e;
      return { qs: "{{}}", v };
    }
    let j = i;
    while (j < n && !/\s/.test(body[j])) j++;
    const v = body.slice(i, j); i = j;
    return { qs: "", v };
  };
  while (i < n) {
    const ws0 = i;
    while (i < n && /\s/.test(body[i])) i++;
    if (i >= n) { out.trail = body.slice(ws0); break; }
    const ws = body.slice(ws0, i);
    const start = i;
    if (body.startsWith("->", i) && (i + 2 >= n || /\s/.test(body[i + 2]))) {
      i += 2;
      out.push({ kind: "arrow", ws, start, end: i });
      continue;
    }
    const m = /^([A-Za-z][\w-]*)([=:])(?=[^\s=])/.exec(body.slice(i));
    if (m && (m[2] === "=" || !body.startsWith("/", i + m[0].length))) {
      i += m[0].length;
      const v = val();
      out.push({ kind: "named", name: m[1], colon: m[2] === ":", ws, start, end: i, ...v });
      continue;
    }
    const v = val();
    out.push({ kind: "pos", ws, start, end: i, ...v });
  }
  out.trail ??= "";
  return out;
}

/** The head of a sigil: its symbol, the spacing after it, its word, and the body after that. */
export function readHead(src) {
  if (src.startsWith("<<^")) return { sym: "^", head: "^", prefix: "<<^", body: src.slice(3, -2) };
  const m = /^<<([~!]?)([ \t]*)([A-Za-z&#][\w&#;-]*)/.exec(src);
  return { sym: m[1], head: m[3], prefix: m[0], body: src.slice(m[0].length, -2), spaced: m[2].length > 0 };
}

const STRINGY = new Set(['"', "'", '"""', "`", "```", ""]);
const QUOTED = new Set(['"', "'", '"""']);
const keepsType = (t) => t.qs === "<<>>" || t.qs === "{{}}" || (t.qs === "" && /^(\[\[|\{\{\{)/.test(t.v));

/** How a value rides in ticks, or why it cannot. */
function tick(v) {
  if (SUBSTITUTION.test(v)) return { refuse: "substitution" };
  if (v.includes("```") || v.startsWith("`") || v.endsWith("`")) return { refuse: "tick-unsafe" };
  return { text: v.includes("`") ? "```" + v + "```" : "`" + v + "`" };
}

/** The parser's reading of a call: [{ name, positional, type, value }] in source order. */
function oracleReading(ctx, src) {
  const node = ctx.parse(src);
  if (!node) return null;
  return (node.orderedAttributes ?? []).filter((a) => a.name !== "$variable").map((a) => ({
    name: a.name, positional: !!a.isPositional, type: a.type,
    value: a.type === "substituted" ? a.rawValue : (typeof a.value === "string" ? a.value : null),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Cutting one house sigil
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** The signature a call answers to, or a reason it has none. */
function signatureOf(ctx, h, toks) {
  if (h.sym === "^") return { kind: "control" };
  if (h.sym === "!") return h.head === "DOCTYPE" ? { kind: "doctype", params: ctx.doctype.names } : { kind: "foreign" };
  if (h.sym === "") return ctx.bare[h.head] ? { kind: "house", ...ctx.bare[h.head], head: h.head } : { kind: "foreign" };
  const first = toks[0];
  if (first && first.kind === "pos" && first.qs === "" && ctx.sigs[`${h.head}~${first.v}`]) {
    return { kind: "house", ...ctx.sigs[`${h.head}~${first.v}`], head: `${h.head}~${first.v}`, compound: first };
  }
  if (ctx.sigs[h.head]) return { kind: "house", ...ctx.sigs[h.head], head: h.head };
  if (PROSE_VOICES.has(h.head)) return { kind: "prose-voice" };
  if (RETIRED.has(h.head)) return { kind: "retired" };
  return { kind: "unsigned" };
}

/** Does this call carry anything the cut would change? */
const needsCut = (toks) => toks.some((t) => t.kind === "arrow" || t.kind === "pos" || (t.kind === "named" && (QUOTED.has(t.qs) || t.colon || (t.qs === "" && !keepsType(t)))));

/**
 * Cut one call. Returns { text, intended } or { refuse, why }.
 * `intended` lists the attributes the parser must hand back from `text`.
 */
export function cutSigil(ctx, src, opts = {}) {
  const h = readHead(src);
  const toks = tokenize(h.body);
  const sig = signatureOf(ctx, h, toks);
  if (sig.kind === "foreign") return { unchanged: true, foreign: true };
  if (!needsCut(toks)) return { unchanged: true };
  if (sig.kind === "prose-voice" || sig.kind === "unsigned") return { refuse: sig.kind, why: h.head };
  if (sig.kind === "retired") return { refuse: "turn-unmappable", why: `retired ~${h.head}` };
  if (toks.some((t) => t.open)) return { refuse: "unbalanced", why: "an unclosed quote" };
  if (/<<|>>/.test(h.body)) return { refuse: "nested", why: "a call inside the call" };
  const params = sig.params ?? [];
  const pN = params.find((p) => /^p\d+$/.test(p));
  if (pN && toks.some((t) => t.kind === "pos")) return { refuse: "pN", why: `${h.head} still names ${pN}` };

  // Each token's fate: { emit: "raw" | "drop" | "named" } with the name and value it carries.
  const fate = toks.map((t) => ({ t, emit: "raw" }));
  if (sig.compound) fate[0].emit = "keep";
  const named = new Set(toks.filter((t) => t.kind === "named").map((t) => t.name));
  const has = (p) => params.includes(p) && !named.has(p);

  // ── Cut 1: the arrow ──
  let restAt = null;
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].kind !== "arrow") continue;
    if (opts.disable?.includes("arrow")) return { refuse: "arrow", why: "the arrow rule stands switched off" };
    const prev = toks[i - 1], next = toks[i + 1];
    if (next && next.kind === "named" && next.name === "to") { fate[i].emit = "drop"; continue; }
    if (prev?.kind === "pos" && next?.kind === "pos" && has("from") && has("to") && fate[i - 1].emit === "raw") {
      fate[i - 1] = { t: prev, emit: "named", name: "from", value: prev.v };
      fate[i + 1] = { t: next, emit: "named", name: "to", value: next.v };
      fate[i].emit = "drop";
      named.add("from"); named.add("to");
      i++;
      continue;
    }
    const rest = sig.head === "moves" ? "params" : sig.head === "flows" ? "path" : null;
    if (rest && prev?.kind === "pos" && i === 1 + (sig.compound ? 1 : 0) && has("name")) {
      if (toks.slice(i + 1).some((t) => t.kind === "named")) return { refuse: "arrow", why: `${sig.head}: named keys after the chain` };
      const value = h.body.slice(toks[i + 1]?.start ?? h.body.length).replace(/\s+$/, "");
      if (!value) return { refuse: "arrow", why: `${sig.head}: an arrow with nothing after it` };
      fate[i - 1] = { t: prev, emit: "named", name: "name", value: prev.v };
      fate[i].emit = "drop";
      fate[i + 1] = { t: toks[i + 1], emit: "named", name: rest, value };
      for (let k = i + 2; k < toks.length; k++) fate[k].emit = "drop";
      restAt = i;
      break;
    }
    return { refuse: "arrow", why: `~${h.head}: an arrow with no from/to slot` };
  }

  // ── Cut 3: positionals take their names ──
  const loose = fate.filter((f) => f.emit === "raw" && f.t.kind === "pos");
  if (loose.some((f) => ELLIPSIS.test(f.t.v))) return { refuse: "ellipsis", why: `~${h.head}: a cited placeholder` };
  const free = params.filter((p) => !named.has(p) && !fate.some((f) => f.name === p));
  if (loose.length > free.length) {
    if (free.length === 1 && params.length === 1) {
      // A quote that held a space carries prose (a quoted span a ward counts); a quote around a
      // spaceless token only shielded it from the parser (the oracle's `"⁂:…"`), and drops.
      const value = loose.map((f) => (QUOTED.has(f.t.qs) && /\s/.test(f.t.v) ? f.t.qs + f.t.v + f.t.qs : f.t.v)).join(" ");
      fate[fate.indexOf(loose[0])] = { t: loose[0].t, emit: "named", name: free[0], value };
      for (const f of loose.slice(1)) f.emit = "drop";
    } else {
      return { refuse: "overflow", why: `~${h.head} takes ${params.join(" ") || "no values"}; ${loose.length} positional(s) stand` };
    }
  } else {
    loose.forEach((f, k) => { fate[fate.indexOf(f)] = { t: f.t, emit: "named", name: free[k], value: f.t.v, positional: true }; });
  }
  for (const f of fate) {
    if (f.emit !== "named" || !f.positional) continue;
    if (f.name === "params" && f.t.qs === "" && !f.value.includes("/")) return { refuse: "not-has-values", why: `~${h.head} params=${f.value}` };
    if (f.name === "uri" && !/[:/#]/.test(f.value) && !/^[A-Z][A-Z_-]*$/.test(f.value)) return { refuse: "uri-shape", why: `~${h.head} uri=${f.value}` };
  }
  // Named values tick (a macro, transclusion, filter or bracketed title keeps its type).
  for (const f of fate) {
    if (f.emit === "raw" && f.t.kind === "named" && !keepsType(f.t) && STRINGY.has(f.t.qs)) {
      if (f.t.qs === "`" || f.t.qs === "```") { if (!f.t.colon) continue; }
      Object.assign(f, { emit: "named", name: f.t.name, value: f.t.v });
    }
  }

  // ── Emit, and the intended reading ──
  let body = "";
  const intended = [];
  if (h.sym === "~" && h.spaced) intended.push({ positional: true, value: h.head });
  for (const f of fate) {
    if (f.emit === "drop") continue;
    if (f.emit === "named") {
      const tk = tick(f.value);
      if (tk.refuse) return { refuse: tk.refuse, why: `${f.name}=${f.value.slice(0, 60)}` };
      body += f.t.ws + `${f.name}=${tk.text}`;
      intended.push({ name: f.name, type: "substituted", value: f.value });
    } else {
      body += f.t.ws + h.body.slice(f.t.start, f.t.end);
      if (f.t.kind === "pos") intended.push({ positional: true, value: f.t.v });
      else if (f.t.kind === "named") intended.push({ name: f.t.name, type: f.t.qs === "`" || f.t.qs === "```" ? "substituted" : null, value: STRINGY.has(f.t.qs) ? f.t.v : null });
      else return { refuse: "arrow", why: "an arrow survived" };
    }
  }
  // A captured chain carries its raw text, so the parser's reading of the chain as written binds nothing.
  const before = restAt === null ? beforeReading(h, toks) : beforeReading(h, toks.slice(0, restAt));
  return { text: h.prefix + body + toks.trail + ">>", intended, before, prefixOnly: restAt !== null };
}

/** What this tool reads in the call as written, in the parser's terms, for the BEFORE check. */
function beforeReading(h, toks) {
  const r = [];
  if (h.sym === "~" && h.spaced) r.push({ positional: true, value: h.head });
  for (const t of toks) {
    if (t.kind === "arrow") r.push({ positional: true, value: "->" });
    else if (t.kind === "pos") r.push({ positional: true, value: STRINGY.has(t.qs) ? t.v : null });
    else r.push({ name: t.name, value: STRINGY.has(t.qs) ? t.v : null });
  }
  return r;
}

/** Does the parser read `src` as `want`? Positional names are indexes, so only order binds them. */
function agrees(ctx, src, want, prefixOnly = false) {
  const got = oracleReading(ctx, src);
  if (!got || (prefixOnly ? got.length < want.length : got.length !== want.length)) return false;
  return want.every((w, i) => {
    const g = got[i];
    if (!!w.positional !== g.positional) return false;
    if (!w.positional && w.name !== g.name) return false;
    if (w.type && w.type !== g.type) return false;
    return w.value === null || w.value === undefined || w.value === g.value;
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Cut 4: the turn frame
// ─────────────────────────────────────────────────────────────────────────────────────────────

const MIDDLE_DROP = new Set(["lares", "from", "to", "drift-ward", "note"]);
/** The keys of a firing, in bracket order. */
function firing(kind, keys) {
  const get = (k) => keys.find((x) => x[0] === k);
  const middle = keys.filter(([k]) => !MIDDLE_DROP.has(k));
  const order = kind === "aim" ? [get("from"), get("to"), ...middle, get("drift-ward")]
    : kind === "yield" ? [get("drift-ward"), ...middle, get("from"), get("to")]
      : [get("to"), ...middle, get("drift-ward")];
  return [["lares", kind], ...order.filter(Boolean), get("note")].filter(Boolean);
}

/** A turn sigil's role and its keys, or null when it plays no turn role. */
function turnRole(src) {
  const h = readHead(src);
  if (h.sym !== "~") return null;
  const toks = tokenize(h.body);
  const str = (t) => t.kind === "named" && STRINGY.has(t.qs) && !t.open;
  if (h.head === "lares") {
    const which = toks[0]?.kind === "pos" ? toks[0].v : null;
    if (which !== "aim" && which !== "yield") return { role: "unmappable", why: "~lares with no aim or yield" };
    let rest = toks.slice(1).filter((t) => t.kind !== "arrow");
    if (rest.length === 2 && rest.every((t) => t.kind === "pos" && STRINGY.has(t.qs)) && toks[2]?.kind === "arrow") {
      rest = [{ ...rest[0], kind: "named", name: "from" }, { ...rest[1], kind: "named", name: "to" }];
      return { role: `lares-${which}`, keys: rest.map((t) => [t.name, t.v]), h, toks };
    }
    if (!rest.every(str) || rest.some((t) => t.name !== "from" && t.name !== "to")) return { role: "unmappable", why: `~lares ${which} carries more than from and to` };
    return { role: `lares-${which}`, keys: rest.map((t) => [t.name, t.v]), h, toks };
  }
  if (h.head === "set") {
    const hud = toks.find((t) => t.kind === "named" && t.name === "hud");
    const lares = toks.find((t) => t.kind === "named" && t.name === "lares");
    if (lares || !hud) return null;
    if (!toks.every(str)) return { role: "unmappable", why: "set hud= with a positional or typed value" };
    if (hud.v !== "aim" && hud.v !== "yield") return { role: "unmappable", why: `set hud="${hud.v}"` };
    return { role: `set-${hud.v}`, keys: toks.filter((t) => t.name !== "hud").map((t) => [t.name, t.v]), h, toks };
  }
  if (GAUGES.has(h.head)) {
    const vals = toks.filter((t) => STRINGY.has(t.qs) && !t.open);
    if (vals.length !== 1 || toks.length !== 1) return { role: "unmappable", why: `~${h.head} with ${toks.length} values` };
    return { role: "gauge", keys: [[h.head, vals[0].v]], h, toks };
  }
  if (RETIRED.has(h.head)) return { role: "unmappable", why: `retired ~${h.head}` };
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Cut 2: the at-sign
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** The at-sign pass over plain text: { text, renamed, phase, unmapped:Set }. */
export function cutAt(text, planes) {
  let phase = 0, renamed = 0;
  const unmapped = new Set();
  text = text.replace(new RegExp(`(φ)[ \\t]+@(?=[${PHASES}])`, "g"), (_, g) => { phase++; return g; });
  text = text.replace(/(^|\s)@([A-Za-z][\w-]*)(?=([\s\S]?))/gm, (all, lead, name, after) => {
    if (after === "@") { if (planes.out.has(name)) return all; renamed++; return lead + name; }
    if (after === "/" && (planes.scopes.has(name) || planes.out.has(name))) return all;
    if (planes.out.has(name)) return all;
    if (planes.rename[name]) { renamed++; return lead + planes.rename[name]; }
    if (planes.slug.has(name)) { renamed++; return lead + name; }
    for (const [from, to] of Object.entries(planes.tagged)) {
      if (name.startsWith(from)) { renamed++; return lead + to + name.slice(from.length); }
    }
    unmapped.add(name);
    return all;
  });
  return { text, phase, renamed, unmapped };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Cutting a whole text
// ─────────────────────────────────────────────────────────────────────────────────────────────

const lineAt = (text, i) => text.slice(0, i).split("\n").length;

/** Each mask span, with its kind: toml, block, or inline (an inline span carries its delimiters). */
function spansOf(ctx, text) {
  return ctx.frame.fencedSpans(text).map((s) => {
    const head = text.slice(s.start, s.end);
    const block = /^[ \t]{0,3}(`{3,}|~{3,})/.test(head) && head.includes("\n") && (s.start === 0 || text[s.start - 1] === "\n");
    const kind = !block ? "inline" : /^[ \t]{0,3}(`{3,}|~{3,})\s*toml\b/.test(head) ? "toml" : "block";
    const delim = kind === "inline" ? /^`+/.exec(head)[0].length : 0;
    return { ...s, kind, delim };
  });
}
const spanAt = (spans, i) => spans.find((s) => i >= s.start && i < s.end) ?? null;

/**
 * Cut a text. opts: { rel, envelopeOnly, disable }.
 * Returns { text, changes, refusals, unmapped, bodyChanges, seal, counts, foreign }.
 */
export function cutText(text, ctx, opts = {}) {
  const rel = opts.rel ?? "(text)";
  const spans = spansOf(ctx, text);
  const matches = [...text.matchAll(SIGIL)].map((m) => ({ start: m.index, end: m.index + m[0].length, src: m[0] }));
  const edits = [];
  const refusals = [];
  const lists = { partialTurns: [] };
  const counts = { sigils: 0, cut: 0, turns: 0, foreign: 0 };
  let bodyChanges = 0;
  const refuse = (m, kind, why) => refusals.push({ rel, line: lineAt(text, m.start), kind, why, src: m.src.replace(/\n/g, "⏎").slice(0, 140) });

  const zone = (m) => {
    const a = spanAt(spans, m.start), b = spanAt(spans, m.end - 1);
    if (a !== b) return { cross: true };
    if (a?.kind === "toml") return { toml: true };
    const ls = text.lastIndexOf("\n", m.start - 1) + 1;
    if (DEFINITION_LINE.test(text.slice(ls, m.start + 1))) return { definition: true, span: a };
    return { span: a };
  };
  const envelope = (m, z) => !z.span && (m.src.startsWith("<<^") || m.src.startsWith("<<!DOCTYPE"));
  const push = (start, end, out, z, isEnvelope) => {
    if (opts.envelopeOnly && !isEnvelope) { bodyChanges++; return; }
    edits.push({ start, end, text: out, span: z.span?.kind === "inline" ? z.span : null });
  };

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    counts.sigils++;
    const z = zone(m);
    if (z.toml) continue;

    // ── Cut 4 first: a turn sigil folds, or lists ──
    const role = turnRole(m.src);
    if (role) {
      if (z.cross || z.definition) { refuse(m, "turn-unmappable", z.cross ? "straddles a code span" : "a definition body"); continue; }
      if (role.role === "unmappable") { refuse(m, "turn-unmappable", role.why); continue; }
      let kind, keys, end = m.end, partner = null;
      const next = matches[i + 1];
      const between = next ? text.slice(m.end, next.start) : null;
      const nextRole = next && /^\s*$/.test(between) && zone(next).span === z.span ? turnRole(next.src) : null;
      if (role.role === "lares-aim" || role.role === "set-aim") {
        kind = "aim";
        const pair = role.role === "lares-aim" ? "set-aim" : "lares-aim";
        if (nextRole?.role === pair) { partner = next; keys = [...role.keys, ...nextRole.keys]; }
        else keys = role.keys;
      } else if (role.role === "set-yield" || role.role === "lares-yield") {
        kind = "yield";
        const pair = role.role === "set-yield" ? "lares-yield" : "set-yield";
        if (nextRole?.role === pair) { partner = next; keys = [...role.keys, ...nextRole.keys]; }
        else keys = role.keys;
      } else { kind = "steer"; keys = role.keys; }
      if (partner) end = partner.end;
      const fired = firing(kind, keys);
      let out = "<<~ set";
      const intended = [{ positional: true, value: "set" }];
      let bad = null;
      for (const [k, v] of fired) {
        const tk = tick(v);
        if (tk.refuse) { bad = `${tk.refuse}: ${k}=${v.slice(0, 50)}`; break; }
        out += ` ${k}=${tk.text}`;
        intended.push({ name: k, type: "substituted", value: v });
      }
      out += ">>";
      const sources = partner ? [role, nextRole] : [role];
      if (bad) { refuse(m, "turn-unmappable", bad); continue; }
      if (!opts.handReviewed && !sources.every((s) => agrees(ctx, s.h.prefix + s.h.body + ">>", beforeReading(s.h, s.toks)))) { refuse(m, "old-misread", "the parser reads the old turn otherwise (a bare URI, an apostrophe): hand-cut"); continue; }
      if (!agrees(ctx, out, intended)) { refuse(m, "oracle-after", "the parser reads the new firing otherwise"); continue; }
      push(m.start, end, out, z, false);
      counts.turns++;
      if (!partner && kind !== "steer") lists.partialTurns.push(`${rel}:${lineAt(text, m.start)} ${role.role} with no partner`);
      if (partner) { i++; counts.sigils++; }
      continue;
    }

    const r = cutSigil(ctx, m.src, opts);
    if (r.foreign) { counts.foreign++; continue; }
    if (r.unchanged) continue;
    if (z.cross) { refuse(m, "crosses-span", "a sigil straddles a code span"); continue; }
    if (z.definition) { refuse(m, "definition-body", "a call inside a procedure definition"); continue; }
    if (r.refuse) { refuse(m, r.refuse, r.why); continue; }
    if (!opts.handReviewed && !agrees(ctx, m.src, r.before, r.prefixOnly)) { refuse(m, "old-misread", "the parser reads the old call otherwise (a bare URI, an apostrophe, an old pragma form): hand-cut"); continue; }
    if (!agrees(ctx, r.text, r.intended)) { refuse(m, "oracle-after", "the parser reads the new call otherwise"); continue; }
    push(m.start, m.end, r.text, z, envelope(m, z));
    counts.cut++;
  }

  // ── Apply, widening each inline span that now holds a tick run as long as its delimiter ──
  const bySpan = new Map();
  const flat = [];
  for (const e of edits) {
    if (e.span) { if (!bySpan.has(e.span)) bySpan.set(e.span, []); bySpan.get(e.span).push(e); } else flat.push(e);
  }
  for (const [s, es] of bySpan) {
    let inner = text.slice(s.start + s.delim, s.end - s.delim);
    for (const e of es.sort((a, b) => b.start - a.start)) {
      inner = inner.slice(0, e.start - s.start - s.delim) + e.text + inner.slice(e.end - s.start - s.delim);
    }
    const longest = Math.max(0, ...[...inner.matchAll(/`+/g)].map((x) => x[0].length));
    let out;
    if (longest >= s.delim) {
      const d = "`".repeat(longest + 1);
      const trimmed = inner.replace(/^ (?=`)|(?<=`) $/g, "");
      const pad = /^`|`$/.test(trimmed) ? " " : "";
      out = d + pad + trimmed + pad + d;
    } else out = "`".repeat(s.delim) + inner + "`".repeat(s.delim);
    flat.push({ start: s.start, end: s.end, text: out });
  }
  let next = text;
  for (const e of flat.sort((a, b) => b.start - a.start)) next = next.slice(0, e.start) + e.text + next.slice(e.end);

  // ── Cut 2 over the whole text ──
  const at = cutAt(next, ctx.planes);
  if (opts.envelopeOnly) { bodyChanges += at.phase + at.renamed; } else next = at.text;
  const unmapped = opts.envelopeOnly ? [] : [...at.unmapped].sort();

  // ── Cut 5: the retired `file-path` line, envelope-class (the identity fence) ──
  let filePath = 0;
  if (!opts.disable?.includes("file-path")) next = next.replace(FILE_PATH_LINE, () => { filePath++; return ""; });

  // ── The seal ──
  let seal = "none";
  const standing = ctx.frame.verifyBcc(text);
  if (/^<<!DOCTYPE\b/m.test(text) && (standing !== "unchecked" || /ni:\/\/\/sha-256;/.test(text))) {
    const stamped = next === text ? next : ctx.frame.stampCarrier(next);
    seal = ctx.frame.verifyBcc(stamped);
    if (seal === "ok") next = stamped;
  }
  const changes = flat.length + filePath + (opts.envelopeOnly ? 0 : at.phase + at.renamed);
  return { text: next, changes, refusals, unmapped, bodyChanges, seal, lists, counts: { ...counts, phase: at.phase, renamed: at.renamed, filePath } };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The census: what the cut still owes, over the same house sigils it cuts
// ─────────────────────────────────────────────────────────────────────────────────────────────

export function censusText(text, ctx) {
  const spans = spansOf(ctx, text);
  const c = { sigils: 0, arrows: 0, quotedNamed: 0, positional: 0, spacedAt: 0, phase: 0, turnFrame: 0, filePath: 0 };
  for (const m of text.matchAll(SIGIL)) {
    if (spanAt(spans, m.index)?.kind === "toml") continue;
    const h = readHead(m[0]);
    const toks = tokenize(h.body);
    const sig = signatureOf(ctx, h, toks);
    if (sig.kind === "foreign") continue;
    c.sigils++;
    if (sig.kind === "retired" || (h.head === "set" && toks.some((t) => t.name === "hud"))) c.turnFrame++;
    for (const t of toks) {
      if (t.kind === "arrow") c.arrows++;
      else if (t.kind === "named" && (QUOTED.has(t.qs) || t.colon)) c.quotedNamed++;
      else if (t.kind === "pos" && t !== sig.compound && !ELLIPSIS.test(t.v)) c.positional++;
    }
  }
  c.phase = [...text.matchAll(new RegExp(`φ[ \\t]+@(?=[${PHASES}])`, "g"))].length;
  c.filePath = [...text.matchAll(FILE_PATH_LINE)].length;
  for (const m of text.matchAll(/(^|\s)@([A-Za-z][\w-]*)(?=([\s\S]?))/gm)) {
    if (m[3] === "/" && (ctx.planes.scopes.has(m[2]) || ctx.planes.out.has(m[2]))) continue;
    if (ctx.planes.out.has(m[2])) continue;
    c.spacedAt++;
  }
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The CLI
// ─────────────────────────────────────────────────────────────────────────────────────────────

const git = (repo, args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 1 << 28 });

export function canonCarriers(repo) {
  try {
    return new Set(git(repo, ["diff", "--name-only", ...CANON_RANGE, "--", "bags"]).split("\n")
      .filter((f) => f.endsWith(".mem") && existsSync(join(repo, f)) && !CANON_CUT_WHOLE.has(f)));
  } catch { return null; }
}

/** The bags carriers the shore finds, less the seed, plus the guide named by path. */
export function defaultFiles(ctx) {
  return ctx.carrierFiles(ctx.repo).filter((f) => f.startsWith("bags/") && f !== SEED_REL).concat(GUIDE_REL);
}

async function main(argv) {
  const repo = join(HERE, "..");
  const flag = (f) => argv.includes(f);
  const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const write = flag("--write");
  // --hand-reviewed: the hand pass over old calls the parser itself misreads (a bare URI, an
  // apostrophe). It drops the BEFORE check only; the AFTER check still binds every value written,
  // and the operator of the pass reads each changed call in the diff.
  const handReviewed = flag("--hand-reviewed");
  const filesAt = argv.indexOf("--files");
  const given = filesAt >= 0 ? argv.slice(filesAt + 1).filter((a) => !a.startsWith("--")) : null;
  const ctx = await loadContext({ repo, planesPath: val("--planes") });
  const canon = canonCarriers(repo);
  if (!canon) { console.error("[grammar-cut] cannot read Canon's hand-cut range " + CANON_RANGE.join("..")); process.exit(2); }

  if (flag("--outside")) {
    const files = git(repo, ["ls-files", ...OUTSIDE]).split("\n").filter((f) => /\.(md|mem|tid)$|noosphere-boot$/.test(f));
    for (const rel of files) {
      const r = cutText(readFileSync(join(repo, rel), "utf8"), ctx, { rel });
      if (r.changes || r.refusals.length || r.unmapped.length) console.log(`${rel}: ${r.changes} change(s) owed · ${r.refusals.length} refusal(s) · unmapped ${r.unmapped.join(" ") || "none"}`);
    }
    return 0;
  }

  const files = (given ?? defaultFiles(ctx)).filter((f) => f !== SEED_REL && !f.startsWith(".claude/") && !f.startsWith("packages/lararium-tw5/tiddlers/"));
  if (flag("--census")) {
    const total = {};
    for (const rel of files) for (const [k, v] of Object.entries(censusText(readFileSync(join(repo, rel), "utf8"), ctx))) total[k] = (total[k] ?? 0) + v;
    console.log(JSON.stringify({ files: files.length, ...total }));
    return 0;
  }

  const report = { files: files.length, touched: [], changes: 0, turns: 0, cut: 0, phase: 0, renamed: 0, filePath: 0, refusals: [], unmapped: {}, canonBody: {}, sealBlocked: [], partialTurns: [] };
  const outputs = [];
  for (const rel of files) {
    const before = readFileSync(join(repo, rel), "utf8");
    const r = cutText(before, ctx, { rel, envelopeOnly: canon.has(rel), handReviewed });
    report.refusals.push(...r.refusals);
    report.partialTurns.push(...r.lists.partialTurns);
    for (const u of r.unmapped) (report.unmapped[u] ??= []).push(rel);
    if (canon.has(rel) && r.bodyChanges) report.canonBody[rel] = r.bodyChanges;
    if (r.text === before) continue;
    if (r.seal !== "ok" && r.seal !== "none") report.sealBlocked.push(`${rel} (${r.seal})`);
    report.touched.push(rel);
    report.changes += r.changes; report.turns += r.counts.turns; report.cut += r.counts.cut;
    report.phase += r.counts.phase; report.renamed += r.counts.renamed; report.filePath += r.counts.filePath;
    outputs.push({ rel, before, after: r.text });
  }
  const byKind = {};
  for (const x of report.refusals) byKind[x.kind] = (byKind[x.kind] ?? 0) + 1;
  const byHead = {};
  for (const x of report.refusals.filter((y) => y.kind === "unsigned" || y.kind === "prose-voice")) byHead[x.why] = (byHead[x.why] ?? 0) + 1;
  const oracle = report.refusals.filter((x) => x.kind === "oracle-after").length;
  const reds = Object.keys(report.unmapped).length + oracle + Object.keys(report.canonBody).length + report.sealBlocked.length;

  console.log(`grammar-cut ${write ? "WRITES" : "dry run"}: ${report.touched.length} of ${files.length} file(s) change · ${report.cut} call(s) cut · ${report.turns} turn firing(s) folded · ${report.phase} phase mark(s) fused · ${report.renamed} at-name(s) renamed · ${report.filePath} file-path line(s) dropped`);
  console.log(`  refusals: ${report.refusals.length} ${JSON.stringify(byKind)}`);
  console.log(`  unsigned and prose-voice heads: ${JSON.stringify(Object.fromEntries(Object.entries(byHead).sort((a, b) => b[1] - a[1])))}`);
  console.log(`  partial turns (folded, a partner missing): ${report.partialTurns.length}`);
  console.log(`  unmapped at-names (RED): ${Object.keys(report.unmapped).sort().join(" ") || "none"}`);
  console.log(`  Canon body changes (RED): ${JSON.stringify(report.canonBody)}`);
  console.log(`  seal not verifying (RED): ${report.sealBlocked.length}`);
  console.log(`  DOCTYPE names ${ctx.doctype.fromFrame ? "read from the frame package" : "NOT yet declared by the frame package (Q4 owed); the ruled type/spec stand in for the dry run only"}`);

  const out = val("--out");
  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 1));
    for (const { rel, before, after } of outputs) {
      for (const [side, body] of [["a", before], ["b", after]]) {
        mkdirSync(dirname(join(out, side, rel)), { recursive: true });
        writeFileSync(join(out, side, rel), body);
      }
    }
    try { execFileSync("git", ["diff", "--no-index", "--no-color", "a", "b"], { cwd: out, encoding: "utf8", maxBuffer: 1 << 30 }); }
    catch (e) { writeFileSync(join(out, "diff.patch"), e.stdout ?? ""); }
    console.log(`  report, before/after trees and diff.patch at ${out}`);
  }

  if (write) {
    const why = [];
    if (!ctx.doctype.fromFrame) why.push("the frame package does not yet declare the DOCTYPE names (Q4)");
    if (reds) why.push(`${reds} red(s) stand`);
    const dirty = report.touched.length ? git(repo, ["status", "--porcelain", "--", ...report.touched]).trim() : "";
    if (dirty) why.push(`dirty targets:\n${dirty}`);
    if (why.length) { console.error(`[grammar-cut] --write refused: ${why.join("; ")}`); return 1; }
    for (const { rel, after } of outputs) writeFileSync(join(repo, rel), after);
    console.log(`  wrote ${outputs.length} file(s); commit them by pathspec with --only`);
  }
  if (flag("--check") && report.touched.length) {
    console.error(`[grammar-cut] --check: ${report.touched.length} file(s) still owe the cut`);
    return 1;
  }
  return reds ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exit(await main(process.argv.slice(2)));
}
