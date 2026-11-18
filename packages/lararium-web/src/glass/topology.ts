import { electLeader, type LockManagerLike } from "./leader.js";
import { makeFollowerDoors, serveFollowers, type Lend, type TabBus } from "./tab-bus.js";
import type { PortTransportDoors } from "../port-transport.js";

/**
 * THE TAB TOPOLOGY of one origin: one tab holds the vessel and leads; every other tab follows it over the bus and stands its own
 * mirror from the leader's lend. The leader lock queues succession: a follower whose request grants leads next, opens the vessel
 * itself and serves the rest through a second channel object, so its own follower doors re-hello to it and its mirror never tears
 * down. No clock decides a role: the lock grants, or the leader lends, and each names itself.
 */
export function standTabTopology(opts: { locks: LockManagerLike; lockName: string; channel: () => TabBus; tabId: string }) {
  const followerBus = opts.channel();
  const follower = makeFollowerDoors(followerBus, opts.tabId);
  const election = electLeader({ locks: opts.locks, name: opts.lockName });
  const leadListeners = new Set<() => void>();
  let role: "follower" | "leader" = "follower";
  let serving: ReturnType<typeof serveFollowers> | null = null;
  let serveBus: TabBus | null = null;
  let closed = false;
  election.onLeader(() => { if (closed) return; role = "leader"; for (const listener of leadListeners) listener(); });
  return {
    get role() { return role; },
    /** This tab's own follower doors: a port road to whichever tab leads, and the lend that road learns. */
    follower,
    onLead(cb: () => void) { leadListeners.add(cb); if (role === "leader") cb(); return () => leadListeners.delete(cb); },
    /** The leader half, once this tab's vessel stands: serve the origin's other tabs through a second channel object. */
    serve(doors: PortTransportDoors, lend: () => Lend | null | Promise<Lend | null>) {
      serving?.close(); serveBus?.close();
      serveBus = opts.channel();
      serving = serveFollowers(serveBus, doors, lend);
      return serving;
    },
    /** The leader lends now: answer the hellos that parked before its surface stood. */
    lend() { serving?.lend(); },
    onPortMessage(binding: string, islandKey: string, msg: unknown) { serving?.onPortMessage(binding, islandKey, msg); },
    close() {
      if (closed) return;
      closed = true;
      serving?.close(); serveBus?.close();
      follower.dispose(); followerBus.close();
      election.stepDown();
    },
  };
}
