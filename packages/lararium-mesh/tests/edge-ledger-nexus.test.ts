/**
 * edge-ledger-nexus — the ledger keeps the Nexus a realm stands under (kapae#/edge-hands, house reading).
 *
 * E1 an act's note names the Nexus; a read's note names none / the realm reads noted either way.
 * E2 THE FIRST WORD STANDS: a later note naming another Nexus moves nothing.
 * E3 a name that reads as no Nexus AID refuses and writes no row / a stored row of that shape reads as none.
 * E4 TWO REPLICAS THAT PINNED TWO NEXUSES keep both pins, and the realm reads under none until a person settles it.
 */
import { describe, expect, it } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, ledgerRealmNexus, ledgerRealmNexuses, ledgerRealms, noteRealm, EDGE_LEDGER_PREFIX, type LarDoc } from "../src/index.js";

const REALM = "a1".repeat(32);
const N1 = `nexus-${"1".repeat(64)}`, N2 = `nexus-${"2".repeat(64)}`;
const fresh = (): LarDoc => emptyLarDoc() as LarDoc;

describe("the ledger names the Nexus a realm stands under", () => {
  it("E1 an act names the Nexus; a read names none", () => {
    const read = fresh();
    noteRealm(read, REALM);
    expect(ledgerRealms(read)).toEqual([REALM]);
    expect(ledgerRealmNexus(read, REALM)).toBeNull();
    noteRealm(read, REALM.toUpperCase(), N1.toUpperCase());
    expect(ledgerRealmNexus(read, REALM)).toBe(N1);
  });

  it("E2 the first word stands", () => {
    const d = fresh();
    noteRealm(d, REALM, N1);
    noteRealm(d, REALM, N2);
    expect(ledgerRealmNexus(d, REALM)).toBe(N1);
    expect(ledgerRealms(d)).toEqual([REALM]);
  });

  it("E3 a non-AID refuses and writes nothing / a stored junk row reads as none", () => {
    const d = fresh();
    expect(() => noteRealm(d, REALM, "epoch-" + "3".repeat(64))).toThrow(/Nexus AID/);
    expect(ledgerRealmNexus(d, REALM)).toBeNull();
    const junk = fresh();
    junk.tiddlers[`${EDGE_LEDGER_PREFIX}${REALM}/nexus/not-an-aid`] = { tiddler: { text: "not-an-aid" } } as never;
    junk.tiddlers[`${EDGE_LEDGER_PREFIX}${REALM}/nexus/${N1}`] = { tiddler: { text: N2 } } as never;
    expect(ledgerRealmNexus(junk, REALM)).toBeNull();
  });

  it("E4 two replicas that each pinned a different Nexus keep both pins, and the realm reads under none", async () => {
    const repo = new Repo({});
    const a = repo.create<LarDoc>(fresh());
    const b = repo.clone(a);
    a.change((d) => noteRealm(d, REALM, N1));
    b.change((d) => noteRealm(d, REALM, N2));
    a.merge(b);
    expect(ledgerRealmNexuses(a.doc(), REALM)).toEqual([N1, N2]);
    expect(ledgerRealmNexus(a.doc(), REALM)).toBeNull();
    // A later act adds no third pin.
    a.change((d) => noteRealm(d, REALM, N1));
    expect(ledgerRealmNexuses(a.doc(), REALM)).toEqual([N1, N2]);
  });
});
