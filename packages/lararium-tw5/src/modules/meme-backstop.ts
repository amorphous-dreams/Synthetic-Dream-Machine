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
 *
 * ── THE FENCE IS A WRITE, AND A HEARTH WRITES ONLY WHERE IT KEEPS ─────────────────────────────────
 * Fencing commits the child's body back into the wiki, and the outbound shore carries that write into
 * the bag the cascade routes the child to. A child that arrived through the envelope from a bag this
 * hearth does not keep — `$origin-bag` (the nalu's stamp) names a bag the cascade never routes it to,
 * such as a read-only mounted library — is a peer's record: a fence over it would copy it up into
 * this hearth's own bag and shadow every later edit the peer makes there. So on such a child the
 * gate SURFACES only (the `quoteblocked` alert, naming that bag) and writes nothing; the fence waits
 * on the bag's keeper. A child this hearth wrote itself — no envelope stamp, or a stamp naming the
 * bag the cascade routes it to — is fenced: the fence commits as its stored body. Only a SLOT verdict
 * keeps: a stamped child the cascade withholds, or reaches by no rule, or a wiki with no readable
 * cascade at all, surfaces only.
 */

import { framedRootOf, placeMeme, evaluateMeme, readMeme, wikiMemeSink } from "../place-meme.js";
import type { MemeSink } from "../place-meme.js";
import { findAhuBalanceFaults } from "../meme-ast/ahu-scan.js";
import { routeBag } from "../bag-cascade.js";

type Changes = Record<string, { modified?: boolean; deleted?: boolean }>;

interface BackstopWiki {
  allTitles(): readonly string[];
  /** The cascade read (`keepsChild`): present on a real TW5 wiki, absent on a bare change bus. */
  getTiddlerText?(title: string, fallback?: string): string;
  filterTiddlers?(filter: string, widget?: unknown, source?: unknown): string[];
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

/**
 * The bag the cascade routes `title` to, or null when it routes it nowhere. A withholding and a gap
 * both answer null here, and rightly: either way no bag of this hearth's holds the title, so a
 * stamped child reads UNKEPT. (The island adaptor fills a gap at the write layer so a save never
 * vanishes; that rescue belongs to a save, never to this keep-check.)
 */
function cascadeBagOf(wiki: BackstopWiki, title: string): string | null {
  const v = routeBag(wiki, title);
  return v.kind === "slot" ? v.uri : null;
}

/**
 * Does this hearth keep the bag a child stands in? A child carrying no `$origin-bag` never arrived
 * through an envelope: this hearth wrote it. A stamped child is kept when the cascade routes its
 * title to that same bag — anywhere else, a write over it would copy it up into a bag of this
 * hearth's own. Answers the stamped bag when it is NOT kept, null when it is.
 */
function unkeptBagOf(wiki: BackstopWiki, child: string, fields: Record<string, unknown>): string | null {
  const stamped = fields["$origin-bag"];
  if (typeof stamped !== "string" || stamped === "") return null;
  return cascadeBagOf(wiki, child) === stamped ? null : stamped;
}

/** One composition fault found over a (simulated or real) composed-root render — the codes to report
 *  and the prose a reader sees. `null` from the grader below means the composition reads clean. */
interface ComposedFault { readonly codes: string[]; readonly why: string }

/**
 * Fence a child's stored body as a quoteblock the frame mask recognises — a backtick run strictly
 * longer than any backtick run already inside the body (so the body itself can never read as the
 * fence's own closer), with an info string so the fenced body reads as deliberately quoted rather
 * than an accidental code sample. The child's own identity (title, every other field) is untouched by
 * the caller — this returns only the new body text.
 */
export function fenceChildBody(body: string): string {
  let maxRun = 0;
  for (const run of body.match(/`+/g) ?? []) maxRun = Math.max(maxRun, run.length);
  const fence = "`".repeat(Math.max(3, maxRun + 1));
  return `${fence}text\n${body}\n${fence}`;
}

/** Lay the listener on one wiki. Titles under placement are held so a burst of changes runs each once. */
export function armBackstop(tw: TwBackstop, options: BackstopOptions = {}): void {
  const log = options.log ?? ((line: string) => { console.log(line); });
  const wiki = tw.wiki;
  const sink = wikiMemeSink(wiki as never);
  const inFlight = new Set<string>();
  const childGateInFlight = new Set<string>();
  // SELF-TERMINATION: the fence commit below is itself a write, which re-fires `change` on the SAME
  // child title. Remember exactly the fenced text this rail just wrote for a child; when that child's
  // next change event hands back that SAME text, it is this rail's own write settling, not a fresh
  // author edit — skip re-grading so the `quoteblocked` alert this write just raised is never clobbered
  // by the clean-composition leg clearing it a tick later. A genuine further edit (even re-fencing, even
  // unwrapping) never matches and resumes ordinary gating.
  const lastFenced = new Map<string, string>();

  // ONE GRADER, read twice below: once over the real composed root, once per candidate over a
  // SIMULATED composed root (the override sink hands back a hypothetical fenced body for exactly one
  // child, everything else reads through unchanged). Same codes, same prose, whichever altitude asks.
  const gradeComposedRoot = async (
    root: string, text: string, readSink: Pick<MemeSink, "titles" | "read"> = sink,
  ): Promise<ComposedFault | null> => {
    const receipt = await evaluateMeme({ uri: root, text }, readSink);
    if (receipt.grade === "error") {
      const codes = receipt.diagnostics.filter((d) => d.severity === "error").map((d) => d.code);
      const why = receipt.warnings[0] ?? receipt.diagnostics[0]?.message ?? "the carrier does not hold together";
      return { codes, why };
    }
    // WIDENING (#/quoteblock-floor, option (iv)): the Confluence gate's NOOP-equivalence leg grades
    // below error here even though an unclosed ahu or a stray closer corrupted the COMPOSED root —
    // the dangling opener eats the parent's closer, or the orphan closes the parent early. The
    // ahu-scan stack already knows both shapes; raise them on the SAME rail, at the SAME composed
    // altitude, without touching the root door gate's own ingest grades.
    const balanceFaults = findAhuBalanceFaults(text);
    if (balanceFaults.length > 0) {
      return { codes: [...new Set(balanceFaults.map((f) => f.code))], why: "the composed root's ahu blocks do not balance" };
    }
    return null;
  };

  // A read-through sink that answers one child's fields as a HYPOTHETICAL fenced body, everything
  // else exactly as the live sink reads it — lets the grader run over "what if THIS child were
  // fenced" without writing anything until a candidate actually heals the composition.
  const overrideOneChild = (child: string, fencedFields: Record<string, unknown>): Pick<MemeSink, "titles" | "read"> => ({
    titles: () => sink.titles(),
    read: (t) => (t === child ? (fencedFields as never) : sink.read(t)),
  });

  const runChildGate = (root: string, candidates: readonly string[]): void => {
    if (childGateInFlight.has(root)) return;
    childGateInFlight.add(root);
    (async () => {
      const render = await readMeme(root, sink);
      if (!render) { surfaceChildGateAlert(wiki, root, null); return; }
      const fault = await gradeComposedRoot(root, render.text);
      if (!fault) { surfaceChildGateAlert(wiki, root, null); return; }

      // ATTRIBUTION: several child saves can land in one change batch. Fence only the child whose
      // fencing HEALS the composition — evaluate the root with that one child fenced; a candidate
      // whose fence does not heal it was never the cause and must not be written.
      for (const child of candidates) {
        const fields = wiki.getTiddler(child)?.fields as Record<string, unknown> | undefined;
        if (!fields) continue;
        const fenced = fenceChildBody(String(fields["text"] ?? ""));
        const fencedFields = { ...fields, text: fenced };
        const overrideSink = overrideOneChild(child, fencedFields);
        const simRender = await readMeme(root, overrideSink);
        if (!simRender) continue;
        const simFault = await gradeComposedRoot(root, simRender.text, overrideSink);
        if (simFault) continue; // this candidate's fence did not heal it — never write it

        // Heals — but a fence is a write, and a peer's child on a bag this hearth does not keep is not
        // this hearth's to write: surface the finding with the bag named, and leave the body standing.
        const unkept = unkeptBagOf(wiki, child, fields);
        if (unkept !== null) {
          surfaceChildGateAlert(wiki, root, {
            child,
            codes: [...fault.codes, "quoteblocked"],
            why: `${fault.why}; fencing the body would heal it, but it stands in ${unkept}, a bag this hearth ` +
                 `does not keep — nothing was written, the fence waits on that bag's keeper`,
          });
          return;
        }

        // Heals: commit the fence as the child's stored body (the record's title and every other
        // field survive untouched; the `<<~ ahu #/slot>>` wrapper is synthesized at render by
        // expandRefs, never stored, so fencing this body cannot lose the slot).
        lastFenced.set(child, fenced);
        wiki.addTiddler(fencedFields);
        surfaceChildGateAlert(wiki, root, {
          child,
          codes: [...fault.codes, "quoteblocked"],
          why: `${fault.why}; the body is now fenced as a quoted block, inert until the operator unwraps it`,
        });
        return;
      }

      // No single candidate's fence healed it — raise the finding and write nothing.
      surfaceChildGateAlert(wiki, root, { child: candidates[candidates.length - 1] ?? root, codes: fault.codes, why: fault.why });
    })().finally(() => { childGateInFlight.delete(root); });
  };

  wiki.addEventListener("change", (changes) => {
    const childrenByRoot = new Map<string, string[]>();
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
        if (childRoot !== null) {
          const settledFence = lastFenced.get(title);
          if (settledFence !== undefined && String(fields["text"] ?? "") === settledFence) {
            lastFenced.delete(title);
          } else {
            const list = childrenByRoot.get(childRoot) ?? [];
            list.push(title);
            childrenByRoot.set(childRoot, list);
          }
        }
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
    for (const [root, children] of childrenByRoot) runChildGate(root, children);
  });
}

export function startup(options: BackstopOptions = {}): void {
  if (typeof $tw === "undefined" || !$tw?.wiki || typeof $tw.wiki.addEventListener !== "function") return;
  armBackstop($tw, options);
}
