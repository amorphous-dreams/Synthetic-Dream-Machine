/**
 * ceremony-door — the vessel worker's side of the unlock ceremony (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-ceremony).
 *
 * The vessel raises an ask: the page hears its public words (`ask`) and opens the ceremony document; the page mints a fresh
 * MessageChannel, hands this thread one end (`ceremony:port`) and the service worker the other, and keeps neither. The
 * ceremony document claims its end from the service worker, reads the ask this thread sends down the port, and answers on
 * it. The secret's bytes arrive on a transferred ArrayBuffer, decode here, and zero at once.
 *
 * The ward takes a passphrase alone: a passkey answer to a ward ask refuses `ward-passkey-refused`. A route the ask did not
 * offer refuses `ceremony-route-refused`. A page that cannot open the ceremony names its refusal (`ceremony:refused`), and the
 * ask rejects with that name; nothing falls back to a form on the surface page.
 *
 * EVERY ASK NAMES ITS FACE (slice 3 part ii): the PersonaGroup it speaks for, or null for this browser itself (the floor's
 * place custody). An ask that names none refuses `ask-face-absent`; a clear names one PersonaGroup, so a clear for this browser
 * (null) refuses `clear-face-absent`; a local handle index `h<N>` names no face (`face-names-a-handle`). A refused ask reaches
 * no page.
 */
import type { Credential } from "@lararium/mesh";
import type { CeremonyAnswer, CeremonyAsk, CeremonyAskKind, CeremonyPasskey, CeremonyRoute, CeremonyToVessel, VesselToCeremony } from "../ceremony-protocol.js";

/** A refusal by name: the error carries the name and never a byte of a route. */
export class CeremonyRefused extends Error {
  override readonly name = "CeremonyRefused";
  constructor(readonly refusal: string) { super(`${refusal}: the unlock ceremony took no answer for this ask`); }
}

export interface CeremonyAskSpec {
  readonly kind: CeremonyAskKind;
  readonly act: string;
  readonly words?: string;
  /** The PersonaGroup the ask speaks for; null names this browser itself. Required: an ask with none refuses `ask-face-absent`. */
  readonly face: string | null;
  readonly passkeys?: readonly CeremonyPasskey[];
}

/** What the door tells the page: the public ask, and its settling. */
export type DoorToPage =
  | { readonly t: "ask"; readonly askId: string; readonly kind: CeremonyAskKind; readonly act: string; readonly words: string; readonly face: string | null }
  | { readonly t: "ask:settled"; readonly askId: string };

/** The face an ask names, checked: present, a PersonaGroup or null for this browser, and a PersonaGroup for a clear. */
export function checkAskFace(kind: CeremonyAskKind, face: unknown): string | null {
  if (face === undefined) throw new CeremonyRefused("ask-face-absent");
  if (face !== null && (typeof face !== "string" || face.length === 0)) throw new CeremonyRefused("ask-face-absent");
  if (typeof face === "string" && /^h\d+$/.test(face)) throw new CeremonyRefused("face-names-a-handle");
  if (kind === "clear" && face === null) throw new CeremonyRefused("clear-face-absent");
  return face;
}

const hexOf = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** The routes an ask offers: the ward and a first bind take a passphrase alone; an unlock or a clear takes a passkey too, where one stands. */
export function routesFor(kind: CeremonyAskKind, passkeys: readonly CeremonyPasskey[]): readonly CeremonyRoute[] {
  return kind === "ward" || kind === "bind-first" || passkeys.length === 0 ? ["passphrase"] : ["passphrase", "passkey"];
}

/** Decode one answer for one ask. Every byte the answer carried zero-fills before this returns. */
export function decodeCeremonyAnswer(ask: Pick<CeremonyAsk, "kind" | "routes">, answer: CeremonyAnswer): Credential | null {
  if (answer === null) return null;
  if (answer.kind === "passphrase") {
    if (!(answer.bytes instanceof ArrayBuffer)) throw new CeremonyRefused("ceremony-answer-malformed");
    const bytes = new Uint8Array(answer.bytes);
    try {
      const passphrase = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (passphrase.length === 0) throw new CeremonyRefused("ceremony-answer-empty");
      return { kind: "passphrase", passphrase };
    } catch (e) {
      throw e instanceof CeremonyRefused ? e : new CeremonyRefused("ceremony-answer-malformed");
    } finally { bytes.fill(0); }
  }
  if (answer.kind === "passkey") {
    const id = answer.credentialId instanceof ArrayBuffer ? new Uint8Array(answer.credentialId) : null;
    const out = answer.prfOutput instanceof ArrayBuffer ? new Uint8Array(answer.prfOutput) : null;
    try {
      // THE WARD STAYS PASSPHRASE-ONLY: a passkey never opens a ward act, whatever the ceremony sent.
      if (ask.kind === "ward") throw new CeremonyRefused("ward-passkey-refused");
      if (!ask.routes.includes("passkey")) throw new CeremonyRefused("ceremony-route-refused");
      if (!id || !out || id.length === 0 || out.length !== 32) throw new CeremonyRefused("ceremony-answer-malformed");
      return { kind: "passkey", credentialId: id.slice(), prfOutput: out.slice() };
    } finally { id?.fill(0); out?.fill(0); }
  }
  throw new CeremonyRefused("ceremony-answer-malformed");
}

interface Pending {
  readonly ask: CeremonyAsk;
  resolve(c: Credential | null): void;
  reject(e: unknown): void;
  port: MessagePort | null;
}

/** Stand the door: `post` reaches the page; the caller feeds `port` and `refused` from the page's messages. */
export function standCeremonyDoor(post: (msg: DoorToPage) => void) {
  const pending = new Map<string, Pending>();
  const settle = (askId: string): Pending | undefined => {
    const p = pending.get(askId);
    pending.delete(askId);
    if (p?.port) { try { p.port.postMessage({ t: "settled", askId } satisfies VesselToCeremony); } catch { /* the ceremony left */ } p.port.close(); }
    post({ t: "ask:settled", askId });
    return p;
  };

  return {
    /** Raise one ask and wait for the ceremony's answer, decoded. */
    async ask(spec: CeremonyAskSpec): Promise<Credential | null> {
      const face = checkAskFace(spec.kind, (spec as { face?: unknown }).face);
      const askId = crypto.randomUUID();
      const passkeys = spec.passkeys ?? [];
      const words = spec.words ?? "";
      const digest = hexOf(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([askId, spec.kind, spec.act]))));
      const ask: CeremonyAsk = { t: "ask", askId, kind: spec.kind, act: spec.act, digest, face, routes: routesFor(spec.kind, passkeys), passkeys, words };
      return new Promise<Credential | null>((resolve, reject) => {
        pending.set(askId, { ask, resolve, reject, port: null });
        post({ t: "ask", askId, kind: spec.kind, act: spec.act, words, face });
      });
    },
    /** The page handed this thread its end of a ceremony channel. A second port for one ask, or a port for no ask, closes unread. */
    port(askId: string, port: MessagePort): void {
      const p = pending.get(askId);
      if (!p || p.port) { try { port.postMessage({ t: "refused", askId, refusal: "ceremony-ask-taken" } satisfies VesselToCeremony); } catch { /* gone */ } port.close(); return; }
      p.port = port;
      port.onmessage = (e: MessageEvent) => {
        const msg = e.data as CeremonyToVessel | null;
        if (!msg || msg.t !== "answer" || msg.askId !== askId) return;
        const held = settle(askId);
        if (!held) return;
        try { held.resolve(decodeCeremonyAnswer(held.ask, msg.answer)); } catch (err) { held.reject(err); }
      };
      port.postMessage(p.ask);
    },
    /** The page could not open the ceremony: the ask rejects with that name. */
    refused(askId: string, refusal: string): void {
      const held = settle(askId);
      held?.reject(new CeremonyRefused(refusal));
    },
  };
}

export type CeremonyDoor = ReturnType<typeof standCeremonyDoor>;
