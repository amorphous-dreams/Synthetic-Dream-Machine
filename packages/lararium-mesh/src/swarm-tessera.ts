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
 * THE IMAGE BINDS A KŪKULU. A begin that names the image it raises rests it in the guest half, and a landing reads par only
 * over the same image (`image-differs` otherwise). A half resting unlanded reads as debt off its raw rows (`pendingBegins`),
 * whatever face's trust still verifies it, and only the hand's `rite-abandoned` mark ends it unlanded (`abandoned`).
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
  SwarmRefused, checkReturn, claimReturn, signSwarmAct, swarmActCid, swarmLeiRecordTitle, swarmTesseraPrefix, swarmTesseraTitle, verifySwarmRecord,
  type SwarmLeiLine, type SwarmReturnable, type SwarmRiteBegunBody, type SwarmRiteLandedBody, type SwarmSignerPort, type SwarmTrust, type SwarmWikiPort,
} from "./swarm-tiddlers.js";
import type { WardActWitness } from "./ward-cosign.js";

/** The tessera one return of one lei takes. */
export const tesseraOf = (ret: { readonly lei: string; readonly n: number }): string => sha256HexBytesSync(canonicalJsonBytes({ lei: ret.lei, n: ret.n }));

export type TesseraRed = "landed-absent" | "abandoned" | "retired" | "head-differs" | "image-differs" | "rite-differs" | "landed-names-another" | "begun-absent" | "begun-refused" | "landed-refused";
/**
 * One tessera as conferre reads it: each half by its record's cid (null where none verifies), and `par` for a match. Where the
 * begun half verifies, the reading names the branch and head that half began at, so a seat that owes a landing finds its own.
 */
export interface TesseraReading {
  readonly tessera: string; readonly rite: SwarmLeiRite | null; readonly begun: string | null; readonly landed: string | null;
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
 * Land a rite: the vessel that stands after rests the host half, naming the begun half by its cid, the head it stands at, and
 * the image it stands from where the caller names one. The answer reads `par` where that head equals the head the rite began
 * at and, where the begin named an image, the landing names the same one. A landing writes once, and never over an abandoned half.
 */
export async function landRite(wiki: SwarmWikiPort, at: { readonly tessera: string; readonly head: string; readonly image?: string }, trust: SwarmTrust, group: string, vessel: SwarmSignerPort, retire?: RetireContext):
  Promise<{ tessera: string; rite: SwarmLeiRite; begun: string; landed: string; par: boolean }> {
  const guestTitle = swarmTesseraTitle(at.tessera, "guest");
  const guest = verifySwarmRecord(await wiki.read(guestTitle), guestTitle, trust, group);
  if (!guest.ok || guest.act.body.act !== "rite-begun") throw new SwarmRefused("rite-begun-absent", `no begun half stands for tessera ${at.tessera}${guest.ok ? "" : ` (${guest.refusal})`}`);
  if (!trust.vessel(vessel.key.toLowerCase())) throw new SwarmRefused("rite-land-role", "the vessel alone lands a rite");
  if (await abandonMarkStands(wiki, at.tessera)) throw new SwarmRefused("rite-abandoned", `the hand abandoned tessera ${at.tessera}, so no landing takes it`);
  if (await retireMarkStands(wiki, at.tessera, retire)) throw new SwarmRefused("rite-retired", `seat zero set tessera ${at.tessera} aside, so no landing takes it`);
  const begun = guest.act.body;
  const act = await signSwarmAct({ act: "rite-landed", group, rite: begun.rite, tessera: at.tessera, begun: guest.cid, head: at.head, ...(at.image === undefined ? {} : { image: at.image }) }, vessel);
  if (!(await wiki.writeNew(swarmTesseraTitle(at.tessera, "host"), JSON.stringify(act)))) throw new SwarmRefused("rite-already-landed", `a host half already rests for tessera ${at.tessera}`);
  return { tessera: at.tessera, rite: begun.rite, begun: guest.cid, landed: swarmActCid(act), par: begun.head === at.head && (begun.image === undefined || begun.image === at.image) };
}

/**
 * One begun half resting with no host half and no abandon that verifies, read off its raw rows: its tessera, group, line, head,
 * image and return, and `begun`, the guest half's own cid an abandon mark binds.
 */
export interface PendingBegin { readonly tessera: string; readonly group: string; readonly branch: string; readonly head: string; readonly image?: string; readonly lei: string; readonly n: number; readonly begun: string }

/**
 * WHETHER AN ABANDON MARK ENDS A HALF: the mark's text verifies as a `rite-abandoned` record over this tessera, binding the guest
 * half's own cid and its group, signed by the very root that strung the lei the half spent (that lei's record verifying at its own
 * title, its cid the one the half names). A mark another hand signed, the vessel signed, or one over another guest reads as none.
 */
export async function abandonMarkVerifies(wiki: SwarmWikiPort, tessera: string, markText: string): Promise<boolean> {
  let guest: { body?: Record<string, unknown>; signer?: unknown } | null;
  try { guest = JSON.parse((await wiki.read(swarmTesseraTitle(tessera, "guest"))) ?? "null"); } catch { return false; }
  const g = guest?.body;
  if (!g || g["act"] !== "rite-begun" || typeof g["lei"] !== "string" || typeof g["group"] !== "string" || typeof g["branch"] !== "string" || typeof guest!.signer !== "string") return false;
  if (g["rite"] !== "kukulu" && g["rite"] !== "push" && g["rite"] !== "keep" && g["rite"] !== "exec") return false;
  const guestCid = swarmActCid(guest as unknown as Parameters<typeof swarmActCid>[0]);
  const leiTitle = swarmLeiRecordTitle(g["rite"] as SwarmLeiRite, g["branch"], g["lei"]);
  const leiText = await wiki.read(leiTitle);
  let leiSigner: string;
  try { leiSigner = String((JSON.parse(leiText ?? "null") as { signer?: unknown }).signer ?? "").toLowerCase(); } catch { return false; }
  if (leiSigner === "") return false;
  const root: SwarmTrust = { hand: (key) => key.toLowerCase() === leiSigner, vessel: () => false, lead: () => false };
  const lei = verifySwarmRecord(leiText, leiTitle, root, g["group"]);
  if (!lei.ok || lei.cid !== g["lei"]) return false;
  const mark = verifySwarmRecord(markText, swarmTesseraTitle(tessera, "abandoned"), root, g["group"]);
  return mark.ok && mark.act.body.act === "rite-abandoned" && mark.act.body.tessera === tessera && mark.act.body.begun === guestCid;
}

/** What a reader names to honour seat zero's retire marks: seat zero's root key, and the house the marks must bind. */
export interface RetireContext { readonly seatZero: string; readonly house: string }

/**
 * WHETHER SEAT ZERO'S RETIRE MARK ENDS A HALF: the mark's text verifies as a `rite-retired` record signed by seat zero's root (the
 * reader names it), binding this house, the half's group, branch, tessera and guest cid, and the root that strung the half's lei.
 * With no context a reader honours none.
 */
export async function retireMarkVerifies(wiki: SwarmWikiPort, tessera: string, markText: string, ctx: RetireContext | undefined): Promise<boolean> {
  if (ctx === undefined) return false;
  let guest: { body?: Record<string, unknown>; signer?: unknown } | null;
  try { guest = JSON.parse((await wiki.read(swarmTesseraTitle(tessera, "guest"))) ?? "null"); } catch { return false; }
  const g = guest?.body;
  if (!g || g["act"] !== "rite-begun" || typeof g["lei"] !== "string" || typeof g["group"] !== "string" || typeof g["branch"] !== "string" || typeof guest!.signer !== "string") return false;
  if (g["rite"] !== "kukulu" && g["rite"] !== "push" && g["rite"] !== "keep" && g["rite"] !== "exec") return false;
  let leiRoot: string;
  try { leiRoot = String((JSON.parse((await wiki.read(swarmLeiRecordTitle(g["rite"] as SwarmLeiRite, g["branch"], g["lei"]))) ?? "null") as { signer?: unknown }).signer ?? "").toLowerCase(); } catch { return false; }
  const seat = ctx.seatZero.toLowerCase();
  const read = verifySwarmRecord(markText, swarmTesseraTitle(tessera, "retired"), { hand: (key) => key.toLowerCase() === seat, vessel: () => false, lead: () => false }, g["group"]);
  if (!read.ok || read.act.body.act !== "rite-retired") return false;
  const b = read.act.body;
  return b.tessera === tessera && b.begun === swarmActCid(guest as unknown as Parameters<typeof swarmActCid>[0]) && b.branch === g["branch"] && b.house === ctx.house && b.root.toLowerCase() === leiRoot && leiRoot !== "";
}

/** Whether seat zero's retire mark resting beside a half verifies for this reader (`retireMarkVerifies`). */
export async function retireMarkStands(wiki: SwarmWikiPort, tessera: string, ctx?: RetireContext): Promise<boolean> {
  if (ctx === undefined) return false;
  const text = await wiki.read(swarmTesseraTitle(tessera, "retired"));
  return text !== null && retireMarkVerifies(wiki, tessera, text, ctx);
}

/** Whether the mark resting beside a half verifies (`abandonMarkVerifies`); no mark, or one that verifies as none, ends nothing. */
export async function abandonMarkStands(wiki: SwarmWikiPort, tessera: string): Promise<boolean> {
  const text = await wiki.read(swarmTesseraTitle(tessera, "abandoned"));
  return text !== null && abandonMarkVerifies(wiki, tessera, text);
}

/**
 * THE DEBT, READ RAW: every begun half of `rite` on `branch` (every branch where none is named) resting with no host half and no
 * abandon. It reads the rows themselves, not under a face's trust, so a half whose face stands shut, or was rehived under a new
 * group since, still counts; it names debt, and lands nothing (a landing verifies under the face's own trust).
 */
export async function pendingBegins(wiki: SwarmWikiPort, rite: SwarmLeiRite, branch?: string, retire?: RetireContext): Promise<PendingBegin[]> {
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
    // ONLY A MARK THAT VERIFIES ends the debt: the half's own root, over its own guest cid.
    if (set.has("abandoned") && await abandonMarkStands(wiki, tessera)) continue;
    if (set.has("retired") && await retireMarkStands(wiki, tessera, retire)) continue;
    let guest: { body: Record<string, unknown>; signer: string };
    try { guest = JSON.parse((await wiki.read(swarmTesseraTitle(tessera, "guest"))) ?? "null") as { body: Record<string, unknown>; signer: string }; } catch { continue; }
    const body = guest?.body;
    if (body?.["act"] !== "rite-begun" || body["rite"] !== rite || body["tessera"] !== tessera) continue;
    if (typeof body["group"] !== "string" || typeof body["branch"] !== "string" || typeof body["head"] !== "string" || typeof body["lei"] !== "string" || typeof body["n"] !== "number") continue;
    if (branch !== undefined && body["branch"] !== branch) continue;
    out.push({ tessera, group: body["group"], branch: body["branch"], head: body["head"], ...(typeof body["image"] === "string" ? { image: body["image"] } : {}), lei: body["lei"], n: body["n"], begun: swarmActCid(guest as unknown as Parameters<typeof swarmActCid>[0]) });
  }
  return out;
}

/**
 * THE HAND'S ABANDON: rest a `rite-abandoned` mark beside each pending half, by name, binding its guest cid, signed by `vessel`
 * (the caller hands the half's own face root: a mark any other key signs reads as none).
 * The half and its spent return stay; conferre reads it red `abandoned`, the debt read passes it, and no landing takes it.
 * Answers each tessera it marked.
 */
export async function abandonRites(wiki: SwarmWikiPort, pending: readonly PendingBegin[], vessel: SwarmSignerPort, rite: SwarmLeiRite = "kukulu"): Promise<string[]> {
  const out: string[] = [];
  for (const p of pending) {
    const act = await signSwarmAct({ act: "rite-abandoned", group: p.group, rite, branch: p.branch, tessera: p.tessera, begun: p.begun }, vessel);
    const title = swarmTesseraTitle(p.tessera, "abandoned"), text = JSON.stringify(act);
    if (await wiki.writeNew(title, text)) { out.push(p.tessera); continue; }
    // A MARK THAT VERIFIES TAKES THE SLOT an unverified one occupies (one the vessel signed, which verifies as none); a verified one stays.
    const resting = await wiki.read(title);
    if (resting !== null && await abandonMarkVerifies(wiki, p.tessera, resting)) continue;
    if (await abandonMarkVerifies(wiki, p.tessera, text)) { await wiki.write(title, text); out.push(p.tessera); }
  }
  return out;
}

type Half<B> = { readonly state: "absent" } | { readonly state: "refused" } | { readonly state: "ok"; readonly cid: string; readonly body: B };

async function halvesOf(wiki: SwarmWikiPort, trust: SwarmTrust, group: string): Promise<Map<string, { guest: Half<SwarmRiteBegunBody>; host: Half<SwarmRiteLandedBody>; abandoned?: true }>> {
  const prefix = swarmTesseraPrefix();
  const out = new Map<string, { guest: Half<SwarmRiteBegunBody>; host: Half<SwarmRiteLandedBody>; abandoned?: true }>();
  for (const title of [...await wiki.list(prefix)].sort()) {
    const [tessera, half, ...rest] = title.slice(prefix.length).split("/");
    if (!tessera || rest.length > 0 || (half !== "guest" && half !== "host" && half !== "abandoned")) continue;
    const entry = out.get(tessera) ?? { guest: { state: "absent" as const }, host: { state: "absent" as const } };
    if (half === "abandoned") { entry.abandoned = true; out.set(tessera, entry); continue; }
    const read = verifySwarmRecord(await wiki.read(title), title, trust, group);
    if (half === "guest") entry.guest = read.ok && read.act.body.act === "rite-begun" ? { state: "ok", cid: read.cid, body: read.act.body } : { state: "refused" };
    else entry.host = read.ok && read.act.body.act === "rite-landed" ? { state: "ok", cid: read.cid, body: read.act.body } : { state: "refused" };
    out.set(tessera, entry);
  }
  return out;
}

/** Conferre: match every tessera's halves. `par` holds the matched pairs; `red` holds every tessera that reads unmatched, by name. */
export async function conferre(wiki: SwarmWikiPort, trust: SwarmTrust, group: string, retire?: RetireContext): Promise<{ par: TesseraReading[]; red: TesseraReading[] }> {
  const par: TesseraReading[] = [], red: TesseraReading[] = [];
  for (const [tessera, { guest, host, abandoned }] of await halvesOf(wiki, trust, group)) {
    const begun = guest.state === "ok" ? guest.cid : null, landed = host.state === "ok" ? host.cid : null;
    const rite = guest.state === "ok" ? guest.body.rite : host.state === "ok" ? host.body.rite : null;
    const why: TesseraRed | null =
      guest.state === "refused" ? "begun-refused"
      : host.state === "refused" ? "landed-refused"
      : guest.state === "absent" ? "begun-absent"
      : host.state === "absent" ? (abandoned && await abandonMarkStands(wiki, tessera) ? "abandoned" : await retireMarkStands(wiki, tessera, retire) ? "retired" : "landed-absent")
      : host.body.begun !== guest.cid ? "landed-names-another"
      : host.body.rite !== guest.body.rite ? "rite-differs"
      : host.body.head !== guest.body.head ? "head-differs"
      : guest.body.image !== undefined && host.body.image !== guest.body.image ? "image-differs"
      : null;
    const at = guest.state === "ok" ? { branch: guest.body.branch, head: guest.body.head, ...(guest.body.image === undefined ? {} : { image: guest.body.image }) } : {};
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
