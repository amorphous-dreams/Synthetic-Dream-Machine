/**
 * browser-crossing.test.ts — the leaf↔node crossing, end to end at the wire, over the sealed gate.
 *
 * The two halves each had a test; the WIRING BETWEEN them did not. This composes the real pieces:
 *
 *   a node's sovereign gate (`faceGateServer` over a sealed session table, read by the Repo's adapter)
 *     ←ws←  a real LarWSClientAdapter (a leaf's shape: a Repo with no server, only the dial)
 *
 * It proves the crossing: a leaf presenting an ADMIT the gate sorts crosses (the gate seats a session and the
 * Automerge layer sees its peer — the breath); a leaf presenting NOTHING under PRIVATE (the freshly-FOUNDED anon
 * vessel) meets silence and never becomes a peer; a leaf whose session signer is not the one its chain certified
 * meets silence; a leaf that pinned ANOTHER gate's key never reaches this gate at all. The sort is modelled by the
 * world's held admits, the faithful stand-in for the keyholder worker's reading; the crypto is REAL.
 *
 * The gate's own wire laws (the pinned verdict key, the flight, the deadline) live in the mesh and the gate-server
 * suites; the session-message channel is proven in lar-ws-client-adapter-gate.test and gate-sync-server.test.
 *
 * Gate: lar:///ha.ka.ba/lararium/node/browser-crossing
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PeerId } from "@automerge/automerge-repo";
import { presenter } from "../../lararium-mesh/tests/face-gate-fixture.js";
import { restEvery } from "./resting-repo.js";
import { standGatedNode, type GatedNode } from "./gated-node-rig.js";

const GREETING = "lar:///ha.ka.ba/bags/crossroads/greeting";
const REPLY    = "lar:///ha.ka.ba/bags/personal/reply";
type Doc = { tiddlers: Record<string, { text: string }> };

const dirs: string[] = [];
let nodes: GatedNode[] = [];
const mkDir = (): string => { const d = mkdtempSync(join(tmpdir(), "lar-crossing-")); dirs.push(d); return d; };
afterEach(async () => {
  for (const n of nodes) { try { await n.close(); } catch { /* already down */ } }
  nodes = [];
  await restEvery();
  for (const d of dirs.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch { /* gone */ } }
});

const stand = async (opts: Parameters<typeof standGatedNode>[0]): Promise<GatedNode> => { const n = await standGatedNode(opts); nodes.push(n); return n; };

/** Wait until `until()` holds, or fail naming `label` after `ms`. */
async function waitFor(until: () => boolean, label: string, ms = 5_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!until()) {
    if (Date.now() > deadline) throw new Error(`timeout: ${label}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** Does `leaf` hold a doc `url` carrying `key`, within `ms`? */
async function leafReads(leaf: GatedNode, url: string, key: string, ms = 1_500): Promise<boolean> {
  const found = await Promise.race([
    leaf.repo.find<Doc>(url as never).then((h) => h, () => null),
    new Promise<null>((r) => setTimeout(() => r(null), ms)),
  ]);
  if (!found) return false;
  try { await waitFor(() => Boolean(found.doc()?.tiddlers?.[key]), "key", ms); return true; } catch { return false; }
}

describe("leaf↔node crossing — real gate · real Noise IK · real admit · real adapter", () => {
  test("an ADMITTED leaf crosses the gate and becomes a sync peer (the breath), and the gate proves itself back", async () => {
    const node = await stand({ storageDir: mkDir() });
    const leaf = await stand({ storageDir: mkDir(), nexus: "nexus-a.synthetic", dialOut: { node, label: "leaf" } });
    await waitFor(() => node.seated() === 1, "the gate to seat the admitted leaf");
    expect(leaf.client?.anergized).toBeNull();
    const doc = node.repo.create<Doc>({ tiddlers: {} });
    doc.change((d) => { d.tiddlers[GREETING] = { text: "the DreamNet breathes" }; });
    expect(await leafReads(leaf, doc.url, GREETING, 5_000)).toBe(true);
    // THE GATE PROVED ITSELF BACK: the node's peer, met on the socket whose verdict the pinned gate key signed, reads
    // as that key. A peer this transport never met reads null.
    expect(leaf.client!.provenKeyOf(node.repo.peerId)).toBe(node.world.pin.signingKey.toLowerCase());
    expect(leaf.client!.provenKeyOf("a-stranger" as PeerId)).toBeNull();
  }, 12_000);

  test("a FOUNDED anon leaf (no admit) is silence under PRIVATE — never a peer, never a doc", async () => {
    const node = await stand({ storageDir: mkDir() });
    const doc = node.repo.create<Doc>({ tiddlers: {} });
    doc.change((d) => { d.tiddlers[GREETING] = { text: "not for the anon" }; });
    const leaf = await stand({ storageDir: mkDir(), nexus: "nexus-a.synthetic", dialOut: { node, arm: null, label: "anon" } });
    expect(await leafReads(leaf, doc.url, GREETING)).toBe(false);
    expect(node.seated()).toBe(0);
  }, 12_000);

  test("a leaf whose session signer is NOT the one its chain certified is silence (real Ed25519)", async () => {
    const node = await stand({ storageDir: mkDir() });
    const p = await presenter(node.world, "claims the chain");
    const other = await presenter(node.world, "holds another signer");
    const leaf = await stand({ storageDir: mkDir(), nexus: "nexus-a.synthetic", dialOut: { node, presenter: { ...p, signer: other.signer } } });
    await new Promise((r) => setTimeout(r, 1_500));
    expect(node.seated()).toBe(0);
    expect(leaf.repo.peers).toEqual([]);
  }, 12_000);

  test("RED: a leaf that pinned ANOTHER gate's key never reaches this gate; CONTROL: the right pin crosses", async () => {
    const node = await stand({ storageDir: mkDir() });
    const impostorPin = (await stand({ storageDir: mkDir(), nexus: "nexus-b.synthetic" })).world.pin;
    const wrong = await stand({ storageDir: mkDir(), nexus: "nexus-a.synthetic", dialOut: { node, pin: impostorPin } });
    await new Promise((r) => setTimeout(r, 1_500));
    expect(node.seated()).toBe(0);
    expect(wrong.repo.peers).toEqual([]);
    const right = await stand({ storageDir: mkDir(), nexus: "nexus-a.synthetic", dialOut: { node } });
    await waitFor(() => node.seated() >= 1, "the right pin to cross");
    expect(right.client?.anergized).toBeNull();
  }, 12_000);

  test("the breath runs both ways — a leaf change propagates back to the node", async () => {
    const node = await stand({ storageDir: mkDir() });
    const nodeDoc = node.repo.create<Doc>({ tiddlers: {} });
    const leaf = await stand({ storageDir: mkDir(), nexus: "nexus-a.synthetic", dialOut: { node, label: "leaf" } });
    await waitFor(() => node.seated() === 1, "the leaf to cross");
    const found = await leaf.repo.find<Doc>(nodeDoc.url);
    await found.whenReady();
    found.change((d) => { d.tiddlers[REPLY] = { text: "a citizen answers" }; });
    await waitFor(() => Boolean(nodeDoc.doc()?.tiddlers?.[REPLY]), "the node to see the leaf's change");
    expect(nodeDoc.doc()?.tiddlers?.[REPLY]?.text).toBe("a citizen answers");
  }, 12_000);
});
