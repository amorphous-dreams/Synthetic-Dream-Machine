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
 *   V3 — reuse-on-present with a `vessel-only` record and the seat now standing re-delegates through
 *        `delegateToFace` and rewrites the record `face-reach = "face"`; a `face` record re-delegates nothing
 *        (CONTROL), and a seat still absent leaves `vessel-only` standing (CONTROL)
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

  test("V3 — a seat landing AFTER the mint re-grants the vessel-only binding on reuse, and the record says so", async () => {
    const joinee = await vessel(11);
    const key = "lar:///ha.ka.ba/bags/daemon/draft-bindings/" + "f".repeat(64);
    const stored: Record<string, Record<string, unknown>> = {
      [key]: { tiddler: { title: key, text: "automerge:earlierBinding", kind: "draft-binding", "face-reach": "vessel-only",
                          "minted-by": "0x" + "a".repeat(64) }, meta: { authority: "personal-bindings" } },
    };
    const put: Record<string, unknown>[] = [];
    const daemonStore = {
      get: async (title: string) => stored[title],
      put: async (rec: unknown) => { put.push(rec as Record<string, unknown>); },
    } as never;
    const repo = { create: () => { throw new Error("reuse mints nothing"); } };
    const delegated: Array<[string, string]> = [];
    const r = await resolveOrMintBinding({
      kind: "draft-binding", prefix: "lar:///ha.ka.ba/bags/daemon/draft-bindings", fingerprint: "f".repeat(64),
      repo, daemonStore, keyhive: joinee,
      personaGroupAgentIdHex: "cd".repeat(16),
      faceSeated: async () => true,
      delegateToFace: async (bagUrl, access) => { delegated.push([bagUrl, access]); },
      mintedByHex: "0x" + "a".repeat(64),
      recipeTrace: { wikiDocId: "w", libraryBagDocIds: [] },
    });
    expect(r).toEqual({ url: "automerge:earlierBinding", minted: false });
    expect(delegated, "the seat re-grants the binding minted before it").toEqual([["automerge:earlierBinding", "admin"]]);
    const fields = (put[0] as { tiddler?: Record<string, unknown> } | undefined)?.tiddler ?? put[0];
    expect(fields?.["face-reach"], "the record moves to the spelling a seated mint writes").toBe("face");
    expect(fields?.["text"], "the url stands").toBe("automerge:earlierBinding");
    expect(fields?.["kind"]).toBe("draft-binding");
    await joinee.dispose();
  });

  test("V3 CONTROL — a record already reading `face` re-delegates nothing and rewrites nothing", async () => {
    const joinee = await vessel(11);
    const key = "lar:///ha.ka.ba/bags/daemon/draft-bindings/" + "f".repeat(64);
    const put: unknown[] = [];
    const delegated: string[] = [];
    const r = await resolveOrMintBinding({
      kind: "draft-binding", prefix: "lar:///ha.ka.ba/bags/daemon/draft-bindings", fingerprint: "f".repeat(64),
      repo: { create: () => { throw new Error("reuse mints nothing"); } },
      daemonStore: {
        get: async () => ({ tiddler: { title: key, text: "automerge:seatedBinding", "face-reach": "face" }, meta: { authority: "personal-bindings" } }),
        put: async (rec: unknown) => { put.push(rec); },
      } as never,
      keyhive: joinee, personaGroupAgentIdHex: "cd".repeat(16),
      faceSeated: async () => true,
      delegateToFace: async (bagUrl) => { delegated.push(bagUrl); },
      mintedByHex: "0x" + "a".repeat(64), recipeTrace: { wikiDocId: "w", libraryBagDocIds: [] },
    });
    expect(r.minted).toBe(false);
    expect(delegated).toEqual([]);
    expect(put).toEqual([]);
    await joinee.dispose();
  });

  test("V3 CONTROL — a seat still absent leaves `vessel-only` standing", async () => {
    const joinee = await vessel(11);
    const key = "lar:///ha.ka.ba/bags/daemon/draft-bindings/" + "f".repeat(64);
    const put: unknown[] = [];
    const delegated: string[] = [];
    await resolveOrMintBinding({
      kind: "draft-binding", prefix: "lar:///ha.ka.ba/bags/daemon/draft-bindings", fingerprint: "f".repeat(64),
      repo: { create: () => { throw new Error("reuse mints nothing"); } },
      daemonStore: {
        get: async () => ({ tiddler: { title: key, text: "automerge:earlierBinding", "face-reach": "vessel-only" }, meta: { authority: "personal-bindings" } }),
        put: async (rec: unknown) => { put.push(rec); },
      } as never,
      keyhive: joinee, personaGroupAgentIdHex: "cd".repeat(16),
      faceSeated: async () => false,
      delegateToFace: async (bagUrl) => { delegated.push(bagUrl); },
      mintedByHex: "0x" + "a".repeat(64), recipeTrace: { wikiDocId: "w", libraryBagDocIds: [] },
    });
    expect(delegated).toEqual([]);
    expect(put).toEqual([]);
    await joinee.dispose();
  });
});
