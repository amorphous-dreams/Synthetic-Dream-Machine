/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/import-floor-upgrader
type: application/javascript
module-type: upgrader
\*/
/**
 * import-floor-upgrader — the quoteblock floor, made visible where TiddlyWiki's own import doors land.
 *
 * Import, drag-drop, paste and the boot-folder load all read a carrier through the registered
 * `text/memetic-wikitext+tiddlywiki` deserializer, which lays the floor (`ahu.mem#/quoteblock-floor`)
 * and holds a torn frame verbatim. Import and drop then stage every incoming record in `$:/Import` for
 * the operator to review, and TiddlyWiki hands that staging to every `upgrader` module: a message an
 * upgrader answers for a title stands beside that title in the import listing (`message-<title>`).
 *
 * So the fence speaks there, before anything lands. A fenced carrier names the faults its fence holds;
 * a torn carrier names the frame faults it was held verbatim under. Nothing is unchecked or changed —
 * the operator reads the account and decides; an upgrader that edited the payload would decide for them.
 */

import { QUOTEBLOCKED_FIELD, TORN_FIELD } from "../deserializer.js";

/** TiddlyWiki's upgrader contract: incoming titles and their fields in, a message per title out. */
export function upgrade(
  _wiki: unknown,
  titles: readonly string[],
  tiddlers: Readonly<Record<string, Readonly<Record<string, unknown>> | undefined>>,
): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const title of titles) {
    const fields = tiddlers[title];
    if (!fields) continue;
    const torn = fields[TORN_FIELD];
    const fenced = fields[QUOTEBLOCKED_FIELD];
    if (typeof torn === "string" && torn !== "") {
      messages[title] = `Torn frame — held verbatim as plain text, never read as a meme: ${torn}`;
    } else if (typeof fenced === "string" && fenced !== "") {
      messages[title] = `Quoteblocked — ${fenced}`;
    }
  }
  return messages;
}
