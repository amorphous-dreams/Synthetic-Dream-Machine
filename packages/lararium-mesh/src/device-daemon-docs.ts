/**
 * device-daemon-docs — the per-device daemon documents, each filed by the face that OWNS it, never by the face lit now.
 *
 * The control document names the daemon wiki's device slots (`daemon-slot/<kind>/<group>`) and each face's daemon canon
 * (`daemon-canon/<face>`). A slot's group, or a canon's face, owns the document: a group's slot seals under that group's
 * face key, and only while that face stands lit; the floor's slot (`group = floor`) seals beside the control document under
 * the vessel's key, lit or not. A document of a face that does not stand lit now (an earlier face after an in-process face
 * change, or a face not yet lit) maps held: its saves wait in memory and its loads wait, never clear and never under
 * another face's key. A slot the daemon island announces before the control document names it maps held until it does.
 *
 * A document keeps its first owner: a later control entry naming it under another group or face moves nothing.
 *
 * ONE TABLE, EVERY VESSEL CLASS (operator ruling: idempotent-by-intent and isomorphic-by-intent parity). The node and the
 * browser vessel both file their device documents here, so the two cannot drift on which key seals which document.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/control-home
 */
import { CONTROL_HOME_ID } from "./lar-uris.js";
import { daemonFaceCanonBag, wikiSlotUri } from "./wiki-recipe.js";
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { documentIdOfUrl, type SealedBag } from "./sealed-rest.js";

/** The daemon wiki's device slot bags share this prefix (`wikis/daemon/<kind>`). */
export const DAEMON_SLOT_PREFIX = wikiSlotUri("daemon", "working").replace(/working$/, "");

type Owner =
  | { readonly kind: "floor" }
  | { readonly kind: "group"; readonly group: string }
  | { readonly kind: "canon"; readonly relation: string }
  | { readonly kind: "unnamed" };

/** The face lit now, as the device table reads it: its group, its relation, and the face subject its saves seal under. */
export interface LitDeviceFace {
  readonly group: string | null;
  readonly relation: string | null;
  readonly face: string | null;
}

export interface DeviceDaemonDocs {
  /** Read every device slot and canon the control document names; answers whether any filing moved. */
  readControl(controlDoc: LarDoc | null | undefined): boolean;
  /** The daemon island announced a device slot's document before its first byte: held until the control document names its owner. */
  announced(bagId: string, documentId: string): boolean;
  /** A face's daemon canon minted (its document named before its first byte), owned by `relation`. */
  canonMinted(bagId: string, documentId: string, relation: string): boolean;
  /** The sealed bag of a device document under `lit`; undefined where the document files as none (or as the floor's, which
   *  the vessel's held homes answer). */
  bagOf(documentId: string, lit: LitDeviceFace): SealedBag | undefined;
  /** The documents of `bagId` the lit face owns, in filing order. */
  docsOf(bagId: string, lit: LitDeviceFace): string[];
  /** Is `documentId` a device document of any owner (the vessel-only share verdict reads this)? */
  has(documentId: string): boolean;
  /** Every device document filed here, floor slots included. */
  ids(): string[];
}

export function deviceDaemonDocs(io: { readonly enrollFloor: (documentId: string, bagId: string) => void }): DeviceDaemonDocs {
  const owners = new Map<string, { readonly bagId: string; readonly owner: Owner }>();
  const file = (documentId: string, bagId: string, owner: Owner): boolean => {
    const filed = owners.get(documentId);
    if (filed !== undefined && filed.owner.kind !== "unnamed") return false;
    if (filed !== undefined && owner.kind === "unnamed") return false;
    owners.set(documentId, { bagId: filed?.bagId ?? bagId, owner });
    if (owner.kind === "floor") io.enrollFloor(documentId, filed?.bagId ?? bagId);
    return true;
  };
  const lits = (owner: Owner, lit: LitDeviceFace): boolean =>
    (owner.kind === "group" && lit.group !== null && owner.group === lit.group)
    || (owner.kind === "canon" && lit.relation !== null && owner.relation === lit.relation);
  return {
    readControl(controlDoc) {
      let moved = false;
      const slotPrefix = `${CONTROL_HOME_ID}/daemon-slot/`;
      const canonPrefix = `${CONTROL_HOME_ID}/daemon-canon/`;
      for (const [title, record] of Object.entries(controlDoc?.tiddlers ?? {})) {
        const documentId = documentIdOfUrl(tiddlerText(record));
        if (!documentId) continue;
        if (title.startsWith(slotPrefix)) {
          const [kind, group] = title.slice(slotPrefix.length).split("/");
          if (!kind || !group) continue;
          const owner = decodeURIComponent(group);
          moved = file(documentId, wikiSlotUri("daemon", kind as never), owner === "floor" ? { kind: "floor" } : { kind: "group", group: owner }) || moved;
        } else if (title.startsWith(canonPrefix)) {
          const relation = decodeURIComponent(title.slice(canonPrefix.length));
          let bagId: string;
          try { bagId = daemonFaceCanonBag(relation); } catch { continue; }
          moved = file(documentId, bagId, { kind: "canon", relation }) || moved;
        }
      }
      return moved;
    },
    announced: (bagId, documentId) => file(documentId, bagId, { kind: "unnamed" }),
    canonMinted: (bagId, documentId, relation) => file(documentId, bagId, { kind: "canon", relation }),
    bagOf(documentId, lit) {
      const filed = owners.get(documentId);
      if (filed === undefined || filed.owner.kind === "floor") return undefined;
      return { bagId: filed.bagId, face: lits(filed.owner, lit) ? lit.face : null };
    },
    docsOf: (bagId, lit) => [...owners].filter(([, f]) => f.bagId === bagId && lits(f.owner, lit)).map(([id]) => id),
    has: (documentId) => owners.has(documentId),
    ids: () => [...owners.keys()],
  };
}

/**
 * THE VESSEL-HELD BAG OF A DOCUMENT, in the one order every vessel class reads it: a device document by its owner first (the
 * held homes' table never forgets, so a group's slot never reads from it), then the held homes (the secret home, the control
 * document, the floor's slots, all under the vessel's key). Undefined: neither files it, and the vessel's sealed map decides.
 */
export function vesselHeldBagOf(
  device: Pick<DeviceDaemonDocs, "bagOf">, held: { bagOf(documentId: string): SealedBag | null }, lit: LitDeviceFace, documentId: string,
): SealedBag | undefined {
  return device.bagOf(documentId, lit) ?? held.bagOf(documentId) ?? undefined;
}
