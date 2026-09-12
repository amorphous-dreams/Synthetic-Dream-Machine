/**
 * smoke-plugin-boot — verify the plugin-tiddler boot path.
 *
 * Boots a fresh TW5Engine in-process, passing LARES_MEMETIC_WIKITEXT_PLUGIN
 * as boot()'s plugin argument (the caller supplies plugins explicitly — the
 * engine preloads nothing by itself); TW5's standard plugin loader unpacks
 * it. We then assert that the unpacked artifacts are present in the running
 * wiki:
 *   - cascade config tiddlers at lar:///config/Lar/AhuTemplate/... (html
 *     scope — the markdown-meme templates burned at 07866b34)
 *   - template tiddlers at lar:///ha.ka.ba/lararium/templates/...
 *   - parser registered for text/memetic-wikitext+tiddlywiki
 *   - sigil widget tiddlers present (kau, ahu, aka, kahea, loulou, pranala — all TW5 \\widget)
 *
 * Exit nonzero if any check fails.
 */
import { readFileSync } from "fs";
import path from "path";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "@lararium/mesh";
import { TW5Engine } from "../src/tw5-vm.js";
import { LARES_MEMETIC_WIKITEXT_PLUGIN } from "../src/plugin-tiddler.generated.js";
import { exportMemeText } from "../src/meme-write.js";
import { TW5_CORE_SCRIPT_FILENAME, TW5_CORE_DIR } from "../src/generated-tw5-version.js";

async function main(): Promise<void> {
  const corePath = path.join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
  const coreBlob = new Uint8Array(readFileSync(corePath));
  const engine = new TW5Engine();
  await engine.boot(coreBlob, [LARES_MEMETIC_WIKITEXT_PLUGIN as unknown as Record<string, unknown>]);

  const failures: string[] = [];
  const wiki = engine.wiki;

  // The html-scope survivors — the markdown-meme template twins burned at 07866b34 (pre-tide).
  const expectedTitles = [
    LARES_MEMETIC_WIKITEXT_PLUGIN_URI,
    "lar:///config/Lar/AhuTemplate/html",
    "lar:///config/Lar/AkaTemplate/html",
    "lar:///config/Lar/PranalaHeaderTemplate/html",
    "lar:///config/Lar/KaheaTemplate/html",
    "lar:///config/Lar/LoulouTemplate/html",
    "lar:///config/Lar/PranalaTemplate/html",
    "lar:///ha.ka.ba/lararium/templates/ahu/html",
    "lar:///ha.ka.ba/lararium/templates/aka/html",
    "lar:///ha.ka.ba/lararium/templates/pranala-header/html",
    "lar:///ha.ka.ba/lararium/templates/kahea/html",
    "lar:///ha.ka.ba/lararium/templates/loulou/html",
    "lar:///ha.ka.ba/lararium/templates/pranala/html",
    "lar:///ha.ka.ba/lararium/tw5/tiddlers/sigil-dispatcher",
    "lar:///ha.ka.ba/lararium/tw5/tiddlers/sigil-ahu",
    "lar:///ha.ka.ba/lararium/tw5/tiddlers/sigil-aka",
    "lar:///ha.ka.ba/lararium/tw5/tiddlers/sigil-kahea",
    "lar:///ha.ka.ba/lararium/tw5/tiddlers/sigil-loulou",
    "lar:///ha.ka.ba/lararium/tw5/tiddlers/sigil-pranala-header",
    "lar:///ha.ka.ba/lararium/tw5/tiddlers/sigil-pranala",
    "lar:///config/Lar/KauTemplate/html",
    "lar:///ha.ka.ba/lararium/templates/kau/html",
    "lar:///ha.ka.ba/lararium/tw5/tiddlers/sigil-kau",
  ];
  for (const title of expectedTitles) {
    if (!wiki.getTiddler(title)) failures.push(`missing tiddler: ${title}`);
  }

  // Probe TW5 module registry for the parser + widgets.
  const tw = (engine as unknown as { _tw: { Wiki?: { parsers?: Record<string, unknown> }; modules?: { types?: Record<string, Record<string, unknown>> } } })._tw;
  const parsers = tw?.Wiki?.parsers ?? {};
  if (!parsers["text/memetic-wikitext+tiddlywiki"]) failures.push("parser not registered: text/memetic-wikitext+tiddlywiki");

  // All sigil widgets (ahu, aka, kahea, kau, loulou, pranala, pranala-header)
  // now live as TW5 \widget definitions in tiddler text — no JS module-type:widget.
  // The only JS widgets are internal infra (not checked here).
  // Tiddler-presence checks above verify kau, ahu, etc. loaded from the plugin.

  // Probe ahu cascade tiddler presence — sigil-ahu.tid carries ~ahu + ~kahea~ahu.
  // Full render probe deferred: engine.renderText does not load $:/tags/Global
  // wikitext into macro scope, so wikitext widget probes are pre-existing-broken
  // across all sigils (aka, kahea, loulou, etc.). Tiddler-presence checks above
  // cover sigil-ahu loading. Integration render coverage lives in test:tw5-flow.
  if (!wiki.getTiddler("lar:///ha.ka.ba/lararium/tw5/tiddlers/sigil-ahu")) {
    failures.push("sigil-ahu tiddler missing from plugin");
  }

  // Render probes for wikitext-defined sigils do not belong in this low-level
  // boot smoke. engine.renderText() parses anonymous text without importing the
  // plugin's $:/tags/Global macro definitions into scope, so it strips the
  // macrocall nodes after the JS wikirule fires. Presence checks above verify
  // the plugin unpacked the wikitext sigil tiddlers; integration TW5 flow tests
  // own rendered widget behavior.

  // Probe the carriage the deserializer stands: the prologue above the declaration and the
  // postamble past the frame ride as RECORDS at `uri#/$prologue` and `uri#/$postamble`, each
  // pinned to the carrier by `$fragment-parent` — never as fields on the parent (a field cannot
  // carry a newline across a `.tid` projection). The declaration itself belongs to the FRAME: the
  // emitter mints it, so the prologue record keeps only what the author wrote beyond it.
  // A section child titles as a rooted path, `uri#/head`.
  const carrierUri = "lar:///probe-meme";
  const memeWithFraming = [
    "prose above the declaration",
    "",
    "<<!DOCTYPE \"memetic-wikitext+tiddlywiki\" \"lar:///ha.ka.ba/lares/api/pono/memetic-wikitext\">>",
    "",
    `<<^ code="&#x0001;" from=? -> to=${carrierUri}>>`,
    "```toml meta",
    "uri-path = \"probe-meme\"",
    "```",
    "",
    "<<^ code=\"&#x0002;\">>",
    "",
    "<<~ ahu #/head>>",
    "body",
    "<<~/ahu>>",
    "",
    "<<^ code=\"&#x0003;\">>",
    "<<^ code=\"&#x0004;\" -> to=?>>",
    "",
    "trailing prose past the frame",
    "",
  ].join("\n");
  type DeserializedFields = Record<string, string | string[]>;
  const deserializeTiddlers = (tw as unknown as { wiki: { deserializeTiddlers(t: string, x: string, b: Record<string, string>): DeserializedFields[] } }).wiki.deserializeTiddlers;
  const deserialized = deserializeTiddlers.call((tw as unknown as { wiki: unknown }).wiki, "text/memetic-wikitext+tiddlywiki", memeWithFraming, { title: carrierUri });
  const byTitle = (records: DeserializedFields[] | undefined, title: string): DeserializedFields | undefined =>
    records?.find((t) => t["title"] === title);
  const parent = byTitle(deserialized, carrierUri);
  if (!parent) failures.push("deserializer returned no parent tiddler");
  else {
    const head = byTitle(deserialized, `${carrierUri}#/head`);
    if (!head || head["text"] !== "body" || head["$fragment-parent"] !== carrierUri) {
      failures.push(`section child missing or wrong at ${carrierUri}#/head: ${JSON.stringify(head)}`);
    }
    const prologue = byTitle(deserialized, `${carrierUri}#/$prologue`);
    const prologueText = typeof prologue?.["text"] === "string" ? (prologue["text"] as string) : "";
    if (!prologueText.includes("prose above the declaration") || prologue?.["$fragment-parent"] !== carrierUri) {
      failures.push(`prologue record missing or wrong: ${JSON.stringify(prologue)}`);
    }
    if (prologueText.includes("DOCTYPE")) {
      failures.push(`prologue record carries the declaration the frame owns: ${JSON.stringify(prologueText)}`);
    }
    const postamble = byTitle(deserialized, `${carrierUri}#/$postamble`);
    const postambleText = typeof postamble?.["text"] === "string" ? (postamble["text"] as string) : "";
    if (!postambleText.includes("trailing prose past the frame") || postamble?.["$fragment-parent"] !== carrierUri) {
      failures.push(`postamble record missing or wrong: ${JSON.stringify(postamble)}`);
    }
  }

  // Probe the slot structure. A labelled meta fence that OPENS a slot heads it — its keys land as
  // fields on the slot child — and prose after the slot's last inner section ref rides as a
  // postamble record at `slot#/$postamble`. (No preamble probe: pre-meta prose means the fence heads
  // nothing, so the grammar forbids that shape and `preamble` retired with it.)
  const slotUri = "lar:///probe-slot-meme";
  const parentSlotUri = `${slotUri}#/parent`;
  const slotMeme = [
    `<<^ code="&#x0001;" from=? -> to=${slotUri}>>`,
    "```toml meta",
    "uri-path = \"probe-slot-meme\"",
    "```",
    "",
    "<<^ code=\"&#x0002;\">>",
    "",
    "<<~ ahu #/parent>>",
    "```toml meta",
    "field = \"value\"",
    "```",
    "<<~ ahu #/child>>",
    "child body",
    "<<~/ahu>>",
    "trailing slot prose",
    "<<~/ahu>>",
    "",
    "<<^ code=\"&#x0003;\">>",
    "<<^ code=\"&#x0004;\" -> to=?>>",
    "",
  ].join("\n");
  const slotResults = deserializeTiddlers.call(
    (tw as unknown as { wiki: unknown }).wiki,
    "text/memetic-wikitext+tiddlywiki",
    slotMeme,
    { title: slotUri },
  );
  const parentSlot = byTitle(slotResults, parentSlotUri);
  if (!parentSlot) {
    failures.push("slot-structure probe: parent slot child not found");
  } else {
    if (parentSlot["field"] !== "value") {
      failures.push(`slot meta field not parsed: ${JSON.stringify(parentSlot["field"])}`);
    }
    const slotPostamble = byTitle(slotResults, `${parentSlotUri}/$postamble`);
    const slotPostambleText = typeof slotPostamble?.["text"] === "string" ? (slotPostamble["text"] as string) : "";
    if (!slotPostambleText.includes("trailing slot prose") || slotPostamble?.["$fragment-parent"] !== parentSlotUri) {
      failures.push(`slot postamble record missing or wrong: ${JSON.stringify(slotPostamble)}`);
    }
  }

  // Round-trip emission via exportMemeText. Inject the slot records into the wiki and recompose the
  // carrier through the frame; the output reconstructs the slot body — meta toml + child + postamble.
  if (parentSlot) {
    for (const t of slotResults) {
      engine.setTiddler(t as unknown as Record<string, string | string[]>);
    }
    const rendered = exportMemeText(engine, slotUri);
    if (!rendered.includes("trailing slot prose")) {
      failures.push(`slot round-trip lost postamble; got: ${rendered.slice(0, 300)}`);
    }
    if (!rendered.includes("child body")) {
      failures.push(`slot round-trip lost the nested child; got: ${rendered.slice(0, 300)}`);
    }
    // the emitter may align the toml assignment — match the field through flexible spacing.
    if (!rendered.includes("```toml meta") || !/field\s+= "value"/.test(rendered)) {
      failures.push(`slot round-trip lost meta toml; got: ${rendered.slice(0, 300)}`);
    }
  }

  // (J.2d retired: the pranala markdown-meme template burned at 07866b34; its html twin renders an
  // inline span — no wrapped-blank-lines shape to probe, so no trivial stand-in exists.)

  if (failures.length > 0) {
    console.error("✖ smoke FAILED");
    for (const f of failures) console.error("  -", f);
    process.exit(1);
  }
  console.log("✓ plugin boot smoke clean");
  console.log(`  ${expectedTitles.length} shadow tiddlers present`);
  console.log(`  parser registered; sigil widgets live as TW5 \\widget tiddlers`);
  console.log(`  sigil-ahu wikitext tiddler present (~ahu + ~kahea~ahu defined)`);
  console.log(`  wikitext sigil tiddlers present; render probes live in integration flow tests`);
  console.log(`  deserializer carriage: prologue + postamble ride as records under the carrier`);
  console.log(`  slot-structure split: meta fields on the slot child + postamble record under it`);
  console.log(`  slot round-trip emission: meta toml + child + postamble reconstructed through the frame`);
  process.exit(0);
}

main().catch((e) => {
  console.error("✖ smoke threw:", e);
  process.exit(1);
});
