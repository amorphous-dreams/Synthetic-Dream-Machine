/**
 * handle-owner-fixture — seat a persona's SEALED ANCHOR and a verified persona-KEL chain, the two things a Handle act reads its
 * owner from (K15-H). `sealOwnerFace` mints a real inception under the persona root at `handleIndex`, keeps the face-anchor row
 * under a PersonaGroup the identity anchors name, and returns the per-Nexus KEL board the chain rides on.
 */
import * as ed25519 from "@noble/ed25519";
import {
  mintPersonaInception, mintFaceAnchor, writePersonaKelEvent, type LarDoc, type PersonaKelEvent,
} from "@lararium/mesh";
import { generateOrLoadBrowserPersonaRoot, loadBrowserPersonaRootSeed, makeBrowserIdbPersonaVault } from "../src/browser-vessel-identity.js";
import { keepBrowserFaceAnchor } from "../src/browser-face-anchor.js";

const hexOf = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** A KEL board whose doc() returns ONE document, so a written event stays. */
export function stableBoard(): { doc(): LarDoc } {
  const d = { tiddlers: {} } as LarDoc;
  return { doc: () => d };
}

export interface SealedOwnerFace {
  readonly prefix: string;
  readonly group: string;
  readonly kelBoard: { doc(): LarDoc };
  readonly inception: PersonaKelEvent;
}

/** Seat persona `handleIndex`: its root, its identity anchors row, its sealed face-anchor row, and a KEL inception on `kelBoard`. */
export async function sealOwnerFace(
  idbName: string, handleIndex: number, kelBoard: { doc(): LarDoc } = stableBoard(),
): Promise<SealedOwnerFace> {
  await generateOrLoadBrowserPersonaRoot(idbName, handleIndex);
  const did = "0x" + hexOf(await ed25519.getPublicKeyAsync(await loadBrowserPersonaRootSeed(idbName, handleIndex)));
  const inception = mintPersonaInception(did, "recovery-" + handleIndex.toString(16).padStart(2, "0").repeat(30));
  const group = `group-h${handleIndex}`;
  const vault = await makeBrowserIdbPersonaVault(idbName);
  vault.anchors.save(handleIndex, { personaGroupId: group, meshCabalDocIdHex: "00" });
  // the vault's write-through is fire-and-forget: read until a fresh vault sees the row (a causal read, no clock)
  while (!(await (await makeBrowserIdbPersonaVault(idbName)).anchors.load(handleIndex))) await Promise.resolve();
  await keepBrowserFaceAnchor(idbName, mintFaceAnchor({ personaGroup: group, personaKelPrefix: inception.prefix, personaRootDid: did, edge: { h: handleIndex }, leaseEpoch: 0 }));
  writePersonaKelEvent(kelBoard.doc(), inception);
  return { prefix: inception.prefix, group, kelBoard, inception };
}
