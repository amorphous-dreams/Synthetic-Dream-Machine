/**
 * console-readings — THE VESSEL'S READINGS AS TIDDLERS (plan/full-glass-whole-page, Land B). The page keeps one ordered
 * readings model (status, did, origin, relay, crossing, mode, wiki, storage, seed, floor, the page instruments) and the boot
 * phases, and the mirror's engine reads them as two tab-local JSON tiddlers the house view lists
 * (`lar:///ha.ka.ba/lararium/tw5/ui/vessel-console`):
 *
 *   `$:/temp/lares/vessel/readings` · an ARRAY of `{k, v, tone?}`, in the order the page first said each one (a keyed object
 *   lost its order through the store once, so the array carries it);
 *   `$:/temp/lares/vessel/phases` · an ARRAY of `{p, ms}`, each boot phase with the milliseconds since the page began.
 *
 * THE SEAM: page-side `tw.wiki.addTiddler` into the mirror's own engine. A `$:/temp/` title never crosses the port (the port's
 * local filter, `glass-port-adaptor.ts`), so a reading stays in this tab and never persists.
 *
 * SAFE ROWS ONLY. Every script in the mirror's wiki reads `$:/temp`, a person's admitted plugin included, and a stranger
 * reads the view. So the model takes the named public keys alone and refuses every other: an automerge document URL acts
 * as a capability to its document, so `wiki doc` and `oracle doc` land as "standing" or "absent", never the URL; the gate
 * key, the admit and fleet-join doors, the floor card, the place AID and every ceremony word stay page-native.
 */

export type ReadingTone = "ok" | "warn" | "err" | "veil";
export interface Reading { readonly k: string; readonly v: string; readonly tone?: ReadingTone }
export interface PhaseReading { readonly p: string; readonly ms: number }

export const READINGS_TITLE = "$:/temp/lares/vessel/readings";
export const PHASES_TITLE = "$:/temp/lares/vessel/phases";

/** The rows a stranger may read: the device's public facts and the page's own wording, in no particular order (the model keeps the order said). */
export const SAFE_READING_KEYS: ReadonlySet<string> = new Set([
  "status", "did", "origin", "relay", "crossing", "mode", "wiki", "wiki doc", "oracle doc", "storage", "seed",
  "floor", "floor release", "floor epoch", "LoAF", "heap after first paint",
]);
/** The keys whose value names a capability: the model keeps only whether one stands. */
const STANDING_ONLY: ReadonlySet<string> = new Set(["wiki doc", "oracle doc"]);

export interface ReadingsModel {
  /** Say a reading: a key said before keeps its place and takes the new value. False where the key stands outside the safe rows (nothing changes). */
  set(k: string, v: string | null, tone?: ReadingTone | ""): boolean;
  /** A boot phase the vessel reached; `ms` defaults to the page's own clock (an annotation, never a decision). */
  phase(p: string, ms?: number): void;
  /** A fresh boot: the phases start again; the readings keep their places and take their next values as the boot says them. */
  restartPhases(): void;
  list(): readonly Reading[];
  phases(): readonly PhaseReading[];
  /** Hear every change; the answer stops hearing. */
  subscribe(listener: () => void): () => void;
}

const toneOf = (tone: ReadingTone | "" | undefined): ReadingTone | undefined =>
  tone === "ok" || tone === "warn" || tone === "err" || tone === "veil" ? tone : undefined;

/** A page `row()` class (`"ok"`, `"warn"`, `"err"`, or none) as a reading's tone. */
export const toneOfClass = (cls: string): ReadingTone | undefined => toneOf(cls.trim() as ReadingTone);

export function createReadings(clock: () => number = () => (typeof performance !== "undefined" ? performance.now() : 0)): ReadingsModel {
  const rows: Reading[] = [];
  let steps: PhaseReading[] = [];
  const listeners = new Set<() => void>();
  const changed = (): void => { for (const listener of [...listeners]) listener(); };
  return {
    set(k, v, tone) {
      if (!SAFE_READING_KEYS.has(k)) return false;
      const value = STANDING_ONLY.has(k) ? (v ? "standing" : "absent") : (v ?? "absent");
      const t = toneOf(tone);
      const row: Reading = t ? { k, v: value, tone: t } : { k, v: value };
      const at = rows.findIndex((r) => r.k === k);
      if (at >= 0) {
        const was = rows[at]!;
        if (was.v === row.v && was.tone === row.tone) return true;
        rows[at] = row;
      } else rows.push(row);
      changed();
      return true;
    },
    phase(p, ms) { steps.push({ p, ms: Math.round(ms ?? clock()) }); changed(); },
    restartPhases() { if (steps.length === 0) return; steps = []; changed(); },
    list: () => rows.map((r) => ({ ...r })),
    phases: () => steps.map((s) => ({ ...s })),
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

/** The slice of a TW5 engine the mount writes through. */
export interface ReadingsEngine {
  wiki: { addTiddler(tiddler: unknown): void };
  Tiddler: new (fields: Record<string, unknown>) => unknown;
}

/**
 * Mount the model on a mirror's engine: write both tiddlers now (the replay a fresh engine needs after a reload) and again on
 * every change. The answer unmounts; the tiddlers stay in that engine, which dies with its mirror.
 */
export function mountReadings(tw: ReadingsEngine, model: ReadingsModel): () => void {
  const write = (): void => {
    tw.wiki.addTiddler(new tw.Tiddler({ title: READINGS_TITLE, type: "application/json", text: JSON.stringify(model.list()) }));
    tw.wiki.addTiddler(new tw.Tiddler({ title: PHASES_TITLE, type: "application/json", text: JSON.stringify(model.phases()) }));
  };
  write();
  return model.subscribe(write);
}

/** The page's one model: every site in the page says its readings here, and each mirror the page stands mounts it. */
export const pageReadings: ReadingsModel = createReadings();
