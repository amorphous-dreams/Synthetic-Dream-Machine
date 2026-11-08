import {
  PromoteRefused, promoteClass, promoteDigest, promoteEdgeKey, promotePreloadBytes,
  ledgerCommit, ledgerUnpromote, ledgerDecideOrphan, reconcilePromotions, verifyPromotionRows, isWardBoundWiki, signPromotionWard,
  type PromoteWho, type PromotionLedger, type PromotionTombstone, type PromotionWardFace,
} from "./promote.js";
import { kapaeNoteArrival, kapaeBootSet, kapaeStanding, type KapaeLocal } from "./promote-kapae.js";
import { promoteDropKey, type PromoteBoardReading } from "./promote-board.js";

export type PromoteItem = { title: string; text: string; fields: Readonly<Record<string, string>>; revision: string; origin: { seat: string; device: string; session: string } };
/**
 * A device-local row. `update` is the ONE atomic read-compute-write: the store's own hold (a custody holder, a keystore lock) runs `fn`
 * over the standing value and writes what it answers, so two commits never lose each other. A store without it takes the door's
 * serial queue (one chain per store object), which serves one process holding one store.
 */
export type Store<T> = { read(): Promise<T>; write(value: T): Promise<void>; update?(fn: (standing: T) => T): Promise<T> };
const chains = new WeakMap<object, Promise<unknown>>();
export async function mutate<T>(store: Store<T>, fn: (standing: T) => T): Promise<T> {
  if (store.update) return store.update(fn);
  const turn = (chains.get(store) ?? Promise.resolve()).then(async () => { const next = fn(await store.read()); await store.write(next); return next; });
  chains.set(store, turn.catch(() => undefined));
  return turn;
}
export type PromotionPorts = {
  wiki: string; ledger: Store<PromotionLedger>; local: Store<KapaeLocal>;
  items(): Promise<readonly PromoteItem[]>; board(): Promise<PromoteBoardReading>;
  cas: { put(digest: string, bytes: Uint8Array): void | Promise<void>; pin(digest: string): void | Promise<void> };
  who: PromoteWho;
  /**
   * THE WARD (seat-harness#/the-ward). A commit in a ward-bound wiki (the daemon wiki, the kahua stage) signs its row as the face
   * root through `wardSigner`, which opens the root under a fresh ward unlock for this act; absent, such a commit refuses
   * `ward-needs-fresh-unlock`. Boot reads each bound row's signature against `face`'s grant; absent, every bound row voids.
   */
  wardSigner?: () => Promise<{ readonly key: string; sign(bytes: Uint8Array): Promise<string> }>;
  face?: PromotionWardFace;
  /**
   * THE DROP FLOOR (road `L23`). Every bound row that leaves the ledger (a drop, an orphan dropped, a row a newer commit replaced)
   * lands as a drop on the face-private board, signed by this device's atom (a brake, so it fails safe), because the ledger's own
   * tombstone rests in a custody row a writer of unlocked custody can strip. Absent or failing, a bound drop still leaves the ledger
   * and that verb refuses `promote-floor-unlanded` after it; a tombstone an earlier verb owed lands best-effort at the next verb and at
   * boot, and never makes an unrelated verb throw.
   */
  landDrops?: (tombstones: readonly PromotionTombstone[]) => Promise<unknown>;
  /**
   * THE OWNER: this device's atom key, the ledger a ward signature binds (`promotionWardBytes`) and the signer whose drops floor it.
   * Absent, a bound commit refuses `promote-owner-absent` and every bound row voids `ward-floor-unread` at boot.
   */
  owner?: string;
};

export function promotions(ports: PromotionPorts) {
  const { wiki } = ports;
  const tombKey = (t: PromotionTombstone) => promoteDropKey(t.wiki, t.digest, t.seq);
  /**
   * The brake runs first: the ledger drops the row, then every tombstone it holds lands on the board (the board door skips what it
   * already names). Only a tombstone THIS verb wrote refuses by name when its floor cannot land; one an earlier verb owed waits for the
   * next verb or boot, so a failed board write never makes an unrelated verb throw after its ledger write.
   */
  const floored = async (before: PromotionLedger, next: PromotionLedger): Promise<void> => {
    const tombstones = next.dropped ?? [];
    if (tombstones.length === 0) return;
    const was = new Set((before.dropped ?? []).map(tombKey)), fresh = tombstones.filter((t) => !was.has(tombKey(t)));
    try {
      if (!ports.landDrops) throw new Error("no board door lands the floor here");
      await ports.landDrops(tombstones);
    } catch (e) {
      if (fresh.length > 0) throw new PromoteRefused("promote-floor-unlanded", `the ledger dropped the bound row; its board floor did not land (${e instanceof Error ? e.message : String(e)}); the next verb or boot lands it`);
    }
  };
  /** One atomic ledger turn that also hands back the ledger it turned from. */
  const turn = async (fn: (standing: PromotionLedger) => PromotionLedger): Promise<{ before: PromotionLedger; next: PromotionLedger }> => {
    let before: PromotionLedger = { seq: 0, rows: [] };
    const next = await mutate(ports.ledger, (standing) => { before = standing; return fn(standing); });
    return { before, next };
  };
  const own = (ledger: PromotionLedger) => ledger.rows.filter(row => row.wiki === wiki);
  const states = (rows: ReturnType<typeof own>, items: readonly PromoteItem[]) => reconcilePromotions(rows, (_wiki, title) => {
    const item = items.find(i => i.title === title); return item ? promoteDigest(item) : null;
  });
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
      // Refuse before any CAS byte lands; the bytes ride under their digest, so a repeat costs nothing; the ledger takes the row atomically.
      // A BOUND COMMIT STEPS PAST ITS OWN EDGE'S DROPS: a ledger a custody write reset would hand it a seq this device's drop of the
      // same (wiki, digest) names, and the ward's signature over it would read as the dropped one. Only that edge's drops move it, so
      // no drop of another edge, however far its seq, moves the ledger. No owner or no board read, no bound commit.
      let dropped: ReadonlySet<string> = new Set();
      if (isWardBoundWiki(wiki)) {
        if (!ports.owner) throw new PromoteRefused("promote-owner-absent", `a commit in ${wiki} binds its device's atom into the ward signature, and none rides this door`);
        try { dropped = (await ports.board()).droppedBy(ports.owner); }
        catch (e) { throw new PromoteRefused("promote-floor-unread", `a commit in ${wiki} reads this device's drops first, and the board did not read (${e instanceof Error ? e.message : String(e)})`); }
      }
      const atFloor = (l: PromotionLedger): PromotionLedger => {
        let seq = l.seq;
        while (dropped.has(promoteDropKey(wiki, digest, seq + 1))) seq += 1;
        return seq === l.seq ? l : { ...l, seq };
      };
      const standing = atFloor(await ports.ledger.read());
      ledgerCommit(standing, { wiki, digest, item, revision: item.revision }, ports.who);
      // A BOUND COMMIT SIGNS ITS OWN ROW: the face root, opened under the ward for this act, over (wiki, digest, the seq it lands at).
      let wardSig: Awaited<ReturnType<typeof signPromotionWard>> | undefined;
      if (isWardBoundWiki(wiki)) {
        if (!ports.wardSigner) throw new PromoteRefused("ward-needs-fresh-unlock", `a commit in ${wiki} is a ward act: it signs under a fresh unlock of the face's ward, and none rides this act`);
        let signer: Awaited<ReturnType<NonNullable<PromotionPorts["wardSigner"]>>>;
        try { signer = await ports.wardSigner(); }
        catch (e) { const m = e instanceof Error ? e.message : String(e); throw new PromoteRefused(/^ward-[a-z-]+/.exec(m)?.[0] ?? "ward-needs-fresh-unlock", m); }
        wardSig = await signPromotionWard({ wiki, digest, seq: standing.seq + 1, owner: ports.owner! }, signer);
      }
      await ports.cas.put(digest, promotePreloadBytes(item)); await ports.cas.pin(digest);
      const { before, next: ledger } = await turn((now) => {
        // The signature names the seq it was made for: a ledger that moved meanwhile refuses, and the hand commits again.
        if (wardSig && atFloor(now).seq !== standing.seq) throw new PromoteRefused("promote-ledger-moved", "the ledger moved while the ward signed; commit again");
        return ledgerCommit(atFloor(now), { wiki, digest, item, revision: item.revision, ...(wardSig ? { wardSig } : {}) }, ports.who);
      });
      await floored(before, ledger);
      return ledger.rows[ledger.rows.length - 1]!;
    },
    async unpromote({ digest }: { digest: string }) { const { before, next } = await turn((standing) => ledgerUnpromote(standing, { wiki, digest }, ports.who)); await floored(before, next); },
    async decideOrphan({ digest, decision }: { digest: string; decision: "keep" | "drop" }) { const { before, next } = await turn((standing) => ledgerDecideOrphan(standing, { wiki, digest }, decision, ports.who)); await floored(before, next); },
    async boot() {
      const [ledger, local] = await Promise.all([ports.ledger.read(), ports.local.read()]);
      let edges: ReadonlySet<string>, readings: ReturnType<typeof states> = [];
      let board: PromoteBoardReading | null;
      let itemsError: unknown = null;
      try { board = await ports.board(); } catch { board = null; }
      if (board) {
        let standingEdges: ReadonlySet<string> = new Set();
        await mutate(ports.local, (standing) => { standingEdges = kapaeStanding(standing, board); return kapaeNoteArrival(standing, standingEdges, new Set()).local; });
        edges = standingEdges;
        // The enumeration serves the hand's reconciliation report ONLY: a rejection never reaches the runnable rows below (ledger verify
        // and the brake decide those), and rides out by name for the caller to report.
        try { readings = states(own(ledger), await ports.items()); } catch (error) { itemsError = error; }
      } else { edges = kapaeBootSet(local, null); }
      // THE DROP FLOOR: this device's drops on the board void a replayed bound row whatever the ledger's plaintext says; no board or no
      // owner, no bound row runs.
      const owner = ports.owner;
      const floor = board && owner ? { owner, dropped: () => board!.droppedBy(owner) } : null;
      const { verified, voided } = verifyPromotionRows(own(ledger), ports.face, ledger, floor);
      // A TOMBSTONE AN EARLIER VERB OWED lands now, best-effort: boot never waits on it, and the promise rides out for a witness.
      const owed = ledger.dropped ?? [];
      const floorLanded: Promise<void> = owed.length > 0 && ports.landDrops ? ports.landDrops(owed).then(() => undefined, () => undefined) : Promise.resolve();
      const runnable = verified.filter(row => !edges.has(promoteEdgeKey(wiki, row.digest)));
      for (const row of runnable) { await ports.cas.put(row.digest, new TextEncoder().encode(row.bytes)); await ports.cas.pin(row.digest); }
      return { floorLanded, itemsError, pluginCids: runnable.map(row => row.digest), voided, orphans: readings.filter(r => r.state === "orphaned").map(r => r.row.digest), updateWaits: readings.filter(r => r.state === "update-waits").map(r => r.row.digest), shadowed: shadows(edges) };
    },
  };
}
