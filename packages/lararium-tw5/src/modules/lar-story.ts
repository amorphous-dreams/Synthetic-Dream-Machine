/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/lar-story
type: application/javascript
module-type: startup
\*/
// @ts-nocheck
import { openDefaultStory } from "../default-story.js";
/**
 * lar-story — the mirror's root story doors. The story itself opens at the port's first whole snapshot, never inside engine boot
 * (`default-story.ts`; tw5-vm-gaps-scout row 17): TW5's own `story` startup stays disabled on the page, and this module reads no
 * location hash, because the surface owns the URL through its `route` door (d3-glass-lane #/the-realm).
 */
export const name = "lar-story";
export const after = ["startup"];
export const synchronous = true;
export function startup() {
  if (!$tw.browser) return;
  const root = $tw.rootWidget;
  root.addEventListener("tm-home", () => { openDefaultStory($tw); });
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
