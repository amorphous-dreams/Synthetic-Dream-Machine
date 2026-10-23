/** Presence moves on causal message rounds; transport closure can remove it immediately. */
export interface Presence { readonly actorKey: string; readonly beat: number; readonly state: unknown }
export type PresenceMessage = Presence | { readonly actorKey: string; readonly gone: true };
interface Held { portId: string; value: Presence; lastBeatRound: number }
export class PresenceTracker {
  private round = 0;
  private readonly held = new Map<string, Held>();
  private readonly retiredPorts = new Set<string>();
  private readonly listeners = new Set<(message: PresenceMessage) => void>();
  constructor(readonly lapseRounds = 30) {
    if (!Number.isInteger(lapseRounds) || lapseRounds < 0) throw new RangeError("lapseRounds");
  }
  subscribe(listener: (message: PresenceMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private emit(message: PresenceMessage): void { for (const listener of this.listeners) listener(message); }
  private remove(actorKey: string): void {
    if (this.held.delete(actorKey)) this.emit({ actorKey, gone: true });
  }
  update(portId: string, presence: Presence): boolean {
    this.round++;
    if (this.retiredPorts.has(portId)) return false;
    for (const [actorKey, entry] of this.held) {
      if (this.round - entry.lastBeatRound > this.lapseRounds) this.remove(actorKey);
    }
    const old = this.held.get(presence.actorKey);
    if (old && old.portId !== portId) return false;
    if (old && presence.beat < old.value.beat) return false;
    this.held.set(presence.actorKey, { portId, value: presence, lastBeatRound: this.round });
    this.emit(presence);
    return true;
  }
  close(portId: string): void {
    for (const [actorKey, entry] of this.held) if (entry.portId === portId) this.remove(actorKey);
    this.retiredPorts.delete(portId);
  }
  transportGone(portId: string): void { this.close(portId); }
  /** A fresh open starts a new generation of a reusable transport id. */
  open(portId: string): void { this.retiredPorts.delete(portId); }
  /** A newer open of the same actor supersedes the port; the newcomer sends its state afresh. */
  supersede(actorKey: string, _newPortId: string): void {
    const old = this.held.get(actorKey);
    if (old) this.retiredPorts.add(old.portId);
    this.remove(actorKey);
  }
  snapshotFor(_newcomer: string): Presence[] { return [...this.held.values()].map(entry => entry.value); }
}
