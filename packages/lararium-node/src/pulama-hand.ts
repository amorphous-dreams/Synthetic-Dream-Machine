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
 *   image    THE HOST'S REPORT of the image digest it raises (the kūkulu gate's input port).
 *   tessera  the tessera halves the pūlama witnessed, as they rest: `rite-begun` for each kūkulu it served, `rite-landed`
 *            for each that composed; and, while lit, the admitted images with each one's count of re-services.
 *
 * An answer names a reading, a count or a public digest. No answer and no log line carries a route or a key.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { swarmTesseraPrefix, type Credential, type SwarmWikiPort } from "@lararium/mesh";
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

export function pulamaHandDoor(a: {
  readonly holder: CustodyHolder;
  readonly server: PulamaServer;
  readonly image: { report(digest: string): void; raised(): string | null };
  readonly records: SwarmWikiPort;
  /** The admitted set the `admit` act rests into. Absent, `admit` refuses `admit-unavailable`. */
  readonly admissions?: PulamaAdmissions;
  readonly onLog?: (line: string) => void;
}): (frame: unknown) => Promise<PulamaHandAnswer> {
  const { holder, server } = a;
  const log = a.onLog ?? (() => {});
  let chain: Promise<unknown> = Promise.resolve();
  const status = () => ({ lit: holder.isUnlocked(), faces: holder.unlockedFaces().length, sessions: server.sessions(), attemptsLeft: holder.attemptsLeft(), image: a.image.raised() });
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
      case "lock": await server.lock(); return { op: "lock", ...status() };
      case "status": return { op: "status", ...status(), ...await admissionDigests() };
      case "image": {
        if (typeof f["digest"] !== "string") return { op: "image", reading: "malformed" };
        try { a.image.report(f["digest"]); } catch { return { op: "image", reading: "malformed" }; }
        log("the host reported an image digest");
        return { op: "image", reading: "reported", image: a.image.raised() };
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
