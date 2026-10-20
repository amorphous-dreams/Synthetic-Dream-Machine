import type { CapabilityVerifier } from "@lararium/mesh";
import type { CapabilityProvider, KeyhiveAccess } from "./capability-provider.js";
import type { KeyhiveProvider } from "./keyhive-provider.js";
import type { BagDocLedger } from "./bag-doc-ledger.js";

export interface FaceBagDoor {
  mint(bagUrl: string, access: KeyhiveAccess): Promise<{ docId: string }>;
  adopt(bagUrl: string, docId: string): void;
  remint(bagUrl: string): Promise<{ docId: string }>;
}

export function makeFaceBagDoor({ face, groupId, ledger }: { face: CapabilityProvider; groupId: string; ledger?: BagDocLedger }): FaceBagDoor {
  return {
    async mint(bagUrl, access) {
      // A face that stands again finds the Document it minted: the ledger's record adopts while the face still holds its
      // hand in it, and the grant it made then stands in the replayed events, so a second boot grants and writes nothing.
      const recorded = ledger ? await ledger.get(bagUrl) : null;
      if (recorded) {
        face.adoptBag(bagUrl, recorded);
        if (await face.holdsHand(bagUrl)) {
          // The grant stands in the replayed events, or it is made now: a record that a registration wrote alone never
          // names a Document the group was never granted.
          if (!(await face.verify({ bagUrl, presenter: groupId, access })).ok) await face.delegate({ bagUrl, audience: groupId, access });
          return { docId: recorded };
        }
      }
      const { docId } = recorded ? await face.remintBag(bagUrl) : await face.registerBag(bagUrl);
      await face.delegate({ bagUrl, audience: groupId, access });
      if (ledger) await ledger.put(bagUrl, docId);
      return { docId };
    },
    adopt: (bagUrl, docId) => face.adoptBag(bagUrl, docId),
    async remint(bagUrl) {
      const { docId } = await face.remintBag(bagUrl);
      await face.delegate({ bagUrl, audience: groupId, access: "admin" });
      if (ledger) await ledger.put(bagUrl, docId);
      return { docId };
    },
  };
}

/**
 * A bag answers to the provider that minted it: the face's own bags to the face's atom provider, the vessel's ground
 * (the daemon bag, the oracle plane) to the place's. A session over the local channel presents as the mounted face's
 * atom (`presenterFor`), and the device it wears holds the place too, so on a ground bag the mounted atom reads as the
 * place's own hand. No other presenter borrows it: a stranger's DID reaches the verifier unchanged and finds no grant.
 */
export function faceOwnerVerifier({ vessel, face, mount }: {
  vessel: KeyhiveProvider;
  face: KeyhiveProvider | null;
  mount?: { readonly atomKey: string; readonly placeKey: string };
}): CapabilityVerifier {
  const bare = (did: string): string => did.trim().toLowerCase().replace(/^0x/, "");
  return {
    async verify(args) {
      if (!face || !face.docIdOfBag(args.bagUrl)) {
        if (mount && bare(args.presenter) === bare(mount.atomKey)) return vessel.verify({ ...args, presenter: `0x${bare(mount.placeKey)}` });
        return vessel.verify(args);
      }
      return face.verify(args);
    },
  };
}
