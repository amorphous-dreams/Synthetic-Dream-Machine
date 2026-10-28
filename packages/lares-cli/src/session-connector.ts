import { createConnection } from "node:net";
import { newRequestId, type SessionReceipt } from "@lararium/mesh";
import type { Hand } from "@lararium/mesh/session-contract";
import { LocalWaitExpired, UdsUnreachable, udsSocketPath } from "./local-connector.js";

export class SessionRefused extends Error {
  override readonly name = "SessionRefused";
  constructor(readonly refusal: string, readonly closed = false) { super(`local session refused: ${refusal}${closed ? " (the session closed)" : ""}`); }
}

export interface LocalSession {
  call(verb: string, args: Record<string, unknown>, opts?: { requestId?: string; effectKey?: string; timeoutMs?: number }): Promise<Record<string, unknown>>;
  receipt(requestId: string): Promise<SessionReceipt>;
  cancel(requestId: string): Promise<SessionReceipt>;
  /**
   * Switch THIS session to the face `target` hints (`h<N>`), in place: the vessel runs its five-step fence and every
   * later call speaks under the face it answers. A switch the vessel could not commit closes the session, and the
   * refusal reads `closed`; the caller opens afresh.
   */
  switch(target: string): Promise<{ readonly outcome: "switched" | "unchanged"; readonly faceRef: string; readonly generation: number }>;
  /** The face this session wears now, as the vessel answered it. */
  readonly faceRef: string;
  close(): Promise<void>;
}

export async function openLocalSession(opts: { faceRef: string; hand?: Hand; dataDir?: string | null }): Promise<LocalSession> {
  const sock = createConnection(udsSocketPath(opts.dataDir));
  sock.setEncoding("utf8");
  let buffer = "";
  let closed = false;
  /** The vessel closed this session (a switch it could not commit): later asks refuse here, never wait. */
  let sessionClosed = false;
  let envelope: { ownerEpoch: string; sessionId: string; generation: number; faceRef: string } | null = null;
  const pending = new Map<string, Array<{ resolve: (answer: Record<string, unknown>) => void; reject: (error: Error) => void }>>();
  const failAll = (error: Error): void => {
    if (closed) return;
    closed = true;
    for (const waiters of pending.values()) for (const waiter of waiters) waiter.reject(error);
    pending.clear();
  };
  sock.on("data", (chunk: string) => {
    buffer += chunk;
    let end: number;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      let answer: Record<string, unknown>;
      try { answer = JSON.parse(line) as Record<string, unknown>; }
      catch { failAll(new Error("bad session json from local channel")); sock.destroy(); return; }
      const id = typeof answer.requestId === "string" ? answer.requestId : undefined;
      const waiters = id === undefined ? undefined : pending.get(id);
      const waiter = waiters?.shift();
      if (id !== undefined && waiters?.length === 0) pending.delete(id);
      if (answer.kind === "session:refused" && answer.closed === true) sessionClosed = true;
      if (!waiter) continue;
      if (answer.kind === "session:refused") waiter.reject(new SessionRefused(String(answer.refusal), answer.closed === true));
      else waiter.resolve(answer);
    }
  });
  sock.on("error", (error: NodeJS.ErrnoException) => {
    failAll(error.code === "ENOENT" || error.code === "ECONNREFUSED" ? new UdsUnreachable(error.message) : error);
  });
  sock.on("close", () => failAll(new UdsUnreachable("local session socket closed")));
  const send = (frame: Record<string, unknown>, requestId: string): Promise<Record<string, unknown>> => {
    if (sessionClosed) return Promise.reject(new SessionRefused("session-closed", true));
    if (closed) return Promise.reject(new UdsUnreachable("local session socket closed"));
    return new Promise((resolve, reject) => {
      const waiters = pending.get(requestId) ?? [];
      waiters.push({ resolve, reject });
      pending.set(requestId, waiters);
      sock.write(JSON.stringify({ ...frame, requestId }) + "\n");
    });
  };
  const openingId = newRequestId();
  let opened: Record<string, unknown>;
  try { opened = await send({ op: "session:open", faceRef: opts.faceRef, hand: opts.hand ?? "cli" }, openingId); }
  catch (error) { sock.destroy(); throw error; }
  if (opened.kind !== "session:opened" || typeof opened.ownerEpoch !== "string" ||
      typeof opened.sessionId !== "string" || typeof opened.generation !== "number" || typeof opened.faceRef !== "string") {
    sock.destroy();
    throw new Error("malformed session opening from local channel");
  }
  envelope = { ownerEpoch: opened.ownerEpoch, sessionId: opened.sessionId, generation: opened.generation, faceRef: opened.faceRef };
  const bound = () => envelope!;
  const query = async (op: "session:receipt" | "session:cancel", requestId: string): Promise<SessionReceipt> => {
    const answer = await send({ op, ...bound() }, requestId);
    if (answer.kind !== "session:receipt" || !answer.receipt || typeof answer.receipt !== "object") throw new Error("malformed session receipt");
    return answer.receipt as SessionReceipt;
  };
  return {
    async call(verb, args, callOpts = {}) {
      const requestId = callOpts.requestId ?? newRequestId();
      const timeoutMs = callOpts.timeoutMs ?? 30_000;
      const answer = await send({ op: "session:call", ...bound(), verb, args,
        ...(callOpts.effectKey !== undefined && { effectKey: callOpts.effectKey }),
        ...(callOpts.timeoutMs !== undefined && { timeoutMs: callOpts.timeoutMs }) }, requestId);
      if (answer.kind !== "session:result") throw new Error("malformed session result");
      if (answer.status === "unknown") throw new LocalWaitExpired(verb, timeoutMs, requestId);
      return answer;
    },
    receipt: (requestId) => query("session:receipt", requestId),
    async switch(target) {
      const at = bound();
      const answer = await send({ op: "session:switch", ...at, expectedGeneration: at.generation, target }, newRequestId());
      if (answer.kind !== "session:switch-result" || typeof answer.generation !== "number" || typeof answer.faceRef !== "string" ||
          (answer.outcome !== "switched" && answer.outcome !== "unchanged")) throw new Error("malformed switch result from local channel");
      envelope = { ...at, generation: answer.generation, faceRef: answer.faceRef };
      return { outcome: answer.outcome, faceRef: answer.faceRef, generation: answer.generation };
    },
    get faceRef() { return bound().faceRef; },
    cancel: (requestId) => query("session:cancel", requestId),
    async close() {
      if (closed) return;
      sock.end(JSON.stringify({ op: "session:close", ...bound() }) + "\n");
      await new Promise<void>((resolve) => sock.once("close", resolve));
    },
  };
}
