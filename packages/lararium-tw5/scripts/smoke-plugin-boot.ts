/**
 * smoke-plugin-boot — verify the plugin-tiddler boot path.
 *
 * Boots a fresh TW5Engine in-process, passing LARES_MEMETIC_WIKITEXT_PLUGIN
 * as boot()'s plugin argument (the caller supplies plugins explicitly — the
 * engine preloads nothing by itself); TW5's standard plugin loader unpacks
 * it. We then assert that every static tiddler the plugin build packed is
 * present in the running wiki — the roll is DERIVED from the same source
 * manifest `build-plugin-tiddler.ts` reads, never hand-enumerated — plus
 * the plugin's own title and the parser's registration in TW5's own
 * registry (`tw.Wiki.parsers`), each a named assertion.
 *
 * Exit nonzero if any check fails.
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "@lararium/mesh";
import { frameCarrier } from "@lararium/memetic-frame";
import { TW5Engine } from "../src/tw5-vm.js";
import { LARES_MEMETIC_WIKITEXT_PLUGIN } from "../src/plugin-tiddler.generated.js";
import { exportMemeText } from "../src/meme-write.js";
import { TW5_CORE_SCRIPT_FILENAME, TW5_CORE_DIR } from "../src/generated-tw5-version.js";
import { readPluginSourceManifest } from "../plugin-build/source-manifest.js";
import { SOURCE_MANIFEST } from "../plugin-build/paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");

async function main(): Promise<void> {
  const corePath = path.join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
  const coreBlob = new Uint8Array(readFileSync(corePath));
  const engine = new TW5Engine();
  await engine.boot(coreBlob, [LARES_MEMETIC_WIKITEXT_PLUGIN as unknown as Record<string, unknown>]);

  const failures: string[] = [];
  const wiki = engine.wiki;

  // THE SHADOW ROLL IS DERIVED, NEVER ENUMERATED: every static tiddler the plugin build packed,
  // read from the same source manifest `build-plugin-tiddler.ts` itself writes and reads
  // (`readPluginSourceManifest` / `staticTiddlers`) — so a tiddler added to `tiddlers/*.tid` enters
  // this roll with no code change here, and a renamed or removed one leaves it the same way.
  const { manifest: sourceManifest } = readPluginSourceManifest(path.join(PKG_ROOT, SOURCE_MANIFEST));
  const expectedTitles = sourceManifest.staticTiddlers.map((t) => t.title);
  for (const title of expectedTitles) {
    if (!wiki.getTiddler(title)) failures.push(`missing tiddler: ${title}`);
  }

  // The plugin's own title and the parser registry are named assertions, not part of the derived
  // roll: pluginInfo is metadata ABOUT the packed tiddlers, not one of them, and the parser check
  // reads TW5's own registry (`tw.Wiki.parsers`), the house's real record of what registered.
  if (!wiki.getTiddler(LARES_MEMETIC_WIKITEXT_PLUGIN_URI)) {
    failures.push(`missing tiddler: ${LARES_MEMETIC_WIKITEXT_PLUGIN_URI}`);
  }
  const tw = (engine as unknown as { _tw: { Wiki?: { parsers?: Record<string, unknown> }; modules?: { types?: Record<string, Record<string, unknown>> } } })._tw;
  const parsers = tw?.Wiki?.parsers ?? {};
  if (!parsers["text/memetic-wikitext+tiddlywiki"]) failures.push("parser not registered: text/memetic-wikitext+tiddlywiki");

  // Sigil widgets (ahu, aka, kahea, kau, loulou, pranala, pranala-header) live as TW5 \widget
  // definitions in tiddler text, carried by the derived roll above — a render probe does not belong
  // in this low-level boot smoke, since `engine.renderText()` parses anonymous text without the
  // plugin's `$:/tags/Global` macro scope; integration flow tests own rendered widget behavior.

  // Probe the carriage the deserializer stands: the prologue above the declaration and the
  // postamble past the frame ride as RECORDS at `uri#/$prologue` and `uri#/$postamble`, each
  // pinned to the carrier by `$fragment-parent` — never as fields on the parent (a field cannot
  // carry a newline across a `.tid` projection). The declaration itself belongs to the FRAME: the
  // emitter mints it, so the prologue record keeps only what the author wrote beyond it.
  // A section child titles as a rooted path, `uri#/head`.
  const carrierUri = "lar:///probe-meme";
  // THE FRAME WRITER MINTS THE CARRIER; the probe supplies only what an author writes — the prose
  // above the declaration, the body, the prose past the release.
  const memeWithFraming = frameCarrier({
    head: { uri: carrierUri },
    prologue: "prose above the declaration\n\n",
    body: "```toml meta\nuri-path = \"probe-meme\"\n```\n\n<<~ ahu #/head>>\nbody\n<<~/ahu>>",
    postamble: "\ntrailing prose past the frame\n",
  });
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
  const slotMeme = frameCarrier({
    head: { uri: slotUri },
    declaration: null,
    body: [
      "```toml meta",
      "uri-path = \"probe-slot-meme\"",
      "```",
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
    ].join("\n"),
  });
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
