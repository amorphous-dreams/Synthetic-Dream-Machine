/**
 * browser-promoted-store — the browser's device-local trust record: the ledger (rows keyed by (wiki, digest)) and the kāpae cache rest as
 * sealed keystore rows named by the PersonaGroup, never in a CRDT document, and the CAS door verifies a digest before OPFS sees a byte.
 *
 * A vessel with no custody slot refuses the read and the write and never reads empty. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { EMPTY_KAPAE_LOCAL, EMPTY_LEDGER, ledgerCommit, promoteDigest, promoteEdgeKey } from "@lararium/mesh";
import { bindSyntheticBrowserCustodySlot } from "./browser-custody-fixture.js";
import { readKeystoreRow } from "../src/browser-custody.js";
import { browserPromoteCas, browserPromoteStores, kapaeRow, promotedRow } from "../src/browser-promoted-store.js";

const W1 = "lar:///ha.ka.ba/wikis/field-notes";
const RITE = { title: "rites/a", text: "exports.startup = function(){}", fields: { "module-type": "startup" } };
const ledgerWith = () => ledgerCommit(EMPTY_LEDGER, { wiki: W1, digest: promoteDigest(RITE), item: RITE, revision: "a".repeat(64) }, { kind: "hand", id: "hand-1" });

describe("the browser's trust record at rest", () => {
  test("RED: an unwritten group reads the empty ledger and cache; a written one reads back whole under its own sealed row; CONTROL: a second group stays separate", async () => {
    const idbName = `promoted-${crypto.randomUUID()}`;
    await bindSyntheticBrowserCustodySlot(idbName, "group-a", "group-b", "group-naive");
    const a = browserPromoteStores(idbName, "group-a"), b = browserPromoteStores(idbName, "group-b");
    expect(await a.ledger.read()).toEqual(EMPTY_LEDGER);
    expect(await a.local.read()).toEqual(EMPTY_KAPAE_LOCAL);
    await a.ledger.write(ledgerWith());
    await a.local.write({ shadowed: [promoteEdgeKey(W1, promoteDigest(RITE))] });
    expect(await a.ledger.read()).toEqual(ledgerWith());
    expect((await a.local.read()).shadowed).toEqual([promoteEdgeKey(W1, promoteDigest(RITE))]);
    expect(await b.ledger.read()).toEqual(EMPTY_LEDGER);
    expect(promotedRow("group-a")).toBe("promoted/group-a");
    expect(kapaeRow("group-a")).toBe("kapae/group-a");
    expect(await readKeystoreRow(idbName, promotedRow("group-a"))).toBeInstanceOf(Uint8Array);
    expect(await readKeystoreRow(idbName, promotedRow("group-b"))).toBeUndefined();
  });

  test("RED: two commits of different wikis at once through the store's update both land", async () => {
    const idbName = `promoted-concurrent-${crypto.randomUUID()}`;
    await bindSyntheticBrowserCustodySlot(idbName, "group-a", "group-b", "group-naive");
    const stores = browserPromoteStores(idbName, "group-a");
    const W2 = "lar:///ha.ka.ba/wikis/garden";
    const OTHER = { title: "rites/b", text: "exports.startup = function(){}", fields: { "module-type": "startup" } };
    const commit = (wiki: string, item: typeof RITE) => (standing: typeof EMPTY_LEDGER) => ledgerCommit(standing, { wiki, digest: promoteDigest(item), item, revision: "b".repeat(64) }, { kind: "hand", id: "hand-1" });
    // CONTROL (the harness discriminates): a NAIVE read-then-write update over the same rows loses a row under the same two commits.
    const naiveStore = browserPromoteStores(idbName, "group-naive");
    const naive = async (fn: (standing: typeof EMPTY_LEDGER) => typeof EMPTY_LEDGER) => { const standing = await naiveStore.ledger.read(); await new Promise((r) => setTimeout(r, 0)); await naiveStore.ledger.write(fn(standing)); };
    await Promise.all([naive(commit(W1, RITE)), naive(commit(W2, OTHER))]);
    expect((await naiveStore.ledger.read()).rows, "a naive update loses a row").toHaveLength(1);
    await Promise.all([stores.ledger.update(commit(W1, RITE)), stores.ledger.update(commit(W2, OTHER))]);
    expect((await stores.ledger.read()).rows.map((r) => r.wiki).sort()).toEqual([W1, W2].sort());
  });

  test("RED: a vessel with no custody slot refuses the read and the write and never reads empty; CONTROL: the slotted vessel reads", async () => {
    const bare = `promoted-bare-${crypto.randomUUID()}`;
    const stores = browserPromoteStores(bare, "group-a");
    await expect(stores.ledger.read()).rejects.toThrow();
    await expect(stores.ledger.write(ledgerWith())).rejects.toThrow();
    const slotted = `promoted-slot-${crypto.randomUUID()}`;
    await bindSyntheticBrowserCustodySlot(slotted, "group-a");
    await expect(browserPromoteStores(slotted, "group-a").ledger.read()).resolves.toEqual(EMPTY_LEDGER);
  });
});

describe("the CAS door", () => {
  test("RED: bytes that hash elsewhere throw `cas-digest-mismatch` before OPFS is touched; CONTROL: matching bytes reach OPFS, or name `cas-opfs-unavailable` where none stands (never a silent no-op)", async () => {
    const cas = browserPromoteCas();
    const bytes = new TextEncoder().encode("{\"title\":\"rites/a\",\"text\":\"x\"}");
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((n) => n.toString(16).padStart(2, "0")).join("");
    await expect(cas.put("0".repeat(64), bytes)).rejects.toThrow(/cas-digest-mismatch/);
    const outcome = await cas.put(digest, bytes).then(() => "written", (e: Error) => e.message);
    expect(["written"].includes(outcome) || /cas-opfs-unavailable/.test(outcome), outcome).toBe(true);
  });
});
