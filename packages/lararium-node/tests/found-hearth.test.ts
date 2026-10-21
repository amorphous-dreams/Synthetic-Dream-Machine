/**
 * found-hearth — THE STABLE FOUNDING ACT (lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings): one act under
 * one route yields the place, persona zero, a PRIVATE one-seat seed charter, and a face whose fleet relations bind
 * that charter's Nexus AID. Every act runs the real doors over real stores under scratch roots.
 *
 *   H1 · the act seats ONE chair at threshold one under the chair's own seat key, commits the card's digest as its
 *        one next key, rests PRIVATE, and leaves the serving tree beside custody; the card's seed zero-fills.
 *   H2 · persona zero's device edge, the hearth's true-name pin and the dyad binding each name the charter's AID; the
 *        dyad reads verified at that AID and at no other scope.
 *   H3 · two hearths founded from one genesis name two AIDs, so a device edge from one does not name the other
 *        (gap 1), and their cabal sentinels seed apart.
 *   H4 · persona zero on a place with no seed charter refuses by name, and writes no face.
 *   H5 · a card that fails its read-back writes no charter and no face, and retires the seat key it armed; the act
 *        run again completes.
 *   H6 · the act run again over a standing hearth moves nothing: the AID, the seat and the face stand as they stood.
 *   H7 · a re-seat over the hearth's seed charter refuses by name, and moves no byte: the hearth's AID never moves —
 *        with the bootstrap's face pin gone too, since the faces' own anchors answer.
 *   H8 · over a place that holds a charter this act did not found, the act refuses by name and founds no face.
 *   H9 · the founding lands a counted 1-of-1 Kahu-cabal admission for persona zero's group, once: a second run lands
 *        no second act, and a group the act never named stands absent (W26 slice 3).
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test, vi } from "vitest";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import {
  DAEMON_BAG_ID, HEARTH_TRUE_NAME_TIDDLER, federationPostureFromDoc, genesisCharterEpoch, kahuRealmGroup, seatedKahuKeys, NEXUS_AID_PATTERN, PERSONA_GROUP_ID_TIDDLER, tiddlerText, verifiedFleetOfGroup, vesselDyads,
  type LarDoc,
} from "@lararium/mesh";
import { runFoundTheFace } from "../src/commands/init.js";
import { runCabalStanding } from "../src/commands/nexus-cabal.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { loadIdentityAnchors } from "../src/identity-anchors.js";
import { readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { fixtureKey } from "./fixture-keys.js";
import { loadPersonaGroupRootVerifyingKey } from "../src/node-vessel-identity.js";
import { ownedStore } from "../src/owned-store.js";
import { heldSeatKey, listSeatKeys } from "../src/seat-key-store.js";
import { armGenesis } from "../src/seal-ceremony.js";
import { larBootstrapPath, larDataDir, larIdentityDir, larSealHome } from "../src/vessel-paths.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { direct } from "./direct-store.js";
import { foundDirect, foundHearthDirect, seatSeedCharter } from "./found-route.js";
import type { HearthCard } from "../src/commands/found-hearth.js";

vi.setConfig({ testTimeout: 240_000, hookTimeout: 240_000 });

const REPO_GENESIS = join(import.meta.dirname, "..", "..", "..", "genesis");
const roots: string[] = [];

function freshRoot(tag: string): string {
  const r = mkdtempSync(join(tmpdir(), `lar-found-hearth-${tag}-`));
  cpSync(REPO_GENESIS, join(r, "genesis"), { recursive: true, filter: (s) => !s.endsWith("social-bootstrap.json") });
  roots.push(r);
  return r;
}

async function lockRoot(r: string): Promise<void> {
  await withLarRoot(r, async () => {
    const holder = seatedCustody();
    if (holder) { await holder.lock(); unseatCustody(holder); }
  });
}

afterAll(async () => {
  for (const r of roots) { await lockRoot(r); rmSync(r, { recursive: true, force: true }); }
});

/** The bootstrap's packed tiddlers. */
function packed(): Record<string, { text?: string }> {
  return (JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, { text?: string }> }).tiddlers;
}

/** The daemon doc the bootstrap names, read on the store's one holder. */
async function daemonDoc(): Promise<LarDoc> {
  const url = packed()[DAEMON_BAG_ID]!.text!;
  return ownedStore(larDataDir(), async (repo) => (await repo.find<LarDoc>(url as AutomergeUrl)).doc() as LarDoc);
}

/** Found a hearth at `r`, keeping each card's seed for a later look. */
async function foundAt(r: string, readBack?: (cards: readonly HearthCard[]) => Promise<void>) {
  return withLarRoot(r, () => foundHearthDirect({ storageDir: join(r, "data", "lares", "vessel"), genesisDir: join(r, "genesis"), ...(readBack ? { readBack } : {}) }));
}

describe("the Stable founding act", () => {
  const a = freshRoot("a");
  const seeds: Uint8Array[] = [];

  test("H1 — one chair at threshold one, under its own seat key, committing the card's digest, PRIVATE, beside the serving tree", async () => {
    const founded = await foundAt(a, async (cards) => { for (const c of cards) seeds.push(c.seed); expect(cards).toHaveLength(1); });
    await withLarRoot(a, async () => {
      expect(founded.nexusAid).toMatch(NEXUS_AID_PATTERN);
      expect(founded.charterSeated).toBe(true);
      const doc = readNexusDoc(larSealHome())!;
      expect(doc.threshold).toBe(1);
      expect(doc.kahu.filter((k) => k.verifyingKey)).toHaveLength(1);
      expect(doc.sealLineage).toHaveLength(1);
      expect(doc.sealLineage![0]!.epochCid).toBe(founded.nexusAid);
      expect(doc.sealLineage![0]!.nextKeyDigests).toEqual([founded.nextDigest]);
      expect(doc.sealLineage![0]!.nextThreshold).toBe(1);
      expect(federationPostureFromDoc(doc)).toBe("private");
      expect(readFileSync(join(larSealHome(), "founding-roster.mem"), "utf8")).toMatch(/"federationPosture":\s*"private"/);
      expect(heldSeatKey(founded.seatKey)?.handleIndex).toBe(0);
      expect(founded.seatKey).not.toBe((await loadPersonaGroupRootVerifyingKey(0))?.toLowerCase());
      expect(existsSync(join(larIdentityDir(), "sk-slots.bin"))).toBe(true);
      expect(founded.face.alreadyStood).toBe(false);
    });
    expect(seeds).toHaveLength(1);
    expect(seeds[0]!.every((b) => b === 0)).toBe(true);                                    // the card's seed zero-filled
  });

  test("H2 — the device edge, the true-name pin and the dyad binding each name the charter's AID", async () => {
    await withLarRoot(a, async () => {
      const aid = readNexusDoc(larSealHome())!.sealLineage![0]!.epochCid;
      const edge = (await loadIdentityAnchors(0))!.deviceEdge!;
      expect(edge.hearthTrueName).toBe(aid);
      const doc = await daemonDoc();
      expect(tiddlerText(doc.tiddlers[HEARTH_TRUE_NAME_TIDDLER])).toBe(aid);
      // A committed founding leaves no write-ahead checkpoint and no title that spells its atom on the vessel-wide doc.
      expect(Object.keys(doc.tiddlers).filter((title) => /checkpoint/.test(title) || title.includes(edge.deviceVerifyingKey))).toEqual([]);
      const dyads = vesselDyads(doc);
      expect(dyads.length).toBeGreaterThan(0);
      expect(dyads.every((d) => d.binding?.epochCid === aid)).toBe(true);
      expect(await verifiedFleetOfGroup(dyads, edge.personaRootDid, new Set(), aid)).toHaveLength(dyads.length);
      expect(await verifiedFleetOfGroup(dyads, edge.personaRootDid, new Set(), `nexus-${"0".repeat(64)}`)).toHaveLength(0);
      expect(await verifiedFleetOfGroup(dyads, edge.personaRootDid)).toHaveLength(dyads.length);    // CONTROL: no scope asked
    });
  });

  test("H9 — the founding lands one counted 1-of-1 Kahu-cabal admission for persona zero's group (CONTROL: a group it never named stands absent; a second run lands no second act)", async () => {
    await withLarRoot(a, async () => {
      const group = kahuRealmGroup(packed()[PERSONA_GROUP_ID_TIDDLER]!.text!);
      const stood = await direct(runCabalStanding)({ group });
      expect(stood.standing).toBe("admitted");
      expect(stood.heads).toHaveLength(1);
      expect((await direct(runCabalStanding)({ group: "ab".repeat(32) })).standing).toBe("absent");   // CONTROL
    });
    const again = await foundAt(a);
    expect(again.face.alreadyStood).toBe(true);
    await withLarRoot(a, async () => {
      const group = kahuRealmGroup(packed()[PERSONA_GROUP_ID_TIDDLER]!.text!);
      expect((await direct(runCabalStanding)({ group })).heads).toHaveLength(1);
    });
  });

  test("H7 — a re-seat over the hearth's seed charter refuses by name and moves no byte: its AID never moves (CONTROL: H1's arming seated it)", async () => {
    await withLarRoot(a, async () => {
      const before = readFileSync(join(larSealHome(), "founding-roster.mem"));
      await expect(armGenesis({})).rejects.toThrow(/hearth-bound|binds its Nexus AID/);
      // A re-seeded bootstrap names no face (`vessel found --force`), and the faces' own anchors still bind the AID.
      const bootstrap = readFileSync(larBootstrapPath(), "utf8");
      const plugin = JSON.parse(bootstrap) as { text: string };
      const packedTiddlers = JSON.parse(plugin.text) as { tiddlers: Record<string, unknown> };
      delete packedTiddlers.tiddlers[PERSONA_GROUP_ID_TIDDLER];
      writeFileSync(larBootstrapPath(), JSON.stringify({ ...plugin, text: JSON.stringify(packedTiddlers) }), "utf8");
      try {
        expect(packed()[PERSONA_GROUP_ID_TIDDLER]).toBeUndefined();                      // the tamper moved the pin
        await expect(armGenesis({})).rejects.toThrow(/hearth-bound|binds its Nexus AID/);
      } finally { writeFileSync(larBootstrapPath(), bootstrap, "utf8"); }
      expect(readFileSync(join(larSealHome(), "founding-roster.mem")).equals(before)).toBe(true);
      expect(listSeatKeys()).toHaveLength(1);
    });
  });

  test("H6 — run again over the standing hearth, the act moves nothing", async () => {
    const before = await withLarRoot(a, async () => ({ doc: readFileSync(join(larSealHome(), "founding-roster.mem")), group: packed()[PERSONA_GROUP_ID_TIDDLER]!.text, seats: listSeatKeys().length }));
    const again = await foundAt(a);
    expect(again.charterSeated).toBe(false);
    expect(again.face.alreadyStood).toBe(true);
    await withLarRoot(a, async () => {
      expect(readFileSync(join(larSealHome(), "founding-roster.mem")).equals(before.doc)).toBe(true);
      expect(packed()[PERSONA_GROUP_ID_TIDDLER]!.text).toBe(before.group);
      expect(listSeatKeys()).toHaveLength(before.seats);
    });
  });
});

describe("a charter this act did not found", () => {
  test("H8 — over a place holding another's charter the act refuses by name and founds no face — CONTROL: a fresh root founds", async () => {
    const r = freshRoot("foreign");
    await withLarRoot(r, async () => {
      await foundDirect({ storageDir: larDataDir(), genesisDir: join(r, "genesis") });
      writeNexusDoc(larSealHome(), heldCharter({ keys: [fixtureKey(0xaa)], threshold: 1 }).doc());
    });
    await expect(foundAt(r)).rejects.toThrow(/a charter stands here that this act did not found/);
    await withLarRoot(r, async () => { expect(packed()[PERSONA_GROUP_ID_TIDDLER]).toBeUndefined(); });
    // An unarmed one-seat genesis under a seat key this vessel holds founds no hearth either: a seed commits its card.
    const unarmed = freshRoot("unarmed");
    await withLarRoot(unarmed, async () => {
      await foundDirect({ storageDir: larDataDir(), genesisDir: join(unarmed, "genesis") });
      await seatSeedCharter({ name: "unarmed" });
      const seed = readNexusDoc(larSealHome())!;
      const bare = genesisCharterEpoch(seatedKahuKeys(seed), 1);
      expect(bare.nextKeyDigests).toEqual([]);                                                  // the tamper moved the arming
      writeNexusDoc(larSealHome(), { ...seed, sealEpochCid: bare.epochCid, sealLineage: [bare] });
    });
    await expect(foundAt(unarmed)).rejects.toThrow(/a charter stands here that this act did not found/);
    expect((await foundAt(freshRoot("control"))).charterSeated).toBe(true);                    // CONTROL
  });
});

describe("two hearths of one human, one genesis", () => {
  test("H3 — two AIDs: an edge from one hearth names no other, and the cabal sentinels seed apart", async () => {
    const one = freshRoot("one");
    const two = freshRoot("two");
    const f1 = await foundAt(one);
    const f2 = await foundAt(two);
    expect(f1.nexusAid).not.toBe(f2.nexusAid);
    const e1 = await withLarRoot(one, async () => (await loadIdentityAnchors(0))!);
    const e2 = await withLarRoot(two, async () => (await loadIdentityAnchors(0))!);
    expect(e1.deviceEdge!.hearthTrueName).toBe(f1.nexusAid);
    expect(e2.deviceEdge!.hearthTrueName).toBe(f2.nexusAid);
    expect(e1.deviceEdge!.hearthTrueName).not.toBe(e2.deviceEdge!.hearthTrueName);
    expect(e1.meshCabalDocIdHex).not.toBe(e2.meshCabalDocIdHex);
  });
});

describe("a face founds at a hearth alone", () => {
  test("H4 — persona zero on a place with no seed charter refuses by name and writes no face — CONTROL: at a hearth it founds", async () => {
    const r = freshRoot("place");
    await withLarRoot(r, async () => {
      await foundDirect({ storageDir: larDataDir(), genesisDir: join(r, "genesis") });
      await expect(direct(runFoundTheFace)({ genesisDir: join(r, "genesis"), handleIndex: 0 })).rejects.toThrow(/no seed charter stands here/);
      expect(packed()[PERSONA_GROUP_ID_TIDDLER]).toBeUndefined();
      expect(await loadIdentityAnchors(0)).toBeNull();
    });
    const hearth = await foundAt(r);                                                            // CONTROL
    expect(hearth.face.alreadyStood).toBe(false);
  });
});

describe("the card reads back before the charter moves", () => {
  test("H5 — a refused read-back writes no charter and no face and retires its seat key — the act run again completes", async () => {
    const r = freshRoot("refused");
    let seen: Uint8Array | null = null;
    await expect(foundAt(r, async (cards) => { seen = cards[0]!.seed; throw new Error("the card read back otherwise"); }))
      .rejects.toThrow(/read back otherwise/);
    await withLarRoot(r, async () => {
      expect(existsSync(join(larSealHome(), "founding-roster.mem"))).toBe(false);
      expect(packed()[PERSONA_GROUP_ID_TIDDLER]).toBeUndefined();
      expect(listSeatKeys()).toHaveLength(0);
    });
    expect(seen!.every((b) => b === 0)).toBe(true);
    const again = await foundAt(r);
    expect(again.charterSeated).toBe(true);
    expect(again.face.alreadyStood).toBe(false);
  });
});
