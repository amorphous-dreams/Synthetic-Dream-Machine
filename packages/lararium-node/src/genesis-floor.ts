/**
 * The floor holds only the carriers of tracked `bags/lares` and `bags/lararium`, cut history-free
 * and read-only under every recipe. Non-carrier `.md`, `.md.meta` and `.txt` files stay outside it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { carrierFiles, declaresCarrier, rootMetaFields, deserializeCarrier } from "@lararium/tw5";
import { verdict } from "@lararium/memetic-frame";
import { carrierBaseRelPath } from "./bag-paths.js";
import { cutFloorSnapshot, floorManifestBytes, floorManifestCid, type FloorManifest, type FloorSnapshot } from "@lararium/mesh";

export function cutGenesisFloor(opts: { repoRoot: string; engine: string; grammar: string; plugins: string }): { manifest: FloorManifest; manifestCid: string; manifestBytes: Uint8Array; lares: FloorSnapshot; lararium: FloorSnapshot; laresRows: number; larariumRows: number } {
  const bags: Record<"lares" | "lararium", Record<string, { tiddler: { title: string; [key: string]: unknown } }>> = { lares: {}, lararium: {} };
  const titles: Record<"lares" | "lararium", Set<string>> = { lares: new Set(), lararium: new Set() };
  for (const path of carrierFiles(opts.repoRoot)) {
    const bag = path.startsWith("bags/lares/") ? "lares" : path.startsWith("bags/lararium/") ? "lararium" : null;
    if (!bag) continue;
    // The ingest walk excludes each bag's root manifest; its metadata belongs to the vessel, not a tiddler row.
    if (path === `bags/${bag}/meta.mem`) continue;
    let text: string;
    try { text = readFileSync(join(opts.repoRoot, path), "utf8"); }
    catch (error) { throw new Error(`[genesis-floor] carrier read refused ${path}: ${String(error)}`); }
    if (!declaresCarrier(text)) continue;
    const declaredTitle = rootMetaFields(text).title;
    if (typeof declaredTitle !== "string" || !declaredTitle) throw new Error(`[genesis-floor] carrier title absent ${path}`);
    titles[bag].add(declaredTitle);
    const relative = path.replace(/^bags\/(?:lares|lararium)\//, "").replace(/\.(?:mem|tid)$/, "");
    const pathTitle = `lar:///${relative}`;   // the path under the bag spells the uri-path, root first
    const mapped = carrierBaseRelPath(declaredTitle);
    if (declaredTitle !== pathTitle || mapped !== relative) {
      throw new Error(`[genesis-floor] carrier title/path disagreement ${path}: declared ${declaredTitle}, expected ${pathTitle}`);
    }
    // The frame decides as ingest decides (`verdict`): a torn frame refuses the cut, by path.
    const frame = verdict(text);
    if (frame.kind === "torn") throw new Error(`[genesis-floor] carrier frame torn ${path}: ${frame.faults.map((f) => String((f as { code?: string }).code ?? f)).join(", ")}`);
    let reading;
    try { reading = deserializeCarrier(text, { title: declaredTitle }); }
    catch (error) { throw new Error(`[genesis-floor] carrier deserialize refused ${path}: ${String(error)}`); }
    for (const fields of reading.records) {
      const row = fields as Record<string, unknown> & { title: string };
      titles[bag].add(row.title);
      bags[bag][row.title] = { tiddler: row };
    }
  }
  for (const title of titles.lares) {
    if (titles.lararium.has(title)) throw new Error(`[genesis-floor] title ${title} rides both bags/lares and bags/lararium`);
  }
  const lares = cutFloorSnapshot(bags.lares);
  const lararium = cutFloorSnapshot(bags.lararium);
  const manifest: FloorManifest = { format: "lararium-floor/v1", engine: opts.engine, grammar: opts.grammar, plugins: opts.plugins, lares: lares.cid, lararium: lararium.cid };
  const manifestBytes = floorManifestBytes(manifest);
  return { manifest, manifestCid: floorManifestCid(manifest), manifestBytes, lares, lararium, laresRows: Object.keys(bags.lares).length, larariumRows: Object.keys(bags.lararium).length };
}
