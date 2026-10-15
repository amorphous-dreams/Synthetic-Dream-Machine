/**
 * local-persona-kel — THIS vessel's local persona-KEL board replica, read and seated: one face's chain, every event
 * under a prefix, a carried chain seated on a restore, and a KEL's head with its sequence off one read.
 *
 * The persona admission's airgapped hops once lived beside these readers; `lares fleet join` took that door, and
 * the readers stayed for the restore, the guardian enrolment, the boot's bundle cut and the KEL-head door.
 */

import type { Repo } from "@automerge/automerge-repo";
import {
  headOpKey, personaKelChainForPrefix, personaKelEventsFromBoard, personaKelBoardDocUrl, materializeSharedLarDoc,
  writePersonaKelEvent, type LarDoc, type PersonaKelEvent,
} from "@lararium/mesh";
import { loadVesselVerifyingKey } from "./node-vessel-identity.js";
import { nodeNexusIsland } from "./nexus-standing.js";
import { resolveBootDoc } from "./repo-helpers.js";

/**
 * The address of THIS vessel's local persona-KEL board: the one place this module composes the resolved island, so
 * the board door (`personaKelBoardDocUrl`) stands at exactly ONE call site here. `repo`, below, names the store's
 * one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`).
 */
async function localPersonaKelBoardUrl() {
  const nexusPubkey = await loadVesselVerifyingKey();
  const boardIsland = nodeNexusIsland({ ownVesselKey: nexusPubkey });
  return personaKelBoardDocUrl(boardIsland);
}

async function localPersonaKelBoard(repo: Repo) {
  return materializeSharedLarDoc(repo, await localPersonaKelBoardUrl(), "board:persona-kel");
}

/**
 * One face's key event log as THIS vessel's local persona-KEL board holds it, inception first; empty where the
 * board holds no event under `prefix`. A face's backup bundle carries this log, and a restore reads it beside the
 * log a bundle carried (custody#/the-bundle). Reads the board; verifies nothing.
 */
export async function readLocalPersonaKelChain(repo: Repo, prefix: string): Promise<PersonaKelEvent[]> {
  const board = await localPersonaKelBoard(repo);
  return [...(personaKelChainForPrefix(board.doc(), prefix) ?? [])];
}

/**
 * EVERY event THIS vessel's local persona-KEL board holds under `prefix`, verified or not, in no order: what a
 * reader hands the one fold (`foldPersonaContests`), which judges each. Empty where the board holds none.
 */
export async function readLocalPersonaKelEvents(repo: Repo, prefix: string): Promise<PersonaKelEvent[]> {
  // A READ THAT WRITES NOTHING: a board this vessel never held reads as holding no event. `localPersonaKelBoard`
  // materializes a blank board where none stands, and a reader that only checks must leave the store as it found it.
  let doc: LarDoc | undefined;
  try { doc = (await resolveBootDoc<LarDoc>(repo, await localPersonaKelBoardUrl(), { tideline: "hearth-private", label: "board:persona-kel" })).doc(); }
  catch { return []; }
  return personaKelEventsFromBoard(doc).filter((event) => event.prefix === prefix);
}

/**
 * Seat a face's carried key history on THIS vessel's local persona-KEL board (a restore's re-admission). Every
 * event already stood on a board somewhere and verifies by itself, so the write adds no authority; an event the
 * board already holds lands as the same entry.
 */
export async function seatLocalPersonaKelChain(repo: Repo, events: readonly PersonaKelEvent[]): Promise<void> {
  const board = await localPersonaKelBoard(repo);
  board.change((draft) => { for (const event of events) writePersonaKelEvent(draft, event); });
}

/**
 * L11 — a persona KEL's CURRENT head op-key (the KEL's structure and rotation quorums verified) and that head
 * event's own sequence, off ONE board materialize, so the two can never straddle a sync. Both read null where the
 * prefix reads unknown or unsynced (fail-closed). The `persona-kel-head` store door answers through it.
 */
export async function makeLocalPersonaKelHeadAndSeqResolver(
  repo: Repo,
): Promise<(prefix: string) => Promise<{ head: string | null; seq: number | null }>> {
  const board = await localPersonaKelBoard(repo);
  return async (prefix: string): Promise<{ head: string | null; seq: number | null }> => {
    const chain = personaKelChainForPrefix(board.doc(), prefix);
    if (!chain || chain.length === 0) return { head: null, seq: null };
    const head = await headOpKey(chain, { verifyQuorums: true });
    if (!head) return { head: null, seq: null };
    for (let i = chain.length - 1; i >= 0; i--) {
      const e = chain[i]!;
      if (e.provisional) continue;
      if (e.opKeyDid === head) return { head, seq: e.seq };
    }
    return { head, seq: null };
  };
}
