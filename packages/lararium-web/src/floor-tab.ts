/**
 * The 2026-11-06 ruling gives every tab a live session. A lock chooses one owner per store; a follower opens its own session
 * over a brokered port. The broker hands ports and carries no vessel traffic.
 */
import type { PageLifeFeed } from "@lararium/browser/page";
import type { BrokerToPage, PageToBroker } from "./ceremony-protocol.js";

export interface FloorTabEnv {
  readonly locks: Pick<LockManager, "request">;
  readonly lockName: string;
  readonly tabSession: string;
  readonly broker: {
    post(msg: PageToBroker, transfer?: Transferable[]): void;
    listen(listener: (msg: BrokerToPage, ports: readonly MessagePort[]) => void): () => void;
  };
  readonly pageLife: PageLifeFeed;
  lead(): { mintPort(wantId: string, tabSession: string): Promise<MessagePort | null> };
  follow(port: MessagePort): void;
}

export function standFloorTab(env: FloorTabEnv) {
  let role: "asking" | "owner" | "claiming" | "follower" = "asking";
  let door: ReturnType<FloorTabEnv["lead"]> | null = null;
  env.broker.listen((msg, ports) => {
    if (msg.t === "vessel:want" && role === "owner" && door) {
      void door.mintPort(msg.claimId, msg.tabSession).then((port) => {
        if (port) env.broker.post({ t: "vessel:offer", claimId: msg.claimId }, [port]);
      });
    } else if (msg.t === "vessel:port" && role === "claiming" && msg.tabSession === env.tabSession && ports[0]) {
      role = "follower";
      env.follow(ports[0]);
    } else if (msg.t === "vessel:absent") console.warn("[floor-tab] vessel:absent", msg);
  });
  env.pageLife((life) => {
    if (life === "pagehide" && role === "claiming") env.broker.post({ t: "vessel:withdraw", tabSession: env.tabSession });
  });
  void env.locks.request(env.lockName, { ifAvailable: true }, async (lock) => {
    if (!lock) { role = "claiming"; env.broker.post({ t: "vessel:claim", tabSession: env.tabSession }); return; }
    role = "owner";
    door = env.lead();
    await new Promise<void>(() => {});
  });
  return { role: () => role };
}
