/**
 * daemon-law-tiddlers — the law index's configuration, born from source into the daemon wiki's shadow layer.
 *
 * THE LAW INDEX DERIVES FROM CANON. Two config tiddlers hold it, each a TiddlyWiki filter the wiki's own engine runs:
 *
 *   $:/config/lares/law/filter   the law: every root meme under a bag's `api/` tree (the trees that state law and travel
 *                                as specifications, lar:///ha.ka.ba/lares/README #/infrastructure-map), sorted by title.
 *   $:/config/lares/law/pins     the pin set, read first: the boot seed and the Mu family. A plain title list reads as a
 *                                filter too, so a pin stands as one `[[title]]` run and an unpin as one `-[[title]]` run.
 *
 * {@link LAW_INDEX_FILTER} composes the two: the pins that stand as tiddlers, then the law rows the pins left out. Every
 * surface that offers the index (`lares law list`, the MCP seat's `law_index`, the SessionStart wake) runs that one
 * filter, so the derivation lives in the wiki and no surface keeps a list.
 *
 * WHY A CONFIG TIDDLER AND NOT A `pin` FIELD. A field on a law meme patches house canon: the canon layer takes no put
 * (promotion-only), and a copy-up into the working layer would shadow the law's text with a stale copy. The config
 * tiddler stands apart from every law meme, holds the pins in order, and a pin lands where every face write lands, in the
 * worn face's working layer of its daemon wiki, over the shadow seeded here. The seed re-lays each boot and never
 * touches the override a hand wrote (`seedShadows`).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/daemon-law-tiddlers
 */

import { seedShadows } from "./daemon-ui-tiddlers.js";
import type { TW5Engine } from "./tw5-vm.js";

/** The pin set: a filter whose titles head the law index, in its own order. */
export const LAW_PINS_TITLE = "$:/config/lares/law/pins";
/** The law: a filter over canon naming every law meme the index offers. */
export const LAW_FILTER_TITLE = "$:/config/lares/law/filter";

/** The boot seed: the constitution every surface's seed points to. */
export const LAW_BOOT_SEED = "lar:///ha.ka.ba/lares/api/noosphere-boot";
/** The Mu family's root; its members rest beneath it. */
export const LAW_MU_ROOT = "lar:///ha.ka.ba/lares/api/mu";

/** The seeded pin set: the boot seed, the Mu root, then every Mu member root, derived by address and sorted by title. */
export const LAW_PINS_DEFAULT = `[[${LAW_BOOT_SEED}]] [[${LAW_MU_ROOT}]] [prefix[${LAW_MU_ROOT}/]!regexp[#]sort[title]]`;
/** The seeded law: each root meme (no `#` slot) under any bag's `api/` tree, sorted by title. */
export const LAW_FILTER_DEFAULT = "[prefix[lar:///ha.ka.ba/]regexp[^lar:///ha\\.ka\\.ba/(\\w|-)+/api/]!regexp[#]sort[title]]";

/** The pins that stand as tiddlers, in the pin set's order. */
export const LAW_PINS_FILTER = `[subfilter{${LAW_PINS_TITLE}}is[tiddler]]`;
/** The index: the standing pins first, then the law rows they left out (`unique` keeps each title's first place). */
export const LAW_INDEX_FILTER = `${LAW_PINS_FILTER} =[subfilter{${LAW_FILTER_TITLE}}] +[unique[]]`;

/** The born-from-source law config: each record a shadow a hand's save overrides. */
export const DAEMON_LAW_TIDDLERS: readonly Readonly<Record<string, string>>[] = [
  { title: LAW_PINS_TITLE, text: LAW_PINS_DEFAULT, description: "The law index's pin set: a filter whose titles head `lares law list` and the wake, in order. `lares law pin <uri>` and `lares law unpin <uri>` edit it." },
  { title: LAW_FILTER_TITLE, text: LAW_FILTER_DEFAULT, description: "The law the index derives from canon: a filter over every root meme under a bag's api/ tree." },
];

/** Lay the law config into the live wiki's shadow layer. Idempotent (each call re-lays the shadow plugin). */
export function seedDaemonLawTiddlers(tw5: TW5Engine): void {
  seedShadows(tw5, "law", DAEMON_LAW_TIDDLERS);
}
