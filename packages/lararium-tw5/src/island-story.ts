/**
 * island-story — the worker island opens its own default story, and keeps it where the composition can hold it.
 *
 * The island opens the wiki's default story at its first whole snapshot (`default-story.ts`), after the outbound bridge stands, so
 * the `$:/StoryList` (and the `$:/HistoryList` entry) the opener writes reach the bridge as any write does. A composition that mounts
 * a layer for them saves them there: the personal layer carries the story across devices. A composition that mounts none (a faceless
 * floor, a session surface, a pure local boot) keeps them in the engine alone: the island never owes a save it cannot make, raises no
 * unrouted-save alert for a write no person made, and its teardown names nothing unsaved.
 */
import { openDefaultStory, STORY_LIST_TITLE } from "./default-story.js";
import type { IslandAdaptor } from "./island-adaptor.js";
import type { TW5Engine } from "./tw5-vm.js";

/** TW5's navigation history, which the opener extends as it opens the story. */
export const HISTORY_LIST_TITLE = "$:/HistoryList";

/** Open the island's default story; returns the titles it opened, or null where a landed story stays. */
export function openIslandStory(tw5: TW5Engine, adaptor: Pick<IslandAdaptor, "routesSave" | "keepInEngine">): string[] | null {
  const engineOnly = [STORY_LIST_TITLE, HISTORY_LIST_TITLE].filter((title) => !adaptor.routesSave(title));
  const opened = openDefaultStory(tw5.$tw as never, { keepLanded: true });
  if (opened) for (const title of engineOnly) adaptor.keepInEngine(title);
  return opened;
}
