/*\
title: lar:///ha.ka.ba/lararium/tw5/filters/meme-fold
type: application/javascript
module-type: filteroperator
\*/
/**
 * meme-fold — ANY RECORD AS A FOLDED CARRIER, from inside a filter: the carrier's own grammar as the file rests on disk, each
 * fold standing as its `has` line and the one command that fetches what it folds.
 *
 *   [[<uri>]meme-fold[<open slots>],[<face>]]       any meme root or plain record
 *   [[<pet>]spirit-fold[<rank>],[<face>]]           a tasked spirit, the open slots named by an aperture rank
 *
 * `meme-fold` reads the record out of the wiki that holds it. A meme root recomposes through the house's own recompose and
 * folds every slot the first operand leaves out (slot names, space-joined; `*` unfolds every slot; empty folds them all); the
 * carrier's own `has` line and its whole-read command lead the slots. A plain record answers as a carrier too: its fields ride
 * the meta, a short text rides whole (a transclusion stays a transclusion, folded and renderable), and a longer one folds to
 * its `has` line and the command that reads the record. So one render serves a shrine, a card, a handback record and any
 * message one stream of thought sends another.
 *
 * `spirit-fold` folds a pet's shrine (`familiar/<pet>` or `spirit/<pet>`) at the rank its operand names, naming the pet's card
 * (`spirit-card/<pet>`) and its render command in the lead where one stands; a pet holding a card and no shrine answers the
 * card as a carrier, its render command beneath the transclusion.
 *
 * The second operand names the face the commands carry (`--face <n>`); empty, they name none. A title no record answers yields
 * nothing; a `spirit-fold` operand naming no rank THROWS (an operator answering empty for a typo would read as no record).
 *
 * The laws ride shared: the commands and the rank's open slots from `@lararium/mesh/spirit-unfold`, the fold from
 * `carrier-fold`, the recompose from the deserializer, the check from the frame writer.
 */
import type { TW5FilterOperator, TW5FilterSource, TW5Wiki } from "../types/tiddlywiki.js";
import { CARRIER_TYPE, isCarrierType } from "@lararium/mesh/carrier-type";
import {
  FOLD_OPERATOR, UNFOLD_RANKS, cardRenderCommand, isFaceWord, isPetName, recordCommand, slotCommand, spiritCardOf, spiritShrinesOf,
  unfoldRank, unfoldsSlot, wholeCommand,
} from "@lararium/mesh/spirit-unfold";
import { commandLine, foldCarrier } from "../carrier-fold.js";
import { expandMemeRefs, type TiddlerFields } from "../deserializer.js";
import { byteLength, hasLine, param } from "../has-line.js";

type Reader = (title: string) => TiddlerFields | undefined;
interface FoldAsk {
  readonly open: (slot: string) => boolean;
  readonly face: string | null;
  /** Lines the caller seats in the lead (a carrier) or beneath the text (a plain record). */
  readonly more?: readonly string[];
}

/** A plain record's text at or under this many bytes rides whole; past it the text folds. */
export const FOLD_WHOLE_BYTES = 256;

const word = (fields: TiddlerFields, key: string): string | null => (typeof fields[key] === "string" && fields[key] !== "" ? (fields[key] as string) : null);
const firstLine = (text: string): string | null => text.split("\n").map((line) => line.trim()).find((line) => line !== "") ?? null;

/** A meme root folded: the slots the ask leaves out stand as their `has` lines and commands. Null where the title roots no carrier. */
function foldMeme(reader: Reader, uri: string, ask: FoldAsk): string | null {
  const whole = expandMemeRefs(reader, uri);
  if (whole === null) return null;
  const root = reader(uri) ?? {};
  return foldCarrier(whole, {
    open: ask.open,
    buttons: (slot) => [commandLine(slotCommand(uri, slot.slot, ask.face))],
    lead: (slots) => [
      hasLine(uri, [param("slots", slots.length), param("folded", slots.filter((s) => !ask.open(s.slot)).length)], word(root, "role") ?? word(root, "description")),
      commandLine(wholeCommand(uri, ask.face)),
      ...(ask.more ?? []),
    ],
  });
}

/** A plain record as a carrier: the fields in the meta; a short text whole, a longer one folded to its `has` line and read command. */
function foldPlain(reader: Reader, uri: string, ask: FoldAsk): string | null {
  const fields = reader(uri);
  if (!fields || isCarrierType(fields.type)) return null;
  const text = String(fields["text"] ?? "").trim();
  const kept = byteLength(text) <= FOLD_WHOLE_BYTES
    ? (text === "" ? [] : [text])
    : [hasLine(uri, [param("bytes", byteLength(text))], word(fields, "description") ?? firstLine(text)), commandLine(recordCommand(uri, ask.face))];
  const body = [...kept, ...(ask.more ?? [])].join("\n\n");
  return expandMemeRefs((title) => (title === uri ? { ...fields, type: CARRIER_TYPE, text: body } : reader(title)), uri);
}

const readerOf = (wiki: TW5Wiki): Reader => (title) => (wiki.getTiddler(title) as { fields?: TiddlerFields } | undefined)?.fields;
const faceOf = (operator: TW5FilterOperator): string | null => {
  const named = ((operator.operands[1] as unknown as string) || "").trim();
  return named !== "" && isFaceWord(named) ? named : null;
};

export function memeFold(source: TW5FilterSource, operator: TW5FilterOperator, options: { wiki: TW5Wiki }): string[] {
  const named = (operator.operand || "").split(/\s+/).filter((slot) => slot !== "");
  const ask: FoldAsk = { open: (slot) => named.includes("*") || named.includes(slot), face: faceOf(operator) };
  const reader = readerOf(options.wiki);
  const results: string[] = [];
  source((_tiddler, title: string) => {
    const root = title.split("#")[0]!;
    const folded = foldMeme(reader, root, ask) ?? foldPlain(reader, root, ask);
    if (folded !== null) results.push(folded);
  });
  return results;
}

export function spiritFold(source: TW5FilterSource, operator: TW5FilterOperator, options: { wiki: TW5Wiki }): string[] {
  const rank = unfoldRank(operator.operand || "measure");
  if (rank === null) throw new Error(`${FOLD_OPERATOR}: "${operator.operand}" names no aperture; operands: ${UNFOLD_RANKS.join(" · ")}`);
  const face = faceOf(operator);
  const reader = readerOf(options.wiki);
  const results: string[] = [];
  source((_tiddler, pet: string) => {
    if (!isPetName(pet)) return;
    const card = spiritCardOf(pet);
    const held = reader(card);
    const render = commandLine(cardRenderCommand(card, face));
    const names = held ? Object.keys(held).filter((k) => k !== "title" && k !== "text" && k.charAt(0) !== "$") : [];
    const cardLead = held ? [hasLine(card, [param("fields", names.length)], word(held, "description")), render] : [];
    const open = (slot: string): boolean => unfoldsSlot(rank, slot);
    let folded: string | null = null;
    for (const uri of spiritShrinesOf(pet)) {
      folded = foldMeme(reader, uri, { open, face, more: cardLead });
      if (folded !== null) break;
    }
    folded ??= held ? foldPlain(reader, card, { open, face, more: [render] }) : null;
    if (folded !== null) results.push(folded);
  });
  return results;
}

export { memeFold as "meme-fold", spiritFold as "spirit-fold" };
