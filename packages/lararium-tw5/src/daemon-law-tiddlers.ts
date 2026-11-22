/**
 * daemon-law-tiddlers — the law index's filters, and its pin set born from source into the daemon wiki's shadow layer.
 *
 * THE LAW INDEX DERIVES FROM CANON. {@link LAW_FILTER} names the law: every root meme under a bag's `api/` tree (the trees
 * that state law and travel as specifications, lar:///ha.ka.ba/lares/README #/infrastructure-map), sorted by title. It stands
 * here as house configuration, never as a wiki record a seat could edit. {@link LAW_PINS_TITLE} names the pin set, a
 * TiddlyWiki filter whose titles head the index (seeded: the boot seed, then the Mu family). A plain title list reads as a
 * filter too, so a pin stands as one `[[title]]` run and an unpin as one `-[[title]]` run.
 *
 * ONLY CANON PRINTS. Every surface reads the index into an agent's context, so a row stands only where the record the wiki
 * answers for its title rests in a canon layer ({@link LAW_CANON_BAG_PATTERN}: the oracle floor, the system canon bags) and
 * its title reads as one `lar:` address with no whitespace ({@link LAW_TITLE_PATTERN}). A record a face writes into its
 * working layer, a law title included (its copy shadows the canon record), never reaches the index; a pin naming one
 * prints nothing. The pin set itself may rest in the working layer: it orders canon law and adds none.
 *
 * {@link LAW_INDEX_FILTER} calls `lares.law`, which composes the two: the canon pins first, then the canon law the pins left out.
 * Every surface that offers the index (`lares law list`, the MCP seat's `law_index`, the SessionStart wake) runs that one call; the
 * function lives in canon alone (`house-filters`), so no working-layer record redefines it.
 *
 * WHY A CONFIG TIDDLER AND NOT A `pin` FIELD. A field on a law meme patches house canon: the canon layer takes no put
 * (promotion-only), and a copy-up into the working layer would shadow the law's text with a copy the index then withholds.
 * The pin set stands apart from every law meme, holds the pins in order, and a pin lands where every face write lands, in
 * the worn face's working layer of its daemon wiki, over the shadow seeded here. The seed re-lays each boot and never
 * touches the override a hand wrote (`seedShadows`).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/daemon-law-tiddlers
 */

import { seedShadows } from "./daemon-ui-tiddlers.js";
import type { TW5Engine } from "./tw5-vm.js";

/** The pin set: a filter whose titles head the law index, in its own order. */
export const LAW_PINS_TITLE = "$:/config/lares/law/pins";

/** The boot seed: the constitution every surface's seed points to. */
export const LAW_BOOT_SEED = "lar:///ha.ka.ba/lares/api/noosphere-boot";
/** The Mu family's root; its members rest beneath it. */
export const LAW_MU_ROOT = "lar:///ha.ka.ba/lares/api/mu";

/** The seeded pin set: the boot seed, the Mu root, then every Mu member root, derived by address and sorted by title. */
export const LAW_PINS_DEFAULT = `[[${LAW_BOOT_SEED}]] [[${LAW_MU_ROOT}]] [prefix[${LAW_MU_ROOT}/]!regexp[#]sort[title]]`;
/** The layers a law row's record may rest in: the oracle floor and the system canon bags (`SYSTEM_CANON_SLUGS`). */
export const LAW_CANON_BAG_PATTERN = "^lar:///ha\\.ka\\.ba/bags/(oracle|lares|lararium)$";

/**
 * The filters read as calls: the function bodies stand in the canon carrier `lar:///ha.ka.ba/lares/api/filters`
 * (what makes a title law, the pin order, the canon guard), and every surface runs these calls, so no reader carries a copy.
 */
/** The pins that stand as canon law, in the pin set's order: a pin orders the law and adds none. */
export const LAW_PINS_FILTER = "[lares.law.pins[]]";
/** The index: the canon pins first, then the canon law they left out. */
export const LAW_INDEX_FILTER = "[lares.law[]]";
/** Whether one title stands as canon law: the title kept where the index holds it. */
export const lawStandsFilter = (uri: string): string => `[lares.law[]match[${uri}]]`;

/** The born-from-source pin set: a shadow a hand's save overrides. */
export const DAEMON_LAW_TIDDLERS: readonly Readonly<Record<string, string>>[] = [
  { title: LAW_PINS_TITLE, text: LAW_PINS_DEFAULT, description: "The law index's pin set: a filter whose titles head `lares law list` and the wake, in order; only canon law prints. `lares law pin <uri>` and `lares law unpin <uri>` edit it." },
];

/** Lay the pin set into the live wiki's shadow layer. Idempotent (each call re-lays the shadow plugin). */
export function seedDaemonLawTiddlers(tw5: TW5Engine): void {
  seedShadows(tw5, "law", DAEMON_LAW_TIDDLERS);
}
