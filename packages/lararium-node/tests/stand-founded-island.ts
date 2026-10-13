/**
 * stand-founded-island — a REAL founding and the island context a daemon boot reads.
 *
 * The island's main repo denies the daemon doc (the owned-document split), an oracle registry names it
 * anyway, and the daemon doc reaches the composite as a layer. Shared by the suites that boot the real
 * `operatorDaemonOptions` over a founded face.
 */
import { Repo } from "@automerge/automerge-repo";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { runFoundingCeremony, veilFromDeviceKey, mintDeviceMintedKey } from "@lararium/keyhive";
import {
  CompositeStore, AutomergeDocStore, DAEMON_BAG_ID, hex, makeIslandRepo, attachMessageChannelSync,
  materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix, wikiBagUri, type LarDoc,
} from "@lararium/mesh";
import * as ed25519 from "@noble/ed25519";

const pubOf = async (s: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(s));
const seed  = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const FOUNDER_SEED = seed(71);

/** Found a face, then stand the island the way an owned-document vessel does: a main repo that DENIES the
 *  daemon doc, an oracle registry that names it anyway, and the daemon doc reaching the composite as a layer. */
export async function standFoundedIsland(teardown: Array<() => void>, opts: { composite?: CompositeStore; tw5?: unknown } = {}) {
  const vesselRepo = new Repo({ sharePolicy: async () => true });
  const key = await pubOf(FOUNDER_SEED);
  const cer = await runFoundingCeremony({ deriveVeil: veilFromDeviceKey(mintDeviceMintedKey(FOUNDER_SEED)),
    repo: vesselRepo, vesselSeed: FOUNDER_SEED, vesselVerifyingKey: key,
    vesselDisplayName: "Founder", binding: { mode: "self-stood", signerSeed: FOUNDER_SEED }, hearthTrueName: "", nexusPubkey: key,
  });
  const kelBoard = await materializeSharedLarDoc(vesselRepo, personaKelBoardDocUrl(key), "board:persona-kel");
  const chain = personaKelChainForPrefix(kelBoard.doc(), cer.personaKelPrefix);
  if (!chain) throw new Error("fixture: no persona-KEL chain on the founder's board");

  // The oracle registry names the daemon doc — the address a registry walk resolves.
  const oracle = vesselRepo.create<LarDoc>({
    schemaVersion: "lar/1",
    tiddlers: { [DAEMON_BAG_ID]: { tiddler: { title: DAEMON_BAG_ID, text: cer.daemonUrl } } },
  } as unknown as LarDoc);
  const catalog = vesselRepo.create<LarDoc>({
    schemaVersion: "lar/1",
    tiddlers: { [wikiBagUri("daemon")]: { tiddler: { title: wikiBagUri("daemon"), text: cer.daemonUrl } } },
  } as unknown as LarDoc);

  // The island's MAIN repo denies the daemon doc (owned-document split).
  // A plain MessageChannel (the global one) — the sync leg the kernel's island repo rides; no nested island stands.
  const { port1, port2 } = new MessageChannel();
  const islandRepo = makeIslandRepo({ syncPort: port1 as never, denyDocument: cer.daemonUrl });
  const detach = attachMessageChannelSync(vesselRepo, port2 as never);
  teardown.push(() => { detach(); port1.close(); port2.close(); });

  // The composite's daemon layer — the owned doc, as the kernel layers it.
  const daemonHandle = await vesselRepo.find<LarDoc>(cer.daemonUrl as AutomergeUrl);
  const composite = opts.composite ?? new CompositeStore();
  if (!opts.composite) {
    const store = new AutomergeDocStore(daemonHandle, DAEMON_BAG_ID);
    composite.addLayer({ bagId: DAEMON_BAG_ID, store, writable: true });
    store.markSyncComplete();
  }
  const ctx = {
    wikiUri: "lar:///ha.ka.ba/wikis/daemon", composite, tw5: (opts.tw5 ?? {}) as never,
    handles: new Map([[wikiBagUri("daemon"), daemonHandle]]), post: () => {},
    repo: islandRepo, catalogUrl: catalog.url, oracleUrl: oracle.url, engine: { sha256: "", version: "" },
    recipe: { wikiSlug: "daemon" },
  } as never;
  const daemonAuth = {
    seed: FOUNDER_SEED, vesselVerifyingKey: key,
    personaGroupDocIdHex: cer.personaGroupDocIdHex, personaGroupAgentIdHex: cer.personaGroupAgentIdHex,
    meshCabalDocIdHex: cer.meshCabalDocIdHex, registerBags: [DAEMON_BAG_ID], signerDid: cer.signerDid,
    personaKel: { prefix: cer.personaKelPrefix, chain }, deviceEdge: cer.founderEdge, archiveOpens: true,
  };
  // The face's creator-veil, as a shore that derives it hands it to the island: the key the founding derived under
  // its tag, and the Archive that veil left. A suite that needs the veil standing adds both to `daemonAuth`.
  const veilKeys = await veilFromDeviceKey(mintDeviceMintedKey(FOUNDER_SEED))(cer.veilTag);
  const veil = { dyadVeil: { tag: cer.veilTag, signingKey: veilKeys.signingKey }, veilArchiveBytes: cer.veilArchive };
  return { ctx, daemonAuth, daemonHandle, vesselRepo, veil };
}
