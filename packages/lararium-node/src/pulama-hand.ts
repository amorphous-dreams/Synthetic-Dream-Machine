/**
 * pulama-hand — THE PŪLAMA'S HAND DOOR: the acts only the operator's own hand, or the host shim, brings.
 *
 * The hand door answers on a socket of its own, inside the pūlama and mounted nowhere else; no vessel reaches it and no
 * session frame carries one of its acts. One frame in, one answer out.
 *
 *   light    the operator's route opens the vessel key and every face it fits, here, in the pūlama. ONLY THIS ACT LIGHTS
 *            THE PŪLAMA: no lei, no vouch and no session carries a route. The unlock bound holds as it does on a vessel's
 *            door, and a vessel's restart never resets it: the count rides the pūlama's own life.
 *   admit    THE HAND ADMITS AN IMAGE. The operator's route PROVES against the lit holder (`CustodyHolder.proves`: it opens
 *            nothing and holds nothing new; a miss spends an unlock attempt as an unlock's miss does), and the image the
 *            host reports then rests admitted for the named open faces, under a tessera whose two halves this act alone rests
 *            (`pulama-admit`). An unlit pūlama refuses `pulama-locked` and an unreported image `image-unreported`, each
 *            before the route reads. The route never leaves the pūlama.
 *   unadmit  THE HAND ENDS AN ADMISSION. The route proves as `admit`'s does, and the admission of the named image digest rests
 *            ended under a signed tombstone naming its tessera (`pulama-admit`); the gate then reads it unadmitted. An unlit
 *            pūlama refuses `pulama-locked` before the route reads; a digest no admission stands for answers
 *            `image-not-admitted` once the route proves.
 *   lock     every session drops and every key zero-fills.
 *   status   lit or not, the faces open, the sessions standing, attempts left, the image the host reported; while lit, the
 *            admitted digests and the ended ones. Opens nothing.
 *   image    THE HOST'S REPORT of the image digest it raises (the kūkulu gate's input port), with an optional seed line: the
 *            seed that image offers beside the founding record, ratchet by ratchet, as the host read it (D1). The pūlama
 *            opens no document, so it names the line and never computes it; `status` and `admit` repeat it, and no admitted
 *            row carries it: admission moves nothing.
 *   tessera  the tessera halves the pūlama witnessed, as they rest: `rite-begun` for each kūkulu it served, `rite-landed`
 *            for each that composed; and, while lit, the admitted images with each one's count of re-services.
 *   lei      THE HAND STRINGS, RESTRINGS OR UNSTRINGS A LEI (`act`: `kui` · `restring` · `unstring`), SIGN-ONLY. The vessel under
 *            a pūlama holds no face root, so the hand's lei acts come here, where the root rests: the face's root opens fresh
 *            under the operator's route (a ward act; a miss spends the face's own ward attempts), signs ONE record (a lei, or
 *            an unstring) for the face's own group, and zeroes. The act writes nothing: the vessel lands the record
 *            (`lares lei land`), where the chain's tip, the returns left and the push co-sign gate judge it. A restring rides
 *            kui: it names the line's tip it follows (`after`, as `lares lei show` reads it), and signs a lei after that tip.
 *            An unlit pūlama, an unopened face, a face whose anchors name no group, malformed terms, a count above twelve
 *            without `confirm` and a restring naming no tip each refuse before the route reads.
 *
 * An answer names a reading, a count or a public digest. No answer and no log line carries a route or a key.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import type { ExecLeiScope } from "@lararium/mesh";
import {
  LEI_RETURNS_ASK_ABOVE, isSwarmLeiRite, signSwarmAct, swarmActCid, swarmTesseraPrefix,
  type Credential, type SwarmBodyParts, type SwarmSignerPort, type SwarmWikiPort,
} from "@lararium/mesh";
import { lentFacesOf } from "@lararium/mesh/lent-faces";
import type { CustodyHolder } from "./custody-holder.js";
import { pulamaSignerOf } from "./kukulu-gate.js";
import type { PulamaAdmissions } from "./pulama-admit.js";
import type { PulamaServer } from "./pulama-server.js";

export type PulamaHandAnswer = Readonly<Record<string, unknown>> & { readonly op: string };

function credentialsOf(v: unknown): readonly Credential[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: Credential[] = [];
  for (const c of v as unknown[]) {
    const k = (c as { kind?: unknown } | null)?.kind;
    if (k === "passphrase" && typeof (c as { passphrase?: unknown }).passphrase === "string") out.push({ kind: "passphrase", passphrase: (c as { passphrase: string }).passphrase });
    else if (k === "paper" && Array.isArray((c as { sheets?: unknown }).sheets) && (c as { sheets: unknown[] }).sheets.every((s) => typeof s === "string")) out.push({ kind: "paper", sheets: [...(c as { sheets: string[] }).sheets] });
    else return null;
  }
  return out;
}

/** The face root the hand's `lei` act signs under, read in the pūlama, where the root rests. */
export interface PulamaLeiHand {
  /** The PersonaGroup the face at this ordinal names (its anchors row); null where none reads. */
  group(ordinal: number): Promise<string | null>;
  /** The face root's signer for ONE act, opened fresh under the operator's route (a ward act); a route that opens no slot of the
   *  face's ward throws the ward's refusal by its reading. */
  signer(ordinal: number, credentials: readonly Credential[]): Promise<SwarmSignerPort>;
}

type LeiAct = "kui" | "restring" | "unstring";
const CID = /^[0-9a-f]{64}$/;

/** The record a lei frame asks the hand to sign, or the refusal its terms read; the shape check runs after (`signSwarmAct`'s own). */
function leiPartsOf(act: LeiAct, group: string, f: Readonly<Record<string, unknown>>): { readonly parts: SwarmBodyParts; readonly after?: string } | { readonly reading: string; readonly detail: string } {
  const malformed = (detail: string) => ({ reading: "lei-malformed", detail });
  const rite = f["rite"], branch = f["branch"];
  if (!isSwarmLeiRite(rite)) return malformed("a lei names its rite: push, kukulu, keep or exec");
  if (typeof branch !== "string" || branch === "") return malformed("a lei names its branch");
  if (act === "unstring") {
    const lei = f["lei"];
    if (typeof lei !== "string" || !CID.test(lei)) return malformed("an unstring names its lei by cid");
    return { parts: { act: "lei-unstrung", group, rite, branch, lei } };
  }
  const after = f["after"] ?? null;
  if (act === "restring" && after === null) return { reading: "lei-restring-names-the-tip", detail: "a restring follows the line's tip: name it (`after`, as `lares lei show` reads it)" };
  if (after !== null && (typeof after !== "string" || !CID.test(after))) return malformed("a lei names the lei it follows by cid (`after`), or none for the line's first");
  const reach = f["reach"] ?? "wide";
  if (reach === "wide") {
    const returns = f["returns"];
    if (f["head"] !== undefined) return malformed("a wide lei names no head");
    if (typeof returns !== "number" || !Number.isSafeInteger(returns) || returns < 1) return malformed("a wide lei names its returns, a count of at least one");
    if (returns > LEI_RETURNS_ASK_ABOVE && f["confirm"] !== true) return { reading: "swarm-lei-returns-unconfirmed", detail: `this lei would carry ${returns} returns, more than ${LEI_RETURNS_ASK_ABOVE}; confirm the count to string it` };
    return { parts: { act: "lei", group, rite, branch, after, reach, returns, ...(rite === "exec" ? { scope: f["scope"] as ExecLeiScope } : {}) }, ...(after !== null ? { after } : {}) };
  }
  if (reach === "head") {
    const head = f["head"];
    if (f["returns"] !== undefined) return malformed("a head lei spends once and names no returns");
    if (typeof head !== "string" || head === "") return malformed("a head lei names its head");
    return { parts: { act: "lei", group, rite, branch, after, reach, head, ...(rite === "exec" ? { scope: f["scope"] as ExecLeiScope } : {}) }, ...(after !== null ? { after } : {}) };
  }
  return malformed("a lei's reach reads wide or head");
}

export function pulamaHandDoor(a: {
  readonly holder: CustodyHolder;
  readonly server: PulamaServer;
  readonly image: { report(digest: string): void; raised(): string | null };
  readonly records: SwarmWikiPort;
  /** The admitted set the `admit` act rests into. Absent, `admit` refuses `admit-unavailable`. */
  readonly admissions?: PulamaAdmissions;
  /** The face root the `lei` act signs under. Absent, `lei` refuses `lei-unavailable`. */
  readonly lei?: PulamaLeiHand;
  readonly onLog?: (line: string) => void;
}): (frame: unknown) => Promise<PulamaHandAnswer> {
  const { holder, server } = a;
  const log = a.onLog ?? (() => {});
  let chain: Promise<unknown> = Promise.resolve();
  // THE SEED LINE the host reported beside the image; a later report with no line clears it.
  let seed: string | null = null;
  const status = () => ({ lit: holder.isUnlocked(), faces: holder.unlockedFaces().length, sessions: server.sessions(), attemptsLeft: holder.attemptsLeft(), image: a.image.raised(), ...(seed !== null ? { seed } : {}) });
  /** The admitted digests and the ended ones, read under the pūlama's key: an unlit pūlama names none. */
  const admissionDigests = async () => {
    if (!a.admissions || !holder.isUnlocked()) return {};
    const by = await pulamaSignerOf(holder);
    return { admitted: (await a.admissions.list(by)).map((r) => r.image), ended: [...await a.admissions.ended(by)] };
  };
  const act = async (frame: unknown): Promise<PulamaHandAnswer> => {
    const f = (typeof frame === "object" && frame !== null ? frame : {}) as Record<string, unknown>;
    switch (f["op"]) {
      case "light": {
        const credentials = credentialsOf(f["credentials"]);
        if (credentials === null) return { op: "light", reading: "malformed" };
        const opened = await holder.unlock(credentials);
        if (opened.reading !== "opens" && opened.reading !== "already-unlocked") { log(`light: ${opened.reading}`); return { op: "light", ...opened, ...status() }; }
        const faces = (await holder.unlockFaces(credentials)).map((r) => r.reading);
        server.refresh();
        log(`lit: ${faces.filter((r) => r === "opens" || r === "already-unlocked").length} face(s) open`);
        return { op: "light", reading: opened.reading, faceReadings: faces, ...status() };
      }
      case "admit": {
        if (!a.admissions) return { op: "admit", reading: "admit-unavailable" };
        // UNLIT OR UNREPORTED REFUSES BEFORE THE ROUTE READS: nothing proves against a holder that holds no key, and no image stands to admit.
        if (!holder.isUnlocked()) return { op: "admit", reading: "pulama-locked", ...status() };
        const image = a.image.raised();
        if (image === null) return { op: "admit", reading: "image-unreported", ...status() };
        const credentials = credentialsOf(f["credentials"]);
        if (credentials === null) return { op: "admit", reading: "malformed" };
        // THE FACES NAMED: whole ordinals, each once; none named admits every lit face. A lone `face` names no set.
        const raw = f["faces"] ?? [];
        if (f["face"] !== undefined || !Array.isArray(raw) || raw.some((n) => typeof n !== "number")) return { op: "admit", reading: "lent-faces-malformed" };
        if (raw.length > 0) { const parsed = lentFacesOf(raw); if (!parsed.ok) return { op: "admit", reading: parsed.refusal }; }
        const named = raw as number[];
        // THE ROUTE PROVES A PERSON STANDS HERE: it opens a slot of this vessel's tree to the key already held, and opens nothing new.
        const proof = await holder.proves(credentials);
        if (proof.reading !== "proves") { log(`admit: ${proof.reading}`); return { op: "admit", ...proof, ...status() }; }
        const open: Array<{ fcid: string; ordinal: number }> = [];
        for (const fcid of holder.unlockedFaces()) { const at = await holder.faceStanding({ fcid }); if (at !== null) open.push({ fcid: at.fcid, ordinal: at.ordinal }); }
        const missing = named.find((n) => !open.some((o) => o.ordinal === n));
        if (missing !== undefined) return { op: "admit", reading: "face-locked", face: missing, openFaces: open.map((o) => o.ordinal), ...status() };
        const faces = named.length ? open.filter((o) => named.includes(o.ordinal)) : open;
        if (!faces.length) return { op: "admit", reading: "face-locked", openFaces: [], ...status() };
        const { tessera } = await a.admissions.admitByHand(image, faces, await pulamaSignerOf(holder));
        const ordinals = faces.map((face) => face.ordinal).sort((x, y) => x - y);
        log(`admitted by hand: the reported image now serves ${ordinals.map((n) => `h${n}`).join(", ")}`);
        return { op: "admit", reading: "admitted", admitted: image, tessera, ...status(), lent: ordinals };
      }
      case "unadmit": {
        if (!a.admissions) return { op: "unadmit", reading: "admit-unavailable" };
        if (!holder.isUnlocked()) return { op: "unadmit", reading: "pulama-locked", ...status() };
        const image = f["image"];
        const credentials = credentialsOf(f["credentials"]);
        if (typeof image !== "string" || image === "" || credentials === null) return { op: "unadmit", reading: "malformed" };
        // THE ROUTE PROVES A PERSON STANDS HERE, as an admission's does; it opens nothing new.
        const proof = await holder.proves(credentials);
        if (proof.reading !== "proves") { log(`unadmit: ${proof.reading}`); return { op: "unadmit", ...proof, ...status() }; }
        const ended = await a.admissions.unadmit(image, await pulamaSignerOf(holder));
        if (ended === null) return { op: "unadmit", reading: "image-not-admitted", digest: image, ...status() };
        if ("occupied" in ended) {
          log("unadmit: the tombstone slot holds a row the pūlama never signed; the admission still stands");
          return { op: "unadmit", reading: "unadmit-slot-occupied", digest: image, slot: ended.occupied, detail: `the tombstone slot ${ended.occupied} holds a row the pūlama's key never signed, so no tombstone rests and the admission still stands; clear that row from the pūlama's state dir, then unadmit again`, ...status() };
        }
        if (ended.already === true) return { op: "unadmit", reading: "unadmitted", already: true, digest: image, ends: ended.ends, ...status() };
        log("unadmitted by hand: an image's admission rests ended under a tombstone");
        return { op: "unadmit", reading: "unadmitted", digest: image, ends: ended.ends, ...status() };
      }
      case "lei": {
        if (!a.lei) return { op: "lei", reading: "lei-unavailable" };
        // UNLIT REFUSES BEFORE ANYTHING READS: no root rests open to sign under.
        if (!holder.isUnlocked()) return { op: "lei", reading: "pulama-locked", ...status() };
        const act = f["act"], face = f["face"];
        if ((act !== "kui" && act !== "restring" && act !== "unstring") || typeof face !== "number" || !Number.isSafeInteger(face) || face < 0) {
          return { op: "lei", reading: "lei-malformed", detail: "a lei act names kui, restring or unstring, and the face by its whole ordinal" };
        }
        let open = false;
        for (const fcid of holder.unlockedFaces()) { if ((await holder.faceStanding({ fcid }))?.ordinal === face) { open = true; break; } }
        if (!open) return { op: "lei", act, reading: "face-locked", face, ...status() };
        const group = await a.lei.group(face);
        if (group === null) return { op: "lei", act, reading: "face-group-unread", face, detail: `face h${face} names no PersonaGroup in its anchors, so no lei signs for it` };
        const terms = leiPartsOf(act, group, f);
        if ("reading" in terms) return { op: "lei", act, ...terms };
        // THE SHAPE READS BEFORE THE ROUTE: a body no swarm control forms signs nothing, so a probe that signs nothing judges it.
        try { await signSwarmAct(terms.parts, { key: "", sign: async () => "" }); }
        catch { return { op: "lei", act, reading: "lei-malformed", detail: "the lei's terms form no swarm record (its branch reads as no name)" }; }
        const credentials = credentialsOf(f["credentials"]);
        if (credentials === null) return { op: "lei", act, reading: "malformed" };
        // THE ROUTE OPENS THE FACE ROOT FOR THIS ONE SIGNATURE, here in the pūlama; the record leaves, the root never does.
        let record: Awaited<ReturnType<typeof signSwarmAct>>;
        try { record = await signSwarmAct(terms.parts, await a.lei.signer(face, credentials)); }
        catch (err) {
          const e = err as { reading?: unknown; code?: unknown; message?: unknown };
          const reading = typeof e.reading === "string" ? e.reading : typeof e.code === "string" ? e.code : "lei-sign-refused";
          log(`lei ${act}: ${reading}`);
          return { op: "lei", act, reading, face, ...(typeof e.message === "string" ? { detail: e.message } : {}) };
        }
        log(`signed by hand: a ${terms.parts.act === "lei-unstrung" ? "lei's unstring" : "lei"} for h${face}; the vessel lands it`);
        return { op: "lei", act, reading: "signed", face, record, cid: swarmActCid(record), ...(act === "restring" ? { restrung: terms.after } : {}) };
      }
      case "lock": await server.lock(); return { op: "lock", ...status() };
      case "status": return { op: "status", ...status(), ...await admissionDigests() };
      case "image": {
        if (typeof f["digest"] !== "string") return { op: "image", reading: "malformed" };
        if (f["seed"] !== undefined && typeof f["seed"] !== "string") return { op: "image", reading: "malformed" };
        try { a.image.report(f["digest"]); } catch { return { op: "image", reading: "malformed" }; }
        seed = typeof f["seed"] === "string" && f["seed"].trim() !== "" ? f["seed"].trim() : null;
        log(seed !== null ? "the host reported an image digest and the seed it offers" : "the host reported an image digest");
        return { op: "image", reading: "reported", image: a.image.raised(), ...(seed !== null ? { seed } : {}) };
      }
      case "tessera": {
        const halves: unknown[] = [];
        for (const title of await a.records.list(swarmTesseraPrefix())) { const text = await a.records.read(title); if (text !== null) { try { halves.push(JSON.parse(text)); } catch { /* a row that forms no record lists as nothing */ } } }
        // The admitted set reads only under the pūlama's key, so an unlit pūlama lists none.
        const admitted = a.admissions && holder.isUnlocked() ? await a.admissions.list(await pulamaSignerOf(holder)) : [];
        return { op: "tessera", halves, admitted };
      }
      default: return { op: String(f["op"] ?? ""), reading: "unknown-act" };
    }
  };
  // ONE ACT AT A TIME, as the custody door runs its own.
  return (frame) => { const run = chain.then(() => act(frame)); chain = run.catch(() => undefined); return run; };
}
