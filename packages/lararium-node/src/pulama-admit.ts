/**
 * pulama-admit — THE ADMITTED IMAGE: which vessel image the pūlama serves again with no lei spent.
 *
 * Admission binds to the image digest the HOST reports at the pūlama's hand door (`pulama-state` `image`), the same report
 * the kūkulu gate holds a vouch to. An image stands admitted by one of two acts, and by no other:
 *
 *   by the rite   a kūkulu the gate served composed and landed its tessera par: the image its vouch walked rests admitted
 *   by the hand   the operator, on a real terminal inside the pūlama, proved their route against the lit holder
 *                 (`pulama admit`): the image the host reports then rests admitted, under a tessera of its own
 *
 * A vessel that dials with no offer, while the host reports an admitted image, gets served again: a restart with no rebuild
 * (a container restart, a host reboot and a fresh `light`) wakes standing. That service spends no lei and rests one
 * re-service row, so the count of such wakes reads off the records. An unadmitted image with no offer stays at the floor.
 *
 * ── THE RECORDS, ALL UNDER THE PŪLAMA'S OWN KEY, IN ITS OWN STORE ───────────────────────────────
 *   admitted/<image>              ONE row per image: the faces it serves, the act that admitted it (`rite` or `hand`), each
 *                                 lent face's tessera (`tesserae`) and the admission's own tessera. A rite admits on every
 *                                 face's own rite tessera (its guest and host halves rest in the rite's records), and its
 *                                 tessera names that set; a hand admits every face under its one tessera. A later admission
 *                                 of the same image writes over the row.
 *   reserved/<image>/<n>          one row per re-service, counted from 1, claimed atomically
 *   admit/<tessera>/guest · host  the hand's own tessera: `admit-begun` rests before the admission, `admit-landed` after
 *                                 it, naming the begun half by its cid. Both halves come from the one hand act.
 *   unadmitted/<image>/<tessera>  THE HAND'S UNADMIT: a signed tombstone naming the admission tessera it ends. An admission
 *                                 stands only while no tombstone names its tessera, so a row deleted and brought back from a
 *                                 keep copy still reads ended; a re-admission writes a new tessera, which no tombstone names.
 *                                 The tombstone gates FUTURE service: a session the pūlama already served keeps running. And a
 *                                 host-file write sits outside this lock like any tamper of the state dir: deleting the
 *                                 tombstone file, or restoring an older state dir, re-admits the image.
 *
 * A READ TRUSTS A ROW ONLY UNDER THE PŪLAMA'S KEY. The key derives from the custody root, so a row written into the state
 * directory by anything that never held that root reads as no admission: the file alone admits nothing. A row the key
 * signed whose faces read no lent set answers the set's own reading (`lent-faces-empty`, `lent-faces-malformed`), and the
 * gate refuses by it.
 *
 * No route and no key rests in any row: each holds digests, faces' custody ids and a signature.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import type { KeeperCosign } from "@lararium/mesh";
import { randomUUID } from "node:crypto";
import { PULAMA_TESSERA_DOMAIN, canonicalJsonBytes, sha256HexBytesSync, verifyEd25519, type SwarmWikiPort } from "@lararium/mesh";
import { lentFacesOf, lentFacesWire, type LentFacesRefusal } from "@lararium/mesh/lent-faces";
import type { KukuluSigner } from "./kukulu-gate.js";

const PREFIX = "$:/lares/pulama/";
const imageKey = (image: string): string => sha256HexBytesSync(new TextEncoder().encode(image));
export const pulamaAdmittedPrefix = (): string => `${PREFIX}admitted/`;
export const pulamaAdmittedTitle = (image: string): string => `${pulamaAdmittedPrefix()}${imageKey(image)}`;
export const pulamaReservedPrefix = (image: string): string => `${PREFIX}reserved/${imageKey(image)}/`;
export const pulamaAdmitTesseraPrefix = (): string => `${PREFIX}admit/`;
export const pulamaAdmitTesseraTitle = (tessera: string, half: "guest" | "host"): string => `${pulamaAdmitTesseraPrefix()}${tessera}/${half}`;
/** The tombstone that ends the admission of `image` resting on `tessera`. */
export const pulamaUnadmittedTitle = (image: string, tessera: string): string => `${PREFIX}unadmitted/${imageKey(image)}/${tessera}`;

/** The face an admission serves, as the pūlama's custody names it. */
export interface AdmittedFace { readonly fcid: string; readonly ordinal: number }
/** One lent face's tessera on an admission: the rite's own for that face, or the hand's one tessera. */
export interface AdmittedTessera { readonly ordinal: number; readonly tessera: string }
/** One face a par kūkulu admits, with the tessera its own rite began and landed under. */
export interface AdmittedRite extends AdmittedFace { readonly tessera: string }

const TESSERA = /^[0-9a-f]{64}$/;
/** A rite admission's own tessera: the digest over every lent face's tessera, in ordinal order. */
const tesseraOfSet = (tesserae: readonly AdmittedTessera[]): string => sha256HexBytesSync(canonicalJsonBytes(tesserae.map((t) => ({ ordinal: t.ordinal, tessera: t.tessera }))));

export type PulamaAdmitBody =
  | { readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "image-admitted"; readonly image: string; readonly faces: readonly AdmittedFace[]; readonly by: "rite" | "hand"; readonly tessera: string; readonly tesserae: readonly AdmittedTessera[] }
  | { readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "image-reserved"; readonly image: string; readonly faces: readonly AdmittedFace[]; readonly n: number }
  | { readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "admit-begun"; readonly image: string; readonly faces: readonly AdmittedFace[]; readonly tessera: string }
  | { readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "admit-landed"; readonly image: string; readonly faces: readonly AdmittedFace[]; readonly tessera: string; readonly begun: string }
  | { readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "image-unadmitted"; readonly image: string; readonly ends: string }
  | KeeperBegunBody | KeeperVestedBody | KeeperLapsedBody | KeeperLandedBody | KeeperSlotBody;

/** THE KEEPER TALLY's records (`pulama-keeper`): the budget a keeper spent, carried down the chain. */
export interface KeeperBudget { readonly spent: number }
/** What a landing received by vest: the slot's cid, the node key, and each face key by custody id. Null on a struck light. */
export interface KeeperVest { readonly slot: string; readonly node: boolean; readonly faces: readonly string[] }
/** The guest half: the lit keeper, under the operator's route, names ONE successor closure (`next`). A later commit supersedes. */
export interface KeeperBegunBody {
  readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "keeper-begun"; readonly tessera: string; readonly v: number; readonly prev: string | null;
  readonly closure: string; readonly next: string; readonly image: string | null; readonly faces: readonly AdmittedFace[]; readonly worn: number | null;
  readonly budget: KeeperBudget; readonly supersedes: string | null; readonly nonce: string;
  /** Every live commit of a fork this commit read at its link: it settles them all and stands alone. */
  readonly settles?: readonly string[];
  /** The most devices any committed face holds, as the vessel read its signed admission fold at commit time; null where it read
   *  none. The vest fails closed on either side of one: a face of two devices owes a co-sign path that does not stand yet. */
  readonly devices: number | null;
  /** THE CARRIED CO-SIGN (one per committed face, `KeeperCosign`): the face's roster as the vessel read it and, past one device, the
   *  spent `ward-keeper-vest` co-sign over (`next`, `prev`, `nonce`). Null where the commit carries none (a one-device house). */
  readonly cosigns?: readonly KeeperCosign[] | null;
  /** THE KUKULU LEI'S LICENSE (no route rode this commit): the branch whose wide kukulu lei held returns, and the host's testimony;
   *  absent on a routed commit. The vest names the lei return its live rite spent. */
  readonly licensed?: KeeperLicense;
}
/** What licensed a commit with no route (operator ruling, 2026-11-24): the kukulu lei on `branch`, and what the host read. */
export interface KeeperLicense {
  readonly by: "kukulu-lei"; readonly branch: string;
  /** The revision, its source tree, the second fresh-archive closure (`same`), the built image's closure label (it equals `next`),
   *  and the CI push run on the revision as the host read it (`<run id>:success`). */
  readonly rev: string; readonly tree: string; readonly recheck: "same"; readonly image: string; readonly ci: string;
}
/** The vest's spend mark: the lit keeper sealed the house's end of the bond to ONE successor key, once per commit. No key rests in it. */
export interface KeeperVestedBody {
  readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "keeper-vested"; readonly tessera: string; readonly begun: string; readonly next: string;
  readonly to: string; readonly node: boolean; readonly faces: readonly string[]; readonly nonce: string;
  /** The live kūkulu rite this vest rode: each lent face's rite tessera the vest's own begin claimed a lei return for. */
  readonly rite: readonly string[];
  /** Each kukulu lei return the live rite spent (`lei` cid, `n`): what licensed a commit that rode no route. */
  readonly leis?: readonly { readonly lei: string; readonly n: number }[];
}
/** THE COMMIT LAPSES after one rite attempt that refused: the mark rests where a vest's would, so the commit never vests later. */
export interface KeeperLapsedBody {
  readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "keeper-lapsed"; readonly tessera: string; readonly begun: string; readonly reason: string; readonly nonce: string;
  /** The rite halves a begin rested before a later face refused (blind read L1): they rest unlanded, named here. */
  readonly halves?: readonly string[];
}
/** The host half: the successor, lit by vest or by the hand, names what it stands on and what it received. */
export interface KeeperLandedBody {
  readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "keeper-landed"; readonly tessera: string; readonly v: number; readonly prev: string;
  readonly begun: string; readonly closure: string; readonly image: string | null; readonly faces: readonly AdmittedFace[]; readonly worn: number | null;
  readonly budget: KeeperBudget; readonly vestings: number; readonly vest: KeeperVest | null; readonly nonce: string;
}
/** THE KEEPER SLOT: the sealed vest, alive for one handoff. It crosses the host's pipe once and never rests on disk. */
export interface KeeperSlotBody {
  readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "keeper-slot"; readonly tessera: string; readonly begun: string; readonly next: string;
  readonly to: string; readonly box: { readonly e: string; readonly n: string; readonly c: string };
}
export interface SignedPulamaAdmit { readonly body: PulamaAdmitBody; readonly signer: string; readonly sig: string }

export const pulamaRecordCid = (act: { readonly body: PulamaAdmitBody; readonly signer: string }): string => sha256HexBytesSync(canonicalJsonBytes({ body: act.body, signer: act.signer }));
export type PulamaRecordParts<A extends PulamaAdmitBody["act"]> = Omit<Extract<PulamaAdmitBody, { act: A }>, "kind">;
type Parts<A extends PulamaAdmitBody["act"]> = PulamaRecordParts<A>;
/** Sign one record of the pūlama's family under its key. */
export async function signPulamaRecord<A extends PulamaAdmitBody["act"]>(parts: PulamaRecordParts<A>, by: KukuluSigner): Promise<SignedPulamaAdmit> { return sign(parts, by); }
async function sign<A extends PulamaAdmitBody["act"]>(parts: Parts<A>, by: KukuluSigner): Promise<SignedPulamaAdmit> {
  const body = { kind: PULAMA_TESSERA_DOMAIN, ...parts } as unknown as PulamaAdmitBody;
  return { body, signer: by.key.toLowerCase(), sig: await by.sign(canonicalJsonBytes(body)) };
}

/** One row as the pūlama's own record, or null: its shape, its domain, its signature, and the pūlama's key as its signer. */
export function verifiedPulamaRecord(text: string | null, pulamaKey: string): SignedPulamaAdmit | null { return verified(text, pulamaKey); }
function verified(text: string | null, pulamaKey: string): SignedPulamaAdmit | null {
  if (text === null) return null;
  try {
    const raw = JSON.parse(text) as SignedPulamaAdmit;
    if (typeof raw !== "object" || raw === null || typeof raw.body !== "object" || raw.body === null || typeof raw.signer !== "string" || typeof raw.sig !== "string") return null;
    if (raw.body.kind !== PULAMA_TESSERA_DOMAIN || raw.signer !== pulamaKey.toLowerCase()) return null;
    return verifyEd25519(raw.sig, canonicalJsonBytes(raw.body), raw.signer) ? raw : null;
  } catch { return null; }
}

/** One admission as its row names it. */
export interface PulamaAdmission { readonly faces: readonly AdmittedFace[]; readonly by: "rite" | "hand"; readonly tessera: string; readonly tesserae: readonly AdmittedTessera[] }
/**
 * A row the pūlama's key signed that names no standing admission: its faces read no lent set (the set's own reading), or its
 * tesserae fail to name one tessera per face as its act binds them (`admission-tesserae-mismatch`).
 */
export interface PulamaAdmissionRefused { readonly refusal: LentFacesRefusal | "admission-tesserae-mismatch"; readonly message: string }

/** What the kūkulu gate and the hand door ask of the admitted set. */
export interface PulamaAdmissions {
  /** The faces `image` stands admitted for, read under the pūlama's key; the set's reading where the signed row names no
   *  lent set; null where no row of it verifies. */
  admitted(image: string, by: KukuluSigner): Promise<PulamaAdmission | PulamaAdmissionRefused | null>;
  /** Rest `image` as admitted by a kūkulu that landed par: every lent face with the tessera its own rite rests on. */
  admitByRite(image: string, rites: readonly AdmittedRite[], by: KukuluSigner): Promise<void>;
  /** THE HAND'S ADMISSION: rest the begun half, the admission, then the landed half. Answers the tessera. */
  admitByHand(image: string, faces: readonly AdmittedFace[], by: KukuluSigner): Promise<{ readonly tessera: string }>;
  /** Rest one re-service row for `image`; answers its count. */
  reserved(image: string, faces: readonly AdmittedFace[], by: KukuluSigner): Promise<number>;
  /**
   * THE HAND'S UNADMIT: rest the tombstone ending the admission of `image` that stands; null where none stands. A slot already
   * holding a signed tombstone answers `already` (ended by an earlier write); one holding a row no pūlama key signed answers
   * `occupied`, naming the slot, and the admission still stands. It never answers ended while no signed tombstone rests.
   */
  unadmit(image: string, by: KukuluSigner): Promise<{ readonly ends: string; readonly already?: true } | { readonly occupied: string; readonly ends: string } | null>;
  /** The images whose signed admission row stands ended by a tombstone. */
  ended(by: KukuluSigner): Promise<readonly string[]>;
  /** Every admission that stands (verifies and names a lent set), and each image's count of re-services. */
  list(by: KukuluSigner): Promise<ReadonlyArray<{ readonly image: string; readonly faces: readonly AdmittedFace[]; readonly by: "rite" | "hand"; readonly tessera: string; readonly tesserae: readonly AdmittedTessera[]; readonly reserved: number }>>;
}

/** An admission's faces in the lent set's canonical wire form, each with its custody id, or the set's own reading. */
function admittedFacesOf(raw: unknown): { readonly ok: true; readonly faces: readonly AdmittedFace[] } | { readonly ok: false; readonly refusal: LentFacesRefusal; readonly message: string } {
  const parsed = lentFacesOf(raw);
  if (!parsed.ok) return parsed;
  const wire = lentFacesWire(parsed.faces);
  if (wire.some(face => face.fcid === undefined)) return { ok: false, refusal: "lent-faces-malformed", message: "lent-faces-malformed: admission faces need custody ids" };
  return { ok: true, faces: wire as readonly AdmittedFace[] };
}
function canonicalFaces(raw: unknown): readonly AdmittedFace[] {
  const read = admittedFacesOf(raw);
  if (!read.ok) throw new Error(read.message);
  return read.faces;
}

/**
 * The tesserae an admission row names, read against its faces: one per face in the faces' order, each 64 hex; a hand's each
 * equal to its one tessera, a rite's set named by its tessera. Any other set refuses `admission-tesserae-mismatch`.
 */
function tesseraeOf(raw: unknown, faces: readonly AdmittedFace[], how: "rite" | "hand", tessera: string): readonly AdmittedTessera[] | PulamaAdmissionRefused {
  const mismatch = (why: string): PulamaAdmissionRefused => ({ refusal: "admission-tesserae-mismatch", message: `admission-tesserae-mismatch: ${why}` });
  if (!Array.isArray(raw) || raw.length !== faces.length) return mismatch(`the row names ${Array.isArray(raw) ? raw.length : "no"} tesserae for ${faces.length} face(s)`);
  const out: AdmittedTessera[] = [];
  for (const [i, t] of raw.entries()) {
    const row = t as Partial<AdmittedTessera> | null;
    const face = faces[i]!.ordinal;
    if (typeof row !== "object" || row === null || row.ordinal !== face || typeof row.tessera !== "string" || !TESSERA.test(row.tessera)) return mismatch(`h${face} names no tessera of its own in the row`);
    if (how === "hand" && row.tessera !== tessera) return mismatch(`a hand admits every face under its one tessera, and h${face} names another`);
    out.push({ ordinal: row.ordinal, tessera: row.tessera });
  }
  return how === "rite" && tesseraOfSet(out) !== tessera ? mismatch("the rite's tessera names another set of face tesserae") : out;
}

/** The admitted set over the pūlama's record store. */
export function pulamaAdmissions(records: SwarmWikiPort): PulamaAdmissions {
  /** Whether a tombstone the pūlama's key signed ends the admission of `image` resting on `tessera`. */
  const tombstoned = async (image: string, tessera: string, by: KukuluSigner): Promise<boolean> => {
    const tomb = verified(await records.read(pulamaUnadmittedTitle(image, tessera)), by.key);
    return tomb !== null && tomb.body.act === "image-unadmitted" && tomb.body.image === image && tomb.body.ends === tessera;
  };
  const admitted: PulamaAdmissions["admitted"] = async (image, by) => {
    const row = verified(await records.read(pulamaAdmittedTitle(image)), by.key);
    if (row === null || row.body.act !== "image-admitted" || row.body.image !== image) return null;
    // AN ADMISSION STANDS ONLY WHILE NO TOMBSTONE NAMES ITS TESSERA.
    if (await tombstoned(image, row.body.tessera, by)) return null;
    const faces = admittedFacesOf(row.body.faces);
    if (!faces.ok) return { refusal: faces.refusal, message: faces.message };
    const tesserae = tesseraeOf(row.body.tesserae, faces.faces, row.body.by, row.body.tessera);
    return "refusal" in tesserae ? tesserae : { faces: faces.faces, by: row.body.by, tessera: row.body.tessera, tesserae };
  };
  const rest = async (image: string, faces: readonly AdmittedFace[], how: "rite" | "hand", tessera: string, tesserae: readonly AdmittedTessera[], by: KukuluSigner): Promise<void> => {
    const act = await sign<"image-admitted">({ act: "image-admitted", image, faces, by: how, tessera, tesserae }, by);
    await records.write(pulamaAdmittedTitle(image), JSON.stringify(act));
  };
  return {
    admitted,
    async admitByRite(image, rites, by) {
      for (const r of rites) if (typeof r.tessera !== "string" || !TESSERA.test(r.tessera)) throw new Error(`admission-tessera-malformed: the rite of h${r.ordinal} names no tessera`);
      const faces = canonicalFaces(rites.map((r) => ({ fcid: r.fcid, ordinal: r.ordinal })));
      const tesserae = faces.map((f) => ({ ordinal: f.ordinal, tessera: rites.find((r) => r.ordinal === f.ordinal)!.tessera }));
      await rest(image, faces, "rite", tesseraOfSet(tesserae), tesserae, by);
    },
    async admitByHand(image, faces, by) {
      faces = canonicalFaces(faces);
      const tessera = sha256HexBytesSync(canonicalJsonBytes({ image, faces, nonce: randomUUID() }));
      const begun = await sign<"admit-begun">({ act: "admit-begun", image, faces, tessera }, by);
      await records.writeNew(pulamaAdmitTesseraTitle(tessera, "guest"), JSON.stringify(begun));
      await rest(image, faces, "hand", tessera, faces.map((f) => ({ ordinal: f.ordinal, tessera })), by);
      const landed = await sign<"admit-landed">({ act: "admit-landed", image, faces, tessera, begun: pulamaRecordCid(begun) }, by);
      await records.writeNew(pulamaAdmitTesseraTitle(tessera, "host"), JSON.stringify(landed));
      return { tessera };
    },
    async reserved(image, faces, by) {
      faces = canonicalFaces(faces);
      for (let n = 1; ; n++) {
        const act = await sign<"image-reserved">({ act: "image-reserved", image, faces, n }, by);
        if (await records.writeNew(`${pulamaReservedPrefix(image)}${n}`, JSON.stringify(act))) return n;
      }
    },
    async unadmit(image, by) {
      const standing = await admitted(image, by);
      if (standing === null || "refusal" in standing) return null;
      const tomb = await sign<"image-unadmitted">({ act: "image-unadmitted", image, ends: standing.tessera }, by);
      const slot = pulamaUnadmittedTitle(image, standing.tessera);
      if (await records.writeNew(slot, JSON.stringify(tomb))) return { ends: standing.tessera };
      // THE SLOT HELD A ROW: a signed tombstone there ended it already; anything else leaves the admission standing.
      return await tombstoned(image, standing.tessera, by) ? { ends: standing.tessera, already: true } : { occupied: slot, ends: standing.tessera };
    },
    async ended(by) {
      const out: string[] = [];
      for (const title of await records.list(pulamaAdmittedPrefix())) {
        const row = verified(await records.read(title), by.key);
        if (row === null || row.body.act !== "image-admitted" || pulamaAdmittedTitle(row.body.image) !== title) continue;
        if (await tombstoned(row.body.image, row.body.tessera, by)) out.push(row.body.image);
      }
      return out;
    },
    async list(by) {
      const out: Array<{ image: string; faces: readonly AdmittedFace[]; by: "rite" | "hand"; tessera: string; tesserae: readonly AdmittedTessera[]; reserved: number }> = [];
      for (const title of await records.list(pulamaAdmittedPrefix())) {
        const row = verified(await records.read(title), by.key);
        if (row === null || row.body.act !== "image-admitted" || pulamaAdmittedTitle(row.body.image) !== title) continue;
        const admission = await admitted(row.body.image, by);
        if (admission !== null && !("refusal" in admission)) out.push({ image: row.body.image, ...admission, reserved: (await records.list(pulamaReservedPrefix(row.body.image))).length });
      }
      return out;
    },
  };
}
