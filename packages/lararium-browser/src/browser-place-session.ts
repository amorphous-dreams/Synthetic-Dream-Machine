/**
 * browser-place-session — the worn face's PLACE SESSION on a self-founded browser: the face's atom presented to the place
 * KEL this browser armed at its founding, no Nexus admit (session-contract#/the-hands). The node mints the same session
 * (`placeSessionCell` + `preparePlaceFace`); this file ports its mint to the browser's own custody rows.
 *
 * WHO LIFTS AT ITS PLACE (`browserLiftsAtPlace`): a face this browser founded (it holds the face's PersonaGroup root), proved
 * at boot, joined to no hearth, on a browser whose place KEL stands. A device joined to ANOTHER's face holds no root of that
 * face and stays at its floor until a hearth admits it (operator ruling, 2026-10-16); a joined face lifts through its Nexus
 * presentation instead.
 *
 * THE KEYS STAY ON THE VESSEL'S THREAD: the atom's seed reads afresh from its custody row at the mint and zero-fills after
 * the one certificate it signs; the session key lives in the signer alone, and the island receives signatures, never a key.
 * A lock drops the signer and closes its table, so a later save waits in memory and nothing rests clear.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store · lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { preparePlaceFace, signAsFaceAtom, SessionTable, sessionBinding, type BookedSessionSigner } from "@lararium/mesh";
import { loadBrowserPlaceKel } from "./browser-vessel-identity.js";
import { requireBrowserFaceAtomSeed } from "./browser-face-atom.js";
import type { BrowserUnlockedSession } from "./browser-island-caps.js";

/** What decides whether a browser's worn face lifts at its own place. */
export interface PlaceLiftReading {
  /** A joined face's Nexus presentation stands (it lifts through that instead). */
  readonly presented: boolean;
  /** The worn face rides a hearth's admit or dial: another's face, or one a hearth vouched. */
  readonly joined: boolean;
  /** This browser holds the worn face's PersonaGroup root: it founded that face. */
  readonly rootHeld: boolean;
  /** The worn face's plane passed its face proof at this boot. */
  readonly proved: boolean;
  /** This browser's place KEL stands (its founding armed one through the cold card). */
  readonly placeStands: boolean;
}

/** A self-founded, unjoined, proved face on a browser whose place stands lifts at its place; every other reading stays put. */
export function browserLiftsAtPlace(r: PlaceLiftReading): boolean {
  return !r.presented && !r.joined && r.rootHeld && r.proved && r.placeStands;
}

/** One minted place session: the session a lift stands on, and its table's close (the lock runs it after the drop). */
export interface BrowserPlaceSession {
  readonly session: BrowserUnlockedSession;
  readonly close: () => void;
}

/** Mint the worn face's place session over this browser's own place KEL and the face's atom row, or name why none stands. */
export async function mintBrowserPlaceSession(args: { readonly idbName: string; readonly personaGroup: string; readonly atomKey: string }):
  Promise<BrowserPlaceSession | { readonly refusal: string }> {
  const readHead = async () => {
    const kel = await loadBrowserPlaceKel(args.idbName);
    if (kel === null || !kel.ok) throw new Error("place-unfounded: this browser holds no place KEL");
    return kel;
  };
  let kel;
  try { kel = await readHead(); } catch { return { refusal: "place-unfounded" }; }
  const target = preparePlaceFace({
    personaGroup: args.personaGroup, atomKey: args.atomKey,
    place: { place: kel.aid, seq: kel.seq, head: kel.headDigest },
    // The signer reads the place's head at each signature against the head this face bound: a rotation drops it.
    anchorHead: async () => (await readHead()).headDigest,
    signAsAtom: async (image) => {
      const seed = await requireBrowserFaceAtomSeed(args.idbName, args.personaGroup);
      try { return await signAsFaceAtom(seed, image); } finally { seed.fill(0); }
    },
  });
  if (!("face" in target)) return { refusal: target.refusal };
  const table = new SessionTable(`browser-place-${globalThis.crypto.randomUUID()}`);
  const binding = sessionBinding("socket");
  const opened = table.open(binding, target.face, "face");
  if (!opened.ok) return { refusal: opened.refusal };
  const close = (): void => { table.close(opened.session.sessionId); };
  const minted = await target.mint({ table, binding, session: opened.session });
  if (!("signer" in minted)) { close(); return { refusal: "refusal" in minted ? String(minted.refusal) : "mint-refused" }; }
  return {
    session: {
      signer: minted.signer as unknown as BookedSessionSigner,
      chain: { place: Object.freeze({ atomKey: target.scope.atomKey, place: target.scope.place }) },
    },
    close,
  };
}
