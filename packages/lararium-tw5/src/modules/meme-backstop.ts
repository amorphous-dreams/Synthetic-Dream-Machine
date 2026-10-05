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
 *
 * ── SEAM (b), THE FORWARD PATH: a child-slot save is gated too, but only to SURFACE, never to land
 * or refuse ──────────────────────────────────────────────────────────────────────────────────────
 * `framedRootOf` answers null for a slot child BY DESIGN (the root law) — `routes/native-door-gate`
 * and `modules/meme-door-charm` both read that null the same way and let the child's bytes stand
 * exactly as written, which is correct: a child's save never refuses on the stock syncer path. But
 * "ungated" left a real hole — a child can carry a stray ETX, an unclosed `ahu`, a whole pasted frame,
 * and nothing anywhere re-reads the ROOT the child just moved to see whether the carrier it composes
 * still holds together.
 *
 * This listener closes that hole WITHOUT touching the standing law above: on a child-slot title
 * (`uri#/slot…`), it resolves the ROOT, reads the root's CURRENT recomposed render (the child's new
 * bytes already live in the sink by the time `change` fires), and runs that render back through
 * `evaluateMeme` — the Confluence gate's read half, which grades the text but never lands or
 * tombstones anything. An `error`-graded verdict raises a `$:/tags/Alert` tiddler naming the child,
 * the root, and the diagnostic codes; a clean one clears any alert this root already carries. The
 * child's own record is never touched by this path — refusing it is what the ruling forbids.
 *
 * THE ALERT RAIL IS ITS OWN SURFACE (`surfaceChildGateAlert`), exported rather than folded into this
 * listener's closure, because `evaluateMeme`'s diagnostics are not the only finding a child's save
 * can earn — the quoteblock-floor fence-on-write check (own ruling, follow-up hand) grades the SAME
 * composed root for unbalanced `ahu` openers/closers the Confluence gate today only drops as
 * info/warning. One root, one coalesced alert, one rail: both checks raise or clear it through this
 * function rather than each growing a parallel notice.
 */

import { framedRootOf, placeMeme, evaluateMeme, readMeme, wikiMemeSink } from "../place-meme.js";

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

/** TW5's built-in alert tag — tiddlers carrying it surface in the alerts area. Same shape as the
 *  reboot-pending / engine-waiting alerts (`wiki-behavior.ts`, `engine-watch.ts`), written directly
 *  through this module's own `wiki` rather than `ctx.composite.put` — this listener runs below the
 *  island layer and never holds a composite handle. */
const TW5_ALERT_TAG = "$:/tags/Alert";

/** A child-slot title — `uri#/slot…` — answers its root; everything else (a root itself, a plain
 *  tiddler, a `uri/path` child) answers null. Root law stays `isMemeRoot`/`framedRootOf`'s alone;
 *  this is a narrower, local read of the ONE shape this listener widens past them. */
function childSlotRootOf(title: string): string | null {
  const at = title.indexOf("#/");
  return at < 0 ? null : title.slice(0, at);
}

/** The one coalesced alert a root's child-gate carries — stable per root, so a burst of child saves
 *  (or a second check grading the same root, see below) updates one tiddler rather than piling up a
 *  new one each time. Exported so a follow-up check can name the same slot without re-deriving it. */
export function childGateAlertTitle(root: string): string {
  return `$:/temp/lares/alert/meme-child-gate/${root}`;
}

/** One finding this rail can raise: the child whose save earned it, and the codes + message a
 *  reader should see. `null` clears whatever this root's alert currently carries. */
export interface ChildGateFinding {
  readonly child: string;
  readonly codes: readonly string[];
  readonly why: string;
}

/**
 * THE RAIL every child-gate check shares — `runChildGate` below calls it with `evaluateMeme`'s
 * verdict, and the quoteblock-floor's fence-on-write check (follow-up hand) calls it with its own
 * unbalanced-`ahu` finding over the SAME root. One coalesced alert per root; the LAST call standing
 * wins the slot, same as any other `$:/temp/…` alert in this house (`REBOOT_ALERT_TITLE`,
 * `ENGINE_WAITING_ALERT_TITLE`). Never lands or refuses anything — this is surfacing, not gating.
 */
export function surfaceChildGateAlert(wiki: BackstopWiki, root: string, finding: ChildGateFinding | null): void {
  const alertTitle = childGateAlertTitle(root);
  if (!finding) { wiki.deleteTiddler(alertTitle); return; }
  const codes = finding.codes.join(", ");
  wiki.addTiddler({
    title: alertTitle,
    text: `${finding.child} moved ${root} out of frame (${codes}): ${finding.why}`,
    tags: TW5_ALERT_TAG,
    "alert-kind": "meme-child-gate",
    root,
    child: finding.child,
    codes,
    ts: new Date().toISOString(),
  });
}

/** Lay the listener on one wiki. Titles under placement are held so a burst of changes runs each once. */
export function armBackstop(tw: TwBackstop, options: BackstopOptions = {}): void {
  const log = options.log ?? ((line: string) => { console.log(line); });
  const wiki = tw.wiki;
  const sink = wikiMemeSink(wiki as never);
  const inFlight = new Set<string>();
  const childGateInFlight = new Set<string>();

  const runChildGate = (root: string, childTitle: string): void => {
    if (childGateInFlight.has(root)) return;
    childGateInFlight.add(root);
    (async () => {
      const render = await readMeme(root, sink);
      if (!render) { surfaceChildGateAlert(wiki, root, null); return; }
      const receipt = await evaluateMeme({ uri: root, text: render.text }, sink);
      if (receipt.grade !== "error") { surfaceChildGateAlert(wiki, root, null); return; }
      const codes = receipt.diagnostics.filter((d) => d.severity === "error").map((d) => d.code);
      const why = receipt.warnings[0] ?? receipt.diagnostics[0]?.message ?? "the carrier no longer holds together";
      surfaceChildGateAlert(wiki, root, { child: childTitle, codes, why });
    })().finally(() => { childGateInFlight.delete(root); });
  };

  wiki.addEventListener("change", (changes) => {
    for (const title of Object.keys(changes)) {
      if (!changes[title]?.modified || inFlight.has(title)) continue;
      const fields = wiki.getTiddler(title)?.fields;
      if (!fields) continue;

      const root = framedRootOf(fields);
      if (root === null) {
        // Not a framed root — the ONE other shape this listener reads is a child-slot save, which
        // never lands and never refuses here; it only re-grades the root it belongs to and surfaces
        // what it finds. `framedRootOf` already answered null for this title BY DESIGN (the root
        // law), so a child-slot title reaching here is exactly the hole seam (b) names.
        const childRoot = childSlotRootOf(title);
        if (childRoot !== null) runChildGate(childRoot, title);
        continue;
      }

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
