/**
 * browser-device-filing — how the browser vessel files a document it holds: its per-device daemon documents by the face
 * that OWNS each (`deviceDaemonDocs`), then its held homes (`vesselHeldHomes`), through the one order the node reads
 * (`vesselHeldBagOf`; isomorphic by intent, operator ruling 2026-11-09 "parity across vessel types").
 *
 * The floor's daemon slot enrolls beside the secret home under the vessel's own key; a group's slot or a face's canon seals
 * under that face's key while its lift stands and waits held otherwise, never under the vessel's key or another face's.
 * `openBrowserVessel` composes its sealed rest over this filing, so a suite that stands it stands the vessel's own path.
 */
import type { Repo } from "@automerge/automerge-repo";
import { deviceDaemonDocs, enrollBesideSecretHome, vesselHeldBagOf, vesselHeldHomes, type LitDeviceFace, type SealedBag } from "@lararium/mesh";

export interface BrowserDeviceFiling {
  readonly deviceDocs: ReturnType<typeof deviceDaemonDocs>;
  readonly secretHomes: ReturnType<typeof vesselHeldHomes>;
  /** The held bag a document files under, or null where neither the device table nor a held home names it. */
  bagOf(documentId: string): SealedBag | null;
}

export function browserDeviceFiling(opts: { readonly repo: () => Repo; readonly litDevice: () => LitDeviceFace }): BrowserDeviceFiling {
  const secretHomes = vesselHeldHomes();
  const deviceDocs = deviceDaemonDocs({ enrollFloor: (documentId, bagId) => { if (!secretHomes.has(documentId)) enrollBesideSecretHome(opts.repo(), documentId, bagId); } });
  return {
    deviceDocs,
    secretHomes,
    bagOf: (documentId) => vesselHeldBagOf(deviceDocs, secretHomes, opts.litDevice(), documentId) ?? null,
  };
}
