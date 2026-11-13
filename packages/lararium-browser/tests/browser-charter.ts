/**
 * browser-charter — a one-seat charter a BROWSER test builds with noble alone (the shared charter fixture signs through
 * `node:crypto`, which the browser runner stubs). One seat per epoch, each epoch committing the next generation's key, so a
 * lineage of any length rolls lawfully. Deterministic: seeds derive from (family, generation).
 */
import * as ed from "@noble/ed25519";
import {
  charterInceptionBytes, charterInceptionImage, genesisOfInception, hex, mintCharterEpoch, rotateSealEpoch, seatNextDigest,
  sealKeySetHash, sealRollBytes, sha256HexBytesSync, type SealEpoch, type SealRollSigner,
} from "@lararium/mesh";

const seedOf = (family: number, generation: number): Uint8Array => {
  const out = new Uint8Array(32);
  out.set(new TextEncoder().encode(`browser-charter|${family}|${generation}`).slice(0, 32));
  out[31] = family; out[30] = generation;
  return Uint8Array.from(out, (b, i) => (b + i * 7) & 0xff);
};
const keyOf = async (family: number, generation: number): Promise<string> => hex(await ed.getPublicKeyAsync(seedOf(family, generation)));
const handOf = async (family: number, generation: number): Promise<SealRollSigner> => {
  const seed = seedOf(family, generation);
  return { signer: await keyOf(family, generation), sign: (bytes) => ed.signAsync(bytes, seed).then(hex) };
};

export interface OneSeat {
  readonly chain: readonly SealEpoch[];
  readonly aid:   string;
  readonly head:  SealEpoch;
  /** The hand of the epoch's single seat (generation 0 is the genesis's). */
  readonly handOf: (generation: number) => Promise<SealRollSigner>;
  readonly family: number;
}

/** A one-seat charter rolled `rolls` times. */
export async function oneSeatCharter(family: number, rolls: number): Promise<OneSeat> {
  const k0 = await keyOf(family, 0), k1 = await keyOf(family, 1);
  const image = charterInceptionImage([k0], 1, { digests: [seatNextDigest(k1)], threshold: 1 }, null);
  const bytes = charterInceptionBytes(image);
  const genesis = genesisOfInception(image, [{ signer: k0, sig: hex(await ed.signAsync(bytes, seedOf(family, 0))) }]);
  const chain: SealEpoch[] = [genesis];
  for (let g = 1; g <= rolls; g++) {
    const head = chain[chain.length - 1]!;
    const seat = { keys: [await keyOf(family, g)], threshold: 1 };
    const next = { digests: [seatNextDigest(await keyOf(family, g + 1))], threshold: 1 };
    const result = await rotateSealEpoch(head, seat, next, [await handOf(family, g)], chain.slice(0, -1), { keys: [await keyOf(family, g - 1)], threshold: 1 });
    if (!result.ok) throw new Error(`browser-charter: roll ${g} refused (${result.code})`);
    chain.push(result.epoch);
  }
  return { chain, aid: genesis.epochCid, head: chain[chain.length - 1]!, handOf: (g) => handOf(family, g), family };
}

/** A successor of `old` that no lawful roll writes: another family's seat signs it though `old` never committed that key. */
export async function uncommittedStep(old: OneSeat, strangerFamily: number): Promise<SealEpoch> {
  const key = await keyOf(strangerFamily, 0);
  const next = { digests: [seatNextDigest(await keyOf(strangerFamily, 1))], threshold: 1 };
  const parts = { predecessor: old.head.epochCid, keys: [key], threshold: 1, nextKeyDigests: next.digests, nextThreshold: 1 };
  const sig = hex(await ed.signAsync(sealRollBytes(parts), seedOf(strangerFamily, 0)));
  return mintCharterEpoch({ keySetHash: sealKeySetHash([key], 1), nextKeyDigests: [...next.digests], nextThreshold: 1, predecessors: [old.head.epochCid] },
    { keys: [key], threshold: 1, signatures: [{ signer: key, sig }], genesis: { keys: [await keyOf(old.family, 0)], threshold: 1 } });
}
export { sha256HexBytesSync };
