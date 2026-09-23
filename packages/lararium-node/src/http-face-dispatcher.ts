/**
 * One request listener for a vessel's HTTP faces.
 *
 * A face claims synchronously, then may answer asynchronously. The dispatcher
 * never races a claimed face with its terminal refusal.
 */

import type { IncomingMessage, Server, ServerResponse } from "node:http";

export interface HttpFace {
  readonly name: string;
  /** Stable ownership declarations used to reject duplicate registration. */
  readonly routeKeys: readonly string[];
  /** Claim before any asynchronous authorization or byte work begins. */
  readonly owns: (req: IncomingMessage) => boolean;
  readonly handle: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}

export interface HttpFaceDispatcher {
  readonly register: (face: HttpFace) => () => void;
  readonly dispose: () => void;
}

function refuse(res: ServerResponse): void {
  if (res.writableEnded) return;
  res.writeHead(404, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end("route unavailable");
}

function failHandler(res: ServerResponse): void {
  if (res.writableEnded || res.headersSent) return;
  res.writeHead(500, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end("face handler failed");
}

/**
 * Mount the sole request listener for an HTTP vessel.
 *
 * Registration order is the dispatch order. A route key may belong to only
 * one live face, while a face can claim an asynchronous request immediately.
 */
export function mountHttpFaceDispatcher(server: Server): HttpFaceDispatcher {
  const faces: HttpFace[] = [];
  const routeOwners = new Map<string, string>();

  const onRequest = (req: IncomingMessage, res: ServerResponse): void => {
    const face = faces.find((candidate) => candidate.owns(req));
    if (!face) {
      refuse(res);
      return;
    }
    try {
      void Promise.resolve(face.handle(req, res)).catch(() => failHandler(res));
    } catch {
      failHandler(res);
    }
  };

  server.on("request", onRequest);

  const register = (face: HttpFace): (() => void) => {
    if (!face.name || face.name.trim() !== face.name) {
      throw new Error("[http-face] face name must be a non-empty exact value");
    }
    if (face.routeKeys.length === 0 || face.routeKeys.some((key) => !key || key.trim() !== key)) {
      throw new Error("[http-face] face routeKeys must contain non-empty exact values");
    }
    const duplicate = face.routeKeys.find((key) => routeOwners.has(key));
    if (duplicate) {
      throw new Error("[http-face] route key already owned: " + duplicate);
    }
    faces.push(face);
    for (const key of face.routeKeys) routeOwners.set(key, face.name);
    let live = true;
    return () => {
      if (!live) return;
      live = false;
      const index = faces.indexOf(face);
      if (index >= 0) faces.splice(index, 1);
      for (const key of face.routeKeys) {
        if (routeOwners.get(key) === face.name) routeOwners.delete(key);
      }
    };
  };

  return {
    register,
    dispose: () => {
      faces.length = 0;
      routeOwners.clear();
      server.off("request", onRequest);
    },
  };
}
