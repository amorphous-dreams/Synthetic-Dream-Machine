/**
 * house-root — the ONE cycle-free source for the named house root and the classes that stand beneath it,
 * plus the verbatim mempalace GUEST parent. Both `@lararium/node`'s vessel-paths.ts and this package's
 * palace-path.ts derive their homes from HERE, so the two views stay byte-identical without
 * value-duplication.
 *
 * This module stays DEPENDENCY-FREE (node builtins only). `@lararium/mempalace` sits BELOW `@lararium/node`
 * in the dep graph, so palace-path.ts imports it same-package while vessel-paths.ts imports it across the
 * existing `node → mempalace` edge (via the `@lararium/mempalace/house-root` subpath) — no cycle.
 *
 * ── ONE ROOT, NAMED ─────────────────────────────────────────────────────────────────────────────
 * `LAR_ROOT` names the house root, and nothing else stands in for it: no home directory, no XDG base. An
 * unnamed (or blank) root refuses by name ({@link HouseRootUnnamed}); the container sets `LAR_ROOT=/lar`.
 * Each level beneath the root carries one meaning, sorted by what survives a re-founding:
 *
 *   <root>/hearth       the spirits' sovereign homes (vessel · identity · nexus), the checkpoints and the
 *                       staging area. A re-founding clears this directory alone.
 *   <root>/sensoriums   the house's captured history (memory · mesh · memetic-wikitext): conversation memory the
 *                       machine took once and cannot take again, kept through every re-founding by where it stands.
 *   <root>/library      the acquired library: originals the house took in, kept through every re-founding.
 *   <root>/projections  the deliberate plaintext renders of the house's documents.
 *   <root>/config       the operator's settings (config.json, meta.json, the repo registry).
 *   <root>/cache        sweepable scratch (the ephemeral sensoriums).
 *   <root>/run          transient spool, sockets and levers.
 *
 * The Python mirror (`packages/lararium-sensorium/scripts/house_root.py`) holds the same table, and
 * `house-root-weld.test.ts` reads both and asserts them equal.
 *
 * Meme: lar:///ha.ka.ba/lararium/mempalace/house-root
 */

import { homedir } from "node:os";
import { join } from "node:path";

/** The refusal an unnamed house root raises. Its message names the cure: set `LAR_ROOT`. */
export class HouseRootUnnamed extends Error {
  override readonly name = "HouseRootUnnamed";
  constructor() {
    super("LAR_ROOT names no house root — set LAR_ROOT to the house root (the container sets /lar); no home directory stands in for it");
  }
}

/** The house root — `LAR_ROOT`, verbatim. Unset or blank refuses with {@link HouseRootUnnamed}: a blank root would
 *  hang every path under it off whatever cwd a process holds. */
export function larHouseRoot(): string {
  const root = process.env["LAR_ROOT"];
  if (root === undefined || root.trim() === "") throw new HouseRootUnnamed();
  return root;
}

/** `<root>/hearth` — the spirits' homes, the checkpoints and the staging area; a re-founding clears this directory
 *  and nothing outside it. */
export function larHearthHome(): string {
  return join(larHouseRoot(), "hearth");
}

/** `<root>/sensoriums` — every standing sensorium (memory, mesh, memetic-wikitext), each by its own name. The house's
 *  captured history stands in its own class beside the library, outside the hearth, so no re-founding reaches it. */
export function larSensoriumsHome(): string {
  return join(larHouseRoot(), "sensoriums");
}

/** `<root>/hearth/checkpoints` — the watermarks (projection, harvest); each re-derives from what it watches. */
export function larCheckpointsHome(): string {
  return join(larHearthHome(), "checkpoints");
}

/** `<root>/hearth/staging` — normalized copies a harvest stages before it lands them. */
export function larStagingHome(): string {
  return join(larHearthHome(), "staging");
}

/** `<root>/library` — the acquired library. It holds originals the house took in, so it stands outside the hearth
 *  and outlives every re-founding. */
export function larLibraryRoot(): string {
  return join(larHouseRoot(), "library");
}

/** `<root>/projections` — the deliberate plaintext renders of the house's documents. */
export function larProjectionsHome(): string {
  return join(larHouseRoot(), "projections");
}

/** `<root>/config` — the operator's settings: config.json, meta.json, the repo registry. */
export function larConfigHome(): string {
  return join(larHouseRoot(), "config");
}

/** `<root>/cache` — sweepable scratch (the ephemeral sensoriums). */
export function larCacheHome(): string {
  return join(larHouseRoot(), "cache");
}

/** `<root>/run` — transient spool, sockets and levers (the hook-pause marker). */
export function larRuntimeHome(): string {
  return join(larHouseRoot(), "run");
}

/**
 * The GUEST mempalace's PARENT store dir — the upstream-default `~/.mempalace`.
 *
 * No fiber of the memory sensorium and no house state: the lararium OWNS its content plane
 * ({@link memorySensoriumContentDir}), and this store stands as a GUEST — a comparator to measure against, and
 * the source of a deliberate one-way import Act. It follows the operator's home, never the house root. The
 * `MEMPALACE_PALACE_PATH` override — upstream's OWN relocation lever — rides with the CALLERS (it relocates the
 * chroma dir, not this parent), so this stays the pure default both agree on.
 */
export function mempalaceContentParent(): string {
  return join(homedir(), ".mempalace");
}

/**
 * The `memory` sensorium root — `<root>/sensoriums/memory`. Home to the li planes AND to the worldline
 * stores (the KG + the fork-DAG). It sits SOVEREIGN, never inside the guest comparator: a rite that paves the
 * comparator must never reach a plane the RUN writes.
 */
export function memorySensoriumDir(): string {
  return join(larSensoriumsHome(), "memory");
}

/**
 * The SOVEREIGN content plane — `<memory>/content`. The plane the capture path fills every turn, and therefore the
 * plane every reader must NAME: an unpassed palace path reaches into the guest silently.
 */
export function memorySensoriumContentDir(): string {
  return join(memorySensoriumDir(), "content");
}

/**
 * The sovereign li planes beside the content plane — `<memory>/{structure,form,persistence}`. Every reader NAMES
 * the plane it reads; the Python holders default to these SAME paths, so a caller that omits `--palace` still
 * lands true, and the caller names it regardless, so designation carries the authority.
 */
export function memorySensoriumStructureDir(): string {
  return join(memorySensoriumDir(), "structure");
}

export function memorySensoriumFormDir(): string {
  return join(memorySensoriumDir(), "form");
}

export function memorySensoriumPersistenceDir(): string {
  return join(memorySensoriumDir(), "persistence");
}
