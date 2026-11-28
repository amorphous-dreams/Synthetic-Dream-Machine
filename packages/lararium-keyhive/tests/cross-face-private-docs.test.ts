/**
 * cross-face-private-docs — A LIT FACE RECEIVES VISITS (Sol H3): a cross-face view checks the DOCUMENT each binding resolves to,
 * against every document a private slot names on this island, so a label never carries a private document past it.
 *
 *   P1  RED: the deny set names every lit face's daemon personal and draft documents (the worn face's mounted ones, each face's
 *       as the state document names it), and every personal or draft binding the daemon document records for any wiki
 *   P2  RED: working, canon and other binding kinds stay out of the set; a torn url names nothing
 *   P3  RED (Sol 407c H3): the kinds the resolver really writes: a binding row and its mint row, minted through
 *       `resolveOrMintBinding` itself for a personal and a draft slot, both land in the set, so the scan cannot drift
 *       from the rows production writes
 *   P4  RED (fail closed): what the deny set could not read stands by name (`unread`): a private row whose url names no
 *       document, no state reader while faces stand lit, no daemon store; a face whose private slot never minted reads whole
 */
import { describe, expect, it } from "vitest";
import { VESSEL_STATE_ID, DRAFT_BINDINGS_PREFIX, PERSONAL_BINDINGS_PREFIX } from "@lararium/mesh/lar-uris";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { type CompositeStore } from "@lararium/mesh/composite-store";
import { type LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import { crossFacePrivateDocs } from "../src/face-engine-source.js";
import { resolveOrMintBinding } from "../src/resolve-binding.js";

const rec = (fields: Record<string, string>) => ({ tiddler: fields });
const slotTitle = (kind: string, group: string) => `${VESSEL_STATE_ID}/daemon-slot/${kind}/${encodeURIComponent(group)}`;

describe("a lit face receives visits: the documents a view refuses by identity", () => {
  const state = new Map<string, unknown>([
    [slotTitle("personal", "group-0"), rec({ title: slotTitle("personal", "group-0"), text: "automerge:worn-personal" })],
    [slotTitle("personal", "group-1"), rec({ title: slotTitle("personal", "group-1"), text: "automerge:sib-personal" })],
    [slotTitle("draft", "group-1"), rec({ title: slotTitle("draft", "group-1"), text: "automerge:sib-draft" })],
    [slotTitle("working", "group-1"), rec({ title: slotTitle("working", "group-1"), text: "automerge:sib-working" })],
  ]);
  const daemon = new Map<string, unknown>([
    ["b/personal", rec({ title: "b/personal", text: "automerge:garden-personal", kind: "personal-binding" })],
    ["b/draft-mint", rec({ title: "b/draft-mint", text: "automerge:garden-draft", kind: "binding-mint", "binding-kind": "draft-binding" })],
    ["b/working", rec({ title: "b/working", text: "automerge:garden-working", kind: "working-binding" })],
    ["b/torn", rec({ title: "b/torn", text: "not a url", kind: "personal-binding" })],
  ]);
  const deps = {
    faces: [{ handleIndex: 0, group: "group-0", relation: null }, { handleIndex: 1, group: "group-1", relation: null }],
    mounted: (slot: string) => (slot === wikiSlotUri("daemon", "personal") ? { documentId: "mounted-personal" } : slot === wikiSlotUri("daemon", "draft") ? { documentId: "mounted-draft" } : slot === wikiSlotUri("daemon", "working") ? { documentId: "mounted-working" } : null),
    state: { get: async (title: string) => state.get(title) ?? null },
    daemon: { listVisible: async () => [...daemon.keys()], get: async (title: string) => (daemon.get(title) as never) ?? null },
  };

  it("P1 RED: every lit face's daemon personal and draft documents, and every private binding the daemon records", async () => {
    const { docs } = await crossFacePrivateDocs(deps as never);
    for (const id of ["mounted-personal", "mounted-draft", "worn-personal", "sib-personal", "sib-draft", "garden-personal", "garden-draft"]) expect(docs.has(id), id).toBe(true);
  });

  it("P2 RED: working, canon and other kinds stay out; a torn url names nothing", async () => {
    const { docs } = await crossFacePrivateDocs(deps as never);
    for (const id of ["mounted-working", "sib-working", "garden-working", "not a url"]) expect(docs.has(id), id).toBe(false);
  });

  it("P4 RED (fail closed): a private row naming no document, an absent state reader with faces lit, and an absent daemon store each stand unread by name; a face whose private slot never minted reads whole", async () => {
    const torn = await crossFacePrivateDocs(deps as never);
    expect(torn.unread, "the torn personal binding stands unread").toEqual(["b/torn names no document"]);
    const blind = await crossFacePrivateDocs({ ...deps, state: null, daemon: null } as never);
    expect(blind.unread).toEqual(["the state document (each face's daemon slots)", "the daemon document (each wiki's slot bindings)"]);
    // A face that never minted a private slot names no row: nothing private to guard, and the set reads whole.
    const fresh = await crossFacePrivateDocs({ faces: [{ handleIndex: 2, group: "group-2", relation: null }], mounted: () => null,
      state: { get: async () => null }, daemon: { listVisible: async () => [], get: async () => null } } as never);
    expect(fresh.unread).toEqual([]);
    expect([...fresh.docs]).toEqual([]);
  });

  it("P3 RED: rows minted through resolveOrMintBinding itself, a binding row and its mint row for each private kind, all land", async () => {
    const records = new Map<string, LarTiddlerRecord>();
    const store = {
      get: async (title: string) => records.get(title) ?? null,
      put: async (record: LarTiddlerRecord) => { records.set(record.tiddler.title, record); },
      listVisible: async () => [...records.keys()],
    } as unknown as CompositeStore;
    let n = 0;
    const repo = { create: () => { n++; return { url: `automerge:real-${n}`, documentId: `real-${n}`, whenReady: async () => {} }; }, flush: async () => {} };
    const base = { repo, daemonStore: store, mintedByHex: "synthetic", recipeTrace: { wikiDocId: "wiki", libraryBagDocIds: [] } };
    const personal = await resolveOrMintBinding({ ...base, kind: "personal-binding", prefix: PERSONAL_BINDINGS_PREFIX, fingerprint: "a".repeat(64) });
    const draft = await resolveOrMintBinding({ ...base, kind: "draft-binding", prefix: DRAFT_BINDINGS_PREFIX, fingerprint: "b".repeat(64) });
    // Both rows each mint wrote: the binding row keyed by fingerprint, and the mint row beside it.
    expect([...records.values()].map((r) => r.tiddler["kind"]).sort()).toEqual(["binding-mint", "binding-mint", "draft-binding", "personal-binding"]);
    const { docs, unread } = await crossFacePrivateDocs({ faces: [], mounted: () => null, state: null, daemon: store });
    expect(unread, "no lit face needs the state reader, and every private row names its document").toEqual([]);
    expect(docs.has(personal.url.slice("automerge:".length)), "the personal binding's document").toBe(true);
    expect(docs.has(draft.url.slice("automerge:".length)), "the draft binding's document").toBe(true);
    // A mint row alone (its binding row not yet written) still names its document.
    for (const [title, record] of [...records]) if (record.tiddler["kind"] !== "binding-mint") records.delete(title);
    const minted = (await crossFacePrivateDocs({ faces: [], mounted: () => null, state: null, daemon: store })).docs;
    expect([...minted].sort()).toEqual(["real-1", "real-2"]);
  });
});
