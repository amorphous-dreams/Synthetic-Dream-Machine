/**
 * rite — the store holder runs a rite's rows against the daemon wiki: `begin`, `land`, `receipts`.
 *
 * A rite that takes the vessel down keeps a tessera (a kūkulu keeps one per lent face and begins every face or none, `beginLentFaces`): `begin` derives the head's tree (out of the checkout's object store, `gitTreeOf`, no git binary; a `keep` derives its bundle id from the staged bundle itself, `riteTreeOf`), returns the
 * rite's lei at that head (the count and the reach judged in the mesh core; the signed lei, with a `push` lei's ward co-sign, stands as the consent) and rests the guest half BEFORE the caller takes the vessel down; `land` rests the
 * host half once a vessel stands again; `receipts` lists every half and runs conferre over them (`--rite kukulu` reads each
 * lent face's begun half resting unlanded on the line instead, `standingKukuluBegins`, and a kūkulu begin refuses
 * `rite-begun-stands` over any such half, so a re-run resumes and never spends a second return); `offer` gathers what a
 * kūkulu carries to the pūlama (the line's lei and this vessel's vouch over the image the host built) and rests it in the
 * house's config home for the next vessel (`kukulu-offer`).
 *
 * THE LEI CARRIES THE GRANT. No row here reads hand-only: the hand strung the lei under the ward, and any seat holding the
 * line may spend it.
 *
 * THE VESSEL SIGNS AS THIS DEVICE'S ATOM IN THE FACE. A return and each tessera half rest as the vessel's
 * witness, and a swarm record stays device-local, so the trust names this device's own atom as the vessel and no other key.
 *
 * With no standing daemon wiki every row refuses by name before a face loads.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import type { Repo } from "@automerge/automerge-repo";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, sep } from "node:path";
import {
  WORKSPACE_NAME_RE, SwarmRefused, beginChecked, beginRite, checkReturn, conferre, cosignPortWitness, isSwarmLeiRite, landRite, pendingBegins, riteReceipts,
  type SwarmLeiRite, type SwarmSignerPort, type SwarmTrust, type SwarmWikiPort, type TesseraReading,
} from "@lararium/mesh";
import { loadFaceFold, nodeWardCosignPortOf, IntentRefused, type FaceFold } from "./intent.js";
import { treeOfHead } from "../git-tree-reader.js";
import { openedCustody, unlockedFaceOrdinals } from "../custody-seat.js";
import { kukuluOfferPath, writeKukuluOffer, type KukuluOfferFace } from "../kukulu-offer.js";
import { larWorkspacesHome } from "../vessel-paths.js";
import { BundleVerifyRefused, unsafeRelPath, verifyBundle } from "../bundle-manifest.js";

export type RiteAction = "begin" | "land" | "receipts" | "offer";

/** Where the vessel looks for the checkout a rite's head belongs to: its own working directory, then the house's workspace mount. */
export const RITE_CHECKOUTS: readonly string[] = [process.cwd(), "/workspace"];

/**
 * THE VESSEL DERIVES THE HEAD'S TREE ITSELF. A return names the head's tree, and a lei pins a head the same way, so the tree never
 * comes from the caller. The vessel's image carries no git binary, so the vessel reads the checkout's object store directly
 * (`../git-tree-reader.ts`): the commit the head names, held to its own hash, and the tree that commit names. A head that
 * reads as no object name, a place with no checkout, or a head no store holds refuses `rite-tree-unreadable`: the rite begins
 * nothing rather than rest on a tree nobody derived.
 */
export const gitTreeOf = (head: string, checkouts: readonly string[] = RITE_CHECKOUTS): Promise<string> => treeOfHead(head, checkouts);

/**
 * THE STAGED BUNDLE A KEEP BEGINS OVER, read by this vessel: the keep cuts its bundle beside its dest inside the bound
 * workspace (`<workspaces>/<branch>/<staged>`), and the vessel reads every byte of it back against its manifest and derives the
 * bundle id over the file list (`verifyBundle`). A workspace name the grammar refuses, a staged path that escapes the
 * workspace, and a tree that reads as no whole bundle each refuse `rite-tree-unreadable`.
 */
export function keepStagedTree(branch: string, staged: string, home: string = larWorkspacesHome()): string {
  if (!WORKSPACE_NAME_RE.test(branch) || branch === "." || branch === "..") throw new SwarmRefused("rite-tree-unreadable", `a keep's branch names its workspace, and ${JSON.stringify(branch.slice(0, 80))} names none`);
  const unsafe = unsafeRelPath(staged);
  if (staged === "" || unsafe !== null) throw new SwarmRefused("rite-tree-unreadable", `a keep names its staged bundle by a plain path inside the workspace, and ${JSON.stringify(staged.slice(0, 80))} names ${unsafe ?? "none"}`);
  let ws: string, dir: string;
  try { ws = realpathSync(join(home, branch)); dir = realpathSync(join(ws, ...staged.split("/"))); }
  catch { throw new SwarmRefused("rite-tree-unreadable", `no staged bundle stands at ${staged} in the workspace "${branch}"`); }
  if (!dir.startsWith(ws + sep) || !lstatSync(dir).isDirectory()) throw new SwarmRefused("rite-tree-unreadable", `the staged path ${staged} resolves outside the workspace "${branch}" or to no directory`);
  try { return verifyBundle(dir).manifest.bundleId; }
  catch (e) { if (e instanceof BundleVerifyRefused) throw new SwarmRefused("rite-tree-unreadable", `the staged bundle reads unwhole: ${e.message}`); throw e; }
}

/**
 * THE TREE A RITE'S RETURN RESTS ON. A rite over the checkout (`push`, `kukulu`) reads its tree off the head through git. A
 * `keep` runs over no checkout: its head names a house bundle by its id (the sha-256 over the bundle's sorted file list), and
 * a content name already names its tree. THE VESSEL DERIVES THAT ID ITSELF from the staged bundle (`keepTree`), so a keep
 * never rests on an id its spender chose: a head that spells no bundle id, or a keep that names no staged bundle, refuses
 * `rite-tree-unreadable`; a staged tree that derives another id than the head refuses `rite-tree-differs`. The return
 * then names the id this vessel derived.
 */
export async function riteTreeOf(rite: SwarmLeiRite, head: string, gitTree: (head: string) => Promise<string> = gitTreeOf, keepTree?: () => string): Promise<string> {
  if (rite !== "keep") return gitTree(head);
  if (!/^[0-9a-f]{64}$/.test(head)) throw new SwarmRefused("rite-tree-unreadable", `a keep's head names a house bundle by its id (64 hex), and ${JSON.stringify(head.slice(0, 80))} spells none`);
  if (keepTree === undefined) throw new SwarmRefused("rite-tree-unreadable", "a keep names the bundle it staged (`staged`, a path inside its workspace), so the vessel derives the id itself");
  const derived = keepTree();
  if (derived !== head) throw new SwarmRefused("rite-tree-differs", `the staged bundle derives ${derived}, and the keep names ${head}; the vessel begins no keep over an id the tree never derived`);
  return derived;
}

/**
 * EVERY LENT FACE'S LINE RIDES THE OFFER. A kūkulu lends the next vessel the faces this one serves, so the offer gathers one
 * face per lent ordinal, in the lend's order, each named `h<ordinal>` and loaded through `face`. No lent face refuses
 * `lent-faces-empty`; a lent face whose log reads unloadable refuses `face-log-unreadable`, naming it, and the offer rests nothing.
 */
export async function lentOfferFaces(lent: readonly number[], face: (ordinal: number) => Promise<KukuluOfferFace>): Promise<KukuluOfferFace[]> {
  if (lent.length === 0) throw new SwarmRefused("lent-faces-empty", "the offer gathers the lent faces' lines, and this vessel serves no face");
  const out: KukuluOfferFace[] = [];
  for (const ordinal of lent) {
    let loaded: KukuluOfferFace;
    try { loaded = await face(ordinal); }
    catch (e) { if (e instanceof SwarmRefused) throw e; throw new SwarmRefused("face-log-unreadable", `the lent face h${ordinal} loads no log: ${e instanceof Error ? e.message : String(e)}`); }
    out.push({ ...loaded, name: `h${ordinal}` });
  }
  return out;
}

/** One begun face of a kūkulu: its name and ordinal beside what its rite's begin answered. */
export interface BegunFace { readonly face: string; readonly ordinal: number; readonly tessera: string; readonly lei: string; readonly n: number; readonly begun: string }

/**
 * ONE LEI PER LENT FACE, ALL OR NONE. A kūkulu lends the next vessel every face this one serves, so it begins one rite per lent
 * ordinal, in the lend's order, each spending that face's own lei under that face's own hand. It CHECKS every face first
 * (`check`: the lei stands with a return left) and claims nothing; only once every
 * face answers does it claim each face's return and rest its guest half (`begin`). A face whose lei is missing
 * (`swarm-lei-absent`, or `swarm-lei-group` where only other faces' leis rest on the line) waits by name, as at the offer
 * and the pūlama; with every face waiting the begin refuses
 * `swarm-lei-absent` naming them. Any other reading refuses the whole begin, naming that face, before any face's return is
 * claimed. No lent face refuses
 * `lent-faces-empty`.
 */
export async function beginLentFaces<C>(
  lent: readonly number[],
  check: (ordinal: number) => Promise<C>,
  begin: (checked: C) => Promise<{ readonly tessera: string; readonly lei: string; readonly n: number; readonly begun: string }>,
): Promise<{ readonly rite: "kukulu"; readonly faces: readonly BegunFace[]; readonly waits: readonly string[] }> {
  if (lent.length === 0) throw new SwarmRefused("lent-faces-empty", "a kūkulu begins over the lent faces, and this vessel serves no face");
  const checked: { ordinal: number; checked: C }[] = [], waits: string[] = [];
  for (const ordinal of lent) {
    try { checked.push({ ordinal, checked: await check(ordinal) }); }
    catch (e) {
      if (!(e instanceof SwarmRefused)) throw e;
      // ONE LINE, EVERY LENT FACE'S LEI: each face's kukulu lei rests under the branch's one line on the shared wiki, so a face
      // whose hand strung none there reads the other faces' rows as another group's. That face has no lei here, and waits.
      if (e.code === "swarm-lei-absent" || e.code === "swarm-lei-group") { waits.push(`h${ordinal}`); continue; }
      throw new SwarmRefused(e.code, `the lent face h${ordinal} refuses, so no face's return is claimed: ${e.message}`);
    }
  }
  if (checked.length === 0) throw new SwarmRefused("swarm-lei-absent", `no kukulu lei of its own hand stands for any lent face (${waits.join(", ")}), so this kūkulu begins nothing`);
  const faces: BegunFace[] = [];
  for (const { ordinal, checked: c } of checked) {
    const b = await begin(c);
    faces.push({ face: `h${ordinal}`, ordinal, tessera: b.tessera, lei: b.lei, n: b.n, begun: b.begun });
  }
  return { rite: "kukulu", faces, waits };
}

/** One kūkulu guest half that rests with no host half: the face, its ordinal, its tessera, and the line and head it began at. */
export interface StandingBegin { readonly face: string; readonly ordinal: number; readonly tessera: string; readonly branch: string; readonly head: string; readonly image?: string }

/**
 * THE BEGIN THAT STANDS. A kūkulu whose raise never landed (a Ctrl+C at the census, the light or the admit; a restand that
 * stopped) leaves each lent face's guest half resting with no host half. Conferre reads it per lent face as a tessera red
 * `landed-absent`; this gathers every such kūkulu half on the branch's line (every line where none is named), each named by
 * its face. No lent face reads nothing standing, and the begin speaks its own refusal.
 */
export async function standingKukuluBegins(lent: readonly number[], red: (ordinal: number) => Promise<readonly TesseraReading[]>, branch?: string): Promise<StandingBegin[]> {
  const out: StandingBegin[] = [];
  for (const ordinal of lent) {
    for (const t of await red(ordinal)) {
      if (t.red !== "landed-absent" || t.rite !== "kukulu" || t.branch === undefined || t.head === undefined) continue;
      if (branch !== undefined && t.branch !== branch) continue;
      out.push({ face: `h${ordinal}`, ordinal, tessera: t.tessera, branch: t.branch, head: t.head, ...(t.image === undefined ? {} : { image: t.image }) });
    }
  }
  return out;
}

/**
 * ONE BEGIN PER RAISE. A kūkulu begun on this line and never landed already spent each face's return; a second begin would
 * spend another and mint new tesserae beside the first. So the begin refuses `rite-begun-stands` over the raw debt (a half whose
 * face stands shut or was rehived counts too), naming each half by its face or its group, and `lares rite kukulu` resumes it
 * (where it matches the run) or names the hand landing that sets it down.
 */
export function refuseStandingBegin(standing: ReadonlyArray<{ readonly tessera: string; readonly branch: string; readonly head: string; readonly face?: string; readonly group?: string }>): void {
  if (standing.length === 0) return;
  const heads = [...new Set(standing.map((s) => s.head.slice(0, 12)))].join(", ");
  const branch = standing[0]!.branch;
  throw new SwarmRefused("rite-begun-stands", `a kūkulu begun at ${heads} on "${branch}" stands unlanded (${standing.map((s) => `${s.face ?? s.group ?? "a face"} tessera ${s.tessera}`).join(", ")}); \`lares rite kukulu\` resumes it and spends no second return, or land it by hand where the vessel stands (\`lares rite land --tessera <tessera> --head <the head the vessel runs>\`; conferre reads it red)`);
}

/** One vouch the resting offer carries: the face whose group it names (where a lent face carries it), and its line, head and image. */
export interface OfferVouch { readonly face?: string; readonly group: string; readonly branch: string; readonly head: string; readonly image: string }

/**
 * THE RESTING OFFER, READ BACK: each vouch in the offer file's text, named by the lent face whose group it carries, so the host
 * reuses the offer only where its vouches match the pending halves (group, line, head and image). A text that reads as no offer
 * (absent, or no JSON) reads null; a vouch that names no group, line, head and image is skipped.
 */
export function offerVouchesOf(text: string | null, faceOfGroup: ReadonlyMap<string, string>): OfferVouch[] | null {
  if (text === null) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return null; }
  const vouch = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>)["vouch"] : undefined;
  if (!Array.isArray(vouch)) return null;
  const out: OfferVouch[] = [];
  for (const v of vouch) {
    const b = typeof v === "object" && v !== null ? (v as Record<string, unknown>)["body"] as Record<string, unknown> | undefined : undefined;
    if (!b || typeof b["group"] !== "string" || typeof b["branch"] !== "string" || typeof b["head"] !== "string" || typeof b["image"] !== "string") continue;
    const face = faceOfGroup.get(b["group"]);
    out.push({ ...(face === undefined ? {} : { face }), group: b["group"], branch: b["branch"], head: b["head"], image: b["image"] });
  }
  return out;
}

/** One lent face as a kūkulu row reads it: the offer's parts beside the device atom that signs its rite's halves. */
type RiteFace = KukuluOfferFace & { readonly vessel: SwarmSignerPort };

/** One loaded face: its group, the trust its hand and this device's atom verify under, its ward witness, and that atom. */
async function riteFaceOf(repo: Repo, catalogUrl: string | undefined, ordinal: number): Promise<RiteFace> {
  let fold: FaceFold;
  try { fold = await loadFaceFold(repo, catalogUrl, { index: ordinal }); }
  catch (e) { if (e instanceof IntentRefused) throw new SwarmRefused("face-log-unreadable", `h${ordinal}: ${e.message}`); throw e; }
  const vesselKey = fold.signer.key.toLowerCase();
  const trust: SwarmTrust = { hand: (key) => fold.face.currentSigner(key), vessel: (key) => key === vesselKey, lead: () => false };
  const vessel: SwarmSignerPort = { key: fold.signer.key, sign: (bytes) => fold.signer.sign(bytes) };
  try { return { group: fold.group, trust, vessel, ward: cosignPortWitness(await nodeWardCosignPortOf(repo, fold)) }; }
  catch (e) { if (e instanceof IntentRefused) throw new SwarmRefused("face-log-unreadable", `h${ordinal}: ${e.message}`); throw e; }
}

export async function runRiteVerb(opts: {
  repo: Repo; catalogUrl?: string; face?: number; action: RiteAction;
  args: Readonly<Record<string, unknown>>; wiki?: SwarmWikiPort;
  /** The head's tree, as this vessel derives it; `gitTreeOf` where the caller seats none. */
  treeOf?: (head: string) => Promise<string>;
  /** Where an `offer` rests; the house's config home where the caller seats none. */
  offerPath?: string;
  /** Where a keep's workspaces stand; the house's workspaces home where the caller seats none. */
  workspacesHome?: string;
  /** The faces this vessel serves, by ordinal; the custody seat's unlocked faces where the caller seats none. */
  lentOrdinals?: () => Promise<readonly number[]>;
}): Promise<Record<string, unknown>> {
  if (!opts.wiki) throw new SwarmRefused("swarm-no-daemon", "no standing daemon: a rite's records need the founded wiki");
  const str = (key: string): string => (typeof opts.args[key] === "string" ? opts.args[key] as string : "");
  if (opts.action === "offer") {
    // THE OFFER A KŪKULU CARRIES TO THE PŪLAMA: this vessel, still standing, gathers every lent face's line and signs one vouch
    // per face over the image the host named, then rests them where the next vessel reads them (`kukulu-offer`). It loads each
    // lent face itself, so no one face loads first.
    if (!str("branch") || !str("head") || !str("image")) throw new SwarmRefused("rite-offer-malformed", "an offer names its branch, its head and the image the host built");
    const offerTree = await (opts.treeOf ?? gitTreeOf)(str("head"));
    const faces = await lentOfferFaces(await (opts.lentOrdinals ?? unlockedFaceOrdinals)(), (ordinal) => riteFaceOf(opts.repo, opts.catalogUrl, ordinal));
    return { ...await writeKukuluOffer({
      wiki: opts.wiki, faces, branch: str("branch"), head: str("head"), tree: offerTree, image: str("image"),
      holder: await openedCustody(), path: opts.offerPath ?? kukuluOfferPath(),
    }) };
  }
  const wiki = opts.wiki;
  /** Each lent face's tesserae conferre reads red, under that face's own trust. */
  const redOf = async (ordinal: number): Promise<readonly TesseraReading[]> => {
    const face = await riteFaceOf(opts.repo, opts.catalogUrl, ordinal);
    return (await conferre(wiki, face.trust, face.group)).red;
  };
  /** Each lent face's group, named by its face, so a raw row (a pending half, a vouch) names the face that carries it. */
  const facesOfGroups = async (lent: readonly number[]): Promise<Map<string, string>> => {
    const out = new Map<string, string>();
    for (const ordinal of lent) out.set((await riteFaceOf(opts.repo, opts.catalogUrl, ordinal)).group, `h${ordinal}`);
    return out;
  };
  const branchOrAll = str("branch") || undefined;
  if (opts.action === "receipts" && opts.args["rite"] === "kukulu") {
    // THE KŪKULU'S STANDING READ: the raw debt (every half resting unlanded on the line, whatever face still verifies it), the
    // halves a lent face lands, and the resting offer's vouches, so the host resumes only what matches, and never re-begins.
    const lent = await (opts.lentOrdinals ?? unlockedFaceOrdinals)();
    const faceOf = await facesOfGroups(lent);
    const pending = (await pendingBegins(wiki, "kukulu", branchOrAll)).map((p) => ({ ...p, ...(faceOf.has(p.group) ? { face: faceOf.get(p.group)! } : {}) }));
    let offerText: string | null = null;
    try { offerText = readFileSync(opts.offerPath ?? kukuluOfferPath(), "utf8"); } catch { offerText = null; }
    return { rite: "kukulu", standing: await standingKukuluBegins(lent, redOf, branchOrAll), pending, offer: offerVouchesOf(offerText, faceOf) };
  }
  if (opts.action === "begin" && opts.args["rite"] === "kukulu") {
    // A KŪKULU BEGINS FOR EVERY LENT FACE OR FOR NONE: every face's return checks first, then each claims and rests its guest half.
    if (!str("branch") || !str("head")) throw new SwarmRefused("rite-malformed", "a rite names its rite, its branch and the head it runs at");
    const at = { rite: "kukulu" as const, branch: str("branch"), head: str("head"), tree: await (opts.treeOf ?? gitTreeOf)(str("head")), ...(str("image") === "" ? {} : { image: str("image") }) };
    const lent = await (opts.lentOrdinals ?? unlockedFaceOrdinals)();
    // A BEGIN ALREADY STANDING ON THE LINE spends nothing more: it refuses by name over the raw debt before any face's return is
    // checked, a shut or rehived face's half included.
    const faceOf = await facesOfGroups(lent).catch(() => new Map<string, string>());
    refuseStandingBegin((await pendingBegins(wiki, "kukulu", at.branch)).map((p) => ({ ...p, ...(faceOf.has(p.group) ? { face: faceOf.get(p.group)! } : {}) })));
    return { ...await beginLentFaces(lent, async (ordinal) => {
      let face: RiteFace;
      try { face = await riteFaceOf(opts.repo, opts.catalogUrl, ordinal); }
      catch (e) { if (e instanceof SwarmRefused) throw e; throw new SwarmRefused("face-log-unreadable", `the lent face h${ordinal} loads no log: ${e instanceof Error ? e.message : String(e)}`); }
      return checkReturn(wiki, at, face.trust, face.group, face.vessel, face.ward, undefined, { orphan: true });
    }, (checked) => beginChecked(wiki, checked)) };
  }
  let loaded: FaceFold;
  try { loaded = await loadFaceFold(opts.repo, opts.catalogUrl, { index: opts.face }); }
  catch (e) { if (e instanceof IntentRefused) throw new SwarmRefused("face-log-unreadable", e.message); throw e; }
  const { group, face, signer } = loaded;
  const vesselKey = signer.key.toLowerCase();
  const vessel: SwarmSignerPort = { key: signer.key, sign: (bytes) => signer.sign(bytes) };
  const trust: SwarmTrust = { hand: (key) => face.currentSigner(key), vessel: (key) => key === vesselKey, lead: () => false };
  if (opts.action === "receipts") return { receipts: await riteReceipts(opts.wiki, trust, group), conferre: await conferre(opts.wiki, trust, group) };
  if (opts.action === "land") {
    if (!/^[0-9a-f]{64}$/.test(str("tessera")) || !str("head")) throw new SwarmRefused("rite-malformed", "a landing names its tessera and the head the vessel stands at");
    return { ...await landRite(opts.wiki, { tessera: str("tessera"), head: str("head"), ...(str("image") === "" ? {} : { image: str("image") }) }, trust, group, vessel) };
  }
  const rite = opts.args["rite"];
  if (!isSwarmLeiRite(rite) || !str("branch") || !str("head")) throw new SwarmRefused("rite-malformed", "a rite names its rite, its branch and the head it runs at");
  // The caller names the head; this vessel derives the tree, so a return never rests on a tree its spender chose.
  const keepTree = str("staged") === "" ? undefined : (): string => keepStagedTree(str("branch"), str("staged"), opts.workspacesHome);
  const tree = await riteTreeOf(rite, str("head"), opts.treeOf ?? gitTreeOf, keepTree);
  let ward;
  try { ward = cosignPortWitness(await nodeWardCosignPortOf(opts.repo, loaded)); }
  catch (e) { if (e instanceof IntentRefused) throw new SwarmRefused("face-log-unreadable", e.message); throw e; }
  return { ...await beginRite(opts.wiki, { rite, branch: str("branch"), head: str("head"), tree }, trust, group, vessel, ward) };
}
