/**
 * stand-root-island — the daemon island of a REAL founded scratch root, booted through the real
 * `operatorDaemonOptions`, for the suites that run a vessel's own key island over a root the real founding doors
 * (`runInit`, `runFoundTheFace`) left on disk.
 *
 * Everything the island reads comes off that root: the daemon document its bootstrap names, the worn face's sealed
 * anchors, its veil (derived from the root's own sealed custody root, beside the veil archive that face keeps), the
 * face's key history off the root's own board, and the vessel's own key. The sealed store's shore stands over the
 * root's own storage directory, as a vessel's island stands it (`islandStorageDirOf`).
 *
 * The session proof stands composed here as the sealed store's own vessel vectors compose it; no production path
 * opens a session signer yet.
 */
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { join } from "node:path";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import type { SessionProof } from "@lararium/keyhive";
import {
  AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, attachMessageChannelSync, ed25519SignerFromSeed, makeIslandRepo, signMemoryAsk, wikiBagUri,
  type LarDoc, type MemoryAct, type RecordSigner,
} from "@lararium/mesh";
import { VerbTable } from "@lararium/tw5";
import { sessionSignatureImage } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain, signHex } from "../../lararium-mesh/tests/face-proof-fixture.js";
import { readFileSync } from "node:fs";
import { custodyVeilKeys } from "../src/custody-seat.js";
import { loadIdentityAnchors, loadIdentityArchive, loadVeilArchive, persistIdentityArchive, persistVeilArchive } from "../src/identity-anchors.js";
import { loadVesselSigningSeed, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { readLocalPersonaKelChain } from "../src/local-persona-kel.js";
import { islandStorageDirOf, nodeSealedStoreShore } from "../src/sealed-store-island.js";
import { larBootstrapPath, larDataDir } from "../src/vessel-paths.js";

/** One session proof for a suite's faces: the same chain signs on every vessel the suite stands, as one face's sessions do. */
export async function suiteSessionProof(label: string): Promise<SessionProof> {
  const c = await chain(label, "nexus-test-one");
  const signer: RecordSigner = {
    certificate: c.sessionCertificate,
    sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }),
  };
  return { signer: () => signer, standing: { holdsWrite: () => true } };
}

export interface RootIsland {
  /** Run one island verb as the dispatcher runs it. `ask` signs it as the vessel's own main thread. */
  run(verb: string, args: Record<string, unknown>, ask?: { act: MemoryAct; facts: Record<string, unknown> }): Promise<Record<string, unknown>>;
  /** Lower the island: its identities leave, and the content-key holder with them. */
  down(): Promise<void>;
}

/**
 * Stand the daemon island of the root `LAR_ROOT` names, over `repo` (the store's one holder), wearing the face at
 * `handleIndex`. `bags` name the bags the island's composition registers beside the daemon's own.
 */
export async function standRootIsland(args: { repo: Repo; handleIndex: number; bags: readonly string[]; sessionProof: SessionProof | null; dyad?: () => "clear" | "aside" }): Promise<RootIsland> {
  const { repo } = args;
  const anchors = await loadIdentityAnchors(args.handleIndex);
  if (!anchors?.signerDid || !anchors.personaKelPrefix || !anchors.veilTag || !anchors.deviceEdge) throw new Error("fixture: the face holds no whole anchors on this root");
  const plugin = JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text?: string };
  const daemonUrl = (JSON.parse(plugin.text ?? '{"tiddlers":{}}') as { tiddlers?: Record<string, { text?: string }> }).tiddlers?.[DAEMON_BAG_ID]?.text;
  if (!daemonUrl) throw new Error("fixture: the root's bootstrap names no daemon document");
  const seed = await loadVesselSigningSeed();
  const vesselKey = await loadVesselVerifyingKey();
  const kel = await readLocalPersonaKelChain(repo, anchors.personaKelPrefix);
  const veilKeys = await custodyVeilKeys(anchors.veilTag);
  const veilArchiveBytes = await loadVeilArchive(args.handleIndex);
  const archiveBytes = await loadIdentityArchive();

  const oracle = repo.create<LarDoc>({ schemaVersion: "lar/1", tiddlers: { [DAEMON_BAG_ID]: { tiddler: { title: DAEMON_BAG_ID, text: daemonUrl } } } } as unknown as LarDoc);
  const catalog = repo.create<LarDoc>({ schemaVersion: "lar/1", tiddlers: { [wikiBagUri("daemon")]: { tiddler: { title: wikiBagUri("daemon"), text: daemonUrl } } } } as unknown as LarDoc);
  const { port1, port2 } = new MessageChannel();
  const islandRepo = makeIslandRepo({ syncPort: port1 as never, denyDocument: daemonUrl });
  const detach = attachMessageChannelSync(repo, port2 as never);
  const daemonHandle = await repo.find<LarDoc>(daemonUrl as AutomergeUrl);
  const composite = new CompositeStore();
  const store = new AutomergeDocStore(daemonHandle, DAEMON_BAG_ID);
  composite.addLayer({ bagId: DAEMON_BAG_ID, store, writable: true });
  store.markSyncComplete();
  const ctx = {
    wikiUri: "lar:///ha.ka.ba/wikis/daemon", composite, tw5: {} as never,
    handles: new Map([[wikiBagUri("daemon"), daemonHandle]]), post: () => {},
    repo: islandRepo, catalogUrl: catalog.url, oracleUrl: oracle.url, engine: { sha256: "", version: "" },
    recipe: { wikiSlug: "daemon" },
  } as never;
  const daemonAuth = {
    seed, vesselVerifyingKey: vesselKey, archiveOpens: true,
    personaGroupId: anchors.personaGroupId,
    meshCabalDocIdHex: anchors.meshCabalDocIdHex, registerBags: [DAEMON_BAG_ID, ...args.bags], signerDid: anchors.signerDid,
    personaKel: { prefix: anchors.personaKelPrefix, chain: kel }, deviceEdge: anchors.deviceEdge,
    dyadVeil: { tag: anchors.veilTag, signingKey: veilKeys.signingKey },
    ...(veilArchiveBytes ? { veilArchiveBytes } : {}), ...(archiveBytes ? { archiveBytes } : {}),
  };
  // The shore stands where a vessel's own island stands it: off the directory of the document the island owns.
  const islandDir = islandStorageDirOf({ ownedDocument: { storage: { type: "nodefs", dir: join(larDataDir(), "daemon-owned") } } })!;
  const opts = operatorDaemonOptions({ daemonAuth } as never, {
    dyadReading: () => (args.dyad ? args.dyad() : "clear"), sealedStore: nodeSealedStoreShore(islandDir),
    // The island's Archives rest where a vessel rests them: sealed rows under this root's own custody. A wrap
    // rests the wrapping identity's Archive first, so an island that stands again opens what it wrapped.
    persistArchive: (bytes: Uint8Array) => persistIdentityArchive(bytes),
    persistVeilArchive: (bytes: Uint8Array) => persistVeilArchive(bytes, args.handleIndex),
    ...(args.sessionProof ? { sessionProof: args.sessionProof } : {}),
  });
  const kh = await opts.verifierFactory!(ctx) as { dispose?: () => Promise<void> };
  const registry = new VerbTable();
  opts.wireWorkerVerbs!(registry, ctx);
  let n = 0;
  const vesselSign = ed25519SignerFromSeed(seed);
  return {
    async run(verb, verbArgs, ask) {
      const requestId = `root-island-${vesselKey.slice(0, 8)}-${++n}`;
      const signed = ask ? { ask: await signMemoryAsk({ requestId, act: ask.act, facts: ask.facts, sign: vesselSign }) } : {};
      return registry.get(verb)!({ ...verbArgs, ...signed }, { daemon: {} as never, invocation: { requestId } as never, cap: async () => ({ ok: true }) } as never) as Promise<Record<string, unknown>>;
    },
    async down() { await kh.dispose?.(); detach(); port1.close(); port2.close(); },
  };
}
