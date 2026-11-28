/**
 * kukulu-offer — what a kūkulu carries to the pūlama: the standing vessel writes it, the next vessel offers it once.
 *
 * A rebuilt vessel wakes holding no key and no document, so it cannot read its own lei. The STANDING vessel gathers the
 * offer before it goes down (`rite-offer`, between the image's build and the vessel's lowering) and rests it as one file in
 * the house's config home:
 *
 *   <config>/kukulu-offer.json    { "lei": [ … ], "unstrung": [ … ], "vouch": [ … ] }
 *
 *   lei        every kukulu lei standing on the branch's line of each face the kūkulu asks lent, in this vessel's control
 *              document, as their signed records: a chain reads from its first lei, so each whole line rides, and the
 *              pūlama lands each where it verifies under its own face's hand
 *   unstrung   each unstringing that rests for one of those lei, so a lei the hand ended reaches the pūlama ended
 *   vouch      one vouch per face: this vessel's signature, under the custody root's vouch child, over that face's group,
 *              the branch, the head and the tree it derived, and the image digest the host named. A face with no lei
 *              on its line still rides its vouch, and waits at the pūlama by name (`swarm-lei-absent`) while the other faces' lend stands.
 *
 * ── NOTHING SECRET RESTS IN THE FILE ────────────────────────────────────────────────────────────
 * Each part holds a signed record or a public digest. The file lands whole (a sibling temp, then a rename), owner-only.
 *
 * ── THE VOUCH BINDS TO THE LEI (operator ruling 2026-11-25) ─────────────────────────────────────
 * The vessel signs no head, tree or image its caller picks. Per face it reads the LIVE lei that ends the line (`readLei`, its
 * spent return allowed: the begin just spent it for this very rite) and the unlanded begun half that lei's return paid for, and
 * the vouch names that half's head, tree and image (a lei restrung after an interrupted begin moves the tip past the lei that
 * paid: the half that lei's return rested still binds; an UNSTRUNG lei's half stays tombstoned, kāpae, and binds nothing). A line with no chain from its root waits by name, as the begin waits it. Each refuses by the pūlama gate's own name before anything rests:
 * `swarm-lei-unstrung`, `swarm-lei-forked`, `swarm-lei-head-mismatch` (a lei that pins another head), `rite-begun-absent` (no
 * begin spent the lei), `rite-offer-differs` (a caller's head or tree the begun half never named), `kukulu-image-mismatch` (an
 * image the begun half never named). Earlier lei on the line whose unstringing rests still ride whole, so the pūlama reads them
 * ended. THE KEEPER MOVE rides as the host names it: no vessel record names one, and the pūlama's vest holds it to the
 * keeper commit's own closure (`closure-differs`).
 *
 * ── ONE KŪKULU, ONE OFFER ───────────────────────────────────────────────────────────────────────
 * A later rite writes over the file, so the newest offer supersedes the last, ONLY over the base it read: the overwrite names the
 * hash of the resting file (`kukuluOfferBase`, what `rite receipts rite=kukulu` answers as `offerBase`), and a resting file
 * that reads otherwise refuses `conflict`, so no seat swaps a good offer for its own between the read and the lowering. The vessel that the pūlama serves removes
 * the file once its session stands (`consumeKukuluOffer`): a plain restart afterwards finds no offer and wears nothing. A
 * hello the pūlama refuses leaves the file, so the same offer rides the next dial (after the operator lights the pūlama).
 *
 * THE HOST NAMES THE IMAGE. The digest arrives as the row's argument, from the host that built the image; the pūlama
 * compares it with the digest the host reports at its own hand door, and a vessel that named another gains nothing.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { createHash } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  SwarmRefused, readLei, readLeiChain, swarmLeiUnstrungTitle, swarmTesseraTitle, verifySwarmRecord,
  type SignedSwarmAct, type SwarmRiteBegunBody, type SwarmTrust, type SwarmWikiPort,
} from "@lararium/mesh/swarm-tiddlers";
import { tesseraOf } from "@lararium/mesh/swarm-tessera";
import { kukuluVouchDigest, signKukuluVouch, type SignedKukuluVouch } from "@lararium/mesh/kukulu-vouch";
import { type WardActWitness } from "@lararium/mesh/ward-cosign";
import type { CustodyHolder } from "./custody-holder.js";
import { vouchSignerOf } from "./kukulu-gate.js";
import { larConfigHome } from "./vessel-paths.js";

export const KUKULU_OFFER_FILE = "kukulu-offer.json";
/** Where the offer rests: the house's config home, which the standing vessel and the next one both reach. */
export const kukuluOfferPath = (): string => join(larConfigHome(), KUKULU_OFFER_FILE);

export interface KukuluOffer { readonly lei: readonly SignedSwarmAct[]; readonly unstrung: readonly unknown[]; readonly vouch: readonly SignedKukuluVouch[] }

/**
 * One face the offer asks lent: its group, the trust its own hand's records verify under, its ward witness, and the name the
 * answer gives it (`h<ordinal>`; its group where the caller names none).
 */
export interface KukuluOfferFace { readonly group: string; readonly trust: SwarmTrust; readonly ward: WardActWitness; readonly name?: string;
  /** The devices this face holds, as this vessel read its signed admission fold; absent where it read none. */
  readonly devices?: number }

const IMAGE_DIGEST = /^[a-z0-9]+:[0-9a-f]{32,128}$/;

/** The resting offer's base: `sha256:<hex>` over the file's bytes, or null where none rests. An overwrite names it. */
export function kukuluOfferBase(path: string): string | null {
  let bytes: Buffer;
  try { bytes = readFileSync(path); } catch { return null; }
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/** The unlanded begun half the face's live lei paid for: its highest return whose guest half verifies and rests with no host half. */
async function begunOf(wiki: SwarmWikiPort, face: KukuluOfferFace, lei: { readonly cid: string; readonly returns: number }, branch: string): Promise<SwarmRiteBegunBody | null> {
  for (let n = lei.returns; n >= 1; n--) {
    const tessera = tesseraOf({ lei: lei.cid, n });
    const title = swarmTesseraTitle(tessera, "guest");
    const read = verifySwarmRecord(await wiki.read(title), title, face.trust, face.group);
    if (!read.ok || read.act.body.act !== "rite-begun") continue;
    const body = read.act.body;
    if (body.rite !== "kukulu" || body.branch !== branch || body.lei !== lei.cid) continue;
    if ((await wiki.read(swarmTesseraTitle(tessera, "host"))) !== null) continue;
    return body;
  }
  return null;
}

/**
 * Gather the offer for one line and rest it at `path`. Refuses by name, writing nothing: `rite-offer-malformed` (an image
 * that reads as no digest), `swarm-lei-absent` (no kukulu lei rests on any face's line), each binding refusal the head of this
 * file names, and `conflict` (a resting offer the base does not name).
 */
export async function writeKukuluOffer(a: {
  readonly wiki: SwarmWikiPort;
  /** The faces the kūkulu asks lent, one vouch each. */
  readonly faces: readonly KukuluOfferFace[];
  readonly branch: string; readonly head: string; readonly tree: string;
  /** THE HOST'S NAME for the image it built. */
  readonly image: string;
  /** The holder whose custody root yields the vouch key: this vessel's seated one. */
  readonly holder: Pick<CustodyHolder, "derive">;
  readonly path: string;
  /** THE KEEPER MOVE this rite carries (the keeper tally): the successor's announced key and the committed closure; each vouch
   *  names them beside its face's device count, so the pūlama's vest proceeds only inside this rite. */
  readonly keeper?: { readonly to: string; readonly next: string };
  /** THE BASE the caller last read (`kukuluOfferBase`): null or absent where it read none resting. */
  readonly base?: string | null;
}): Promise<{
  readonly path: string; readonly vouch: readonly string[]; readonly lei: number;
  /** Every face the offer vouches for, by name, in the order asked. */
  readonly faces: readonly string[];
  /** The faces whose line carries no lei: each rides its vouch and waits at the pūlama by name. */
  readonly waits: readonly string[];
}> {
  if (!IMAGE_DIGEST.test(a.image)) throw new SwarmRefused("rite-offer-malformed", "an offer names the image by its digest, `<algorithm>:<hex>`");
  const lei: SignedSwarmAct[] = [], unstrung: unknown[] = [], waits: string[] = [];
  const nameOf = (face: KukuluOfferFace): string => face.name ?? face.group;
  const kui = `lares lei kui rite=kukulu branch=${a.branch} returns=<n> all=true`;
  for (const face of a.faces) {
    const chain = await readLeiChain(a.wiki, { rite: "kukulu", branch: a.branch }, face.trust, face.group, face.ward);
    if (chain.cosigned.length === 0) { waits.push(nameOf(face)); continue; }
    // THE LIVE LEI: the line's one tip, never unstrung, pinning this head where it pins one. Its return stays spent: the begin
    // spent it for this very rite, and the pūlama counts its own.
    const live = await readLei(a.wiki, { rite: "kukulu", branch: a.branch, head: a.head }, face.trust, face.group, face.ward, { spent: true });
    // A LINE WITH NO CHAIN FROM ITS ROOT (orphan rows alone) holds no lei for this face: it waits by name, as the begin waits it.
    if (!live.ok && (live.refusal === "absent" || live.refusal === "group")) { waits.push(nameOf(face)); continue; }
    if (!live.ok) {
      const why = live.refusal === "unstrung" ? `the hand unstrung the lei that ends ${nameOf(face)}'s line, so no vouch rides it; string a fresh one: ${kui}`
        : live.refusal === "forked" ? `${nameOf(face)}'s line reads two lei at one link, and neither stands; a fresh lei names one tip: ${kui}`
        : live.refusal === "head-mismatch" ? `${nameOf(face)}'s lei pins another head than ${a.head}; run \`lares rite kukulu\` at the head it pins, or string a lei for this one: ${kui}`
        : `${nameOf(face)}'s lei does not stand (${live.refusal}); string a fresh one: ${kui}`;
      throw new SwarmRefused(`swarm-lei-${live.refusal}`, why);
    }
    // THE HALF THE RITE BEGAN: the tip's own where it paid, else the half any lei on this chain paid for (a lei restrung after an
    // interrupted begin moves the tip past the lei whose return paid; the half that return rested still binds the vouch).
    let begun: SwarmRiteBegunBody | null = null;
    for (const row of [...chain.cosigned].sort((x, y) => Number(y.cid === live.cid) - Number(x.cid === live.cid))) {
      // KĀPAE (operator ruling 2026-11-25): an unstring tombstones the rite its lei paid for, so a fresh lei never resurrects
      // that half; only a restring (the lei left unstrung, a newer one after it) leaves it bound.
      if ((await a.wiki.read(swarmLeiUnstrungTitle(row.cid))) !== null) continue;
      begun = await begunOf(a.wiki, face, { cid: row.cid, returns: row.body.reach === "wide" ? row.body.returns : 1 }, a.branch);
      if (begun !== null) break;
    }
    if (begun === null) throw new SwarmRefused("rite-begun-absent", `no begun half of any lei on ${nameOf(face)}'s line rests unlanded on "${a.branch}", so no head binds its vouch; begin the rite first: lares rite kukulu`);
    if (begun.head !== a.head || begun.tree !== a.tree) {
      throw new SwarmRefused("rite-offer-differs", `${nameOf(face)}'s begun half names head ${begun.head} (tree ${begun.tree}), and the offer names ${a.head} (tree ${a.tree}); the vessel vouches only for what the rite began: run \`lares rite kukulu\`, which offers over the head it began at`);
    }
    if (begun.image !== a.image) {
      throw new SwarmRefused("kukulu-image-mismatch", `${nameOf(face)}'s begun half names ${begun.image === undefined ? "no image" : `image ${begun.image}`}, and the offer names ${a.image}; run \`lares rite kukulu\`, which offers over the image it began with`);
    }
    for (const row of chain.cosigned) {
      lei.push(row.act);
      const text = await a.wiki.read(swarmLeiUnstrungTitle(row.cid));
      if (text === null) continue;
      try { unstrung.push(JSON.parse(text)); } catch { /* a row that forms no record ends nothing at the pūlama */ }
    }
  }
  if (lei.length === 0) throw new SwarmRefused("swarm-lei-absent", `no kukulu lei rests for "${a.branch}" on any face's line, so this kūkulu wears none; string one: ${kui}`);
  const signer = await vouchSignerOf(a.holder);
  const vouch: SignedKukuluVouch[] = [];
  for (const face of a.faces) vouch.push(await signKukuluVouch({ group: face.group, branch: a.branch, head: a.head, tree: a.tree, image: a.image,
    ...(a.keeper === undefined ? {} : { keeper: { to: a.keeper.to, next: a.keeper.next, devices: face.devices ?? 0 } }) }, signer));
  const offer: KukuluOffer = { lei, unstrung, vouch };
  // THE BASE, COMPARED AND SWAPPED: read after every await, so from this read to the rename nothing else in this process runs.
  const resting = kukuluOfferBase(a.path);
  if (resting !== null && resting !== (a.base ?? null)) {
    throw new SwarmRefused("conflict", `an offer rests at ${a.path} as ${resting}, and this offer names ${a.base ? `base ${a.base}` : "no base"}; read it again (\`lares rite receipts rite=kukulu branch=${a.branch}\` answers its offerBase) and offer over that base, or run \`lares rite kukulu\`, which reads it first`);
  }
  mkdirSync(dirname(a.path), { recursive: true });
  const tmp = `${a.path}.${process.pid}.tmp`;
  const fd = openSync(tmp, "w", 0o600);
  try { writeSync(fd, JSON.stringify(offer)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(tmp, a.path);
  return { path: a.path, vouch: vouch.map((v) => kukuluVouchDigest(v)), lei: offer.lei.length, faces: a.faces.map(nameOf), waits };
}

/**
 * A HALF SET DOWN SPENDS THE OFFER ITS VOUCHES NAME (restand-files-smooth). Each vouch binds one begun half (its face's group,
 * the line, the head and the image the half began with), and the pūlama refuses the whole offer `kukulu-image-mismatch` once
 * the host raises any other image. So where an abandon (the hand's, or a kūkulu's supersede) sets down a half some vouch in the
 * resting offer names, that offer can serve nothing: it goes, and the next vessel enters by the image the host reports where
 * that image stands admitted (the gate's NO OFFER path). An offer whose vouches name another half stays. Answers whether a
 * file went; a file that reads as no offer, or will not go, stays.
 */
export function spendKukuluOffer(path: string, half: { readonly group: string; readonly branch: string; readonly head: string; readonly image?: string }): boolean {
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(path, "utf8")); } catch { return false; }
  const vouch = typeof parsed === "object" && parsed !== null ? (parsed as { vouch?: unknown }).vouch : undefined;
  if (!Array.isArray(vouch)) return false;
  const names = vouch.some((v) => {
    const b = (typeof v === "object" && v !== null ? (v as { body?: unknown }).body : undefined) as Record<string, unknown> | undefined;
    return b !== undefined && b["group"] === half.group && b["branch"] === half.branch && b["head"] === half.head && (half.image === undefined || b["image"] === half.image);
  });
  return names && consumeKukuluOffer(path);
}

/** Remove a spent offer; answers whether a file went. A file that will not go stays, and the caller names it. */
export function consumeKukuluOffer(path: string | undefined): boolean {
  if (!path || path.trim() === "") return false;
  try { rmSync(path); return true; } catch { return false; }
}
