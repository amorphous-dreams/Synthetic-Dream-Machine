/**
 * The Node process readiness face.
 *
 * `/api/health` reports only whether this selected Node boot path completed its
 * required local setup. It carries no identity, authority, document, Oracle,
 * Pronaos, or causal-freshness claim.
 */

import type { IncomingMessage, Server, ServerResponse } from "node:http";

export type NodeReadiness = "starting" | "ready";

export interface ReadinessState {
  readonly status: () => NodeReadiness;
  readonly markReady: () => void;
}

export interface ReadinessFace {
  readonly dispose: () => void;
}

export function createReadinessState(): ReadinessState {
  let current: NodeReadiness = "starting";
  return {
    status: () => current,
    markReady: () => { current = "ready"; },
  };
}

function answer(res: ServerResponse, state: ReadinessState, method: string): void {
  const ready = state.status() === "ready";
  res.writeHead(ready ? 200 : 503, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  if (method === "HEAD") res.end();
  else res.end(JSON.stringify({ status: state.status() }));
}

/** Mount the exact health route on an existing Node server. */
export function mountReadinessFace(args: {
  readonly httpServer: Server;
  readonly state: ReadinessState;
}): ReadinessFace {
  const onRequest = (req: IncomingMessage, res: ServerResponse): void => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (pathname !== "/api/health") return;
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        allow: "GET, HEAD",
      });
      res.end(JSON.stringify({ error: "method not allowed" }));
      return;
    }
    answer(res, args.state, req.method);
  };
  args.httpServer.on("request", onRequest);
  return { dispose: () => args.httpServer.off("request", onRequest) };
}
