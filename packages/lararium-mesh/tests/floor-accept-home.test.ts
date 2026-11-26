/**
 * floor-accept-home.test.ts — the place's accept home (pin step 4): a floor-filed document the daemon document names, sealed
 * under the floor's rest key, needing no face; slug -> realm -> Nexus picks; and the hand-asked rehome door.
 *
 * REDS, each with its control:
 *   · a faceless place with its floor key standing mints the home on a hand's act and names it in the daemon document; a
 *     read before any accept mints nothing; a stand with no floor key refuses `floor-unavailable` by name;
 *   · the device table files the home as the floor's, under the floor-accept bag, and never as a floor WIKI; the share
 *     verdict's floor set keeps it on the vessel;
 *   · each recipe's Nexus: the realm's one pin, the home charter where the realm names none, conflicted where two pins stand;
 *   · rehome moves an old row once, with a receipt; the second run lands nothing; a torn row stays; absent bytes stay.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { storedLarRecord } from "../src/stored-record.js";
import { CONTROL_HOME_ID, FLOOR_ACCEPT_BAG } from "../src/lar-uris.js";
import { FLOOR_ACCEPT_HOME_TITLE, deviceDaemonDocs } from "../src/device-daemon-docs.js";
import { floorOnlyDocIds } from "../src/control-home.js";
import { floorAcceptHomeUrlOf, readFloorAcceptHome, standFloorAcceptHome } from "../src/floor-accept-home.js";
import { FLOOR_ACCEPT_KIND, floorAcceptOf, floorAcceptTitle, floorToMount, writeFloorAccept } from "../src/floor-accept.js";
import { recipeFloorNexusOf } from "../src/floor-nexus.js";
import { FLOOR_PIN_UNMOVED, rehomeFloorRows, unmovedFloorRows } from "../src/floor-rehome.js";
import { EDGE_LEDGER_PREFIX, noteRealm } from "../src/edge-ledger.js";
import { noteWorkbench } from "../src/workbench.js";

const memoryHome = (doc: LarDoc = emptyLarDoc()) => ({ changes: 0, doc: () => doc, change(fn: (d: LarDoc) => void) { this.changes += 1; fn(doc); } });

describe("the accept home stands under the place, with no face", () => {
  test("RED: a faceless place mints the home on a hand's act and names it; a read mints nothing; no floor key refuses by name", async () => {
    const repo = new Repo({ network: [] });
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    // A read before any accept: nothing named, nothing minted.
    expect(await standFloorAcceptHome(repo, daemon, { mint: false, floorKey: () => "stands" })).toBeNull();
    expect(floorAcceptHomeUrlOf(daemon.doc())).toBeNull();
    // A herm and a locked hearth each refuse by the floor key's name, and the daemon document stays unmoved.
    const heads = daemon.heads();
    await expect(standFloorAcceptHome(repo, daemon, { mint: true, floorKey: () => "floor-unkeyed" })).rejects.toThrow(/^floor-unavailable: floor-unkeyed:/);
    await expect(standFloorAcceptHome(repo, daemon, { mint: true, floorKey: () => "vessel-locked" })).rejects.toThrow(/^floor-unavailable: vessel-locked:.*lares vault unlock/);
    expect(daemon.heads()).toEqual(heads);
    expect(await readFloorAcceptHome(repo, () => daemon, () => "floor-unkeyed")).toEqual({ unavailable: "floor-unkeyed" });
    // The hand's act mints and names it; a second stand reads the same home.
    const home = await standFloorAcceptHome(repo, daemon, { mint: true, floorKey: () => "stands" });
    expect(home).not.toBeNull();
    expect(floorAcceptHomeUrlOf(daemon.doc())).toBe(home!.url);
    const again = await standFloorAcceptHome(repo, daemon, { mint: true, floorKey: () => "stands" });
    expect(again!.url).toBe(home!.url);
    await repo.shutdown();
  });

  test("RED: the device table files the home as the floor's (never a floor wiki), and the share verdict keeps it on the vessel", () => {
    const id = "4NMNnkMhL8jXrdJ9jamS58PAVdXu";
    const daemon = emptyLarDoc();
    daemon.tiddlers[FLOOR_ACCEPT_HOME_TITLE] = storedLarRecord(FLOOR_ACCEPT_HOME_TITLE, { text: `automerge:${id}` }, "floor-accept");
    const enrolled: Array<[string, string]> = [];
    const docs = deviceDaemonDocs({ enrollFloor: (documentId, bagId) => { enrolled.push([documentId, bagId]); } });
    expect(docs.readFloor(daemon)).toBe(true);
    expect(enrolled).toEqual([[id, FLOOR_ACCEPT_BAG]]);
    expect(docs.floorWiki(id)).toBe(false);
    expect(docs.release(id)).toBeNull();
    expect(floorOnlyDocIds(daemon).has(id)).toBe(true);
  });
});

describe("each recipe reads its own realm's Nexus", () => {
  const REALM_A = "a".repeat(64), REALM_B = "b".repeat(64), REALM_C = "c".repeat(64);
  const NEXUS_A = `nexus-${"1".repeat(64)}`, NEXUS_B = `nexus-${"2".repeat(64)}`, HOME = `nexus-${"3".repeat(64)}`;
  const ledger = (): LarDoc => {
    const doc = emptyLarDoc();
    noteWorkbench(doc, REALM_A, "under-a"); noteRealm(doc, REALM_A, NEXUS_A);
    noteWorkbench(doc, REALM_B, "under-b"); noteRealm(doc, REALM_B, NEXUS_B);
    noteWorkbench(doc, REALM_C, "seed-cabal"); noteRealm(doc, REALM_C);
    return doc;
  };

  test("RED: a wiki under A reads A, one under B reads B, a realm naming no Nexus reads the home charter, no charter reads none", () => {
    const doc = ledger();
    expect(recipeFloorNexusOf(doc, "under-a", HOME)).toEqual({ nexus: NEXUS_A });
    expect(recipeFloorNexusOf(doc, "under-b", HOME)).toEqual({ nexus: NEXUS_B });
    expect(recipeFloorNexusOf(doc, "seed-cabal", HOME)).toEqual({ nexus: HOME });
    expect(recipeFloorNexusOf(doc, "daemon", HOME)).toEqual({ nexus: HOME });
    expect(recipeFloorNexusOf(doc, "seed-cabal", null)).toEqual({ nexus: null });
    // The mount reads each Nexus's own accept.
    const accepts = emptyLarDoc();
    writeFloorAccept(accepts, { kind: FLOOR_ACCEPT_KIND, nexus: NEXUS_A, release: "4".repeat(64), manifest: "a".repeat(64), took: ["4".repeat(64)] });
    writeFloorAccept(accepts, { kind: FLOOR_ACCEPT_KIND, nexus: NEXUS_B, release: "5".repeat(64), manifest: "b".repeat(64), took: ["5".repeat(64)] });
    writeFloorAccept(accepts, { kind: FLOOR_ACCEPT_KIND, nexus: HOME, release: "6".repeat(64), manifest: "c".repeat(64), took: ["6".repeat(64)] });
    const cid = (slug: string) => floorToMount({ accepts, pick: recipeFloorNexusOf(doc, slug, HOME), genesis: "0".repeat(64) }).cid;
    expect([cid("under-a"), cid("under-b"), cid("seed-cabal")]).toEqual(["a".repeat(64), "b".repeat(64), "c".repeat(64)]);
  });

  test("RED: a realm carrying two Nexus pins reads conflicted, and its recipe mounts genesis", () => {
    const doc = ledger();
    const second = `${EDGE_LEDGER_PREFIX}${REALM_A}/nexus/${NEXUS_B}`;
    doc.tiddlers[second] = storedLarRecord(second, { text: NEXUS_B }, "edge-ledger");
    const pick = recipeFloorNexusOf(doc, "under-a", HOME);
    expect(pick).toEqual({ conflicted: [NEXUS_A, NEXUS_B] });
    expect(floorToMount({ accepts: emptyLarDoc(), pick, genesis: "0".repeat(64) })).toMatchObject({ cid: "0".repeat(64), standing: "genesis", note: expect.stringMatching(/^floor-realm-conflicted/) });
  });
});

describe("rehome: a door asks, the boot never moves a row", () => {
  const NEXUS = `nexus-${"7".repeat(64)}`;
  const OLD = `${CONTROL_HOME_ID}/floor-pin/${NEXUS}`;
  const oldRow = (text: string) => storedLarRecord(OLD, { text }, "floor-pin");
  const plain = JSON.stringify({ kind: "floor-pin", nexus: NEXUS, release: "1".repeat(64), manifest: "2".repeat(64) });

  test("RED: before the run the row waits (status names it) and the mount reads genesis; the run moves it once, with a receipt", async () => {
    const control = memoryHome(); control.doc().tiddlers[OLD] = oldRow(plain);
    const accepts = memoryHome();
    expect(unmovedFloorRows(control.doc())).toEqual([NEXUS]);
    expect(FLOOR_PIN_UNMOVED).toBe("floor-pin-unmoved");
    expect(floorToMount({ accepts: accepts.doc(), pick: { nexus: NEXUS }, genesis: "0".repeat(64) }).standing).toBe("genesis");
    const heads = ["9".repeat(64), "8".repeat(64)];
    const receipts = await rehomeFloorRows({ control, accepts, heads: async () => heads, whole: async () => null });
    expect(receipts).toEqual([{ nexus: NEXUS, act: "moved", manifest: "2".repeat(64), took: [...heads].sort(), detail: expect.any(String) }]);
    expect(floorAcceptOf(accepts.doc(), NEXUS, "0".repeat(64))).toMatchObject({ source: "accepted", accept: { release: "1".repeat(64), manifest: "2".repeat(64), took: [...heads].sort() } });
    expect(unmovedFloorRows(control.doc())).toEqual([]);
    // A second run finds no old row and lands nothing.
    const before = { c: control.changes, a: accepts.changes };
    expect(await rehomeFloorRows({ control, accepts, heads: async () => heads, whole: async () => null })).toEqual([]);
    expect({ c: control.changes, a: accepts.changes }).toEqual(before);
  });

  test("RED: a torn row stays and names itself; a floor whose bytes rest absent stays; an accept standing since holds", async () => {
    const torn = memoryHome(); torn.doc().tiddlers[OLD] = oldRow(JSON.stringify({ kind: "floor-pin", nexus: NEXUS, manifest: "2".repeat(64) }));
    const accepts = memoryHome();
    expect(await rehomeFloorRows({ control: torn, accepts, heads: async () => [], whole: async () => null })).toMatchObject([{ act: "torn" }]);
    expect(unmovedFloorRows(torn.doc())).toEqual([NEXUS]);
    expect(accepts.changes).toBe(0);
    const absent = memoryHome(); absent.doc().tiddlers[OLD] = oldRow(plain);
    expect(await rehomeFloorRows({ control: absent, accepts, heads: async () => [], whole: async () => "manifest bytes absent" })).toMatchObject([{ act: "bytes-absent" }]);
    expect(unmovedFloorRows(absent.doc())).toEqual([NEXUS]);
    expect(accepts.changes).toBe(0);
    const standing = memoryHome();
    writeFloorAccept(standing.doc(), { kind: FLOOR_ACCEPT_KIND, nexus: NEXUS, release: "3".repeat(64), manifest: "4".repeat(64), took: [] });
    const control = memoryHome(); control.doc().tiddlers[OLD] = oldRow(plain);
    expect(await rehomeFloorRows({ control, accepts: standing, heads: async () => [], whole: async () => null })).toMatchObject([{ act: "superseded" }]);
    expect(floorAcceptOf(standing.doc(), NEXUS, "0".repeat(64)).accept.release).toBe("3".repeat(64));
    expect(unmovedFloorRows(control.doc())).toEqual([]);
    expect(floorAcceptTitle(NEXUS).startsWith(FLOOR_ACCEPT_BAG)).toBe(true);
  });
});
