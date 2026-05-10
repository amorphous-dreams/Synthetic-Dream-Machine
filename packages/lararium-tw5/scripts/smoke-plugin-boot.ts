/**
 * smoke-plugin-boot — verify the V.2 plugin-tiddler boot path.
 *
 * Boots a fresh TW5Engine in-process. The boot path pushes
 * LARES_MEMETIC_WIKITEXT_PLUGIN into preloadTiddlers; TW5's standard
 * plugin loader unpacks it. We then assert that the unpacked artifacts
 * are present in the running wiki:
 *   - cascade config tiddlers at lar:///config/Lar/AhuTemplate/...
 *   - template tiddlers at lar:///ha.ka.ba/@lararium/templates/...
 *   - global mount at lar:///mounts/lar-meme-split
 *   - parser registered for text/x-memetic-wikitext
 *   - widget classes registered for $ahu, $kau, $lar-meme-split
 *
 * Exit nonzero if any check fails.
 */
import { TW5Engine } from "../src/tw5-vm.js";

async function main(): Promise<void> {
  const engine = new TW5Engine();
  await engine.boot();

  const failures: string[] = [];
  const wiki = engine.wiki;

  const expectedTitles = [
    "lar:///plugins/lares/memetic-wikitext",
    "lar:///config/Lar/AhuTemplate/markdown-meme",
    "lar:///config/Lar/AhuTemplate/html",
    "lar:///mounts/lar-meme-split",
    "lar:///ha.ka.ba/@lararium/templates/ahu/markdown-meme",
    "lar:///ha.ka.ba/@lararium/templates/ahu/html",
    "lar:///ha.ka.ba/@lararium/templates/meme/markdown-meme",
  ];
  for (const title of expectedTitles) {
    if (!wiki.getTiddler(title)) failures.push(`missing tiddler: ${title}`);
  }

  // Probe TW5 module registry for the parser + widgets.
  const tw = (engine as unknown as { _tw: { Wiki?: { parsers?: Record<string, unknown> }; modules?: { types?: Record<string, Record<string, unknown>> } } })._tw;
  const parsers = tw?.Wiki?.parsers ?? {};
  if (!parsers["text/x-memetic-wikitext"]) failures.push("parser not registered: text/x-memetic-wikitext");

  const widgetMods = tw?.modules?.types?.widget ?? {};
  for (const expected of ["ahu", "kau", "lar-meme-split"]) {
    const found = Object.keys(widgetMods).some((title) => title.includes(expected));
    if (!found) failures.push(`widget module not found in registry: ${expected}`);
  }

  // Probe ahu cascade — render a tiny meme and confirm output is non-empty.
  const sample = "<<~ ahu #probe >>\nhello\n<<~/ahu >>";
  let renderedHTML = "";
  try {
    renderedHTML = engine.renderText(sample);
  } catch (e) {
    failures.push(`renderText threw: ${(e as Error).message}`);
  }
  if (!renderedHTML.trim()) failures.push("renderText returned empty");

  // Probe deserializer prologue + postamble capture.
  // Synthesize a single-meme carrier with DOCTYPE prologue and trailing
  // commentary postamble; deserialize via $tw.wiki.deserializeTiddlers
  // (the plugin's tiddlerdeserializer registration); verify both fields
  // land on the parent.
  const memeWithFraming = [
    "<!-- <<~ !DOCTYPE = lar:///probe-meme >> -->",
    "",
    "<<~&#x0001; ? -> lar:///probe-meme >>",
    "<<~ ahu #head >>",
    "body",
    "<<~/ahu >>",
    "<<~&#x0003;>>",
    "",
    "trailing prose after etx",
  ].join("\n");
  type DeserializedFields = Record<string, string | string[]>;
  const deserializeTiddlers = (tw as unknown as { wiki: { deserializeTiddlers(t: string, x: string, b: Record<string, string>): DeserializedFields[] } }).wiki.deserializeTiddlers;
  const deserialized = deserializeTiddlers.call((tw as unknown as { wiki: unknown }).wiki, "text/x-memetic-wikitext", memeWithFraming, { title: "lar:///probe-meme" });
  const parent = deserialized?.[0];
  if (!parent) failures.push("deserializer returned no parent tiddler");
  else {
    if (typeof parent["prologue"] !== "string" || !(parent["prologue"] as string).includes("DOCTYPE")) {
      failures.push(`prologue missing or wrong: ${JSON.stringify(parent["prologue"])}`);
    }
    if (typeof parent["postamble"] !== "string" || !(parent["postamble"] as string).includes("trailing prose")) {
      failures.push(`postamble missing or wrong: ${JSON.stringify(parent["postamble"])}`);
    }
  }

  if (failures.length > 0) {
    console.error("✖ smoke FAILED");
    for (const f of failures) console.error("  -", f);
    process.exit(1);
  }
  console.log("✓ plugin boot smoke clean");
  console.log(`  ${expectedTitles.length} shadow tiddlers present`);
  console.log(`  parser + widgets registered`);
  console.log(`  ahu render produced ${renderedHTML.length} bytes of HTML`);
  console.log(`  deserializer captured prologue + postamble fields on parent`);
  process.exit(0);
}

main().catch((e) => {
  console.error("✖ smoke threw:", e);
  process.exit(1);
});
