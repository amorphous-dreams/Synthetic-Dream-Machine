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
 *   V3 — a face record adopts its document without another grant (CONTROL), and reuse leaves `vessel-only`
 *        standing (CONTROL). A vessel-only record moves under a seated face by the lift (`anon-veil-lift.test.ts`), never here.
 */
import { describe, test, expect } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { KeyhiveProvider } from "../src/keyhive-provider.js";
import { resolveOrMintBinding } from "../src/resolve-binding.js";
import { makeFaceBagDoor } from "../src/face-bag-door.js";

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
    const repo = { create: () => ({ url: "automerge:mintedBinding", documentId: "mintedBinding" }), flush: async () => {} };
    const delegated: string[] = [];
    const r = await resolveOrMintBinding({
      kind: "draft-binding", prefix: "lar:///ha.ka.ba/bags/daemon/draft-bindings", fingerprint: "f".repeat(64),
      repo, daemonStore, keyhive: joinee,
      personaGroupId: "cd".repeat(16),
      faceSeated: async () => false,
      faceDoor: { mint: async () => { throw new Error("unseated mint reached face"); }, adopt: () => {}, remint: async () => { throw new Error("unseated remint reached face"); } },
      mintedByHex: "0x" + "a".repeat(64),
      recipeTrace: { wikiDocId: "w", libraryBagDocIds: [] },
    });
    expect(r.minted).toBe(true);
    expect(delegated, "no delegation to an agent the veil cannot name").toEqual([]);
    const fields = ((put.find((row) => (row as { tiddler?: Record<string, unknown> }).tiddler?.kind === "draft-binding") as { tiddler?: Record<string, unknown> } | undefined)?.tiddler);
    expect(fields?.["face-reach"], "the record names the posture").toBe("vessel-only");
    await joinee.dispose();
  });

  test("V3 CONTROL — a record already reading `face` re-delegates nothing and rewrites nothing", async () => {
    const joinee = await vessel(11);
    const key = "lar:///ha.ka.ba/bags/daemon/draft-bindings/" + "f".repeat(64);
    const put: unknown[] = [];
    const delegated: string[] = [];
    const r = await resolveOrMintBinding({
      kind: "draft-binding", prefix: "lar:///ha.ka.ba/bags/daemon/draft-bindings", fingerprint: "f".repeat(64),
      repo: { create: () => { throw new Error("reuse mints nothing"); }, flush: async () => {} },
      daemonStore: {
        get: async () => ({ tiddler: { title: key, text: "automerge:seatedBinding", "face-reach": "face", "keyhive-doc-id": "d2".repeat(16) }, meta: { authority: "personal-bindings" } }),
        put: async (rec: unknown) => { put.push(rec); },
      } as never,
      keyhive: joinee, personaGroupId: "cd".repeat(16),
      faceSeated: async () => true,
      faceDoor: { mint: async () => { throw new Error("reuse minted"); }, adopt: (bagUrl: string) => { delegated.push(bagUrl); }, remint: async () => { throw new Error("face reuse reminted"); } },
      mintedByHex: "0x" + "a".repeat(64), recipeTrace: { wikiDocId: "w", libraryBagDocIds: [] },
    });
    expect(r.minted).toBe(false);
    expect(delegated).toEqual(["automerge:seatedBinding"]);
    expect(put).toEqual([]);
    await joinee.dispose();
  });

  test("V3 CONTROL — reuse leaves `vessel-only` standing", async () => {
    const joinee = await vessel(11);
    const key = "lar:///ha.ka.ba/bags/daemon/draft-bindings/" + "f".repeat(64);
    const put: unknown[] = [];
    const delegated: string[] = [];
    await resolveOrMintBinding({
      kind: "draft-binding", prefix: "lar:///ha.ka.ba/bags/daemon/draft-bindings", fingerprint: "f".repeat(64),
      repo: { create: () => { throw new Error("reuse mints nothing"); }, flush: async () => {} },
      daemonStore: {
        get: async () => ({ tiddler: { title: key, text: "automerge:earlierBinding", "face-reach": "vessel-only", "keyhive-doc-id": "d3".repeat(16) }, meta: { authority: "personal-bindings" } }),
        put: async (rec: unknown) => { put.push(rec); },
      } as never,
      keyhive: joinee, personaGroupId: "cd".repeat(16),
      faceSeated: async () => { throw new Error("reuse asked the seat"); },
      faceDoor: { mint: async () => { throw new Error("unseated mint reached face"); }, adopt: () => {}, remint: async () => { throw new Error("unseated remint reached face"); } },
      mintedByHex: "0x" + "a".repeat(64), recipeTrace: { wikiDocId: "w", libraryBagDocIds: [] },
    });
    expect(delegated).toEqual([]);
    expect(put).toEqual([]);
    await joinee.dispose();
  });

  test("a face reuse refuses a binding without its Keyhive document identity by name", async () => {
    const joinee = await vessel(16);
    const key = "lar:///ha.ka.ba/bags/daemon/working-bindings/" + "e".repeat(64);
    const error = await resolveOrMintBinding({
      kind: "working-binding", prefix: "lar:///ha.ka.ba/bags/daemon/working-bindings", fingerprint: "e".repeat(64),
      repo: { create: () => { throw new Error("reuse mints nothing"); }, flush: async () => {} },
      daemonStore: {
        get: async () => ({ tiddler: { title: key, text: "automerge:unrestorable", "face-reach": "face" } }),
        put: async () => {},
      } as never,
      keyhive: joinee, personaGroupId: "cd".repeat(16), faceSeated: async () => true,
      faceDoor: makeFaceBagDoor({ face: joinee, groupId: "cd".repeat(16) }),
      mintedByHex: "0x" + "a".repeat(64), recipeTrace: { wikiDocId: "daemon", libraryBagDocIds: [] },
    }).catch((err: unknown) => err);
    expect((error as Error).name).toBe("BindingRegistrationRefusal");
    expect((error as Error).message).toContain(key);
    expect((error as Error).message).toMatch(/fresh start by hand/i);
    await joinee.dispose();
  });

  test("H3 CONTROL — a face-first binding delegates once and same-process reuse does not re-grant", async () => {
    const audience = await vessel(14);
    const provider = await vessel(15);
    const face = await vessel(18);
    await face.receiveContactCard(await audience.contactCard());
    const agent = await audience.vesselIdentifierHex();
    const records = new Map<string, Record<string, unknown>>();
    const daemonStore = {
      get: async (title: string) => records.get(title),
      put: async (record: unknown) => {
        const row = record as Record<string, unknown>;
        records.set(String((row.tiddler as Record<string, unknown>).title), row);
      },
    } as never;
    const input = {
      kind: "working-binding" as const, prefix: "lar:///ha.ka.ba/bags/daemon/working-bindings",
      fingerprint: "c".repeat(64), repo: { create: () => ({ url: "automerge:face-first", documentId: "face-first" }), flush: async () => {} }, daemonStore,
      keyhive: provider, faceDoor: makeFaceBagDoor({ face, groupId: agent }), personaGroupId: agent, faceSeated: async () => true,
      mintedByHex: "0x" + "a".repeat(64), recipeTrace: { wikiDocId: "daemon", libraryBagDocIds: [] },
    };
    let grants = 0;
    const originalDelegate = face.delegate.bind(face);
    face.delegate = async (args) => { grants += 1; return originalDelegate(args); };

    expect(await resolveOrMintBinding(input)).toEqual({ url: "automerge:face-first", minted: true });
    expect(await resolveOrMintBinding(input)).toEqual({ url: "automerge:face-first", minted: false });
    expect(grants).toBe(1);
    expect(await face.verify({ presenter: agent, bagUrl: "automerge:face-first", access: "admin" })).toEqual({ ok: true });
    expect(provider.docIdOfBag("automerge:face-first")).toBeNull();
    await provider.dispose(); await face.dispose(); await audience.dispose();
  });
});
