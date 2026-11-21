import { deriveRegisterBags, litFaceOwnBags, type IdentityAnchors, type JoinedFaceAuth } from "@lararium/mesh";

type FaceAnchor = JoinedFaceAuth["faceAnchor"];
type Chain = JoinedFaceAuth["personaKel"]["chain"];

/** The local reads required to build each unlocked sibling's independent gate input. */
export interface JoinedFaceAuthPorts {
  readonly ordinals: () => readonly number[];
  readonly mounted: number;
  readonly current: (ordinal: number) => boolean;
  readonly unlocked: (ordinal: number) => Promise<boolean>;
  readonly anchors: (ordinal: number) => Promise<IdentityAnchors | null>;
  readonly anchor: (group: string) => Promise<FaceAnchor | null>;
  readonly chain: (prefix: string) => Promise<Chain | null>;
  readonly atomSeed: (group: string) => Promise<Uint8Array | null>;
  readonly atomKey: (seed: Uint8Array, group: string) => string;
  readonly addressSecret: (group: string) => Promise<Uint8Array | null>;
  readonly veilArchive: (group: string) => Promise<Uint8Array | null>;
  /** THE LIT SET: the face's relation, read off its own proved log (`faceRelationOf`); null where no proof names one. */
  readonly relation?: (group: string) => Promise<string | null>;
  readonly log: (line: string) => void;
}

/**
 * The served faces the composition still owes a light: every face the lend serves that is neither the daemon mount nor lit
 * beside it, in ordinal order. A face the pūlama lights after the composition stood joins the served set by the pūlama's
 * standing event; until it lights, the daemon island refuses its presenter (`no provider for face`). No mount lights nothing.
 */
export function unlitServedFaces(served: readonly number[], mount: number | null, lit: ReadonlySet<number>): number[] {
  if (mount === null) return [];
  return [...new Set(served)].filter((o) => o !== mount && !lit.has(o)).sort((a, b) => a - b);
}

/** A torn sibling cannot take the mounted face's boot down. A sibling receives the vessel ground and the bags it OWNS while lit
 *  (`litFaceOwnBags`: the daemon wiki's device slots, its daemon canon by its relation, its catalog half, its selves record), so its own memory seals
 *  under its own hive; its planes need their own face proof, and the mounted slot's user wiki bags and the house canon belong to
 *  the mounted face. Each entry names its handle index and relation, so a face-named wave finds it. */
export async function joinedFaceAuth(ports: JoinedFaceAuthPorts): Promise<JoinedFaceAuth[]> {
  // EACH FACE READS ON ITS OWN: no face's custody-backed reads wait behind another's; the answer keeps ordinal order.
  const each = await Promise.all(ports.ordinals().map((ordinal) => ordinal === ports.mounted ? Promise.resolve(null) : oneJoinedFace(ports, ordinal)));
  return each.filter((face): face is JoinedFaceAuth => face !== null);
}

/** One sibling's gate input, or null where it stands shut, moved, or reads torn (the log names it). */
async function oneJoinedFace(ports: JoinedFaceAuthPorts, ordinal: number): Promise<JoinedFaceAuth | null> {
  {
    let seed: Uint8Array | null = null;
    let secret: Uint8Array | null = null;
    try {
      if (!ports.current(ordinal)) return null;
      if (!await ports.unlocked(ordinal) || !ports.current(ordinal)) return null;
      const pins = await ports.anchors(ordinal);
      if (!ports.current(ordinal)) return null;
      if (!pins?.personaGroupId || !pins.signerDid || !pins.personaKelPrefix || !pins.deviceEdge) throw new Error("identity anchors missing");
      const group = pins.personaGroupId;
      const anchor = await ports.anchor(group);
      if (!ports.current(ordinal)) return null;
      const chain = await ports.chain(pins.personaKelPrefix);
      if (!ports.current(ordinal)) return null;
      seed = await ports.atomSeed(group);
      if (!ports.current(ordinal)) return null;
      if (!anchor || !chain?.length || !seed) throw new Error("face anchor, KEL chain, or atom missing");
      const key = ports.atomKey(seed, group);
      if (key !== pins.deviceEdge.deviceVerifyingKey) throw new Error("atom differs from device edge");
      secret = await ports.addressSecret(group);
      if (!ports.current(ordinal)) return null;
      const archive = await ports.veilArchive(group);
      if (!ports.current(ordinal)) return null;
      const relation = (await ports.relation?.(group)) ?? null;
      if (!ports.current(ordinal)) return null;
      return { atom: { seed: Buffer.from(seed).toString("hex"), key }, personaGroupId: group, faceAnchor: anchor, handleIndex: ordinal,
        ...(relation ? { faceRelation: relation } : {}),
        personaKel: { prefix: pins.personaKelPrefix, chain }, deviceEdge: pins.deviceEdge, signerDid: pins.signerDid,
        ...(pins.meshCabalDocIdHex ? { meshCabalDocIdHex: pins.meshCabalDocIdHex } : {}),
        ...(secret ? { faceAddressSecret: Buffer.from(secret).toString("hex") } : {}),
        ...(archive ? { veilArchiveBytes: archive } : {}), registerBags: deriveRegisterBags({ fleets: [], wikiBags: litFaceOwnBags(relation, group) }) };
    } catch (e) {
      ports.log(`joined face h${ordinal} skipped: ${e instanceof Error ? e.message : String(e)}`);
    } finally { seed?.fill(0); secret?.fill(0); }
  }
  return null;
}
