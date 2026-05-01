/**
 * zoom-layout — tldraw canvas layout props per zoom level.
 *
 * Room-session scope: ZoomLayout describes how meme nodes render at a given
 * zoom level. It reads from kumu def memes tagged $:/tags/LarariumKumu.
 * Corresponds to tldraw's "session" RecordScope — not synced to peers,
 * not written to durable corpus.
 */

import type { TW5Wiki } from "./types/tiddlywiki.js";

export interface ZoomLayout {
  w:           number;
  h:           number;
  color:       string;
  includeAhu:  boolean;
  showCarrier: boolean;
  opacity:     number;
}

export function parseZoomLayoutTOML(text: string): ZoomLayout | null {
  const m = /```toml\n([\s\S]*?)```|<<~\s*(?:iam|toml)\s*>>([\s\S]*?)<<~\/(?:iam|toml)\s*>>/i.exec(text);
  const toml = m ? (m[1] ?? m[2] ?? "") : text;

  const get  = (key: string): string | undefined => {
    const r = new RegExp(`^${key}\\s*=\\s*(.+)$`, "m").exec(toml);
    return r ? r[1]!.trim().replace(/^["']|["']$/g, "") : undefined;
  };
  const num  = (k: string, d: number): number   => { const v = get(k); return v ? (parseFloat(v) || d) : d; };
  const bool = (k: string, d: boolean): boolean => { const v = get(k); return v !== undefined ? v === "true" : d; };

  if (!get("w") && !get("h") && !get("color")) return null;

  return {
    w:           num("w",             220),
    h:           num("h",             100),
    color:       get("color")      ?? "rating",
    includeAhu:  bool("include-ahu",  false),
    showCarrier: bool("show-carrier", false),
    opacity:     num("opacity",       1.0),
  };
}

/**
 * Read zoom-level layout props from the kumu def meme for a given zoom level.
 *
 * Resolved via TW5 filter on $:/tags/LarariumKumu + kumu-name field — works
 * across tagspaces (ha.ka.ba stable or chapel-perilous-opens draft).
 */
export function getZoomLayout(wiki: TW5Wiki, level: string): ZoomLayout | null {
  const name = `meme-${level}`;
  const results: string[] = wiki.filterTiddlers(
    `[all[tiddlers]tag[$:/tags/LarariumKumu]field:kumu-name[${name}]]`
  ) ?? [];
  if (!results[0]) return null;
  const text: string | undefined = wiki.getTiddlerText(results[0]);
  if (!text) return null;
  return parseZoomLayoutTOML(text);
}
