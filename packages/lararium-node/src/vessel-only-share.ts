import { CONTROL_HOME_ID, DAEMON_SLOT_PREFIX, SECRET_HOME_ID, bagUri, documentIdOfUrl, tiddlerText, type LarDoc } from "@lararium/mesh";

/**
 * A vessel-only document reaches the house's own proven islands alone. ONE DOCUMENT YIELDS (road row `L4f`): the daemon
 * wiki's working slot of the face a wire peer's session proved (`ownFaceWorking`, the caller's reading of the device table
 * against the peer's proven face). For it the verdict answers nothing, so the lanes below decide, and the face's own fleet
 * view lets it through (`faceFleetViews`, `daemonWorkingOf`). A sibling keeps its own lane and reads none of it.
 */
export function vesselOnlyShareVerdict(docs: { has(id: string): boolean }, islands: { has(id: string): boolean }, peerId: string, documentId: string | undefined, hasSocket: boolean, sibling = false, ownFaceWorking = false): boolean | undefined {
  if (documentId && docs.has(documentId)) {
    if (ownFaceWorking && hasSocket && !sibling) return undefined;
    return !hasSocket && !sibling && islands.has(peerId);
  }
  return undefined;
}

const DAEMON_CANON_PREFIX = bagUri("daemon-");
const RELATION = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** A DEVICE-PRIVATE BAG, by its classification alone: the daemon wiki's device slots (working, draft, personal), a face's
 *  daemon canon (`bags/daemon-<F>`), the secret home and the control home. Its document stays on this vessel. */
export function isDevicePrivateBag(bagId: string): boolean {
  return bagId.startsWith(DAEMON_SLOT_PREFIX)
    || (bagId.startsWith(DAEMON_CANON_PREFIX) && RELATION.test(bagId.slice(DAEMON_CANON_PREFIX.length)))
    || bagId === SECRET_HOME_ID || bagId === CONTROL_HOME_ID;
}

/**
 * THE VESSEL-ONLY CLASS, BY BAG AS WELL AS BY NAME. The control document's names hydrate only once the vessel reads it, and
 * stay empty while its custody row cannot read; so a share verdict also denies every document a source the vessel holds
 * from boot files under a device-private bag: the held homes (secret home, control home, the floor's slots), the device
 * documents the island announced or the canon minted, and every catalog row whose bag classifies device-private.
 */
export function vesselOnlyClass(sources: {
  readonly named: { has(id: string): boolean };
  readonly held: { has(id: string): boolean };
  readonly device: { has(id: string): boolean };
  readonly catalog: () => LarDoc | undefined;
}): { has(id: string): boolean } {
  return {
    has: (id) => sources.named.has(id) || sources.held.has(id) || sources.device.has(id) || catalogFilesDevicePrivate(sources.catalog(), id),
  };
}

function catalogFilesDevicePrivate(catalog: LarDoc | undefined, documentId: string): boolean {
  for (const [title, row] of Object.entries(catalog?.tiddlers ?? {})) {
    if (isDevicePrivateBag(title) && documentIdOfUrl(tiddlerText(row)) === documentId) return true;
  }
  return false;
}
