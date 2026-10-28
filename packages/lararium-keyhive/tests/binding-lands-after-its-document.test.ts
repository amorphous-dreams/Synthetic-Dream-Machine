import { describe, expect, test } from "vitest";
import * as bindingModule from "../src/resolve-binding.js";
import { DAEMON_BAG_ID, mutableLarRecord, type CompositeStore, type LarTiddlerRecord } from "@lararium/mesh";
import { resolveOrMintBinding, restingMinter, unboundMints } from "../src/resolve-binding.js";
import { makeFaceBagDoor } from "../src/face-bag-door.js";

const prefix = "lar:///ha.ka.ba/bags/daemon/draft-bindings";
const fingerprint = "a".repeat(64);

function harness(options: { failFlush?: boolean; initial?: Array<[string, string, string]> } = {}) {
  const calls: string[] = [];
  const records = new Map<string, LarTiddlerRecord>();
  for (const [title, url, kind] of options.initial ?? []) {
    records.set(title, mutableLarRecord(title, { text: url, kind, fingerprint: title.split("/").at(-1) }, "binding-test"));
  }
  const store = {
    get: async (title: string) => records.get(title) ?? null,
    put: async (record: LarTiddlerRecord) => {
      const title = record.tiddler.title;
      calls.push(`put(${record.tiddler.kind === "binding-mint" ? "mint record" : "binding"})`);
      records.set(title, record);
    },
    entries: async () => [...records.entries()].map(([title, record]) => ({ title, record, bagId: DAEMON_BAG_ID, heads: null, changeId: null })),
  } as unknown as CompositeStore;
  const repo = {
    create: () => {
      calls.push("create");
      return { url: "automerge:minted", documentId: "doc-1", whenReady: async () => {} };
    },
    flush: async (documents?: string[]) => {
      calls.push(`flush([${documents?.join(",")}])`);
      if (options.failFlush) throw new Error("document did not rest");
    },
  };
  const keyhive = {
    registerBag: async () => { calls.push("registerBag"); return { docId: "kh-1" }; },
    delegate: async () => { calls.push("delegate"); return { delegationId: "del-1", bytes: new Uint8Array() }; },
    adoptBag: () => {},
  } as never;
  const faceDoor = makeFaceBagDoor({ face: keyhive, groupId: "synthetic-agent" });
  const args = { faceDoor, kind: "draft-binding" as const, prefix, fingerprint, repo, daemonStore: store, keyhive,
    personaGroupId: "synthetic-agent", faceSeated: async () => true,
    mintedByHex: "synthetic", recipeTrace: { wikiDocId: "wiki", libraryBagDocIds: [] } };
  return { args, calls, records, store };
}

describe("binding lands after its document", () => {
  test("V1 — records the mint and flushes its document before writing the binding", async () => {
    const h = harness();
    await resolveOrMintBinding(h.args);
    expect(h.calls).toEqual(["create", "registerBag", "delegate", "put(mint record)", "flush([doc-1])", "put(binding)"]);
    expect(h.calls.indexOf("flush([doc-1])")).toBeLessThan(h.calls.indexOf("put(binding)"));
  });

  test("V2 — a failed flush leaves a listed mint and no binding; a successful flush binds", async () => {
    const failed = harness({ failFlush: true });
    await expect(resolveOrMintBinding(failed.args)).rejects.toThrow("document did not rest");
    expect(failed.records.has(`${prefix}/${fingerprint}`)).toBe(false);
    expect(await unboundMints(failed.store)).toEqual([{ kind: "draft-binding", fingerprint, url: "automerge:minted" }]);

    const passed = harness();
    await resolveOrMintBinding(passed.args);
    expect(passed.records.has(`${prefix}/${fingerprint}`)).toBe(true);
    expect(await unboundMints(passed.store)).toEqual([]);
  });

  test("V3 — reuse on present creates and flushes nothing", async () => {
    const h = harness({ initial: [[`${prefix}/${fingerprint}`, "automerge:existing", "draft-binding"]] });
    await expect(resolveOrMintBinding(h.args)).resolves.toEqual({ url: "automerge:existing", minted: false });
    expect(h.calls).toEqual([]);
  });

  test("V4 — lists only the unbound mint and exposes no removal operation", async () => {
    const boundFingerprint = "b".repeat(64);
    const h = harness({ initial: [[`${prefix}/${boundFingerprint}`, "automerge:bound", "draft-binding"]] });
    const mintTitle = `${prefix}-minted/${boundFingerprint}/doc-bound`;
    const looseTitle = `${prefix}-minted/${fingerprint}/doc-loose`;
    h.records.set(mintTitle, mutableLarRecord(mintTitle, { text: "automerge:bound", kind: "binding-mint", "binding-kind": "draft-binding", fingerprint: boundFingerprint, "minted-by": "synthetic" }, "binding-mints"));
    h.records.set(looseTitle, mutableLarRecord(looseTitle, { text: "automerge:loose", kind: "binding-mint", "binding-kind": "draft-binding", fingerprint, "minted-by": "synthetic" }, "binding-mints"));
    expect(await unboundMints(h.store)).toEqual([{ kind: "draft-binding", fingerprint, url: "automerge:loose" }]);
    expect(Object.keys(bindingModule).some((name) => /delete|remove|prune|sweep/i.test(name))).toBe(false);
  });

  // THE HOST'S STORE ACKNOWLEDGES BEFORE THE BINDING LANDS. An island's own flush proves nothing about a document
  // the vessel's Repo saves; the binding waits on the vessel's acknowledgment and a stop between the island's
  // flush and that acknowledgment leaves no binding.
  test("V5 — the binding waits on the second store's acknowledgment, in order", async () => {
    const h = harness();
    const repo = restingMinter(h.args.repo, async (ids) => { h.calls.push(`rest([${ids.join(",")}])`); });
    await resolveOrMintBinding({ ...h.args, repo });
    expect(h.calls).toEqual(["create", "registerBag", "delegate", "put(mint record)", "flush([doc-1])", "rest([doc-1])", "put(binding)"]);
  });

  test("V6 — a stop between the island's flush and the vessel's acknowledgment leaves a listed mint and no binding", async () => {
    const h = harness();
    const repo = restingMinter(h.args.repo, async () => { throw new Error("the vessel's store did not acknowledge"); });
    await expect(resolveOrMintBinding({ ...h.args, repo })).rejects.toThrow("did not acknowledge");
    expect(h.calls).toContain("flush([doc-1])");
    expect(h.calls).not.toContain("put(binding)");
    expect(h.records.has(`${prefix}/${fingerprint}`)).toBe(false);
    expect(await unboundMints(h.store)).toEqual([{ kind: "draft-binding", fingerprint, url: "automerge:minted" }]);
    // CONTROL: the same mint with an acknowledging store binds.
    const ok = harness();
    await resolveOrMintBinding({ ...ok.args, repo: restingMinter(ok.args.repo, async () => {}) });
    expect(ok.records.has(`${prefix}/${fingerprint}`)).toBe(true);
  });

  test("V-floor — a faceless floor binds its document with no Keyhive and records no Keyhive document id", async () => {
    const h = harness();
    const { keyhive: _none, faceDoor: _door, personaGroupId: _group, faceSeated: _seated, ...floorArgs } = h.args;
    await expect(resolveOrMintBinding(floorArgs)).resolves.toEqual({ url: "automerge:minted", minted: true });
    expect(h.calls).toEqual(["create", "put(mint record)", "flush([doc-1])", "put(binding)"]);
    const record = h.records.get(`${prefix}/${fingerprint}`)!;
    expect(record.tiddler["face-reach"]).toBe("vessel-only");
    expect(record.tiddler["keyhive-doc-id"]).toBeUndefined();
    // CONTROL: the seated face registers its document and records the id.
    const seated = harness();
    await resolveOrMintBinding(seated.args);
    expect(seated.records.get(`${prefix}/${fingerprint}`)!.tiddler["keyhive-doc-id"]).toBe("kh-1");
  });
});
