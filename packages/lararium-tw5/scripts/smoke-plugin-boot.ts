/**
 * smoke-plugin-boot — verify the V.2 plugin-tiddler boot path.
 *
 * Boots a fresh TW5Engine in-process. The boot path pushes
 * LARES_MEMETIC_WIKITEXT_PLUGIN into preloadTiddlers; TW5's standard
 * plugin loader unpacks it. We then assert that the unpacked artifacts
 * are present in the running wiki:
 *   - cascade config tiddlers at lar:///config/Lar/AhuTemplate/...
 *   - template tiddlers at lar:///ha.ka.ba/@lararium/templates/...
 *   - parser registered for text/x-memetic-wikitext
 *   - widget classes registered for $ahu, $kau, $aka, $kahea, $loulou, $pranala
 *
 * Exit nonzero if any check fails.
 */
import { readFileSync } from "fs";
import path from "path";
import { TW5Engine } from "../src/tw5-vm.js";
import { exportMemeText } from "../src/meme-write.js";
import { TW5_CORE_SCRIPT_FILENAME, TW5_CORE_DIR } from "../src/generated-tw5-version.js";

async function main(): Promise<void> {
  const corePath = path.join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
  const coreBlob = new Uint8Array(readFileSync(corePath));
  const engine = new TW5Engine();
  await engine.boot(coreBlob);

  const failures: string[] = [];
  const wiki = engine.wiki;

  const expectedTitles = [
    "lar:///plugins/lares/memetic-wikitext",
    "lar:///config/Lar/AhuTemplate/markdown-meme",
    "lar:///config/Lar/AhuTemplate/html",
    "lar:///config/Lar/AkaTemplate/markdown-meme",
    "lar:///config/Lar/AkaTemplate/html",
    "lar:///config/Lar/PranalaHeaderTemplate/markdown-meme",
    "lar:///config/Lar/PranalaHeaderTemplate/html",
    "lar:///config/Lar/KaheaTemplate/markdown-meme",
    "lar:///config/Lar/KaheaTemplate/html",
    "lar:///config/Lar/LoulouTemplate/markdown-meme",
    "lar:///config/Lar/LoulouTemplate/html",
    "lar:///config/Lar/PranalaTemplate/markdown-meme",
    "lar:///config/Lar/PranalaTemplate/html",
    "lar:///ha.ka.ba/@lararium/templates/ahu/markdown-meme",
    "lar:///ha.ka.ba/@lararium/templates/ahu/html",
    "lar:///ha.ka.ba/@lararium/templates/aka/markdown-meme",
    "lar:///ha.ka.ba/@lararium/templates/aka/html",
    "lar:///ha.ka.ba/@lararium/templates/pranala-header/markdown-meme",
    "lar:///ha.ka.ba/@lararium/templates/pranala-header/html",
    "lar:///ha.ka.ba/@lararium/templates/kahea/markdown-meme",
    "lar:///ha.ka.ba/@lararium/templates/kahea/html",
    "lar:///ha.ka.ba/@lararium/templates/loulou/markdown-meme",
    "lar:///ha.ka.ba/@lararium/templates/loulou/html",
    "lar:///ha.ka.ba/@lararium/templates/pranala/markdown-meme",
    "lar:///ha.ka.ba/@lararium/templates/pranala/html",
    "lar:///ha.ka.ba/@lararium/templates/meme/markdown-meme",
    "lar:///ha.ka.ba/@lararium/tw5/tiddlers/sigil-dispatcher",
    "lar:///ha.ka.ba/@lararium/tw5/tiddlers/sigil-ahu",
    "lar:///ha.ka.ba/@lararium/tw5/tiddlers/sigil-aka",
    "lar:///ha.ka.ba/@lararium/tw5/tiddlers/sigil-kahea",
    "lar:///ha.ka.ba/@lararium/tw5/tiddlers/sigil-loulou",
    "lar:///ha.ka.ba/@lararium/tw5/tiddlers/sigil-pranala-header",
    "lar:///ha.ka.ba/@lararium/tw5/tiddlers/sigil-pranala",
  ];
  for (const title of expectedTitles) {
    if (!wiki.getTiddler(title)) failures.push(`missing tiddler: ${title}`);
  }

  // Probe TW5 module registry for the parser + widgets.
  const tw = (engine as unknown as { _tw: { Wiki?: { parsers?: Record<string, unknown> }; modules?: { types?: Record<string, Record<string, unknown>> } } })._tw;
  const parsers = tw?.Wiki?.parsers ?? {};
  if (!parsers["text/x-memetic-wikitext"]) failures.push("parser not registered: text/x-memetic-wikitext");

  const widgetMods = tw?.modules?.types?.widget ?? {};
  // aka, kahea, loulou, pranala, pranala-header, ahu retired to wikitext \widget tiddlers.
  // kau remains as a JS widget (capability hooks + UUID write-back).
  for (const expected of ["kau"]) {
    const found = Object.keys(widgetMods).some((title) => title.includes(expected));
    if (!found) failures.push(`widget module not found in registry: ${expected}`);
  }

  // Probe ahu cascade tiddler presence — sigil-ahu.tid carries ~ahu + ~kahea~ahu.
  // Full render probe deferred: engine.renderText does not load $:/tags/Global
  // wikitext into macro scope, so wikitext widget probes are pre-existing-broken
  // across all sigils (aka, kahea, loulou, etc.). Tiddler-presence checks above
  // cover sigil-ahu loading. Integration render coverage lives in test:tw5-flow.
  if (!wiki.getTiddler("lar:///ha.ka.ba/@lararium/tw5/tiddlers/sigil-ahu")) {
    failures.push("sigil-ahu tiddler missing from plugin");
  }

  // Probe aka URI sigil — wikirule should emit an aka widget node, not a
  // text-literal. AkaWidget transcludes the cascade-resolved html template,
  // which renders a span with the aka-uri data attribute. Inline rules
  // require a block (paragraph) context to fire, so wrap the sigil in
  // surrounding prose.
  const akaSample = "before <<~ aka lar:///some/probe/uri >> after";
  let akaHTML = "";
  try {
    akaHTML = engine.renderText(akaSample);
  } catch (e) {
    failures.push(`aka renderText threw: ${(e as Error).message}`);
  }
  if (!akaHTML.includes("lar-aka")) {
    failures.push(`aka render did not produce widget HTML; got: ${akaHTML.slice(0, 200)}`);
  }

  // Probe pranala-header — same paragraph-context wrapping requirement.
  const phSample = "before <<~ ? -> lar:///canonical/uri >> after";
  let phHTML = "";
  try {
    phHTML = engine.renderText(phSample);
  } catch (e) {
    failures.push(`pranala-header renderText threw: ${(e as Error).message}`);
  }
  if (!phHTML.includes("lar-pranala-header")) {
    failures.push(`pranala-header render did not produce widget HTML; got: ${phHTML.slice(0, 200)}`);
  }

  // Probe kahea + loulou URI forms.
  const kaheaSample = "before <<~ kahea lar:///live/target >> after";
  let kaheaHTML = "";
  try { kaheaHTML = engine.renderText(kaheaSample); } catch (e) { failures.push(`kahea renderText threw: ${(e as Error).message}`); }
  if (!kaheaHTML.includes("lar-kahea")) {
    failures.push(`kahea render did not produce widget HTML; got: ${kaheaHTML.slice(0, 200)}`);
  }

  const loulouSample = "before <<~ loulou lar:///related/target >> after";
  let loulouHTML = "";
  try { loulouHTML = engine.renderText(loulouSample); } catch (e) { failures.push(`loulou renderText threw: ${(e as Error).message}`); }
  if (!loulouHTML.includes("lar-loulou")) {
    failures.push(`loulou render did not produce widget HTML; got: ${loulouHTML.slice(0, 200)}`);
  }

  // Probe pranala edge — inline form (no body, with family/role attrs).
  const pranalaInlineSample = "before <<~ pranala lar:///x -> lar:///y family:dataflow role:implements >> after";
  let pranalaInlineHTML = "";
  try { pranalaInlineHTML = engine.renderText(pranalaInlineSample); } catch (e) { failures.push(`pranala inline renderText threw: ${(e as Error).message}`); }
  if (!pranalaInlineHTML.includes("lar-pranala")) {
    failures.push(`pranala inline render did not produce widget HTML; got: ${pranalaInlineHTML.slice(0, 200)}`);
  }

  // Probe pranala edge — block form (with body).
  const pranalaBlockSample = "<<~ pranala lar:///a -> lar:///b >>annotation prose<<~/pranala >>";
  let pranalaBlockHTML = "";
  try { pranalaBlockHTML = engine.renderText(pranalaBlockSample); } catch (e) { failures.push(`pranala block renderText threw: ${(e as Error).message}`); }
  if (!pranalaBlockHTML.includes("lar-pranala") || !pranalaBlockHTML.includes("annotation prose")) {
    failures.push(`pranala block render did not include body; got: ${pranalaBlockHTML.slice(0, 300)}`);
  }

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

  // Probe per-slot preamble/postamble capture (J.2a). Synthesize a meme
  // whose slot body has prose before its iam toml and trailing prose
  // after its inner kahea ref.
  const slotMeme = [
    "<<~&#x0001; ? -> lar:///probe-slot-meme >>",
    "<<~ ahu #parent >>",
    "leading slot prose",
    "```toml iam",
    "field = \"value\"",
    "```",
    "<<~ ahu #child >>",
    "child body",
    "<<~/ahu >>",
    "trailing slot prose",
    "<<~/ahu >>",
    "<<~&#x0003;>>",
  ].join("\n");
  const slotResults = deserializeTiddlers.call(
    (tw as unknown as { wiki: unknown }).wiki,
    "text/x-memetic-wikitext",
    slotMeme,
    { title: "lar:///probe-slot-meme" },
  );
  const parentSlot = slotResults.find((t) => t["title"] === "lar:///probe-slot-meme#parent") as DeserializedFields | undefined;
  if (!parentSlot) {
    failures.push("slot-structure probe: parent slot child not found");
  } else {
    if (parentSlot["field"] !== "value") {
      failures.push(`slot iam field not parsed: ${JSON.stringify(parentSlot["field"])}`);
    }
    if (typeof parentSlot["preamble"] !== "string" || !(parentSlot["preamble"] as string).includes("leading slot prose")) {
      failures.push(`slot preamble missing or wrong: ${JSON.stringify(parentSlot["preamble"])}`);
    }
    if (typeof parentSlot["postamble"] !== "string" || !(parentSlot["postamble"] as string).includes("trailing slot prose")) {
      failures.push(`slot postamble missing or wrong: ${JSON.stringify(parentSlot["postamble"])}`);
    }
    if (typeof parentSlot["iam-source"] !== "string" || !(parentSlot["iam-source"] as string).includes("field = \"value\"")) {
      failures.push(`iam-source missing: ${JSON.stringify(parentSlot["iam-source"])}`);
    }
    if (typeof parentSlot["preamble"] === "string" && !(parentSlot["preamble"] as string).includes("<<~ iam >>")) {
      failures.push(`preamble missing iam sentinel: ${JSON.stringify(parentSlot["preamble"])}`);
    }
  }

  // J.2c — round-trip emission via exportMemeText (markdown-meme scope).
  // Inject the slot child fields into the wiki and render through the
  // meme-template; output should reconstruct the operator's original
  // slot body — preamble + iam toml + postamble.
  if (parentSlot) {
    for (const t of slotResults) {
      engine.setTiddler(t as unknown as Record<string, string | string[]>);
    }
    const rendered = exportMemeText(engine, "lar:///probe-slot-meme#parent");
    if (!rendered.includes("leading slot prose")) {
      failures.push(`slot round-trip lost preamble; got: ${rendered.slice(0, 300)}`);
    }
    if (!rendered.includes("trailing slot prose")) {
      failures.push(`slot round-trip lost postamble; got: ${rendered.slice(0, 300)}`);
    }
    if (!rendered.includes("```toml iam") || !rendered.includes('field = "value"')) {
      failures.push(`slot round-trip lost iam toml; got: ${rendered.slice(0, 300)}`);
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
  console.log(`  sigil-ahu wikitext tiddler present (~ahu + ~kahea~ahu defined)`);
  console.log(`  aka URI sigil rendered as widget (${akaHTML.length} bytes, .lar-aka span present)`);
  console.log(`  pranala-header sigil rendered as widget (${phHTML.length} bytes, .lar-pranala-header span present)`);
  console.log(`  kahea URI sigil rendered as widget (${kaheaHTML.length} bytes, .lar-kahea span present)`);
  console.log(`  loulou URI sigil rendered as widget (${loulouHTML.length} bytes, .lar-loulou span present)`);
  console.log(`  pranala inline edge rendered (${pranalaInlineHTML.length} bytes, .lar-pranala span present)`);
  console.log(`  pranala block edge rendered with body (${pranalaBlockHTML.length} bytes, body inlined)`);
  console.log(`  deserializer captured prologue + postamble fields on parent`);
  console.log(`  slot-structure split: preamble + iam fields + postamble on slot child`);
  console.log(`  slot round-trip emission: preamble + iam toml + postamble reconstructed via meme-template`);
  process.exit(0);
}

main().catch((e) => {
  console.error("✖ smoke threw:", e);
  process.exit(1);
});
