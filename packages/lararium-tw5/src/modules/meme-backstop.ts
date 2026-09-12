/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/meme-backstop
type: application/javascript
module-type: startup
\*/
/**
 * meme-backstop — a framed meme root that landed by ANY door gets the placement law run over it.
 *
 * THE TWO DOORS, the third layer. The native door refuses a framed root (`routes/native-door`) and
 * the client charm routes one to `/memes/` (`modules/meme-door-charm`); this listener stands behind
 * both for every door neither sees — a route this plugin never shadowed, a command, an import, a
 * write from another module. It reads the wiki's `change` bus: a modified record `framedRootOf` names
 * runs through `placeMeme` under its own title and lands as its records, and ONE line logs it:
 *
 *   [memetic-wikitext] re-stamped <uri> (landed via <door>)
 *
 * The door reads as far as the wiki can see it — a title `$tw.boot.files` names came from the wiki
 * folder; anything else is a native write. A root that entered through `/memes/` stands split
 * already (no head in its text) and never matches. A root the gate refuses stays as it landed, the
 * line naming the refusal; nothing loops — the placement's own writes carry no head.
 *
 * Node only: the server wiki is where an unstamped landing persists; a browser client's saves cross
 * the charm first.
 */

import { framedRootOf, placeMeme, wikiMemeSink } from "../place-meme.js";

type Changes = Record<string, { modified?: boolean; deleted?: boolean }>;

interface BackstopWiki {
  allTitles(): readonly string[];
  getTiddler(title: string): { fields?: Record<string, unknown> } | undefined;
  addTiddler(fields: Record<string, unknown>): void;
  deleteTiddler(title: string): void;
  addEventListener(type: "change", listener: (changes: Changes) => void): void;
}

interface TwBackstop {
  wiki: BackstopWiki;
  boot?: { files?: Record<string, unknown> };
}

// `$tw` reaches a sandboxed module as a wrapper PARAMETER, never as a property of `globalThis`.
declare const $tw: TwBackstop | undefined;

export const name = "lararium-meme-backstop";
export const platforms = ["node"];
export const after = ["startup"];
export const synchronous = true;

export interface BackstopOptions {
  /** Where the one line goes; `console.log` stands by default. */
  readonly log?: (line: string) => void;
}

/** Lay the listener on one wiki. Titles under placement are held so a burst of changes runs each once. */
export function armBackstop(tw: TwBackstop, options: BackstopOptions = {}): void {
  const log = options.log ?? ((line: string) => { console.log(line); });
  const wiki = tw.wiki;
  const sink = wikiMemeSink(wiki as never);
  const inFlight = new Set<string>();
  wiki.addEventListener("change", (changes) => {
    for (const title of Object.keys(changes)) {
      if (!changes[title]?.modified || inFlight.has(title)) continue;
      const fields = wiki.getTiddler(title)?.fields;
      if (!fields || framedRootOf(fields) === null) continue;
      const door = tw.boot?.files && Object.prototype.hasOwnProperty.call(tw.boot.files, title) ? "the wiki folder" : "a native write";
      inFlight.add(title);
      placeMeme({ uri: title, text: String(fields["text"] ?? "") }, sink).then((receipt) => {
        if (receipt.decision === "ingest") {
          log(`[memetic-wikitext] re-stamped ${title} (landed via ${door})`);
        } else if (receipt.decision !== "noop") {
          const why = receipt.reason ?? receipt.warnings[0] ?? receipt.diagnostics[0]?.message ?? receipt.decision;
          log(`[memetic-wikitext] refused to re-stamp ${title} (landed via ${door}): ${why}`);
        }
      }, (err: unknown) => {
        log(`[memetic-wikitext] refused to re-stamp ${title} (landed via ${door}): ${err instanceof Error ? err.message : String(err)}`);
      }).finally(() => { inFlight.delete(title); });
    }
  });
}

export function startup(options: BackstopOptions = {}): void {
  if (typeof $tw === "undefined" || !$tw?.wiki || typeof $tw.wiki.addEventListener !== "function") return;
  armBackstop($tw, options);
}
