/** Wiki changes equal to landed state are foam; every other resident title is a hand for its per-title gate. */
import type { TW5Engine } from "./tw5-vm.js";
import type { IslandAdaptor } from "./island-adaptor.js";

type WikiChanges = Record<string, { modified?: boolean; deleted?: boolean }>;
interface BridgeWiki {
  addEventListener(type: "change", fn: (changes: WikiChanges) => void): void;
  removeEventListener(type: "change", fn: (changes: WikiChanges) => void): void;
  getTiddler(title: string): unknown;
}

/** Bind live wiki notifications to the adaptor. */
export function bridgeWikiToAdaptor(tw5: TW5Engine, adaptor: IslandAdaptor): () => void {
  const wiki = tw5.$tw.wiki as unknown as BridgeWiki;
  adaptor.installLandingQueue();
  const onChange = (changes: WikiChanges): void => {
    if (!adaptor.isResident()) return;
  for (const [title] of Object.entries(changes ?? {})) {
      const current = wiki.getTiddler(title) ?? null;
      if (adaptor.isFoam(title, current)) continue;
      if (adaptor.wasSent(title, current)) continue;
      if (current) {
        void adaptor.saveTiddler(current).catch((err: unknown) => console.warn(`[outbound-bridge] save "${title}" faulted: ${String(err)}`));
      } else {
        void adaptor.deleteTiddler(title).catch((err: unknown) => console.warn(`[outbound-bridge] delete "${title}" faulted: ${String(err)}`));
      }
    }
  };
  wiki.addEventListener("change", onChange);
  return () => wiki.removeEventListener("change", onChange);
}
