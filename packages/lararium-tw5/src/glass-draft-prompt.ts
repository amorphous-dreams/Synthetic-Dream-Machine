import type { GlassWiki } from "./glass-port-adaptor.js";

type PeerAdaptor = { onPeerEdit(listener: (change: { title: string }) => void): () => void };
type DraftWiki = GlassWiki & { filterTiddlers(filter: string): string[] };
const attr = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** A peer edit gives a standing draft a local choice on the alert rail. */
export function makeDraftNewerBasePrompt({ wiki, Tiddler, adaptor }: {
  wiki: DraftWiki;
  Tiddler: new (fields: Record<string, unknown>) => unknown;
  adaptor: PeerAdaptor;
}) {
  return adaptor.onPeerEdit(({ title }) => {
    const draft = wiki.filterTiddlers("[all[tiddlers]has[draft.of]]")
      .find(candidate => wiki.getTiddler(candidate)?.fields["draft.of"] === title);
    if (!draft) return;
    const alert = `$:/temp/lares/alert/newer-base/${title}`;
    const text = `A peer changed ${title} while your draft stands.\n\n` +
      `<$button>Take theirs<$action-deletetiddler $tiddler="${attr(draft)}"/>` +
      `<$action-deletetiddler $tiddler="${attr(alert)}"/></$button>\n\n` +
      `<$button>Keep mine<$action-deletetiddler $tiddler="${attr(alert)}"/></$button>`;
    wiki.addTiddler(new Tiddler({ title: alert, tags: ["$:/tags/Alert"], text }));
  });
}
