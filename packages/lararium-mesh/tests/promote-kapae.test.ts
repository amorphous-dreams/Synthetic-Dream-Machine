/**
 * promote-kapae — what a device does with the board's shadow: the cached set it honors offline, the island restart on arrival, the hand rule.
 * The per-device ledger rows stay byte-identical across a raise and a lower. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae
 */
import { describe, expect, test } from "vitest";
import { EMPTY_LEDGER, encodeLedger, ledgerCommit, promoteDigest, promotedPreloads, verifyPromotionRows } from "../src/promote.js";
import { EMPTY_KAPAE_LOCAL, KapaeRefused, assertKapaeHand, decodeKapaeLocal, encodeKapaeLocal, kapaeBootSet, kapaeNoteArrival } from "../src/promote-kapae.js";
import { promoteEdgeKey } from "../src/promote-board.js";

const W1 = "lar:///ha.ka.ba/wikis/field-notes", W2 = "lar:///ha.ka.ba/wikis/garden";
const HAND = { kind: "hand", id: "hand-1" } as const, SEAT = { kind: "seat", id: "seat-1" } as const;
const rite = { title: "rites/a", text: "exports.startup = function(){}", fields: { "module-type": "startup" } };
const D = promoteDigest(rite);
const E1 = promoteEdgeKey(W1, D), E2 = promoteEdgeKey(W2, D);

describe("a raise arrives", () => {
  test("RED: a newly shadowed edge this island loaded restarts it once and the cache holds the edge; CONTROL: an edge in another wiki, or one never loaded, restarts nothing", () => {
    const arrival = kapaeNoteArrival(EMPTY_KAPAE_LOCAL, new Set([E1]), new Set([E1, E2]));
    expect(arrival).toMatchObject({ restart: true, local: { shadowed: [E1] } });
    expect(kapaeNoteArrival(arrival.local, new Set([E1]), new Set([E1])).restart).toBe(false);
    expect(kapaeNoteArrival(EMPTY_KAPAE_LOCAL, new Set([E1]), new Set([E2])).restart).toBe(false);
    expect(kapaeNoteArrival(EMPTY_KAPAE_LOCAL, new Set([E1]), new Set()).restart).toBe(false);
  });

  test("RED: a raise and a lower leave every ledger row byte-identical; CONTROL: the cache bytes DO change and round-trip", () => {
    const ledger = ledgerCommit(EMPTY_LEDGER, { wiki: W1, digest: D, item: rite, revision: "a".repeat(64) }, HAND);
    const before = Buffer.from(encodeLedger(ledger));
    const raised = kapaeNoteArrival(EMPTY_KAPAE_LOCAL, new Set([E1]), new Set([E1]));
    const lowered = kapaeNoteArrival(raised.local, new Set(), new Set([E1]));
    expect(Buffer.from(encodeLedger(ledger)).equals(before)).toBe(true);
    expect(lowered.local.shadowed).toEqual([]);
    expect(Buffer.from(encodeKapaeLocal(raised.local)).equals(Buffer.from(encodeKapaeLocal(EMPTY_KAPAE_LOCAL)))).toBe(false);
    expect(decodeKapaeLocal(encodeKapaeLocal(raised.local))).toEqual(raised.local);
    expect(() => decodeKapaeLocal(new TextEncoder().encode("{\"shadowed\":[1]}"))).toThrowError(expect.objectContaining({ code: "kapae-local-malformed" }));
    const verified = verifyPromotionRows(ledger.rows).verified;
    expect(promotedPreloads(verified, W1, new Set([E1]))).toEqual([]);
    expect(promotedPreloads(verified, W1, new Set())).toHaveLength(1);
  });
});

describe("offline and the hand", () => {
  test("RED: an unreadable board honors the cached set; CONTROL: a readable board wins over the cache", () => {
    const cached = { shadowed: [E1] };
    expect([...kapaeBootSet(cached, null)]).toEqual([E1]);
    expect([...kapaeBootSet(cached, new Set())]).toEqual([]);
    expect([...kapaeBootSet(cached, new Set([E2]))]).toEqual([E2]);
  });

  test("RED: a seat's raise and lower refuse `kapae-needs-hand`; CONTROL: a hand's pass", () => {
    expect(() => assertKapaeHand("raise", SEAT)).toThrowError(expect.objectContaining({ code: "kapae-needs-hand" }));
    expect(() => assertKapaeHand("lower", SEAT)).toThrowError(expect.objectContaining({ code: "kapae-needs-hand" }));
    expect(() => assertKapaeHand("raise", HAND)).not.toThrow();
    expect(() => assertKapaeHand("lower", HAND)).not.toThrow();
    expect(KapaeRefused.name).toBe("KapaeRefused");
  });
});
