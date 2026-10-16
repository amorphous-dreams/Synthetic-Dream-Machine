/**
 * who-face — announce onto the per-Nexus WHO board, and register the crossroads plane in the oracle.
 *
 * The WHO board's address DERIVES from the Nexus key (`whoBoardDocUrl`): every reader and the cap compute
 * it, and no crossroads tiddler points at it, so a peer-writable doc never steers where the board lives.
 * This file holds the card↔doc announce (handle-announce) and the oracle's crossroads registration.
 *
 * The board carries NO write-ACL, by design: a handle-card is self-certifying (valid only if signed by its
 * own nym), so an openly-appendable board stays trustworthy — forgery is structurally impossible, and a
 * recogniser's acceptHandleUpdate vets every card. Trust rides the card, never a per-writer capability (the
 * Nostr-relay model: validity lives in the signature). "Public" grants an anonymous principal read; the gate
 * still holds (pull ≠ read) — a garbage or unsigned tiddler is simply ignored at ingest.
 *
 * Pure and platform-blind: the caller supplies the repo `resolve` strategy (node races whenReady, browser
 * reads progress through `findWithProgress`, since `allowableStates` no longer has any effect),
 * exactly as resolveOracleDoc already splits. Holds no key, mounts no HTTP.
 *
 * Canon: lar:///ha.ka.ba/lararium/docs/crossroads (the public plane); persona-circle#the-vault (the WHO model).
 */
import type { Repo, DocHandle, AutomergeUrl } from "@automerge/automerge-repo";
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { CROSSROADS_DOC_URI } from "./lar-uris.js";
import { writeHandleAnnounce } from "./handle-announce.js";
import { crossroadsDocUrl, materializeSharedLarDoc } from "./deterministic-doc.js";
import type { HandleCard } from "./handle-card.js";
import { storedLarRecord } from "./stored-record.js";

/**
 * Announce a card onto a resolved WHO board. Each semantic act receives its own key, so concurrent
 * publications remain available to a recogniser's local causal fold.
 */
export function announceToWhoFace(whoFaceHandle: DocHandle<LarDoc>, card: HandleCard): void {
  whoFaceHandle.change((d) => writeHandleAnnounce(d, card));
}

/**
 * Register the per-Nexus crossroads (the public oracle plane) into the oracle plane — the public-infra pointer plane,
 * alongside the lares/lararium system-bag pointers. ISOMORPHIC: node and browser boots both call this so a
 * vessel's TW5 kernel resolves the crossroads plane the same well-known-tiddler way (sovereign-kernel). A RUNTIME write,
 * not genesis-seeded like the static system bags — the crossroads plane is per-Nexus, so its address is known only once
 * the vessel holds its confederation key (the node's own gate key; a browser leaf's admitted island). Idempotent:
 * every island member writes the same deterministic url, so re-registration never diverges. Returns the url.
 */
export async function registerCrossroadsInOracle(
  repo: Repo,
  oracleHandle: DocHandle<LarDoc>,
  nexusPubkey: string,
): Promise<AutomergeUrl> {
  const url = crossroadsDocUrl(nexusPubkey);
  await materializeSharedLarDoc(repo, url, "board:crossroads");
  if (tiddlerText(oracleHandle.doc()?.tiddlers?.[CROSSROADS_DOC_URI]) !== url) {
    oracleHandle.change((doc) => {
      doc.tiddlers[CROSSROADS_DOC_URI] = storedLarRecord(CROSSROADS_DOC_URI, { text: url }, "vessel-boot");
    });
  }
  return url;
}
