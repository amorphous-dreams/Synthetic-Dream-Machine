/**
 * edge-holder-epoch — a holder act names no epoch; a quorum act names the epoch its roster reads at.
 *
 * The holder hand signs with the one key the edge's own id names and holds no roster, so an epoch on its act
 * selects nothing and no reader could check it. The act's bytes therefore carry none, and an act whose epoch
 * misfits its hand reads as no act: at the board's shape read, at the count, and at the mint.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/rolls
 */
import { describe, expect, it } from "vitest";
import * as ed from "@noble/ed25519";
import {
  countEdgeActs, edgeKapaeActCid, edgeKapaeActsFromBoard, edgeKapaeBytes, edgeKapaeKey, emptyLarDoc, hex,
  signEdgeKapae, writeEdgeKapae, EDGE_KAPAE_DOMAIN, type EdgeKapae,
} from "../src/index.js";
import { mutableLarRecord } from "../src/base-doc.js";

const EDGE = "e1".repeat(32);
const SEED = new Uint8Array(32).fill(7);
const signerOf = async (seed: Uint8Array) => ({ signer: hex(await ed.getPublicKeyAsync(seed)), sign: async (b: Uint8Array) => hex(await ed.signAsync(b, seed)) });
const decode = (bytes: Uint8Array): Record<string, unknown> => JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;

/** Sign a holder act by hand, epoch and all, the way a writer that ignores the law would. */
async function forgedHolderWithEpoch(epochCid: string): Promise<EdgeKapae> {
  const s = await signerOf(SEED);
  const body = { kind: EDGE_KAPAE_DOMAIN, edgeId: EDGE, raised: true, hand: "holder" as const, parents: [] as string[], epochCid };
  const bytes = edgeKapaeBytes(body);
  return { ...body, actCid: edgeKapaeActCid(body), signatures: [{ signer: s.signer, sig: await s.sign(bytes) }] };
}

describe("a holder act names no epoch", () => {
  it("H1 a holder act's signed bytes carry no epoch, and its id derives from those bytes", async () => {
    const act = await signEdgeKapae({ edgeId: EDGE, raised: true, hand: "holder", parents: [] }, [await signerOf(SEED)]);
    expect("epochCid" in act).toBe(false);
    const { signatures: _s, actCid, ...body } = act;
    expect(Object.keys(decode(edgeKapaeBytes(body))).sort()).toEqual(["edgeId", "hand", "kind", "parents", "raised"]);
    expect(actCid).toBe(edgeKapaeActCid(body));
  });

  it("H2 the mint refuses a holder act that names an epoch, and a quorum act that names none", async () => {
    const s = await signerOf(SEED);
    await expect(signEdgeKapae({ edgeId: EDGE, raised: true, hand: "holder", parents: [], epochCid: "e".repeat(64) }, [s])).rejects.toThrow(/holder act names no epoch/);
    await expect(signEdgeKapae({ edgeId: EDGE, raised: true, hand: "quorum", parents: [] }, [s])).rejects.toThrow(/quorum act names the seal epoch/);
  });

  it("H3 the board's shape read drops a holder act that carries an epoch, and keeps one that carries none", async () => {
    const s = await signerOf(SEED);
    const good = await signEdgeKapae({ edgeId: EDGE, raised: true, hand: "holder", parents: [] }, [s]);
    const bad = await forgedHolderWithEpoch("f".repeat(64));
    const d = emptyLarDoc();
    writeEdgeKapae(d, good);
    // The forged record lands under its own key by hand: the writer the law refuses still reaches a board.
    d.tiddlers[edgeKapaeKey(bad)] = mutableLarRecord(edgeKapaeKey(bad), { text: JSON.stringify(bad) }, "holder");
    const read = edgeKapaeActsFromBoard(d);
    expect(read.map((a) => a.actCid)).toEqual([good.actCid]);
  });

  it("H4 the count drops a holder act that carries an epoch, under the very key the edge names", async () => {
    const s = await signerOf(SEED);
    const bad = await forgedHolderWithEpoch("f".repeat(64));
    const good = await signEdgeKapae({ edgeId: EDGE, raised: true, hand: "holder", parents: [] }, [s]);
    const counted = await countEdgeActs([bad, good], [], () => ({ holder: s.signer }));
    expect(counted.acts.map((a) => a.actCid)).toEqual([good.actCid]);
  });

  it("H5 a quorum act that names no epoch reads as no act at the shape read", async () => {
    const s = await signerOf(SEED);
    const body = { kind: EDGE_KAPAE_DOMAIN, edgeId: EDGE, raised: true, hand: "quorum" as const, parents: [] as string[] };
    const act = { ...body, actCid: edgeKapaeActCid(body), signatures: [{ signer: s.signer, sig: await s.sign(edgeKapaeBytes(body)) }] };
    const d = emptyLarDoc();
    d.tiddlers[edgeKapaeKey(act)] = mutableLarRecord(edgeKapaeKey(act), { text: JSON.stringify(act) }, "quorum");
    expect(edgeKapaeActsFromBoard(d)).toEqual([]);
  });

  it("H6 CONTROL: a quorum act still names its epoch in its bytes", async () => {
    const s = await signerOf(SEED);
    const act = await signEdgeKapae({ edgeId: EDGE, raised: true, hand: "quorum", parents: [], epochCid: "c".repeat(64) }, [s]);
    const { signatures: _s, actCid: _c, ...body } = act;
    expect(decode(edgeKapaeBytes(body))["epochCid"]).toBe("c".repeat(64));
  });
});
