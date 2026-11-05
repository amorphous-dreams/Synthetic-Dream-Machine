/** The store holder runs promotion rows against the face's pinned board and local stores. */
import type { Repo } from "@automerge/automerge-repo";
import {
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, faceRecordsOf, kahuaActRecords, kahuaPlaneUrl,
  promoteActRecords, promoteBoardDoor, promoteCommand, promotePlaneUrl, promotions, promoteWikiItems,
  readKahuaStage, readPromoteBoard, writePromoteAct, PromoteRefused, type LarDoc, type PromoteCommandRequest,
} from "@lararium/mesh";
import { loadIntentFace, IntentRefused } from "./intent.js";
import { loadPersonaGroupRootSeed } from "../node-vessel-identity.js";
import { nodePromoteCas, nodePromoteStores } from "../promoted-store.js";

export async function runPromoteVerb(opts: {
  repo: Repo; catalogUrl?: string; face?: number; action: PromoteCommandRequest["action"];
  args: Readonly<Record<string, unknown>>; casDir: string; restartWiki?: (wiki: string) => Promise<void>;
}): Promise<Record<string, unknown>> {
  let loaded: Awaited<ReturnType<typeof loadIntentFace>>;
  try { loaded = await loadIntentFace(opts.repo, opts.catalogUrl, { index: opts.face }); }
  catch (e) { if (e instanceof IntentRefused) throw new PromoteRefused("face-log-unreadable", e.message); throw e; }
  const { group, index, face, personaPlane, signer } = loaded;
  if (!personaPlane) throw new PromoteRefused("face-log-unreadable", "the catalog names no persona plane for the face");
  const projection = face.project(faceRecordsOf([personaPlane.doc()], group), group);
  if (!projection.founded || projection.fork) throw new PromoteRefused("face-log-unreadable", "the face's signed log does not fold");
  const url = promotePlaneUrl(projection, group);
  if (!url) throw new PromoteRefused("promote-unpinned", "the face pins no promotion board");
  const handle = await opts.repo.find<LarDoc>(url as never);
  const catalog = await opts.repo.find<LarDoc>(opts.catalogUrl as never);
  const boardFace = { group, grant: (key: string) => face.currentSigner(key), device: (key: string) => projection.devices.includes(key) };
  const foldFace = { group, grant: (key: string) => face.currentSigner(key), signedAt: (epoch: number, key: string) => face.signsAt(epoch, key) };
  const board = { records: async () => promoteActRecords(handle.doc(), group), land: async (act: Parameters<typeof writePromoteAct>[1]) => {
    handle.change(d => writePromoteAct(d, act)); await opts.repo.flush();
  } };
  const boardDoor = promoteBoardDoor({ group, face: boardFace, atom: signer, epoch: () => face.lineage[face.lineage.length - 1]!.epoch,
    rootSigner: async () => { const seed = await loadPersonaGroupRootSeed(index); return { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) }; },
    board, projection: () => projection });
  // A local process names its own hand; the session gate refuses declared seat hands before custody reads.
  const who = { kind: "hand" as const, id: signer.key };
  const promotionsFor = (wiki: string) => promotions({ wiki, ...nodePromoteStores(group), who,
    items: async () => {
      if (wiki !== "daemon") return promoteWikiItems({ repo: opts.repo, catalog: () => catalog.doc() })(wiki);
      const stageUrl = kahuaPlaneUrl(projection, group);
      if (!stageUrl) return [];
      const stage = await opts.repo.find<LarDoc>(stageUrl as never);
      return readKahuaStage(kahuaActRecords(stage.doc(), group), foldFace).list()
        .flatMap(item => item.heads.map(head => ({ title: head.title, text: head.text, fields: head.fields, revision: head.cid, origin: head.origin })));
    },
    board: async () => readPromoteBoard(await board.records(), boardFace), cas: nodePromoteCas(opts.casDir, signer.key),
  });
  const value = (key: string) => typeof opts.args[key] === "string" ? opts.args[key] as string : undefined;
  const wiki = value("wiki") ?? "daemon";
  const digest = value("digest"), why = value("why"), decision = value("decision");
  const result = await promoteCommand({ action: opts.action, wiki, ...(digest !== undefined && { digest }), ...(why !== undefined && { why }), ...(decision !== undefined && { decision }) }, { who, promotionsFor, boardDoor });
  if (opts.restartWiki && (opts.action === "commit" || opts.action === "drop" || (opts.action === "orphan" && value("decision") === "drop"))) {
    try { await opts.restartWiki(wiki); }
    catch (e) { return { ...result, restart: "failed", reason: e instanceof Error ? e.message : String(e) }; }
  }
  return { ...result };
}
