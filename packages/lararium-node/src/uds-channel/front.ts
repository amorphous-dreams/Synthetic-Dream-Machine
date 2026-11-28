/**
 * THE FLOOR'S HOLD ON THE VERB SOCKET (`serveUdsFront`): it serves the vessel's store claim once, holds callers while no
 * composition sits, hands each line to the seated composition in arrival order, answers the holder probe at once from the
 * asks in flight, and refuses every caller by name once it stops.
 * Heleuma ha: see lararium/mesh/uds-channel-front.
 */

import type { Socket } from "node:net";
import { PARK_LIMIT, type StoreClaim } from "../owned-store.js";
import type { UdsFront, UdsSeat } from "./shapes.js";

export function serveUdsFront(a: {
  readonly claim: StoreClaim & { readonly holder: "vessel" };
  readonly onLog?: (line: string) => void;
  readonly onFrame?: (parsed: unknown, sock: Socket) => boolean;
  readonly holdLimit?: number;
}): UdsFront {
  type Held = { parsed: unknown; sock: Socket; onClose: () => void };
  const held: Held[] = [];
  let seat: UdsSeat | null = null;
  let stopped = false;
  const refusal = (sock: Socket) => {
    try { sock.end(JSON.stringify({ status: "error", errorMessage: "the vessel recomposes — run again", refusal: { reason: "recomposing" } }) + "\n"); } catch { /* gone */ }
  };
  const hand = (parsed: unknown, sock: Socket): void => {
    if (stopped) return refusal(sock);
    if (a.onFrame?.(parsed, sock)) return;
    if (seat) return seat.handle(parsed, sock);
    const entry: Held = { parsed, sock, onClose: () => {
      const i = held.indexOf(entry);
      if (i !== -1) held.splice(i, 1);
    } };
    sock.once("close", entry.onClose);
    held.push(entry);
    if (held.length > (a.holdLimit ?? PARK_LIMIT)) {
      const oldest = held.shift()!;
      oldest.sock.off("close", oldest.onClose);
      refusal(oldest.sock);
    }
  };
  const refuseSession = (sock: Socket): void => {
    try { sock.end(JSON.stringify({ kind: "session:refused", refusal: "recomposing" }) + "\n"); } catch { /* gone */ }
  };
  /**
   * THE ASKS IN FLIGHT, oldest first, one entry per REQUEST (a one-shot line, or a session's act): an entry leaves when
   * the seat writes a frame that names its request id, or when its socket finishes or closes, so an idle session holds
   * none. The holder probe reads them: whether the asker's own id still stands held, how many stand, and the oldest.
   */
  const asks = new Map<string, { readonly verb: string; readonly sock: Socket }>();
  const asksOf = new Map<Socket, Set<string>>();
  const dropAsk = (requestId: string): void => {
    const ask = asks.get(requestId);
    if (ask === undefined) return;
    asks.delete(requestId);
    asksOf.get(ask.sock)?.delete(requestId);
  };
  /** Watch what the seat writes on one socket: each answer frame names its request id and settles that ask. */
  const watchAnswers = (sock: Socket): void => {
    const ids = new Set<string>();
    asksOf.set(sock, ids);
    let out = "";
    const hear = (chunk: unknown): void => {
      if (ids.size === 0) return;
      out += typeof chunk === "string" ? chunk : chunk instanceof Uint8Array ? Buffer.from(chunk).toString("utf8") : "";
      for (let nl = out.indexOf("\n"); nl !== -1; nl = out.indexOf("\n")) {
        const line = out.slice(0, nl);
        out = out.slice(nl + 1);
        try {
          const id = (JSON.parse(line) as { requestId?: unknown }).requestId;
          if (typeof id === "string") dropAsk(id);
        } catch { /* a line that reads as no frame settles nothing */ }
      }
    };
    const write = sock.write.bind(sock) as (...args: unknown[]) => boolean;
    const end = sock.end.bind(sock) as (...args: unknown[]) => Socket;
    (sock as unknown as { write: (...args: unknown[]) => boolean }).write = (...args: unknown[]) => { hear(args[0]); return write(...args); };
    (sock as unknown as { end: (...args: unknown[]) => Socket }).end = (...args: unknown[]) => { if (typeof args[0] !== "function") hear(args[0]); return end(...args); };
    const settle = (): void => { for (const id of [...ids]) dropAsk(id); asksOf.delete(sock); };
    sock.once("finish", settle);
    sock.once("close", settle);
  };
  const noteAsk = (parsed: unknown, sock: Socket): void => {
    if (!parsed || typeof parsed !== "object") return;
    const frame = parsed as { requestId?: unknown; verb?: unknown; act?: unknown; op?: unknown };
    if (typeof frame.requestId !== "string") return;
    if (frame.op !== undefined && frame.op !== "session:act" && frame.op !== "session:call") return;
    const verb = typeof frame.verb === "string" ? frame.verb : typeof frame.act === "string" ? frame.act : "?";
    if (!asksOf.has(sock)) watchAnswers(sock);
    asks.set(frame.requestId, { verb, sock });
    asksOf.get(sock)!.add(frame.requestId);
  };
  /**
   * THE HOLDER PROBE (`{holder:"?", requestId?}`) ANSWERS AT ONCE, from the front, whatever the seat is running: a seated
   * front reads `serving`; an unseated one (a recomposition) reads as held but not serving. It names the count in flight
   * and the oldest ask's verb, and the oldest's request id to its own asker alone; `held` answers whether the asker's
   * own id still stands in flight, so a caller learns its act went without a clock. The probe dispatches nothing.
   */
  const answerProbe = (sock: Socket, asker: string | null): void => {
    const first = asks.entries().next().value;
    const oldest = first === undefined ? null : { verb: first[1].verb, ...(first[0] === asker ? { requestId: first[0] } : {}) };
    const serving = seat !== null && !stopped;
    const errorMessage = serving
      ? `the vessel (pid ${process.pid}) serves the store; ${asks.size} ask(s) in flight${oldest ? `, the oldest ${oldest.verb}${oldest.requestId ? ` (your request ${oldest.requestId})` : ""}` : ""}`
      : `a vessel (pid ${process.pid}) holds the store and recomposes; no seat serves verbs yet`;
    try {
      sock.end(JSON.stringify({ holder: "vessel", serving, pid: process.pid, inFlight: asks.size, oldest, ...(asker !== null ? { held: asks.has(asker) } : {}), errorMessage }) + "\n");
    } catch { /* gone */ }
  };
  a.claim.serve((sock: Socket) => {
    let buf = "";
    let read = true;
    let sessionMode = false;
    sock.setEncoding("utf8");
    sock.on("data", (chunk: string) => {
      if (!read) return;
      buf += chunk;
      let nl: number;
      while (read && (nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        let parsed: unknown;
        try { parsed = JSON.parse(line); }
        catch { try { sock.end(JSON.stringify({ status: "error", errorMessage: "bad invocation json" }) + "\n"); } catch { /* gone */ } read = false; return; }
        if (!sessionMode) {
          if (!!parsed && typeof parsed === "object" && (parsed as { holder?: unknown }).holder === "?") {
            const asker = (parsed as { requestId?: unknown }).requestId;
            read = false; answerProbe(sock, typeof asker === "string" ? asker : null); return;
          }
          sessionMode = !!parsed && typeof parsed === "object" && (parsed as { op?: unknown }).op === "session:open";
          if (!sessionMode) read = false;
          noteAsk(parsed, sock);
          hand(parsed, sock);
        } else if (seat?.handleSessionFrame) { noteAsk(parsed, sock); seat.handleSessionFrame(parsed, sock); }
        else { read = false; refuseSession(sock); }
      }
    });
  });
  a.onLog?.(`uds verb-channel on ${a.claim.socketPath} (perms 0600)`);
  return {
    attach: (next) => {
      if (stopped) throw new Error("UDS front is closed");
      if (seat) throw new Error("UDS front already has a seat");
      seat = next;
      for (const entry of held.splice(0)) {
        entry.sock.off("close", entry.onClose);
        if (!entry.sock.destroyed) next.handle(entry.parsed, entry.sock);
      }
    },
    detach: async () => {
      const old = seat;
      seat = null;
      await old?.close();
    },
    close: async () => {
      if (stopped) return;
      stopped = true;
      const closing = seat?.close();
      seat = null;
      for (const entry of held.splice(0)) {
        entry.sock.off("close", entry.onClose);
        refusal(entry.sock);
      }
      a.claim.refuse(`the vessel (pid ${process.pid}) on this store stops — run again once it has gone`);
      await closing;
    },
  };
}
