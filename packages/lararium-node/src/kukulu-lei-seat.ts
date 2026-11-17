/**
 * kukulu-lei-seat — the swarm's lei family and its tessera, seated behind the kūkulu gate's port over the pūlama's own records.
 *
 * The gate asks the family two things (`KukuluRitePort`): begin a `kukulu` rite over what the vessel offered, and land it.
 * The family owns both (`@lararium/mesh`: `readLei`, `returnLei`, `beginRite`, `landRite`); this module holds the thin adapter.
 *
 * ── THE RECORDS REST WHERE NO VESSEL WRITES ─────────────────────────────────────────────────────
 * Every row lands in the pūlama's record store (`pulama-state`), under the family's own titles: the offered lei at
 * `lei/kukulu/<branch>/<cid>`, each return at `lei-returned/<cid>/<n>`, the tessera's halves at `tessera/<tessera>/guest` and
 * `…/host`. The pūlama counts a lei's returns in this store alone, so a vessel never spends past the count by hiding a
 * return, and never forges a half.
 *
 * ── WHO SIGNS WHAT HERE ─────────────────────────────────────────────────────────────────────────
 * The family's trust names a hand and a vessel. Here the hand reads as the key the gate handed in (the face's own, off the
 * pūlama's custody), and the vessel's witness seat belongs to THE PŪLAMA: its own key signs every return, receipt and
 * tessera half in this store. No key a vessel holds signs as either.
 *
 * ── THE OFFER LANDS ONLY WHAT VERIFIES ──────────────────────────────────────────────────────────
 * The vessel offers its lei, the lei that one follows (a chain reads from its first lei), and any unstringing it holds. Each
 * row lands only where the family's own reader verifies it as the hand's record at its own title; a row that verifies as
 * nothing lands nowhere, and the read then finds no lei.
 *
 * ── THE VOUCH STANDS AS THE TESTIMONY ───────────────────────────────────────────────────────────
 * A return rests on a receipt for the head's tree. The pūlama verified the vouch, so it rests the receipt itself, as the
 * witness: the vouch's digest as its definitions and the walk's verdict as its own. A red walk therefore reads as the family
 * reads any red: the return refuses `swarm-lei-testimony-red`, and a wide lei narrows. The receipt sits at one title per tree,
 * so rites begin one at a time here: a hello rests its own vouch's verdict and returns under it before another writes.
 *
 * ONE LEI PER LENT FACE: the gate begins one rite per face it lends, each under that face's group and hand. Every face's lei
 * rests on the branch's one line here, and a face that finds only other faces' rows there reads `swarm-lei-absent`.
 *
 * A `kukulu` lei waits on no co-sign (`leiRiteCosigns`), so the ward witness the family's reader takes decides nothing here.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import {
  SwarmRefused, beginRite, landRite, signSwarmAct, swarmActCid, swarmLeiRecordTitle, swarmLeiUnstrungTitle, swarmReceiptTitle, verifySwarmRecord,
  type SignedSwarmAct, type SwarmTrust, type SwarmWikiPort, type WardActWitness,
} from "@lararium/mesh";
import type { KukuluRiteAt, KukuluRitePort } from "./kukulu-gate.js";

/** The check a receipt the pūlama rests names: the vouch it verified. */
export const KUKULU_VOUCH_CHECK = "kukulu-vouch";

const NO_COSIGN: WardActWitness = { accepts: () => true };
const trustOf = (at: KukuluRiteAt): SwarmTrust => {
  const pulama = at.by.key.toLowerCase();
  return { hand: (key) => at.hand(key), vessel: (key) => key.toLowerCase() === pulama, lead: () => false };
};

/** Land one offered row at the title its own body belongs at, where the family's reader verifies it there. */
async function landOffered(records: SwarmWikiPort, raw: unknown, trust: SwarmTrust, at: KukuluRiteAt): Promise<void> {
  let title: string;
  try {
    const act = raw as SignedSwarmAct;
    if (act.body.act === "lei") title = swarmLeiRecordTitle(act.body.rite, act.body.branch, swarmActCid(act));
    else if (act.body.act === "lei-unstrung") title = swarmLeiUnstrungTitle(act.body.lei);
    else return;
    if (act.body.act === "lei" && (act.body.rite !== "kukulu" || act.body.branch !== at.branch)) return;
  } catch { return; }
  const text = JSON.stringify(raw);
  if (verifySwarmRecord(text, title, trust, at.group).ok) await records.writeNew(title, text);
}

/** The kūkulu rite's port over the pūlama's record store. */
export function kukuluRiteOver(records: SwarmWikiPort): KukuluRitePort {
  // ONE RITE BEGINS AT A TIME. The receipt a return rests on sits at one title per tree, so two hellos for one tree must
  // never interleave: each rests ITS vouch's verdict and returns under it before the next one writes.
  let turn: Promise<unknown> = Promise.resolve();
  const inTurn = <T>(act: () => Promise<T>): Promise<T> => { const run = turn.then(act, act); turn = run.catch(() => undefined); return run; };
  return {
    begin: (offer, at) => inTurn(async () => {
      const trust = trustOf(at);
      for (const raw of [...offer.lei.slice(0, 64), ...offer.unstrung.slice(0, 64)]) await landOffered(records, raw, trust, at);
      try {
        const receipt = await signSwarmAct({ act: "receipt", group: at.group, tree: at.tree, checks: [KUKULU_VOUCH_CHECK], verdict: at.verdict, definitions: at.vouch }, at.by);
        await records.write(swarmReceiptTitle(at.tree), JSON.stringify(receipt));
        const begun = await beginRite(records, { rite: "kukulu", branch: at.branch, head: at.head, tree: at.tree }, trust, at.group, at.by, NO_COSIGN);
        return { ok: true as const, tessera: begun.tessera, lei: begun.lei, n: begun.n };
      } catch (err) {
        // ONE LINE, EVERY LENT FACE'S LEI: the pūlama's store rests each face's kukulu lei under the branch's one line, so a
        // face whose hand strung none there reads the other faces' rows as another group's. That face has no lei here.
        if (err instanceof SwarmRefused) return { ok: false as const, refusal: err.code === "swarm-lei-group" ? "swarm-lei-absent" : err.code };
        throw err;
      }
    }),
    async land(tessera, at) {
      const landed = await landRite(records, { tessera, head: at.head }, trustOf(at), at.group, at.by);
      return { par: landed.par };
    },
  };
}
