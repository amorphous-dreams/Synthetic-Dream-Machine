/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/meme-project
type: application/javascript
module-type: library
\*/
/**
 * meme-project — a meme root projects to a TARGET through a TEMPLATE.
 *
 * ── ONE LAW BEHIND EVERY DOOR ───────────────────────────────────────────────────────────────────
 * `tiddlywiki --render '[[lar:///…]]' out.mem text/plain <template>` renders a template with
 * `currentTiddler` bound to the root and writes the text. The in-VM face (`$tw.lares.meme.project`),
 * the daemon reactor (`meme-project`) and the Export dropdown reach the SAME templates, so what the
 * CLI gets and what a stock server writes to disk are one set of bytes.
 *
 * ── THE TARGETS ─────────────────────────────────────────────────────────────────────────────────
 *   mem   the recomposed carrier (`expandMemeRefs`) — children spliced whole, the block check adjacent
 *   md    the submission pair (`projectSubmission`) — a markdown body and its `.md.meta` sidecar
 *   html  the house static render of the root (`lar:///ha.ka.ba/lararium/templates/meme/html`) — the
 *         core's static frame around the root's title and body ALONE. The core's own
 *         `static.tiddler.html` renders the `$:/tags/ViewTemplate` cascade, and a vended view template
 *         (the streams plugin's) reaches `window` through a browser-platform library, which no worker
 *         holds. A meme projects itself, never the wiki's UI cascade, so one template renders the same
 *         in the island, the browser and a plain server.
 *   tid   TiddlyWiki's own `.tid` serializer over the root record (`$:/core/templates/tid-tiddler`)
 *   json  TiddlyWiki's own JSON serializer over the root record (`$:/core/templates/json-tiddler`)
 *
 * `mem` and `md` are laws over the carrier TEXT, so `projectCarrierText` answers them with no wiki —
 * a store-backed sink (a named bag, a recipe's designated bag) projects through it. `html`, `tid` and
 * `json` render through the wiki that holds the records and reach only a live `$tw.wiki`; `tid` and
 * `json` stay on TiddlyWiki's own serializers.
 *
 * An unknown target throws, naming the targets: a filter that answered empty would read exactly like
 * a meme that projected to nothing.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

import { expandMemeRefs, type TiddlerFields } from "./deserializer.js";
import { projectSubmission, type WeaveProfile } from "./weave/index.js";
import type { TW5Wiki } from "./types/tiddlywiki.js";

import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";

export type ProjectTarget = "mem" | "md" | "html" | "tid" | "json";

/** The house templates the plugin ships as tiddlers, one per text target. */
export const MEME_TEMPLATE = {
  mem:      "lar:///ha.ka.ba/lararium/templates/meme/mem",
  md:       "lar:///ha.ka.ba/lararium/templates/meme/md",
  "md.meta": "lar:///ha.ka.ba/lararium/templates/meme/md.meta",
  html:     "lar:///ha.ka.ba/lararium/templates/meme/html",
} as const;

export interface ProjectRoute {
  /** The template `--render` and the face both render with `currentTiddler` = the root. */
  readonly template: string;
  /** The media type the projected text carries. */
  readonly contentType: string;
  /** The sidecar template, where the target travels as a pair. */
  readonly sidecar?: string;
}

export const PROJECT_TARGETS: Readonly<Record<ProjectTarget, ProjectRoute>> = {
  mem:  { template: MEME_TEMPLATE.mem, contentType: CARRIER_TYPE },
  md:   { template: MEME_TEMPLATE.md, contentType: "text/markdown", sidecar: MEME_TEMPLATE["md.meta"] },
  html: { template: MEME_TEMPLATE.html, contentType: "text/html" },
  tid:  { template: "$:/core/templates/tid-tiddler", contentType: "application/x-tiddler" },
  json: { template: "$:/core/templates/json-tiddler", contentType: "application/json" },
};

const TARGET_NAMES = Object.keys(PROJECT_TARGETS).join(" · ");

/** The target a caller named, or a loud refusal naming every target. */
export function projectTargetOf(to: string): ProjectTarget {
  if (Object.prototype.hasOwnProperty.call(PROJECT_TARGETS, to)) return to as ProjectTarget;
  throw new Error(`meme project: unknown target "${to}" — targets: ${TARGET_NAMES}`);
}

export interface MemeProjection {
  readonly uri: string;
  readonly to: ProjectTarget;
  readonly text: string;
  readonly contentType: string;
  /** The `.md.meta` sidecar — `md` alone. */
  readonly meta?: string;
}

/** The text targets, answered over the carrier text alone. `opts.profile`/`opts.tongue` thread
 * through to {@link projectSubmission} unchanged (absent: CommonMark, no tongue — today's default);
 * `opts.resolve` is the frozen-`aka`-edge resolver, when the caller has one (a store seat's
 * PREFETCH map, a wiki's {@link wikiResolver}) — absent, every pin falls back unresolved, exactly
 * as it always has. */
export function projectCarrierText(
  text: string,
  uri: string,
  to: "mem" | "md",
  opts?: { readonly profile?: WeaveProfile; readonly tongue?: string; readonly resolve?: (uri: string) => string | null },
): MemeProjection {
  if (to === "mem") return { uri, to, text, contentType: PROJECT_TARGETS.mem.contentType };
  const pair = projectSubmission(text, {
    uri,
    ...(opts?.profile ? { profile: opts.profile } : {}),
    ...(opts?.tongue ? { tongue: opts.tongue } : {}),
    ...(opts?.resolve ? { resolve: opts.resolve } : {}),
  });
  return { uri, to, text: pair.markdown, meta: pair.meta, contentType: PROJECT_TARGETS.md.contentType };
}

type WikiReader = Pick<TW5Wiki, "getTiddler">;

/** The whole carrier the wiki's records recompose to, or null where no carrier root stands. */
export function recomposeMeme(wiki: WikiReader, uri: string): string | null {
  const reader = (title: string): TiddlerFields | undefined =>
    (wiki.getTiddler(title) as { fields?: TiddlerFields } | undefined)?.fields;
  return expandMemeRefs(reader, uri);
}

/**
 * THE LIVE RESOLVER — a frozen `aka` edge's target, read off THIS wiki's own records rather than a
 * disk corpus (the CLI's `bagsResolver`) or a prefetched map (a store seat's pin prefetch). Same
 * interface as both: a uri in, the target's whole carrier text out, `null` where no root stands —
 * so `projectSubmission`'s `resolve` option never has to know which kind of corpus answered it. The
 * fragment strips before resolving: `aka` always pins the whole target carrier (never one slot of
 * it) to decide reference-vs-content, exactly as {@link projectCarrierText}'s other resolvers do.
 */
export function wikiResolver(wiki: WikiReader): (uri: string) => string | null {
  return (uri: string): string | null => recomposeMeme(wiki, uri.split("#")[0]!);
}

/** Render one template with `currentTiddler` bound to the root — the `--render` command's own law.
 * `dialect`/`tongue`, when given, ride as template VARIABLES — the `md` template's own filter
 * reads them as the `meme-project` operator's second/third operand (`<<dialect>>`/`<<tongue>>`). */
function renderRoot(
  wiki: Pick<TW5Wiki, "renderTiddler">,
  template: string,
  uri: string,
  opts?: { readonly dialect?: string; readonly tongue?: string },
): string {
  return wiki.renderTiddler("text/plain", template, {
    variables: {
      currentTiddler: uri,
      storyTiddler: uri,
      ...(opts?.dialect ? { dialect: opts.dialect } : {}),
      ...(opts?.tongue ? { tongue: opts.tongue } : {}),
    },
  });
}

/** Project a meme root the wiki holds to a target. Throws on an unknown target or an absent root,
 * and on a `dialect`/`tongue` given for any target but `md` — those two weave the markdown target
 * alone, and a silent ignore would carry the flag nowhere while reading like it had taken effect. */
export function projectMeme(
  wiki: Pick<TW5Wiki, "getTiddler" | "renderTiddler">,
  uri: string,
  to: string,
  opts?: { readonly dialect?: string; readonly tongue?: string },
): MemeProjection {
  const target = projectTargetOf(to);
  if (recomposeMeme(wiki, uri) === null) throw new Error(`meme project: no carrier root stands under ${uri}`);
  if (target !== "md" && (opts?.dialect || opts?.tongue)) {
    throw new Error(`meme project: --dialect/--tongue weave the "md" target alone; got "${target}"`);
  }
  const route = PROJECT_TARGETS[target];
  const text = renderRoot(wiki, route.template, uri, opts);
  return route.sidecar
    ? { uri, to: target, text, meta: renderRoot(wiki, route.sidecar, uri, opts), contentType: route.contentType }
    : { uri, to: target, text, contentType: route.contentType };
}
