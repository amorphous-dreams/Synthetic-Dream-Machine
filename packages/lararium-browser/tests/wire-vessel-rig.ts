/**
 * wire-vessel-rig — the fakes that stand beneath the browser vessel's admit boundary and relay seam.
 *
 * `openBrowserVessel` runs for real over the page's IndexedDB and WebCrypto. Three seams beneath it are
 * replaced by the test files that import this rig: the keyhive admit ceremony (`runApplyAdmitPayload`), the
 * relay transport (`LarWSClientAdapter`) and the share-config factory (`shareConfigOf`, whose policy the Repo
 * consults at each decision). The opener halts itself at the catalog phase, after the crossing is installed.
 */
import { NetworkAdapter, generateAutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import type { PeerMetadata } from "@automerge/automerge-repo";
import type { CarriedAdmitPayload } from "@lararium/keyhive";
import type { HearthPinIndex } from "@lararium/mesh";
import type { BrowserVesselOptions } from "../src/open-browser-vessel.js";

type SharePolicy = (peerId: PeerId, documentId?: DocumentId) => boolean | Promise<boolean>;

/** What the faked seams observed during the boot under test. */
export const observed = {
  /** Every policy handed to `shareConfigOf`, in construction order; the vessel's own Repo registers first. */
  policies: [] as SharePolicy[],
  /** Every relay adapter the vessel stood. */
  relays: [] as FakeRelayAdapter[],
  /** Every input the vessel passed to `hearthCrossingOf`. */
  crossingInputs: [] as Array<Record<string, unknown>>,
};

export function resetObserved(): void {
  observed.policies.length = 0;
  observed.relays.length = 0;
  observed.crossingInputs.length = 0;
}

/** The refusal the rig raises to stop the opener once the crossing stands. */
export class BootHalted extends Error {
  constructor() { super("wire-vessel-rig: boot halted at the catalog phase"); this.name = "BootHalted"; }
}

/** A relay transport that never leaves the page: it connects to nothing and emits only what a test emits. */
export class FakeRelayAdapter extends NetworkAdapter {
  session: { readonly gatePubKey: string } | null = null;
  anergized: string | null = null;
  readonly options: unknown;
  constructor(options: unknown) { super(); this.options = options; observed.relays.push(this); }
  isReady(): boolean { return true; }
  whenReady(): Promise<void> { return Promise.resolve(); }
  connect(peerId: PeerId, _peerMetadata?: PeerMetadata): void { this.peerId = peerId; }
  join(): void { /* no session stands */ }
  onClose(): void { /* nothing to close */ }
  send(): void { /* nothing leaves the page */ }
  disconnect(): void { /* nothing to drop */ }
}

/** Announce one relay peer: the vessel's own listener tags it as a relay peer. */
export function relayPeerArrives(peerId: string): void {
  const relay = observed.relays[0];
  if (!relay) throw new Error("wire-vessel-rig: the vessel stood no relay adapter");
  relay.emit("peer-candidate", { peerId: peerId as PeerId, peerMetadata: {} });
}

const hex = (seed: string): string => seed.repeat(32).slice(0, 64);

/** A carried admit whose island resolves to the hearth's own gate key (`anchor`). */
export function admitNaming(hearthGatePubKey: string, hearthCanonDocs: Record<string, string>): CarriedAdmitPayload {
  return {
    hearthGatePubKey, hearthIslandKind: "anchor", hearthIslandScope: hearthGatePubKey,
    hearthCanonDocs,
    personaGroupId: hex("a1"), meshCabalDocIdHex: hex("a3"),
    signerDid: "did:key:z6MkWireRig", personaKelPrefix: "EWireRigPrefix",
    // The rig's edge carries the fields the sealed anchor commits to (root, device, hearth, epoch); no ceremony signs it.
    deviceEdge: { signed: true, personaRootDid: `0x${hex("a5")}`, deviceVerifyingKey: hex("a7"), hearthTrueName: "wire-rig-hearth", boundEpoch: "0" },
    personaActs: [], edgeFrontier: { records: [], snapshots: [] },
  } as unknown as CarriedAdmitPayload;
}

/** The result a faked admit ceremony returns: fresh document urls and a card, no ceremony run. */
export function fakeAdmitResult(input?: { readonly payload?: { readonly deviceEdge?: unknown } }): Record<string, unknown> {
  return {
    // The complete edge the ceremony returns; the faked ceremony carries the payload's own.
    ...(input?.payload?.deviceEdge ? { deviceEdge: input.payload.deviceEdge } : {}),
    identitiesUrl: generateAutomergeUrl(), circlesUrl: generateAutomergeUrl(), sessionsUrl: generateAutomergeUrl(), intentsUrl: generateAutomergeUrl(),
    daemonUrl: generateAutomergeUrl(), personaUrl: generateAutomergeUrl(), personaBagId: "persona-wire-rig",
    contactCardJson: "{\"wire\":\"rig\"}", hearthDaemonUrl: null,
    archive: new Uint8Array([0x77, 0x69, 0x72, 0x65]),
  };
}

/**
 * The three inputs the sealed relay dial waits on, as the rig hands them: an index that holds, for any key, a pin whose
 * signing key is `gateKey` (the gate the crossing pins), a Nexus, and a presentation. The relay transport is a fake
 * beneath the vessel, so it reads none of the three; they let the vessel stand the dial the policy wire sits behind.
 */
function heldRelayDial(gateKey: string): NonNullable<BrowserVesselOptions["relayDial"]> {
  return {
    pins: { get: () => ({ tier: "sovereign", signingKey: gateKey }), put: () => false } as unknown as HearthPinIndex,
    nexus: "ab".repeat(16),
    presentation: {} as never,
  };
}

/** Options for a boot that dials the gate `pinnedGateKey` names after admission (none: no relay); the store name is unique per boot. */
export function bootOptions(admit: CarriedAdmitPayload, pinnedGateKey: string | null): BrowserVesselOptions {
  return {
    idbName: `wire-rig-${crypto.randomUUID()}`,
    admit,
    ...(pinnedGateKey ? { relayUrl: "ws://wire-rig.invalid/ws", relayDial: heldRelayDial(pinnedGateKey) } : {}),
    onPhase: (phase: string) => { if (phase === "catalog-ready") throw new BootHalted(); },
  } as BrowserVesselOptions;
}
