/**
 * hearth-floor-pin-store — the floor pins a joinee keeps from its hearth's SIGNED fleet-join answer, one file per Nexus.
 *
 * House ruling "Floor pins", carrier (b): the answer carries the hearth's floor pin set under the PersonaGroup root's
 * signature; the land keeps it here, and the boot files it in the pair index under the hearth it dials
 * (`chooseHearthDial`'s `keptFloor`), so the joinee holds the oracle's pin before its first crossing.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/hearth-floor-pin-store
 */
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readGateBundlePin, type GateBundlePin } from "@lararium/mesh";
import { admitBundlePathFor } from "./admit-bundle.js";
import { atomicWriteFileSync } from "./fs-atomic.js";

/** Where a joinee keeps its hearth's floor pins at one Nexus: `<sealHome>/nexus/hearth-floor-pins/<aid>.json`. */
export function hearthFloorPinsPathFor(sealHome: string, aid: string): string {
  return join(dirname(admitBundlePathFor(sealHome, aid)), "..", "hearth-floor-pins", `${aid}.json`);
}

/** Keep the floor pins a signed answer carried, replacing any kept for the same Nexus. */
export function keepHearthFloorPins(sealHome: string, aid: string, pins: readonly GateBundlePin[]): void {
  const path = hearthFloorPinsPathFor(sealHome, aid);
  mkdirSync(dirname(path), { recursive: true });
  atomicWriteFileSync(path, JSON.stringify(pins, null, 2));
}

/** The floor pins kept for `aid`, each re-read as a floor pin; a torn file reads none. */
export function readKeptHearthFloorPins(sealHome: string, aid: string): GateBundlePin[] {
  try {
    const raw = JSON.parse(readFileSync(hearthFloorPinsPathFor(sealHome, aid), "utf8")) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((p) => { const read = readGateBundlePin(p); return "pin" in read && read.pin.tier === "floor" ? [read.pin] : []; });
  } catch { return []; }
}
