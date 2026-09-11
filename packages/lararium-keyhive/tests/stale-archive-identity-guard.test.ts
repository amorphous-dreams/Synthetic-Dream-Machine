/**
 * A KEYHIVE ARCHIVE IS A CACHE OF ONE IDENTITY — a boot that restores it under a DIFFERENT seed must
 * not stand a split provider.
 *
 * ── THE FAULT THIS PINS ──────────────────────────────────────────────────────────────────────────
 * The founder-veil key derives from (vessel seed × a per-founding tag). A preserving re-pave
 * (`vessel clear --force`, identity home untouched) wipes the daemon store but keeps the veil archive on
 * disk; re-lighting the face mints a FRESH tag, so the next lit boot derives a NEW veil key while the
 * ORPHANED archive of the prior veil still loads. keyhive's `Archive.tryToKeyhive` then restores the
 * archive's OWN identity — so `whoami` reads the archive's key while `contactCard` presents the seed's
 * signer. A peer that receives the card learns the signer id, never the whoami id the delegate names, and
 * `delegate({ audience: whoami })` throws `audience not known to this provider`. The fresh-from-void cure
 * (`rm -rf identity`) only works because it removes the orphaned archive.
 *
 * The identity a boot stands is the SEED's, always — the archive is a cache of prekey secrets and the
 * membership DAG for THAT identity, never an identity of its own. So an archive whose identity disagrees
 * with the seed is stale and must be discarded (the caller's event-store hydrate re-establishes the live
 * membership), exactly as `rm -rf identity` would.
 */
import { describe, test, expect } from "vitest";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";

const SEED_A = new Uint8Array(32).fill(0xa1);
const SEED_B = new Uint8Array(32).fill(0xb2);

/** Stand identity A, mint a sentinel, export its archive — the orphaned veil archive a re-pave keeps. */
async function archiveOfA(): Promise<{ archive: Uint8Array; whoamiA: string; agentA: string }> {
  const a = new KeyhiveProvider();
  await a.init({ seed: SEED_A, eventStore: new InMemoryEventStore() });
  const pg = await a.createSentinelDoc("lar:///x/persona-group");
  return { archive: await a.exportArchive(), whoamiA: await a.vesselIdentifierHex(), agentA: pg.agentIdHex };
}

/** Receive a provider's own contact card into a clean peer — the id the peer actually learns. */
async function idPeerLearns(p: KeyhiveProvider): Promise<string> {
  const peer = new KeyhiveProvider();
  await peer.init({ seed: new Uint8Array(32).fill(0xcc), eventStore: new InMemoryEventStore() });
  return (await peer.receiveContactCard(await p.contactCard())).id;
}

describe("a stale archive under a mismatched seed", () => {
  test("★ the provider stands ONE consistent identity — the seed's, not the archive's ★", async () => {
    const { archive } = await archiveOfA();

    // Boot under seed B with A's archive — the preserving-re-pave shape.
    const boot = new KeyhiveProvider();
    await boot.init({ seed: SEED_B, eventStore: new InMemoryEventStore(), archiveBytes: archive });

    const whoami = await boot.vesselIdentifierHex();
    const learned = await idPeerLearns(boot);

    // The whole claim: whoami and the presented card name the SAME identity, so a delegate to `whoami`
    // targets an agent a peer that received the card actually knows. A split provider fails both.
    expect(whoami, "whoami agrees with the contact card the provider presents").toBe(learned);

    // And that one identity is the SEED's (B), never the orphaned archive's (A).
    const fresh = new KeyhiveProvider();
    await fresh.init({ seed: SEED_B, eventStore: new InMemoryEventStore() });
    expect(whoami, "the seed decides the identity; the stale archive is discarded").toBe(await fresh.vesselIdentifierHex());
  });

  test("★ CONTROL — a MATCHING archive still restores its identity + membership (no regression) ★", async () => {
    const { archive, whoamiA, agentA } = await archiveOfA();

    const boot = new KeyhiveProvider();
    await boot.init({ seed: SEED_A, eventStore: new InMemoryEventStore(), archiveBytes: archive });

    expect(await boot.vesselIdentifierHex(), "a matching archive keeps its identity").toBe(whoamiA);
    expect(await boot.knowsAgent(agentA), "a matching archive keeps the sentinel it created").toBe(true);
    expect(await boot.vesselIdentifierHex(), "whoami still agrees with the card").toBe(await idPeerLearns(boot));
  });
});
