/**
 * THE CAUSAL ISLAND SURVIVES THE CEREMONY'S ROUND-TRIP.
 *
 * `inSelfSlice` reads an ABSENT island as cross-cutting, so such a record co-loads with EVERY island's
 * slice. The provider stamps the island at mint — DELEGATED/REVOKED off their own subject bytes, CGKA off
 * the active doc-op — but the ceremony wrote its cap events to the daemon doc WITHOUT the field and read
 * them back without it, with the value in hand on both sides. Every ceremony-written event therefore
 * re-loaded eagerly forever after: the CIV-3 flatness cut degrading to "load everything" for exactly the
 * records a founding produces.
 *
 * Measured on a real face founding: 9 cap events written, 0 carrying an island before, 3 after. The other
 * six are honestly island-less (a per-principal event attributes to no document), which is why this pins
 * "at least one survives" rather than a count — a count would pin keyhive's internals, not our round-trip.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { foundThePlace, foundTheFace, replayCapEvents } from "@lararium/keyhive";
import { DAEMON_BAG_ID, hex } from "@lararium/mesh";
import * as ed from "@noble/ed25519";

const SEED = new Uint8Array(32).fill(9);

async function foundedFace() {
  const repo = new Repo({ sharePolicy: async () => true });
  const vk = hex(await ed.getPublicKeyAsync(SEED));
  const place = await foundThePlace({ repo, vesselSeed: SEED, hearthTrueName: "" });
  await foundTheFace({
    repo, daemonHandle: place.daemonHandle, vesselSeed: SEED, vesselVerifyingKey: vk,
    vesselDisplayName: "Island Witness",
    binding: { mode: "self-stood", signerSeed: new Uint8Array(32).fill(1) },
    hearthTrueName: "", nexusPubkey: vk,
  });
  return { repo, place };
}

describe("a ceremony-written cap event keeps its causal island", () => {
  test("★ the island reaches the daemon doc, and replays back off it ★", async () => {
    const { repo, place } = await foundedFace();
    const doc = place.daemonHandle.doc() as { tiddlers?: Record<string, { tiddler?: Record<string, string> }> };
    const caps = Object.entries(doc.tiddlers ?? {}).filter(([t]) => t.startsWith(`${DAEMON_BAG_ID}/cap/`));

    expect(caps.length, "the founding writes cap events at all").toBeGreaterThan(0);
    const written = caps.filter(([, r]) => r.tiddler?.["island"]);
    expect(written.length, "an event minted WITH an island keeps it on the way in").toBeGreaterThan(0);

    // …and the read half: what the doc holds comes back on the record, not just in the tiddler.
    const replayed = await (await replayCapEvents(place.daemonHandle)).list();
    expect(replayed.filter((r) => r.island !== undefined).length,
      "an island in the doc reaches the record").toBe(written.length);

    // CONTROL — ABSENT STAYS ABSENT. A fabricated island would file a record under a slice it does not
    // belong to, which is worse than the eager co-load an honest absence costs.
    expect(replayed.filter((r) => r.island === undefined).length,
      "the island-less events are not given one").toBe(caps.length - written.length);
    await repo.shutdown();
  }, 120_000);

  test("CONTROL — every replayed record still round-trips its bytes and variant", async () => {
    const { repo, place } = await foundedFace();
    const replayed = await (await replayCapEvents(place.daemonHandle)).list();
    expect(replayed.length).toBeGreaterThan(0);
    for (const r of replayed) {
      expect(r.bytes.length, "bytes survive — the island change moves no payload").toBeGreaterThan(0);
      expect(typeof r.variant).toBe("string");
    }
    await repo.shutdown();
  }, 120_000);
});
