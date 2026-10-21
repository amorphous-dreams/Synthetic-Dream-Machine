/** The daemon island tells its vessel which countersigned edge cleared its real Binding Gate. */
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { deviceEdgeDigest, makeIslandRepo, type AutomergeUrl, type DeviceDelegationTiddler } from "@lararium/mesh";
import {
  AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, leaseEpochSlotUri,
  emptyLarDoc, materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix,
  wikiSlotUri, type LarDoc,
} from "@lararium/mesh";
import { KeyhiveProvider, runFoundingCeremony } from "../src/index.js";
import { operatorDaemonOptions } from "../src/operator-daemon-behavior.js";

const seed = new Uint8Array(32).fill(37);
const digestOf = (edge: Record<string, unknown>) => deviceEdgeDigest(edge as unknown as DeviceDelegationTiddler);

type Ceremony = Awaited<ReturnType<typeof runFoundingCeremony>>;
let repo: ReturnType<typeof makeIslandRepo>;
let ceremony: Ceremony;
let verifyingKey: string;
let kel: { prefix: string; chain: NonNullable<ReturnType<typeof personaKelChainForPrefix>> };
let daemonHandle: Awaited<ReturnType<ReturnType<typeof makeIslandRepo>["find"]>>;

beforeAll(async () => {
  repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const probe = new KeyhiveProvider();
  await probe.init({ seed, eventStore: { put: async () => {}, list: async () => [] } });
  verifyingKey = (await probe.whoami()).replace(/^0x/, "");
  await probe.dispose();
  ceremony = await runFoundingCeremony({
    repo, vesselSeed: seed, vesselVerifyingKey: verifyingKey, vesselDisplayName: "Gate witness",
    binding: { mode: "self-stood", signerSeed: seed }, hearthTrueName: "", nexusPubkey: verifyingKey,
  });
  const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(verifyingKey), "board:persona-kel");
  const chain = personaKelChainForPrefix(board.doc(), ceremony.personaKelPrefix);
  if (!chain) throw new Error("the founding seated no persona KEL");
  kel = { prefix: ceremony.personaKelPrefix, chain };
  daemonHandle = await repo.find<LarDoc>(ceremony.daemonUrl as AutomergeUrl);
});

afterAll(async () => { if (repo) await repo.shutdown(); });

function island(options: { floor?: boolean; epoch?: number; dyad?: "clear" | "aside" } = {}) {
  const composite = new CompositeStore();
  const daemonStore = new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID);
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: daemonStore, writable: true });
  daemonStore.markSyncComplete();
  if (options.epoch !== undefined) {
    const title = leaseEpochSlotUri(ceremony.personaGroupId, verifyingKey);
    (daemonHandle as { change: (fn: (doc: LarDoc) => void) => void }).change((doc) => {
      doc.tiddlers[title] = { tiddler: { title, text: String(options.epoch) } } as never;
    });
  }
  // The working layer already stands; the verifier can finish after the gate without a slot mint.
  const working = wikiSlotUri("daemon", "working");
  const workingHandle = repo.create<LarDoc>(emptyLarDoc());
  composite.addLayer({ bagId: working, store: new AutomergeDocStore(workingHandle, working), writable: true, defaultWritable: true });
  const post = vi.fn();
  const ctx = { composite, repo, recipe: { wikiSlug: "daemon" }, handles: new Map(), post };
  const daemonAuth = {
    seed, vesselVerifyingKey: verifyingKey, registerBags: [DAEMON_BAG_ID], archiveOpens: false,
    ...(options.floor ? {} : {
      personaGroupId: ceremony.personaGroupId, meshCabalDocIdHex: ceremony.meshCabalDocIdHex,
      signerDid: ceremony.signerDid, personaKel: kel, deviceEdge: ceremony.founderEdge,
      atom: { seed: Buffer.from(ceremony.atomSeed).toString("hex"), key: ceremony.founderEdge.deviceVerifyingKey },
      veilArchiveBytes: ceremony.veilArchive,
    }),
  };
  const verifier = operatorDaemonOptions({ daemonAuth } as never, {
    dyadReading: async () => options.dyad ?? "clear",
  }).verifierFactory!;
  return { post, run: () => verifier(ctx as never) };
}

describe("the island proves the face to its vessel", () => {
  test("a valid edge posts its stable digest and persona root", async () => {
    const edge = ceremony.founderEdge as unknown as Record<string, unknown>;
    const expected = digestOf(edge);
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
    expect(digestOf({ ...edge })).toBe(expected);
    expect(digestOf({ ...edge, boundEpoch: Number(edge.boundEpoch) + 1 })).not.toBe(expected);
    const { post, run } = island();
    await run();
    const clear = post.mock.calls.map(([message]) => message).find((message) => message?.type === "gate:clear");
    expect(clear, "the passed Binding Gate posts its edge").toMatchObject({ type: "gate:clear", personaRoot: edge.personaRootDid });
    expect(clear.edgeDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(clear.edgeDigest).toBe(expected);
  });

  test("a stale edge posts the Binding Gate refusal and halts", async () => {
    const { post, run } = island({ epoch: 1 });
    await expect(run()).rejects.toThrow(/Binding Gate/);
    expect(post.mock.calls.map(([message]) => message).find((message) => message?.type === "gate:refused"))
      .toMatchObject({ type: "gate:refused", cause: expect.any(String) });
  });

  test("a set-aside device posts a refusal and halts", async () => {
    const { post, run } = island({ epoch: 0, dyad: "aside" });
    await expect(run()).rejects.toThrow(/SET ASIDE/);
    expect(post.mock.calls.map(([message]) => message).find((message) => message?.type === "gate:refused"))
      .toMatchObject({ type: "gate:refused", cause: expect.any(String) });
  });

  test("control: a faceless boot posts no gate message", async () => {
    const { post, run } = island({ floor: true });
    await run();
    expect(post).not.toHaveBeenCalled();
  });
});
