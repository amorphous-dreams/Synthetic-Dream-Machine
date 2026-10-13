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
 *     frame carries nothing a row did not ask for; no row asks for a credential.
 *   · An act answers a plain record for its caller to print. The door logs the act's name and how it ended, and
 *     never an argument, an answer or a refusal's own words.
 *   · No row hands out a root seed, a vessel key, the vessel's key session, or anything that rebuilds one: the
 *     recovery split, whose shares rebuild a root, runs in a command's own process alone and never here.
 *   · No row signs whatever it gets handed. The one row that signs as a persona root (`seal.sign`) reads the
 *     image first and signs only the seal ceremony's own two images: a charter roll and a crossing record.
 *
 * Node-main only: a worker never imports this module.
 */
import {
  HandleBook, RESERVE_TRANSITION_DOMAIN, SEAL_ROLL_DOMAIN, canonicalJsonBytes, ed25519SignerFromSeed,
  type HandleBookSnapshot, type PersonaDeclaration, type PersonaRef,
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
import { larSealHome } from "./vessel-paths.js";

/** What an act reads from the composition it runs beside. */
export interface SealedActContext {
  /**
   * One read of a persona KEL's head off the local board: its operating key and its sequence, both null when the
   * board holds no such KEL. `null` where no board stands to read (a vessel at its herm floor).
   */
  readonly kelHead: ((prefix: string) => Promise<{ readonly head: string | null; readonly seq: number | null }>) | null;
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
 *   seal.sign             sign one image of the seal ceremony as the persona root at an index: a charter roll or a
 *                         crossing record (with a witness's note, where a witness marks it); every other image refuses
 *   carriage.accept       sign this operator's own consent to one Nexus's carriage, under the face's leaf for it
 *   carriage.readings     one reading per charter this vessel holds: whether a kept consent or a seated chair carries it
 *   petname.*             this vessel's own private labels for its faces
 *   declaration.*         each face's declared Handle, seat claim and chair label
 *   admit.*               the persona admission's hops and its pending rows
 *   handle-book.load|save the recogniser's private memory, as one snapshot
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
  "seal.sign": act({ handleIndex: index, image, note: optional(label) }, async (a) => {
    const line = (await listPersonaRosterLines()).find((l) => l.handleIndex === a.handleIndex);
    if (!line) throw refuse(`this vessel holds no persona root at h${a.handleIndex}, so nothing signs there`);
    // THE ROW READS WHAT IT SIGNS. The image must spell, in its one canonical form, a record that leads with a
    // name of the seal ceremony: a charter roll, or a crossing record. A witness's mark signs the crossing
    // record with its own note after it, so a note rides a crossing record alone. The row bounds WHICH images a
    // root signs, and no other protocol's verifier reads either one. Whether a roll or a crossing fits the
    // charter that stands gets checked by the ceremony's own verbs, which move behind this door with the seal rows.
    const bytes = Uint8Array.from(Buffer.from(a.image, "hex"));
    let record: unknown;
    try { record = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { record = null; }
    const fields = record !== null && typeof record === "object" && !Array.isArray(record) ? record as Record<string, unknown> : null;
    const roll = fields?.["kind"] === SEAL_ROLL_DOMAIN && fields["domain"] === undefined;
    const crossing = fields?.["domain"] === RESERVE_TRANSITION_DOMAIN && fields["kind"] === undefined;
    if (!fields || (!roll && !crossing) || Buffer.compare(Buffer.from(canonicalJsonBytes(fields)), Buffer.from(bytes)) !== 0) {
      throw refuse("this row signs a charter roll or a crossing record in its canonical spelling, and no other image");
    }
    if (a.note !== undefined && !crossing) throw refuse("a witness's note rides a crossing record alone");
    const signed = a.note === undefined ? bytes : Uint8Array.from([...bytes, ...new TextEncoder().encode(a.note)]);
    const seed = await loadPersonaGroupRootSeed(a.handleIndex);
    try { return { signer: line.verifyingKey, sig: await ed25519SignerFromSeed(seed)(signed) }; }
    finally { seed.fill(0); }
  }),
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
