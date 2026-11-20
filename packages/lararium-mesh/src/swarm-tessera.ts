/**
 * swarm-tessera — the two halves of one rite across a restart, and the wake's read of them.
 *
 * A rite that takes the vessel down leaves a record on each side of the gap, as the two halves of a tessera hospitalis:
 *
 *   tessera/<tessera>/guest    `rite-begun`: the vessel returned the rite's lei and rests this half BEFORE it goes down. It names
 *                              the lei, the count of that return, the rite, the branch, and the head and tree the rite runs at.
 *   tessera/<tessera>/host     `rite-landed`: the vessel that stands after rests this half, naming the begun half by its cid
 *                              and the head it stands at.
 *
 * Both rest as the vessel's signed records in the control document (`swarm-tiddlers.ts`). `<tessera>` names one return of one
 * lei (`tesseraOf`), so each rite takes its own.
 *
 * THE RETURN COMES FIRST. `beginRite` returns the lei before it rests the guest half, and the caller takes the vessel down only
 * after `beginRite` answers: a rite with no lei, no testimony or no return left begins nothing. A rite that dies after its
 * return leaves a begun half alone, and the lei's return stays spent.
 *
 * CONFERRE matches the halves, at each wake and with no clock: a pair reads `par` where the host half names the guest half's
 * cid, both name one rite, and the vessel stands at the head the rite began at. Every other tessera reads red, by name:
 * `landed-absent` (the vessel never stood again, or never landed), `head-differs` (it stood at another head), `rite-differs`,
 * `landed-names-another`, `begun-absent`, and `begun-refused` or `landed-refused` for a half that verifies as no record.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import type { SwarmLeiRite } from "./swarm-lei-rite.js";
import {
  SwarmRefused, checkReturn, claimReturn, signSwarmAct, swarmActCid, swarmTesseraPrefix, swarmTesseraTitle, verifySwarmRecord,
  type SwarmLeiLine, type SwarmReturnable, type SwarmRiteBegunBody, type SwarmRiteLandedBody, type SwarmSignerPort, type SwarmTrust, type SwarmWikiPort,
} from "./swarm-tiddlers.js";
import type { WardActWitness } from "./ward-cosign.js";

/** The tessera one return of one lei takes. */
export const tesseraOf = (ret: { readonly lei: string; readonly n: number }): string => sha256HexBytesSync(canonicalJsonBytes({ lei: ret.lei, n: ret.n }));

export type TesseraRed = "landed-absent" | "head-differs" | "rite-differs" | "landed-names-another" | "begun-absent" | "begun-refused" | "landed-refused";
/**
 * One tessera as conferre reads it: each half by its record's cid (null where none verifies), and `par` for a match. Where the
 * begun half verifies, the reading names the branch and head that half began at, so a seat that owes a landing finds its own.
 */
export interface TesseraReading {
  readonly tessera: string; readonly rite: SwarmLeiRite | null; readonly begun: string | null; readonly landed: string | null;
  readonly branch?: string; readonly head?: string;
  readonly par: boolean; readonly red?: TesseraRed;
}

/**
 * Begin a rite: return its lei at this head (the testimony, the count and the reach all judged there, `returnLei`), then rest
 * the guest half. The answer names the tessera; the caller takes the vessel down only after it.
 */
export async function beginRite(wiki: SwarmWikiPort, at: SwarmLeiLine & { readonly head: string; readonly tree: string }, trust: SwarmTrust, group: string, vessel: SwarmSignerPort, ward: WardActWitness):
  Promise<{ tessera: string; rite: SwarmLeiRite; lei: string; n: number; begun: string }> {
  return beginChecked(wiki, await checkReturn(wiki, at, trust, group, vessel, ward));
}

/**
 * Begin a rite whose return `checkReturn` already judged: claim that return, then rest the guest half under the vessel the check
 * named. A kūkulu checks every lent face first and begins each only once all of them answer.
 */
export async function beginChecked(wiki: SwarmWikiPort, checked: SwarmReturnable): Promise<{ tessera: string; rite: SwarmLeiRite; lei: string; n: number; begun: string }> {
  const { at, group, spender: vessel } = checked;
  const ret = await claimReturn(wiki, checked);
  const tessera = tesseraOf(ret);
  const act = await signSwarmAct({ act: "rite-begun", group, rite: at.rite, branch: at.branch, head: at.head, tree: at.tree, lei: ret.lei, n: ret.n, tessera }, vessel);
  // One return claims one row, so one tessera: a guest half already resting names a return this vessel never made.
  if (!(await wiki.writeNew(swarmTesseraTitle(tessera, "guest"), JSON.stringify(act)))) throw new SwarmRefused("rite-begun-stands", `a guest half already rests for tessera ${tessera}`);
  return { tessera, rite: at.rite, lei: ret.lei, n: ret.n, begun: swarmActCid(act) };
}

/**
 * Land a rite: the vessel that stands after rests the host half, naming the begun half by its cid and the head it stands at.
 * The answer reads `par` where that head equals the head the rite began at. A landing writes once.
 */
export async function landRite(wiki: SwarmWikiPort, at: { readonly tessera: string; readonly head: string }, trust: SwarmTrust, group: string, vessel: SwarmSignerPort):
  Promise<{ tessera: string; rite: SwarmLeiRite; begun: string; landed: string; par: boolean }> {
  const guestTitle = swarmTesseraTitle(at.tessera, "guest");
  const guest = verifySwarmRecord(await wiki.read(guestTitle), guestTitle, trust, group);
  if (!guest.ok || guest.act.body.act !== "rite-begun") throw new SwarmRefused("rite-begun-absent", `no begun half stands for tessera ${at.tessera}${guest.ok ? "" : ` (${guest.refusal})`}`);
  if (!trust.vessel(vessel.key.toLowerCase())) throw new SwarmRefused("rite-land-role", "the vessel alone lands a rite");
  const begun = guest.act.body;
  const act = await signSwarmAct({ act: "rite-landed", group, rite: begun.rite, tessera: at.tessera, begun: guest.cid, head: at.head }, vessel);
  if (!(await wiki.writeNew(swarmTesseraTitle(at.tessera, "host"), JSON.stringify(act)))) throw new SwarmRefused("rite-already-landed", `a host half already rests for tessera ${at.tessera}`);
  return { tessera: at.tessera, rite: begun.rite, begun: guest.cid, landed: swarmActCid(act), par: begun.head === at.head };
}

type Half<B> = { readonly state: "absent" } | { readonly state: "refused" } | { readonly state: "ok"; readonly cid: string; readonly body: B };

async function halvesOf(wiki: SwarmWikiPort, trust: SwarmTrust, group: string): Promise<Map<string, { guest: Half<SwarmRiteBegunBody>; host: Half<SwarmRiteLandedBody> }>> {
  const prefix = swarmTesseraPrefix();
  const out = new Map<string, { guest: Half<SwarmRiteBegunBody>; host: Half<SwarmRiteLandedBody> }>();
  for (const title of [...await wiki.list(prefix)].sort()) {
    const [tessera, half, ...rest] = title.slice(prefix.length).split("/");
    if (!tessera || rest.length > 0 || (half !== "guest" && half !== "host")) continue;
    const entry = out.get(tessera) ?? { guest: { state: "absent" as const }, host: { state: "absent" as const } };
    const read = verifySwarmRecord(await wiki.read(title), title, trust, group);
    if (half === "guest") entry.guest = read.ok && read.act.body.act === "rite-begun" ? { state: "ok", cid: read.cid, body: read.act.body } : { state: "refused" };
    else entry.host = read.ok && read.act.body.act === "rite-landed" ? { state: "ok", cid: read.cid, body: read.act.body } : { state: "refused" };
    out.set(tessera, entry);
  }
  return out;
}

/** Conferre: match every tessera's halves. `par` holds the matched pairs; `red` holds every tessera that reads unmatched, by name. */
export async function conferre(wiki: SwarmWikiPort, trust: SwarmTrust, group: string): Promise<{ par: TesseraReading[]; red: TesseraReading[] }> {
  const par: TesseraReading[] = [], red: TesseraReading[] = [];
  for (const [tessera, { guest, host }] of await halvesOf(wiki, trust, group)) {
    const begun = guest.state === "ok" ? guest.cid : null, landed = host.state === "ok" ? host.cid : null;
    const rite = guest.state === "ok" ? guest.body.rite : host.state === "ok" ? host.body.rite : null;
    const why: TesseraRed | null =
      guest.state === "refused" ? "begun-refused"
      : host.state === "refused" ? "landed-refused"
      : guest.state === "absent" ? "begun-absent"
      : host.state === "absent" ? "landed-absent"
      : host.body.begun !== guest.cid ? "landed-names-another"
      : host.body.rite !== guest.body.rite ? "rite-differs"
      : host.body.head !== guest.body.head ? "head-differs"
      : null;
    const at = guest.state === "ok" ? { branch: guest.body.branch, head: guest.body.head } : {};
    if (why === null) par.push({ tessera, rite, begun, landed, ...at, par: true });
    else red.push({ tessera, rite, begun, landed, ...at, par: false, red: why });
  }
  return { par, red };
}

/** Every half that verifies, as the wake lists it: its act, its rite and its tessera. */
export async function riteReceipts(wiki: SwarmWikiPort, trust: SwarmTrust, group: string): Promise<{ act: "rite-begun" | "rite-landed"; rite: SwarmLeiRite; tessera: string }[]> {
  const out: { act: "rite-begun" | "rite-landed"; rite: SwarmLeiRite; tessera: string }[] = [];
  for (const [tessera, { guest, host }] of await halvesOf(wiki, trust, group)) {
    if (guest.state === "ok") out.push({ act: "rite-begun", rite: guest.body.rite, tessera });
    if (host.state === "ok") out.push({ act: "rite-landed", rite: host.body.rite, tessera });
  }
  return out;
}
