/**
 * floor-porch — the Nexus's floor at the porch: the release chain it answers a stranger with, and the floor blobs it
 * names, each by a name the stranger brings.
 *
 *   GET /floor/<Nexus AID>   → the porch answer (`floor-answer`): the release rows this vessel's crossroads board carries,
 *                              each with the charter's epoch lineage riding its record. Public by construction: the
 *                              answer holds signatures and public keys, and a reader verifies every step itself.
 *   GET /cas/<cid>           → a floor blob the chain's HEAD release names (its manifest and the two snapshots) and
 *                              nothing else, re-hashed on the way out (a hearth mounts this route; a herm already
 *                              carries `/cas` in its bulb face and lends it the same lane through `publicCasShore`).
 *
 * THE SILENT RUNG (pronaos#/the-rung-ladder). Every other path, an AID this vessel does not answer for, a wrong method and a
 * cid the head release does not name draw the one CLOSED DOOR, byte-identical to the dispatcher's terminal refusal. A herm
 * carries and presents the answer and signs nothing: the porch holds no key.
 *
 * A BOARD ROW NAMES NO BLOB UNTIL IT VERIFIES. The set of servable cids derives at each ask from the verified chain (lineage,
 * seal, approval), never from a bare row, so a row any peer wrote onto the board cannot make the porch serve a private blob.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-slices
 */
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Repo } from "@automerge/automerge-repo";
import {
  NEXUS_AID_PATTERN, crossroadsDocUrl, floorAnswerOf, floorReleaseRowsFromBoard, foldFloorReleases, materializeSharedLarDoc, readFloorManifest,
  type LarDoc,
} from "@lararium/mesh";
import { CAS_BLOB_RE, answerClosedDoor } from "./bulb-routes.js";
import { readVerifiedCasBlobFromFs } from "./node-cas.js";
import type { HttpFaceDispatcher } from "./http-face-dispatcher.js";

/** The porch route a Nexus's answer rides, as the SERVER matches it: one AID, captured. */
export const FLOOR_ROUTE_RE = /^\/floor\/(nexus-[0-9a-f]{64})$/;

/** The cids the chain's head release names: its manifest and the two snapshots the manifest names. Empty while no release counts. */
export async function releasedFloorCids(opts: {
  readonly board:  LarDoc | undefined | null;
  readonly nexus:  string;
  readonly casDir: string;
}): Promise<ReadonlySet<string>> {
  const standing = await foldFloorReleases({
    rows: floorReleaseRowsFromBoard(opts.board), nexus: opts.nexus,
    manifestBytesOf: (cid) => readVerifiedCasBlobFromFs(cid, opts.casDir),
  });
  if (standing.standing !== "released") return new Set();
  const cids = new Set<string>([standing.head.body.manifest]);
  const bytes = readVerifiedCasBlobFromFs(standing.head.body.manifest, opts.casDir);
  const manifest = bytes ? readFloorManifest(bytes) : null;
  if (manifest && "manifest" in manifest) { cids.add(manifest.manifest.lares); cids.add(manifest.manifest.lararium); }
  return cids;
}

/** Mount the porch's floor routes on a vessel's one request listener. */
export function mountFloorPorch(args: {
  /** The server a bare listener rides when no dispatcher claims routes; a hearth main hands a dispatcher alone. */
  readonly httpServer?: Server;
  readonly dispatcher?: HttpFaceDispatcher;
  readonly repo:        Repo;
  /** The Nexus this vessel's boards key on; the porch answers for this AID alone, and only when it reads as an AID. */
  readonly nexusPubkey: string;
  readonly casDir:      string;
  /** True on a hearth, which carries no bulb face. A herm lends the same lane to its bulb face's `/cas` instead. */
  readonly serveCas:    boolean;
  readonly onLog?:      (line: string) => void;
}): { readonly dispose: () => void } {
  const { httpServer, dispatcher, repo, nexusPubkey, casDir, serveCas } = args;
  const answers = NEXUS_AID_PATTERN.test(nexusPubkey);
  let board: Promise<{ doc(): LarDoc | undefined }> | null = null;
  const boardOf = () => (board ??= materializeSharedLarDoc(repo, crossroadsDocUrl(nexusPubkey), "board:crossroads"));

  const pathOf = (req: IncomingMessage): string => { try { return new URL(req.url ?? "/", "http://localhost").pathname; } catch { return ""; } };
  const owns = (req: IncomingMessage): boolean => {
    const path = pathOf(req);
    return FLOOR_ROUTE_RE.test(path) || (serveCas && CAS_BLOB_RE.test(path));
  };
  const handle = (req: IncomingMessage, res: ServerResponse): void => {
    if (req.method !== "GET" && req.method !== "HEAD") { answerClosedDoor(res); return; }
    const path = pathOf(req);
    const floor = FLOOR_ROUTE_RE.exec(path);
    if (floor) {
      if (!answers || floor[1] !== nexusPubkey) { answerClosedDoor(res); return; }
      void boardOf().then((b) => {
        const body = Buffer.from(JSON.stringify(floorAnswerOf(nexusPubkey, floorReleaseRowsFromBoard(b.doc()))));
        if (res.headersSent || res.writableEnded) return;
        res.writeHead(200, { "access-control-allow-origin": "*", "content-type": "application/json", "cache-control": "no-store" });
        if (req.method === "HEAD") res.end(); else res.end(body);
      }).catch(() => answerClosedDoor(res));
      return;
    }
    const cas = CAS_BLOB_RE.exec(path);
    if (!cas || !serveCas || !answers) { answerClosedDoor(res); return; }
    const cid = cas[1]!;
    void boardOf().then(async (b) => {
      const named = await releasedFloorCids({ board: b.doc(), nexus: nexusPubkey, casDir });
      const bytes = named.has(cid) ? readVerifiedCasBlobFromFs(cid, casDir) : null;
      if (!bytes) { answerClosedDoor(res); return; }
      res.writeHead(200, { "access-control-allow-origin": "*", "content-type": "application/octet-stream", "cache-control": "public, immutable, max-age=31536000" });
      if (req.method === "HEAD") res.end(); else res.end(Buffer.from(bytes));
    }).catch(() => answerClosedDoor(res));
  };
  const onRequest = (req: IncomingMessage, res: ServerResponse): void => { if (owns(req)) handle(req, res); };
  const unregister = dispatcher?.register({
    name: "floor-porch", routeKeys: [`floor:/floor/`, ...(serveCas ? [`cas:/cas/`] : [])], owns, handle,
  });
  if (!unregister) httpServer?.on("request", onRequest);
  args.onLog?.(`floor porch: ${answers ? `answers /floor/${nexusPubkey.slice(0, 18)}…` : "answers no Nexus (no charter stands: the island is no AID)"}${serveCas ? " · /cas for the head's floor" : ""}`);
  return { dispose: () => { if (unregister) unregister(); else httpServer?.off("request", onRequest); } };
}
