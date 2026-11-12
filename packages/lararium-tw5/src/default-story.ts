/**
 * default-story — the one door that opens a wiki's default story, on every engine the house boots.
 *
 * WHEN, NOT ONLY WHAT. TW5's own `story` startup opens `$:/DefaultTiddlers` inside engine boot, before any record of the wiki
 * lands, so a boot read the core's GettingStarted while the wiki's own landing still stood in the port or the seed
 * (tw5-vm-gaps-scout row 17). Each engine therefore boots with no story startup (the page boot env and the island runtime
 * both disable TW5's `story`; `lar-story` binds `tm-home` alone) and opens its story here, at its own first whole snapshot:
 * the glass mirror after the port's greeting (`standMirror`), the worker island after its seed drains (`sovereign-kernel`).
 *
 * WHAT THE STORY READS. The wiki's `$:/DefaultTiddlers` as it stands at that moment, through TW5's own
 * `th-opening-default-tiddlers-list` hook. The house plugin's shadow reads the wiki's own landing records (tagged
 * `$:/tags/lares/Landing`) and falls back to stock's GettingStarted; a wiki that authors its own `$:/DefaultTiddlers`
 * overrides the shadow as TW5 always lets it.
 *
 * A story that already landed (the worker's personal `$:/StoryList`, carried across devices) stays: `keepLanded` names that.
 */
export const DEFAULT_TIDDLERS_TITLE = "$:/DefaultTiddlers";
export const STORY_LIST_TITLE = "$:/StoryList";
/** The tag a wiki's own landing record wears; the house plugin's `$:/DefaultTiddlers` shadow reads it. */
export const LANDING_TAG = "$:/tags/lares/Landing";

interface StoryWiki {
  getTiddlerText(title: string, fallback?: string): string | null | undefined;
  filterTiddlers(filter: string): string[];
  tiddlerExists(title: string): boolean;
  addTiddler(fields: Record<string, unknown>): void;
  getModificationFields(): Record<string, unknown>;
  addToHistory?(title: string): void;
}
interface StoryEngine { wiki: StoryWiki; hooks: { invokeHook(name: string, value: string[]): string[] } }

/** Open the wiki's default story now; returns the titles it opened, or null where a landed story stays. */
export function openDefaultStory(tw: StoryEngine, options: { keepLanded?: boolean } = {}): string[] | null {
  const wiki = tw.wiki;
  if (options.keepLanded && wiki.tiddlerExists(STORY_LIST_TITLE)) return null;
  const story = tw.hooks.invokeHook("th-opening-default-tiddlers-list", wiki.filterTiddlers(wiki.getTiddlerText(DEFAULT_TIDDLERS_TITLE) ?? ""));
  wiki.addTiddler({ title: STORY_LIST_TITLE, text: "", list: story, ...wiki.getModificationFields() });
  if (story[0]) wiki.addToHistory?.(story[0]);
  return story;
}
