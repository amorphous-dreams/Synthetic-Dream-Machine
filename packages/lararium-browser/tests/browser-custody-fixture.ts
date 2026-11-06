import { readBrowserCustody, sealBrowserKeystore } from "../src/browser-custody.js";

/** Give a fresh test vessel a synthetic slot before its first persona-root mint. */
export async function bindSyntheticBrowserCustodySlot(idbName: string): Promise<void> {
  if ((await readBrowserCustody(idbName)).reading === "clear") {
    await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: "browser fixture custody slot" });
  }
}

/** The ward route a test face is born under, and the dialog that answers it for one ward act (seat-harness#/the-ward). */
export const FIXTURE_WARD_PASSPHRASE = "browser fixture ward route";
export const FIXTURE_WARD = { kind: "passphrase", passphrase: FIXTURE_WARD_PASSPHRASE } as const;
export const fixtureWardDialog = async (_act: string): Promise<string> => FIXTURE_WARD_PASSPHRASE;

/**
 * A test-only watch over every 32-byte Uint8Array the code under test builds by length (a Proxy on the global constructor; product code holds
 * no handle on it). `standing(seed)` names the recorded buffers that still read as `seed`: a secret an act left un-zeroed.
 */
export function watchByteBuffers(): { stop(): void; standing(seed: Uint8Array): number } {
  const Original = globalThis.Uint8Array;
  const recorded: Uint8Array[] = [];
  const spy = new Proxy(Original, {
    construct(target, args, newTarget) {
      const made = Reflect.construct(target, args, newTarget === spy ? target : newTarget) as Uint8Array;
      // Only a buffer built at the seed's own size by length (`new Uint8Array(32)`, how `hexToBytes` builds a loaded seed) rests with
      // the act that loaded it; a copy @noble keeps inside its own signing call (its concats) belongs to that library, and the watch skips a build whose stack names it.
      if (args.length === 1 && args[0] === 32 && !/noble/.test(new Error().stack ?? "")) recorded.push(made);
      return made;
    },
  });
  globalThis.Uint8Array = spy;
  return {
    stop() { globalThis.Uint8Array = Original; },
    standing(seed) {
      const want = Array.from(seed).join(",");
      return recorded.filter((b) => b.length === seed.length && Array.from(b).join(",") === want).length;
    },
  };
}
