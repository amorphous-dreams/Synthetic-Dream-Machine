/**
 * browser-floor-read — the browser reads the Nexus's floor off its hearth's porch, and verifies every step itself.
 *
 * The browser holds the Nexus AID on its own trust line (the hearth floor card the arrival URL carried, or the admit that made
 * it a member) and nothing else. It fetches `GET <hearth>/floor/<AID>` (the release rows the board carries, each with the
 * charter's epoch lineage) and the head's blobs by CID from `<hearth>/cas/<cid>`, and `readFloorAnswer` refuses at each
 * step before the floor is used: the genesis epoch must re-derive the AID, each epoch step must verify, each release must
 * seal as a seat of ITS epoch and carry the cabal's approval over the manifest's exact bytes, and every fetched blob must hash
 * to the CID it was fetched by.
 *
 * It records NO acceptance. The browser's running floor stays the genesis floor it booted on; a face accepts a release by a
 * person's own act (the face's D row, road `W26`), on top of this read.
 *
 * WHERE THE AID COMES FROM. The Nexus the page reads under is the one a VERIFIED floor pin claim names (the card's claim,
 * anchored apart from the card and folded to its KEL head) or the one an admit made it a member of: no unsigned card
 * names it. A porch that answers nothing reads "as of my last sync" when the pair index holds a claim for the hearth: the head
 * it last accepted (`lastSyncNote`).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-slices
 */
import { NEXUS_AID_PATTERN, lastSyncNote, nexusAidOfPin, readFloorAnswer, type FloorRead, type PlaceClaimStand } from "@lararium/mesh";

export type HearthFloorRead =
  | FloorRead
  | { readonly ok: false; readonly reason: "no-nexus" | "porch-silent"; readonly detail?: string; readonly refused: readonly [] };

/** The Nexus AID a pin-spelled Nexus (hex of the AID's UTF-8) names, or null where it reads as no AID. */
export function floorNexusOf(pinNexus: string | null | undefined): string | null {
  if (!pinNexus) return null;
  const aid = nexusAidOfPin({ nexus: pinNexus });
  return aid !== null && NEXUS_AID_PATTERN.test(aid) ? aid : null;
}

/** The http(s) origin a hearth answers its porch on, from the URL a page or a relay names it by (`ws(s)` reads as `http(s)`). */
export function porchOriginOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol === "https:" || u.protocol === "wss:") return `https://${u.host}`;
    if (u.protocol === "http:" || u.protocol === "ws:") return `http://${u.host}`;
    return null;
  } catch { return null; }
}

/** Read the floor off the porch at `baseUrl`, under the Nexus the page holds (`nexusPin`, pin-spelled). Never throws. */
export async function readHearthFloor(args: {
  readonly baseUrl:   string;
  readonly nexusPin:  string | null | undefined;
  readonly fetchFn?:  typeof fetch;
  /** The claim head the page last accepted for this hearth's flow route; an offline answer names it. */
  readonly held?:     PlaceClaimStand | null;
}): Promise<HearthFloorRead> {
  const nexus = floorNexusOf(args.nexusPin);
  const origin = porchOriginOf(args.baseUrl);
  if (nexus === null || origin === null) {
    return { ok: false, reason: "no-nexus", detail: "no Nexus AID is known for this hearth: the URL carries no floor card, and no face joined here names one", refused: [] };
  }
  const doFetch = args.fetchFn ?? globalThis.fetch.bind(globalThis);
  let answer: unknown;
  try {
    const res = await doFetch(`${origin}/floor/${nexus}`);
    if (!res.ok) return { ok: false, reason: "porch-silent", detail: `the porch answered ${res.status}; ${lastSyncNote(args.held ?? null)}`, refused: [] };
    answer = await res.json();
  } catch (err) {
    return { ok: false, reason: "porch-silent", detail: `${err instanceof Error ? err.message : String(err)}; ${lastSyncNote(args.held ?? null)}`, refused: [] };
  }
  return readFloorAnswer({
    nexus, answer,
    fetchCas: async (cid) => {
      const res = await doFetch(`${origin}/cas/${cid}`);
      return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    },
  });
}
