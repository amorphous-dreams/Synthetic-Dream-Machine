/**
 * A KEYHIVE ARCHIVE BELONGS TO ONE IDENTITY — a stand that meets an Archive of another identity REFUSES.
 *
 * An Individual's identifier IS its signer's verifying key. `Archive.tryToKeyhive` restores the archive's OWN
 * identity whatever signer it gets handed, so an Archive of identity A stood under seed B yields a split provider:
 * `whoami` reads A while the contact card presents B, and a peer that receives the card never learns the id a
 * delegation names. Discarding the Archive and standing fresh would hide the mismatch and let the next export
 * land an empty identity over the kept row. So the stand refuses by name and the provider holds nothing.
 *
 *   S1  an Archive of another identity refuses `ArchiveIdentityMismatch`; nothing stands.
 *   S2  control: a matching Archive restores its identity and what it created, and whoami agrees with the card.
 */
import { describe, test, expect } from "vitest";
import { KeyhiveProvider, InMemoryEventStore, ArchiveIdentityMismatch } from "../src/index.js";

const SEED_A = new Uint8Array(32).fill(0xa1);
const SEED_B = new Uint8Array(32).fill(0xb2);

/** Stand identity A, mint a sentinel, export its archive. */
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
  test("S1 an Archive of another identity refuses the stand, and the provider holds nothing", async () => {
    const { archive } = await archiveOfA();
    const boot = new KeyhiveProvider();
    await expect(boot.init({ seed: SEED_B, eventStore: new InMemoryEventStore(), archiveBytes: archive }))
      .rejects.toThrow(ArchiveIdentityMismatch);
    await expect(boot.whoami()).rejects.toThrow(/not initialized/);
  });

  test("S2 control: a matching Archive restores its identity and membership", async () => {
    const { archive, whoamiA, agentA } = await archiveOfA();

    const boot = new KeyhiveProvider();
    await boot.init({ seed: SEED_A, eventStore: new InMemoryEventStore(), archiveBytes: archive });

    expect(await boot.vesselIdentifierHex(), "a matching archive keeps its identity").toBe(whoamiA);
    expect(await boot.knowsAgent(agentA), "a matching archive keeps the sentinel it created").toBe(true);
    expect(await boot.vesselIdentifierHex(), "whoami still agrees with the card").toBe(await idPeerLearns(boot));
  });
});
