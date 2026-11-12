import { TW5Engine } from "./tw5-vm.js";
import { MIRROR_TOKEN } from "./glass-token.js";
import { glassLocalTitle, makeGlassPortAdaptor } from "./glass-port-adaptor.js";
import type { GlassPortOptions } from "./glass-port-adaptor.js";
import type { PortWireRecord } from "@lararium/mesh/record-port";
import type { GlassDoor } from "./glass-root.js";
import { mountGlassCamera } from "./glass-camera.js";
import { openDefaultStory } from "./default-story.js";

export interface MirrorSeams {
  bootEngine?: () => void | Promise<void>; paint?: () => void;
  /** Runs on each record an adaptor of this mirror lands; the listener stands before the port's first message can arrive. */
  landed?: (change: { title: string }) => void;
  /** Runs when the island refuses a write the mirror sent: the person's edit did not stand. */
  refused?: (result: { title: string; txId: string; reason: string }) => void;
}
type Adaptor = ReturnType<typeof makeGlassPortAdaptor>;
const nameOf = (error: unknown): string => error instanceof Error ? error.name : "Error";

const HOUSE = "lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext";
/**
 * THE CENSUS AND THE GATE, before any module evaluates. A plugin of any type carrying a `syncadaptor` or a `saver` shadow, or a
 * promoted loose module carrying either type, refuses: the mirror is fed by the port alone. Every other person's plugin (not the
 * house plugin, not the core) evaluates only on a vessel whose boot inputs carry `sealedRest` (the browser store's sealed-rest
 * capability, S's row); until then the gate holds it by its own name and never defaults open.
 *
 * THE GATE READS CAPABILITY, NEVER A NAME. A theme or a language plugin whose shadows carry no JavaScript module evaluates no code:
 * it lays stylesheets, palettes and wikitext, so it passes the closed gate (the stock vanilla and snowwhite themes the boot set
 * carries by CID among them). A theme or language that carries a module waits on the seal like any plugin. The inputs come from
 * the vessel, never from a page value.
 */
export function censusPreloads(preloads: Record<string, unknown>[], sealedRest: boolean) {
  const refused: { title: string; kind: string }[] = [];
  const accepted = preloads.filter(plugin => {
    const title = String(plugin.title ?? "");
    if (plugin["plugin-type"] === undefined && ["syncadaptor", "saver"].includes(String(plugin["module-type"]))) {
      refused.push({ title, kind: "module-syncadaptor" });
      return false;
    }
    if (plugin["plugin-type"] === undefined) return true;
    let shadows: Record<string, unknown> = {};
    try { shadows = (JSON.parse(String(plugin.text ?? "{}")) as { tiddlers?: Record<string, unknown> }).tiddlers ?? {}; }
    catch { /* Invalid plugin content is left to the engine. */ }
    const fields = Object.values(shadows).filter((value): value is Record<string, unknown> => !!value && typeof value === "object");
    const dangerous = fields.some(value => ["syncadaptor", "saver"].includes(String(value["module-type"])));
    const evaluates = fields.some(value => value["module-type"] !== undefined || value["type"] === "application/javascript");
    const gated = plugin["plugin-type"] === "plugin" || evaluates;
    const kind = dangerous ? "plugin-syncadaptor" : gated && !sealedRest && title !== HOUSE && title !== "$:/core" ? "plugin-gate" : "";
    if (kind) refused.push({ title, kind });
    return !kind;
  });
  return { accepted, refused };
}

const STARTUP_ACTION = /(^|\s|\[\[)\$:\/tags\/StartupAction(\/[^\s\]]*)?(\]\]|\s|$)/;
const shadowsOf = (text: unknown): Record<string, unknown>[] | null => {
  try {
    const tiddlers = (JSON.parse(String(text ?? "{}")) as { tiddlers?: Record<string, unknown> }).tiddlers ?? {};
    return Object.values(tiddlers).filter((value): value is Record<string, unknown> => !!value && typeof value === "object");
  } catch { return null; }
};
/**
 * THE RECORD CENSUS: which of the wiki's own records the mirror's engine boots with. The whole handoff lands before the engine
 * stands, so a record reaches `$tw.preloadTiddlers` and TW5 unpacks a person's plugin, theme, palette or language at boot, the way
 * it unpacks a store a server handed it. A record boots with the engine unless one of these holds it back:
 *
 *   boot-set-shadow     its title names a tiddler of the verified boot set (the core, the house plugin, a stock theme): a record
 *                       never replaces bytes the vessel named by CID.
 *   plugin-syncadaptor  a plugin carrying a `syncadaptor` or `saver` shadow, or a loose module of either type: the mirror takes
 *   module-syncadaptor  its truth from the port alone.
 *   plugin-gate         a plugin that evaluates JavaScript, on a vessel whose store does not yet rest sealed (`sealedRest`); a
 *                       plugin that lays only wikitext, styles and data boots at once.
 *   (loose module)      a record carrying a `module-type` of its own: held with no alert, sealed or not. The island evaluates no
 *                       such record either (its module gate admits code by grant), so the surface runs none.
 *   (unreadable)        a plugin or module record whose body the port left out (a skinny open) or whose packed text will not
 *                       parse: nothing can read what it would evaluate, so it waits like a gated one.
 *   (module's namesake) a record that shares its title with a module the boot set packs: held with no alert, so the engine's own
 *                       module stays defined (the core's modules ride `$:/core` in the engine blob and take the same hold by the
 *                       `$:/core/modules/` prefix).
 *   (startup action)    a record tagged `$:/tags/StartupAction` (or a tag beneath it): TW5 runs those during boot, and the
 *                       island's own gate decides which of a wiki's startup actions run; the mirror runs none a second time.
 *                       Held with no alert: nothing was refused, the act belongs to the island.
 *
 * A held record still LANDS, after boot, as an ordinary record: the person sees it, edits it, deletes it. TW5 defines a module
 * and registers a plugin's modules during boot alone, so a record that lands after boot evaluates nothing; TW5's own ordering
 * keeps the gate, and no field of the record changes.
 */
export function censusRecords(records: readonly PortWireRecord[], bootTitles: ReadonlySet<string>, sealedRest: boolean, localFilter: readonly string[] = [],
  bootModules: ReadonlySet<string> = new Set()) {
  const preloaded: PortWireRecord[] = [];
  const held: PortWireRecord[] = [];
  const refused: { title: string; kind: string }[] = [];
  for (const record of records) {
    if (record.deleted || glassLocalTitle(record.title, localFilter)) continue;
    const fields = record.fields;
    const hold = (kind: string): void => { held.push(record); refused.push({ title: record.title, kind }); };
    if (bootTitles.has(record.title)) { hold("boot-set-shadow"); continue; }
    // A record that shares its title with a MODULE the boot set packs (house canon names a carrier and its module alike) waits out
    // the boot: TW5 defines no shadow module an ordinary tiddler overrides, so the record in the boot store would unseat the
    // engine's own code. Landed after boot it overrides the shadow's text and the module stands, exactly as in the island.
    if (bootModules.has(record.title) || record.title.startsWith("$:/core/modules/") || record.title.startsWith("$:/boot/")) { held.push(record); continue; }
    // A record's StartupAction runs where the island's own gate admits it, never a second time on a surface: it lands after boot.
    if (STARTUP_ACTION.test(fields["tags"] ?? "")) { held.push(record); continue; }
    const moduleType = fields["module-type"];
    const plugin = fields["plugin-type"] !== undefined;
    if (!plugin && moduleType === undefined) { preloaded.push(record); continue; }
    if (!plugin) {
      // A loose module record never evaluates in the island either (it lands there after the engine boots, and the island's own
      // module gate admits code by grant alone), so the mirror runs none: held with no alert, whatever the seal reads. House canon
      // carries such records as plain data.
      if (moduleType === "syncadaptor" || moduleType === "saver") hold("module-syncadaptor");
      else held.push(record);
      continue;
    }
    const shadows = record.omitted?.includes("text") ? null : shadowsOf(fields["text"]);
    if (shadows === null) { hold("plugin-gate"); continue; }
    const evaluates = shadows.some(value => value["module-type"] !== undefined || value["type"] === "application/javascript");
    if (shadows.some(value => value["module-type"] === "syncadaptor" || value["module-type"] === "saver")) hold("plugin-syncadaptor");
    else if (evaluates && !sealedRest) hold("plugin-gate");
    else preloaded.push(record);
  }
  return { preloaded, held, refused };
}
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

/**
 * The one door through which a main-thread engine boots: engine, port adaptor and camera open together and close
 * in reverse. The caller holds the D2 port binding and passes it as the transport; the mirror reads and writes
 * through that port alone. `deferPaint` leaves the camera unmounted until `paint()` runs, so a caller can
 * wait for the port's first snapshot before it paints.
 */
export async function openMirror(options: Omit<GlassPortOptions, "wiki" | "Tiddler" | "adopt" | "inheritTags" | "inheritDeferred" | "opened"> & {
  inputs: { coreBytes: Uint8Array; coreCid: string; preloadedTiddlers: Record<string, unknown>[]; sealedRest?: boolean };
  shadowRoot: ShadowRoot;
  deferPaint?: boolean;
  /** The first whole snapshot the boot's handoff read off the already-open port: the engine boots with these records. */
  opened?: { records: readonly PortWireRecord[] };
  /** The surface's host doors; the camera lends them to the engine's root. */
  door?: GlassDoor;
}, seams: MirrorSeams = {}) {
  const engine = new TW5Engine();
  let adaptor: Adaptor | undefined;
  let camera: ReturnType<typeof mountGlassCamera> | undefined;
  let closed = false;
  let wikiCensus: ReturnType<typeof censusRecords> | null = null;
  // The titles the port landed since the camera last refreshed: a refresh that carries one is a repaint the person never asked for, and it keeps their focus.
  const landedSince = new Set<string>();
  const noteLanding = (change: { title: string }): void => { landedSince.add(change.title); };
  const keepsFocus = (changes: Record<string, unknown>): boolean => {
    const landing = Object.keys(changes).some(title => landedSince.has(title));
    landedSince.clear();
    return landing;
  };
  const unmount = () => {
    if (closed) return;
    closed = true;
    camera?.unmount(); adaptor?.close(); engine.dispose(); engine.releaseGlass();
  };
  const paint = () => {
    if (camera || closed) return;
    try { seams.paint?.(); camera = mountGlassCamera({ tw: engine.$tw, shadowRoot: options.shadowRoot, keepsFocus, ...(options.door ? { door: options.door } : {}) }); }
    catch (error) { options.shadowRoot.replaceChildren(); throw new Error(`mirror-paint-threw:${nameOf(error)}`); }
  };
  try {
    try {
      await seams.bootEngine?.();
      const census = censusPreloads(options.inputs.preloadedTiddlers, options.inputs.sealedRest === true);
      const sealed = options.inputs.sealedRest === true;
      wikiCensus = options.opened ? censusRecords(options.opened.records, bootSetTitles(census.accepted), sealed, options.localFilter, bootSetModuleTitles(census.accepted)) : null;
      // THE STORE A SERVER HANDS A BROWSER: the verified boot set, then the wiki's own records, all in `$tw.preloadTiddlers`
      // before TW5 unpacks a plugin or defines a module.
      const store = [...census.accepted, ...(wikiCensus?.preloaded ?? []).map(record => ({ ...record.fields, title: record.title }))];
      await engine.boot({ bytes: options.inputs.coreBytes, sha256: options.inputs.coreCid }, store, MIRROR_TOKEN);
      const tw = engine.$tw;
      census.refused.push(...(wikiCensus?.refused ?? []));
      for (const refusal of census.refused) tw.wiki.addTiddler(new tw.Tiddler({ title: `$:/temp/lares/alert/refused/${refusal.kind}/${refusal.title}`, text: `Plugin refused: ${refusal.title}`, tags: ["$:/tags/Alert"] }));
      if (census.refused.length) options.shadowRoot.host.setAttribute("data-lar-refused-plugins", String(census.refused.length));
      const runtime = tw as unknown as { syncer?: unknown; syncadaptor?: unknown };
      if (runtime.syncer !== undefined || runtime.syncadaptor !== undefined) throw new Error("syncer-stood");
    } catch (error) { if (error instanceof Error && error.message === "syncer-stood") throw error; throw new Error(`mirror-engine-refused:${nameOf(error)}`); }
    const tw = engine.$tw;
    const { opened: _opened, door: _door, ...portOptions } = options;
    adaptor = makeGlassPortAdaptor({ ...portOptions, wiki: tw.wiki, Tiddler: tw.Tiddler,
      ...(wikiCensus ? { opened: { preloaded: wikiCensus.preloaded, held: wikiCensus.held } } : {}) });
    adaptor.onLanded(noteLanding);
    if (seams.landed) adaptor.onLanded(seams.landed);
    if (seams.refused) adaptor.onRefused(seams.refused);
    if (!options.deferPaint) paint();
    return {
      tw, get adaptor() { return adaptor!; }, paint, unmount,
      /** Open the wiki's default story; the caller runs it once the port's first whole snapshot has landed, never inside engine boot. */
      openStory: () => openDefaultStory(tw as never),
      /** Close the port and open a fresh one on the same engine; unsettled writes resend under their txId. */
      reopen(next: { transport: GlassPortOptions["transport"]; portId: string; width: GlassPortOptions["width"] }) {
        const adopt = adaptor!.pendingWrites();
        const inheritTags = adaptor!.tagImages();
        const inheritDeferred = adaptor!.deferredTitles();
        adaptor!.close();
        adaptor = makeGlassPortAdaptor({ ...portOptions, ...next, wiki: tw.wiki, Tiddler: tw.Tiddler, adopt, inheritTags, inheritDeferred });
        adaptor.onLanded(noteLanding);
        if (seams.landed) adaptor.onLanded(seams.landed);
        if (seams.refused) adaptor.onRefused(seams.refused);
        return adaptor;
      },
    };
  } catch (error) { unmount(); throw error; }
}
