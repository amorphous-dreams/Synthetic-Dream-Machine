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
 * The family's trust names a hand, a vessel and a place. Here the hand reads as the key the gate handed in (the face's own,
 * off the pūlama's custody), and both the vessel's witness seat and the place belong to THE PŪLAMA, which keeps the hearth:
 * its own key signs every return and tessera half in this store. No key a vessel holds signs as any of them.
 *
 * ── THE OFFER LANDS ONLY WHAT VERIFIES ──────────────────────────────────────────────────────────
 * The vessel offers its lei, the lei that one follows (a chain reads from its first lei), and any unstringing it holds. Each
 * row lands only where the family's own reader verifies it as the hand's record at its own title; a row that verifies as
 * nothing lands nowhere, and the read then finds no lei.
 *
 * ── THE LEI STANDS AS THE CONSENT ───────────────────────────────────────────────────────────────
 * A `kukulu` return rests on the hand's signed lei alone: no receipt weighs
 * the tree, for no rite carries one. The pūlama verified the vouch before it began, and the restand's tessera par stays the verdict after the fact.
 * Rites still begin one at a time here, and a begin over an offer that already began (a refused composition, then the retry)
 * answers the half it rests, never a second return.
 *
 * ONE LEI PER LENT FACE: the gate begins one rite per face it lends, each under that face's group and hand. Every face's lei
 * rests on the branch's one line here, and a face that finds only other faces' rows there reads `swarm-lei-absent`.
 *
 * A `kukulu` lei waits on no co-sign (`leiRiteCosigns`), so the ward witness the family's reader takes decides nothing here.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import {
  SwarmRefused,
  swarmActCid,
  swarmLeiRecordTitle,
  swarmLeiUnstrungTitle,
  verifySwarmRecord,
  type SignedSwarmAct,
  type SwarmTrust,
  type SwarmWikiPort,
} from "@lararium/mesh/swarm-tiddlers";
import { beginRite, landRite, pendingBegins } from "@lararium/mesh/swarm-tessera";
import { type WardActWitness } from "@lararium/mesh/ward-cosign";
import type { KukuluRiteAt, KukuluRitePort } from "./kukulu-gate.js";

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
  // ONE RITE BEGINS AT A TIME: two hellos for one tree never interleave their writes.
  let turn: Promise<unknown> = Promise.resolve();
  const inTurn = <T>(act: () => Promise<T>): Promise<T> => { const run = turn.then(act, act); turn = run.catch(() => undefined); return run; };
  return {
    begin: (offer, at) => inTurn(async () => {
      const trust = trustOf(at);
      for (const raw of [...offer.lei.slice(0, 64), ...offer.unstrung.slice(0, 64)]) await landOffered(records, raw, trust, at);
      // ONE BEGIN PER OFFER: a guest half this pūlama rests unlanded for this face, line, head AND IMAGE (a composition refused
      // after the claim, and the vessel dials again with the same offer) answers the retry, so it spends no second return; a
      // retry over another image begins its own. A lei the hand unstrung since (the pūlama's own records hold every unstring its
      // hand door signs, whatever offer a vessel carries) serves no retry: the begin below refuses by the lei's own reading.
      const standing = (await pendingBegins(records, "kukulu", at.branch)).find((p) => p.group === at.group && p.head === at.head && p.image === at.image);
      if (standing !== undefined && (await records.read(swarmLeiUnstrungTitle(standing.lei))) === null) return { ok: true as const, tessera: standing.tessera, lei: standing.lei, n: standing.n };
      try {
        const begun = await beginRite(records, { rite: "kukulu", branch: at.branch, head: at.head, tree: at.tree, ...(at.image === undefined ? {} : { image: at.image }) }, trust, at.group, at.by, NO_COSIGN);
        return { ok: true as const, tessera: begun.tessera, lei: begun.lei, n: begun.n };
      } catch (err) {
        // ONE LINE, EVERY LENT FACE'S LEI: the pūlama's store rests each face's kukulu lei under the branch's one line, so a
        // face whose hand strung none there reads the other faces' rows as another group's. That face has no lei here.
        if (err instanceof SwarmRefused) return { ok: false as const, refusal: err.code === "swarm-lei-group" ? "swarm-lei-absent" : err.code };
        throw err;
      }
    }),
    async land(tessera, at) {
      const landed = await landRite(records, { tessera, head: at.head, ...(at.image === undefined ? {} : { image: at.image }) }, trustOf(at), at.group, at.by);
      return { par: landed.par };
    },
  };
}
