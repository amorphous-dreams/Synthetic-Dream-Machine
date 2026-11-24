/**
 * floor-card — THE FIVE DRIFTS, EACH BY ITS OWN WORD, AND THE ONE CARD THAT HOLDS THEM (floor-mu, slice S1).
 *
 * Five readings the house already computes share one word ("floor moved") in the speech; they move different layers and
 * carry different cures. This module names each by its own word and reads each into one row:
 *
 *   · disk lag          — `bags/` and `wikis/<slug>` files ahead of live canon or a workbench (the lay's lag);
 *   · working ahead     — edits resting in a wiki's working layer, short of canon (no door counts it yet: it reads `unread`, by name);
 *   · canon floor drift — live canon ahead of the floor this vessel serves, by carrier (`floor-drift`);
 *   · seed offer        — the genesis bake ahead of the founding record, ratchet by ratchet (the seed's floor reads "the seed's floor");
 *   · shadow tally      — whether mounts read the floor's offering clean, boot by boot (`floor-shadow`).
 *
 * A row reads `level`, `drifts` or `unread` (never a zero it did not count), and carries the carriers it names, the heads it
 * read, and the exact `lares` line for the next act. `floorCardFor` folds the rows into ONE state card per (vessel, Nexus):
 * deterministic bytes, so a second read of the same drifts changes nothing (the door answers `noop`), a new cause moves the
 * `floor-cause` field and re-arms it, and a level row leaves the card (a zero reading voids its row). It writes nothing: the
 * caller lands the card through the tiddler door, so the pressure from outside becomes a thing to act upon inside the wiki.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/research/floor-mu#/shape
 */
import { createHash } from "node:crypto";
import { ratchetsDiffer, type FloorDrift, type FloorShadowTally, type RatchetDifference } from "@lararium/mesh";

export const FLOOR_WORDS = ["disk lag", "working ahead", "canon floor drift", "seed offer", "shadow tally"] as const;
export type FloorWord = (typeof FLOOR_WORDS)[number];

/** `--grain` names: `lag` carries the disk lag and working ahead; each other grain carries its one drift. */
export const FLOOR_GRAINS = ["canon", "seed", "shadow", "lag", "all"] as const;
export type FloorGrain = (typeof FLOOR_GRAINS)[number];

export interface FloorDriftRow {
  readonly word:     FloorWord;
  readonly grain:    Exclude<FloorGrain, "all">;
  readonly state:    "level" | "drifts" | "unread";
  /** How many things drift; null where the reading did not count. */
  readonly count:    number | null;
  readonly carriers: readonly string[];
  /** The heads this reading read: a floor manifest, a seed CID, the canon source. */
  readonly heads:    readonly string[];
  /** One line: what the row reads, or why it reads unread. */
  readonly detail:   string;
  /** The exact `lares` line for the next act. */
  readonly next:     string;
}

/** The disk lag as the lay reads it (the CLI's `HouseLag`, narrowed to what the row weighs). */
export interface FloorLagInput {
  readonly source:   string;
  readonly holdings: ReadonlyArray<{ readonly new: readonly string[]; readonly changed: readonly string[] }>;
  readonly lag:      number;
  readonly benches:  ReadonlyArray<{ readonly slug: string; readonly planned: readonly string[] }>;
  readonly benchLag: number;
}

export interface FloorDriftInputs {
  /** The floor drift reading; `null` with `why` where it does not read, `undefined` where the vessel answers none. */
  readonly canon:  { readonly drift: FloorDrift | null | undefined; readonly why?: string | undefined };
  /** The seed (offered) against the founding record; null where none reads. */
  readonly seed:   { readonly cid: string; readonly ratchets: readonly RatchetDifference[] } | null;
  readonly seedWhy?: string | undefined;
  readonly shadow: FloorShadowTally | null;
  /** The lay's lag; `null` where it did not read, `undefined` where this reading holds no lay (the vessel's own answer). */
  readonly lag:    FloorLagInput | null | undefined;
  readonly lagWhy?: string | undefined;
}

/** The seed side speaks its floor by this name, so "the floor" names the canon floor alone. */
const seedRatchet = (r: RatchetDifference): string => `${r.ratchet === "floor" ? "the seed's floor" : r.ratchet} ${r.reading}`;

const named = (items: readonly string[], cap = 6): string => `${items.slice(0, cap).join(", ")}${items.length > cap ? `, … ${items.length - cap} more` : ""}`;

export const CANON_NEXT = "lares nexus release floor-release.json --cut";
export const SEED_NEXT = "lares vessel floor seed";
export const SHADOW_NEXT = "lares vessel read";
export const LAG_NEXT = "lares vessel lay --lag";
export const WORKING_NEXT = "lares meme offer promote <cid>";

/** Read the five drifts into their five rows, in the house's fixed order. */
export function readFloorDrifts(input: FloorDriftInputs): FloorDriftRow[] {
  const rows: FloorDriftRow[] = [];

  // disk lag
  if (input.lag === undefined || input.lag === null) {
    rows.push({ word: "disk lag", grain: "lag", state: "unread", count: null, carriers: [], heads: [],
      detail: input.lag === null ? `unread (${input.lagWhy ?? "the lay's lag read nowhere"})` : "unread (the lay reads the disk lag; `lares vessel floor status` carries it)", next: LAG_NEXT });
  } else {
    const l = input.lag;
    const carriers = [...new Set([...l.holdings.flatMap((h) => [...h.new, ...h.changed]), ...l.benches.flatMap((b) => b.planned)])].sort();
    const count = l.lag + l.benchLag;
    const next = [l.lag > 0 ? "lares vessel lay --apply --yes" : null, l.benchLag > 0 ? "lares vessel lay --workbench --apply" : null].filter((s) => s !== null).join(" · ");
    rows.push({ word: "disk lag", grain: "lag", state: count > 0 ? "drifts" : "level", count, carriers, heads: [`canon source ${l.source}`],
      detail: count > 0 ? `${l.lag} canon carrier(s) and ${l.benchLag} workbench carrier(s) trail the disk` : `canon and workbenches stand level with ${l.source}`,
      next: next === "" ? LAG_NEXT : next });
  }

  // working ahead
  rows.push({ word: "working ahead", grain: "lag", state: "unread", count: null, carriers: [], heads: [],
    detail: "unread (no door counts a wiki's working-layer edits ahead of canon yet; floor-mu names it a later slice)", next: WORKING_NEXT });

  // canon floor drift
  const d = input.canon.drift;
  if (d === undefined || d === null) {
    rows.push({ word: "canon floor drift", grain: "canon", state: "unread", count: null, carriers: [], heads: [],
      detail: `unread (${d === undefined ? "the standing vessel answers no drift reading: its build carries none, and a refresh brings it" : input.canon.why ?? "no reason named"})`, next: CANON_NEXT });
  } else {
    rows.push({ word: "canon floor drift", grain: "canon", state: d.count > 0 ? "drifts" : "level", count: d.count, carriers: d.carriers, heads: [`floor ${d.manifest}`],
      detail: d.count > 0 ? `${d.count} carrier(s) of live canon stand ahead of the floor this vessel serves` : "the floor this vessel serves carries every live canon carrier", next: CANON_NEXT });
  }

  // seed offer
  if (input.seed === null) {
    rows.push({ word: "seed offer", grain: "seed", state: "unread", count: null, carriers: [], heads: [],
      detail: `unread (${input.seedWhy ?? "no seed reads here"})`, next: SEED_NEXT });
  } else {
    const moved = input.seed.ratchets.filter((r) => r.reading !== "same");
    rows.push({ word: "seed offer", grain: "seed", state: ratchetsDiffer(input.seed.ratchets) ? "drifts" : "level", count: moved.length,
      carriers: moved.map((r) => r.ratchet === "floor" ? "the seed's floor" : r.ratchet), heads: [`seed ${input.seed.cid}`],
      detail: moved.length > 0 ? `a newer seed waits: ${input.seed.ratchets.map(seedRatchet).join(" · ")}; the founding record keeps serving, and only a re-found takes it (floor adopt stays held)` : "the seed offered stands same on every ratchet",
      next: SEED_NEXT });
  }

  // shadow tally
  const cur = input.shadow?.current ?? null;
  if (cur === null) {
    rows.push({ word: "shadow tally", grain: "shadow", state: "unread", count: null, carriers: [], heads: [],
      detail: input.shadow === null ? "unread (no boot has read the shadow tally yet)" : "unread (no boot read the current floor yet)", next: SHADOW_NEXT });
  } else {
    const fields = cur.firstMismatch ? cur.firstMismatch.moved.map((m) => m.field) : [];
    rows.push({ word: "shadow tally", grain: "shadow", state: cur.mismatchBoots > 0 ? "drifts" : "level", count: cur.mismatchBoots, carriers: fields,
      heads: cur.floor ? [`floor ${cur.floor}`] : [],
      detail: cur.mismatchBoots > 0 ? `${cur.mismatchBoots} boot(s) mismatched (${fields.join(", ")} moved), ${cur.cleanBoots} clean, ${cur.unreadBoots} unread` : `clean across ${cur.cleanBoots} boot(s), ${cur.unreadBoots} unread; the flip stays the operator's`,
      next: SHADOW_NEXT });
  }
  return rows;
}

/** Whether a grain names this row. */
export const rowInGrain = (row: FloorDriftRow, grain: FloorGrain): boolean => grain === "all" || row.grain === grain;

/** One row as one line, by its own word: `canon floor drift   drifts  3  <detail> · next: <line>`. */
export function floorRowLine(row: FloorDriftRow): string {
  const count = row.count === null ? "-" : String(row.count);
  const names = row.carriers.length > 0 ? ` [${named(row.carriers)}]` : "";
  return `  ${row.word.padEnd(18)} ${row.state.padEnd(7)} ${count.padStart(3)}  ${row.detail}${names} · next: ${row.next}`;
}

/** The card a vessel keeps per Nexus: its title, fields and text, deterministic in the rows. */
export interface FloorCard {
  readonly title:  string;
  readonly text:   string;
  readonly fields: Readonly<Record<string, string>>;
  /** The rows the card names (the level ones leave it). */
  readonly rows:   readonly FloorDriftRow[];
}

const shortOf = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 12);

/** The card's title: one per vessel, one more per Nexus a charter names. */
export const floorCardTitle = (vessel: string, nexus?: string): string =>
  `lar:///ha.ka.ba/lares/floor/${shortOf(vessel)}${nexus ? `/${shortOf(nexus)}` : ""}`;

const cell = (s: string): string => s.replace(/\|/g, "&#124;").replace(/\r?\n/g, " ");

/** Fold the rows into the one card; level rows leave it, unread rows stay (never a zero it did not count). */
export function floorCardFor(rows: readonly FloorDriftRow[], who: { readonly vessel: string; readonly nexus?: string | undefined }): FloorCard {
  const standing = rows.filter((r) => r.state !== "level");
  const cause = shortOf(JSON.stringify(standing.map((r) => [r.word, r.state, r.count, r.carriers, r.heads])));
  const state = standing.some((r) => r.state === "drifts") ? "armed" : standing.length > 0 ? "unread" : "level";
  const title = floorCardTitle(who.vessel, who.nexus);
  const text = [
    `! floor.drift.reads`, "",
    state === "level" ? "Every drift this vessel reads stands level." : `This card names each drift by its own word, the carriers it reads, the heads it read, and the exact next \`lares\` line. A new cause re-arms it; a level reading voids its row.`,
    ...(standing.length > 0 ? ["", "|!word |!state |!count |!carriers |!heads |!detail |!next |",
      ...standing.map((r) => `|${r.word} |${r.state} |${r.count ?? "-"} |${cell(named(r.carriers, 12))} |${cell(r.heads.join(", "))} |${cell(r.detail)} |\`${cell(r.next)}\` |`)] : []),
    "", "Read it again: `lares vessel floor status` (`--grain canon|seed|shadow|lag|all`).", "",
  ].join("\n");
  return {
    title, text, rows: standing,
    fields: { tags: "floor-card", "floor-state": state, "floor-cause": cause, "floor-vessel": shortOf(who.vessel), ...(who.nexus ? { "floor-nexus": shortOf(who.nexus) } : {}) },
  };
}
