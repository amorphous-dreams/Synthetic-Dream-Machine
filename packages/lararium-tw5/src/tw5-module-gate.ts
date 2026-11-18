import { digestsEqual, formatDigest, SHA256_ALGO } from "@lararium/mesh/agile-digest";
import { hex } from "@lararium/mesh/crypto";
import type { TW5Instance } from "./types/tiddlywiki.js";
import { stackOf } from "./has-stack.js";

// The has-stack model: a kernel-injectable module WEARS the
// tw5-module component in its stack (tags), never "implements an interface".
const MODULE_COMPONENT_URI = "lar:///ha.ka.ba/lararium/tw5/tw5-module";

/** Read genesis and promoted preloads alone, never the composite a stage item joins after boot. */
export async function bootTrustedModules(tw: TW5Instance, preloaded: ReadonlySet<string>, granted: ReadonlyMap<string, Record<string, unknown>>): Promise<void> {
  const wiki = tw.wiki;

  let at = "(the module list)";
  try {
    const titles = new Set(wiki.filterTiddlers(`[all[tiddlers]stack:has[${MODULE_COMPONENT_URI}]]`) ?? []);
    for (const [title, record] of granted) {
      const rawTags = record["tags"];
      const tags = Array.isArray(rawTags) ? rawTags.filter((tag): tag is string => typeof tag === "string") : typeof rawTags === "string" ? rawTags.split(" ").filter(Boolean) : [];
      if (stackOf(tags, title).some(entry => entry.uri === MODULE_COMPONENT_URI)) titles.add(title);
    }
    for (const title of titles) {
      at = title;
      if (!preloaded.has(title)) continue;
      if (!granted.has(title)) {
        console.warn(`[module-gate] refused ${title}: no local grant (promote it by hand)`);
        continue;
      }
      const record = granted.get(title)!;
      const captured = new tw.Tiddler(record);
      const f = captured.fields as Record<string, string>;
      const live = wiki.getTiddler(title)?.fields as Record<string, unknown> | undefined;
      if (live && [...new Set([...Object.keys(f), ...Object.keys(live)])].some(key => JSON.stringify(live[key]) !== JSON.stringify(f[key]))) {
        console.warn(`[module-gate] ignored a replacement at ${title}: only the granted bytes admit`);
      }
      const rawTags = f["tags"] as unknown;
      const tags = Array.isArray(rawTags) ? rawTags.filter((tag): tag is string => typeof tag === "string") : typeof rawTags === "string" ? rawTags.split(" ").filter(Boolean) : [];
      if (!stackOf(tags, title).some(entry => entry.uri === MODULE_COMPONENT_URI)) continue;

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
  } catch (error) {
    // The walk stops here and fails closed for every later title; the modules admitted before it stay. Say where it died so a
    // half-admitted set never goes unseen.
    console.warn(`[module-gate] walk stopped at ${at}: ${error instanceof Error ? error.message : String(error)}`);
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
