/**
 * kahua-promotions — the device-local door for preparing, committing and booting stage promotions.
 * The pure promotion law decides ledger transitions; ports carry effects to local storage and CAS.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import {
  kahuaCodeClass, kahuaPreloadBytes, kahuaPromotionDigest, ledgerPrepare, ledgerCommit, ledgerUnpromote,
  ledgerDecideOrphan, verifyPromotionRows, reconcilePromotions, kapaeNoteArrival, kapaeBootSet,
  encodeKapaeLocal, PromoteRefused,
  type PromotionLedger, type KapaeLocal, type KahuaStageReading, type PromoteWho,
} from "@lararium/mesh";

export interface PromotionPorts {
  readonly ledger: { readonly read: () => Promise<PromotionLedger>; readonly write: (l: PromotionLedger) => Promise<void> };
  readonly local: { readonly read: () => Promise<KapaeLocal>; readonly write: (l: KapaeLocal) => Promise<void> };
  readonly stage: () => Promise<KahuaStageReading>;
  readonly cas: { readonly put: (digest: string, bytes: Uint8Array) => void; readonly pin: (digest: string) => void };
  readonly loaded: () => ReadonlySet<string>;
  readonly restart: () => Promise<void>;
  readonly who: PromoteWho;
}

function rowClasses(bytes: string) {
  try {
    const { title, text, ...fields } = JSON.parse(bytes) as Record<string, string>;
    return kahuaCodeClass({ title: title!, text: text!, fields });
  } catch { return []; }
}
function localChanged(a: KapaeLocal, b: KapaeLocal): boolean {
  const first = encodeKapaeLocal(a), second = encodeKapaeLocal(b);
  return first.length !== second.length || first.some((byte, i) => byte !== second[i]);
}

export function kahuaPromotions(ports: PromotionPorts) {
  return {
    async list() {
      const ledger = await ports.ledger.read(), reading = await ports.stage();
      const shadowed = reading.shadowed(), digests = new Set(ledger.rows.map(row => row.digest));
      const rows = reconcilePromotions(ledger.rows, reading).map(({ row, state, head }) => ({
        digest: row.digest, title: row.title, revision: row.revision, state,
        ...(head === undefined ? {} : { head }), classes: rowClasses(row.bytes), shadowed: shadowed.has(row.digest),
      }));
      const waiting = reading.list().flatMap(item => item.heads.flatMap(head => {
        const classes = kahuaCodeClass(head), digest = kahuaPromotionDigest(head);
        if (!classes.length || digests.has(digest)) return [];
        const prepared = ledger.queue.find(entry => entry.digest === digest);
        return [{ title: head.title, digest, revision: head.cid, classes, origin: head.origin,
          ...(prepared ? { prepared } : {}) }];
      }));
      return { rows, waiting, queue: ledger.queue, shadowed: [...shadowed].sort() };
    },
    async prepare({ title, why }: { title: string; why: string }) {
      const item = (await ports.stage()).get(title);
      if (!item) throw new PromoteRefused("promote-unknown", "no standing item carries the title");
      if (item.status === "siblings") throw new PromoteRefused("promote-siblings", "the item has sibling heads");
      const head = item.heads[0]!, classes = kahuaCodeClass(head);
      if (!classes.length) throw new PromoteRefused("promote-not-a-rite", "the item carries no code class");
      const entry = { digest: kahuaPromotionDigest(head), title, revision: head.cid, classes, why, seat: ports.who.id };
      const ledger = ledgerPrepare(await ports.ledger.read(), entry);
      await ports.ledger.write(ledger);
      return ledger.queue.find(e => e.digest === entry.digest)!;
    },
    async promote({ digest }: { digest: string }) {
      if (ports.who.kind !== "hand") throw new PromoteRefused("promote-needs-hand", "a hand must decide");
      const reading = await ports.stage();
      const head = reading.list().flatMap(item => item.heads).find(item => kahuaPromotionDigest(item) === digest);
      if (!head) throw new PromoteRefused("promote-unknown", "no standing head carries the digest");
      const ledger = ledgerCommit(await ports.ledger.read(), { digest, item: head, revision: head.cid }, ports.who);
      ports.cas.put(digest, kahuaPreloadBytes(head));
      ports.cas.pin(digest);
      await ports.ledger.write(ledger);
      return ledger.rows.find(row => row.digest === digest)!;
    },
    async unpromote({ digest }: { digest: string }) {
      const ledger = ledgerUnpromote(await ports.ledger.read(), digest, ports.who);
      await ports.ledger.write(ledger);
      return ledger;
    },
    async decideOrphan({ digest, decision }: { digest: string; decision: "keep" | "drop" }) {
      const ledger = ledgerDecideOrphan(await ports.ledger.read(), digest, decision, ports.who);
      await ports.ledger.write(ledger);
      return ledger;
    },
    async boot() {
      const ledger = await ports.ledger.read(), local = await ports.local.read();
      let reading: KahuaStageReading | null;
      try { reading = await ports.stage(); } catch { reading = null; }
      const shadowed = reading ? reading.shadowed() : kapaeBootSet(local, null);
      const states = reading ? reconcilePromotions(ledger.rows, reading) : [];
      if (reading) {
        const next = kapaeNoteArrival(local, shadowed, new Set()).local;
        if (localChanged(local, next)) await ports.local.write(next);
      }
      const { verified, voided } = verifyPromotionRows(ledger.rows);
      const runnable = verified.filter(row => !shadowed.has(row.digest));
      for (const row of runnable) {
        ports.cas.put(row.digest, new TextEncoder().encode(row.bytes));
        ports.cas.pin(row.digest);
      }
      return { pluginCids: runnable.map(row => row.digest), voided,
        orphans: states.filter(s => s.state === "orphaned").map(s => s.row.digest),
        updateWaits: states.filter(s => s.state === "update-waits").map(s => s.row.digest),
        shadowed: [...shadowed].sort() };
    },
    async arrive() {
      const reading = await ports.stage(), local = await ports.local.read();
      const result = kapaeNoteArrival(local, reading.shadowed(), ports.loaded());
      if (localChanged(local, result.local)) await ports.local.write(result.local);
      if (result.restart) await ports.restart();
      return { restarted: result.restart };
    },
  };
}
