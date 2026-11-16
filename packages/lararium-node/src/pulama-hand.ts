/**
 * pulama-hand — THE PŪLAMA'S HAND DOOR: the acts only the operator's own hand, or the host shim, brings.
 *
 * The hand door answers on a socket of its own, inside the pūlama and mounted nowhere else; no vessel reaches it and no
 * session frame carries one of its acts. One frame in, one answer out.
 *
 *   light    the operator's route opens the vessel key and every face it fits, here, in the pūlama. ONLY THIS ACT LIGHTS
 *            THE PŪLAMA: no lei, no vouch and no session carries a route. The unlock bound holds as it does on a vessel's
 *            door, and a vessel's restart never resets it: the count rides the pūlama's own life.
 *   lock     every session drops and every key zero-fills.
 *   status   lit or not, the faces open, the sessions standing, attempts left, the image the host reported. Opens nothing.
 *   image    THE HOST'S REPORT of the image digest it raises (the kūkulu gate's input port).
 *   tessera  the pūlama's signed halves, as they rest.
 *
 * An answer names a reading, a count or a public digest. No answer and no log line carries a route or a key.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import type { Credential, SwarmWikiPort } from "@lararium/mesh";
import type { CustodyHolder } from "./custody-holder.js";
import type { PulamaServer } from "./pulama-server.js";
import { PULAMA_TESSERA_PREFIX } from "./pulama-state.js";

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
  readonly onLog?: (line: string) => void;
}): (frame: unknown) => Promise<PulamaHandAnswer> {
  const { holder, server } = a;
  const log = a.onLog ?? (() => {});
  let chain: Promise<unknown> = Promise.resolve();
  const status = () => ({ lit: holder.isUnlocked(), faces: holder.unlockedFaces().length, sessions: server.sessions(), attemptsLeft: holder.attemptsLeft(), image: a.image.raised() });
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
      case "lock": await server.lock(); return { op: "lock", ...status() };
      case "status": return { op: "status", ...status() };
      case "image": {
        if (typeof f["digest"] !== "string") return { op: "image", reading: "malformed" };
        try { a.image.report(f["digest"]); } catch { return { op: "image", reading: "malformed" }; }
        log("the host reported an image digest");
        return { op: "image", reading: "reported", image: a.image.raised() };
      }
      case "tessera": {
        const halves: unknown[] = [];
        for (const title of await a.records.list(PULAMA_TESSERA_PREFIX)) { const text = await a.records.read(title); if (text !== null) { try { halves.push(JSON.parse(text)); } catch { /* a row that forms no record lists as nothing */ } } }
        return { op: "tessera", halves };
      }
      default: return { op: String(f["op"] ?? ""), reading: "unknown-act" };
    }
  };
  // ONE ACT AT A TIME, as the custody door runs its own.
  return (frame) => { const run = chain.then(() => act(frame)); chain = run.catch(() => undefined); return run; };
}
