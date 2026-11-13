import { readBrowserCustody, sealBrowserKeystore } from "../src/browser-custody.js";
import { heldUnnamedFace, standUnnamedFace } from "../src/browser-face-custody.js";
import { wearFaceOfVessel } from "../src/browser-vessel-identity.js";

const ROUTE = { kind: "passphrase", passphrase: "browser fixture custody slot" } as const;

/**
 * Give a fresh test vessel a synthetic place slot and an unnamed founder face's tree before its first persona-root mint, and
 * wear that face on this thread (the founding names it by its PersonaGroup later); each named group binds its own tree. Answers
 * the unnamed face's key.
 */
export async function bindSyntheticBrowserCustodySlot(idbName: string, ...groups: string[]): Promise<string> {
  if ((await readBrowserCustody(idbName)).reading === "clear") await sealBrowserKeystore(idbName, ROUTE);
  const face = heldUnnamedFace(idbName) ?? (await standUnnamedFace(idbName, ROUTE)).face;
  wearFaceOfVessel(idbName, face);
  // Each named PersonaGroup gets its own tree, as a join or a founding binds it before its first row.
  for (const group of groups) await bindSyntheticFace(idbName, group);
  return face;
}

/** Bind `group`'s own face tree under the fixture route where none stands (a join or an admit binds it before its first row). */
export async function bindSyntheticFace(idbName: string, group: string): Promise<void> {
  const { readFaceCustody, bindFirstFaceSlot, unlockFaceCustody } = await import("../src/browser-face-custody.js");
  const status = await readFaceCustody(idbName, group);
  if (status.reading === "absent") await bindFirstFaceSlot(idbName, group, ROUTE);
  else if (status.reading === "bound" && !status.unlocked) await unlockFaceCustody(idbName, group, [ROUTE]);
}

/** The PersonaGroup a founding named: the face the vessel wears on this thread once the ceremony named it, else the bootstrap's. */
export async function foundedGroupOf(idbName: string): Promise<string> {
  const { openVesselIdb, idbGet, faceOfVessel } = await import("../src/browser-vessel-identity.js");
  const worn = faceOfVessel(idbName);
  if (worn && !worn.startsWith("unnamed:")) return worn;
  const db = await openVesselIdb(idbName);
  try {
    const group = (await idbGet<{ personaGroupId?: string }>(db, "bootstrap", "social-bootstrap"))?.personaGroupId;
    if (!group) throw new Error("founding left no face atom");
    return group;
  } finally { db.close(); }
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
