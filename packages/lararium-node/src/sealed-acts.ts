/**
 * sealed-acts — THE TABLE OF ACTS that read or write a vessel's sealed rows on behalf of a command.
 *
 * ── WHY AN ACT NEVER RIDES A STORE VERB ─────────────────────────────────────────────────────────
 * A store verb's output lands in the daemon's document as an outcome, in the clear, and the digest of its
 * arguments lands in a receipt fact. A roster key, a pet-name or a handle-book snapshot on that road would leave
 * its sealed row and rest in an unsealed document. So these acts ride the CUSTODY DOOR (`custody-frames`, the
 * `act` frame): the vessel's main thread runs the act against the holder a person already unlocked, and the
 * answer returns to the one caller on the owner-only socket and nowhere else.
 *
 * ── ONE TABLE, TWO CALLERS ──────────────────────────────────────────────────────────────────────
 * A standing vessel runs an act from its custody door. A command with no vessel standing runs the SAME row in
 * its own process, and its own key session opens at the first sealed row the act touches. Either way the row
 * below decides what the act reads, writes and answers; no caller holds a second copy of the law.
 *
 * ── WHAT BOUNDS AN ACT ──────────────────────────────────────────────────────────────────────────
 *   · The table names every act. A name outside it refuses `unknown-act`, by name.
 *   · Each row names its arguments and their types. An argument the row does not name refuses `bad-args`, so a
 *     frame carries nothing a row did not ask for; no row asks for a credential of this vessel, and nothing a row
 *     takes opens the vessel key. The restore's two rows take a BUNDLE's own key, which a person's route already
 *     opened in the command's process: it opens that one bundle's body and nothing this vessel holds.
 *   · An act answers a plain record for its caller to print. The door logs the act's name and how it ended, and
 *     never an argument, an answer or a refusal's own words.
 *   · No row hands out a root seed, a vessel key, the vessel's key session, or anything that rebuilds one: the
 *     recovery split, whose shares rebuild a root, runs in a command's own process alone and never here. A
 *     backup's cut, which does hand a root off the vessel sealed, rides a frame of its own that asks the vessel's
 *     route again (`custody-frames`, `backup`). The restore's two rows take a root IN, sealed; neither answers one.
 *   · No row signs whatever it gets handed. The row that signs a charter roll as a persona root (`seal.sign`)
 *     reads the charter that stands and signs only a roll its standing head licenses; the crossing rows take no
 *     image at all, and sign the crossing that stands open.
 *
 * Node-main only: a worker never imports this module.
 */
import {
  HandleBook, ed25519SignerFromSeed,
  type HandleBookSnapshot, type PersonaDeclaration, type PersonaRef, type RecoveryShare,
} from "@lararium/mesh";
import { carriedReadings } from "./carried-set.js";
import { NexusContractError, runNexusAcceptCarriage } from "./commands/nexus-contract.js";
import { loadNodeHandleBook, saveNodeHandleBook } from "./node-circle-store.js";
import { clearPersonaAdmitPending, listAdmittedPersonas } from "./node-persona-admit-store.js";
import {
  acceptAdmitFlow, grantAdmitFlow, offerAdmitFlow, openAdmitFlow, withdrawGrantFlow, withdrawOfferFlow,
} from "./persona-admit-flow.js";
import {
  listPersonaRosterLines, loadActivePersonaIndex, loadPersonaGroupRootSeed, loadVesselSigningSeed,
  loadVesselVerifyingKey, makeNodePersonaDeclarationStore, makeNodePersonaPetnameStore, orphanPersonaRoots, wearPersona,
} from "./node-vessel-identity.js";
import {
  provisionCharterReserve, readCharterReserveState, readReserveShare, readReserveState,
  type SealReserveState,
} from "./seal-reserve-store.js";
import type { Repo } from "@automerge/automerge-repo";
import type { BackupDoor } from "./face-bundle-cut.js";
import { ImportRefused, RestoreRefused, importFaceBundleMemory, restoreFaceBundle } from "./face-bundle-restore.js";
import { HostRefusal, runHostInvite, runHostRoll, runHostState } from "./commands/host.js";
import { runWalkInvite, runWalkState, runWalkTake, WalkRefusal } from "./commands/walk.js";
import {
  SealCeremonyRefusal, bindCrossing, openCrossing, readCrossing, sealCrossing, signCrossing, signLicensedSealRoll, witnessCrossing,
} from "./seal-ceremony.js";
import { larSealHome } from "./vessel-paths.js";

/** What an act reads from the composition it runs beside. */
export interface SealedActContext {
  /**
   * One read of a persona KEL's head off the local board: its operating key and its sequence, both null when the
   * board holds no such KEL. `null` where no board stands to read (a vessel at its herm floor).
   */
  readonly kelHead: ((prefix: string) => Promise<{ readonly head: string | null; readonly seq: number | null }>) | null;
  /**
   * The persona planes of the faces this vessel carries, as this thread's Repo holds them: the fleet-riding half
   * of each face's two own names. `null` where no plane stands to write: a vessel with no face lit, a herm floor,
   * or a command running an act in its own process.
   */
  readonly personaSelves: PersonaSelvesPlane | null;
  /**
   * The hearth dial this act runs beside. `dialGate` answers the gate key a hearth dial pins (the standing dial's,
   * or the one a stopped vessel would pin at its next stand), or null when it dials no hearth. `represent`
   * re-presents the standing walk dial on a fresh invite; null where no walk dial stands.
   */
  readonly walk: { readonly dialGate: () => string | null; readonly represent: (() => Promise<void>) | null } | null;
  /**
   * The store a hosting roll lands its act on. `withRepo` runs one act against the store's one holder: the
   * standing vessel's own Repo (the replica its walkers sync), or the one a command holds for the moment of its
   * act. `rolled` tells the composition a roll landed in a Nexus, so its live reading refolds. `null` where no
   * store stands to land on.
   */
  readonly hosting: {
    readonly withRepo: <T>(act: (repo: Repo) => Promise<T>) => Promise<T>;
    readonly rolled:   (nexusAid: string) => Promise<void>;
  } | null;
  /**
   * What the standing composition lends a bundle's memory import: the face it wears and its daemon island's
   * import door. `null` where no composition stands (a command running an act in its own process), so an import
   * there refuses by name.
   */
  readonly backup: BackupDoor | null;
}

/** One own persona as the persona plane holds it: the two names that ride a face's fleet. */
export interface PersonaSelfLine {
  readonly handleIndex: number;
  readonly petname?: string;
  readonly handle?: string;
}

/** The two names of a face that ride its persona plane. The seat claim and the chair label never ride. */
export type PersonaSelfNameKind = "petname" | "handle";

/**
 * Each carried face's own persona plane, read and written by the vessel's MAIN THREAD through its own Repo. A
 * plane private-federates across its one face's vessels and reaches no published or federating surface. A write
 * here leaves the record on that face's plane and nothing else anywhere: it never becomes an invocation.
 */
export interface PersonaSelvesPlane {
  /** Each carried face as its own plane names it, ascending. */
  read(): Promise<readonly PersonaSelfLine[]>;
  /**
   * Write one name of the face at `handleIndex` onto that face's own plane; an empty value clears it. `plane`
   * false where this vessel carries no plane for that face; `written` false where the plane keeps what it holds
   * (a newer write, or, under `fill`, any write at all).
   */
  write(handleIndex: number, name: PersonaSelfNameKind, value: string, opts?: { readonly fill?: boolean }):
    Promise<{ readonly written: boolean; readonly plane: boolean }>;
}

export type SealedActRefusalReason = "unknown-act" | "bad-args" | "act-refused";

/** An act that refuses: the table names no such act, the arguments miss the row's shape, or the row said no. */
export class SealedActRefused extends Error {
  override readonly name = "SealedActRefused";
  constructor(readonly reason: SealedActRefusalReason, message: string) { super(message); }
}

type Raw = Readonly<Record<string, unknown>>;
type Answer = Record<string, unknown>;

/** One argument's reader: the typed value, or `undefined` when the raw value misses the type. */
type Kind<T> = { readonly label: string; readonly read: (v: unknown) => T | undefined; readonly optional?: true };

const HEX = /^(?:[0-9a-fA-F]{2})+$/;
/** The longest image `seal.sign` takes, in bytes: a charter roll or a crossing record, never a document. */
export const SIGN_IMAGE_LIMIT = 64 * 1024;
/** The longest text argument any row takes, in characters: a carriage fits well inside. */
export const TEXT_ARG_LIMIT = 256 * 1024;
/** The longest label a row takes (a pet-name, a Handle, a chair, a witness's note), in characters. */
export const LABEL_ARG_LIMIT = 512;
/** The largest handle-book snapshot a row takes, as the characters of its JSON spelling. */
export const SNAPSHOT_ARG_LIMIT = 4 * 1024 * 1024;

const label: Kind<string> = { label: `a non-empty string, ${LABEL_ARG_LIMIT} characters at most`, read: (v) => (typeof v === "string" && v.length > 0 && v.length <= LABEL_ARG_LIMIT ? v : undefined) };
const text: Kind<string> = { label: "a non-empty string", read: (v) => (typeof v === "string" && v.length > 0 && v.length <= TEXT_ARG_LIMIT ? v : undefined) };
const index: Kind<number> = { label: "a handle-index (a whole number from 0)", read: (v) => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : undefined) };
const count: Kind<number> = { label: "a whole number from 1", read: (v) => (typeof v === "number" && Number.isSafeInteger(v) && v >= 1 ? v : undefined) };
const image: Kind<string> = {
  label: `hex bytes, ${SIGN_IMAGE_LIMIT} at most`,
  read: (v) => (typeof v === "string" && HEX.test(v) && v.length <= SIGN_IMAGE_LIMIT * 2 ? v.toLowerCase() : undefined),
};
const declaration: Kind<PersonaDeclaration> = {
  label: "a declaration { handle?, seat?, chair? }",
  read: (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    const d = v as Record<string, unknown>;
    for (const k of Object.keys(d)) if (k !== "handle" && k !== "seat" && k !== "chair") return undefined;
    if (d["handle"] !== undefined && (typeof d["handle"] !== "string" || d["handle"].length > LABEL_ARG_LIMIT)) return undefined;
    if (d["seat"] !== undefined && typeof d["seat"] !== "boolean") return undefined;
    if (d["chair"] !== undefined && (typeof d["chair"] !== "string" || d["chair"].length > LABEL_ARG_LIMIT)) return undefined;
    return {
      ...(typeof d["handle"] === "string" ? { handle: d["handle"] } : {}),
      ...(typeof d["seat"] === "boolean" ? { seat: d["seat"] } : {}),
      ...(typeof d["chair"] === "string" ? { chair: d["chair"] } : {}),
    };
  },
};
const snapshot: Kind<HandleBookSnapshot> = {
  label: `a handle-book snapshot, ${SNAPSHOT_ARG_LIMIT} characters of JSON at most`,
  read: (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v) || !Array.isArray((v as { records?: unknown }).records)) return undefined;
    // The bound reads the snapshot's own spelling; the recogniser's restore then verifies every record it keeps.
    let spelled: string;
    try { spelled = JSON.stringify(v); } catch { return undefined; }
    return spelled.length <= SNAPSHOT_ARG_LIMIT ? (v as HandleBookSnapshot) : undefined;
  },
};
const selfName: Kind<PersonaSelfNameKind> = {
  label: `one of the two names that ride a face's plane ("petname" or "handle")`,
  read: (v) => (v === "petname" || v === "handle" ? v : undefined),
};
const reserveShare: Kind<RecoveryShare> = {
  label: "one share of a reserve seed { x, ys, custodian, recoveryEpoch }",
  read: (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    for (const k of Object.keys(v)) if (k !== "x" && k !== "ys" && k !== "custodian" && k !== "recoveryEpoch") return undefined;
    return readReserveShare(v) ?? undefined;
  },
};
const reserveState: Kind<SealReserveState> = {
  label: "a reserve state { reserveEpoch, nextKeyCommit, threshold, kahuCount, guardianA, guardianB, mineShareSealed, issuedAt }",
  read: (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).length !== 8) return undefined;
    return readReserveState(v) ?? undefined;
  },
};
const flag: Kind<boolean> = { label: "true or false", read: (v) => (typeof v === "boolean" ? v : undefined) };
/** The largest sealed bundle body a row takes, as the characters of its base64 spelling. */
export const BUNDLE_BODY_ARG_LIMIT = 16 * 1024 * 1024;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const sealedBody: Kind<Uint8Array> = {
  label: `a bundle's sealed body, base64, ${BUNDLE_BODY_ARG_LIMIT} characters at most`,
  read: (v) => (typeof v === "string" && v.length > 0 && v.length <= BUNDLE_BODY_ARG_LIMIT && BASE64.test(v) ? Uint8Array.from(Buffer.from(v, "base64")) : undefined),
};
const bundleKey: Kind<Uint8Array> = {
  label: "a bundle key, 64 lower hex",
  read: (v) => (typeof v === "string" && /^[0-9a-f]{64}$/.test(v) ? Uint8Array.from(Buffer.from(v, "hex")) : undefined),
};
const optional = <T>(k: Kind<T>): Kind<T> & { readonly optional: true } => ({ ...k, optional: true });

type Shape = Readonly<Record<string, Kind<unknown>>>;
type ArgsOf<S extends Shape> = {
  readonly [K in keyof S as S[K] extends { optional: true } ? never : K]: S[K] extends Kind<infer T> ? T : never;
} & {
  readonly [K in keyof S as S[K] extends { optional: true } ? K : never]?: S[K] extends Kind<infer T> ? T : never;
};

interface ActRow {
  readonly shape: Shape;
  readonly run: (args: never, ctx: SealedActContext) => Promise<Answer>;
}

const act = <S extends Shape>(shape: S, run: (args: ArgsOf<S>, ctx: SealedActContext) => Promise<Answer>): ActRow =>
  Object.freeze({ shape, run: run as ActRow["run"] });

/** A row's own refusal: what the act found, in words its caller prints. */
const refuse = (message: string): SealedActRefused => new SealedActRefused("act-refused", message);

/** The persona plane an act writes, or the refusal that names why no plane stands. A plane stands before any row opens. */
function planeOf(ctx: SealedActContext): PersonaSelvesPlane {
  if (!ctx.personaSelves) throw refuse("no persona plane stands here: the names rest on this vessel alone until a vessel with a lit face stands unlocked");
  return ctx.personaSelves;
}

/** Refuse an index this vessel holds no persona root for: the mirror moves a held face's names alone. */
async function heldFace(handleIndex: number): Promise<void> {
  if (!(await listPersonaRosterLines()).some((l) => l.handleIndex === handleIndex)) {
    throw refuse(`this vessel holds no persona root at h${handleIndex}, so it carries no name for that face`);
  }
}

/** One of a face's two riding names as its sealed row holds it; undefined where the row holds none (or an empty one). */
async function sealedSelfName(handleIndex: number, name: PersonaSelfNameKind): Promise<string | undefined> {
  const held = name === "petname"
    ? await (await makeNodePersonaPetnameStore()).get(handleIndex)
    : (await (await makeNodePersonaDeclarationStore()).get(handleIndex))?.handle;
  return held !== undefined && held.trim().length > 0 ? held : undefined;
}

/** A walk door's own refusal keeps its words and crosses as the act's refusal. */
async function walkOrRefuse<T>(run: Promise<T>): Promise<T> {
  try { return await run; }
  catch (err) { if (err instanceof WalkRefusal) throw refuse(err.message); throw err; }
}

/** The seal ceremony's own refusal keeps its words and crosses as the act's refusal. */
async function ceremonyOrRefuse<T>(run: Promise<T>): Promise<T> {
  try { return await run; }
  catch (err) { if (err instanceof SealCeremonyRefusal) throw refuse(err.message); throw err; }
}

/** A hosting door's own refusal keeps its words and crosses as the act's refusal. */
async function hostOrRefuse<T>(run: Promise<T>): Promise<T> {
  try { return await run; }
  catch (err) { if (err instanceof HostRefusal) throw refuse(err.message); throw err; }
}

/** A flow that answers `{ error }` refuses the act with those words; any other answer passes through. */
function orRefuse<T extends object>(r: T | { readonly error: string }): T {
  if ("error" in r && typeof (r as { error: unknown }).error === "string") throw refuse((r as { error: string }).error);
  return r as T;
}

/**
 * THE TABLE. Each row: the arguments it takes, and the act. A row answers what its command prints.
 *
 *   persona.roots         the roster: each held handle-index with its root's public key, the worn index, the orphans
 *   persona.wear          wear the face at an index this vessel holds a root for
 *   seal.sign             sign one charter roll as the persona root at an index, when the charter that stands
 *                         licenses it: the roll steps from the standing head and seats the key-set that head
 *                         pre-committed, and the root holds a seat in it; every other image refuses by name
 *   crossing.*            the growth rite's steps over the crossing that stands open: state, open, bind, sign,
 *                         witness, seal. A hand names itself; the row reads what it signs off its own sealed row
 *   carriage.accept       sign this operator's own consent to one Nexus's carriage, under the face's leaf for it
 *   carriage.readings     one reading per charter this vessel holds: whether a kept consent or a seated chair carries it
 *   petname.*             this vessel's own private labels for its faces
 *   declaration.*         each face's declared Handle, seat claim and chair label
 *   selves.read           each carried face as its own persona plane names it
 *   selves.carry          carry ONE name of one held face from its sealed row up to that face's own plane; the frame
 *                         names the face and which name, and never the name itself, so a plane takes only what a
 *                         sealed row holds. `fill` lands it only where the plane never held that name
 *   selves.clear          clear ONE name of one held face on its plane, once its sealed row holds that name no more
 *   walk.state            where this vessel walks: per hearth, the Nexus, the grant it holds and its wallet's count
 *   walk.take             keep a carried invite on the walk record of the hearth it names
 *   walk.invite           hand the newest invite out of the wallet of the hearth this vessel walks at
 *   host.state            what this hearth hosts: per Nexus, the live epochs, the cap and the redemption counts
 *   host.roll             roll the hosting epoch in one Nexus and land the new act on this hearth's hosting doc
 *   host.invite           mint this hearth's own invite at the current epoch; the answer returns to the one caller
 *   reserve.state         the charter reserve's state: the pre-rotation commit and the guardian labels
 *   reserve.provision     seal ONE share of a reserve seed (the operator's own) and the state that commits it. The
 *                         command splits the seed in its own process; the seed and the two guardian shares never
 *                         cross this door, and one share alone rebuilds nothing
 *   admit.*               the persona admission's hops and its pending rows
 *   handle-book.load|save the recogniser's private memory, as one snapshot
 *   bundle.restore        bring ONE face back from its backup bundle, as a recovery act: the row takes the bundle's
 *                         body still sealed and the bundle key, opens the body behind this door, and lands the face
 *                         at a NEW seat (`face-bundle-restore`). A root comes IN through this row; nothing of it
 *                         answers. A refusal answers its own name (`refused`) and moves nothing
 *   bundle.import         land a bundle's memory section on the restored seat: the standing vessel, wearing that
 *                         face, hands the section to its daemon island's import door. A command running the act in
 *                         its own process holds no island, and refuses by name
 */
export const SEALED_ACTS = Object.freeze({
  "persona.roots": act({}, async () => {
    const lines = await listPersonaRosterLines();
    return {
      roots: lines.map((l) => ({ handleIndex: l.handleIndex, verifyingKey: l.verifyingKey })),
      active: (await loadActivePersonaIndex()) ?? null,
      orphans: await orphanPersonaRoots(),
    };
  }),
  "persona.wear": act({ handleIndex: index }, async ({ handleIndex }) => {
    await wearPersona(handleIndex);
    return { active: handleIndex };
  }),
  // THE SEAL CEREMONY'S HANDS (`seal-ceremony`). A persona root signs a roll only when the charter that stands
  // licenses it, and marks a crossing only through the rite's own steps, which read the crossing that stands open.
  // No row takes a crossing record's bytes from its caller, and the roll row reads the standing head before it signs.
  "seal.sign": act({ handleIndex: index, image }, async (a) => ({
    ...(await ceremonyOrRefuse(signLicensedSealRoll(a.handleIndex, Uint8Array.from(Buffer.from(a.image, "hex"))))),
  })),
  "crossing.state": act({}, async () => {
    const { pending, kept } = await readCrossing();
    return {
      kept,
      open: pending === null ? null : {
        fromEpochCid: pending.fromEpochCid, toEpochCid: pending.toEpochCid ?? null,
        oldSigs: pending.oldSigs.length, newSigs: pending.newSigs.length, witnesses: pending.witnesses.length,
      },
    };
  }),
  "crossing.open": act({}, async () => ({ ...(await ceremonyOrRefuse(openCrossing())) })),
  "crossing.bind": act({}, async () => ({ ...(await ceremonyOrRefuse(bindCrossing())) })),
  "crossing.sign": act({ handleIndex: index }, async (a) => ({ ...(await ceremonyOrRefuse(signCrossing(a.handleIndex))) })),
  "crossing.witness": act({ handleIndex: index, note: label }, async (a) => ({ ...(await ceremonyOrRefuse(witnessCrossing(a.handleIndex, a.note))) })),
  "crossing.seal": act({}, async () => ({ ...(await ceremonyOrRefuse(sealCrossing())) })),
  "carriage.accept": act({ handleIndex: index, aid: optional(text) }, async (a) => {
    try {
      return { ...(await runNexusAcceptCarriage({ handleIndex: a.handleIndex, sealHome: larSealHome(), ...(a.aid !== undefined ? { aid: a.aid } : {}) })) };
    } catch (err) {
      // The contract's own refusal keeps its words and crosses the door as the act's refusal.
      if (err instanceof NexusContractError) throw refuse(err.message);
      throw err;
    }
  }),

  "carriage.readings": act({}, async () => ({ readings: (await carriedReadings(larSealHome())).map((r) => ({ ...r })) })),

  "petname.entries": act({}, async () => ({ entries: (await (await makeNodePersonaPetnameStore()).entries()).map(([i, n]) => [i, n]) })),
  "petname.set": act({ handleIndex: index, petname: label }, async (a) => {
    await (await makeNodePersonaPetnameStore()).set(a.handleIndex, a.petname);
    return {};
  }),
  "petname.clear": act({ handleIndex: index }, async (a) => {
    await (await makeNodePersonaPetnameStore()).clear(a.handleIndex);
    return {};
  }),

  "declaration.entries": act({}, async () => ({ entries: (await (await makeNodePersonaDeclarationStore()).entries()).map(([i, d]) => [i, { ...d }]) })),
  "declaration.set": act({ handleIndex: index, declaration }, async (a) => {
    await (await makeNodePersonaDeclarationStore()).set(a.handleIndex, a.declaration);
    return {};
  }),
  "declaration.clear": act({ handleIndex: index }, async (a) => {
    await (await makeNodePersonaDeclarationStore()).clear(a.handleIndex);
    return {};
  }),

  // THE FLEET MIRROR. A face's two own names rest sealed on this vessel and ride that face's own persona plane to
  // its other vessels. The plane's document lives in this thread's own Repo, so the write needs no vessel key and
  // no worker; it rides THIS door because a pet-name on a store verb would rest in the daemon's document as an
  // outcome and a receipt digest, and because a locked vessel shuts every fleet lane. A carry reads the name off
  // its sealed row itself: a frame names a face and which name, and no name. Each row acts for a face this vessel
  // holds a root for and on that face's own plane alone; a carry needs the row to hold the name and a clear needs
  // it gone, so neither act moves a plane past what the sealed row says.
  "selves.read": act({}, async (_a, ctx) => ({ selves: (await planeOf(ctx).read()).map((s) => ({ ...s })) })),
  "selves.carry": act({ handleIndex: index, name: selfName, fill: optional(flag) }, async (a, ctx) => {
    const plane = planeOf(ctx);
    await heldFace(a.handleIndex);
    const held = await sealedSelfName(a.handleIndex, a.name);
    if (held === undefined) throw refuse(`the sealed row holds no ${a.name} for h${a.handleIndex}, so nothing carries; a name cleared here clears on the plane by \`selves.clear\``);
    const { written, plane: stands } = await plane.write(a.handleIndex, a.name, held, a.fill === true ? { fill: true } : {});
    if (!stands) throw refuse(`this vessel carries no persona plane for h${a.handleIndex}, so its names rest here alone`);
    return { carried: written };
  }),
  "selves.clear": act({ handleIndex: index, name: selfName }, async (a, ctx) => {
    const plane = planeOf(ctx);
    await heldFace(a.handleIndex);
    if ((await sealedSelfName(a.handleIndex, a.name)) !== undefined) throw refuse(`the sealed row still holds a ${a.name} for h${a.handleIndex}; clear it there first`);
    const { written, plane: stands } = await plane.write(a.handleIndex, a.name, "");
    if (!stands) throw refuse(`this vessel carries no persona plane for h${a.handleIndex}, so nothing clears beyond it`);
    return { cleared: written };
  }),

  // THE WALK RECORDS. A record holds bearer invites, the hearth's grant and one key per carried document, so it
  // rests sealed (`node-walk-store`) and its three acts ride this door: a carried invite as a verb's argument, or
  // an invite as a verb's outcome, would rest in the daemon's document in the clear.
  "walk.state": act({}, async () => ({ walks: (await runWalkState()).map((w) => ({ ...w })) })),
  "walk.take": act({ carried: text }, async (a, ctx) => {
    const dialGate = ctx.walk?.dialGate()?.toLowerCase() ?? null;
    const taken = await walkOrRefuse(runWalkTake({ carried: a.carried, dialGate }));
    // A fresh invite for the hearth this vessel's walk dial stands to re-presents at once.
    const represent = taken.gatePubKey === dialGate ? (ctx.walk?.represent ?? null) : null;
    if (represent) await represent();
    return { ...taken, dialing: represent ? "now" : "next-stand" };
  }),
  "walk.invite": act({}, async () => ({ ...(await walkOrRefuse(runWalkInvite())) })),

  // THE HEARTH'S HOSTING. Its state, its spend rows and its carriage rest sealed (`hosting-store`,
  // `hosting-carry`), so its three doors ride this door: a bearer invite as a verb's outcome would rest in the
  // daemon's document in the clear. A roll lands its act on the store the composition lends, and tells it so.
  "host.state": act({}, async () => ({ nexuses: (await runHostState({ sealHome: larSealHome() })).map((n) => ({ ...n })) })),
  "host.roll": act({ nexusAid: optional(text), cap: optional(count) }, async (a, ctx) => {
    const store = ctx.hosting;
    if (!store) throw refuse("no store stands here to land a hosting act on");
    const rolled = await hostOrRefuse(store.withRepo((repo) => runHostRoll({
      sealHome: larSealHome(), repo, ...(a.nexusAid !== undefined ? { nexusAid: a.nexusAid } : {}), ...(a.cap !== undefined ? { cap: a.cap } : {}),
    })));
    await store.rolled(rolled.nexusAid);
    return { ...rolled };
  }),
  "host.invite": act({ nexusAid: optional(text), relay: optional(text) }, async (a) => ({
    ...(await hostOrRefuse(runHostInvite({
      sealHome: larSealHome(), ...(a.nexusAid !== undefined ? { nexusAid: a.nexusAid } : {}), ...(a.relay !== undefined ? { relay: a.relay } : {}),
    }))),
  })),

  // THE CHARTER RESERVE. Its two rows rest under the vessel key (`seal-reserve-store`). A reserve's seed gets
  // forged and split in the command's own process, where its three cards print to the person; the door takes
  // the operator's ONE share and the state that commits it, answers nothing, and hands out no share.
  "reserve.state": act({}, async () => ({ state: await readCharterReserveState() })),
  "reserve.provision": act({ share: reserveShare, state: reserveState }, async (a) => {
    await provisionCharterReserve(a.share, a.state);
    return {};
  }),

  "admit.offer": act({ maxPendingOffers: optional(count) }, async (a) => ({
    ...(await offerAdmitFlow({
      deviceVerifyingKey: await loadVesselVerifyingKey(),
      ...(a.maxPendingOffers !== undefined ? { maxPendingOffers: a.maxPendingOffers } : {}),
    })),
  })),
  "admit.grant": act({ offerCarriage: text, prefix: text, handleIndex: index }, async (a) => {
    // A grant SIGNS with a held root; it never stands one up. An index this vessel holds no root for refuses.
    const line = (await listPersonaRosterLines()).find((l) => l.handleIndex === a.handleIndex);
    if (!line) throw refuse(`this vessel holds no persona root at h${a.handleIndex} — a grant signs only as a persona it carries`);
    const personaRef: PersonaRef = { prefix: a.prefix, verifyingKey: line.verifyingKey };
    const seed = await loadPersonaGroupRootSeed(a.handleIndex);
    try {
      return { ...orRefuse(await grantAdmitFlow({ offerCarriage: a.offerCarriage, personaRef, personaSigner: ed25519SignerFromSeed(seed) })) };
    } finally { seed.fill(0); }
  }),
  "admit.open": act({ grantCarriage: text, onlyEphemeral: optional(text) }, async (a, ctx) => {
    const kelHead = ctx.kelHead;
    if (!kelHead) throw refuse("no board stands here to read the persona's KEL head from, so a grant cannot be checked against it");
    // ONE board read per verification: the head read keeps the sequence the same read carried, and the sequence
    // resolver hands that one back, so a head never pairs with the sequence of a later key.
    const seqOf = new Map<string, number | null>();
    const seed = await loadVesselSigningSeed();
    try {
      return { ...orRefuse(await openAdmitFlow({
        grantCarriage: a.grantCarriage,
        deviceSigner: ed25519SignerFromSeed(seed),
        resolveHeadOpKey: async (prefix) => {
          const read = await kelHead(prefix);
          seqOf.set(prefix, read.seq);
          return read.head;
        },
        resolveHeadSeq: async (prefix) => {
          const seq = seqOf.get(prefix) ?? null;
          seqOf.delete(prefix);
          return seq;
        },
        ...(a.onlyEphemeral !== undefined ? { onlyEphemeral: a.onlyEphemeral } : {}),
      })) };
    } finally { seed.fill(0); }
  }),
  "admit.accept": act({ ackCarriage: text }, async (a) => ({ ...orRefuse(await acceptAdmitFlow({ ackCarriage: a.ackCarriage })) })),
  "admit.list": act({}, async () => ({ admitted: (await listAdmittedPersonas()).map((j) => ({ ...j })) })),
  "admit.reset": act({}, async () => {
    await clearPersonaAdmitPending();
    return { reset: true };
  }),
  "admit.withdraw-offer": act({ target: text }, async (a) => ({ withdrawn: await withdrawOfferFlow(a.target) })),
  "admit.withdraw-grant": act({ nonceA: text }, async (a) => ({ withdrawn: await withdrawGrantFlow(a.nonceA) })),

  "handle-book.load": act({}, async () => ({ snapshot: (await loadNodeHandleBook()).snapshot() })),
  "handle-book.save": act({ snapshot }, async (a) => {
    // The snapshot crosses the recogniser's own verification before it seals: a record whose causal closure does
    // not verify drops there, exactly as it would on a load.
    await saveNodeHandleBook(await HandleBook.restore(a.snapshot));
    return {};
  }),

  // A NAMED REFUSAL ANSWERS, IT DOES NOT THROW: the command prints the refusal's own name (custody#/the-restore),
  // and the door's log carries the act's name and how it ended, never the name of a face or a word of a bundle.
  "bundle.restore": act({ body: sealedBody, key: bundleKey, as: optional(index) }, async (a, ctx) => {
    try {
      if (!ctx.hosting) throw refuse("no store stands to land a face on: stand the vessel, or run the restore with no vessel standing");
      const restored = await restoreFaceBundle({ sealedBody: a.body, bundleKey: a.key, withRepo: ctx.hosting.withRepo, ...(a.as !== undefined ? { as: a.as } : {}) });
      return { ...restored };
    } catch (err) {
      if (err instanceof RestoreRefused) return { refused: err.reason, message: err.message };
      throw err;
    } finally { a.key.fill(0); }
  }),
  "bundle.import": act({ body: sealedBody, key: bundleKey }, async (a, ctx) => {
    try {
      const imported = await importFaceBundleMemory({ sealedBody: a.body, bundleKey: a.key, door: ctx.backup });
      return { face: imported.face, results: imported.results.map((r) => ({ ...r })) };
    } catch (err) {
      if (err instanceof ImportRefused) return { refused: err.reason, message: err.message };
      throw err;
    } finally { a.key.fill(0); }
  }),
} satisfies Record<string, ActRow>);

export type SealedActName = keyof typeof SEALED_ACTS;

/** Every act the table names, in table order. */
export const SEALED_ACT_NAMES: readonly SealedActName[] = Object.freeze(Object.keys(SEALED_ACTS) as SealedActName[]);

export function isSealedActName(name: unknown): name is SealedActName {
  return typeof name === "string" && Object.prototype.hasOwnProperty.call(SEALED_ACTS, name);
}

/** Read `raw` against a row's shape: every named argument typed, none beside them. */
function readArgs(name: string, shape: Shape, raw: unknown): Record<string, unknown> {
  if (raw !== undefined && (raw === null || typeof raw !== "object" || Array.isArray(raw))) {
    throw new SealedActRefused("bad-args", `${name}: the arguments read as no record`);
  }
  const given = (raw ?? {}) as Raw;
  for (const key of Object.keys(given)) {
    if (!Object.prototype.hasOwnProperty.call(shape, key)) throw new SealedActRefused("bad-args", `${name}: the act takes no argument "${key}"`);
  }
  const out: Record<string, unknown> = {};
  for (const [key, kind] of Object.entries(shape)) {
    if (given[key] === undefined) {
      if (kind.optional) continue;
      throw new SealedActRefused("bad-args", `${name}: the act needs "${key}" (${kind.label})`);
    }
    const value = kind.read(given[key]);
    if (value === undefined) throw new SealedActRefused("bad-args", `${name}: "${key}" reads as no ${kind.label}`);
    out[key] = value;
  }
  return out;
}

/**
 * Run one act of the table. An unknown name refuses `unknown-act`; arguments that miss the row's shape refuse
 * `bad-args`; both refuse before any row opens. A custody refusal (`CustodyLocked`, `CustodyRowUnavailable`) passes
 * through under its own name.
 */
export async function runSealedAct(name: unknown, rawArgs: unknown, ctx: SealedActContext): Promise<Answer> {
  if (!isSealedActName(name)) {
    throw new SealedActRefused("unknown-act", `the custody door names no act "${typeof name === "string" ? name.slice(0, 64) : typeof name}"`);
  }
  const row: ActRow = SEALED_ACTS[name];
  const args = readArgs(name, row.shape, rawArgs);
  return row.run(args as never, ctx);
}
