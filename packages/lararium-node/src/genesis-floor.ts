/**
 * The floor holds one snapshot per PUBLIC house-canon bag (`houseCanonSlugs` over the checkout's tracked `bags/<slug>` dirs: the
 * system canon `lares` and `lararium` always; every other holding but the Nexus's public board `crossroads`, and only where the
 * bag's own `meta.mem` declares `cap-tier = "public"`, `floorCarriesTier`), each cut from the tracked carriers alone, history-free
 * and read-only under every recipe. A bag declared under `public` (the referee's `contract` bag) never rides the public floor. Non-carrier `.md`, `.md.meta` and `.txt` files
 * stay outside it. The bake reads the checkout it builds from (`repoRoot`), never a house root.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { carrierFiles, declaresCarrier, rootMetaFields, deserializeCarrier } from "@lararium/tw5";
import { verdict } from "@lararium/memetic-frame";
import { carrierBaseRelPath, isPrivateProjectionSlug } from "./bag-paths.js";
import { cutFloorSnapshot, floorCarriesTier, floorManifestBytes, floorManifestCid, houseCanonSlugs, openFloorSnapshot, ownEntry, readFloorManifest, sha256HexBytesSync, FLOOR_MANIFEST_FORMAT, FLOOR_REQUIRED_SLUGS, type FloorManifest, type FloorSnapshot } from "@lararium/mesh";
import { readBagManifest } from "./bag-declare.js";
import { genesisCasDir, readGenesisSeed } from "./genesis-artifact.js";

/** The house-canon slugs a checkout's floor keys: the tracked `bags/` dirs a bake sees, read through `houseCanonSlugs`, each kept
 *  only where its own `meta.mem` declares a tier the floor carries (a bag that declares none reads `veil` and stays off). */
export function genesisFloorSlugs(repoRoot: string): string[] {
  let held: string[] = [];
  try {
    held = readdirSync(join(repoRoot, "bags"), { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !isPrivateProjectionSlug(e.name)).map((e) => e.name);
  } catch { /* a checkout with no bags/ keys the system canon alone (each snapshot then empty) */ }
  return houseCanonSlugs(held).filter((slug) => FLOOR_REQUIRED_SLUGS.includes(slug) || floorCarriesTier(readBagManifest(join(repoRoot, "bags", slug), slug).tier));
}

type Rows = Record<string, { tiddler: { title: string; [key: string]: unknown } }>;

export function cutGenesisFloor(opts: { repoRoot: string; engine: string; plugins: string }): {
  manifest: FloorManifest; manifestCid: string; manifestBytes: Uint8Array;
  snapshots: Record<string, FloorSnapshot>; rows: Record<string, number>;
} {
  const slugs = genesisFloorSlugs(opts.repoRoot);
  const bags: Record<string, Rows> = Object.fromEntries(slugs.map((slug) => [slug, {}]));
  const titles: Record<string, Set<string>> = Object.fromEntries(slugs.map((slug) => [slug, new Set<string>()]));
  for (const path of carrierFiles(opts.repoRoot)) {
    const bag = slugs.find((slug) => path.startsWith(`bags/${slug}/`));
    if (!bag) continue;
    // The ingest walk excludes each bag's root manifest; its metadata belongs to the vessel, not a tiddler row.
    if (path === `bags/${bag}/meta.mem`) continue;
    let text: string;
    try { text = readFileSync(join(opts.repoRoot, path), "utf8"); }
    catch (error) { throw new Error(`[genesis-floor] carrier read refused ${path}: ${String(error)}`); }
    if (!declaresCarrier(text)) continue;
    const declaredTitle = rootMetaFields(text).title;
    if (typeof declaredTitle !== "string" || !declaredTitle) throw new Error(`[genesis-floor] carrier title absent ${path}`);
    titles[bag]!.add(declaredTitle);
    const relative = path.slice(`bags/${bag}/`.length).replace(/\.(?:mem|tid)$/, "");
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
      titles[bag]!.add(row.title);
      bags[bag]![row.title] = { tiddler: row };
    }
  }
  // ONE TITLE, ONE BAG: the floor stacks its snapshots as peers, so a title two bags carry would read by stack order alone.
  const owner = new Map<string, string>();
  for (const slug of slugs) for (const title of titles[slug]!) {
    const other = owner.get(title);
    if (other !== undefined) throw new Error(`[genesis-floor] title ${title} rides both bags/${other} and bags/${slug}`);
    owner.set(title, slug);
  }
  const snapshots: Record<string, FloorSnapshot> = {};
  const rows: Record<string, number> = {};
  for (const slug of slugs) { snapshots[slug] = cutFloorSnapshot(bags[slug]!); rows[slug] = Object.keys(bags[slug]!).length; }
  const manifest: FloorManifest = {
    format: FLOOR_MANIFEST_FORMAT, engine: opts.engine, plugins: opts.plugins,
    snapshots: Object.fromEntries(slugs.map((slug) => [slug, snapshots[slug]!.cid])),
  };
  const manifestBytes = floorManifestBytes(manifest);
  return { manifest, manifestCid: floorManifestCid(manifest), manifestBytes, snapshots, rows };
}

/** What a carry refuses: a genesis dir that stands no floor to carry, or a floor row whose bytes fail their name. */
function uncarried(reason: string): Error {
  return new Error(`[genesis-floor] genesis-floor-uncarried: ${reason}`);
}

/**
 * THE FLOOR RIDES RELEASES. A develop bake carries the floor the standing seed names, byte for byte: each `floor-<slug>`
 * snapshot reads off `<genesisDir>/cas/<cid>` and must hash to the CID its manifest names, and no carrier gets read. Only the
 * manifest's code fields move, re-stamped with the engine and plugins offering this bake packs, so the manifest keeps saying
 * which engine and plugins the floor rides beside while its snapshots stand as the last release cut them (`cutGenesisFloor`,
 * the release bake). A genesis dir that stands no floor refuses: a release bake cuts the first one.
 */
export function carryGenesisFloor(opts: { genesisDir: string; engine: string; plugins: string }): ReturnType<typeof cutGenesisFloor> {
  const seed = readGenesisSeed(opts.genesisDir);
  const manifestRow = seed ? ownEntry(seed.blobs, "floor-manifest") : undefined;
  if (!seed || !manifestRow || manifestRow.kind !== "floor") {
    throw uncarried(`${opts.genesisDir} stands no seed naming a floor-manifest row; a release bake cuts the floor from canon (pnpm --filter @lararium/node build:genesis-release)`);
  }
  const casDir = genesisCasDir(opts.genesisDir);
  const read = (id: string, cid: string): Uint8Array => {
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(readFileSync(join(casDir, cid))); }
    catch { throw uncarried(`${id} names ${cid} and ${casDir} holds no such member`); }
    if (sha256HexBytesSync(bytes) !== cid) throw uncarried(`${id} bytes at ${join(casDir, cid)} fail their CID`);
    return bytes;
  };
  const standing = readFloorManifest(read("floor-manifest", manifestRow.sha256));
  if ("refusal" in standing) throw uncarried(`floor-manifest reads unread (${standing.refusal}: ${standing.reason})`);
  const snapshots: Record<string, FloorSnapshot> = {};
  const rows: Record<string, number> = {};
  for (const [slug, cid] of Object.entries(standing.manifest.snapshots)) {
    const id = `floor-${slug}`;
    if (ownEntry(seed.blobs, id)?.sha256 !== cid) throw uncarried(`floor-manifest names ${id} ${cid} and the seed's ${id} row names another`);
    const bytes = read(id, cid);
    const opened = openFloorSnapshot(bytes, cid);
    if ("refusal" in opened) throw uncarried(`${id} reads unread (${opened.refusal}: ${opened.reason})`);
    snapshots[slug] = { cid, bytes };
    rows[slug] = Object.keys(opened.rows).length;
  }
  const manifest: FloorManifest = { format: FLOOR_MANIFEST_FORMAT, engine: opts.engine, plugins: opts.plugins, snapshots: standing.manifest.snapshots };
  return { manifest, manifestCid: floorManifestCid(manifest), manifestBytes: floorManifestBytes(manifest), snapshots, rows };
}
