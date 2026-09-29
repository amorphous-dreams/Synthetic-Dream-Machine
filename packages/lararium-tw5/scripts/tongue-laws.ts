/**
 * tongue-laws.ts — the TONGUE laws grammar-table-witness measures over the tiddlers
 * (sigil-mirror-flip's weave-per-tongue field, lar:///sigil.grammar.lane loop 4).
 *
 * Pure, isomorphic, no fs/disk access — takes a flat list of every sigil the shelf
 * declares (one entry per tiddler) and answers which of the five laws it breaks:
 *
 *   (a) a canonical sigil carries AT MOST ONE `lar-weave: primary` mirror per `lar-tongue`
 *   (b) no mirror NAME maps to two different canonicals (`lar-mirror-of` disagrees with itself)
 *   (c) no mirror NAME equals another sigil's CANONICAL name
 *   (d) every `lar-mirror-of` TARGET exists as a canonical (non-mirror) tiddler
 *   (e) every `lar-weave: primary` mirror declares a `lar-tongue`
 *
 * `weavePrimary`/`tongue` read the RAW `lar-weave`/`lar-tongue` fields, never the already-derived
 * `SigilRule.weave` — the shared converter (grammar-cache.ts) silently DROPS `weave` when
 * `lar-tongue` is absent (`if (tongue && weave === "primary") rule.weave = {tongue}`), which is
 * exactly the shape law (e) exists to catch; reading the derived field alone would hide it.
 */

export interface TongueEntry {
  /** The sigil's own name (tiddler-derived). */
  readonly name: string;
  /** `lar-mirror-of` value, when the tiddler carries one — absent means this entry is canonical. */
  readonly aliasFor?: string;
  /** Raw `lar-tongue` field value, when present. */
  readonly tongue?: string;
  /** Raw `lar-weave` field equals exactly `"primary"`. */
  readonly weavePrimary?: boolean;
}

export interface TongueViolation {
  /** Which law (a-e) this violation breaks. */
  readonly law: "a" | "b" | "c" | "d" | "e";
  readonly message: string;
}

export function checkTongueLaws(entries: readonly TongueEntry[]): TongueViolation[] {
  const violations: TongueViolation[] = [];
  const canonicalNames = new Set(entries.filter((e) => !e.aliasFor).map((e) => e.name));

  // (d) every lar-mirror-of target exists as a canonical tiddler
  for (const e of entries) {
    if (e.aliasFor && !canonicalNames.has(e.aliasFor)) {
      violations.push({ law: "d", message: `${e.name} -> ${e.aliasFor} — lar-mirror-of target is not a canonical (non-mirror) tiddler` });
    }
  }

  // (c) no mirror name equals another sigil's canonical name
  for (const e of entries) {
    if (e.aliasFor && canonicalNames.has(e.name)) {
      violations.push({ law: "c", message: `${e.name} — mirror name collides with a canonical sigil of the same name` });
    }
  }

  // (b) no mirror name maps to two different canonicals
  const targetsByMirrorName = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!e.aliasFor) continue;
    if (!targetsByMirrorName.has(e.name)) targetsByMirrorName.set(e.name, new Set());
    targetsByMirrorName.get(e.name)!.add(e.aliasFor);
  }
  for (const [name, targets] of targetsByMirrorName) {
    if (targets.size > 1) {
      violations.push({ law: "b", message: `${name} -> ${[...targets].sort().join(" / ")} — mirror name maps to ${targets.size} different canonicals` });
    }
  }

  // (a) a canonical sigil carries at most one lar-weave: primary mirror per lar-tongue
  const primariesByCanonicalTongue = new Map<string, string[]>();
  for (const e of entries) {
    if (!e.weavePrimary || !e.aliasFor || !e.tongue) continue;
    const key = `${e.aliasFor}::${e.tongue}`;
    if (!primariesByCanonicalTongue.has(key)) primariesByCanonicalTongue.set(key, []);
    primariesByCanonicalTongue.get(key)!.push(e.name);
  }
  for (const [key, mirrors] of primariesByCanonicalTongue) {
    if (mirrors.length > 1) {
      const [canonical, tongue] = key.split("::");
      violations.push({ law: "a", message: `${canonical} (${tongue}) — ${mirrors.length} primary mirrors declared (${mirrors.sort().join(", ")}), at most one allowed` });
    }
  }

  // (e) every lar-weave: primary mirror declares a lar-tongue
  for (const e of entries) {
    if (e.weavePrimary && !e.tongue) {
      violations.push({ law: "e", message: `${e.name} — lar-weave: primary with no lar-tongue declared` });
    }
  }

  return violations;
}
