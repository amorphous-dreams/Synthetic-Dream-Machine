/**
 * share-policy-is-access — COLLIDE THE INSTRUMENT: does the vessel's sharePolicy verdict gate a peer's
 * REQUEST, or only the vessel's ANNOUNCE?
 *
 * automerge-repo 2.6 maps a legacy `sharePolicy` to `shareConfig = { announce: policy, access: () => true }`,
 * and its DocSynchronizer answers `access && hasRequested → "announce"` — so a peer that REQUESTS a doc by id
 * pulls it whatever the policy said. Every `bags/*` plane derives its id from the shared genesis, so a stranger
 * admitted at the cross-operator floor names a private plane's id without being told it. `nodeShareConfig`
 * hands the ONE verdict to BOTH hooks; the vessel's Repo takes it as `shareConfig`.
 *
 * RED (the lie): repo A's policy denies peer B on doc X; B `find(X)` still resolves ready under a legacy
 * `sharePolicy`. CURE: under `nodeShareConfig(policy)` the same find stays unavailable. CONTROL: a permitted
 * doc crosses either way.
 */
import { describe, test, expect } from "vitest";
import { Repo, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { nodeShareConfig } from "../src/node-share-config.js";

type Doc = { text?: string };

async function pair(gate: "legacy" | "access", allow: (docId: DocumentId) => boolean) {
  const { port1, port2 } = new MessageChannel();
  const policy = async (_peerId: PeerId, documentId?: DocumentId) => documentId !== undefined && allow(documentId);
  const A = new Repo({
    network: [new MessageChannelNetworkAdapter(port1)],
    peerId: "A" as PeerId,
    ...(gate === "legacy" ? { sharePolicy: policy } : { shareConfig: nodeShareConfig(policy) }),
  });
  const B = new Repo({ network: [new MessageChannelNetworkAdapter(port2)], peerId: "B" as PeerId });
  await Promise.all([A.networkSubsystem.whenReady(), B.networkSubsystem.whenReady()]);
  return { A, B, port1, port2 };
}

const settle = async <T,>(p: Promise<T>, ms: number): Promise<"ready" | "unavailable" | "timeout"> =>
  Promise.race([
    p.then(() => "ready" as const, () => "unavailable" as const),
    new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms)),
  ]);

describe("the sharePolicy verdict gates a peer's REQUEST, not only the vessel's ANNOUNCE", () => {
  test("RED — under a legacy sharePolicy, a DENIED doc still crosses to a peer that asks for it by id", async () => {
    const denied = new Set<DocumentId>();
    const { A, B } = await pair("legacy", (id) => !denied.has(id));
    const secret = A.create<Doc>({ text: "the count" });
    denied.add(secret.documentId);
    const r = await settle(B.find<Doc>(secret.url).then((h) => h.doc()), 3_000);
    // The instrument-lie, pinned: the announce-only gate lets the request through.
    expect(r).toBe("ready");
  });

  test("CURE — under nodeShareConfig the same denied doc stays UNAVAILABLE to the requester", async () => {
    const denied = new Set<DocumentId>();
    const { A, B } = await pair("access", (id) => !denied.has(id));
    const secret = A.create<Doc>({ text: "the count" });
    denied.add(secret.documentId);
    const r = await settle(B.find<Doc>(secret.url).then((h) => h.doc()), 3_000);
    expect(r).not.toBe("ready");
  });

  test("CONTROL — a PERMITTED doc crosses under nodeShareConfig exactly as before", async () => {
    const { A, B } = await pair("access", () => true);
    const open = A.create<Doc>({ text: "the shelf" });
    const r = await settle(B.find<Doc>(open.url).then((h) => h.doc()), 5_000);
    expect(r).toBe("ready");
  });
});
