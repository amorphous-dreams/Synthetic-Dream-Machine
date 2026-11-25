/**
 * island-wear — THE DAEMON ISLAND'S ACTOR DOOR: the island's own Repo writes a worn face's change under an actor the
 * vessel derives, and asks the vessel for it.
 *
 * The derivation's secrets (each face scope's secret, the composition's salt) rest with the vessel's wire identity
 * (`WireIdentity.actor`), and the island holds none. So the island asks (`daemon:wear-actor-request`) and the vessel
 * answers the actor alone (`daemon:wear-actor-result`). The island names its own REPLICA, minted at its boot, so the
 * actor it writes under is its own: the vessel's Repo and the island's never hand one actor's sequence out twice, and an
 * island that boots again writes under fresh actors. Each (face, document) settles once for the island's life.
 */
import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import { type DaemonMsg_WearActorRequest, type DaemonMsg_WearActorResult } from "@lararium/mesh/island-protocol";
import { type FaceActorDoor } from "@lararium/mesh/automerge-doc-store";

export interface IslandWearDoor {
  /** The door the island Repo seats (`seatRepoWear`): every store over its documents writes a worn face's change through it. */
  readonly door: FaceActorDoor;
  /** Settle the ask a vessel's answer names. False for an answer to no ask this door holds. */
  answer(msg: DaemonMsg_WearActorResult): boolean;
}

export function makeIslandWearDoor(post: (msg: DaemonMsg_WearActorRequest) => void): IslandWearDoor {
  const replica = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  const asks = new Map<string, { resolve: (actor: string) => void; reject: (error: Error) => void }>();
  const settled = new Map<string, Promise<string>>();
  let seq = 0;
  const door: FaceActorDoor = {
    actor: (face, documentId) => {
      const name = `${face ?? ""}\n${documentId}`;
      let reading = settled.get(name);
      if (reading === undefined) {
        const requestId = `wear-${replica.slice(0, 8)}-${++seq}`;
        reading = new Promise<string>((resolve, reject) => { asks.set(requestId, { resolve, reject }); });
        // A refusal settles nothing for good: the next write asks again.
        reading.catch(() => { if (settled.get(name) === reading) settled.delete(name); });
        settled.set(name, reading);
        post({ type: "daemon:wear-actor-request", requestId, face, documentId, replica });
      }
      return reading;
    },
  };
  return {
    door,
    answer: (msg) => {
      const ask = asks.get(msg.requestId);
      if (!ask) return false;
      asks.delete(msg.requestId);
      if (typeof msg.actor === "string" && msg.actor !== "") ask.resolve(msg.actor);
      else {
        const reason = msg.refusal ?? "worn-face-unwritable";
        ask.reject(new VerbRefusal(reason, `${reason}: the vessel derived no actor for the island's write under its worn face`));
      }
      return true;
    },
  };
}
