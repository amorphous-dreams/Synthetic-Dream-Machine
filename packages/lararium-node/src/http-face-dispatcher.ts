/**
 * One request listener and one upgrade listener for a vessel's HTTP faces.
 *
 * A face claims synchronously, then may answer asynchronously. The dispatcher
 * never races a claimed face with its terminal refusal. A request no face claims
 * draws the closed door; an upgrade no socket face claims has its socket destroyed.
 */

import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { answerClosedDoor } from "./bulb-routes.js";

export interface HttpFace {
  readonly name: string;
  /** Stable ownership declarations used to reject duplicate registration. */
  readonly routeKeys: readonly string[];
  /** Claim before any asynchronous authorization or byte work begins. */
  readonly owns: (req: IncomingMessage) => boolean;
  readonly handle: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}

/** A face that answers a WebSocket upgrade on one exact path. */
export interface HttpUpgradeFace {
  readonly name: string;
  /** The exact pathname this face upgrades. One live face per path. */
  readonly path: string;
  readonly handle: (req: IncomingMessage, socket: Duplex, head: Buffer) => void;
}

export interface HttpFaceDispatcher {
  readonly register: (face: HttpFace) => () => void;
  readonly registerUpgrade: (face: HttpUpgradeFace) => () => void;
  readonly dispose: () => void;
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
    // A path no face claims draws THE closed door — the one answer every withheld or refused path draws.
    if (!face) {
      answerClosedDoor(res);
      return;
    }
    try {
      void Promise.resolve(face.handle(req, res)).catch(() => failHandler(res));
    } catch {
      failHandler(res);
    }
  };

  server.on("request", onRequest);

  const upgradeFaces = new Map<string, HttpUpgradeFace>();
  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
    const face = upgradeFaces.get(new URL(req.url ?? "/", "http://localhost").pathname);
    if (!face) { socket.destroy(); return; }
    try { face.handle(req, socket, head); } catch { socket.destroy(); }
  };
  server.on("upgrade", onUpgrade);

  const registerUpgrade = (face: HttpUpgradeFace): (() => void) => {
    if (!face.name || face.name.trim() !== face.name) {
      throw new Error("[http-face] upgrade face name must be a non-empty exact value");
    }
    if (!face.path.startsWith("/") || face.path.trim() !== face.path) {
      throw new Error("[http-face] upgrade face path must be an exact absolute pathname");
    }
    if (upgradeFaces.has(face.path)) {
      throw new Error("[http-face] upgrade path already owned: " + face.path);
    }
    upgradeFaces.set(face.path, face);
    let live = true;
    return () => {
      if (!live) return;
      live = false;
      if (upgradeFaces.get(face.path) === face) upgradeFaces.delete(face.path);
    };
  };

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
    registerUpgrade,
    dispose: () => {
      faces.length = 0;
      routeOwners.clear();
      upgradeFaces.clear();
      server.off("request", onRequest);
      server.off("upgrade", onUpgrade);
    },
  };
}
