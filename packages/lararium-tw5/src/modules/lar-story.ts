/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/lar-story
type: application/javascript
module-type: startup
\*/
// @ts-nocheck
const DEFAULT_STORY_TITLE = "$:/StoryList";
const DEFAULT_HISTORY_TITLE = "$:/HistoryList";
const DEFAULT_TIDDLERS_TITLE = "$:/DefaultTiddlers";
export const name = "lar-story";
export const after = ["startup"];
export const synchronous = true;
export function startup() {
  if (!$tw.browser) return;
  openStartupTiddlers({ disableHistory: $tw.boot.disableStartupNavigation });
  const root = $tw.rootWidget;
  root.addEventListener("tm-home", () => {
    const story = $tw.hooks.invokeHook("th-opening-default-tiddlers-list", $tw.wiki.filterTiddlers($tw.wiki.getTiddlerText(DEFAULT_TIDDLERS_TITLE)));
    $tw.wiki.addTiddler({ title: DEFAULT_STORY_TITLE, text: "", list: story }, $tw.wiki.getModificationFields());
    if (story[0]) $tw.wiki.addToHistory(story[0]);
  });
  const ask = (kind, args) => {
    const settle = status => { if (status !== "ok") $tw.wiki.addTiddler({ title: "$:/temp/lares/alert/refused/" + kind, text: kind + " refused: " + status, tags: ["$:/tags/Alert"] }); };
    const door = $tw.lares && $tw.lares.serviceDoor;
    if (door) door.ask(kind, args, settle); else settle("page-action-unavailable");
  };
  root.addEventListener("tm-print", () => ask("print", {}));
  root.addEventListener("tm-open-external-window", event => ask("open-external", { url: event.param || "https://tiddlywiki.com/" }));
  root.addEventListener("tm-browser-refresh", () => ask("route", { action: "reload" }));
  root.addEventListener("tm-permalink", event => ask("route", { action: "permalink", title: event.param || event.tiddlerTitle || "" }));
  root.addEventListener("tm-permaview", event => ask("route", { action: "permaview", title: event.param || event.tiddlerTitle || "" }));
}

function openStartupTiddlers(options) {
	options = options || {};
	// Work out the target tiddler and the story filter. "null" means "unspecified"
	var target = null,
		storyFilter = null;
	if($tw.locationHash.length > 1) {
		var hash = $tw.locationHash.substr(1),
			split = hash.indexOf(":");
		if(split === -1) {
			target = $tw.utils.decodeURIComponentSafe(hash.trim());
		} else {
			target = $tw.utils.decodeURIComponentSafe(hash.substr(0,split).trim());
			storyFilter = $tw.utils.decodeURIComponentSafe(hash.substr(split + 1).trim());
		}
	}
	// If the story wasn't specified use the current tiddlers or a blank story
	if(storyFilter === null) {
		if(options.defaultToCurrentStory) {
			var currStoryList = $tw.wiki.getTiddlerList(DEFAULT_STORY_TITLE);
			storyFilter = $tw.utils.stringifyList(currStoryList);
		} else {
			if(target && target !== "") {
				storyFilter = "";
			} else {
				storyFilter = $tw.wiki.getTiddlerText(DEFAULT_TIDDLERS_TITLE);
			}
		}
	}
	// Process the story filter to get the story list
	var storyList = $tw.wiki.filterTiddlers(storyFilter);
	// Invoke any hooks that want to change the default story list
	storyList = $tw.hooks.invokeHook("th-opening-default-tiddlers-list",storyList);
	// If the target tiddler isn't included then splice it in at the top
	if(target && storyList.indexOf(target) === -1) {
		storyList.unshift(target);
	}
	// Save the story list
	$tw.wiki.addTiddler({title: DEFAULT_STORY_TITLE, text: "", list: storyList},$tw.wiki.getModificationFields());
	// Update history
	var story = new $tw.Story({
		wiki: $tw.wiki,
		storyTitle: DEFAULT_STORY_TITLE,
		historyTitle: DEFAULT_HISTORY_TITLE
	});
	if(!options.disableHistory) {
		// If a target tiddler was specified add it to the history stack
		if(target && target !== "") {
			// The target tiddler doesn't need double square brackets, but we'll silently remove them if they're present
			if(target.indexOf("[[") === 0 && target.substr(-2) === "]]") {
				target = target.substr(2,target.length - 4);
			}
			story.addToHistory(target);
		} else if(storyList.length > 0) {
			story.addToHistory(storyList[0]);
		}
	}
}

