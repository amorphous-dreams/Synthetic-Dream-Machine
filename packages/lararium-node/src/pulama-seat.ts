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
 * After the floor composition stands, the vessel dials the pūlama. A session names the faces the pūlama lends this vessel,
 * and the vessel composes with the sovereign rows over them: the composition names its own daemon mount among the faces
 * served (`daemonMountOrdinal`) and lights the rest beside it, and no session sets a vessel-wide face. A refusal names itself
 * once and the vessel keeps the floor. No timer redials: `lares vault
 * unlock` asks the custody door, which runs this same dial. That unlock gathers no credential and sends none: the door
 * names a pūlama in its `custody` reading, so the command asks nobody anything and answers what the pūlama waits on.
 *
 * ── THE FACE LAST WORN COMES BACK WITH THE SESSION ──────────────────────────────────────────────
 * The pūlama remembers, in memory alone, the face this vessel's wear door last wore, and the session's standing carries it.
 * A dial over a vessel that names no mount of its own (a fresh process: Docker restarted it, or it rose new) wears that face
 * again where the lend holds it standing lit; otherwise the line names why and the composition names its own daemon mount
 * as a pūlama that heard no wear leaves it. A remembered face never refuses the boot.
 *
 * When the session drops (the pūlama locked, its process ended, the socket went), the vessel composes at the floor.
 *
 * The stand-by keeps why its last dial stood no session (`waits()`): a composition the vessel refused over a session reads
 * `composition-refused` there, and the custody door names that reading before the pūlama's last hello reading.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { readFileSync } from "node:fs";
import { mountedFaceOrdinal, setMountedFace } from "./node-vessel-identity.js";
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

/** The holder a vessel seats when its environment names a pūlama, or null where it names none. `life` names the vessel life
 *  each hello dials for: the life id this vessel's store claim minted. */
export function vesselPulamaHolder(homes: CustodyHomes, env: Readonly<Record<string, string | undefined>> = process.env, life?: { readonly id: string }): PulamaHolder | null {
  const socket = env[PULAMA_SOCKET_ENV]?.trim();
  if (!socket) return null;
  return makePulamaHolder({ homes, dial: () => dialPulama(socket), offer: () => readKukuluOffer(env[KUKULU_OFFER_ENV]), ...(life ? { life: () => life } : {}) });
}

/** What a dial left standing: a session, or the reading the pūlama waits on. */
export interface PulamaStandingBy {
  readonly session: boolean; readonly waits: string | null;
  /** The composition's own fault, where the vessel refused to compose over the session it was served (`composition-refused`). */
  readonly refused?: string;
}

/**
 * Seat the listener that composes at the floor when the session drops, and answer the one `dial` both the boot and the
 * custody door's `unlock` run: ask the pūlama, compose on what it serves, rest the host half.
 */
export function pulamaStandBy(a: {
  readonly holder: PulamaHolder;
  /** Compose again: with the sovereign rows, or at the floor. */
  readonly recompose: (sovereign: boolean) => Promise<{ readonly standing: string; readonly refused?: string }>;
  readonly onLog: (line: string) => void;
  /** Remove the offer this vessel just spent; answers whether a file went. Absent, the offer stays where it rests. */
  readonly consumeOffer?: () => boolean;
}): { dial(): Promise<PulamaStandingBy>; waits(): string | null; goodbye(): Promise<boolean> } {
  let leaving = false;
  /** Why the last dial stood no session (`composition-refused` among the pūlama's own readings); null while a session stands. */
  let lastWaits: string | null = null;
  a.holder.onClosed(() => {
    if (leaving) return;
    a.onLog("the pūlama session dropped; composing at the floor");
    a.recompose(false).catch((err: unknown) => a.onLog(`the floor did not compose after the session dropped: ${err instanceof Error ? err.message : String(err)}`));
  });
  /** Wear the face the pūlama remembers, where this vessel names no mount and the lend holds that face lit; answers whether it did. */
  const rewearRemembered = (): boolean => {
    const remembered = a.holder.worn();
    if (remembered === undefined || mountedFaceOrdinal() !== undefined) return false;
    const lends = a.holder.lends(), waiting = a.holder.waiting();
    if (!lends.includes(remembered) || waiting.includes(remembered)) {
      a.onLog(`the pūlama remembers h${remembered} worn, but ${lends.includes(remembered) ? "it waits dark in the lend" : `it stands outside the lent set (${lends.map((o) => `h${o}`).join(", ")})`}; the daemon mount falls to the lowest face served`);
      return false;
    }
    setMountedFace(remembered);
    a.onLog(`the pūlama remembers h${remembered} worn; wearing it again`);
    return true;
  };
  // ONE DIAL AT A TIME: a second caller waits on the dial in flight, so nobody reads a session the composition has yet to stand on.
  let inflight: Promise<PulamaStandingBy> | null = null;
  const dial = (): Promise<PulamaStandingBy> => inflight ??= dialOnce().then((by) => { lastWaits = by.waits; return by; }).finally(() => { inflight = null; });
  const dialOnce = async (): Promise<PulamaStandingBy> => {
  if (a.holder.isUnlocked()) return { session: true, waits: null };
  try {
    await a.holder.unlock([]);
  } catch (err) {
    const reading = (err as { reading?: unknown }).reading;
    a.onLog(`the pūlama serves no session: ${typeof reading === "string" ? reading : err instanceof Error ? err.message : String(err)}; this vessel keeps the floor`);
    return { session: false, waits: a.holder.waits() ?? "pulama-unreachable" };
  }
  const compose = async (): Promise<{ readonly standing: string; readonly refused?: string }> => {
    try { return await a.recompose(true); }
    catch (err) { return { standing: "unknown", refused: err instanceof Error ? err.message : String(err) }; }
  };
  const rewore = rewearRemembered();
  let stood = await compose();
  if (stood.refused !== undefined && rewore) {
    // A REMEMBERED FACE NEVER REFUSES THE BOOT: the composition that would not stand on it composes once more on the
    // daemon mount a pūlama that heard no wear leaves.
    setMountedFace(undefined);
    a.onLog(`the composition wearing the remembered face did not stand (${stood.refused}); composing on the lowest face served`);
    stood = await compose();
  }
  if (stood.refused !== undefined) {
    // A SESSION NEVER RESTS OVER A FLOOR: held and standing never disagree.
    // The refused composition already left the floor standing, so this leaving asks for no second one.
    leaving = true;
    try { await a.holder.lock(); } finally { leaving = false; }
    a.onLog("the sovereign composition did not stand on the pūlama's session; the session left");
    return { session: false, waits: "composition-refused", refused: stood.refused };
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
  // THE LEND, NEVER A WORN FACE: the composition names its own daemon mount among the faces served, and sessions wear inside them.
  const waiting = a.holder.waiting();
  a.onLog(`standing by the pūlama; lends ${a.holder.lends().map((o) => `h${o}`).join(", ")}${waiting.length > 0 ? ` (${waiting.map((o) => `h${o}`).join(", ")} waiting dark)` : ""} (${stood.standing})${landed}`);
  return { session: true, waits: null };
  };
  return {
    dial, waits: () => (a.holder.isUnlocked() ? null : lastWaits),
    // THE CLEAN GOODBYE: the vessel drained every save and leaves; the session the goodbye ends composes no floor after it.
    goodbye: () => { leaving = true; return a.holder.goodbye(); },
  };
}

/**
 * THE LIFE REMEMBERS A CLOSE THAT WAS NOT WHOLE: the pūlama holder and its stand-by outlive every composition of one vessel life,
 * so a recomposition whose teardown left a face's drain faulted still holds that face's unsealed save when a later, whole stand-down
 * exits. Every teardown and stand-down of the life notes its answer here; one close that was not whole latches the life, and its
 * goodbye stays unsent. An answer that names no `whole` (a composition that held no face) changes nothing.
 */
export function lifeCloses(): { note(closed: unknown): void; noteTeardown<T>(teardown: () => Promise<T>): Promise<T>; whole(): boolean } {
  let whole = true;
  const note = (closed: unknown): void => {
    if (typeof closed === "object" && closed !== null && (closed as { whole?: unknown }).whole === false) whole = false;
  };
  return {
    note,
    // A TEARDOWN THAT THROWS COUNTS NOT WHOLE: its close may have answered not whole before a later step threw, so the life
    // latches and the fault rises on.
    async noteTeardown(teardown) {
      try { const closed = await teardown(); note(closed); return closed; }
      catch (e) { whole = false; throw e; }
    },
    whole: () => whole,
  };
}

/**
 * THE CLEAN GOODBYE ON A WHOLE CLOSE ALONE (sealed-store#/the-lit-set): a stand-down that met a face whose drain faulted still
 * tears down, but that face may hold a save it never sealed, so the vessel says no goodbye and its leaving reads as a drop, which
 * holds the pūlama's close. Answers whether the goodbye was heard.
 */
export async function cleanGoodbye(closed: { readonly whole: boolean }, goodbye: () => Promise<boolean>, log: (line: string) => void): Promise<boolean> {
  if (!closed.whole) {
    log("no goodbye: a face did not close whole and may hold an unsealed save, so this leaving reads as a drop");
    return false;
  }
  try {
    const heard = await goodbye();
    log(heard ? "the pūlama heard this life's goodbye: every save drained" : "no goodbye stands: the pūlama did not hear one, so this leaving reads as a drop");
    return heard;
  } catch (e) {
    log(`goodbye unsent: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

/** Seat the stand-by and dial once; answers whether a session stood. */
export async function standByPulama(a: Parameters<typeof pulamaStandBy>[0]): Promise<boolean> {
  return (await pulamaStandBy(a).dial()).session;
}
