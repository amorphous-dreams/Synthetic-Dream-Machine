/**
 * face-pinned-not-seated — a PIN is standing; a SEAT is capability. The two axes stay apart.
 *
 * A device-admit hands a joinee the PersonaGroup's ids and a signed edge, and copies NO cap events. The
 * joinee's veil therefore names the group agent nowhere in its own keyhive until a face-join seats it.
 * A boot that delegates to that agent regardless throws `audience not known` and takes the vessel down.
 *
 *   V1 — `knowsAgent` reads false for a group agent the provider never met, true once the seat's events land
 *   V2 — `resolveOrMintBinding` with a face pinned and NO seat mints on the vessel's own key, never throws,
 *        and the binding record says so
 */
import { describe, test, expect } from "vitest";
import { KeyhiveProvider } from "../src/keyhive-provider.js";
import { resolveOrMintBinding } from "../src/resolve-binding.js";

const noopStore = { put: async () => {}, list: async () => [] };
const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);

async function vessel(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: seedOf(fill), eventStore: noopStore });
  return p;
}

describe("a face pinned is not a face seated", () => {
  test("V1 — knowsAgent turns true only when the seat's events reach the joinee", async () => {
    const founder = await vessel(7);
    const joinee  = await vessel(11);
    const pg = await founder.createSentinelDoc("lar:///ha.ka.ba/persona/test");
    await founder.addSentinelMember(await founder.vesselIdentifierHex(), pg.docIdHex);

    expect(await joinee.knowsAgent(pg.agentIdHex), "the joinee met no group yet").toBe(false);

    await founder.receiveContactCard(await joinee.contactCard());
    await joinee.receiveContactCard(await founder.contactCard());
    const joineeId = await joinee.vesselIdentifierHex();
    await founder.addSentinelMember(joineeId, pg.docIdHex);
    await joinee.ingestPeerEvents(await founder.eventsForPeer(joineeId));

    expect(await joinee.knowsAgent(pg.agentIdHex), "the seat's events name the group").toBe(true);
    await founder.dispose(); await joinee.dispose();
  });

  test("V2 — a pinned-but-unseated face mints the binding on the vessel's own key, and says so", async () => {
    const joinee = await vessel(11);
    const put: Record<string, unknown>[] = [];
    const daemonStore = {
      get: async () => undefined,
      put: async (rec: unknown) => { put.push(rec as Record<string, unknown>); },
    } as never;
    const repo = { create: () => ({ url: "automerge:mintedBinding" }) };
    const delegated: string[] = [];
    const r = await resolveOrMintBinding({
      kind: "draft-binding", prefix: "lar:///ha.ka.ba/bags/daemon/draft-bindings", fingerprint: "f".repeat(64),
      repo, daemonStore, keyhive: joinee,
      personaGroupAgentIdHex: "cd".repeat(16),
      faceSeated: async () => false,
      delegateToFace: async (bagUrl) => { delegated.push(bagUrl); },
      mintedByHex: "0x" + "a".repeat(64),
      recipeTrace: { wikiDocId: "w", libraryBagDocIds: [] },
    });
    expect(r.minted).toBe(true);
    expect(delegated, "no delegation to an agent the veil cannot name").toEqual([]);
    const fields = (put[0] as { tiddler?: Record<string, unknown> } | undefined)?.tiddler ?? put[0];
    expect(fields?.["face-reach"], "the record names the posture").toBe("vessel-only");
    await joinee.dispose();
  });
});
