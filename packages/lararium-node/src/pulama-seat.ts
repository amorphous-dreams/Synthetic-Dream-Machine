/**
 * pulama-seat — how a Node vessel finds a pūlama and stands by it.
 *
 * ── TWO NAMES IN THE ENVIRONMENT ────────────────────────────────────────────────────────────────
 *   `LAR_PULAMA_SOCKET`  the unix socket a pūlama answers at. Set, the vessel seats a `PulamaHolder` over it and keeps no
 *                        key of its own. Unset or blank, the vessel builds the in-process holder, as every suite, the
 *                        offline CLI and a herm do.
 *   `LAR_KUKULU_OFFER`   a file holding what this kūkulu wears: `{ "lei": …, "vouch": … }`, the kūkulu lei the operator's
 *                        hand strung and the vouch the standing vessel signed. The host writes it before it raises the
 *                        image. Unset, or a file that does not read, offers nothing, and the pūlama refuses `kukulu-unvouched`.
 *
 * ── THE VESSEL DIALS ONCE AT BOOT, AND AGAIN ONLY WHEN ASKED ────────────────────────────────────
 * After the floor composition stands, the vessel dials the pūlama. A session mounts the face its lei names and composes
 * with the sovereign rows; a refusal names itself once and the vessel keeps the floor. No timer redials: `lares vault
 * unlock` reaches the same holder's `unlock`, which dials again and sends no credential.
 *
 * When the session drops (the pūlama locked, its process ended, the socket went), the vessel composes at the floor.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { readFileSync } from "node:fs";
import { makePulamaHolder, type PulamaHolder } from "./pulama-holder.js";
import { dialPulama } from "./pulama-socket.js";
import type { CustodyHomes } from "./vault-carriers.js";

export const PULAMA_SOCKET_ENV = "LAR_PULAMA_SOCKET";
export const KUKULU_OFFER_ENV = "LAR_KUKULU_OFFER";

/** What the kūkulu wears, read from the offer file; an unset name or an unreadable file offers nothing. */
export function readKukuluOffer(path: string | undefined): unknown {
  if (!path || path.trim() === "") return {};
  try {
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
    return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw : {};
  } catch { return {}; }
}

/** The holder a vessel seats when its environment names a pūlama, or null where it names none. */
export function vesselPulamaHolder(homes: CustodyHomes, env: Readonly<Record<string, string | undefined>> = process.env): PulamaHolder | null {
  const socket = env[PULAMA_SOCKET_ENV]?.trim();
  if (!socket) return null;
  return makePulamaHolder({ homes, dial: () => dialPulama(socket), offer: () => readKukuluOffer(env[KUKULU_OFFER_ENV]) });
}

/**
 * Dial the pūlama once and compose on what it serves; seat the listener that composes at the floor when the session drops.
 * Answers whether a session stood.
 */
export async function standByPulama(a: {
  readonly holder: PulamaHolder;
  /** Compose again: with the sovereign rows, or at the floor. */
  readonly recompose: (sovereign: boolean) => Promise<{ readonly standing: string; readonly refused?: string }>;
  /** Mount the face the composition wears. */
  readonly mount: (ordinal: number) => void;
  readonly onLog: (line: string) => void;
}): Promise<boolean> {
  let leaving = false;
  a.holder.onClosed(() => {
    if (leaving) return;
    a.onLog("the pūlama session dropped; composing at the floor");
    a.recompose(false).catch((err: unknown) => a.onLog(`the floor did not compose after the session dropped: ${err instanceof Error ? err.message : String(err)}`));
  });
  try {
    await a.holder.unlock([]);
  } catch (err) {
    const reading = (err as { reading?: unknown }).reading;
    a.onLog(`the pūlama serves no session: ${typeof reading === "string" ? reading : err instanceof Error ? err.message : String(err)}; this vessel keeps the floor`);
    return false;
  }
  const wears = a.holder.wears();
  if (wears !== null) a.mount(wears);
  const stood = await a.recompose(true);
  if (stood.refused !== undefined) {
    // A SESSION NEVER RESTS OVER A FLOOR: held and standing never disagree.
    // The refused composition already left the floor standing, so this leaving asks for no second one.
    leaving = true;
    try { await a.holder.lock(); } finally { leaving = false; }
    a.onLog("the sovereign composition did not stand on the pūlama's session; the session left");
    return false;
  }
  // THE HOST HALF: the vessel composed, so the pūlama rests `rite-landed` beside the half it began under. A landing that
  // refuses leaves the guest half alone, which conferre reads red; the vessel keeps standing.
  let landed = "";
  try { landed = (await a.holder.landRite()).par ? "; the tessera reads par" : "; the tessera's halves differ"; }
  catch (err) { landed = `; the host half did not land (${(err as { reading?: string }).reading ?? (err instanceof Error ? err.message : String(err))})`; }
  a.onLog(`standing by the pūlama${wears !== null ? `; face h${wears} worn` : ""} (${stood.standing})${landed}`);
  return true;
}
