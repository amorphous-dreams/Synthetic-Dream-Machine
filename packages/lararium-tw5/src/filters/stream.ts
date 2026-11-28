/*\
title: lar:///ha.ka.ba/lararium/tw5/filters/stream
type: application/javascript
module-type: filteroperator
\*/
/**
 * stream — THE LOG GRAPH'S TWO READS, as filter operators in the wiki VM (lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts
 * landing 15):
 *
 *   [lares.heads[]]                    each stream's heads: an entry no other entry of its stream names as `prev`
 *   [lares.heads[lares-alpha#00003]]   one stream's heads; two read a fork
 *   [lares.inbox[lares-alpha#00003]]   entries addressed to that instance or its entity that no entry of its stream names in `re`
 *   [lares.inbox[lares-alpha]]         entries addressed to the entity or any instance, unseen by every instance's stream
 *
 * Each reads its input titles (the whole wiki where the operator opens a run) as the candidates, and the whole wiki it runs on
 * as the graph, so a narrowed input (`[prefix[…]lares.heads[]]`) still reads every `prev` and `re` that names a candidate. At
 * the tiddler door the wiki holds the caller's view alone, so an entry behind another face's wall names nothing and counts for
 * nothing. `!` answers the input the operator would drop. No clock and no `modified` sort decides an answer
 * (`stream-entries`, the leaf the msg door reads too).
 *
 * ORDINARY MODULES: a layer re-seats either operator by seating a module tiddler at this title, as it re-seats any module
 * (comms-ux-enacts fork 16, mutability at the root).
 *
 * Meme: lar:///ha.ka.ba/lares/afford/engine.msg.lands
 */
import type { TW5FilterOperator, TW5FilterSource, TW5Wiki } from "../types/tiddlywiki.js";
import { entryOf, headsOf, inboxOf, type StreamEntry } from "../stream-entries.js";

type Fields = Readonly<Record<string, unknown>>;

/** Every entry the wiki holds, read once per operator run. */
function graphOf(wiki: TW5Wiki): StreamEntry[] {
  const out: StreamEntry[] = [];
  wiki.each((tiddler, title) => { const entry = entryOf(title, tiddler.fields as Fields); if (entry !== null) out.push(entry); });
  return out;
}

/** The input as entries, beside every input title (for `!`). */
function inputOf(source: TW5FilterSource, wiki: TW5Wiki): { titles: string[]; entries: StreamEntry[] } {
  const titles: string[] = [];
  const entries: StreamEntry[] = [];
  source((tiddler, title) => {
    titles.push(title);
    const entry = entryOf(title, (tiddler ?? wiki.getTiddler(title))?.fields as Fields | undefined);
    if (entry !== null) entries.push(entry);
  });
  return { titles, entries };
}

/** The answer, or under `!` the input titles it leaves out. */
const answered = (operator: TW5FilterOperator, titles: readonly string[], picked: readonly string[]): string[] => {
  if (operator.prefix !== "!") return [...picked];
  const held = new Set(picked);
  return titles.filter((title) => !held.has(title));
};

function heads(source: TW5FilterSource, operator: TW5FilterOperator, options: { wiki: TW5Wiki }): string[] {
  const { titles, entries } = inputOf(source, options.wiki);
  const stream = (operator.operand || "").trim();
  return answered(operator, titles, headsOf(entries, graphOf(options.wiki), stream === "" ? null : stream));
}

function inbox(source: TW5FilterSource, operator: TW5FilterOperator, options: { wiki: TW5Wiki }): string[] {
  const { titles, entries } = inputOf(source, options.wiki);
  const me = (operator.operand || "").trim();
  // AN INBOX NAMES ITS READER: no operand reads no one's, an empty answer rather than every entry addressed anywhere.
  return answered(operator, titles, me === "" ? [] : inboxOf(entries, graphOf(options.wiki), me));
}

export { heads as "lares.heads", inbox as "lares.inbox" };
