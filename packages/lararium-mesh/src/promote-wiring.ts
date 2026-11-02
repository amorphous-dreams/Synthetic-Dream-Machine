import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { promoteBoot, type PromoteBootReport } from "./promote-boot.js";
import { promoteActRecords, readPromoteBoard, type PromoteFace } from "./promote-board.js";
import { kahuaActRecords, readKahuaStage, type KahuaFoldFace } from "./kahua-stage.js";
import type { PromoteItem, PromotionPorts } from "./promote-door.js";
import type { LarDoc } from "./base-doc.js";

/** Connect promotion boot to the pinned board and stage through their record readers. */
export function promoteWiring(opts: {
  repo: Repo; group: string; boardUrl: string | null; stageUrl: string | null;
  foldFace: () => KahuaFoldFace; boardFace: () => PromoteFace;
  stores: { ledger: PromotionPorts["ledger"]; local: PromotionPorts["local"] };
  cas: PromotionPorts["cas"]; wikiItems: (wiki: string) => Promise<readonly PromoteItem[]>;
  restart: (wiki: string) => Promise<void>; daemonWiki?: string;
  onArrive?: () => Promise<void>;
  onReport?: (wiki: string, report: PromoteBootReport) => void;
  onRestartFailed?: (wiki: string, error: unknown) => void;
  onFault?: (reason: "ledger-unreadable" | "board-unreadable" | "board-unpinned") => void;
}) {
  const board: PromotionPorts["board"] = async () => {
    if (opts.boardUrl === null) throw new Error("board-unpinned");
    const handle = await opts.repo.find<LarDoc>(opts.boardUrl as AutomergeUrl);
    return readPromoteBoard(promoteActRecords(handle.doc(), opts.group), opts.boardFace());
  };
  const itemsOf = async (wiki: string) => {
    if (wiki !== (opts.daemonWiki ?? "daemon")) return opts.wikiItems(wiki);
    if (opts.stageUrl === null) return [];
    const handle = await opts.repo.find<LarDoc>(opts.stageUrl as AutomergeUrl);
    return readKahuaStage(kahuaActRecords(handle.doc(), opts.group), opts.foldFace()).list()
      .flatMap(item => item.heads.map(head => ({ title: head.title, text: head.text, fields: head.fields, revision: head.cid, origin: head.origin })));
  };
  const core = promoteBoot({
    stores: opts.stores, cas: opts.cas, restart: opts.restart,
    ...(opts.onReport ? { onReport: opts.onReport } : {}), ...(opts.onFault ? { onFault: opts.onFault } : {}), ...(opts.onRestartFailed ? { onRestartFailed: opts.onRestartFailed } : {}),
    board, itemsOf,
  });
  const boot = {
    promotedFor: (wiki: string): Promise<readonly string[]> => {
      if (opts.boardUrl === null) { opts.onFault?.("board-unpinned"); return Promise.resolve([]); }
      return core.promotedFor(wiki);
    },
    arrive: core.arrive,
  };
  let tail: Promise<void> = Promise.resolve();
  let attach: Promise<void> = Promise.resolve();
  return {
    boot, board, itemsOf, loadedFor: core.loadedFor, restart: opts.restart,
    watch(): () => void {
      let stopped = false;
      let detach = () => {};
      if (opts.boardUrl !== null) {
        attach = opts.repo.find<LarDoc>(opts.boardUrl as AutomergeUrl).then(handle => {
          if (stopped) return;
          const onChange = () => {
            tail = tail.then(async () => { await boot.arrive(); await opts.onArrive?.(); }).catch(() => { opts.onFault?.("board-unreadable"); });
          };
          handle.on("change", onChange);
          detach = () => { handle.off("change", onChange); };
        }).catch(() => { opts.onFault?.("board-unreadable"); });
      }
      return () => { stopped = true; detach(); };
    },
    async settle(): Promise<void> { await attach; await tail; },
  };
}
