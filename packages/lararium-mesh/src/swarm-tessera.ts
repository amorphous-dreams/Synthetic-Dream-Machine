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
 * after `beginRite` answers: a rite with no lei or no return left begins nothing. A rite that dies after its
 * return leaves a begun half alone, and the lei's return stays spent. A crash between the return and the guest half leaves an
 * orphan return; the next begin at the same branch, head, tree and image reuses it (`checkReturn` finds it, even past the
 * lei's count), so a retry never spends twice.
 *
 * THE IMAGE BINDS A KŪKULU. A begin that names the image it raises rests it in the guest half, and the landing rests that image
 * (a caller naming another refuses `rite-land-differs`; an older off-par host half reads `image-differs`). A half resting unlanded reads as debt off its raw rows (`pendingBegins`),
 * whatever face's trust still verifies it; a landing ends it, or the hand sets it down.
 *
 * A BEGUN RITE SETS DOWN (the abandon, a kāpae over the half). A stale half (a tag-moved one, begun over an image the vessel
 * never ran) clears honestly by the hand's abandon, never by a hand landing that records par over that image. `abandonRite`
 * rests `tessera/<tessera>/abandoned` beside the half: the vessel's witness of the hand's act (`by: "hand"`; the one hand gate
 * admits the act before the row runs), binding the guest half's own cid. The half stays (a tombstone, never a delete), its
 * return stays spent and no new one spends, no host half rests, and no landing takes it after (`rite-abandoned`); the debt read
 * passes it, so the face begins fresh. Conferre reads it `abandoned`, apart from `par` and `red`. A mark that verifies as none
 * (another key's, or one over another guest) ends nothing.
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
  SwarmRefused, checkReturn, claimReturn, signSwarmAct, swarmActCid, swarmLeiUnstrungTitle, swarmTesseraPrefix, swarmTesseraTitle, verifySwarmRecord,
  type SignedSwarmAct, type SwarmLeiLine, type SwarmReturnable, type SwarmRiteAbandonedBody, type SwarmRiteBegunBody, type SwarmRiteLandedBody, type SwarmSignerPort, type SwarmTrust, type SwarmWikiPort,
} from "./swarm-tiddlers.js";
import type { WardActWitness } from "./ward-cosign.js";

/** The tessera one return of one lei takes. */
export const tesseraOf = (ret: { readonly lei: string; readonly n: number }): string => sha256HexBytesSync(canonicalJsonBytes({ lei: ret.lei, n: ret.n }));

export type TesseraRed = "landed-absent" | "head-differs" | "image-differs" | "rite-differs" | "landed-names-another" | "begun-absent" | "begun-refused" | "landed-refused";
/**
 * One tessera as conferre reads it: each half by its record's cid (null where none verifies), and `par` for a match. Where the
 * begun half verifies, the reading names the branch and head that half began at, so a seat that owes a landing finds its own.
 * A half the hand set down names its mark's cid (`abandoned`).
 */
export interface TesseraReading {
  readonly tessera: string; readonly rite: SwarmLeiRite | null; readonly begun: string | null; readonly landed: string | null; readonly abandoned?: string;
  readonly branch?: string; readonly head?: string; readonly image?: string;
  readonly par: boolean; readonly red?: TesseraRed;
}

/**
 * Begin a rite: return its lei at this head (the count and the reach all judged there, `returnLei`), then rest
 * the guest half. The answer names the tessera; the caller takes the vessel down only after it.
 */
export async function beginRite(wiki: SwarmWikiPort, at: SwarmLeiLine & { readonly head: string; readonly tree: string; readonly image?: string }, trust: SwarmTrust, group: string, vessel: SwarmSignerPort, ward: WardActWitness):
  Promise<{ tessera: string; rite: SwarmLeiRite; lei: string; n: number; begun: string }> {
  return beginChecked(wiki, await checkReturn(wiki, at, trust, group, vessel, ward, undefined, { orphan: true }));
}

/**
 * Begin a rite whose return `checkReturn` already judged: claim that return, then rest the guest half under the vessel the check
 * named. A kūkulu checks every lent face first and begins each only once all of them answer.
 */
export async function beginChecked(wiki: SwarmWikiPort, checked: SwarmReturnable): Promise<{ tessera: string; rite: SwarmLeiRite; lei: string; n: number; begun: string }> {
  const { at, group, spender: vessel } = checked;
  // ONE RETURN PER BEGIN: a return this vessel claimed at this branch, head, tree and image whose guest half never rested (a
  // crash between the two writes; `checkReturn` found it, even past the lei's count) pays for this begin, never a second claim.
  const ret = checked.orphan === undefined ? await claimReturn(wiki, checked) : { lei: checked.lei.cid, n: checked.orphan };
  const tessera = tesseraOf(ret);
  const act = await signSwarmAct({ act: "rite-begun", group, rite: at.rite, branch: at.branch, head: at.head, tree: at.tree, lei: ret.lei, n: ret.n, tessera, ...(at.image === undefined ? {} : { image: at.image }) }, vessel);
  // One return claims one row, so one tessera: a guest half already resting names a return this vessel never made.
  if (!(await wiki.writeNew(swarmTesseraTitle(tessera, "guest"), JSON.stringify(act)))) throw new SwarmRefused("rite-begun-stands", `a guest half already rests for tessera ${tessera}`);
  return { tessera, rite: at.rite, lei: ret.lei, n: ret.n, begun: swarmActCid(act) };
}

/**
 * Land a rite: the vessel that stands after rests the host half, naming the begun half by its cid and the head and image THAT
 * HALF names (operator ruling 2026-11-25), never the caller's: a caller that names another head, or another image where the half
 * names one, refuses `rite-land-differs` and rests nothing, so no seat lands a wrong head first and blocks the true landing. The
 * answer reads `par`; conferre still reads an off-par host half an older vessel rested red. A landing writes once.
 */
export async function landRite(wiki: SwarmWikiPort, at: { readonly tessera: string; readonly head?: string; readonly image?: string }, trust: SwarmTrust, group: string, vessel: SwarmSignerPort):
  Promise<{ tessera: string; rite: SwarmLeiRite; begun: string; landed: string; par: boolean }> {
  const guestTitle = swarmTesseraTitle(at.tessera, "guest");
  const guest = verifySwarmRecord(await wiki.read(guestTitle), guestTitle, trust, group);
  if (!guest.ok || guest.act.body.act !== "rite-begun") throw new SwarmRefused("rite-begun-absent", `no begun half stands for tessera ${at.tessera}${guest.ok ? "" : ` (${guest.refusal})`}`);
  if (!trust.vessel(vessel.key.toLowerCase())) throw new SwarmRefused("rite-land-role", "the vessel alone lands a rite");
  // NO PAR OVER A HALF SET DOWN: the hand's abandon ended it, so no landing records a match over it.
  if (await markOf(wiki, at.tessera, guest.cid, (key) => trust.vessel(key), group) !== null) throw new SwarmRefused("rite-abandoned", `the hand set tessera ${at.tessera} down, so no landing takes it; a fresh begin raises the rite again`);
  const begun = guest.act.body;
  // THE BEGUN HALF NAMES WHAT LANDS: a caller's head or image that reads otherwise refuses, and the host half never rests.
  const differs = [
    ...(at.head !== undefined && at.head !== begun.head ? [`head ${at.head} (the half began at ${begun.head})`] : []),
    ...(at.image !== undefined && begun.image !== undefined && at.image !== begun.image ? [`image ${at.image} (the half began over ${begun.image})`] : []),
  ];
  if (differs.length > 0) throw new SwarmRefused("rite-land-differs", `the landing of tessera ${at.tessera} names ${differs.join(" and ")}; a landing rests what its begun half names, so name none: lares rite land --tessera ${at.tessera}`);
  const act = await signSwarmAct({ act: "rite-landed", group, rite: begun.rite, tessera: at.tessera, begun: guest.cid, head: begun.head, ...(begun.image === undefined ? {} : { image: begun.image }) }, vessel);
  if (!(await wiki.writeNew(swarmTesseraTitle(at.tessera, "host"), JSON.stringify(act)))) throw new SwarmRefused("rite-already-landed", `a host half already rests for tessera ${at.tessera}`);
  return { tessera: at.tessera, rite: begun.rite, begun: guest.cid, landed: swarmActCid(act), par: true };
}

/**
 * THE MARK THAT ENDS A HALF: the `abandoned` row verifies as a `rite-abandoned` record of a key `vessel` admits, under `group`,
 * over this tessera and binding `begun` (the guest half's own cid). Answers its cid; null where none rests or it verifies as none.
 */
async function markOf(wiki: SwarmWikiPort, tessera: string, begun: string, vessel: (key: string) => boolean, group: string): Promise<string | null> {
  const title = swarmTesseraTitle(tessera, "abandoned");
  const text = await wiki.read(title);
  if (text === null) return null;
  const read = verifySwarmRecord(text, title, { hand: () => false, vessel: (key) => vessel(key.toLowerCase()), lead: () => false }, group);
  return read.ok && read.act.body.act === "rite-abandoned" && read.act.body.tessera === tessera && read.act.body.begun === begun ? read.cid : null;
}

/**
 * THE HAND SETS A BEGUN HALF DOWN: the vessel rests the `rite-abandoned` mark beside the guest half, binding its cid and naming
 * the hand, once the one hand gate admitted the act upstream. It spends no return and rests no host half. A tessera with no
 * begun half refuses `rite-begun-absent`, a landed one `rite-already-landed`, one already set down `rite-already-abandoned`, and
 * a key the face holds as no vessel `rite-abandon-role`. A row resting there that verifies as no mark yields to the hand's.
 */
export async function abandonRite(wiki: SwarmWikiPort, at: { readonly tessera: string }, trust: SwarmTrust, group: string, vessel: SwarmSignerPort):
  Promise<{ tessera: string; rite: SwarmLeiRite; branch: string; head: string; image?: string; begun: string; abandoned: string; by: "hand" }> {
  const guestTitle = swarmTesseraTitle(at.tessera, "guest");
  const guest = verifySwarmRecord(await wiki.read(guestTitle), guestTitle, trust, group);
  if (!guest.ok || guest.act.body.act !== "rite-begun") throw new SwarmRefused("rite-begun-absent", `no begun half stands for tessera ${at.tessera}${guest.ok ? "" : ` (${guest.refusal})`}`);
  if (!trust.vessel(vessel.key.toLowerCase())) throw new SwarmRefused("rite-abandon-role", "the vessel alone witnesses the hand's abandon");
  if ((await wiki.read(swarmTesseraTitle(at.tessera, "host"))) !== null) throw new SwarmRefused("rite-already-landed", `a host half already rests for tessera ${at.tessera}; a landed rite sets nothing down`);
  const title = swarmTesseraTitle(at.tessera, "abandoned");
  if (await markOf(wiki, at.tessera, guest.cid, (key) => trust.vessel(key), group) !== null) throw new SwarmRefused("rite-already-abandoned", `the hand already set tessera ${at.tessera} down`);
  const begun = guest.act.body;
  const body: SwarmRiteAbandonedBody = { act: "rite-abandoned", group, rite: begun.rite, branch: begun.branch, tessera: at.tessera, begun: guest.cid, by: "hand" };
  const act: SignedSwarmAct = await signSwarmAct(body, vessel);
  // A ROW THAT VERIFIES AS NO MARK (a forged one) holds no slot: the hand's own mark takes it.
  if (!(await wiki.writeNew(title, JSON.stringify(act)))) await wiki.write(title, JSON.stringify(act));
  return { tessera: at.tessera, rite: begun.rite, branch: begun.branch, head: begun.head, ...(begun.image === undefined ? {} : { image: begun.image }), begun: guest.cid, abandoned: swarmActCid(act), by: "hand" };
}

/**
 * One begun half resting with no host half, read off its raw rows: its tessera, group, line, head,
 * image and return, and `begun`, the guest half's own cid.
 */
export interface PendingBegin { readonly tessera: string; readonly group: string; readonly branch: string; readonly head: string; readonly image?: string; readonly lei: string; readonly n: number; readonly begun: string }

/**
 * THE DEBT, READ RAW: every begun half of `rite` on `branch` (every branch where none is named) resting with no host half,
 * save a half whose paying lei the hand unstrung (kāpae: the unstring tombstones the rite it paid for). It
 * reads the rows themselves, not under a face's trust, so a half whose face stands shut, or was rehived under a new
 * group since, still counts; it names debt, and lands nothing (a landing verifies under the face's own trust).
 */
export async function pendingBegins(wiki: SwarmWikiPort, rite: SwarmLeiRite, branch?: string): Promise<PendingBegin[]> {
  const prefix = swarmTesseraPrefix();
  const halves = new Map<string, Set<string>>();
  for (const title of await wiki.list(prefix)) {
    const [tessera, half, ...rest] = title.slice(prefix.length).split("/");
    if (!tessera || !half || rest.length > 0) continue;
    halves.set(tessera, (halves.get(tessera) ?? new Set()).add(half));
  }
  const out: PendingBegin[] = [];
  for (const [tessera, set] of [...halves].sort(([a], [b]) => a.localeCompare(b))) {
    if (!set.has("guest") || set.has("host")) continue;
    let guest: { body: Record<string, unknown>; signer: string };
    try { guest = JSON.parse((await wiki.read(swarmTesseraTitle(tessera, "guest"))) ?? "null") as { body: Record<string, unknown>; signer: string }; } catch { continue; }
    const body = guest?.body;
    if (body?.["act"] !== "rite-begun" || body["rite"] !== rite || body["tessera"] !== tessera) continue;
    if (typeof body["group"] !== "string" || typeof body["branch"] !== "string" || typeof body["head"] !== "string" || typeof body["lei"] !== "string" || typeof body["n"] !== "number") continue;
    if (branch !== undefined && body["branch"] !== branch) continue;
    // KĀPAE (operator ruling 2026-11-25): a half whose paying lei the hand unstrung reads tombstoned, so it stands as no debt and
    // the face begins afresh under a fresh lei. Any row at the unstrung title counts, as `readLei` counts it.
    if ((await wiki.read(swarmLeiUnstrungTitle(body["lei"]))) !== null) continue;
    const begun = swarmActCid(guest as unknown as Parameters<typeof swarmActCid>[0]);
    // A HALF THE HAND SET DOWN owes nothing: its mark verifies as the very key that signed the guest half, over its own cid.
    if (set.has("abandoned") && typeof guest.signer === "string" && await markOf(wiki, tessera, begun, (key) => key === guest.signer.toLowerCase(), body["group"]) !== null) continue;
    out.push({ tessera, group: body["group"], branch: body["branch"], head: body["head"], ...(typeof body["image"] === "string" ? { image: body["image"] } : {}), lei: body["lei"], n: body["n"], begun });
  }
  return out;
}

type Half<B> = { readonly state: "absent" } | { readonly state: "refused" } | { readonly state: "ok"; readonly cid: string; readonly body: B };

type Halves = { guest: Half<SwarmRiteBegunBody>; host: Half<SwarmRiteLandedBody>; abandoned?: string };

async function halvesOf(wiki: SwarmWikiPort, trust: SwarmTrust, group: string): Promise<Map<string, Halves>> {
  const prefix = swarmTesseraPrefix();
  const out = new Map<string, Halves>();
  for (const title of [...await wiki.list(prefix)].sort()) {
    const [tessera, half, ...rest] = title.slice(prefix.length).split("/");
    if (!tessera || rest.length > 0 || (half !== "guest" && half !== "host")) continue;
    const entry = out.get(tessera) ?? { guest: { state: "absent" as const }, host: { state: "absent" as const } };
    const read = verifySwarmRecord(await wiki.read(title), title, trust, group);
    if (half === "guest") entry.guest = read.ok && read.act.body.act === "rite-begun" ? { state: "ok", cid: read.cid, body: read.act.body } : { state: "refused" };
    else entry.host = read.ok && read.act.body.act === "rite-landed" ? { state: "ok", cid: read.cid, body: read.act.body } : { state: "refused" };
    out.set(tessera, entry);
  }
  // THE SET-DOWN MARK reads under the face's own trust, over the guest half's own cid; one that verifies as none ends nothing.
  for (const [tessera, entry] of out) {
    if (entry.guest.state !== "ok" || entry.host.state !== "absent") continue;
    const mark = await markOf(wiki, tessera, entry.guest.cid, (key) => trust.vessel(key), group);
    if (mark !== null) entry.abandoned = mark;
  }
  return out;
}

/**
 * Conferre: match every tessera's halves. `par` holds the matched pairs; `red` holds every tessera that reads unmatched, by name;
 * `abandoned` holds every begun half the hand set down (no match owed, none recorded).
 */
export async function conferre(wiki: SwarmWikiPort, trust: SwarmTrust, group: string): Promise<{ par: TesseraReading[]; red: TesseraReading[]; abandoned: TesseraReading[] }> {
  const par: TesseraReading[] = [], red: TesseraReading[] = [], abandoned: TesseraReading[] = [];
  for (const [tessera, { guest, host, abandoned: mark }] of await halvesOf(wiki, trust, group)) {
    const begun = guest.state === "ok" ? guest.cid : null, landed = host.state === "ok" ? host.cid : null;
    const rite = guest.state === "ok" ? guest.body.rite : host.state === "ok" ? host.body.rite : null;
    if (mark !== undefined && guest.state === "ok") {
      abandoned.push({ tessera, rite, begun, landed: null, abandoned: mark, branch: guest.body.branch, head: guest.body.head, ...(guest.body.image === undefined ? {} : { image: guest.body.image }), par: false });
      continue;
    }
    const why: TesseraRed | null =
      guest.state === "refused" ? "begun-refused"
      : host.state === "refused" ? "landed-refused"
      : guest.state === "absent" ? "begun-absent"
      : host.state === "absent" ? "landed-absent"
      : host.body.begun !== guest.cid ? "landed-names-another"
      : host.body.rite !== guest.body.rite ? "rite-differs"
      : host.body.head !== guest.body.head ? "head-differs"
      : guest.body.image !== undefined && host.body.image !== guest.body.image ? "image-differs"
      : null;
    const at = guest.state === "ok" ? { branch: guest.body.branch, head: guest.body.head, ...(guest.body.image === undefined ? {} : { image: guest.body.image }) } : {};
    if (why === null) par.push({ tessera, rite, begun, landed, ...at, par: true });
    else red.push({ tessera, rite, begun, landed, ...at, par: false, red: why });
  }
  return { par, red, abandoned };
}

/** Every half that verifies, as the wake lists it: its act, its rite and its tessera; a half the hand set down adds its mark. */
export async function riteReceipts(wiki: SwarmWikiPort, trust: SwarmTrust, group: string): Promise<{ act: "rite-begun" | "rite-landed" | "rite-abandoned"; rite: SwarmLeiRite; tessera: string }[]> {
  const out: { act: "rite-begun" | "rite-landed" | "rite-abandoned"; rite: SwarmLeiRite; tessera: string }[] = [];
  for (const [tessera, { guest, host, abandoned }] of await halvesOf(wiki, trust, group)) {
    if (guest.state === "ok") out.push({ act: "rite-begun", rite: guest.body.rite, tessera });
    if (host.state === "ok") out.push({ act: "rite-landed", rite: host.body.rite, tessera });
    if (guest.state === "ok" && abandoned !== undefined) out.push({ act: "rite-abandoned", rite: guest.body.rite, tessera });
  }
  return out;
}
