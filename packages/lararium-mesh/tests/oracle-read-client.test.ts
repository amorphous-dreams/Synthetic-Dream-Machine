import { describe, test, expect } from "vitest";
import * as A from "@automerge/automerge";
import { exportOracleSnapshot, buildOraclePointer, type OraclePointer, type OracleSnapshot } from "../src/oracle-substrate.js";
import { pullAndVerifyOracle } from "../src/oracle-read-client.js";

const SEED  = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const OTHER = Uint8Array.from({ length: 32 }, (_, i) => 200 - i);

async function serve(seed = SEED, parents: readonly string[] = [], text = "the constitution"):
  Promise<{ snap: OracleSnapshot; ptr: OraclePointer }> {
  const snap = await exportOracleSnapshot(A.from({ tiddlers: { oracle: { text } } }));
  const ptr = await buildOraclePointer({ snapshot: snap, parents, signerSeed: seed });
  return { snap, ptr };
}

function mkFetch(ptr: OraclePointer, snap: OracleSnapshot, corruptBytes = false): typeof fetch {
  return (async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.endsWith("/oracle/pointer")) return new Response(JSON.stringify(ptr), { status: 200 });
    if (url.endsWith(`/oracle/${snap.cid}.bin`)) {
      const bytes = corruptBytes ? new Uint8Array([...snap.bytes].map((b, i) => i === 0 ? b ^ 0xff : b)) : snap.bytes;
      return new Response(bytes, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

describe("oracle-read-client", () => {
  test("healthy peer verifies and loads", async () => {
    const { snap, ptr } = await serve();
    const res = await pullAndVerifyOracle<{ tiddlers: Record<string, { text: string }> }>("http://peer", { fetchImpl: mkFetch(ptr, snap) });
    expect(res.ok).toBe(true);
    expect(res.cid).toBe(snap.cid);
    expect(res.doc!.tiddlers.oracle.text).toBe("the constitution");
  });

  test("missing causal parent is unavailable", async () => {
    const { snap, ptr } = await serve(SEED, ["f".repeat(64)]);
    const res = await pullAndVerifyOracle("http://peer", { knownPointerIds: [], fetchImpl: mkFetch(ptr, snap) });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/unavailable/);
  });

  test("publisher pin rejects a foreign pointer", async () => {
    const foreign = await serve(OTHER);
    const honest = await serve(SEED);
    const res = await pullAndVerifyOracle("http://peer", { verifyingKey: honest.ptr.pub, fetchImpl: mkFetch(foreign.ptr, foreign.snap) });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/unpinned/);
  });

  test("corrupted snapshot bytes fail the content address", async () => {
    const { snap, ptr } = await serve();
    const res = await pullAndVerifyOracle("http://peer", { fetchImpl: mkFetch(ptr, snap, true) });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/hash mismatch/);
  });

  test("a signed pointer with a mismatched Automerge frontier is refused", async () => {
    const honest = await serve();
    const forged = await buildOraclePointer({
      snapshot: { ...honest.snap, heads: ["f".repeat(64)] },
      parents: [], signerSeed: SEED,
    });
    const res = await pullAndVerifyOracle("http://peer", {
      fetchImpl: mkFetch(forged, honest.snap),
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/heads mismatch/);
  });

  test("dead peer fails closed", async () => {
    const deadFetch = (async () => new Response("err", { status: 503 })) as typeof fetch;
    const res = await pullAndVerifyOracle("http://peer", { fetchImpl: deadFetch });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/HTTP 503/);
  });
});
