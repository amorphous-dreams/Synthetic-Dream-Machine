/**
 * face-seat-wake-fixture — the joinee island's seat standing through the PRODUCTION composition (`operatorDaemonOptions`'
 * verifierFactory) over a real Repo, a real CompositeStore, a real catalog row and persona plane, and a fleet board founded
 * and signed the way a founding signs it. Two seams stand in for what a face-join would have minted: the Keyhive boot (a
 * recording sink whose membership flips on ingest) and the grant's signature check (it reads the founder's standing alone).
 * Each test file mocks those two modules itself, so the fixture takes the composition it drives as an argument.
 */
import type { DocHandle } from "@automerge/automerge-repo";
import {
  AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, deviceEdgeId, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
  emptyLarDoc, fleetEdgeBoardDocUrl, makeIslandRepo, materializeSharedLarDoc, personaBagIdFor, signEdgeKapae,
  storedLarRecord, wikiSlotUri, writeEdgeKapae, type LarDoc,
} from "@lararium/mesh";
import { fleetFixture } from "./fleet-fixture.js";
import { FACE_GRANT_PREFIX } from "../src/face-grant-record.js";

/** The recording Keyhive the mocked boot hands the island: membership flips when a grant's events land. */
export interface RecordingKeyhive {
  known: boolean;
  ingests: number;
  /** Runs inside `ingestPeerEvents`, before membership flips: a test lands a proof change mid-mutation here. */
  duringIngest?: () => void;
  disposers: (() => void)[];
}

export function recordingKeyhive(): RecordingKeyhive & Record<string, unknown> {
  const kh: RecordingKeyhive & Record<string, unknown> = {
    known: false, ingests: 0, disposers: [],
    whenDisposed: (fn: () => void) => { kh.disposers.push(fn); },
    knowsAgent: async () => kh.known,
    ingestPeerEvents: async () => { kh.ingests++; kh.duringIngest?.(); kh.known = true; },
    settleEvents: async () => {},
    exportArchiveAfterTheCard: async () => new Uint8Array(),
    registerBag: async () => {},
  };
  return kh;
}

type Options = (manifest: never, extra: never) => { verifierFactory?: (ctx: never) => Promise<unknown> };

export async function standJoineeSeat(input: {
  readonly operatorDaemonOptions: Options;
  /** The shore's dyad reading: `readDyadFromBoard` (the browser island) or a vessel-side reader (the node island). */
  readonly extra: (stood: { repo: ReturnType<typeof makeIslandRepo>; root: string; joinee: string; lineage: unknown }) => Promise<Record<string, unknown>> | Record<string, unknown>;
  readonly seedByte: number;
}) {
  const rootSeed = new Uint8Array(32).fill(input.seedByte);
  const root = await ed25519VerifyingKeyFromSeed(rootSeed);
  const founder = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(input.seedByte + 1));
  const joinee = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(input.seedByte + 2));
  const group = `group-${input.seedByte}`;
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const board: DocHandle<LarDoc> = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(root), "board:edge-kapae");
  const fx = await fleetFixture(rootSeed);
  await fx.found(board);
  const signer = [{ signer: root, sign: ed25519SignerFromSeed(rootSeed) }];
  const edgeId = deviceEdgeId(root, founder);
  // THE FOUNDER STANDS ASIDE when the joinee boots: a counted raise on its device-face dyad.
  const raise = await signEdgeKapae({ edgeId, raised: true, hand: "holder", parents: [] }, signer);
  board.change((draft) => { writeEdgeKapae(draft, raise); });
  await fx.register(board, [raise.actCid]);

  // The face's persona plane holds the joinee's grant record; the catalog maps the plane's bag to it.
  const plane = repo.create<LarDoc>(emptyLarDoc());
  const grantTitle = `${FACE_GRANT_PREFIX}${group}/${joinee}`;
  const record = { sig: `grant-${input.seedByte}`, capEvents: [], founderEdge: { deviceVerifyingKey: founder } };
  plane.change((d) => { d.tiddlers[grantTitle] = storedLarRecord(grantTitle, { text: JSON.stringify(record) }, "test"); });
  const catalog = repo.create<LarDoc>(emptyLarDoc());
  const planeBag = personaBagIdFor(group);
  catalog.change((d) => { d.tiddlers[planeBag] = storedLarRecord(planeBag, { text: plane.url }, "test"); });

  const composite = new CompositeStore();
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const daemonStore = new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID);
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: daemonStore, writable: true });
  daemonStore.markSyncComplete();
  const working = wikiSlotUri("daemon", "working");
  composite.addLayer({ bagId: working, store: new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), working), writable: true, defaultWritable: true });
  const ctx = { composite, repo, recipe: { wikiSlug: "daemon" }, handles: new Map(), post: () => {}, catalogUrl: catalog.url, faceCatalogUrl: null };
  const daemonAuth = {
    placeVerifyingKey: joinee, registerBags: [DAEMON_BAG_ID], archiveOpens: false,
    personaGroupId: group, atom: { seed: "00".repeat(32), key: joinee },
    deviceEdge: { personaRootDid: root, deviceVerifyingKey: joinee },
    personaKel: { prefix: fx.prefix, chain: fx.chain },
  };
  const extra = await input.extra({ repo, root, joinee, lineage: fx.lineage });
  const options = input.operatorDaemonOptions({ daemonAuth } as never, extra as never);
  return {
    repo, board, ctx, root, founder, joinee, group,
    boot: () => options.verifierFactory!(ctx as never),
    /** The founder's dyad lifts: a holder act on the same edge, parented on the raise (the lift owes its roll). */
    lift: async () => {
      const down = await signEdgeKapae({ edgeId, raised: false, hand: "holder", parents: [raise.actCid] }, signer);
      board.change((draft) => { writeEdgeKapae(draft, down); });
    },
    /** A daemon-layer change: the wake the composition already carried before the fleet watch. */
    daemonTouch: () => { daemonHandle.change((d) => { d.tiddlers["$:/test/touch"] = storedLarRecord("$:/test/touch", { text: String(Math.random()) }, "test"); }); },
    /** A board move that leaves the founder's standing as it was. */
    noise: () => { board.change((d) => { (d.tiddlers as Record<string, unknown>)["a-foreign-row"] = { tiddler: { text: "noise" }, meta: {} }; }); },
  };
}

/** Waits on a condition the composition reaches by its own causal wakes; the bound names a hang, never decides an outcome. */
export async function until(cond: () => boolean, rounds = 200): Promise<boolean> {
  for (let i = 0; i < rounds && !cond(); i++) await new Promise((r) => setTimeout(r, 10));
  return cond();
}

/** Lets every queued wake run out: N macrotask turns with nothing left to change. */
export async function quiesce(turns = 30): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 5));
}
