/**
 * browser-floor-pin — the browser vessel reads the same pin and reaches the same decision the node does
 * (w26-floor-lane#/the-vessel-pin).
 *
 * The porch is a fake `fetch` over real release records; the control home is a plain document. REDS:
 *   · PARITY: the browser's composition (porch rows, porch CAS, OPFS stage) and a node-shaped binding (board rows, a local
 *     CAS) over the same releases decide the same status and the same accept, through the mesh's one decision;
 *   · the browser's accept stages the floor before the pin moves and raises the reboot-pending alert (no live swap);
 *   · a fork refuses naming both heads; a replay lands nothing;
 *   · where the browser cannot run the door (no control document stood, no Nexus known), it refuses by name, saying why.
 */
import { describe, expect, test } from "vitest";
import {
  acceptFloorRelease, assembleFloorRelease, cutFloorSnapshot, emptyLarDoc, floorAnswerOf, floorManifestBytes, openFloorReleaseBody,
  readFloorStatus, sha256HexBytesSync, type FloorPinHome, type FloorPinPorts, type FloorRelease, type FloorRemount, type LarDoc,
} from "@lararium/mesh";
import { browserFloorAccept, browserFloorStatus, type BrowserFloorBinding } from "../src/browser-floor-pin.js";
import { oneSeatCharter, type OneSeat } from "./browser-charter.js";

const pinOf = (aid: string): string => Array.from(new TextEncoder().encode(aid), (b) => b.toString(16).padStart(2, "0")).join("");

function floor(tag: string) {
  const cas = new Map<string, Uint8Array>();
  const lares = cutFloorSnapshot({ [`lar:///t/${tag}/lares`]: { tiddler: { title: `lar:///t/${tag}/lares`, text: tag } } });
  const lararium = cutFloorSnapshot({ [`lar:///t/${tag}/lararium`]: { tiddler: { title: `lar:///t/${tag}/lararium`, text: tag } } });
  const manifestBytes = floorManifestBytes({ format: "lararium-floor", engine: "e".repeat(64), grammar: "a".repeat(64), plugins: "b".repeat(64), snapshots: { lares: lares.cid, lararium: lararium.cid } });
  const manifestCid = sha256HexBytesSync(manifestBytes);
  cas.set(lares.cid, lares.bytes); cas.set(lararium.cid, lararium.bytes); cas.set(manifestCid, manifestBytes);
  return { cas, manifestBytes, manifestCid };
}
async function released(c: OneSeat, f: ReturnType<typeof floor>, prior: string | null = null): Promise<FloorRelease> {
  const steward = await c.handOf(c.chain.length - 1);
  return assembleFloorRelease({
    body: openFloorReleaseBody({ nexus: c.aid, epoch: c.head.epochCid, prior, manifest: f.manifestCid }),
    lineage: c.chain, manifestBytes: f.manifestBytes, steward, approvers: [steward],
  });
}
function porch(aid: string, releases: readonly FloorRelease[], cas: Map<string, Uint8Array>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === `/floor/${aid}`) return new Response(JSON.stringify(floorAnswerOf(aid, releases.map((r) => ({ keyCid: r.cid, record: r })))), { status: 200 });
    const m = /^\/cas\/([0-9a-f]{64})$/.exec(url.pathname);
    const bytes = m ? cas.get(m[1]!) : undefined;
    return bytes ? new Response(new Uint8Array(bytes), { status: 200 }) : new Response("route unavailable", { status: 404 });
  }) as typeof fetch;
}
const homeOf = (): FloorPinHome & { changes: number } => {
  const doc: LarDoc = emptyLarDoc();
  return { changes: 0, doc: () => doc, change(fn) { this.changes += 1; fn(doc); } };
};
const GENESIS = "9".repeat(64);
const BASE = "https://hearth.example/ws";

function browserBinding(c: OneSeat, releases: readonly FloorRelease[], cas: Map<string, Uint8Array>, home: FloorPinHome | null) {
  const local = new Map<string, Uint8Array>();
  const alerts: FloorRemount[] = [];
  const binding: BrowserFloorBinding = {
    baseUrl: BASE, nexusPin: pinOf(c.aid), home: () => home, genesisManifest: GENESIS,
    fetchFn: porch(c.aid, releases, cas),
    readLocal: async (cid) => local.get(cid) ?? null,
    writeLocal: async (blobs) => { for (const b of blobs) local.set(b.cid, b.bytes); },
    raiseAlert: (r) => { alerts.push(r); return ["wiki-a"]; },
  };
  return { binding, local, alerts };
}
/** A node-shaped binding: board rows read straight, a local CAS, no porch. */
function nodeShaped(c: OneSeat, releases: readonly FloorRelease[], cas: Map<string, Uint8Array>, home: FloorPinHome): FloorPinPorts {
  return {
    home, nexus: c.aid, genesisManifest: GENESIS,
    rows: async () => releases.map((r) => ({ keyCid: r.cid, record: r })),
    fetchCas: async (cid) => cas.get(cid) ?? null,
    stage: async () => {},
    mount: { floorSwap: false, alert: () => {} },
  };
}

describe("the browser vessel's floor pin", () => {
  test("RED PARITY: the browser composition and a node-shaped binding decide the same status and the same accept", async () => {
    const c = await oneSeatCharter(3, 0);
    const f1 = floor("one"), f2 = floor("two");
    const r1 = await released(c, f1);
    const r2 = await released(c, f2, r1.cid);
    const cas = new Map([...f1.cas, ...f2.cas]);
    const bHome = homeOf(), nHome = homeOf();
    const { binding } = browserBinding(c, [r1, r2], cas, bHome);
    const bStatus = await browserFloorStatus(binding);
    const nStatus = await readFloorStatus(nodeShaped(c, [r1, r2], cas, nHome));
    expect(bStatus).toEqual({ ok: true, ...nStatus });
    const bAccept = await browserFloorAccept(binding);
    const nAccept = await acceptFloorRelease(nodeShaped(c, [r1, r2], cas, nHome));
    expect(bAccept).toMatchObject({ ok: true, moved: true, path: [r1.cid, r2.cid] });
    const { alerted: _alerted, ...bDecision } = bAccept as typeof bAccept & { alerted: unknown };
    expect(bDecision).toEqual(nAccept);
    expect(bHome.doc()).toEqual(nHome.doc());                       // the same pin row, byte for byte
  });

  test("RED: the browser's accept stages the floor before the pin moves and raises the reboot-pending alert", async () => {
    const c = await oneSeatCharter(4, 0);
    const f1 = floor("one");
    const r1 = await released(c, f1);
    const { binding, local, alerts } = browserBinding(c, [r1], f1.cas, homeOf());
    const out = await browserFloorAccept(binding);
    expect(out).toMatchObject({ ok: true, moved: true, remount: { act: "alert", kind: "reboot-pending" }, alerted: ["wiki-a"] });
    expect(new Set(local.keys())).toEqual(new Set(f1.cas.keys()));
    expect(alerts).toHaveLength(1);
    // A replay lands nothing.
    expect(await browserFloorAccept(binding)).toMatchObject({ ok: true, moved: false, remount: null });
    expect(alerts).toHaveLength(1);
  });

  test("RED: a fork refuses naming both heads", async () => {
    const c = await oneSeatCharter(5, 0);
    const f1 = floor("one"), fa = floor("a"), fb = floor("b");
    const r1 = await released(c, f1);
    const ra = await released(c, fa, r1.cid), rb = await released(c, fb, r1.cid);
    const home = homeOf();
    const { binding } = browserBinding(c, [r1, ra, rb], new Map([...f1.cas, ...fa.cas, ...fb.cas]), home);
    expect(await browserFloorAccept(binding)).toMatchObject({ ok: false, refusal: "floor-fork-unsettled", heads: [ra.cid, rb.cid].sort() });
    expect(home.changes).toBe(0);
  });

  test("where the browser cannot run the door, it refuses by name and says why", async () => {
    const c = await oneSeatCharter(6, 0);
    const f1 = floor("one");
    const r1 = await released(c, f1);
    const unstood = browserBinding(c, [r1], f1.cas, null).binding;
    expect(await browserFloorStatus(unstood)).toMatchObject({ ok: false, refusal: "floor-control-unread", detail: expect.stringMatching(/no control document/) });
    expect(await browserFloorAccept({ ...unstood, nexusPin: null })).toMatchObject({ ok: false, refusal: "floor-no-nexus" });
  });
});
