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
 *   admitted/<image>              ONE row per image: the faces it serves, the act that admitted it (`rite` or `hand`) and the
 *                                 tessera that act rests on. A later admission of the same image writes over the row.
 *   reserved/<image>/<n>          one row per re-service, counted from 1, claimed atomically
 *   admit/<tessera>/guest · host  the hand's own tessera: `admit-begun` rests before the admission, `admit-landed` after
 *                                 it, naming the begun half by its cid. Both halves come from the one hand act.
 *
 * A READ TRUSTS A ROW ONLY UNDER THE PŪLAMA'S KEY. The key derives from the custody root, so a row written into the state
 * directory by anything that never held that root reads as no admission: the file alone admits nothing. A row the key
 * signed whose faces read no lent set answers the set's own reading (`lent-faces-empty`, `lent-faces-malformed`), and the
 * gate refuses by it.
 *
 * No route and no key rests in any row: each holds digests, faces' custody ids and a signature.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
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

/** The face an admission serves, as the pūlama's custody names it. */
export interface AdmittedFace { readonly fcid: string; readonly ordinal: number }

export type PulamaAdmitBody =
  | { readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "image-admitted"; readonly image: string; readonly faces: readonly AdmittedFace[]; readonly by: "rite" | "hand"; readonly tessera: string }
  | { readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "image-reserved"; readonly image: string; readonly faces: readonly AdmittedFace[]; readonly n: number }
  | { readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "admit-begun"; readonly image: string; readonly faces: readonly AdmittedFace[]; readonly tessera: string }
  | { readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "admit-landed"; readonly image: string; readonly faces: readonly AdmittedFace[]; readonly tessera: string; readonly begun: string };
export interface SignedPulamaAdmit { readonly body: PulamaAdmitBody; readonly signer: string; readonly sig: string }

const cidOf = (act: { readonly body: PulamaAdmitBody; readonly signer: string }): string => sha256HexBytesSync(canonicalJsonBytes({ body: act.body, signer: act.signer }));
type Parts<A extends PulamaAdmitBody["act"]> = Omit<Extract<PulamaAdmitBody, { act: A }>, "kind">;
async function sign<A extends PulamaAdmitBody["act"]>(parts: Parts<A>, by: KukuluSigner): Promise<SignedPulamaAdmit> {
  const body = { kind: PULAMA_TESSERA_DOMAIN, ...parts } as unknown as PulamaAdmitBody;
  return { body, signer: by.key.toLowerCase(), sig: await by.sign(canonicalJsonBytes(body)) };
}

/** One row as the pūlama's own record, or null: its shape, its domain, its signature, and the pūlama's key as its signer. */
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
export interface PulamaAdmission { readonly faces: readonly AdmittedFace[]; readonly by: "rite" | "hand"; readonly tessera: string }
/** A row the pūlama's key signed whose faces read no lent set: the set's own reading. */
export interface PulamaAdmissionRefused { readonly refusal: LentFacesRefusal; readonly message: string }

/** What the kūkulu gate and the hand door ask of the admitted set. */
export interface PulamaAdmissions {
  /** The faces `image` stands admitted for, read under the pūlama's key; the set's reading where the signed row names no
   *  lent set; null where no row of it verifies. */
  admitted(image: string, by: KukuluSigner): Promise<PulamaAdmission | PulamaAdmissionRefused | null>;
  /** Rest `image` as admitted by a rite that landed par (`tessera`: the rite's own). */
  admitByRite(image: string, faces: readonly AdmittedFace[], tessera: string, by: KukuluSigner): Promise<void>;
  /** THE HAND'S ADMISSION: rest the begun half, the admission, then the landed half. Answers the tessera. */
  admitByHand(image: string, faces: readonly AdmittedFace[], by: KukuluSigner): Promise<{ readonly tessera: string }>;
  /** Rest one re-service row for `image`; answers its count. */
  reserved(image: string, faces: readonly AdmittedFace[], by: KukuluSigner): Promise<number>;
  /** Every admission that stands (verifies and names a lent set), and each image's count of re-services. */
  list(by: KukuluSigner): Promise<ReadonlyArray<{ readonly image: string; readonly faces: readonly AdmittedFace[]; readonly by: "rite" | "hand"; readonly tessera: string; readonly reserved: number }>>;
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

/** The admitted set over the pūlama's record store. */
export function pulamaAdmissions(records: SwarmWikiPort): PulamaAdmissions {
  const admitted: PulamaAdmissions["admitted"] = async (image, by) => {
    const row = verified(await records.read(pulamaAdmittedTitle(image)), by.key);
    if (row === null || row.body.act !== "image-admitted" || row.body.image !== image) return null;
    const faces = admittedFacesOf(row.body.faces);
    return faces.ok ? { faces: faces.faces, by: row.body.by, tessera: row.body.tessera } : { refusal: faces.refusal, message: faces.message };
  };
  const rest = async (image: string, faces: readonly AdmittedFace[], how: "rite" | "hand", tessera: string, by: KukuluSigner): Promise<void> => {
    const act = await sign<"image-admitted">({ act: "image-admitted", image, faces: canonicalFaces(faces), by: how, tessera }, by);
    await records.write(pulamaAdmittedTitle(image), JSON.stringify(act));
  };
  return {
    admitted,
    admitByRite: (image, faces, tessera, by) => rest(image, faces, "rite", tessera, by),
    async admitByHand(image, faces, by) {
      faces = canonicalFaces(faces);
      const tessera = sha256HexBytesSync(canonicalJsonBytes({ image, faces, nonce: randomUUID() }));
      const begun = await sign<"admit-begun">({ act: "admit-begun", image, faces, tessera }, by);
      await records.writeNew(pulamaAdmitTesseraTitle(tessera, "guest"), JSON.stringify(begun));
      await rest(image, faces, "hand", tessera, by);
      const landed = await sign<"admit-landed">({ act: "admit-landed", image, faces, tessera, begun: cidOf(begun) }, by);
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
    async list(by) {
      const out: Array<{ image: string; faces: readonly AdmittedFace[]; by: "rite" | "hand"; tessera: string; reserved: number }> = [];
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
