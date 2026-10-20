/** Assemble a holder from platform doors; each face house receives one private store. */
import { attachGatedPeer } from "./gated-peer.js";
import { makeSharedHolderCore, type HolderIsland, type SharedHolderCore } from "./shared-holder-core.js";
import type { LockHost } from "./vessel-lock.js";

export interface HolderRuntimeEnvironment {
  readonly lockName: string;
  readonly locks: LockHost | null;
  readonly spawnIsland: (personaGroup: string, personaRoot: string, edgeDigest: string) => HolderIsland;
  readonly openRepo: (storeName: string) => {
    attachSide(port: MessagePort): void;
    shutdown(): Promise<void>;
  };
}

export function makeHolderRuntime(env: HolderRuntimeEnvironment): {
  core: SharedHolderCore;
  storeName(personaGroup: string, personaRoot: string): Promise<string>;
} {
  const waitingSessions = new Map<string, () => void>();
  const storeName = async (personaGroup: string, personaRoot: string): Promise<string> => {
    const bytes = new TextEncoder().encode(`${personaGroup}|${personaRoot}`);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return `${env.lockName}:house:${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  };
  const core = makeSharedHolderCore({
    lockName: env.lockName,
    locks: env.locks,
    watchSession: env.locks ? (sessionId, onDead) => { waitingSessions.set(sessionId, onDead); } : undefined,
    armSession: env.locks ? (sessionId) => {
      const onDead = waitingSessions.get(sessionId);
      if (!onDead) return;
      waitingSessions.delete(sessionId);
      // A queued request grants only after the tab lets go of its lifetime lock.
      void env.locks!.request(`lares:holder-session:${sessionId}`, {}, () => { onDead(); }).catch(() => undefined);
    } : undefined,
    forgetSession: (sessionId) => { waitingSessions.delete(sessionId); },
    spawnIsland: env.spawnIsland,
    makeRepo: async (group, root) => {
      const repo = env.openRepo(await storeName(group, root));
      return {
        shutdown: () => repo.shutdown(),
        attachPeer: (port: MessagePort, serving?: Promise<void>, closed?: Promise<void>) => {
          if (closed) attachGatedPeer((side) => repo.attachSide(side), port, serving ?? Promise.resolve(), closed);
          else repo.attachSide(port);
        },
      };
    },
  });
  return { core, storeName };
}
