import type { IdentityAnchors, JoinedFaceAuth } from "@lararium/mesh";

type FaceAnchor = JoinedFaceAuth["faceAnchor"];
type Chain = JoinedFaceAuth["personaKel"]["chain"];

/** The local reads required to build each unlocked sibling's independent gate input. */
export interface JoinedFaceAuthPorts {
  readonly ordinals: () => readonly number[];
  readonly mounted: number;
  readonly unlocked: (ordinal: number) => Promise<boolean>;
  readonly anchors: (ordinal: number) => Promise<IdentityAnchors | null>;
  readonly anchor: (group: string) => Promise<FaceAnchor | null>;
  readonly chain: (prefix: string) => Promise<Chain | null>;
  readonly atomSeed: (group: string) => Promise<Uint8Array | null>;
  readonly atomKey: (seed: Uint8Array, group: string) => string;
  readonly addressSecret: (group: string) => Promise<Uint8Array | null>;
  readonly veilArchive: (group: string) => Promise<Uint8Array | null>;
  readonly registerBags: (group: string) => readonly string[];
  readonly log: (line: string) => void;
}

/** A torn sibling cannot take the mounted face's boot down. */
export async function joinedFaceAuth(ports: JoinedFaceAuthPorts): Promise<JoinedFaceAuth[]> {
  const result: JoinedFaceAuth[] = [];
  for (const ordinal of ports.ordinals()) {
    if (ordinal === ports.mounted) continue;
    let seed: Uint8Array | null = null;
    let secret: Uint8Array | null = null;
    try {
      if (!await ports.unlocked(ordinal)) continue;
      const pins = await ports.anchors(ordinal);
      if (!pins?.personaGroupId || !pins.signerDid || !pins.personaKelPrefix || !pins.deviceEdge) throw new Error("identity anchors missing");
      const group = pins.personaGroupId;
      const anchor = await ports.anchor(group);
      const chain = await ports.chain(pins.personaKelPrefix);
      seed = await ports.atomSeed(group);
      if (!anchor || !chain?.length || !seed) throw new Error("face anchor, KEL chain, or atom missing");
      const key = ports.atomKey(seed, group);
      if (key !== pins.deviceEdge.deviceVerifyingKey) throw new Error("atom differs from device edge");
      secret = await ports.addressSecret(group);
      const archive = await ports.veilArchive(group);
      result.push({ atom: { seed: Buffer.from(seed).toString("hex"), key }, personaGroupId: group, faceAnchor: anchor,
        personaKel: { prefix: pins.personaKelPrefix, chain }, deviceEdge: pins.deviceEdge, signerDid: pins.signerDid,
        ...(pins.meshCabalDocIdHex ? { meshCabalDocIdHex: pins.meshCabalDocIdHex } : {}),
        ...(secret ? { faceAddressSecret: Buffer.from(secret).toString("hex") } : {}),
        ...(archive ? { veilArchiveBytes: archive } : {}), registerBags: [...ports.registerBags(group)] });
    } catch (e) {
      ports.log(`joined face h${ordinal} skipped: ${e instanceof Error ? e.message : String(e)}`);
    } finally { seed?.fill(0); secret?.fill(0); }
  }
  return result;
}
