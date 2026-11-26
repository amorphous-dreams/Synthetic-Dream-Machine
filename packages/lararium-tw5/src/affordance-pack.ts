/**
 * affordance-pack — the reader every surface that answers before (or without) a vessel holds over the baked affordance pack.
 *
 * `scripts/build-affordance-pack.ts` renders every canon affordance carrier through the skin templates in a vessel-less
 * engine and writes ONE content-addressed file, `affordance-pack.json`, beside this package's `package.json`. The CLI's
 * `helpLines(door)` and its top-level index read it synchronously; the MCP seat reads the same file at seat build. A sleeping
 * vessel therefore answers the bytes the waking store renders, and help bytes never depend on vessel state.
 *
 * PURE DATA. The pack loads once, through `require` of the JSON (no `node:fs`, no environment read); a missing or unreadable
 * pack reads as an EMPTY pack, so every door falls to its legacy help rather than throwing at import, and witness W3 reads
 * the gap red with its cure.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/affordance
 */
import { createRequire } from "node:module";

export interface AffordancePackCarrier {
  /** The carrier's own title (canon's stable seat, `lar:///ha.ka.ba/lares/afford/<address>`); the pack keys it by address. */
  readonly title: string;
  readonly bcc: string | null;
  readonly role: string;
  readonly renders: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  /** The mcp skin's parameter descriptions, keyed by the mcp spelling. */
  readonly params: Readonly<Record<string, string>>;
  /** Per surface the carrier skins: the argument spellings its door takes. */
  readonly takes: Readonly<Record<string, readonly string[]>>;
  /** Per surface the carrier skins: every example and every cure, runnable. */
  readonly calls: Readonly<Record<string, readonly string[]>>;
}

export interface AffordancePackDoor {
  readonly addresses: readonly string[];
  readonly brief: string;
  readonly help: readonly string[];
}

export interface AffordancePack {
  readonly title: string;
  readonly hash: string;
  readonly carriers: Readonly<Record<string, AffordancePackCarrier>>;
  readonly routes: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly doors: Readonly<Record<string, AffordancePackDoor>>;
  readonly index: Readonly<Record<string, readonly string[]>>;
}

const EMPTY: AffordancePack = Object.freeze({ title: "", hash: "", carriers: {}, routes: {}, doors: {}, index: {} });

let loaded: AffordancePack | null = null;

/** The pack this binary baked (`../affordance-pack.json` from `src/` and from `dist/` alike); empty where none stands. */
export function affordancePack(): AffordancePack {
  if (loaded !== null) return loaded;
  try {
    loaded = createRequire(import.meta.url)("../affordance-pack.json") as AffordancePack;
  } catch {
    loaded = EMPTY;
  }
  return loaded;
}

/** Seat a pack for a test (a fixture bake); `null` restores the baked one. */
export function seatAffordancePack(pack: AffordancePack | null): void {
  loaded = pack;
}

/** The pack's hash, cut to twelve hex: the `source: pack@<hash12>` a render names. */
export function packHash12(pack: AffordancePack = affordancePack()): string {
  return pack.hash.replace(/^sha256-/, "").slice(0, 12);
}

/** A CLI door the pack flips (every affordance it skins holds a carrier), or undefined where the door still reads legacy help. */
export function packDoor(door: string, pack: AffordancePack = affordancePack()): AffordancePackDoor | undefined {
  return Object.prototype.hasOwnProperty.call(pack.doors, door) ? pack.doors[door] : undefined;
}

/** Every CLI door the pack flips, sorted. */
export function packDoors(pack: AffordancePack = affordancePack()): string[] {
  return Object.keys(pack.doors).sort();
}

/** The address a surface's spelling routes to (`cli` `oracle cast`, `mcp` `oracle_cast`), or undefined. */
export function packRoute(surface: string, spelling: string, pack: AffordancePack = affordancePack()): string | undefined {
  return pack.routes[surface]?.[spelling];
}

/** One carrier's render on one surface at one depth (`line`, `whole`, or a slot `#/takes`); undefined where the pack holds none. */
export function packRender(address: string, surface: string, depth: string, pack: AffordancePack = affordancePack()): readonly string[] | undefined {
  return pack.carriers[address]?.renders[surface]?.[depth];
}

/** The MCP skin of one tool: its description and each parameter's, from the carrier the tool's name routes to. */
export function packTool(tool: string, pack: AffordancePack = affordancePack()): { description: string; params: Readonly<Record<string, string>> } | undefined {
  const address = packRoute("mcp", tool, pack);
  const carrier = address === undefined ? undefined : pack.carriers[address];
  if (carrier === undefined) return undefined;
  return { description: (carrier.renders["mcp"]?.["whole"] ?? []).join("\n"), params: carrier.params };
}
