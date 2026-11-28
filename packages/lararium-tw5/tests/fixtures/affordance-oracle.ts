/**
 * affordance-oracle — a FIXTURE affordance carrier at `lar:///library.oracle.speaks`, written against Loom's schema
 * (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-loom) so the renderer, the bake and the witnesses run before the canon
 * carrier stands. The canon carrier (weaver's, `bags/lares/ha.ka.ba/lares/afford/library.oracle.speaks.mem`) supersedes it wherever the pack is read;
 * this fixture rides tests and the known-positive controls alone, never the tracked pack.
 *
 * The frame writer mints the frame (`frameCarrier`), so the fixture spells only what an author writes.
 */
import { frameCarrier } from "@lararium/memetic-frame";

export const FIXTURE_ADDRESS = "lar:///library.oracle.speaks";
/** Canon seats no bare root (weaver#1, api/pono/affordance#/residency): the carrier rests at the stable seat and tags its address. */
export const FIXTURE_TITLE = "lar:///ha.ka.ba/lares/afford/library.oracle.speaks";
export const FIXTURE_LAW = "lar:///ha.ka.ba/lares/api/pono/affordance";

/** The phrase the oracle's help has always carried (`ORACLE_THROW_STANDS`); the fixture holds it in its head. */
export const FIXTURE_LIMIT = "a blind throw to collide uncertainty with: the throw stands, the reading stays open";

export const FIXTURE_BODY = [
  "```toml meta",
  "cacheable = true",
  "l-space   = \"stable\"",
  "role      = \"Cast the I Ching by three coins; the cast lands as a tiddler.\"",
  `tags      = ["${FIXTURE_LAW}", "${FIXTURE_ADDRESS}"]`,
  `title     = "${FIXTURE_TITLE}"`,
  "type      = \"text/memetic-wikitext+tiddlywiki\"",
  "uri-path  = \"ha.ka.ba/lares/afford/library.oracle.speaks\"",
  "```",
  "",
  "<<~ ahu slot=`#/head`>>",
  "! library.oracle.speaks ~ Cast the I Ching by three coins; the cast lands as a tiddler.",
  "",
  "A line sums three coins, heads three and tails two: 6 and 9 change, 7 and 8 hold; the six lines name the primary hexagram and the changing lines turned over name the relating one.",
  "",
  `One asking, one throw: the same words by the same caster answer the cast already standing. ${FIXTURE_LIMIT}.`,
  "",
  "A weak seed reads back: the record names the seed by a digest anyone can test a guess against, so choose a strong one.",
  "<<~/ahu>>",
  "",
  "<<~ ahu slot=`#/shows`>>",
  "!! shows ~ first-cast · own-coins",
  "<<has entity=`example` name=`first-cast` params=`recipe/default asking/[[which road first?]] ~ a seat's cast at its own open fork`>>",
  "<<has entity=`example` name=`own-coins` params=`recipe/default coins/7,8,9,6,7,7 ~ the six lines a person threw, bottom first`>>",
  "<<has entity=`example` name=`anew` params=`recipe/default asking/[[which road first?]] fresh/true ~ a person asks the same words anew`>>",
  "<<~/ahu>>",
  "",
  "<<~ ahu slot=`#/takes`>>",
  "!! takes ~ recipe · bag · asking · fresh · seed · coins · caster",
  "<<has entity=`arg` name=`recipe` params=`takes/slug needs/one-of:recipe,bag ~ the wiki that takes the cast`>>",
  "<<has entity=`arg` name=`bag` params=`takes/slug needs/one-of:recipe,bag ~ the bag that takes the cast`>>",
  "<<has entity=`arg` name=`asking` params=`takes/words needs/seat ~ the question, named before the throw`>>",
  "<<has entity=`arg` name=`fresh` params=`kind/switch gate/hand ~ a new throw for the same words`>>",
  "<<has entity=`arg` name=`seed` params=`takes/words gate/hand ~ coins drawn from these words`>>",
  "<<has entity=`arg` name=`coins` params=`takes/values gate/hand ~ six line values, bottom first`>>",
  "<<has entity=`arg` name=`caster` params=`takes/name ~ who cast`>>",
  "<<has entity=`arg` name=`at` params=`takes/time needs/always skins/mcp,tw5,console ~ the time of the cast, as testimony`>>",
  "<<~/ahu>>",
  "",
  "<<~ ahu slot=`#/gate`>>",
  "!! gate ~ coins · fresh",
  "<<has entity=`gate` name=`coins` params=`who/hand asks/none ~ a person's own throw; a seat's coins answer asks`>>",
  "<<has entity=`gate` name=`fresh` params=`who/hand asks/none ~ a person throws anew; a seat reads asks`>>",
  "<<~/ahu>>",
  "",
  "<<~ ahu slot=`#/refuses`>>",
  "!! refuses ~ query-unnamed",
  "<<has entity=`refusal` name=`query-unnamed` params=`cure/[[library.oracle.speaks recipe/default asking/<words>]] ~ a seat names its query before it casts`>>",
  "<<has entity=`refusal` name=`record-torn` params=`cure/[[tiddler.get.reads title/<cast>]] ~ the cast's title stands but reads as no cast`>>",
  "<<~/ahu>>",
  "",
  "<<~ ahu slot=`#/answers`>>",
  "!! answers ~ cast · replayed · asks · owed",
  "<<has entity=`band` name=`cast` params=`exit/0 ~ the throw lands as one tiddler`>>",
  "<<has entity=`band` name=`replayed` params=`exit/0 ~ the cast already standing answers`>>",
  "<<has entity=`band` name=`asks` params=`exit/5 ~ a seat asked what a hand alone gives`>>",
  "<<has entity=`band` name=`owed` params=`exit/6 ~ a lost answer reads owed, never failed`>>",
  "<<~/ahu>>",
  "",
  "<<~ ahu slot=`#/skins`>>",
  "!! skins ~ cli · mcp · tw5",
  "<<~ ahu slot=`#/skins/cli`>>",
  "!!! cli ~ lares oracle cast",
  "<<has entity=`skin` name=`cli` params=`spells/[[lares oracle cast]] ~ the terminal`>>",
  "<<~/ahu>>",
  "<<~ ahu slot=`#/skins/mcp`>>",
  "!!! mcp ~ oracle_cast",
  "<<has entity=`skin` name=`mcp` params=`spells/oracle_cast omits/fresh,seed ~ the seat's tool`>>",
  "<<~/ahu>>",
  "<<~ ahu slot=`#/skins/tw5`>>",
  "!!! tw5 ~ action-oracle-cast",
  "<<has entity=`skin` name=`tw5` params=`spells/action-oracle-cast ~ a button in the wiki`>>",
  "<<~/ahu>>",
  "<<~/ahu>>",
  "",
  "<<~ ahu slot=`#/edges`>>",
  "!! edges ~ oracle-loop",
  "<<~ loulou uri=`lar:///ha.ka.ba/lares/api/pono/oracle-loop`>>",
  "<<~/ahu>>",
].join("\n");

/** The framed fixture carrier. */
export function oracleFixtureCarrier(body: string = FIXTURE_BODY): string {
  return frameCarrier({ head: { uri: FIXTURE_TITLE }, body });
}
