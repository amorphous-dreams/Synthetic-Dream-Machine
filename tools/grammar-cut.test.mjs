// grammar-cut — the kupono cut's known positives, each beside its control.
//
// Every fixture names the exact bytes the cut must write, or the exact refusal it must list.
// The controls prove the tests bite: a tool with its arrow rule switched off fails the arrow
// fixture, a second run over cut text writes nothing, and the census counts a fixture whose
// counts are known before the corpus count is trusted.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadContext, cutText, censusText, canonCarriers, CANON_CUT_WHOLE } from './grammar-cut.mjs';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const PLANES = {
  rename: { daemon: 'daemon-plane', crossroads: 'crossroads-plane', oracle: 'oracle-floor', personal: 'personal-slot' },
  tagged: { 'circles-': 'circles-plane-' },
  slug: ['lares', 'lararium', 'sdm'],
  strip: ['salt-crust'],
  scopes: ['lararium', 'lares', 'types'],
  out: ['editable', 'keyframes'],
};
const ctx = await loadContext({ repo: REPO, planes: PLANES });
const cut = (text, opts) => cutText(text, ctx, { rel: 'bags/x/fixture.mem', ...opts });
const one = (text, opts) => cut(text, opts).text;
const kinds = (r) => r.refusals.map((x) => x.kind).sort();

test('a slot word and a quoted URI take their names in ticks', () => {
  assert.equal(one('<<~ ahu #/head>>\n'), '<<~ ahu slot=`#/head`>>\n');
  assert.equal(one('<<~ loulou "lar:///a.b.c/x">>\n'), '<<~ loulou uri=`lar:///a.b.c/x`>>\n');
  assert.equal(one('<<~ hoike #frag held="a ruling">>\n'), '<<~ hoike slot=`#frag` held=`a ruling`>>\n');
});

test('the arrow leaves: from and to carry the relation', () => {
  assert.equal(one('<<~ pranala #s from="?" -> to="lar:///a.b.c/y">>\n'), '<<~ pranala slot=`#s` from=`?` to=`lar:///a.b.c/y`>>\n');
  assert.equal(one('<<~ papalohe "lar:///a.b.c/x" -> "lar:///a.b.c/y">>\n'), '<<~ papalohe from=`lar:///a.b.c/x` to=`lar:///a.b.c/y`>>\n');
  assert.equal(one('<<~moves second-reader -> engine-grammar on/the-VM do/retire-the-regex>>\n'),
    '<<~moves name=`second-reader` params=`engine-grammar on/the-VM do/retire-the-regex`>>\n');
  assert.equal(one('<<~flows turn -> reads -> holds -> flushes>>\n'), '<<~flows name=`turn` path=`reads -> holds -> flushes`>>\n');
});

test('CONTROL: with the arrow rule off, the arrow fixture fails', () => {
  const off = cut('<<~ pranala #s from="?" -> to="lar:///a.b.c/y">>\n', { disable: ['arrow'] });
  assert.notEqual(off.text, '<<~ pranala slot=`#s` from=`?` to=`lar:///a.b.c/y`>>\n');
  assert.ok(off.refusals.some((r) => r.kind === 'arrow'));
});

test('an arrow inside a value stays', () => {
  assert.equal(one('<<~ loops "a -> b -> c">>\n'), '<<~ loops phases=`a -> b -> c`>>\n');
});

// The input carrier speaks the pre-cut grammar on purpose. Its declaration builds from the spec address,
// so type-parity reads it as a template the test composes, never as a second spelling of the authority.
const SPEC = 'lar:///ha.ka.ba/lares/api/pono/memetic-wikitext';
const CARRIER = [
  `<<!DOCTYPE "memetic-wikitext+tiddlywiki" "${SPEC}">>`,
  '',
  '<<^ code="&#x0001;" namespace="⊙" from="?" -> to="lar:///ha.ka.ba/x/y">>',
  '<<^ code="&#x0002;">>',
  '',
  '```toml meta',
  'title    = "lar:///ha.ka.ba/x/y"',
  'uri-path = "ha.ka.ba/x/y"',
  '```',
  '',
  '<<~ ahu #/head>>',
  'body',
  '<<~/ahu>>',
  '',
  '<<^ code="&#x0003;">>ni:///sha-256;AAAA',
  '',
  '<<^ code="&#x0004;" -> to="?">>',
  '',
].join('\n');

test('the envelope cuts: DOCTYPE names, ticked marks, arrows out, the toml block untouched, the seal re-minted', () => {
  const r = cut(CARRIER);
  const lines = r.text.split('\n');
  assert.equal(lines[0], '<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>');
  assert.equal(lines[2], '<<^ code=`&#x0001;` namespace=`⊙` from=`?` to=`lar:///ha.ka.ba/x/y`>>');
  assert.equal(lines[3], '<<^ code=`&#x0002;`>>');
  assert.equal(lines[6], 'title    = "lar:///ha.ka.ba/x/y"');
  assert.equal(lines[10], '<<~ ahu slot=`#/head`>>');
  assert.match(lines[14], /^<<\^ code=`&#x0003;`>>ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/);
  assert.equal(lines[16], '<<^ code=`&#x0004;` to=`?`>>');
  assert.equal(r.seal, 'ok');
});

test('Canon envelope-only: the head and foot cut, the body stays, and a body change counts as a red', () => {
  const r = cut(CARRIER, { envelopeOnly: true });
  assert.ok(r.text.includes('<<~ ahu #/head>>'));
  assert.ok(r.text.startsWith('<<!DOCTYPE type=`'));
  assert.equal(r.bodyChanges, 1);
  const clean = cut(CARRIER.replace('<<~ ahu #/head>>', '<<~ ahu slot=`#/head`>>'), { envelopeOnly: true });
  assert.equal(clean.bodyChanges, 0);
});

test('triple quotes, a held backtick, a bare named value, and the colon separator', () => {
  assert.equal(one('<<~ kue voice="""a "b" c""" key="k">>\n'), '<<~ kue voice=`a "b" c` key=`k`>>\n');
  assert.equal(one('<<~ kue voice="a `b` c" key="k">>\n'), '<<~ kue voice=```a `b` c``` key=`k`>>\n');
  assert.equal(one('<<~ saksi voice=Name scope="deposition">>\n'), '<<~ saksi voice=`Name` scope=`deposition`>>\n');
  assert.equal(one('<<~ kue voice:"Stranger" key:"k">>\n'), '<<~ kue voice=`Stranger` key=`k`>>\n');
});

test('a multi-line sigil keeps its line breaks', () => {
  assert.equal(one('<<~ kue voice="Map-Wisp"\n  key="a key">>\n'), '<<~ kue voice=`Map-Wisp`\n  key=`a key`>>\n');
});

test('a fenced example cuts; a sigil in an inline span widens the span', () => {
  assert.equal(one('```\n<<~ ahu #/x>>\n```\n'), '```\n<<~ ahu slot=`#/x`>>\n```\n');
  assert.equal(one('see `<<~ ahu #/x>>` here\n'), 'see ``<<~ ahu slot=`#/x`>>`` here\n');
  assert.equal(one('see `<<~ kue key="k">>` here\n'), 'see ``<<~ kue key=`k`>>`` here\n');
});

test('hazards list and never fix: substitution, a value a tick cannot hold, a nested call', () => {
  const sub = cut('<<~ kue voice="$(x)$" key="k">>\n');
  assert.equal(sub.text, '<<~ kue voice="$(x)$" key="k">>\n');
  assert.deepEqual(kinds(sub), ['substitution']);
  const edge = cut('<<~ kue voice="a`" key="k">>\n');
  assert.equal(edge.text, '<<~ kue voice="a`" key="k">>\n');
  assert.deepEqual(kinds(edge), ['tick-unsafe']);
});

test('an unsigned head and a prose voice tag list apart; neither is guessed', () => {
  const r = cut('<<~ zorblax "a">>\n<<~ operator ~ shivers>>\n');
  assert.equal(r.text, '<<~ zorblax "a">>\n<<~ operator ~ shivers>>\n');
  assert.deepEqual(kinds(r), ['prose-voice', 'unsigned']);
});

test('a param still named pN refuses', () => {
  const pctx = { ...ctx, sigs: { ...ctx.sigs, legacy: { params: ['p1', 'p2'], source: 'fixture' } } };
  const r = cutText('<<~ legacy "a">>\n', pctx, { rel: 'bags/x/f.mem' });
  assert.equal(r.text, '<<~ legacy "a">>\n');
  assert.deepEqual(kinds(r), ['pN']);
});

test('the oracle joins its blind throw into one value', () => {
  assert.equal(one('<<~ oracle ↯13 ✲ ⚃(4) "⁂:☕🎲🛰️🌊">>\n'), '<<~ oracle throw=`↯13 ✲ ⚃(4) ⁂:☕🎲🛰️🌊`>>\n');
});

test('a relation call whose params hold no has-value refuses', () => {
  const r = cut('<<~ mu Wand Sword>>\n');
  assert.equal(r.text, '<<~ mu Wand Sword>>\n');
  assert.deepEqual(kinds(r), ['not-has-values']);
});

test('Cut 4: the aim and the yield fold into set lares=, brackets in order; a lone gauge becomes a steer', () => {
  const turn = [
    '<<~ lares aim from="lar://a:op@x/op.asks.it" -> to="lar://b:ag@x/clerk.reads.it">>',
    '<<~ set hud="aim" mode="sketch" drift-ward="the pull" aperture="6/beat" ooda-ha="2/declare-aftermath">>',
    '',
    'Lares (Ink-Clerk): words.',
    '<<~ aperture "9/measure">>',
    '',
    '<<~ oracle ↯7 ✲ ⚁(2) "⁂:⌗🜄">>',
    '<<~ set hud="yield" aperture="6/beat -> 7/beat" drift-ward="the clue · ↻ L-Prime" ooda-ha="closed 0↺ -> open 1φ @◇:waits">>',
    '<<~ lares yield from="lar://b:ag@x/close.names.it" -> to="?">>',
    '',
  ].join('\n');
  const want = [
    '<<~ set lares=`aim` from=`lar://a:op@x/op.asks.it` to=`lar://b:ag@x/clerk.reads.it` mode=`sketch` aperture=`6/beat` ooda-ha=`2/declare-aftermath` drift-ward=`the pull`>>',
    '',
    'Lares (Ink-Clerk): words.',
    '<<~ set lares=`steer` aperture=`9/measure`>>',
    '',
    '<<~ oracle throw=`↯7 ✲ ⚁(2) ⁂:⌗🜄`>>',
    '<<~ set lares=`yield` drift-ward=`the clue · ↻ L-Prime` aperture=`6/beat -> 7/beat` ooda-ha=`closed 0↺ -> open 1φ◇:waits` from=`lar://b:ag@x/close.names.it` to=`?`>>',
    '',
  ].join('\n');
  const r = cut(turn);
  assert.equal(r.text, want);
  assert.deepEqual(r.refusals, []);
});

test('Cut 4: an old hud panel and a retired frame call list as unmappable', () => {
  const r = cut('<<~ hud Aperture(8) OODA-HA(3)>>\n<<~ frame set "move/x">>\n');
  assert.equal(r.text, '<<~ hud Aperture(8) OODA-HA(3)>>\n<<~ frame set "move/x">>\n');
  assert.deepEqual(kinds(r), ['turn-unmappable', 'turn-unmappable']);
});

test('Cut 2: planes rename, handles strip, the phase glyph fuses, scopes and unspaced at-signs stay', () => {
  assert.equal(one('the @daemon wiki and @circles-<tag>\n'), 'the daemon-plane wiki and circles-plane-<tag>\n');
  assert.equal(one('@lindwyrm@new-delos says\n'), 'lindwyrm@new-delos says\n');
  assert.equal(one('the @lararium bag\n'), 'the lararium bag\n');
  assert.equal(one('reads closed 0↺ -> open 1φ @_:why\n'), 'reads closed 0↺ -> open 1φ_:why\n');
  assert.equal(one('pnpm --filter @lararium/tw5 build; pulse@0..4; @keyframes x\n'), 'pnpm --filter @lararium/tw5 build; pulse@0..4; @keyframes x\n');
});

test('Cut 2: an unmapped at-name reds and names itself', () => {
  const r = cut('the @zeppelin plane\n');
  assert.equal(r.text, 'the @zeppelin plane\n');
  assert.deepEqual(r.unmapped, ['zeppelin']);
});

test('idempotence: a second run writes nothing', () => {
  const first = cut(CARRIER + '\nsee `<<~ ahu #/x>>` and the @daemon\n');
  const second = cut(first.text);
  assert.equal(second.text, first.text);
  assert.equal(second.changes, 0);
});

test('KNOWN POSITIVE: the census counts a fixture whose counts are known', () => {
  const c = censusText('<<~ pranala #s from="?" -> to="u">>\n<<~ ahu #/x>> <<~ kue voice="a" key="b">>\nthe @daemon and @lindwyrm@host; 1φ @◇:x\n', ctx);
  assert.deepEqual(
    { arrows: c.arrows, quotedNamed: c.quotedNamed, positional: c.positional, spacedAt: c.spacedAt, phase: c.phase },
    { arrows: 1, quotedNamed: 4, positional: 2, spacedAt: 2, phase: 1 });
  const zero = censusText('<<~ ahu slot=`#/x`>> the daemon-plane\n', ctx);
  assert.deepEqual({ arrows: zero.arrows, quotedNamed: zero.quotedNamed, positional: zero.positional, spacedAt: zero.spacedAt }, { arrows: 0, quotedNamed: 0, positional: 0, spacedAt: 0 });
});

test('the strip list and a slug over a slash: a voice loses its at-sign, a title prefix takes the bare slug', () => {
  assert.equal(one('> @salt-crust: kid.\n'), '> salt-crust: kid.\n');
  assert.equal(one('title: @sdm/tags/x\n'), 'title: sdm/tags/x\n');
});

test('Canon carriers touched but never cut leave the envelope-only list; the rest stay on it', () => {
  const canon = canonCarriers(REPO);
  assert.equal(canon.size, 15);
  for (const f of CANON_CUT_WHOLE) assert.ok(!canon.has(f), f);
});

test('a text that declares no carrier keeps its foot as written', () => {
  const body = CARRIER.split('\n').slice(2).join('\n');
  const r = cut(body);
  assert.ok(r.text.includes('ni:///sha-256;AAAA'));
  assert.equal(r.seal, 'none');
});

test('the hand-reviewed pass drops only the BEFORE check: an apostrophe chain cuts, the AFTER check still binds', () => {
  const src = "<<~moves kuleana/where -> the-vessel's-Place on/the-plane>>\n";
  assert.deepEqual(kinds(cut(src)), ['old-misread']);
  assert.equal(one(src, { handReviewed: true }), "<<~moves name=`kuleana/where` params=`the-vessel's-Place on/the-plane`>>\n");
});

test('a joined run keeps the quotes that held a space, and drops the ones that only shielded a token', () => {
  assert.equal(one('<<~ ward ! ⚠ 2 · "you are new here" · "fine" · ↻ L-Prime>>\n'), '<<~ ward pull=`! ⚠ 2 · "you are new here" · fine · ↻ L-Prime`>>\n');
});

test('Cut 5: every file-path meta line leaves, a quoted fence included; prose naming the key stays; the census counts it', () => {
  const src = '```toml meta\ncacheable = true\nfile-path = "bags/x/fixture.mem"\nmana      = 16\n```\n\n````text\n```toml meta\nfile-path = "..."\n```\n````\n\nthe `file-path` key retired\n';
  const r = cut(src);
  assert.equal(r.text, '```toml meta\ncacheable = true\nmana      = 16\n```\n\n````text\n```toml meta\n```\n````\n\nthe `file-path` key retired\n');
  assert.equal(r.counts.filePath, 2);
  assert.equal(censusText(src, ctx).filePath, 2);
  assert.equal(censusText(r.text, ctx).filePath, 0);
  // CONTROL: with the rule off the line stands, and a Canon carrier (envelope-only) still takes it.
  assert.match(cut(src, { disable: ['file-path'] }).text, /^file-path = "bags/m);
  assert.equal(cut(src, { envelopeOnly: true }).counts.filePath, 2);
  assert.equal(cut(r.text).changes, 0);
});

// ── The cold sweep's blind spots (Sweep-Wright, 2026-11-01) ──────────────────────────────────────
// A peer read the cut bags through VSCode and found calls the census had filed as hand-pass residue:
// a quoted value CITING a sigil (`<<~`) refused as a nested call, a retired head (`ranks`, folded to
// `scale`) filed as an unsigned placeholder, a whitespace-led bare `@` the at-name census never read,
// and inline code spans whose tick runs TiddlyWiki cannot pair. Each shape stands here with its control.

test('a `<<` inside a quoted value cites, never calls: the call cuts; a call fed a macro still refuses', () => {
  assert.equal(one('<<~ has Lock 1b "with our `<<~` overlay loaded">>\n'),
    '<<~ has entity=`Lock` name=`1b` params=```with our `<<~` overlay loaded```>>\n');
  assert.equal(one('<<~ scale ceiling "a ~ x -> b << c ~ y">>\n'), '<<~ scale name=`ceiling` ranks=`a ~ x -> b << c ~ y`>>\n');
  // A value an earlier pass closed at the cited `>>` lists: the call runs on past the match.
  const early = cut('<<~ scale instrument "the <<~…">> ranges are islands >>\n');
  assert.equal(early.text, '<<~ scale instrument "the <<~…">> ranges are islands >>\n');
  assert.deepEqual(kinds(early), ['nested']);
  // CONTROL: a bare `<<` between values is a call inside the call, and still lists.
  const nested = cut('<<~ scale ceiling a << c>>\n');
  assert.equal(nested.text, '<<~ scale ceiling a << c>>\n');
  assert.deepEqual(kinds(nested), ['nested']);
});

test('a renamed head (ranks, folded to scale) reds, never files as unsigned; a cited one in a code span stays out', () => {
  const r = cut('<<~ranks domain a ~ x -> b ~ y>>\n');
  assert.equal(r.text, '<<~ranks domain a ~ x -> b ~ y>>\n');
  assert.deepEqual(kinds(r), ['renamed']);
  assert.equal(censusText('<<~ranks domain a ~ x -> b ~ y>>\n', ctx).renamedHead, 1);
  const cited = 'the `<<~ranks` carrier, then <<~ ahu slot=`#/x`>>\n';
  assert.ok(!kinds(cut(cited)).includes('renamed'));
  assert.equal(censusText(cited, ctx).renamedHead, 0);
});

test('the census reads every whitespace-led at-sign, a bare one included; a code literal stays out', () => {
  const src = 'Loom-grounded @ 100+ turns; imago @ locus; a `x @ y` span\n\n```\n@<domain> members\n```\n';
  assert.equal(censusText(src, ctx).spacedAt, 2);
  assert.equal(censusText('<<~ scale name=`p` ranks=```a ~ `x` grounded @ 100 turns```>>\n', ctx).spacedAt, 1);
  assert.equal(censusText('Loom-grounded at 100+ turns; imago at locus\n', ctx).spacedAt, 0);
});

test('the tick law: an inline span opens and closes on one run of one or two ticks (TiddlyWiki pairs no other)', () => {
  const law = (s) => { const c = censusText(s, ctx); return { tickMismatch: c.tickMismatch, wideInline: c.wideInline }; };
  assert.deepEqual(law("# ''`lares kairos``'' against check set one\n"), { tickMismatch: 1, wideInline: 0 });
  assert.deepEqual(law("''And two faults reach `error''' (row 7): `a` and `b`.\n"), { tickMismatch: 1, wideInline: 0 });
  assert.deepEqual(law('a bare `` ```toml meta `` fence\n'), { tickMismatch: 1, wideInline: 0 });
  assert.deepEqual(law('A labelled ```` ```toml meta ```` fence\n'), { tickMismatch: 0, wideInline: 1 });
  assert.deepEqual(law('| `codeblock` | ``` fenced block |\n'), { tickMismatch: 0, wideInline: 1 });
  // CONTROLS: paired spans, a held tick in a double span, a span across a wrapped line, a sigil's
  // ticked values, and a four-tick block fence all read clean.
  assert.deepEqual(law('`a` and ``b ` c`` and ``<<~ kue key=`k`>>`` here\n'), { tickMismatch: 0, wideInline: 0 });
  assert.deepEqual(law('a span `wraps\nacross` a line\n'), { tickMismatch: 0, wideInline: 0 });
  assert.deepEqual(law('x <<~ has entity=`L` name=`n` params=```a `b` c```>> y\n'), { tickMismatch: 0, wideInline: 0 });
  assert.deepEqual(law('````text\n```toml meta\nx = 1\n```\n````\n'), { tickMismatch: 0, wideInline: 0 });
});

test('a cut that would widen an inline span past two ticks refuses: TiddlyWiki reads no wider delimiter', () => {
  const r = cut('see ``<<~ kue voice="a `b` c">>`` here\n');
  assert.equal(r.text, 'see ``<<~ kue voice="a `b` c">>`` here\n');
  assert.deepEqual(kinds(r), ['wide-span']);
});
