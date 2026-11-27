/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/afford-face
type: application/javascript
module-type: startup
\*/
/**
 * afford-face — TW5 startup module publishing `$tw.lares.afford`, the console skin of every affordance carrier the wiki holds.
 *
 *   list(pattern?)            the carriers' addresses, a t2/t3 wildcard narrowing them (`oracle.*`; a t1 wildcard refuses)
 *   line(address)             the has-stack line through the console skin
 *   slot(address, slot)       one slot's lines (`#/takes`, `#/refuses`, …)
 *   whole(address)            every slot, in loop order
 *   routes()                  the routes the live stack spells (`routesOf`): per surface, spelling to address, and the
 *                             carrier each address reads from; a carrier a layer seats above canon moves them
 *
 * The read verbs RENDER the skin templates (`afford/skin/console`) against the carrier's own records, the one renderer the
 * bake runs, and print through the browser's own unfolding: `console.groupCollapsed` holds the lines and its header names
 * the call that opens the next depth. Each also returns its lines, so a node REPL reads the same bytes.
 *
 * A call runs through `$tw.lares.call` (the call startup), never here: one shape for every verb and address. Nothing here
 * reads a carrier field to admit (DAM law 1, witness W8): `gate` rows render as testimony and never branch.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/affordance
 */
import type { LaresAffordFace, LaresTw5Extension } from "../types/lares-globals.js";
import type { TW5Instance } from "../types/tiddlywiki.js";
import { AFFORDANCE_TAG, addressMatcher, addressOfTitle } from "../affordance-rows.js";
import { carrierOf, routesOf, type CarrierView } from "../affordance-read.js";

export const name        = "lararium-afford-face";
export const after       = ["startup"];
export const synchronous = true;

declare const $tw: (Partial<TW5Instance> & LaresTw5Extension) | undefined;

/** The skin template one surface renders through. */
export const AFFORD_SKIN_TEMPLATE = (surface: string): string => `lar:///ha.ka.ba/lararium/tw5/afford/skin/${surface}`;

type FaceWiki = Pick<TW5Instance["wiki"], "renderTiddler" | "getTiddler" | "filterTiddlers">;

/** The bare address (`oracle.library.consults`) a caller names, from either spelling. */
const bareOf = (address: string): string => address.replace(/^lar:\/\/\//, "").replace(/^ha\.ka\.ba\/[a-z0-9-]+\/afford\//, "");

/** The face over one wiki — exported so a test binds it to a wiki it constructs. `print` false keeps the console quiet. */
export function affordFaceOf(
  wiki: FaceWiki,
  opts: { print?: boolean } = {},
): LaresAffordFace {
  // AN ADDRESS RESOLVES THROUGH THE STACK (`carrierOf`): a bare-root record in any layer wins, else the stable seat
  // (`lar:///ha.ka.ba/<bag>/afford/<address>`), else a carrier that tags the address; the topmost layer answers each title.
  const carriers: CarrierView = {
    has: (title) => wiki.getTiddler(title) !== undefined,
    tagged: (address) => wiki.filterTiddlers(`[all[shadows+tiddlers]tag[${AFFORDANCE_TAG}]tag[${address}]!is[draft]]`),
  };
  const titleOf = (address: string): string => carrierOf(carriers, bareOf(address)) ?? `lar:///${bareOf(address)}`;
  const render = (address: string, depth: string, slot = ""): string[] =>
    wiki.renderTiddler("text/plain", AFFORD_SKIN_TEMPLATE("console"), {
      variables: { currentTiddler: titleOf(address), depth, slot },
    }).split("\n").filter((l, i, all) => !(l === "" && i === all.length - 1));
  const show = (header: string, lines: readonly string[]): void => {
    if (opts.print === false || typeof console === "undefined") return;
    const c = console as Console & { groupCollapsed?: (h: string) => void; groupEnd?: () => void };
    if (typeof c.groupCollapsed !== "function") { for (const l of lines) console.log(l); return; }
    c.groupCollapsed(header);
    for (const l of lines) console.log(l);
    c.groupEnd?.();
  };
  const bare = bareOf;
  return {
    list: (pattern) => {
      const match = pattern ? addressMatcher(pattern) : () => true;
      // A carrier at the bare root and the canon seat beneath it name one address: it lists once.
      return [...new Set(wiki.filterTiddlers(`[all[shadows+tiddlers]tag[${AFFORDANCE_TAG}]!is[draft]sort[]]`)
        .map((t) => addressOfTitle(t)).filter((a): a is string => a !== null && match(a)).map(bare))].sort();
    },
    line: (address) => {
      const lines = render(address, "line");
      show(`${bare(address)} · open: $tw.lares.afford.whole(${JSON.stringify(bare(address))})`, lines);
      return lines.join("\n");
    },
    slot: (address, slot) => {
      const lines = render(address, "slot", slot.startsWith("#/") ? slot : `#/${slot}`);
      show(`${bare(address)}${slot.startsWith("#/") ? slot : `#/${slot}`}`, lines);
      return lines;
    },
    whole: (address) => {
      const lines = render(address, "whole");
      show(`${bare(address)} (whole)`, lines);
      return lines;
    },
    routes: () => {
      const textOf = (title: string): string | undefined => {
        const fields = (wiki.getTiddler(title) as { fields?: Record<string, unknown> } | undefined)?.fields;
        return fields === undefined ? undefined : String(fields["text"] ?? "");
      };
      return routesOf(textOf, wiki.filterTiddlers("[all[shadows+tiddlers]prefix[lar:///]!is[draft]]"), carriers);
    },
  };
}

export function startup(): void {
  if (!$tw?.wiki) return;
  $tw.lares ??= {};
  $tw.lares.afford = affordFaceOf($tw.wiki as unknown as FaceWiki);
}
