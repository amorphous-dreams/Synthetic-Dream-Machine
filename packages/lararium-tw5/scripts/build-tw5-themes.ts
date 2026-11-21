/**
 * build-tw5-themes.ts — pack TW5's STOCK themes (`$:/themes/tiddlywiki/vanilla`, `$:/themes/tiddlywiki/snowwhite`) into
 * boot-set plugin blobs beside the grammar and the boot shadows (`plugins/tiddlywiki-*.json`).
 *
 * WHY STOCK. The mirror at full reads as stock TW5 (dreamdom#/the-width-dial), and its goldens compare against stock TW5
 * (d3-glass-lane G6), so the stock base theme rides the boot set by CID: the core blob boots no theme of its own. A house
 * theme, should one come, rides the offering door (`nexus publish`), never this bake.
 *
 * ONE REVISION. The themes pack from the same vendored TW5 (the TiddlyWiki5 submodule, workspace-linked as `tiddlywiki`)
 * the core blob renders from (`build-tw5-vendor.ts`), through TW5's own `loadPluginFolder`, so the theme and the engine
 * read one revision. The packed shadows sort by title, so one revision packs one byte string on any filesystem.
 *
 * Usage: pnpm --filter @lararium/tw5 build (runs first), or tsx scripts/build-tw5-themes.ts alone.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { tw5PluginsRoot } from "../tw5-memes-root.js";

const require = createRequire(import.meta.url);

/** The stock theme folders this bake packs, each named by its place in the TW5 tree; the plugin's own title names the blob. */
export const STOCK_THEME_FOLDERS = ["themes/tiddlywiki/vanilla", "themes/tiddlywiki/snowwhite"] as const;

const tw5Root = dirname(require.resolve("tiddlywiki/package.json"));
const tw = require("tiddlywiki").TiddlyWiki() as {
  boot: { argv: string[]; boot(callback: () => void): void };
  loadPluginFolder(path: string): Record<string, string> | null;
};
tw.boot.argv = [join(tw5Root, "editions", "empty")];
await new Promise<void>((resolve) => tw.boot.boot(resolve));

for (const folder of STOCK_THEME_FOLDERS) {
  const packed = tw.loadPluginFolder(join(tw5Root, folder));
  if (!packed) throw new Error(`build-tw5-themes: TW5 packed no plugin at ${folder}`);
  const shadows = (JSON.parse(packed["text"]!) as { tiddlers: Record<string, Record<string, unknown>> }).tiddlers;
  const sorted = Object.fromEntries(Object.keys(shadows).sort().map((title) => [title, shadows[title]]));
  const envelope: Record<string, string> = { ...packed, text: JSON.stringify({ tiddlers: sorted }) };
  const name = `tiddlywiki-${folder.split("/").pop()}.json`;
  writeFileSync(join(tw5PluginsRoot, name), `${JSON.stringify(envelope, null, 2)}\n`, "utf-8");
  console.log(`build-tw5-themes: packed ${envelope["title"]} (${Object.keys(sorted).length} shadows) → plugins/${name}`);
}
