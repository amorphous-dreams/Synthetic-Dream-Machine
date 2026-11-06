/**
 * The page's life signals, fed to the vessel. The page alone reads its `document` and its own `pagehide`; the vessel reads
 * only what this feed hands it (the lift's `page:life`), so its modules run on any thread.
 */
import type { PageLife, PageLifeFeed } from "@lararium/browser";

/** Subscribe a vessel listener to a page's hide and leave: a hidden page answers `hidden`, a leaving one `pagehide`. */
export function pageLifeOf(page: EventTarget, doc: EventTarget & { readonly visibilityState: string }): PageLifeFeed {
  return (listener: (life: PageLife) => void) => {
    const onVisibility = (): void => { if (doc.visibilityState === "hidden") listener("hidden"); };
    const onHide = (): void => listener("pagehide");
    doc.addEventListener("visibilitychange", onVisibility);
    page.addEventListener("pagehide", onHide);
    return () => { doc.removeEventListener("visibilitychange", onVisibility); page.removeEventListener("pagehide", onHide); };
  };
}

/** Write the vessel's rest reading onto the document root (`data-lar-rest`), the vessel's own word a person's tooling waits on. */
export function paintRest(doc: { readonly documentElement: { readonly dataset: DOMStringMap } }, state: { readonly asked: number; readonly rested: number; readonly stalled: number }): void {
  doc.documentElement.dataset["larRest"] = `${state.asked}/${state.rested}/${state.stalled}`;
}
