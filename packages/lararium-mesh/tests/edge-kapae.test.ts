import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { signEdgeKapae, edgeKapaeActCid, edgeKapaeBytes, foldEdgeKapaeVerdicts, foldEdgeKapae, verifiedShadowSet, shadowSetFromBoard, edgeKapaeKey, writeEdgeKapae, edgeKapaeActsFromBoard, emptyLarDoc, mutableLarRecord } from "../src/index.js";
import { hex, hexToBytes } from "../src/crypto.js";
const A = new Uint8Array(32).fill(11), B = new Uint8Array(32).fill(12), EPOCH = "charter-a";
const sign = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const act = (edgeId: string, raised: boolean, parents: string[] = [], seed = A, epochCid = EPOCH) => signEdgeKapae({ edgeId, raised, parents, epochCid }, sign(seed));
describe("edge Kapae causal frontier", () => {
  test("valid causal descendant withdraws", async () => { const a = await act("edge", true); const b = await act("edge", false, [a.actCid]); expect(foldEdgeKapaeVerdicts([a,b]).get("edge")).toBe("withdrawn"); expect(foldEdgeKapae([a,b]).has("edge")).toBe(false); });
  test("concurrent opposing heads are unsettled in either order", async () => { const a = await act("edge", true, [], A), b = await act("edge", false, [], B); expect(foldEdgeKapaeVerdicts([a,b]).get("edge")).toBe("unsettled"); expect(foldEdgeKapaeVerdicts([b,a]).get("edge")).toBe("unsettled"); expect(foldEdgeKapae([a,b])).toEqual(new Set()); });
  test("parent order and duplicates do not change semantic bytes or CID", async () => { const a = await act("edge", true, ["p", "q"]); const b = await act("edge", true, ["q", "p", "p"]); expect(Buffer.from(edgeKapaeBytes(a)).toString("hex")).toBe(Buffer.from(edgeKapaeBytes(b)).toString("hex")); expect(a.actCid).toBe(b.actCid); });
  test("missing parent is unavailable", async () => { const a = await act("edge", true, ["sha256:missing"]); expect(foldEdgeKapaeVerdicts([a]).get("edge")).toBe("unavailable"); });
  test("semantic tamper is rejected and CID is derived", async () => { const a = await act("edge", true); const tampered = { ...a, raised: false }; expect(foldEdgeKapaeVerdicts([tampered]).get("edge")).toBe("rejected"); expect(a.actCid).toBe(edgeKapaeActCid({ kind: a.kind, edgeId: a.edgeId, raised: a.raised, parents: a.parents, epochCid: a.epochCid })); });
  test("direct verifier controls: forged lower, unknown authority, torn and foreign boards fail closed", async () => {
    const raised = await act("edge", true, [], A);
    const forgedLower = await act("edge", false, [raised.actCid], B);
    const verify = async (bytes: Uint8Array, sig: string, did: string) => ed.verifyAsync(hexToBytes(sig), bytes, hexToBytes(did)).catch(() => false);
    const authority = await ed.getPublicKeyAsync(A).then(hex);
    expect(await verifiedShadowSet([raised, forgedLower], () => authority, verify)).toEqual(new Set(["edge"]));
    expect(await verifiedShadowSet([raised], () => undefined, verify)).toEqual(new Set());
    const doc = emptyLarDoc();
    writeEdgeKapae(doc, raised);
    doc.tiddlers["torn"] = mutableLarRecord("torn", { text: "not-json" }, "test");
    doc.tiddlers["foreign"] = mutableLarRecord("foreign", { text: JSON.stringify({ kind: "foreign/act", edgeId: "edge", raised: true, parents: [], actCid: "sha256:x", epochCid: EPOCH, sig: "00" }) }, "test");
    expect(await shadowSetFromBoard(doc, () => authority, verify)).toEqual(new Set(["edge"]));
  });
  test("parent cannot cross relation or charter boundary", async () => { const a = await act("a", true), b = await act("b", false, [a.actCid]), c = await act("a", false, [a.actCid], A, "charter-b"); expect(foldEdgeKapaeVerdicts([a,b]).get("b")).toBe("unavailable"); expect(foldEdgeKapaeVerdicts([a,c]).get("a")).toBe("unavailable"); });
  test("CID-keyed board preserves concurrent acts", async () => { const a = await act("edge", true, [], A), b = await act("edge", false, [], B), doc = emptyLarDoc(); writeEdgeKapae(doc,a); writeEdgeKapae(doc,b); expect(Object.keys(doc.tiddlers)).toHaveLength(2); expect(edgeKapaeKey("edge",true,a.actCid)).not.toBe(edgeKapaeKey("edge",false,b.actCid)); expect(edgeKapaeActsFromBoard(doc).map(x=>x.actCid).sort()).toEqual([a.actCid,b.actCid].sort()); });
});
