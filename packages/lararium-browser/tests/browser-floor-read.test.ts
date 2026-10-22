/**
 * browser-floor-read — the browser reads the Nexus's floor off its hearth's porch and verifies every step itself.
 *
 * The porch is a fake `fetch` over real release records (a rolled charter, a chain of two releases). The reader holds the
 * Nexus AID alone (pin-spelled, as the floor card carries it). REDS, each refusing before the floor is used: a card whose
 * AID the genesis bytes differ from, a forged and a skipped epoch step, a release sealed by a key outside its epoch's
 * roster, and floor bytes that differ from the CID. CONTROL: a full valid porch reads and boots; the read records no
 * acceptance (it returns the floor and touches nothing else).
 */
import { describe, expect, test } from "vitest";
import { sha256HexBytesSync, cutFloorSnapshot, floorManifestBytes, assembleFloorRelease, openFloorReleaseBody, floorAnswerOf, floorReleaseBodyBytes, type FloorRelease, type SealEpoch } from "@lararium/mesh";
import { floorNexusOf, porchOriginOf, readHearthFloor } from "../src/browser-floor-read.js";
import { oneSeatCharter, uncommittedStep, type OneSeat } from "./browser-charter.js";

const pinOf = (aid: string): string => Array.from(new TextEncoder().encode(aid), (b) => b.toString(16).padStart(2, "0")).join("");

function floor(tag: string) {
  const cas = new Map<string, Uint8Array>();
  const lares = cutFloorSnapshot({ [`lar:///t/${tag}/lares`]: { tiddler: { title: `lar:///t/${tag}/lares`, text: tag } } });
  const lararium = cutFloorSnapshot({ [`lar:///t/${tag}/lararium`]: { tiddler: { title: `lar:///t/${tag}/lararium`, text: tag } } });
  const manifestBytes = floorManifestBytes({ format: "lararium-floor/v1", engine: "e".repeat(64), grammar: "a".repeat(64), plugins: "b".repeat(64), lares: lares.cid, lararium: lararium.cid });
  const manifestCid = sha256HexBytesSync(manifestBytes);
  cas.set(lares.cid, lares.bytes); cas.set(lararium.cid, lararium.bytes); cas.set(manifestCid, manifestBytes);
  return { cas, manifestBytes, manifestCid, lares, lararium };
}
async function released(c: OneSeat, f: ReturnType<typeof floor>, prior: string | null = null): Promise<FloorRelease> {
  const steward = await c.handOf(c.chain.length - 1);
  return assembleFloorRelease({
    body: openFloorReleaseBody({ nexus: c.aid, epoch: c.head.epochCid, prior, manifest: f.manifestCid }),
    lineage: c.chain, manifestBytes: f.manifestBytes, steward, approvers: [steward],
  });
}
/** A fake porch: `/floor/<aid>` answers JSON, `/cas/<cid>` answers bytes; every other path 404s. */
function porch(aid: string, releases: readonly FloorRelease[], cas: Map<string, Uint8Array>, tamper: Record<string, true> = {}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === `/floor/${aid}`) return new Response(JSON.stringify(floorAnswerOf(aid, releases.map((r) => ({ keyCid: r.cid, record: r })))), { status: 200 });
    const m = /^\/cas\/([0-9a-f]{64})$/.exec(url.pathname);
    const bytes = m ? cas.get(m[1]!) : undefined;
    if (!bytes) return new Response("route unavailable", { status: 404 });
    return new Response(m && tamper[m[1]!] ? new Uint8Array([...bytes, 0]) : bytes, { status: 200 });
  }) as typeof fetch;
}

describe("the pieces", () => {
  test("a pin-spelled Nexus reads as its AID alone; a url reads as its http(s) origin", async () => {
    const c = await oneSeatCharter(1, 0);
    expect(floorNexusOf(pinOf(c.aid))).toBe(c.aid);
    expect(floorNexusOf(pinOf("not-an-aid"))).toBeNull();
    expect(floorNexusOf(null)).toBeNull();
    expect(porchOriginOf("ws://hearth.example:8787/ws")).toBe("http://hearth.example:8787");
    expect(porchOriginOf("wss://hearth.example/ws")).toBe("https://hearth.example");
    expect(porchOriginOf("ftp://x")).toBeNull();
  });
});

describe("the browser reads the floor and verifies every step", () => {
  test("CONTROL: a rolled charter and a chain of two releases read the head's floor whole, with no acceptance recorded", async () => {
    const c0 = await oneSeatCharter(2, 0);
    const c1 = await oneSeatCharter(2, 1);
    const f1 = floor("one"), f2 = floor("two");
    const cas = new Map([...f1.cas, ...f2.cas]);
    const first = await released(c0, f1);
    const second = await released(c1, f2, first.cid);
    const read = await readHearthFloor({ baseUrl: "ws://hearth.example:8787/ws", nexusPin: pinOf(c0.aid), fetchFn: porch(c0.aid, [first, second], cas) });
    expect(read.ok).toBe(true);
    if (read.ok) { expect(read.head.cid).toBe(second.cid); expect(Object.keys(read.lares)).toEqual(["lar:///t/two/lares"]); }
  });

  test("no Nexus known, and a silent porch, each refuse by name", async () => {
    const c = await oneSeatCharter(1, 0);
    expect(await readHearthFloor({ baseUrl: "http://h", nexusPin: null })).toMatchObject({ ok: false, reason: "no-nexus" });
    expect(await readHearthFloor({ baseUrl: "http://h", nexusPin: pinOf(c.aid), fetchFn: (async () => new Response("route unavailable", { status: 404 })) as typeof fetch })).toMatchObject({ ok: false, reason: "porch-silent" });
    expect(await readHearthFloor({ baseUrl: "http://h", nexusPin: pinOf(c.aid), fetchFn: (async () => { throw new Error("offline"); }) as typeof fetch })).toMatchObject({ ok: false, reason: "porch-silent", detail: "offline" });
  });

  test("RED: a lineage whose genesis bytes differ from the AID the card holds refuses before any blob is fetched", async () => {
    const c = await oneSeatCharter(3, 0);
    const f = floor("g");
    const good = await released(c, f);
    const edited = { ...good, lineage: [{ ...c.chain[0]!, keySetHash: "0".repeat(64) }] };
    const asked: string[] = [];
    const base = porch(c.aid, [edited], f.cas);
    const read = await readHearthFloor({ baseUrl: "http://h", nexusPin: pinOf(c.aid), fetchFn: (async (i: RequestInfo | URL, init?: RequestInit) => { asked.push(new URL(String(i)).pathname); return base(i, init); }) as typeof fetch });
    expect(read).toMatchObject({ ok: false, reason: "lineage-genesis-differs" });
    expect(asked.some((p) => p.startsWith("/cas/") && p.endsWith(f.lares.cid))).toBe(false);
  });

  test("RED: a forged epoch step and a skipped epoch step refuse", async () => {
    const c0 = await oneSeatCharter(4, 0);
    const c2 = await oneSeatCharter(4, 2);
    const f = floor("steps");
    const forgedEpoch = await uncommittedStep(c0, 9);
    // Hand-built records whose every other part stands lawful: the body names the epoch, the CID re-derives, the steward seals
    // as the seat of THAT epoch, and the approval stands. Only the lineage lies.
    const handBuilt = async (lineage: readonly SealEpoch[], epoch: string, author: OneSeat, generation: number) => {
      const body = openFloorReleaseBody({ nexus: c0.aid, epoch, prior: null, manifest: f.manifestCid });
      const base = await released(author, f);
      const hand = await author.handOf(generation);
      return { ...base, body, cid: sha256HexBytesSync(floorReleaseBodyBytes(body)), lineage, seal: { signer: hand.signer, sig: await hand.sign(floorReleaseBodyBytes(body)) } } as FloorRelease;
    };
    const forged = await handBuilt([c0.chain[0]!, forgedEpoch], forgedEpoch.epochCid, await oneSeatCharter(9, 0), 0);
    const skipped = await handBuilt([c2.chain[0]!, c2.chain[2]!], c2.head.epochCid, c2, 2);
    for (const record of [forged, skipped]) {
      expect(await readHearthFloor({ baseUrl: "http://h", nexusPin: pinOf(c0.aid), fetchFn: porch(c0.aid, [record], f.cas) })).toMatchObject({ ok: false, reason: "lineage-refused" });
    }
  });

  test("RED: a release sealed by a key outside its epoch's roster refuses", async () => {
    const c0 = await oneSeatCharter(5, 0);
    const c1 = await oneSeatCharter(5, 1);
    const f = floor("outside");
    const good = await released(c1, f);
    const oldHand = await c0.handOf(0);
    const sealedByOld = { ...good, seal: { signer: oldHand.signer, sig: await oldHand.sign(floorReleaseBodyBytes(good.body)) } };
    expect(await readHearthFloor({ baseUrl: "http://h", nexusPin: pinOf(c1.aid), fetchFn: porch(c1.aid, [sealedByOld], f.cas) })).toMatchObject({ ok: false, reason: "steward-not-seated" });
  });

  test("RED: floor bytes that differ from the CID refuse (the manifest, and each snapshot)", async () => {
    const c = await oneSeatCharter(6, 0);
    const f = floor("bytes");
    const rel = await released(c, f);
    const read = (tamper: Record<string, true>) => readHearthFloor({ baseUrl: "http://h", nexusPin: pinOf(c.aid), fetchFn: porch(c.aid, [rel], f.cas, tamper) });
    expect(await read({ [f.manifestCid]: true })).toMatchObject({ ok: false, reason: "manifest-bytes-differ" });
    expect(await read({ [f.lares.cid]: true })).toMatchObject({ ok: false, reason: "floor-snapshot-cid-mismatch" });
    expect(await read({ [f.lararium.cid]: true })).toMatchObject({ ok: false, reason: "floor-snapshot-cid-mismatch" });
    expect((await read({})).ok).toBe(true);                                                                            // CONTROL
  });
});
