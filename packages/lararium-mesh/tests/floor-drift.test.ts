/**
 * floor-drift — how far the pinned floor trails live public canon, read and never written.
 *
 * The default recipe reads house canon through the oracle floor alone, a snapshot pinned at a release cut; live canon moves on
 * every lay. A code-meme laid after the cut (the wave crest, 2026-11-22) answers on the `lares` recipe and nowhere on the
 * default one, while `lay --lag` reads 0 — honestly, since lag measures disk against live canon. This reading names the other
 * gap: each live carrier the pinned floor misses, or serves with older bytes, counted by carrier (family), never by slot.
 *
 * REDS, each with its control:
 *   · a carrier live canon holds and the floor lacks reads MISSING; one whose slot bytes moved reads OLDER; the count names
 *     carriers, so a meme with six slots counts once;
 *   · a live row whose only difference rides the residency stamps the cut strips (`bag`) reads no drift (CONTROL);
 *   · a floor whose manifest or a snapshot does not read answers NULL, never a silent zero; a slug with no live document
 *     here reads unread by name, and the others still count.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/genesis-island#/the-floor-rides-releases
 */
import { describe, expect, test } from "vitest";
import { cutFloorSnapshot, floorManifestBytes, sha256HexBytesSync, type FloorManifest, type LarTiddlerRecord } from "../src/index.js";
import { readFloorDrift } from "../src/floor-drift.js";

const row = (title: string, text: string, extra: Record<string, unknown> = {}): LarTiddlerRecord => ({ tiddler: { title, text, ...extra } as LarTiddlerRecord["tiddler"] });
const CREST = "lar:///ha.ka.ba/lararium/mesh/wave-crest";
const PLAN = "lar:///ha.ka.ba/lararium/mesh/alignment-plan";
const SEED = "lar:///ha.ka.ba/lares/api/noosphere-boot";

function floor(snaps: Record<string, Record<string, LarTiddlerRecord>>) {
  const blobs = new Map<string, Uint8Array>();
  const snapshots: Record<string, string> = {};
  for (const [slug, rows] of Object.entries(snaps)) { const s = cutFloorSnapshot(rows); blobs.set(s.cid, s.bytes); snapshots[slug] = s.cid; }
  const manifest: FloorManifest = { format: "lararium-floor", engine: "e".repeat(64), plugins: "b".repeat(64), snapshots };
  const bytes = floorManifestBytes(manifest);
  const cid = sha256HexBytesSync(bytes);
  blobs.set(cid, bytes);
  return { cid, blob: async (c: string) => blobs.get(c) ?? null, blobs };
}

const pinned = {
  lararium: { [PLAN]: row(PLAN, "plan"), [`${PLAN}#/edges`]: row(`${PLAN}#/edges`, "edges") },
  lares: { [SEED]: row(SEED, "seed") },
};

describe("floor drift — the pinned floor against live public canon", () => {
  test("RED: a carrier the floor lacks reads missing, a moved slot reads older, and the count names carriers", async () => {
    const f = floor(pinned);
    const live: Record<string, Record<string, LarTiddlerRecord>> = {
      lararium: {
        [PLAN]: row(PLAN, "plan"), [`${PLAN}#/edges`]: row(`${PLAN}#/edges`, "edges, re-cut"),
        [CREST]: row(CREST, "crest"), [`${CREST}#/purpose`]: row(`${CREST}#/purpose`, "p"), [`${CREST}#/source`]: row(`${CREST}#/source`, "s"),
      },
      lares: { [SEED]: row(SEED, "seed") },
    };
    const drift = await readFloorDrift({ manifestCid: f.cid, blob: f.blob, canonRows: async (slug) => live[slug] ?? null });
    expect(drift).not.toBeNull();
    expect(drift!.count).toBe(2);
    expect(drift!.carriers).toEqual([PLAN, CREST].sort());
    expect(drift!.slugs).toEqual([
      { slug: "lararium", missing: [CREST], older: [PLAN] },
      { slug: "lares", missing: [], older: [] },
    ]);
    expect(drift!.unread).toEqual([]);
    expect(drift!.manifest).toBe(f.cid);
  });

  test("RED: a carrier live canon retired still rides the floor, and reads older (the floor serves bytes canon no longer holds)", async () => {
    const f = floor(pinned);
    const drift = await readFloorDrift({ manifestCid: f.cid, blob: f.blob, canonRows: async (slug) => (slug === "lares" ? {} : pinned.lararium) });
    expect(drift!.count).toBe(1);
    expect(drift!.slugs.find((s) => s.slug === "lares")).toEqual({ slug: "lares", missing: [], older: [SEED] });
  });

  test("CONTROL: residency stamps the cut strips (`bag`, an absent field) read no drift", async () => {
    const f = floor(pinned);
    const live = {
      lararium: Object.fromEntries(Object.entries(pinned.lararium).map(([t, r]) => [t, row(t, String(r.tiddler.text), { bag: "lar:///ha.ka.ba/bags/lararium" })])),
      lares: pinned.lares,
    };
    const drift = await readFloorDrift({ manifestCid: f.cid, blob: f.blob, canonRows: async (slug) => live[slug as keyof typeof live] ?? null });
    expect(drift).toMatchObject({ count: 0, carriers: [], unread: [] });
  });

  test("RED: an unreadable floor answers null, never a silent zero; a slug with no live document reads unread by name", async () => {
    const f = floor(pinned);
    expect(await readFloorDrift({ manifestCid: "0".repeat(64), blob: f.blob, canonRows: async () => ({}) })).toBeNull();
    const torn = async (c: string) => (c === f.cid ? f.blobs.get(c)! : null);
    expect(await readFloorDrift({ manifestCid: f.cid, blob: torn, canonRows: async () => ({}) })).toBeNull();
    const half = await readFloorDrift({ manifestCid: f.cid, blob: f.blob, canonRows: async (slug) => (slug === "lares" ? pinned.lares : null) });
    expect(half).toMatchObject({ count: 0, unread: ["lararium"] });
    expect(await readFloorDrift({ manifestCid: f.cid, blob: f.blob, canonRows: async () => null })).toBeNull();
  });
});
