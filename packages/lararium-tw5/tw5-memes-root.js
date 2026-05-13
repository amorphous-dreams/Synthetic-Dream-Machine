import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to packages/lararium-tw5/memes/ — the @lararium/tw5 meme corpus. */
export const tw5MemesRoot = resolve(__dirname, "memes");

/** Absolute path to packages/lararium-tw5/plugins/ — vendored TW5 plugin JSON files. */
export const tw5PluginsRoot = resolve(__dirname, "plugins");

/** Absolute path to packages/lararium-tw5/dist-tiddlers/ — headered TW5 CJS tiddlers. */
export const tw5DistWidgetsRoot = resolve(__dirname, "dist-tiddlers");
