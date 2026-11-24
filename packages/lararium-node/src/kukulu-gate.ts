/**
 * kukulu-gate — THE GATE a kūkulu passes before the pūlama serves it: a strung lei beside a vouch, its return claimed first.
 *
 * A rebuilt vessel offers two things in its hello: the kūkulu leis the operator's hands strung, one per face it asks to be
 * lent (each with the lei it follows, where it follows one), and one vouch per such face the standing vessel signed over the
 * candidate image it walked. The gate reads each against what the pūlama itself holds and what the host reports, begins one
 * rite per face in the pūlama's own records (each lei's return, then the guest half of its tessera), and only then answers
 * a session's scope: the faces whose rites began, as the lent set.
 *
 * ── ONE LEI PER LENT FACE ───────────────────────────────────────────────────────────────────────
 * Each face's lei verifies under that face's own hand (its root key) and binds that face's group alone, so no face lends
 * another. A vouched face that stands dark, names no hand, or finds no lei of its own hand waits: the scope names it in
 * `unlent` with its reading, and the lend stands for the rest. With no face begun, the hello refuses by the first reading.
 * Any other reading of the lei family (a returned or forked lei, a red walk) refuses the whole kūkulu.
 *
 * ── A VESSEL WITH NO OFFER ENTERS BY ITS IMAGE ──────────────────────────────────────────────────
 * A hello that carries neither lei nor vouch reads the admitted set (`pulama-admit`): where the image the host reports
 * stands admitted, the pūlama lends the faces that admission names again (the lit ones serve, the dark ones wait; with none
 * lit it refuses `kukulu-face-locked`), spends no lei and rests one re-service row. A
 * restart with no rebuild therefore wakes standing. Any other image refuses `pulama-image-unadmitted`, and the refusal
 * names the two acts that admit one: the hand's `pulama admit`, and the rite (`lares rite kukulu`). An admission row whose
 * faces read no lent set refuses by the set's own reading (`lent-faces-empty`, `lent-faces-malformed`), and one whose
 * tesserae name no tessera per face refuses `admission-tesserae-mismatch`.
 *
 * AN IMAGE STANDS ADMITTED ONCE ITS KŪKULU LANDS PAR. The scope's `land` rests each face's host half; where every pair reads
 * par, the image the vouches walked joins the admitted set on every lent face's own rite tessera. A kūkulu that never
 * composed admits nothing.
 *
 * ── WHAT THE GATE READS OF AN OFFER, IN ORDER; EACH MISS REFUSES BY NAME ────────────────────────
 *   `kukulu-lei-shape`          the offer's lei reads as no array (`kukulu-unstrung-shape`: its unstrung rows)
 *   `kukulu-unvouched`          the offer carries a lei and no vouch
 *   `kukulu-vouch-shape`        the offer's vouch reads as no array, or as an empty one
 *   `kukulu-vouch-<reading>`    a vouch reads no vouch, or another key than the custody root's vouch child signed it
 *   `kukulu-vouch-duplicate`    the offer vouches for one face twice
 *   `kukulu-image-unreported`   the host reported no image digest
 *   `kukulu-image-mismatch`     a vouch walked another image than the one the host raises
 *   per face, waiting where another face begins:
 *   `kukulu-face-absent` · `kukulu-face-locked`   the vouch's group names no face standing open at this pūlama
 *   `kukulu-hand-absent`        the pūlama's own custody names no hand's key for that face, so no lei reads
 *   the lei family's own readings (`KukuluRitePort.begin`): `swarm-lei-absent` (no lei of this face's hand stands for the
 *   vouch's branch), `swarm-lei-head-mismatch` (a lei that pins a head pins another than the vouch's), `swarm-lei-returned` ·
 *   `swarm-lei-returns-spent`, `swarm-lei-unstrung`, `swarm-lei-forked`, `rite-begun-stands`
 *
 * ── THE RETURN CLAIMS BEFORE ANYTHING SERVES ────────────────────────────────────────────────────
 * The rite begins once every other reading passed: the return lands atomically, then the guest half. A fault after the
 * return burns it and serves nothing: the gate fails closed.
 *
 * ── THE HOST REPORTS THE IMAGE, NEVER THE VESSEL ────────────────────────────────────────────────
 * `image` is an input port: the host shim writes the digest of the image it raises at the pūlama's hand door. The offer
 * carries no image field the gate trusts; the vouch's own digest must equal the host's.
 *
 * ── THE HAND'S KEY COMES OFF THE PŪLAMA'S OWN CUSTODY ───────────────────────────────────────────
 * `hand` reads the key the face's hand strings a lei under (the face's root key, off its roster row) through the pūlama's
 * own holder. The offer names no key the gate trusts.
 *
 * ── THE HOST HALF ───────────────────────────────────────────────────────────────────────────────
 * The scope carries `land`: once the vessel composed over its session it asks the pūlama to rest the tessera's host half,
 * and conferre then reads the pair `par`. A kūkulu that never composed leaves the guest half alone, which reads red.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import type { KeeperRiteBegun, KeeperRiteReading, KeeperVouchedFace } from "./pulama-keeper.js";
import { FLOOR_REST_KEY_INFO, GATE_BUNDLE_INFO, KUKULU_VOUCH_DOMAIN, PULAMA_TESSERA_DOMAIN, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, lentFacesOf, lentFacesWire, renderLentFaces, verifyKukuluVouch, type LentFaces } from "@lararium/mesh";
import type { CustodyHolder } from "./custody-holder.js";
import { personaGroupDigest } from "./persona-group-file.js";
import type { AdmittedFace, PulamaAdmissions } from "./pulama-admit.js";
import type { PulamaGate, PulamaScope } from "./pulama-server.js";

/** A signing seat: a verifying key (64 lower hex) and its signature over bytes. */
export interface KukuluSigner { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> }

/** What a kūkulu's rite names: the face's group, the branch, and the head and tree the vouch walked. */
export interface KukuluRiteAt {
  readonly group: string; readonly branch: string; readonly head: string; readonly tree: string;
  /** The image the host raises, which the vouch walked: the rite's halves name it, and a retry reuses a half only over it. */
  readonly image?: string;
  /** Whether a key signs as the face's hand. */
  readonly hand: (key: string) => boolean;
  /** The pūlama's own signer: the witness of every record it rests. */
  readonly by: KukuluSigner;
}

/** What the gate asks of the lei family and its tessera, for the one rite `kukulu` (`kukulu-lei-seat`). */
export interface KukuluRitePort {
  /**
   * Begin the rite over what the vessel offered: the offered lei rows land where they verify as the hand's, the lei
   * returns once under the hand's own consent (no receipt weighs the tree), and the guest half rests.
   * Answers the tessera, or the family's own refusal reading.
   */
  begin(offer: { readonly lei: readonly unknown[]; readonly unstrung: readonly unknown[] }, at: KukuluRiteAt):
    Promise<{ readonly ok: true; readonly tessera: string; readonly lei: string; readonly n: number } | { readonly ok: false; readonly refusal: string }>;
  /** Rest the host half of `tessera` at the head the rite began at; answers whether the pair reads par. */
  land(tessera: string, at: KukuluRiteAt): Promise<{ readonly par: boolean }>;
}

/**
 * The cold rows a working vessel reads with nobody at a terminal: `face-proof-key`, the per-Nexus key a face presents at
 * each dial and stewards the Kahu canon under (a boot to composition reads it), and `intent-relay-key`, which signs each
 * entry the intent relay admits for a face that enabled it. A session reads these two and writes neither.
 */
export const KUKULU_COLD_READS: readonly string[] = Object.freeze(["face-proof-key", "intent-relay-key"]);

/** The domains a session's children derive under: the floor's rest key, the gate bundle root, and the vouch key the next
 *  kūkulu's walker signs with. No other child of the custody root crosses to a vessel. */
export const PULAMA_SESSION_DERIVES: readonly string[] = Object.freeze([FLOOR_REST_KEY_INFO, GATE_BUNDLE_INFO, KUKULU_VOUCH_DOMAIN]);

/** The vouch key's verifying half, as a holder that holds its custody root derives it. */
export async function vouchKeyOf(holder: Pick<CustodyHolder, "derive">): Promise<string> {
  const seed = holder.derive(KUKULU_VOUCH_DOMAIN);
  try { return await ed25519VerifyingKeyFromSeed(seed); } finally { seed.fill(0); }
}

/** The vouch signer a standing vessel signs under: the custody root's vouch child, read for one signature and zero-filled. */
export async function vouchSignerOf(holder: Pick<CustodyHolder, "derive">): Promise<KukuluSigner> {
  return {
    key: await vouchKeyOf(holder),
    sign: async (bytes) => { const seed = holder.derive(KUKULU_VOUCH_DOMAIN); try { return await ed25519SignerFromSeed(seed)(bytes); } finally { seed.fill(0); } },
  };
}

/** The key the pūlama witnesses under: every return and tessera half in its own records carries it. */
export async function pulamaSignerOf(holder: Pick<CustodyHolder, "derive">): Promise<KukuluSigner> {
  const seed = holder.derive(PULAMA_TESSERA_DOMAIN);
  let key: string;
  try { key = await ed25519VerifyingKeyFromSeed(seed); } finally { seed.fill(0); }
  return { key, sign: async (bytes) => { const s = holder.derive(PULAMA_TESSERA_DOMAIN); try { return await ed25519SignerFromSeed(s)(bytes); } finally { s.fill(0); } } };
}

/** The lent set over faces the gate read off the pūlama's own custody; a set it built from standing faces always parses. */
function lentOf(faces: ReadonlyArray<{ readonly fcid: string; readonly ordinal: number }>): LentFaces {
  const lent = lentFacesOf(faces.map((f) => ({ fcid: f.fcid, ordinal: f.ordinal })));
  if (!lent.ok) throw new Error(lent.message);
  return lent.faces;
}

/** A lent set as the admission records carry it: each face by custody id and ordinal. */
const admittedWire = (lent: LentFaces): readonly AdmittedFace[] => lentFacesWire(lent) as readonly AdmittedFace[];

export function kukuluGate(a: {
  /** The pūlama's own holder: the gate reads the face's standing and two derived children off it. */
  readonly holder: CustodyHolder;
  /** The key the hand of the face at `ordinal` strings a lei under, read off the pūlama's own custody; null where it names none. */
  readonly hand: (ordinal: number) => Promise<string | null | undefined>;
  readonly rite: KukuluRitePort;
  /** THE HOST'S REPORT of the image it raises, or null where it reported none. */
  readonly image: () => string | null | Promise<string | null>;
  readonly coldReads?: readonly string[];
  /** The admitted set (`pulama-admit`). Absent, no image stands admitted and every hello needs its offer. */
  readonly admissions?: PulamaAdmissions;
}): PulamaGate {
  const { holder } = a;
  const refuse = (reading: string, why?: string) => ({ ok: false as const, reading, ...(why ? { why } : {}) });
  /** Each lent face's standing at this pūlama, off the custody ids the admission names; "absent" where one stands absent. */
  const admittedFaces = async (admitted: readonly AdmittedFace[]): Promise<LentFaces | "absent"> => {
    const faces = [];
    for (const f of admitted) {
      const standing = await holder.faceStanding({ fcid: f.fcid });
      if (standing === null) return "absent";
      faces.push(standing);
    }
    return lentOf(faces);
  };
  return {
    async admit(offer) {
      const o = (typeof offer === "object" && offer !== null ? offer : {}) as { lei?: unknown; unstrung?: unknown; vouch?: unknown };
      // THE OFFER'S ROWS RIDE ARRAYS: the lei the hands strung and the unstrung rows, each absent or an array.
      if (o.lei !== undefined && !Array.isArray(o.lei)) return refuse("kukulu-lei-shape", "a kūkulu's lei reads as an array of strung rows");
      if (o.unstrung !== undefined && !Array.isArray(o.unstrung)) return refuse("kukulu-unstrung-shape", "a kūkulu's unstrung rows read as an array");
      const lei: readonly unknown[] = o.lei ?? [], unstrung: readonly unknown[] = o.unstrung ?? [];
      if (o.vouch === undefined) {
        if (lei.length > 0) return refuse("kukulu-unvouched", "a kūkulu wears its lei beside a vouch; this hello carries none");
        // NO OFFER: the vessel enters by the image the host reports, where that image stands admitted.
        const reported = await a.image();
        const witness = await pulamaSignerOf(holder);
        const admission = reported !== null && a.admissions ? await a.admissions.admitted(reported, witness) : null;
        if (reported === null || !a.admissions || admission === null) {
          return refuse("pulama-image-unadmitted", "this vessel carries no offer, and the image the host reports stands unadmitted: admit it by hand at the pūlama (`pulama admit`), or raise the vessel by the rite (`lares rite kukulu`)");
        }
        if ("refusal" in admission) return refuse(admission.refusal, admission.message.slice(`${admission.refusal}: `.length));
        const lent = await admittedFaces(admission.faces);
        if (lent === "absent") return refuse("kukulu-face-absent", "a face this image stands admitted for stands absent at this pūlama");
        // PARTIAL LIGHTING: the lent faces that stand lit serve and the dark ones wait; with none lit, nothing serves.
        const lit = [];
        for (const f of lent) if ((await holder.faceStanding({ fcid: f.fcid! }))?.unlocked) lit.push(f);
        if (lit.length === 0) return refuse("kukulu-face-locked", `every face this image stands admitted for (${renderLentFaces(lent)}) rests unopened at this pūlama`);
        // THE RE-SERVICE ROW RESTS FIRST: no lei spends, and the count of such wakes reads off the records.
        await a.admissions.reserved(reported, admittedWire(lent), witness);
        return { ok: true, scope: { faces: lent, coldReads: a.coldReads ?? KUKULU_COLD_READS } };
      }
      // ONE VOUCH PER LENT FACE: the offer's vouch rides an array; each names its own face's group, and the house's vouch
      // key signed each one.
      if (!Array.isArray(o.vouch)) return refuse("kukulu-vouch-shape", "a kūkulu's vouch reads as an array, one vouch per lent face");
      const vouchKey = await vouchKeyOf(holder);
      const vouches = [];
      for (const raw of o.vouch.slice(0, 64)) {
        const vouched = verifyKukuluVouch(raw, vouchKey);
        if (!vouched.ok) return refuse(`kukulu-vouch-${vouched.refusal}`);
        vouches.push(vouched);
      }
      if (vouches.length === 0) return refuse("kukulu-vouch-shape", "a kūkulu's vouch names at least one face");
      if (new Set(vouches.map((v) => v.vouch.body.group)).size !== vouches.length) return refuse("kukulu-vouch-duplicate", "the offer vouches for one face twice");
      const raised = await a.image();
      if (raised === null) return refuse("kukulu-image-unreported", "the host reported no image digest at the pūlama's hand door");
      if (vouches.some((v) => v.vouch.body.image !== raised)) return refuse("kukulu-image-mismatch", "a vouch walked another image than the one the host raises");
      const by = await pulamaSignerOf(holder);
      // Each face reads its own standing, its own hand and its own lei; a face whose reading misses waits by name.
      const readings: Array<{ readonly ordinal: number; readonly reading: string }> = [];
      const begun: Array<{ readonly face: { readonly fcid: string; readonly ordinal: number }; readonly at: KukuluRiteAt; readonly tessera: string }> = [];
      let first: { readonly ordinal: number; readonly reading: string } | null = null;
      for (const { vouch } of vouches) {
        const { body } = vouch;
        const face = await holder.faceStanding({ group: personaGroupDigest(body.group) });
        if (face === null) { first ??= { ordinal: -1, reading: "kukulu-face-absent" }; continue; }
        const wait = (reading: string): void => { readings.push({ ordinal: face.ordinal, reading }); first ??= { ordinal: face.ordinal, reading }; };
        if (!face.unlocked) { wait("kukulu-face-locked"); continue; }
        const handKey = (await a.hand(face.ordinal))?.toLowerCase();
        if (!handKey) { wait("kukulu-hand-absent"); continue; }
        const at: KukuluRiteAt = { group: body.group, branch: body.branch, head: body.head, tree: body.tree, image: raised, hand: (key) => key.toLowerCase() === handKey, by };
        // THE RETURN CLAIMS FIRST: from here a fault burns the return and serves nothing.
        const rite = await a.rite.begin({ lei, unstrung }, at);
        if (rite.ok) { begun.push({ face: { fcid: face.fcid, ordinal: face.ordinal }, at, tessera: rite.tessera }); continue; }
        // A face no lei of its own hand lends waits; any other reading of the family refuses the whole kūkulu.
        if (rite.refusal !== "swarm-lei-absent") return refuse(rite.refusal);
        wait(rite.refusal);
      }
      if (begun.length === 0) return refuse(first?.reading ?? "kukulu-face-absent");
      begun.sort((x, y) => x.face.ordinal - y.face.ordinal);
      const unlent = readings.sort((x, y) => x.ordinal - y.ordinal);
      const scope: PulamaScope = {
        faces: lentOf(begun.map((b) => b.face)), coldReads: a.coldReads ?? KUKULU_COLD_READS,
        ...(unlent.length > 0 ? { unlent } : {}),
        land: async () => {
          let par = true;
          for (const b of begun) par = (await a.rite.land(b.tessera, b.at)).par && par;
          // PAR ADMITS: the kūkulu composed and every half matches, so the image its vouches walked serves the lent set again
          // without a lei. The admission names every lent face's tessera, each face's own rite pair.
          if (par && a.admissions) await a.admissions.admitByRite(raised, begun.map((b) => ({ ...b.face, tessera: b.tessera })), by);
          return { par };
        },
      };
      return { ok: true, scope };
    },
  };
}

/**
 * THE LIVE RITE A KEEPER'S VEST RIDES (the keeper tally): the kūkulu offer the standing vessel rested, read as the gate reads it, and
 * bound to ONE keeper move. Each vouch verifies under the house's vouch key, walked the image the host reports, and names this move
 * (the successor's one-handoff key and the committed closure). The reading begins nothing: once every check of the vest passes, its
 * `begin` begins the kūkulu rite over the pūlama's records for each lit face, claiming one return of a lei the hand strung. The new vessel's hello finds that begun half and lands it, spending no
 * second return. A bare frame with no such offer, or a lei with no return left, begins nothing, and the vest refuses by name. The
 * reading names the faces' device count off the vouches (0 where a vouch read none, so the vest fails closed).
 */
export function keeperRiteOver(a: {
  readonly holder: CustodyHolder;
  readonly hand: (ordinal: number) => Promise<string | null | undefined>;
  readonly rite: KukuluRitePort;
  readonly image: () => string | null | Promise<string | null>;
}): (offer: unknown, keeper: { readonly to: string; readonly next: string }) => Promise<KeeperRiteReading> {
  return async (offer, keeper) => {
    const no = (refusal: string, detail: string) => ({ ok: false as const, refusal, detail: `${detail}; nothing vests, and the old fire still burns: light the successor by hand with \`lares rite kukulu\` on a terminal` });
    const o = (typeof offer === "object" && offer !== null && !Array.isArray(offer) ? offer : null) as { lei?: unknown; unstrung?: unknown; vouch?: unknown } | null;
    if (o === null || !Array.isArray(o.vouch) || o.vouch.length === 0) return no("vest-rite-absent", "a vest rides a live kūkulu rite, and this frame carries no offer with a vouch");
    if ((o.lei !== undefined && !Array.isArray(o.lei)) || (o.unstrung !== undefined && !Array.isArray(o.unstrung))) return no("vest-rite-absent", "the offer's lei and unstrung rows read as arrays");
    const lei: readonly unknown[] = (o.lei as unknown[] | undefined) ?? [], unstrung: readonly unknown[] = (o.unstrung as unknown[] | undefined) ?? [];
    const vouchKey = await vouchKeyOf(a.holder);
    const raised = await a.image();
    if (raised === null) return no("kukulu-image-unreported", "the host reported no image at this keeper's hand door");
    const by = await pulamaSignerOf(a.holder);
    // ONE PASS VERIFIES EVERY VOUCH AND NAMES ITS FACE; NOTHING BEGINS HERE (blind read F3). The vest runs every check over this
    // reading first, and calls `begin` last, so a refusal claims no lei return and rests no begun half.
    const faces: KeeperVouchedFace[] = [], ats: KukuluRiteAt[] = [];
    let devices = Number.POSITIVE_INFINITY, most = 0, first: string | null = null;
    for (const raw of o.vouch.slice(0, 64)) {
      const vouched = verifyKukuluVouch(raw, vouchKey);
      if (!vouched.ok) return no(`kukulu-vouch-${vouched.refusal}`, "a vouch the offer carries verifies under no key this house's custody root derives");
      const body = vouched.vouch.body;
      // THE VOUCH NAMES THIS KEEPER MOVE, or the vest rides another rite (or none).
      if (body.keeper === undefined || body.keeper.to !== keeper.to || body.keeper.next !== keeper.next) return no("vest-rite-unbound", "a vouch the offer carries names no keeper move, or another successor key or closure, than this vest");
      if (body.image !== raised) return no("kukulu-image-mismatch", "a vouch walked another image than the one the host raises");
      devices = Math.min(devices, body.keeper.devices); most = Math.max(most, body.keeper.devices);
      const face = await a.holder.faceStanding({ group: personaGroupDigest(body.group) });
      if (face === null || !face.unlocked) { first ??= "kukulu-face-locked"; continue; }
      // THE VOUCH MAPS ORDINAL TO GROUP: the vessel signed the group; this keeper's own holder names the ordinal.
      faces.push({ ordinal: face.ordinal, group: body.group, devices: body.keeper.devices });
      const handKey = (await a.hand(face.ordinal))?.toLowerCase();
      if (!handKey) { first ??= "kukulu-hand-absent"; continue; }
      ats.push({ group: body.group, branch: body.branch, head: body.head, tree: body.tree, image: raised, hand: (key) => key.toLowerCase() === handKey, by });
    }
    if (ats.length === 0) return no("vest-rite-absent", `no lit face's vouch can begin a rite for this vest (${first ?? "no face"})`);
    const begin = async (): Promise<KeeperRiteBegun> => {
      const tesserae: string[] = [], leis: { lei: string; n: number }[] = [];
      let none: string | null = first;
      for (const at of ats) {
        // THE RETURN CLAIMS HERE: the vest is this rite's begin, and the next vessel's hello lands the half it rests.
        const begun = await a.rite.begin({ lei, unstrung }, at);
        if (begun.ok) { tesserae.push(begun.tessera); leis.push({ lei: begun.lei, n: begun.n }); }
        else if (begun.refusal === "swarm-lei-absent") none ??= begun.refusal;
        // A BEGIN THAT FAILS PART WAY NAMES WHAT IT BEGAN (blind read L1): the halves earlier faces rested stay resting, named here and
        // in the lapse the vest rests, so the hand reads them rather than finding them.
        else if (tesserae.length > 0) return { ...no(begun.refusal, `the rite began ${tesserae.length} half(s) (${tesserae.join(", ")}) before a later face refused; they rest unlanded: read them with \`lares rite receipts --rite kukulu\``), begun: [...tesserae] };
        else return no(begun.refusal, "the rite this vest rides begins nothing");
      }
      if (tesserae.length === 0) return no("vest-rite-absent", `no lit face's kukulu lei began a rite for this vest (${none ?? "no face"})`);
      // EACH KUKULU LEI RETURN THE RITE SPENT names itself on the vest: the license a keeper commit with no route rode.
      return { ok: true, rite: tesserae, leis };
    };
    // THE FEWEST READ WINS where a face read none (0 fails closed); else the most any face holds.
    return { ok: true, devices: devices === 0 ? 0 : most, faces, begin };
  };
}
