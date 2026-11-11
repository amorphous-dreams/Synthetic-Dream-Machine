/**
 * override-bases — what a canon change does to the working overrides above it.
 *
 * A wiki composes its working layer (`wikis/<slug>/working`) over its canon bag (`bags/<slug>`). A working record of a
 * title canon holds overrides canon's record, and names the hash of the canon text it forked from (`overrideBase`,
 * `@lararium/mesh` `override-base.ts`). When canon moves underneath it, three cases part:
 *
 *   STALE      the override's text still says its base: a copy no hand changed. It RETRACTS (hard-remove, never a
 *              tombstone), so the new canon shows through.
 *   CONVERGED  the override's text says what canon now says: it carries nothing canon lacks, and it retracts too.
 *   DIVERGED   a hand changed the override, and canon moved off the base too. It STANDS OFF under a key and stays as it
 *              stood; a person answers by the key: take-working (keep the override, re-base it on the canon text that
 *              stands), take-canon (retract the override), or leaves it standing.
 *
 * A working-only title (canon holds none) never takes part: nothing here promotes, and nothing here writes canon.
 *
 * ONE OWNER PER GATE. INGEST's three-way gate (disk, synced base, canon render) decides what canon takes; this module
 * never weighs a disk byte. It reads the canon text before and after the gate ran, and decides only what the working
 * layer above it does. The standoff derives from the records alone (base, working text, canon text), so a listing reads
 * the same rows on any island that reaches the two layers, and no second ledger keeps them.
 */

import { sha256HexBytesSync, OVERRIDE_BASE_META, isEffectRecordUri, overrideBaseOf, overrideTextHash, type ChangeOrigin, type LarTiddlerRecord, type LarTiddlerStore } from "@lararium/mesh";

/** One diverged override standing off: the bags, the title, the key a person answers by, and the states it folds. */
export interface OverrideStandoff {
  readonly bag: string;
  readonly working: string;
  readonly title: string;
  readonly key: string;
  /** The canon text hash the override forked from. */
  readonly base: string;
  /** The override's own text hash. */
  readonly workingHash: string;
  /** The canon text hash that stands now, or null where canon holds the title no longer. */
  readonly canonHash: string | null;
}

/** What one sweep did to the working layer above a canon change. */
export interface OverrideSweep {
  readonly working: string;
  /** Overrides that retracted (stale or converged); canon shows through. */
  readonly retracted: readonly string[];
  /** Overrides that stand off under a key; each stays as it stood. */
  readonly standing: readonly OverrideStandoff[];
}

const live = (r: LarTiddlerRecord | null | undefined): r is LarTiddlerRecord => r !== null && r !== undefined && r.meta?.deleted !== true;
const textHashOf = (r: LarTiddlerRecord | null | undefined): string | null => (live(r) ? overrideTextHash(r.tiddler) : null);

/** The key one override standoff stands under: it folds the bags, the title and the three states it weighed. */
export function overrideStandoffKey(working: string, title: string, base: string, workingHash: string, canonHash: string | null): string {
  return sha256HexBytesSync(new TextEncoder().encode(JSON.stringify(["override", working, title, base, workingHash, canonHash]))).slice(0, 24);
}

/**
 * WHERE ONE OVERRIDE STANDS, read from its records alone: null where nothing stands off (no base, canon still says the
 * base, or the override says what canon says), else the standoff with its key.
 */
export function overrideStanding(bag: string, working: string, title: string, override: LarTiddlerRecord, canon: LarTiddlerRecord | null): OverrideStandoff | null {
  const base = overrideBaseOf(override);
  if (base === null) return null;
  const workingHash = overrideTextHash(override.tiddler);
  const canonHash = textHashOf(canon);
  if (canonHash === base || workingHash === base || workingHash === canonHash) return null;
  return { bag, working, title, key: overrideStandoffKey(working, title, base, workingHash, canonHash), base, workingHash, canonHash };
}

/** The live non-ledger titles a working layer holds, with their records. */
async function overridesIn(working: LarTiddlerStore): Promise<Map<string, LarTiddlerRecord>> {
  const out = new Map<string, LarTiddlerRecord>();
  for (const title of await working.listVisible()) {
    if (isEffectRecordUri(title)) continue;
    const record = await working.get(title);
    if (live(record)) out.set(title, record);
  }
  return out;
}

/**
 * Read what canon holds under each title the working layer overrides, BEFORE a canon change: the sweep after the
 * change weighs each override against it. A working layer that holds nothing reads an empty snapshot.
 */
export async function snapshotUnderOverrides(working: LarTiddlerStore, canon: LarTiddlerStore): Promise<Map<string, LarTiddlerRecord | null>> {
  const prior = new Map<string, LarTiddlerRecord | null>();
  for (const title of (await overridesIn(working)).keys()) prior.set(title, await canon.get(title));
  return prior;
}

/**
 * THE SWEEP AFTER A CANON CHANGE. Each override whose canon text moved since the snapshot weighs as above: stale and
 * converged retract (each only while it still holds the record weighed, so a hand's write since stands), diverged
 * stands off. An override that names no base (one forked before bases were kept) takes the canon text of the snapshot
 * as its base: the sweep writes that base onto it, its text untouched, so the standoff it stands in reads again later.
 */
export async function sweepOverrides(
  bag: string, workingBag: string, working: LarTiddlerStore, canon: LarTiddlerStore,
  prior: ReadonlyMap<string, LarTiddlerRecord | null>, origin: ChangeOrigin,
): Promise<OverrideSweep> {
  const retracted: string[] = [];
  const standing: OverrideStandoff[] = [];
  for (const [title, before] of prior) {
    const now = await canon.get(title);
    const beforeHash = textHashOf(before);
    const nowHash = textHashOf(now);
    if (beforeHash === nowHash) continue;                    // canon did not move under this title
    const override = await working.get(title);
    if (!live(override)) continue;
    const workingHash = overrideTextHash(override.tiddler);
    const base = overrideBaseOf(override) ?? beforeHash;
    if ((base !== null && workingHash === base) || workingHash === nowHash) {
      await working.remove(title, origin, { only: override });
      if (!live(await working.get(title))) retracted.push(title);
      continue;
    }
    // A base adopted here rides the record's meta alone; the override's text stands as the hand left it.
    const based = overrideBaseOf(override) === null && base !== null
      ? { tiddler: override.tiddler, meta: { ...(override.meta ?? {}), [OVERRIDE_BASE_META]: base } }
      : override;
    if (based !== override) await working.put(based, origin);
    const stands = overrideStanding(bag, workingBag, title, based, now);
    if (stands !== null) standing.push(stands);
  }
  return { working: workingBag, retracted, standing };
}

/** Every override standing off in one working layer, ordered by title. */
export async function listOverrideStandoffs(bag: string, workingBag: string, working: LarTiddlerStore, canon: LarTiddlerStore): Promise<OverrideStandoff[]> {
  const out: OverrideStandoff[] = [];
  for (const [title, override] of await overridesIn(working)) {
    const stands = overrideStanding(bag, workingBag, title, override, await canon.get(title));
    if (stands !== null) out.push(stands);
  }
  return out.sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
}

/** A person's answer to one override standoff. */
export type OverrideTake = "take-working" | "take-canon";

/**
 * ANSWER ONE STANDOFF BY ITS KEY. Where the override still stands under the key the person read: take-working re-bases
 * it on the canon text that stands (its text untouched; with canon gone, it keeps no base and reads as working-only),
 * take-canon retracts it. Where the states moved since, nothing writes and the answer names the key that stands.
 */
export async function answerOverride(
  take: OverrideTake, bag: string, workingBag: string, working: LarTiddlerStore, canon: LarTiddlerStore,
  title: string, key: string, origin: ChangeOrigin,
): Promise<{ readonly ok: true; readonly took: "working" | "canon" } | { readonly ok: false; readonly refusal: string; readonly why: string }> {
  const override = await working.get(title);
  const canonNow = await canon.get(title);
  const stands = live(override) ? overrideStanding(bag, workingBag, title, override, canonNow) : null;
  if (stands === null) return { ok: false, refusal: "no-standoff-stands", why: `no override of ${title} stands off in ${workingBag}` };
  if (stands.key !== key) return { ok: false, refusal: "standoff-key-moved", why: `the override of ${title} stands under key ${stands.key}; the answer names ${key}` };
  if (take === "take-canon") {
    await working.remove(title, origin, { only: override! });
    return live(await working.get(title))
      ? { ok: false, refusal: "standoff-key-moved", why: `a hand wrote ${title} while the answer travelled; the override stands` }
      : { ok: true, took: "canon" };
  }
  await working.put({ tiddler: override!.tiddler, meta: { ...(override!.meta ?? {}), [OVERRIDE_BASE_META]: stands.canonHash ?? "" } }, origin);
  return { ok: true, took: "working" };
}
