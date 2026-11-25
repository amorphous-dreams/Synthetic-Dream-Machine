/**
 * spirit-unfold — a tasked spirit reads AS A FOLDED CARRIER through the wiki's own engine: the carrier's grammar as the file
 * rests on disk, each folded slot standing as its `has` line and the one command that fetches it. Pulse folds every slot, beat
 * unfolds the entry, measure the attention and open slots too, theme the whole carrier.
 *
 * The fold filter and the macro ride the lares-lararium skin, so a wiki that loads the house folds its own records from its own
 * plugin; the suite boots that wiki and reads the render `lares wiki render --form text` gives.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { stampCarrier } from "@lararium/memetic-frame";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { SHRINE_SLOTS, shrineSource } from "@lararium/mesh/spirit-shrine";
import { UNFOLD_OPEN, UNFOLD_RANKS, cardRenderCommand, narrowerRank, recordCommand, shellWord, slotCommand, spiritCardOf, unfoldCall, unfoldRank, wholeCommand } from "@lararium/mesh/spirit-unfold";
import { commandLine, foldCarrier } from "../src/carrier-fold.js";
import { memeticWikitextDeserializer } from "../src/deserializer.js";
import { normalizeMemeSource } from "../src/meme-normalize.js";
import { carrierSlotText } from "../src/read-gradient.js";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, GLOBAL_IMPORT, wikiSkip, skipNote } from "./test-wiki.js";

const MEM = "lar:///ha.ka.ba/kahua/memory/";
function WORDS_OF(): string { return SHRINE_SLOTS.map(([slot, body]) => `<<~ ahu slot=\`${slot}\`>>\n\n${body}\n\n<<~/ahu>>`).join("\n\n"); }
const TEMPLATE = `${MEM}template/tasked-spirit`;
/** A shrine lands at the one address every spirit answers at. */
const SHRINE = "lar:///ha.ka.ba/lares/spirit/verb-wright";
/** A shrine that stood before the one address: the same carrier under its legacy title. */
const LEGACY = `${MEM}familiar/old-familiar`;
const LEGACY_CARRIER = stampCarrier(normalizeMemeSource(shrineSource("old-familiar", WORDS_OF(), CARRIER_TYPE).replaceAll("lar:///ha.ka.ba/lares/spirit/old-familiar", LEGACY).replaceAll("ha.ka.ba/lares/spirit/old-familiar", LEGACY.slice("lar:///".length))).text);
const ONE_FIELDS = "lar:///ha.ka.ba/lares/spirit/field-shaped";
const SLOTS = SHRINE_SLOTS.map(([slot]) => slot);
const WORDS = SHRINE_SLOTS.map(([slot, body]) => `<<~ ahu slot=\`${slot}\`>>\n\n${body}\n\n<<~/ahu>>`).join("\n\n");
/** A shrine as the spirit door lands one: the house normalize, then the block check. */
const CARRIER = stampCarrier(normalizeMemeSource(shrineSource("verb-wright", WORDS, CARRIER_TYPE)).text);
const records = (): Array<Record<string, string | string[]>> => memeticWikitextDeserializer(CARRIER, { title: SHRINE }) as Array<Record<string, string | string[]>>;

/** Canonical as `lares meme check` reads it: the normalize law moves nothing and names no fault. */
function canonical(text: string): void {
  const read = normalizeMemeSource(text);
  expect(read.faults, "normalize names a fault").toEqual([]);
  expect(read.text === text, `normalize moves the text: ${read.notes.join(" · ")}`).toBe(true);
}
const commandsIn = (text: string): string[] => [...text.matchAll(/^`(lares tiddler get \S+ --recipe default(?: --face \S+)? --meme --slot '[^']+')`$/gm)].map((m) => m[1]!);

describe.skipIf(wikiSkip)(`a spirit folds as a carrier by aperture${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => {
    e = await bootTestWiki({ tiddlers: [
      ...records(),
      ...(memeticWikitextDeserializer(LEGACY_CARRIER, { title: LEGACY }) as Array<Record<string, string | string[]>>),
      { title: "lar:///ha.ka.ba/lares/spirit/sealed-mask", pet: "sealed-mask", canon: "lar:///ha.ka.ba/elyncia/lindwyrm", hoard: "the true name of the hoard", sealed: "hoard", text: "a mask" },
      { title: ONE_FIELDS, pet: "field-shaped", lane: "a lane on the one record", tags: "lar:///spirit.lane.holds", description: "field-shaped: the one record as fields", text: `{{||${TEMPLATE}}}` },
      { title: TEMPLATE, text: "!! <$text text={{!!pet}}/> ~ a tasked spirit\n\n''Lane:'' {{!!lane}}" },
      { title: spiritCardOf("card-only"), pet: "card-only", lane: "a lane with no shrine", description: "card-only card: fields only", tags: "stage/spirit-card", text: `{{||${TEMPLATE}}}` },
    ] });
  }, 60_000);
  /** The render `wiki-render` gives a span: the global import, then the span, as plain text. */
  const r = (span: string): string => e.wiki.renderText("text/plain", "text/vnd.tiddlywiki", GLOBAL_IMPORT + span);
  const unfold = (pet: string, aperture: string, face?: string): string => r(unfoldCall(pet, aperture, face)!);

  test("CONTROL — the seeded shrine recomposes to the carrier the door landed", () => {
    expect(e.wiki.filterTiddlers(`[[${SHRINE}]meme-project[mem]]`)).toEqual([CARRIER]);
  });

  test("a shrine that stood before the one address still folds, and a field-shaped one record answers as a carrier", () => {
    const legacy = unfold("old-familiar", "pulse");
    canonical(legacy);
    expect(commandsIn(legacy)).toEqual(SLOTS.map((slot) => slotCommand(LEGACY, slot)));
    const fields = unfold("field-shaped", "pulse");
    canonical(fields);
    expect(fields).toContain(`to=\`${ONE_FIELDS}\``);
    expect(fields).toMatch(/^lane\s+= "a lane on the one record"$/m);
    expect(fields).toContain(commandLine(cardRenderCommand(ONE_FIELDS)));
  });

  test("a sealed hold names itself and nothing more: a sealed field folds to the word, a sealed slot to its name at every rank", () => {
    const mask = unfold("sealed-mask", "theme");
    canonical(mask);
    expect(mask).not.toContain("the true name of the hoard");
    expect(mask).toMatch(/^hoard\s+= "sealed"$/m);
    const text = foldCarrier(CARRIER, { open: () => true, sealed: (slot) => slot === "#/grant", buttons: () => ["a-button-no-sealed-slot-carries"] });
    canonical(text);
    expect(text).not.toContain("What it covers");
    expect(text).toContain("<<~ has name=`#/grant` params=`sealed/true`>>");
    expect(text).not.toContain("a-button-no-sealed-slot-carries");
  });

  test("pulse folds every slot: a canonical carrier, each slot its has line and one unfold command", () => {
    const text = unfold("verb-wright", "pulse");
    canonical(text);
    expect(text.startsWith("<<!DOCTYPE type=`memetic-wikitext+tiddlywiki`")).toBe(true);
    expect(text).toContain(`title     = "${SHRINE}"`);
    expect(commandsIn(text)).toEqual(SLOTS.map((slot) => slotCommand(SHRINE, slot)));
    for (const slot of SLOTS) expect(text).toMatch(new RegExp(`<<~ ahu slot=\`${slot}\`>>\\n\\n<<~ has name=\`${slot}\` params=\`bytes/\\d+ ~ [^\`]+\`>>\\n\\n\`lares`));
    expect(text).toContain(commandLine(wholeCommand(SHRINE)));
    expect(text).not.toContain("Quote them as given");
  });

  test("beat unfolds the entry slot byte for byte and folds the rest", () => {
    const text = unfold("verb-wright", "beat");
    canonical(text);
    expect(text).toContain(carrierSlotText(CARRIER, "#/entry")!);
    expect(commandsIn(text)).toEqual(SLOTS.filter((slot) => slot !== "#/entry").map((slot) => slotCommand(SHRINE, slot)));
  });

  test("measure unfolds the entry, attention and open slots", () => {
    const text = unfold("verb-wright", "measure");
    canonical(text);
    for (const slot of ["#/entry", "#/attention", "#/open"]) expect(text).toContain(carrierSlotText(CARRIER, slot)!);
    expect(commandsIn(text)).toEqual(SLOTS.filter((slot) => !["#/entry", "#/attention", "#/open"].includes(slot)).map((slot) => slotCommand(SHRINE, slot)));
  });

  test("arc unfolds measure plus #/instances, the path across turns, so a reader sees the spirit's lineage (ruling 2026-11-25-the-open-items-decided)", () => {
    const text = unfold("verb-wright", "arc");
    canonical(text);
    for (const slot of ["#/entry", "#/attention", "#/open", "#/instances"]) expect(text).toContain(carrierSlotText(CARRIER, slot)!);
    expect(commandsIn(text)).toEqual(SLOTS.filter((slot) => !["#/entry", "#/attention", "#/open", "#/instances"].includes(slot)).map((slot) => slotCommand(SHRINE, slot)));
  });

  test("theme unfolds every slot: each slot's span rides byte for byte and no slot command stands", () => {
    const text = unfold("verb-wright", "theme");
    canonical(text);
    for (const slot of SLOTS) expect(text).toContain(carrierSlotText(CARRIER, slot)!);
    expect(commandsIn(text)).toEqual([]);
  });

  test("a face named on the call rides every command", () => {
    const text = unfold("verb-wright", "pulse", "1");
    expect(commandsIn(text)).toEqual(SLOTS.map((slot) => slotCommand(SHRINE, slot, "1")));
    expect(text).toContain(commandLine(wholeCommand(SHRINE, "1")));
  });

  test("a shrine whose pet holds a card names the card and the command that renders it", () => {
    e.setTiddler({ title: spiritCardOf("verb-wright"), pet: "verb-wright", lane: "the verbs render", description: "verb-wright card: fields only", text: `{{||${TEMPLATE}}}` });
    const text = unfold("verb-wright", "pulse");
    canonical(text);
    expect(text).toContain(`<<~ has name=\`${spiritCardOf("verb-wright")}\` params=\`fields/3 ~ verb-wright card: fields only\`>>`);
    expect(text).toContain(commandLine(cardRenderCommand(spiritCardOf("verb-wright"))));
  });

  test("a card with no shrine folds as a carrier: its fields in the meta, the transclusion and its render command in the body", () => {
    const text = unfold("card-only", "measure");
    canonical(text);
    expect(text).toContain(`to=\`${spiritCardOf("card-only")}\``);
    expect(text).toMatch(/^lane\s+= "a lane with no shrine"$/m);
    expect(text).toMatch(/^pet\s+= "card-only"$/m);
    expect(text).toContain(`\n{{||${TEMPLATE}}}\n\n${commandLine(cardRenderCommand(spiritCardOf("card-only")))}\n`);
  });

  test("meme-fold folds any carrier by the slots its operand opens, and any plain record as a carrier", () => {
    const [folded] = e.wiki.filterTiddlers(`[[${SHRINE}]meme-fold[#/open #/instances],[1]]`);
    canonical(folded!);
    expect(folded).toContain(carrierSlotText(CARRIER, "#/open")!);
    expect(commandsIn(folded!)).toEqual(SLOTS.filter((slot) => !["#/open", "#/instances"].includes(slot)).map((slot) => slotCommand(SHRINE, slot, "1")));
    expect(commandsIn(e.wiki.filterTiddlers(`[[${SHRINE}]meme-fold[*]]`)[0]!)).toEqual([]);
    expect(commandsIn(e.wiki.filterTiddlers(`[[${SHRINE}#/open]meme-fold[]]`)[0]!)).toEqual(SLOTS.map((slot) => slotCommand(SHRINE, slot)));

    const HANDBACK = `${MEM}spirit/verb-wright-handback-0123456789ab`;
    const report = ["Verb-Wright: Lares (Tasked Spirit)", "", ...Array.from({ length: 40 }, (_, i) => `* line ${i} of a long report`)].join("\n");
    e.setTiddler({ title: HANDBACK, instance: "s-1", description: "the handback of instance s-1", text: report });
    const [message] = e.wiki.filterTiddlers(`[[${HANDBACK}]meme-fold[],[1]]`);
    canonical(message!);
    expect(message).toMatch(/^instance\s+= "s-1"$/m);
    expect(message).toContain(`<<~ has name=\`${HANDBACK}\` params=\`bytes/${new TextEncoder().encode(report).length} ~ the handback of instance s-1\`>>\n\n\`${recordCommand(HANDBACK, "1")}\``);
    expect(message).not.toContain("line 7 of a long report");
    expect(e.wiki.filterTiddlers("[[lar:///nobody.stands.here]meme-fold[]]")).toEqual([]);
  });

  test("a pet no record answers renders nothing", () => {
    expect(unfold("nobody", "beat")).toBe("");
  });

  test("the bare macro reads measure, and a malformed aperture or pet names the shape it reads", () => {
    expect(r('<<spirit-unfold pet:"verb-wright">>')).toBe(unfold("verb-wright", "measure"));
    expect(r('<<spirit-unfold pet:"verb-wright" aperture:"wide">>')).toContain("the aperture names one of pulse · beat · measure · arc · theme");
    expect(r('<<spirit-unfold pet:"Bad Name">>')).toContain("the pet name reads malformed");
  });
});

describe("the fold's pure core", () => {
  test("an aperture names its rank by word, by level, or by the gauge's pair", () => {
    expect(UNFOLD_RANKS.map((rank) => unfoldRank(rank))).toEqual([...UNFOLD_RANKS]);
    expect([0, 4, 5, 8, 9, 12, 13, 16, 17, 20].map((n) => unfoldRank(String(n)))).toEqual(["pulse", "pulse", "beat", "beat", "measure", "measure", "arc", "arc", "theme", "theme"]);
    expect(unfoldRank("10/measure")).toBe("measure");
    expect(unfoldRank(" Theme ")).toBe("theme");
    expect(["", "21", "3/theme", "wide", "10/", "-1", null, undefined].map((a) => unfoldRank(a))).toEqual(Array(8).fill(null));
  });

  test("each rank names the slots it unfolds, and each rank narrows one grain at a time", () => {
    expect(UNFOLD_OPEN).toEqual({ pulse: [], beat: ["#/entry"], measure: ["#/entry", "#/attention", "#/open"], arc: ["#/entry", "#/attention", "#/open", "#/instances"], theme: null });
    expect(UNFOLD_RANKS.map((rank) => narrowerRank(rank))).toEqual([null, "pulse", "beat", "measure", "arc"]);
  });

  test("the call a door sends names the rank and the face, and a malformed word answers none", () => {
    expect(unfoldCall("verb-wright", "10/measure")).toBe('<<spirit-unfold pet:"verb-wright" aperture:"measure">>');
    expect(unfoldCall("verb-wright", "pulse", "1")).toBe('<<spirit-unfold pet:"verb-wright" aperture:"pulse" face:"1">>');
    expect([unfoldCall("Bad Name", "beat"), unfoldCall("verb-wright", "wide"), unfoldCall("verb-wright", "beat", "a b")]).toEqual([null, null, null]);
  });

  test("every printed command quotes a word a shell would split or expand", () => {
    expect(shellWord("lar:///ha.ka.ba/kahua/memory/spirit/verb-wright")).toBe("lar:///ha.ka.ba/kahua/memory/spirit/verb-wright");
    expect(slotCommand("lar:///a.b.c/x", "#/open")).toBe("lares tiddler get lar:///a.b.c/x --recipe default --meme --slot '#/open'");
    const wild = "A title; rm -rf $HOME `id` it's";
    const quoted = `'A title; rm -rf $HOME \`id\` it'\\''s'`;
    expect(shellWord(wild)).toBe(quoted);
    expect([recordCommand(wild), wholeCommand(wild, "1"), slotCommand(wild, "#/x"), cardRenderCommand(wild)]).toEqual([
      `lares tiddler get ${quoted} --recipe default`,
      `lares tiddler get ${quoted} --recipe default --face 1 --meme --all`,
      `lares tiddler get ${quoted} --recipe default --meme --slot '#/x'`,
      `lares wiki render ${quoted} --recipe default --form text`,
    ]);
  });

  test("a fold keeps every byte outside a folded body and re-stamps the check", () => {
    const folded = foldCarrier(CARRIER, { open: (slot) => slot === "#/open", buttons: (slot) => [commandLine(`unfold ${slot.slot}`)] });
    canonical(folded);
    expect(folded).toContain(carrierSlotText(CARRIER, "#/open")!);
    expect(folded.slice(0, folded.indexOf("<<~ ahu"))).toBe(CARRIER.slice(0, CARRIER.indexOf("<<~ ahu")));
    expect(folded).toContain("`unfold #/instances`");
    expect(foldCarrier(CARRIER, { open: () => true, buttons: () => [] })).toBe(CARRIER);
    expect(foldCarrier("plain words", { open: () => false, buttons: () => [] })).toBe("plain words");
  });
});
