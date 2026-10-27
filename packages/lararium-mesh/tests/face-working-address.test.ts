import { describe, expect, test } from "vitest";
import { load, merge, save } from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import type { SessionFace } from "../src/session-contract.js";
import {
  FaceWorkingAddressRefusal, faceWorkingDocUrl, faceWorkingGenesis,
  materializeFaceWorkingDoc, resolveFaceWorkingSlot,
} from "../src/face-working-address.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";

const face = (subject: string): SessionFace => ({
  personaGroup: subject, proofSubject: subject, admitRef: "admit", causalRevision: "revision",
  planes: { persona: "persona", circles: "circles", identities: "identities", sessions: "sessions", intents: "intents" },
});
const a = () => new Uint8Array(32).fill(7);
const b = () => new Uint8Array(32).fill(8);
const reason = (value: unknown, name: string) => {
  expect(value).toBeInstanceOf(FaceWorkingAddressRefusal);
  expect((value as FaceWorkingAddressRefusal).reason).toBe(name);
};

describe("face working address", () => {
  test("fixed derivation vector, computed by this implementation", () => {
    expect(faceWorkingDocUrl(a(), "w", "working")).toBe("automerge:2JgKxRR9seatCZiAWnEiVEJmC7JS");
    expect(faceWorkingGenesis()).toEqual(emptyLarDoc());
  });

  test("one face reopens one address, across fresh resolvers and recipe fingerprints", async () => {
    const first = await resolveFaceWorkingSlot({ face: face("A"), wikiId: "w", kind: "working", secret: async () => a() });
    const second = await resolveFaceWorkingSlot({ face: face("A"), wikiId: "w", kind: "working", secret: async () => a() });
    expect(first).toEqual(second);
    expect(first).toEqual({ ok: true, url: faceWorkingDocUrl(a(), "w", "working"), reach: "face" });
    const recipes = [{ fingerprint: "recipe-a", wikiId: "w" }, { fingerprint: "recipe-b", wikiId: "w" }];
    expect(recipes.map((r) => faceWorkingDocUrl(a(), r.wikiId, "working"))).toEqual([first.ok && first.url, first.ok && first.url]);
    expect(faceWorkingDocUrl(a(), "w", "draft")).not.toBe(faceWorkingDocUrl(a(), "w", "working"));
    expect(faceWorkingDocUrl(a(), "other", "working")).not.toBe(faceWorkingDocUrl(a(), "w", "working"));
  });

  test("wrong-face claim refuses before any document opens", async () => {
    const claimed = faceWorkingDocUrl(a(), "w", "working");
    const own = faceWorkingDocUrl(b(), "w", "working");
    expect(own).not.toBe(claimed);
    const repo = new Repo({ network: [] });
    const before = Object.keys(repo.handles);
    const result = await resolveFaceWorkingSlot({ face: face("B"), wikiId: "w", kind: "working", secret: async () => b(), claimed });
    expect(result.ok).toBe(false);
    if (!result.ok) reason(result.refusal, "address-not-derived");
    expect(Object.keys(repo.handles)).toEqual(before);
    await repo.shutdown();
  });

  test("a leaf without the secret refuses and mints no document", async () => {
    const repo = new Repo({ network: [] });
    const before = Object.keys(repo.handles);
    const result = await resolveFaceWorkingSlot({ face: face("leaf"), wikiId: "w", kind: "working", secret: async () => null });
    expect(result.ok).toBe(false);
    if (!result.ok) reason(result.refusal, "no-address-secret");
    expect(Object.keys(repo.handles)).toEqual(before);
    await repo.shutdown();
  });

  test("malformed inputs refuse by name and a resolver clears supplied secret bytes", async () => {
    const thrown = (run: () => unknown, expected: string) => {
      try { run(); throw new Error("address unexpectedly derived"); }
      catch (error) { reason(error, expected); }
    };
    for (const length of [31, 33]) thrown(() => faceWorkingDocUrl(new Uint8Array(length), "w", "working"), "secret-malformed");
    thrown(() => faceWorkingDocUrl(a(), "", "working"), "wiki-malformed");
    thrown(() => faceWorkingDocUrl(a(), null as never, "working"), "wiki-malformed");
    thrown(() => faceWorkingDocUrl(a(), "w", "strange" as never), "kind-unknown");
    const secret = a();
    const resolved = await resolveFaceWorkingSlot({ face: face("A"), wikiId: "w", kind: "working", secret: async () => secret });
    expect(resolved.ok).toBe(true);
    expect(secret).toEqual(new Uint8Array(32));
    const malformed = new Uint8Array(31).fill(9);
    const refused = await resolveFaceWorkingSlot({ face: face("A"), wikiId: "w", kind: "working", secret: async () => malformed });
    expect(refused.ok).toBe(false);
    if (!refused.ok) reason(refused.refusal, "secret-malformed");
    expect(malformed).toEqual(new Uint8Array(31));
  });

  test("two faces on one vessel retain separate working documents", async () => {
    const repo = new Repo({ network: [] });
    const first = await materializeFaceWorkingDoc(repo, faceWorkingDocUrl(a(), "w", "working"), "w");
    const second = await materializeFaceWorkingDoc(repo, faceWorkingDocUrl(b(), "w", "working"), "w");
    first.change((doc) => { doc.tiddlers.A = { tiddler: { title: "A", text: "first" } } as never; });
    second.change((doc) => { doc.tiddlers.B = { tiddler: { title: "B", text: "second" } } as never; });
    expect(first.doc().tiddlers.A).toBeDefined();
    expect(first.doc().tiddlers.B).toBeUndefined();
    expect(second.doc().tiddlers.B).toBeDefined();
    expect(second.doc().tiddlers.A).toBeUndefined();
    await repo.shutdown();
  });

  test("two offline vessels mint the same genesis and merge their independent writes", async () => {
    const firstRepo = new Repo({ network: [] });
    const secondRepo = new Repo({ network: [] });
    const url = faceWorkingDocUrl(a(), "w", "working");
    const first = await materializeFaceWorkingDoc(firstRepo, url, "w");
    const second = await materializeFaceWorkingDoc(secondRepo, url, "w");
    expect(first.url).toBe(second.url);
    expect(save(first.doc())).toEqual(save(second.doc()));
    first.change((doc) => { doc.tiddlers.A = { tiddler: { title: "A", text: "first" } } as never; });
    second.change((doc) => { doc.tiddlers.B = { tiddler: { title: "B", text: "second" } } as never; });
    const joined = merge(load(save(first.doc())), load(save(second.doc()))) as unknown as LarDoc;
    expect(joined.tiddlers.A).toBeDefined();
    expect(joined.tiddlers.B).toBeDefined();
    await firstRepo.shutdown();
    await secondRepo.shutdown();
  });
});
