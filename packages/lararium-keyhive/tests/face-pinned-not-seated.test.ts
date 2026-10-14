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
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
    const repo = { create: () => ({ url: "automerge:mintedBinding", documentId: "mintedBinding" }), flush: async () => {} };
    const delegated: string[] = [];
    const r = await resolveOrMintBinding({
      kind: "draft-binding", prefix: "lar:///ha.ka.ba/bags/daemon/draft-bindings", fingerprint: "f".repeat(64),
      repo, daemonStore, keyhive: joinee,
      personaGroupId: "cd".repeat(16),
      faceSeated: async () => false,
      delegateToFace: async (bagUrl) => { delegated.push(bagUrl); },
      mintedByHex: "0x" + "a".repeat(64),
      recipeTrace: { wikiDocId: "w", libraryBagDocIds: [] },
    });
    expect(r.minted).toBe(true);
    expect(delegated, "no delegation to an agent the veil cannot name").toEqual([]);
    const fields = ((put.find((row) => (row as { tiddler?: Record<string, unknown> }).tiddler?.kind === "draft-binding") as { tiddler?: Record<string, unknown> } | undefined)?.tiddler);
    expect(fields?.["face-reach"], "the record names the posture").toBe("vessel-only");
    await joinee.dispose();
  });

  test("V3 — a seat landing AFTER the mint re-grants the vessel-only binding on reuse, and the record says so", async () => {
    const joinee = await vessel(11);
    const key = "lar:///ha.ka.ba/bags/daemon/draft-bindings/" + "f".repeat(64);
    const stored: Record<string, Record<string, unknown>> = {
      [key]: { tiddler: { title: key, text: "automerge:earlierBinding", kind: "draft-binding", "face-reach": "vessel-only",
                          "keyhive-doc-id": "d1".repeat(32),
                          "minted-by": "0x" + "a".repeat(64) }, meta: { authority: "personal-bindings" } },
    };
    const put: Record<string, unknown>[] = [];
    const daemonStore = {
      get: async (title: string) => stored[title],
      put: async (rec: unknown) => { put.push(rec as Record<string, unknown>); },
    } as never;
    const repo = { create: () => { throw new Error("reuse mints nothing"); }, flush: async () => {} };
    const delegated: Array<[string, string]> = [];
    const r = await resolveOrMintBinding({
      kind: "draft-binding", prefix: "lar:///ha.ka.ba/bags/daemon/draft-bindings", fingerprint: "f".repeat(64),
      repo, daemonStore, keyhive: joinee,
      personaGroupId: "cd".repeat(16),
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
    expect(fields?.["keyhive-doc-id"], "a document this stand holds no hand in gives way to a fresh one, and the record names it")
      .toMatch(/^(0x)?[0-9a-f]{64}$/);
    expect(fields?.["keyhive-doc-id"]).not.toBe("d1".repeat(32));
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
      repo: { create: () => { throw new Error("reuse mints nothing"); }, flush: async () => {} },
      daemonStore: {
        get: async () => ({ tiddler: { title: key, text: "automerge:earlierBinding", "face-reach": "vessel-only", "keyhive-doc-id": "d3".repeat(16) }, meta: { authority: "personal-bindings" } }),
        put: async (rec: unknown) => { put.push(rec); },
      } as never,
      keyhive: joinee, personaGroupId: "cd".repeat(16),
      faceSeated: async () => false,
      delegateToFace: async (bagUrl) => { delegated.push(bagUrl); },
      mintedByHex: "0x" + "a".repeat(64), recipeTrace: { wikiDocId: "w", libraryBagDocIds: [] },
    });
    expect(delegated).toEqual([]);
    expect(put).toEqual([]);
    await joinee.dispose();
  });

  test("a seated reuse refuses a binding without its Keyhive document identity by name", async () => {
    const joinee = await vessel(16);
    const key = "lar:///ha.ka.ba/bags/daemon/working-bindings/" + "e".repeat(64);
    const error = await resolveOrMintBinding({
      kind: "working-binding", prefix: "lar:///ha.ka.ba/bags/daemon/working-bindings", fingerprint: "e".repeat(64),
      repo: { create: () => { throw new Error("reuse mints nothing"); }, flush: async () => {} },
      daemonStore: {
        get: async () => ({ tiddler: { title: key, text: "automerge:unrestorable", "face-reach": "vessel-only" } }),
        put: async () => {},
      } as never,
      keyhive: joinee, personaGroupId: "cd".repeat(16), faceSeated: async () => true,
      mintedByHex: "0x" + "a".repeat(64), recipeTrace: { wikiDocId: "daemon", libraryBagDocIds: [] },
    }).catch((err: unknown) => err);
    expect((error as Error).name).toBe("BindingRegistrationRefusal");
    expect((error as Error).message).toContain(key);
    expect((error as Error).message).toMatch(/fresh start by hand/i);
    await joinee.dispose();
  });

  test("H3-1 — a later process restores a post-floor binding from persisted events before re-grant", async () => {
    const audience = await vessel(12);
    const root = mkdtempSync(join(tmpdir(), "keyhive-binding-restart-"));
    const eventsDir = join(root, "events");
    const recordsDir = join(root, "records");
    const archivesDir = join(root, "archives");
    mkdirSync(eventsDir); mkdirSync(recordsDir); mkdirSync(archivesDir);
    const eventStore = {
      put: async (rec: { hash: string; variant: string; bytes: Uint8Array; island?: string }) => {
        writeFileSync(join(eventsDir, `${rec.hash}.json`), JSON.stringify({ ...rec, bytes: Array.from(rec.bytes) }));
      },
      list: async () => readdirSync(eventsDir).map((name) => {
        const rec = JSON.parse(readFileSync(join(eventsDir, name), "utf8")) as {
          hash: string; variant: string; bytes: number[]; island?: string;
        };
        return { ...rec, bytes: new Uint8Array(rec.bytes) };
      }),
    };
    const first = new KeyhiveProvider();
    await first.init({ seed: seedOf(13), eventStore });
    await first.receiveContactCard(await audience.contactCard());
    const agent = await audience.vesselIdentifierHex();
    const bindingUrl = "automerge:working-binding-h3";
    const key = "lar:///ha.ka.ba/bags/daemon/working-bindings/" + "b".repeat(64);
    const freshRecordStore = () => ({
      get: async (title: string) => {
        try { return JSON.parse(readFileSync(join(recordsDir, `${Buffer.from(title).toString("hex")}.json`), "utf8")) as Record<string, unknown>; }
        catch { return undefined; }
      },
      put: async (record: unknown) => {
        const row = record as Record<string, unknown>;
        const tiddler = row.tiddler as Record<string, unknown>;
        writeFileSync(join(recordsDir, `${Buffer.from(String(tiddler.title)).toString("hex")}.json`), JSON.stringify(row));
      },
    }) as never;
    const firstStore = freshRecordStore();
    const secondStore = freshRecordStore();
    const archivePath = join(archivesDir, "archive-floor.bin");
    const archive = await first.exportArchive();
    writeFileSync(archivePath, archive);
    const args = (provider: KeyhiveProvider, faceSeated: boolean) => ({
      kind: "working-binding" as const,
      prefix: "lar:///ha.ka.ba/bags/daemon/working-bindings",
      fingerprint: "b".repeat(64), repo: { create: () => ({ url: bindingUrl, documentId: "binding" }), flush: async () => {} },
      daemonStore: provider === first ? firstStore : secondStore,
      keyhive: provider, personaGroupId: agent, faceSeated: async () => faceSeated,
      mintedByHex: "0x" + "a".repeat(64), recipeTrace: { wikiDocId: "daemon", libraryBagDocIds: [] },
    });

    await resolveOrMintBinding(args(first, false));
    const firstRecord = await firstStore.get(key) as { tiddler?: Record<string, unknown> } | undefined;
    const firstDocId = firstRecord?.tiddler?.["keyhive-doc-id"];
    const second = new KeyhiveProvider();
    await second.init({ seed: seedOf(13), eventStore, archiveBytes: readFileSync(archivePath) });
    await second.hydrateFromEventStore();

    await expect(resolveOrMintBinding(args(second, true))).resolves.toEqual({ url: bindingUrl, minted: false });
    expect(firstDocId, "the binding records the document authority it names").toEqual(expect.any(String));
    expect(await second.verify({ presenter: agent, bagUrl: bindingUrl, access: "admin" }),
      "the seated face receives authority to the same Keyhive document").toEqual({ ok: true });
    expect(((await secondStore.get(key) as { tiddler?: Record<string, unknown> } | undefined)?.tiddler)?.["face-reach"]).toBe("face");

    const third = new KeyhiveProvider();
    await third.init({ seed: seedOf(13), eventStore: { put: async () => {}, list: async () => [] }, archiveBytes: await second.exportArchive() });
    let thirdGrants = 0;
    const originalDelegate = third.delegate.bind(third);
    third.delegate = async (delegateArgs) => { thirdGrants += 1; return originalDelegate(delegateArgs); };
    await expect(resolveOrMintBinding(args(third, true))).resolves.toEqual({ url: bindingUrl, minted: false });
    expect(thirdGrants, "a face binding is not re-granted on the third process").toBe(0);
    await first.dispose(); await second.dispose(); await third.dispose(); await audience.dispose();
    rmSync(root, { recursive: true, force: true });
  });

  test("H3-2 — a binding minted by a stand whose Archive nobody kept gets a fresh Keyhive document at the seat", async () => {
    // The shape a vessel lives: its founding keeps an Archive; every boot rests at the floor, where a provider
    // stands from the seed alone, mints the working binding on the vessel's own key and keeps no Archive; then an
    // unlock stands the provider again from the FOUNDING's Archive with the face seated.
    const audience = await vessel(16);
    const agent = await audience.vesselIdentifierHex();
    const events: Array<{ hash: string; variant: string; bytes: Uint8Array; island?: string }> = [];
    const eventStore = {
      put: async (rec: { hash: string; variant: string; bytes: Uint8Array; island?: string }) => { if (!events.some((e) => e.hash === rec.hash)) events.push(rec); },
      list: async () => [...events],
    };
    const records = new Map<string, Record<string, unknown>>();
    const daemonStore = {
      get: async (title: string) => records.get(title),
      put: async (record: unknown) => {
        const row = record as Record<string, unknown>;
        records.set(String((row.tiddler as Record<string, unknown>).title), row);
      },
    } as never;
    const bindingUrl = "automerge:working-binding-h3-2";
    const key = "lar:///ha.ka.ba/bags/daemon/working-bindings/" + "e".repeat(64);
    const args = (provider: KeyhiveProvider, faceSeated: boolean) => ({
      kind: "working-binding" as const, prefix: "lar:///ha.ka.ba/bags/daemon/working-bindings",
      fingerprint: "e".repeat(64), repo: { create: () => ({ url: bindingUrl, documentId: "binding" }), flush: async () => {} },
      daemonStore, keyhive: provider, personaGroupId: agent, faceSeated: async () => faceSeated,
      mintedByHex: "0x" + "a".repeat(64), recipeTrace: { wikiDocId: "daemon", libraryBagDocIds: [] },
    });
    const docIdAt = (): unknown => (records.get(key) as { tiddler?: Record<string, unknown> } | undefined)?.tiddler?.["keyhive-doc-id"];

    const founding = new KeyhiveProvider();
    await founding.init({ seed: seedOf(17), eventStore });
    await founding.settleEvents();
    const foundingArchive = await founding.exportArchive();
    await founding.dispose();

    const floor = new KeyhiveProvider();
    await floor.init({ seed: seedOf(17), eventStore });
    await floor.hydrateFromEventStore();
    await resolveOrMintBinding(args(floor, false));
    const floorDocId = docIdAt();
    expect(floorDocId).toEqual(expect.any(String));
    expect(await floor.holdsHand(bindingUrl), "CONTROL: the minting stand holds its hand while it lives").toBe(true);
    await floor.settleEvents();
    await floor.dispose();

    const lit = new KeyhiveProvider();
    await lit.init({ seed: seedOf(17), eventStore, archiveBytes: foundingArchive });
    await lit.hydrateFromEventStore();
    await lit.receiveContactCard(await audience.contactCard());
    lit.adoptBag(bindingUrl, floorDocId as string);
    expect(await lit.holdsHand(bindingUrl), "the floor's document reads known and handless to the lit stand").toBe(false);
    await expect(lit.delegate({ bagUrl: bindingUrl, audience: agent, access: "admin" }),
      "CONTROL: a grant on the floor's document refuses, so the re-mint below measures something").rejects.toThrow(/Cgka is not initialized/);

    await expect(resolveOrMintBinding(args(lit, true))).resolves.toEqual({ url: bindingUrl, minted: false });
    const litDocId = docIdAt();
    expect(litDocId, "the record names the document that serves").toEqual(expect.any(String));
    expect(litDocId).not.toBe(floorDocId);
    expect((records.get(key) as { tiddler?: Record<string, unknown> }).tiddler?.["face-reach"]).toBe("face");
    expect(await lit.holdsHand(bindingUrl)).toBe(true);
    expect(await lit.verify({ presenter: agent, bagUrl: bindingUrl, access: "admin" })).toEqual({ ok: true });
    expect((await lit.encryptContent(bindingUrl, new Uint8Array([1]))).byteLength, "the lit stand seals into it").toBeGreaterThan(0);
    await lit.dispose(); await audience.dispose();
  });

  test("H3 CONTROL — a face-first binding delegates once and same-process reuse does not re-grant", async () => {
    const audience = await vessel(14);
    const provider = await vessel(15);
    await provider.receiveContactCard(await audience.contactCard());
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
      keyhive: provider, personaGroupId: agent, faceSeated: async () => true,
      mintedByHex: "0x" + "a".repeat(64), recipeTrace: { wikiDocId: "daemon", libraryBagDocIds: [] },
    };
    let grants = 0;
    const originalDelegate = provider.delegate.bind(provider);
    provider.delegate = async (args) => { grants += 1; return originalDelegate(args); };

    expect(await resolveOrMintBinding(input)).toEqual({ url: "automerge:face-first", minted: true });
    expect(await resolveOrMintBinding(input)).toEqual({ url: "automerge:face-first", minted: false });
    expect(grants).toBe(1);
    expect(await provider.verify({ presenter: agent, bagUrl: "automerge:face-first", access: "admin" })).toEqual({ ok: true });
    await provider.dispose(); await audience.dispose();
  });
});
