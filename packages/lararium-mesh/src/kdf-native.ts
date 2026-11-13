// The host's native scrypt as a KDF port — reachable only through `@lararium/mesh/node`, never from the barrel.
//
// It derives at the cost keyslot hands it and holds none of its own. Node refuses a derivation whose working set
// passes `maxmem` (default 32 MiB, under the 128 MiB this cost needs), so the limit derives from the cost received:
// twice the 128·N·r·p working set. A refusal rejects, and keyslot reads it as `kdf-refused`, never as a wrong
// passphrase and never by falling back to noble. Node runs the derivation on libuv's pool, off the event loop.
import { scrypt } from "node:crypto";
import { mintKdfPort, type KdfPort } from "./keyslot.js";

export const nativeKdf: KdfPort = mintKdfPort((password, salt, cost) => new Promise<Uint8Array>((resolve, reject) => {
  const maxmem = 2 * 128 * cost.N * cost.r * cost.p;
  scrypt(password, salt, cost.dkLen, { N: cost.N, r: cost.r, p: cost.p, maxmem }, (err, key) => {
    if (err) reject(err);
    else resolve(new Uint8Array(key.buffer, key.byteOffset, key.byteLength));
  });
}));
