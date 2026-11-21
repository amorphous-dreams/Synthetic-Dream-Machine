/**
 * executable-class — the one list that names what a TiddlyWiki record runs (state/decisions "Five floors walked" (2);
 * backlog-awakens "The executable-record lei").
 *
 * A record RUNS when TW5 evaluates it as code (a module, a plugin, a script type) or wikifies it on its own, unasked, because a
 * system tag hooks it into boot or into every render (a startup action, a global macro or procedure, a view or page template, raw
 * markup in the page head, a keyboard shortcut's actions, a background action). Two readers hold this list and no other: the seat
 * wall (`seat-startup-offer.ts`: an AI seat's executable record offers and never lands) and the executable-record lei's scope (a
 * lei names a wiki, a title set or one class from this list).
 *
 * THE LIST FAILS CLOSED. A `$:/tags/*` tag reads executable unless `INERT_SYSTEM_TAGS` names it: a tag TW5 grows later, or a
 * plugin's own, never slips through as data. A plain `$:/config`, `$:/state` or `$:/temp` record carrying no such field or tag
 * reads as data; the title never decides, the fields do.
 */

/** One class: the name a lei's scope and a refusal speak, and what marks a record as that class. */
export interface ExecutableClass {
  readonly class: string;
  /** Matches a record's fields; `mark` names the field value or tag that matched. */
  readonly matches: (fields: Readonly<Record<string, unknown>>, tags: readonly string[]) => string | null;
}

const SYSTEM_TAG_PREFIX = "$:/tags/";
const SCRIPT_TYPES: readonly string[] = ["application/javascript", "text/javascript", "application/x-javascript", "text/ecmascript", "application/ecmascript", "module"];

/** A tag `base` itself or one beneath it (`base/...`). */
const under = (base: string) => (_f: Readonly<Record<string, unknown>>, tags: readonly string[]): string | null =>
  tags.find((tag) => tag === base || tag.startsWith(`${base}/`)) ?? null;
/** A tag exactly `base`, or one that starts with `base` (a filter-cascade family such as `ViewTemplateBodyFilter`). */
const family = (base: string) => (_f: Readonly<Record<string, unknown>>, tags: readonly string[]): string | null =>
  tags.find((tag) => tag.startsWith(base)) ?? null;
const field = (name: string) => (fields: Readonly<Record<string, unknown>>): string | null =>
  fields[name] !== undefined && fields[name] !== null && fields[name] !== "" ? `${name}: ${String(fields[name])}` : null;

/**
 * The named classes, most specific first. The last, `system-tag`, catches every `$:/tags/*` tag the classes before it and the
 * inert list leave unnamed: the fail-closed floor.
 */
export const EXECUTABLE_CLASSES: readonly ExecutableClass[] = [
  { class: "module", matches: field("module-type") },
  { class: "plugin", matches: field("plugin-type") },
  { class: "script", matches: (fields) => (typeof fields["type"] === "string" && SCRIPT_TYPES.includes(fields["type"].trim().toLowerCase()) ? `type: ${fields["type"]}` : null) },
  { class: "startup-action", matches: under("$:/tags/StartupAction") },
  { class: "background-action", matches: under("$:/tags/BackgroundAction") },
  { class: "macro", matches: under("$:/tags/Macro") },
  { class: "global", matches: under("$:/tags/Global") },
  { class: "view-template", matches: family("$:/tags/ViewTemplate") },
  { class: "edit-template", matches: family("$:/tags/EditTemplate") },
  { class: "page-template", matches: under("$:/tags/PageTemplate") },
  { class: "raw-markup", matches: family("$:/tags/RawMarkup") },
  { class: "keyboard-shortcut", matches: under("$:/tags/KeyboardShortcut") },
  { class: "system-tag", matches: (_f, tags) => tags.find((tag) => tag.startsWith(SYSTEM_TAG_PREFIX) && !INERT_SYSTEM_TAGS.includes(tag)) ?? null },
];

/**
 * The system tags TW5's core reads as data alone, never wikifying or running a record that carries them on its own: a palette's
 * colour table, an image, an editor snippet inserted only when the person picks it, a filter offered in Advanced Search's menu.
 * Everything else under `$:/tags/` reads executable.
 */
export const INERT_SYSTEM_TAGS: readonly string[] = ["$:/tags/Palette", "$:/tags/Image", "$:/tags/TextEditor/Snippet", "$:/tags/Filter"];

/** A tag list as TiddlyWiki carries it: an array, or a string list (`one [[two words]]`). */
export function tiddlerTagsOf(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.filter((tag): tag is string => typeof tag === "string");
  if (typeof tags !== "string") return [];
  const out: string[] = [];
  for (const m of tags.matchAll(/\[\[([^\]]*)\]\]|(\S+)/g)) out.push(m[1] ?? m[2]!);
  return out;
}

/** The class a record's fields put it in, and the field or tag that marked it; null for a record that reads as data. */
export function executableClassOf(fields: Readonly<Record<string, unknown>>): { class: string; mark: string } | null {
  const tags = tiddlerTagsOf(fields["tags"]);
  for (const cls of EXECUTABLE_CLASSES) {
    const mark = cls.matches(fields, tags);
    if (mark !== null) return { class: cls.class, mark };
  }
  return null;
}

export const isExecutableRecord = (fields: Readonly<Record<string, unknown>>): boolean => executableClassOf(fields) !== null;

/** Whether `name` names a class of the one list (a lei's scope names one). */
export const isExecutableClassName = (name: unknown): name is string => typeof name === "string" && EXECUTABLE_CLASSES.some((c) => c.class === name);
