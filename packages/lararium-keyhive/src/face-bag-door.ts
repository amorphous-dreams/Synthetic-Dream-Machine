import type { CapabilityVerifier } from "@lararium/mesh";
import type { CapabilityProvider, KeyhiveAccess } from "./capability-provider.js";
import type { KeyhiveProvider } from "./keyhive-provider.js";

export interface FaceBagDoor {
  mint(bagUrl: string, access: KeyhiveAccess): Promise<{ docId: string }>;
  adopt(bagUrl: string, docId: string): void;
  remint(bagUrl: string): Promise<{ docId: string }>;
}

export function makeFaceBagDoor({ face, groupId }: { face: CapabilityProvider; groupId: string }): FaceBagDoor {
  return {
    async mint(bagUrl, access) {
      const { docId } = await face.registerBag(bagUrl);
      await face.delegate({ bagUrl, audience: groupId, access });
      return { docId };
    },
    adopt: (bagUrl, docId) => face.adoptBag(bagUrl, docId),
    async remint(bagUrl) {
      const { docId } = await face.remintBag(bagUrl);
      await face.delegate({ bagUrl, audience: groupId, access: "admin" });
      return { docId };
    },
  };
}

const bareId = (id: string): string => id.replace(/^0x/i, "").toLowerCase();

export function faceOwnerVerifier({ vessel, face, vesselVerifyingKey }: {
  vessel: KeyhiveProvider;
  face: KeyhiveProvider | null;
  vesselVerifyingKey: string;
}): CapabilityVerifier {
  return {
    async verify(args) {
      if (!face || !face.docIdOfBag(args.bagUrl)) return vessel.verify(args);
      const presenter = bareId(args.presenter) === bareId(vesselVerifyingKey)
        ? await face.vesselIdentifierHex()
        : args.presenter;
      return face.verify({ ...args, presenter });
    },
  };
}
