/**
 * persona-kel-gradient-climb — the vessel that seats a charter a week after founding BOOTS.
 *
 * ── THE FAULT, MEASURED ON A LIVE VESSEL ──────────────────────────────────────────────────────────
 * `lares vessel found` + `lares persona new 0` seat the persona-KEL inception on the board keyed by the
 * island THAT MOMENT resolves — no charter, no dial, so the island is the vessel's OWN key. A live run
 * printed it:
 *
 *     [nexus] island 079da8bf0e1efce59d… (own) — this vessel holds no charter and dials no anchor…
 *
 * `lares nexus rite cabal` then seats a charter. The next boot resolves the island through the charter's
 * genesis epoch — a DIFFERENT board — and the same run printed:
 *
 *     [nexus] island epoch0-0790f04d937… (charter, shared)
 *     [lararium] fatal: Error: [lararium] persona-KEL chain for the pinned identifier persona-fa51a762122e…
 *               absent from the local board replica — the Binding Gate cannot reach a head (fail-closed).
 *
 * Every subsequent boot repeats it. Data intact, identity intact, boot refuses.
 *
 * ── THE CURE ──────────────────────────────────────────────────────────────────────────────────────
 * A climb CARRIES the chain onto the island the boot walks, at BOOT, before the gate reads. The gate does
 * not move: the events arrive verbatim — their own cids, their own rotation signatures — and
 * `verifyPersonaKel` / `headOpKey` judge them exactly as before. Nothing here mints, re-signs, or admits.
 *
 * These vectors stand the REAL founding ceremony (`runFoundingCeremony`) so the chain under test is the
 * one a vessel actually seats, and read it back through the board face the boot reads.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/persona-kel-ring
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { runFoundingCeremony } from "@lararium/keyhive";
import {
  hex, materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix,
  personaKelEventsFromBoard, nexusIdentity, nexusIslandsBelow, nexusScopeOrThrow,
} from "@lararium/mesh";
import * as ed25519 from "@noble/ed25519";
import { carryPersonaKelUpTheGradient, makePersonaKelRingHolder } from "../src/persona-kel-ring.js";

const pubOf = async (s: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(s));
const seed  = (n: number): Uint8Array => new Uint8Array(32).fill(n);

/** The board read the boot performs — the exact call at `open-node-vessel`'s Binding-Gate seam. */
async function chainOn(repo: Repo, island: string, prefix: string) {
  const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(island), "board:persona-kel");
  return personaKelChainForPrefix(board.doc(), prefix);
}

/** How many KEL events one island's board carries — the idempotence witness. */
async function eventCountOn(repo: Repo, island: string): Promise<number> {
  const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(island), "board:persona-kel");
  return personaKelEventsFromBoard(board.doc()).length;
}

/** Stand a vessel the way a founding does: the island resolved at THAT moment, which holds no charter. */
async function foundAtOwnIsland(vesselSeed: Uint8Array) {
  const repo    = new Repo({ sharePolicy: async () => true });
  const ownKey  = await pubOf(vesselSeed);
  const founding = nexusIdentity({ ownVesselKey: ownKey });
  expect(founding.kind, "a fresh founding stands a PRIVATE NEXUS OF ONE").toBe("own");
  const cer = await runFoundingCeremony({
    repo, vesselSeed, vesselVerifyingKey: ownKey, vesselDisplayName: "A",
    binding: { mode: "self-stood", signerSeed: vesselSeed }, hearthTrueName: "",
    nexusPubkey: nexusScopeOrThrow(founding),
  });
  return { repo, ownKey, cer };
}

describe("a vessel that climbs the nexus gradient still boots", () => {
  /**
   * THE RED. Four steps, the ordinary operator walk: found faceless, light a face, use the hearth,
   * seat a charter, restart. The assertion is that the BOOT SURVIVES the climb — that the board the
   * post-charter boot walks carries the chain its daemon doc pins.
   */
  test("RED — the chain the founding seated reaches the CHARTER board the next boot walks", async () => {
    const { repo, ownKey, cer } = await foundAtOwnIsland(seed(11));

    // ① the founding board — the chain stands here, and the first boot walked it
    expect(await chainOn(repo, ownKey, cer.personaKelPrefix)).not.toBeNull();

    // ③ a charter now stands at the seal home. The island CLIMBS.
    const charter = `epoch0-${"7a".repeat(32)}`;
    const at      = { genesisEpochCid: charter, charterStands: true, ownVesselKey: ownKey };
    const climbed = nexusIdentity(at);
    expect(climbed.kind).toBe("charter");
    expect(nexusScopeOrThrow(climbed)).not.toBe(ownKey);

    // ④ the restart. The boot carries the chain up the gradient before the gate reads.
    const carried = await carryPersonaKelUpTheGradient({
      repo, nexusPubkey: nexusScopeOrThrow(climbed),
      priorIslands: nexusIslandsBelow(at), prefix: cer.personaKelPrefix,
    });
    expect(carried.from, "the carry names the island it read the chain off").toBe(ownKey);
    expect(carried.carried).toBeGreaterThan(0);

    // ⑥ THE BINDING GATE'S OWN READ — the halt this cures
    const chain = await chainOn(repo, nexusScopeOrThrow(climbed), cer.personaKelPrefix);
    expect(chain, "the Binding Gate cannot reach a head — the boot HALTS here").not.toBeNull();
    expect(chain!.length).toBeGreaterThan(0);
    expect(chain![0]!.prefix).toBe(cer.personaKelPrefix);
  }, 60_000);

  test("RED — the gate reaches a VERIFIED head over the carried chain, so the carry lowers nothing", async () => {
    const { repo, ownKey, cer } = await foundAtOwnIsland(seed(12));
    const charter = `epoch0-${"7b".repeat(32)}`;
    const at      = { genesisEpochCid: charter, charterStands: true, ownVesselKey: ownKey };
    const island  = nexusScopeOrThrow(nexusIdentity(at));

    await carryPersonaKelUpTheGradient({ repo, nexusPubkey: island, priorIslands: nexusIslandsBelow(at), prefix: cer.personaKelPrefix });

    // The holder is what the boot stands; its head read runs the FULL structural + quorum verify.
    const holder = makePersonaKelRingHolder({ repo, nexusPubkey: island });
    await holder.ready;
    const head = await holder.headOpKeyForPrefix(cer.personaKelPrefix);
    expect(head, "a carried chain must verify identically — the events arrive verbatim").toBe(cer.signerDid);
    holder.dispose();
  }, 60_000);

  // ── CONTROLS ────────────────────────────────────────────────────────────────────────────────────

  test("CONTROL — a vessel that never seats a charter still boots, and the carry is a no-op", async () => {
    const { repo, ownKey, cer } = await foundAtOwnIsland(seed(13));
    const at     = { ownVesselKey: ownKey };
    const island = nexusScopeOrThrow(nexusIdentity(at));
    expect(island).toBe(ownKey);
    const before = await eventCountOn(repo, ownKey);

    const carried = await carryPersonaKelUpTheGradient({
      repo, nexusPubkey: island, priorIslands: nexusIslandsBelow(at), prefix: cer.personaKelPrefix,
    });
    expect(carried).toEqual({ carried: 0, from: null });
    expect(await eventCountOn(repo, ownKey)).toBe(before);
    expect(await chainOn(repo, island, cer.personaKelPrefix)).not.toBeNull();
  }, 60_000);

  test("CONTROL — an UNREADABLE charter never re-keys: the island reads TORN and the boot REFUSES", async () => {
    const { repo, ownKey, cer } = await foundAtOwnIsland(seed(14));
    // A charter RECORD stands and its genesis epoch reads as no island — a half-written seat, a torn fence.
    const at   = { genesisEpochCid: "epoch0-truncated", charterStands: true, ownVesselKey: ownKey };
    const torn = nexusIdentity(at);
    expect(torn.kind).toBe("torn");
    // The boot never reaches the carry: `nexusScopeOrThrow` refuses before any board is addressed. So the
    // vessel neither descends to its private board nor re-keys onto a garbage one — it stops, loudly.
    expect(() => nexusScopeOrThrow(torn)).toThrow(/torn/i);
    expect(nexusIslandsBelow(at), "a torn standing offers no carry source").toEqual([]);
    // And the founding board stands untouched — nothing moved on a failure.
    expect(await chainOn(repo, ownKey, cer.personaKelPrefix)).not.toBeNull();
  }, 60_000);

  test("CONTROL — the Binding Gate still HALTS when a chain is genuinely absent, climb or no climb", async () => {
    const { repo, ownKey } = await foundAtOwnIsland(seed(15));
    const absent  = "persona-nobodyeverseatedthisidentifier";
    const charter = `epoch0-${"7c".repeat(32)}`;
    const at      = { genesisEpochCid: charter, charterStands: true, ownVesselKey: ownKey };
    const island  = nexusScopeOrThrow(nexusIdentity(at));

    const carried = await carryPersonaKelUpTheGradient({ repo, nexusPubkey: island, priorIslands: nexusIslandsBelow(at), prefix: absent });
    expect(carried, "no lower board carries it, so nothing is carried").toEqual({ carried: 0, from: null });
    expect(await chainOn(repo, island, absent), "the gate must still find nothing and halt").toBeNull();

    const holder = makePersonaKelRingHolder({ repo, nexusPubkey: island });
    await holder.ready;
    expect(holder.chainForPrefix(absent)).toBeNull();
    expect(await holder.headOpKeyForPrefix(absent)).toBeNull();
    holder.dispose();
  }, 60_000);

  test("CONTROL — the carry runs twice with no second effect (every boot runs it)", async () => {
    const { repo, ownKey, cer } = await foundAtOwnIsland(seed(16));
    const charter = `epoch0-${"7d".repeat(32)}`;
    const at      = { genesisEpochCid: charter, charterStands: true, ownVesselKey: ownKey };
    const island  = nexusScopeOrThrow(nexusIdentity(at));
    const sources = nexusIslandsBelow(at);

    const first = await carryPersonaKelUpTheGradient({ repo, nexusPubkey: island, priorIslands: sources, prefix: cer.personaKelPrefix });
    expect(first.carried).toBeGreaterThan(0);
    const afterFirst = await eventCountOn(repo, island);

    const second = await carryPersonaKelUpTheGradient({ repo, nexusPubkey: island, priorIslands: sources, prefix: cer.personaKelPrefix });
    expect(second, "the destination already carries it — the second boot reads and writes nothing").toEqual({ carried: 0, from: null });
    expect(await eventCountOn(repo, island)).toBe(afterFirst);

    const third = await carryPersonaKelUpTheGradient({ repo, nexusPubkey: island, priorIslands: sources, prefix: cer.personaKelPrefix });
    expect(third).toEqual({ carried: 0, from: null });
    expect(await eventCountOn(repo, island)).toBe(afterFirst);
  }, 60_000);

  test("CONTROL — the SOURCE board keeps its chain: a carry copies, it never empties the island below", async () => {
    const { repo, ownKey, cer } = await foundAtOwnIsland(seed(17));
    const charter = `epoch0-${"7e".repeat(32)}`;
    const at      = { genesisEpochCid: charter, charterStands: true, ownVesselKey: ownKey };
    const island  = nexusScopeOrThrow(nexusIdentity(at));
    const before  = await eventCountOn(repo, ownKey);

    await carryPersonaKelUpTheGradient({ repo, nexusPubkey: island, priorIslands: nexusIslandsBelow(at), prefix: cer.personaKelPrefix });

    expect(await eventCountOn(repo, ownKey)).toBe(before);
    expect(await chainOn(repo, ownKey, cer.personaKelPrefix)).not.toBeNull();
  }, 60_000);
});
