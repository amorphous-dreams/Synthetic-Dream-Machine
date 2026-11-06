/**
 * browser-ember — the browser leaf's ember row and its caller (lar:///ha.ka.ba/lararium/mesh/ember#/the-pin;
 * lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift, slice 3 part ii).
 *
 * One ember secret per (this device, hearth), minted fresh for that hearth apart from every other key, resting as a D row of
 * the face that bound it, under that face's own custody slot (`browser-face-custody.ts`, row `ember/<hearth digest>`). It never
 * syncs: no bundle, provider or fleet channel carries the row, and a leaf the browser evicts loses its ember (the hearth keeps
 * its human routes). The row records the hearth's ask key beside the secret, so the ember answers only asks that hearth signed.
 *
 * ''It answers only while its face stands unlocked'': the row opens under the face's key alone, so a locked face refuses
 * `face-locked` before any exchange runs, and a face with no slot refuses `no-custody-slot` (no ember mints before the bind).
 * An ask with no valid signature under the recorded hearth key refuses `ember-ask-unsigned`.
 *
 * The exchange's group (Tang's blinded exchange) belongs to the ember pin's own build under its registered domain; this module
 * takes it as a port (`EmberExchange`) and keeps the row, its door and its refusals.
 */
import * as ed25519 from "@noble/ed25519";
import { FaceCustodyRefused, readFaceCustody, readFaceRow, writeFaceRow } from "./browser-face-custody.js";

/** The ember pin's group: the public point of a secret, and the secret's answer to a blinded point. */
export interface EmberExchange {
  publicOf(secret: Uint8Array): Uint8Array;
  answer(secret: Uint8Array, blinded: Uint8Array): Uint8Array;
}

export interface EmberAsk { readonly hearth: string; readonly blinded: Uint8Array; readonly signature: Uint8Array }

export type EmberRefusalReading = "ember-ask-unsigned" | "ember-absent" | "ember-stands";

/** An ember act refused by name. */
export class EmberRefused extends Error {
  override readonly name = "EmberRefused";
  constructor(readonly reading: EmberRefusalReading) { super(`[browser-ember] ${reading}`); }
}

const enc = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s);
const EMBER_ASK_LABEL = "lares-ember-ask";

/** The bytes a hearth signs to ask this ember: the label, the hearth, the blinded point, each length-framed. */
export function emberAskBytes(hearth: string, blinded: Uint8Array): Uint8Array {
  const parts = [enc(EMBER_ASK_LABEL), enc(hearth), blinded];
  const out = new Uint8Array(parts.reduce((n, p) => n + 4 + p.length, 0));
  let at = 0;
  for (const p of parts) { new DataView(out.buffer).setUint32(at, p.length); out.set(p, at + 4); at += 4 + p.length; }
  return out;
}

async function emberRow(hearth: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", enc(hearth)));
  return `ember/${[...digest].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Mint this device's ember for `hearth` under `face`'s custody slot; answers the public point the hearth binds. */
export async function mintEmber(idbName: string, face: string, hearth: string, hearthKey: Uint8Array, exchange: EmberExchange): Promise<{ readonly point: Uint8Array }> {
  if (hearthKey.length !== 32) throw new Error("[browser-ember] a hearth's ask key reads 32 bytes");
  const status = await readFaceCustody(idbName, face);
  if (status.reading !== "bound") throw new FaceCustodyRefused("no-custody-slot");
  const row = await emberRow(hearth);
  if ((await readFaceRow(idbName, face, row)) !== null) throw new EmberRefused("ember-stands");
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const value = new Uint8Array(64);
  value.set(secret); value.set(hearthKey, 32);
  try {
    await writeFaceRow(idbName, face, row, value);
    return { point: exchange.publicOf(secret) };
  } finally { secret.fill(0); value.fill(0); }
}

/** Answer one signed ask from `hearth`, while `face` stands unlocked on this thread. */
export async function answerEmberAsk(idbName: string, face: string, ask: EmberAsk, exchange: EmberExchange): Promise<Uint8Array> {
  const value = await readFaceRow(idbName, face, await emberRow(ask.hearth));
  if (value === null) throw new EmberRefused("ember-absent");
  try {
    const secret = value.subarray(0, 32), hearthKey = value.subarray(32, 64);
    let signed = false;
    try { signed = await ed25519.verifyAsync(ask.signature, emberAskBytes(ask.hearth, ask.blinded), hearthKey); } catch { signed = false; }
    if (!signed) throw new EmberRefused("ember-ask-unsigned");
    return exchange.answer(secret, ask.blinded);
  } finally { value.fill(0); }
}
