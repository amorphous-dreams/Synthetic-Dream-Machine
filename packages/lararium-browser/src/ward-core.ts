/**
 * ward-core — THE PURE CORE OF ONE BROWSER WARD ACT (seat-harness#/the-ward), run inside a per-act worker the page terminates.
 *
 * The act receives the keystore's slot tree and the face root's sealed row as raw bytes (no key rides them), the passphrase the
 * person typed for this act, and the bytes to sign. It opens the tree key FRESH from that passphrase through noble's scrypt (the
 * minted KDF port), opens the root row under it, signs once, and zero-fills the tree key, the seed and the passphrase's bytes. The
 * page's own unlock never takes part: the page's held key is not read, and the page's `unlocked` map never changes. What leaves is
 * the root's public key and the one signature, and nothing else; a refusal leaves by name and carries no byte of a credential.
 *
 * A passkey never opens a ward: a tree that carries a passkey pin refuses `ward-passkey-refused` before any derivation.
 */
import { decodeSlotTree, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, nobleKdf, openSealedCarrier, openWardKey, signingSeedFromHex, WardRefused, type CustodyIo, type KdfPort } from "@lararium/mesh";

/** What a ward act takes: raw bytes and one typed route, never a key. */
export interface WardActRequest {
  readonly tree: Uint8Array;
  readonly sealedRoot: Uint8Array;
  /** The keystore carrier name the root row rests under (`browser-keystore/persona-root-h<N>`), bound by its AEAD. */
  readonly carrier: string;
  readonly passphrase: string;
  readonly bytes: Uint8Array;
}

/** What a ward act answers: the root's public key and one signature, or the refusal's name. */
export type WardActAnswer = { readonly key: string; readonly signature: string } | { readonly refused: string };

export async function runWardAct(req: WardActRequest, kdf: KdfPort = nobleKdf): Promise<WardActAnswer> {
  try {
    const reading = decodeSlotTree(req.tree);
    if (reading.reading !== "readable") return { refused: "ward-tree-unreadable" };
    const opened = await openWardKey(reading.tree, [{ kind: "passphrase", passphrase: req.passphrase }], kdf);
    if (opened.reading !== "opens") return { refused: "ward-no-slot-opens" };
    let seed: Uint8Array | null = null;
    try {
      // The row's bytes ride in whole; a read-only port hands them to the one sealed reader, which checks the carrier's AEAD.
      const io = { read: async () => req.sealedRoot } as unknown as CustodyIo;
      const reading = await openSealedCarrier({ io, treeKey: opened.treeKey, carrier: { name: req.carrier, path: "ward-act" } });
      if (reading.reading !== "opens") return { refused: "ward-root-unopenable" };
      const root = reading.plaintext;
      try {
        const record = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(root)) as { signingKey?: unknown };
        if (typeof record.signingKey !== "string") return { refused: "ward-root-unopenable" };
        seed = signingSeedFromHex(record.signingKey);
      } finally { root.fill(0); }
      const key = await ed25519VerifyingKeyFromSeed(seed);
      const signature = await ed25519SignerFromSeed(seed)(req.bytes);
      return { key, signature };
    } finally { opened.treeKey.fill(0); seed?.fill(0); }
  } catch (e) {
    return { refused: e instanceof WardRefused ? e.reading : "ward-act-failed" };
  }
}
