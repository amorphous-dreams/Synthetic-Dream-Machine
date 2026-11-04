import {
  PromoteRefused, promoteClass, promoteDigest, promoteEdgeKey, promotePreloadBytes,
  ledgerCommit, ledgerUnpromote, ledgerDecideOrphan, reconcilePromotions, verifyPromotionRows,
  type PromoteWho, type PromotionLedger,
} from "./promote.js";
import { kapaeNoteArrival, kapaeBootSet, kapaeStanding, encodeKapaeLocal, type KapaeLocal } from "./promote-kapae.js";
import type { PromoteBoardReading } from "./promote-board.js";

export type PromoteItem = { title: string; text: string; fields: Readonly<Record<string, string>>; revision: string; origin: { seat: string; device: string; session: string } };
type Store<T> = { read(): Promise<T>; write(value: T): Promise<void> };
export type PromotionPorts = {
  wiki: string; ledger: Store<PromotionLedger>; local: Store<KapaeLocal>;
  items(): Promise<readonly PromoteItem[]>; board(): Promise<PromoteBoardReading>;
  cas: { put(digest: string, bytes: Uint8Array): void | Promise<void>; pin(digest: string): void | Promise<void> };
  loaded(): ReadonlySet<string>; restart(): Promise<void>; who: PromoteWho;
};

export function promotions(ports: PromotionPorts) {
  const { wiki } = ports;
  const own = (ledger: PromotionLedger) => ledger.rows.filter(row => row.wiki === wiki);
  const states = (rows: ReturnType<typeof own>, items: readonly PromoteItem[]) => reconcilePromotions(rows, (_wiki, title) => {
    const item = items.find(i => i.title === title); return item ? promoteDigest(item) : null;
  });
  const saveLocal = async (before: KapaeLocal, after: KapaeLocal) => {
    if (new TextDecoder().decode(encodeKapaeLocal(before)) !== new TextDecoder().decode(encodeKapaeLocal(after))) await ports.local.write(after);
  };
  const shadows = (edges: ReadonlySet<string>) => [...edges].filter(e => e.startsWith(`${wiki}\n`)).sort();
  return {
    async list() {
      const [ledger, items, board] = await Promise.all([ports.ledger.read(), ports.items(), ports.board()]);
      const ownRows = own(ledger), shadowed = board.shadowed(wiki), prepared = board.prepared(wiki);
      const rows = states(ownRows, items).map(({ row, state, head }) => {
        let classes: ReturnType<typeof promoteClass> = [];
        try {
          const fields: unknown = JSON.parse(row.bytes);
          if (fields && typeof fields === "object" && !Array.isArray(fields) && Object.values(fields).every(value => typeof value === "string")) classes = promoteClass({ title: row.title, text: "", fields: fields as Record<string, string> });
        } catch { /* A malformed row carries no readable classes. */ }
        return { wiki, digest: row.digest, title: row.title, revision: row.revision, state, ...(head === undefined ? {} : { head }), classes, shadowed: shadowed.has(row.digest) };
      });
      const waiting = items.flatMap(item => {
        const classes = promoteClass(item), digest = promoteDigest(item);
        if (!classes.length || ownRows.some(row => row.digest === digest)) return [];
        const prep = prepared.find(p => p.digest === digest);
        return [{ title: item.title, digest, revision: item.revision, classes, origin: item.origin, ...(prep ? { prepared: prep } : {}) }];
      });
      return { rows, waiting, shadowed: [...shadowed].sort() };
    },
    async promote({ digest }: { digest: string }) {
      if (ports.who.kind !== "hand") throw new PromoteRefused("promote-needs-hand", "a hand must decide");
      const item = (await ports.items()).find(i => promoteDigest(i) === digest);
      if (!item) throw new PromoteRefused("promote-unknown", "no item carries the digest");
      const ledger = ledgerCommit(await ports.ledger.read(), { wiki, digest, item, revision: item.revision }, ports.who);
      await ports.cas.put(digest, promotePreloadBytes(item)); await ports.cas.pin(digest); await ports.ledger.write(ledger);
      return ledger.rows[ledger.rows.length - 1]!;
    },
    async unpromote({ digest }: { digest: string }) { await ports.ledger.write(ledgerUnpromote(await ports.ledger.read(), { wiki, digest }, ports.who)); },
    async decideOrphan({ digest, decision }: { digest: string; decision: "keep" | "drop" }) { await ports.ledger.write(ledgerDecideOrphan(await ports.ledger.read(), { wiki, digest }, decision, ports.who)); },
    async boot() {
      const [ledger, local] = await Promise.all([ports.ledger.read(), ports.local.read()]);
      let edges: ReadonlySet<string>, readings: ReturnType<typeof states> = [];
      let board: PromoteBoardReading | null;
      let itemsError: unknown = null;
      try { board = await ports.board(); } catch { board = null; }
      if (board) {
        edges = kapaeStanding(local, board);
        // The enumeration serves the hand's reconciliation report ONLY: a rejection never reaches the runnable rows below (ledger verify
        // and the brake decide those), and rides out by name for the caller to report.
        try { readings = states(own(ledger), await ports.items()); } catch (error) { itemsError = error; }
        await saveLocal(local, kapaeNoteArrival(local, edges, new Set()).local);
      } else { edges = kapaeBootSet(local, null); }
      const { verified, voided } = verifyPromotionRows(own(ledger));
      const runnable = verified.filter(row => !edges.has(promoteEdgeKey(wiki, row.digest)));
      for (const row of runnable) { await ports.cas.put(row.digest, new TextEncoder().encode(row.bytes)); await ports.cas.pin(row.digest); }
      return { itemsError, pluginCids: runnable.map(row => row.digest), voided, orphans: readings.filter(r => r.state === "orphaned").map(r => r.row.digest), updateWaits: readings.filter(r => r.state === "update-waits").map(r => r.row.digest), shadowed: shadows(edges) };
    },
    async arrive() {
      // The shadow is cached first (an offline boot honors it); the island restarts while it LOADED any shadowed edge, so a restart that
      // failed is tried again by the next arrive.
      const board = await ports.board(), local = await ports.local.read(), edges = kapaeStanding(local, board);
      const result = kapaeNoteArrival(local, edges, ports.loaded());
      await saveLocal(local, result.local);
      const hit = [...edges].some(edge => ports.loaded().has(edge));
      if (hit) await ports.restart();
      return { restarted: hit };
    },
  };
}
