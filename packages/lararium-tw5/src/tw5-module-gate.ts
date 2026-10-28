import { digestsEqual, formatDigest, SHA256_ALGO } from "@lararium/mesh/agile-digest";
import { hex } from "@lararium/mesh/crypto";
import { parsePonoLevel } from "./pono-level.js";
import type { TW5Instance } from "./types/tiddlywiki.js";

// Module gate thresholds on the 0–20 Level scale: mana ≥ 18, manao ≥ 17, manaoio ≥ 17.
const MODULE_MANA_THRESHOLD = 18;
const MODULE_MANAO_THRESHOLD = 17;
const MODULE_MANAOIO_THRESHOLD = 17;
// The has-stack model: a kernel-injectable module WEARS the
// tw5-module component in its stack (tags), never "implements an interface".
const MODULE_COMPONENT_URI = "lar:///ha.ka.ba/lararium/tw5/tw5-module";

export async function bootTrustedModules(tw: TW5Instance): Promise<void> {
  const wiki = tw.wiki;

  try {
    const titles: string[] = wiki.filterTiddlers(`[all[tiddlers]stack:has[${MODULE_COMPONENT_URI}]]`) ?? [];
    for (const title of titles) {
      const t = wiki.getTiddler(title);
      if (!t) continue;
      const f = t.fields as Record<string, string>;

      const mana       = parsePonoLevel(f["mana"]);
      const manao      = parsePonoLevel(f["manao"]);
      const manaoio    = parsePonoLevel(f["manaoio"]);
      if (
        mana === null ||
        manao === null ||
        manaoio === null ||
        mana < MODULE_MANA_THRESHOLD ||
        manao < MODULE_MANAO_THRESHOLD ||
        manaoio < MODULE_MANAOIO_THRESHOLD
      ) continue;

      const body = f["text"] ?? "";
      if (!body.trim() || body.startsWith("// Body injected")) continue;

      const claimedHash = f["source-sha256"] ?? "";
      if (!claimedHash || !(await verifySha256(body, claimedHash))) continue;

      const moduleType = f["module-type"] ?? "library";
      // A module defined after boot reaches the engine through `require` alone: TW5 applied the widget,
      // filter and startup types during boot and never again. The gate admits libraries and refuses the
      // rest by name.
      if (moduleType !== "library") {
        console.warn(`[module-gate] refused ${title}: module-type ${moduleType} applies at boot alone; the gate defines libraries`);
        continue;
      }
      wiki.addTiddler(new tw.Tiddler({
        title,
        type:          "application/javascript",
        "module-type": moduleType,
        text:          body,
        tags:          [],
      }));
      // TW5's module table reaches a module by the name another module `require`s: its title. The gate
      // defines each trusted module under that name, `define(name, moduleType, definition)`.
      tw.modules.define(title, moduleType, body);
    }
  } catch {
    /* filter unavailable — fall through */
  }
}

async function verifySha256(body: string, claimedHex: string): Promise<boolean> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return false;
    const buf = await subtle.digest("SHA-256", new TextEncoder().encode(body));
    // `hex()` emits no tag; `claimedHex` is the field's `source-sha256`, stored
    // TAGGED — tag the computed side, since a bare value parses as nothing.
    const actual = formatDigest(SHA256_ALGO, hex(new Uint8Array(buf)));
    return digestsEqual(actual, claimedHex);
  } catch {
    return false;
  }
}