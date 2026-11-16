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
 * A vessel that names no offer still dials: the pūlama serves it where the image the host reports stands admitted (a kūkulu
 * that landed par, or the hand's `pulama admit`), and refuses `pulama-image-unadmitted` otherwise.
 *
 * After the floor composition stands, the vessel dials the pūlama. A session mounts the face its lei names and composes
 * with the sovereign rows; a refusal names itself once and the vessel keeps the floor. No timer redials: `lares vault
 * unlock` asks the custody door, which runs this same dial. That unlock gathers no credential and sends none: the door
 * names a pūlama in its `custody` reading, so the command asks nobody anything and answers what the pūlama waits on.
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

/** What a dial left standing: a session, or the reading the pūlama waits on. */
export interface PulamaStandingBy { readonly session: boolean; readonly waits: string | null }

/**
 * Seat the listener that composes at the floor when the session drops, and answer the one `dial` both the boot and the
 * custody door's `unlock` run: ask the pūlama, compose on what it serves, rest the host half.
 */
export function pulamaStandBy(a: {
  readonly holder: PulamaHolder;
  /** Compose again: with the sovereign rows, or at the floor. */
  readonly recompose: (sovereign: boolean) => Promise<{ readonly standing: string; readonly refused?: string }>;
  /** Mount the face the composition wears. */
  readonly mount: (ordinal: number) => void;
  readonly onLog: (line: string) => void;
  /** Remove the offer this vessel just spent; answers whether a file went. Absent, the offer stays where it rests. */
  readonly consumeOffer?: () => boolean;
}): { dial(): Promise<PulamaStandingBy> } {
  let leaving = false;
  a.holder.onClosed(() => {
    if (leaving) return;
    a.onLog("the pūlama session dropped; composing at the floor");
    a.recompose(false).catch((err: unknown) => a.onLog(`the floor did not compose after the session dropped: ${err instanceof Error ? err.message : String(err)}`));
  });
  // ONE DIAL AT A TIME: a second caller waits on the dial in flight, so nobody reads a session the composition has yet to stand on.
  let inflight: Promise<PulamaStandingBy> | null = null;
  const dial = (): Promise<PulamaStandingBy> => inflight ??= dialOnce().finally(() => { inflight = null; });
  const dialOnce = async (): Promise<PulamaStandingBy> => {
  if (a.holder.isUnlocked()) return { session: true, waits: null };
  try {
    await a.holder.unlock([]);
  } catch (err) {
    const reading = (err as { reading?: unknown }).reading;
    a.onLog(`the pūlama serves no session: ${typeof reading === "string" ? reading : err instanceof Error ? err.message : String(err)}; this vessel keeps the floor`);
    return { session: false, waits: a.holder.waits() ?? "pulama-unreachable" };
  }
  const wears = a.holder.wears();
  if (wears !== null) a.mount(wears);
  let stood: { readonly standing: string; readonly refused?: string };
  try { stood = await a.recompose(true); }
  catch (err) { stood = { standing: "unknown", refused: err instanceof Error ? err.message : String(err) }; }
  if (stood.refused !== undefined) {
    // A SESSION NEVER RESTS OVER A FLOOR: held and standing never disagree.
    // The refused composition already left the floor standing, so this leaving asks for no second one.
    leaving = true;
    try { await a.holder.lock(); } finally { leaving = false; }
    a.onLog("the sovereign composition did not stand on the pūlama's session; the session left");
    return { session: false, waits: "composition-refused" };
  }
  // ONE KŪKULU, ONE OFFER: the vessel composed over its session, so the offer that opened it goes. A restart after this wears nothing.
  if (a.consumeOffer?.()) a.onLog("the kūkulu offer served its one session and left the config home");
  // THE HOST HALF: the vessel composed, so the pūlama rests `rite-landed` beside the half it began under. A landing that
  // refuses leaves the guest half alone, which conferre reads red; the vessel keeps standing.
  let landed = "";
  try { landed = (await a.holder.landRite()).par ? "; the tessera reads par" : "; the tessera's halves differ"; }
  catch (err) {
    const reading = (err as { reading?: string }).reading;
    // A session the pūlama served on the admitted image began under no rite, so no tessera waits on a host half.
    landed = reading === "rite-not-begun" ? "; served again on its admitted image, no lei spent" : `; the host half did not land (${reading ?? (err instanceof Error ? err.message : String(err))})`;
  }
  a.onLog(`standing by the pūlama${wears !== null ? `; face h${wears} worn` : ""} (${stood.standing})${landed}`);
  return { session: true, waits: null };
  };
  return { dial };
}

/** Seat the stand-by and dial once; answers whether a session stood. */
export async function standByPulama(a: Parameters<typeof pulamaStandBy>[0]): Promise<boolean> {
  return (await pulamaStandBy(a).dial()).session;
}
