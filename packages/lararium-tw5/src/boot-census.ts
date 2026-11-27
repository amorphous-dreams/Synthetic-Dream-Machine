/**
 * boot-census — the one home of the rule that decides which of a wiki's records may join TiddlyWiki's boot store
 * (`$tw.preloadTiddlers`) and which wait for boot to end and land as waves.
 *
 * TWO BOOTS READ IT, ONE SHAPE: the glass mirror (`glass-mirror.ts`, "the store a server hands a browser") and the island's wave
 * zero (`island-seed.ts`, the seed handed to `bootTw5`) each run census partition -> nalu form (`nalu-form.ts`) ->
 * `$tw.preloadTiddlers`. The glass refuses one kind more, a syncer, since it takes its truth from the port alone.
 *
 * A record that shares its title with the boot set, or with a module the boot set defines, or that sits under `$:/core/modules/`
 * or `$:/boot/`, never joins the boot store on either boot: TW5 defines no shadow module an ordinary tiddler overrides, so a
 * record there would unseat the engine's own code. Landed after boot it overrides the shadow's text.
 *
 * A leaf: no DOM, no engine, no import, so an island worker and the glass both read it.
 */

/** Every module the boot set defines: each shadow a boot-set plugin packs with a `module-type`, and each loose preload carrying one. */
export function bootSetModuleTitles(preloads: readonly Record<string, unknown>[]): Set<string> {
  const titles = new Set<string>();
  for (const preload of preloads) {
    if (preload["plugin-type"] === undefined) { if (preload["module-type"] !== undefined && typeof preload["title"] === "string") titles.add(preload["title"]); continue; }
    try {
      const packed = (JSON.parse(String(preload["text"] ?? "{}")) as { tiddlers?: Record<string, Record<string, unknown>> }).tiddlers ?? {};
      for (const [title, shadow] of Object.entries(packed)) if (shadow && shadow["module-type"] !== undefined) titles.add(title);
    } catch { /* a plugin whose text will not parse packs nothing */ }
  }
  return titles;
}

/** The titles a record may never take in the boot store: each boot-set preload's own title, and the kernel's. */
export function bootSetTitles(preloads: readonly Record<string, unknown>[]): Set<string> {
  const titles = new Set<string>(["$:/core", "$:/boot/boot.js", "$:/boot/bootprefix.js", "$:/library/sjcl.js"]);
  for (const preload of preloads) if (typeof preload["title"] === "string") titles.add(preload["title"]);
  return titles;
}

/** True where a record sits on ground the boot set owns: a boot-set title, a boot-set module's title, or the engine's own prefixes. */
export function bootSetOwns(title: string, bootTitles: ReadonlySet<string>, bootModules: ReadonlySet<string>): boolean {
  return bootTitles.has(title) || bootModules.has(title) || title.startsWith("$:/core/modules/") || title.startsWith("$:/boot/");
}

/** The census both boots share, built once over the boot set's own preloads. */
export interface BootCensus {
  readonly bootTitles: ReadonlySet<string>;
  readonly bootModules: ReadonlySet<string>;
}

export function bootCensusOf(bootPreloads: readonly Record<string, unknown>[]): BootCensus {
  return { bootTitles: bootSetTitles(bootPreloads), bootModules: bootSetModuleTitles(bootPreloads) };
}

/**
 * THE ISLAND'S RULE: every record the composition resolves joins the island's boot store, a module, a plugin and a startup action
 * included, so TiddlyWiki defines, unpacks and runs them at boot as it does any store's. Ground the boot set owns stays out: the
 * boot set carries it already, and a second copy would unseat the bytes the vessel named by CID.
 */
export function islandSeedPreloadable(title: string, census: BootCensus): boolean {
  return !bootSetOwns(title, census.bootTitles, census.bootModules);
}
