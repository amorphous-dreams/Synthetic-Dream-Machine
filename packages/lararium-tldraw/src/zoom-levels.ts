/**
 * Lararium zoom-level ontology — five scales mapped to canvas zoom 0.0–∞.
 *
 * Mirrors the five chronometer scale positions from the Lararium signal HUD:
 *
 *   ⚡ Action    — edit / full text / atomic gesture
 *   ⚔️ Combat    — meme detail, ahu sockets visible
 *   🔍 Tactical  — story river, one meme per card
 *   ⚙️ Operational — graph overview, edge colors readable
 *   🗺️ Strategic  — galaxy, labels only
 *
 * The 0.0–1.0 band is the Lararium canonical scale; host canvases map it to
 * their own zoom range (tldraw uses arbitrary float; 1.0 ≈ "100% / fit").
 *
 * Thresholds are LOWER bounds (inclusive) for each level, ascending:
 *   zoom < OPERATIONAL_MIN  → Strategic
 *   zoom < TACTICAL_MIN     → Operational
 *   zoom < COMBAT_MIN       → Tactical
 *   zoom < ACTION_MIN       → Combat
 *   zoom >= ACTION_MIN      → Action
 */

export type ZoomLevel = "strategic" | "operational" | "tactical" | "combat" | "action";

export interface ZoomThresholds {
  /** 🗺️ Strategic: labels-only galaxy view — below this we are at max zoom-out */
  readonly OPERATIONAL_MIN: number;
  /** ⚙️ Operational: compact graph, edge colors readable */
  readonly TACTICAL_MIN: number;
  /** 🔍 Tactical: story-river, full frame name + URI slug */
  readonly COMBAT_MIN: number;
  /** ⚔️ Combat: detail view, ahu socket sub-frames visible */
  readonly ACTION_MIN: number;
}

/** Default thresholds for tldraw's zoom range (1.0 ≈ fit-to-viewport). */
export const ZOOM_THRESHOLDS: ZoomThresholds = {
  OPERATIONAL_MIN: 0.15,
  TACTICAL_MIN:    0.35,
  COMBAT_MIN:      0.80,
  ACTION_MIN:      1.50,
};

export function classifyZoom(zoom: number, thresholds = ZOOM_THRESHOLDS): ZoomLevel {
  if (zoom < thresholds.OPERATIONAL_MIN) return "strategic";
  if (zoom < thresholds.TACTICAL_MIN)    return "operational";
  if (zoom < thresholds.COMBAT_MIN)      return "tactical";
  if (zoom < thresholds.ACTION_MIN)      return "combat";
  return "action";
}

/** Canonical zoom value to use when snapping INTO a given level (mid-band). */
export const ZOOM_SNAP: Record<ZoomLevel, number> = {
  strategic:   0.08,
  operational: 0.22,
  tactical:    0.55,
  combat:      1.10,
  action:      1.80,
};

/**
 * Which tldraw page to show at each zoom level (three-page model).
 * Strategic + Operational → graph page (compact, overview)
 * Tactical → story-river page (default)
 * Combat + Action → current page unchanged (meme-detail driven by navState)
 */
export const ZOOM_PAGE: Record<ZoomLevel, "graph" | "story" | "preserve"> = {
  strategic:   "graph",
  operational: "graph",
  tactical:    "story",
  combat:      "preserve",
  action:      "preserve",
};
