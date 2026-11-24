/**
 * share-doors — the doors the share config's CLI side reaches (the file under `$LAR_ROOT/config`, the faces' pet-names off
 * custody, the standing vessel's verbs), apart from any command's flags, so the unlock door lands the shares as a face lights
 * (`landShares`) as the share door does.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-share-config
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { larConfigHome } from "@lararium/node";
import { SHARE_CONFIG_FILE, type ShareEntry, type ShareFace } from "@lararium/mesh";
import { vesselDid } from "./env.js";
import { DaemonUnreachable, runVerb } from "./verb-call.js";
import { sealedAct } from "./sealed-act-door.js";
import { summaryOutput, type SubmitResult } from "./verb-result.js";
import { LocalWaitExpired, queryReceipt, UdsUnreachable, udsSocketPath, type ReceiptAnswer } from "./local-connector.js";
import { openLocalSession, SessionRefused } from "./session-connector.js";
import { readPersonaRoots, sealedPetnameStore } from "./sealed-records.js";
import { makeFleetPetnameStore } from "./daemon-persona-store.js";

/** The doors the share door reaches, injectable so a test drives it with no vessel. */
export interface ShareDoors {
  readonly faces: () => Promise<readonly ShareFace[]>;
  readonly file: { read(): string | null; write(text: string): void };
  /** Ask the standing vessel; null where none answers. */
  readonly verb: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
  /** Does this run stand under an agent harness's mark? Absent: the process environment answers. */
  readonly seat?: () => boolean;
}

const shareFilePath = (): string => join(larConfigHome(), SHARE_CONFIG_FILE);

/** One row as `share-set` takes it: every field the file's row carries, its owner by pet-name among them. */
export function shareSetArgs(row: ShareEntry): Record<string, unknown> {
  return {
    slug: row.slug, kind: row.kind, read: row.read, write: row.write,
    ...(row.workspace ? { workspace: row.workspace } : {}), ...(row.owner ? { owner: row.owner } : {}), ...(row.note ? { note: row.note } : {}),
  };
}

/** How long a share verb's read-back keeps asking the vessel for the landing's receipt once the local wait ends. */
export const SHARE_READBACK_MS = 180_000;

/** What the read-back reaches: the vessel's receipt by request id, a pause between reads, a clock, and a line to the person. */
export interface ReadBackPorts {
  readonly receipt: (requestId: string) => Promise<ReceiptAnswer>;
  readonly pause: (ms: number) => Promise<void>;
  readonly now: () => number;
  readonly patienceMs?: number;
  readonly note?: (line: string) => void;
}

/**
 * A LOCAL WAIT ENDING NAMES NO OUTCOME (`LocalWaitExpired`, the idiom `act.ts` keeps): the vessel took the verb and this process
 * stopped hearing. A share landing founds a realm and seats faces, and may outrun the wait; so the door reads the landing's own
 * receipt by the SAME request id until the vessel answers `done` or `error`, and never dispatches the verb again. A vessel that
 * abandoned, interrupted or evicted the request says so by name; a landing still running when the patience ends names the
 * receipt door (`lares vessel request <id>`).
 */
export async function readBackOnExpiry(verb: string, run: () => Promise<SubmitResult>, ports: ReadBackPorts): Promise<SubmitResult> {
  try { return await run(); }
  catch (err) {
    if (!(err instanceof LocalWaitExpired)) throw err;
    const id = err.requestId, patience = ports.patienceMs ?? SHARE_READBACK_MS, started = ports.now();
    ports.note?.(`  ${verb} still lands in the vessel; reading its receipt (request ${id})…`);
    for (;;) {
      const r = await ports.receipt(id).catch((): ReceiptAnswer => ({ requestId: id, state: "unanswered" }));
      if (r.state === "done" || r.state === "error") {
        return { status: r.state, requestId: id, ...(r.results !== undefined ? { results: r.results as NonNullable<SubmitResult["results"]> } : {}), ...(r.errorMessage !== undefined ? { errorMessage: r.errorMessage } : {}) };
      }
      if (r.state === "abandoned" || r.state === "interrupted") throw new Error(`request-${r.state}: the vessel ${r.state} ${verb} (request ${id}); run it again`);
      if (r.state === "evicted") throw new Error(`retention-gap: the vessel no longer holds the outcome of ${verb} (request ${id})`);
      if (ports.now() - started >= patience) throw new Error(`${verb} still lands after ${Math.round(patience / 1000)}s of reading its receipt; read its outcome with \`lares vessel request ${id}\``);
      await ports.pause(1_000);
    }
  }
}

const LIVE_READBACK: ReadBackPorts = {
  receipt: (id) => queryReceipt(id, { patienceMs: 2_000 }),
  pause: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => performance.now(),
  note: (line) => console.error(line),
};


/** How long a landing's session call waits for its answer: a landing founds a realm and seats faces, so it outlasts the usual wait. */
export const LANDING_WAIT_MS = 600_000;

/** One session of a face, as a landing reaches it. */
export interface FaceSession {
  call(verb: string, args: Record<string, unknown>, opts?: { timeoutMs?: number }): Promise<Record<string, unknown>>;
  receipt(requestId: string): Promise<{ readonly state: string; readonly outcome?: Readonly<Record<string, unknown>> }>;
  close(): Promise<void>;
}
/** Open a session of face `h<N>`; a vessel's refusal throws `SessionRefused`, no socket `UdsUnreachable`. */
export type OpenFaceSession = (face: number) => Promise<FaceSession>;
export interface LandingPorts { readonly pause: (ms: number) => Promise<void>; readonly now: () => number; readonly patienceMs?: number; readonly note?: (line: string) => void }

const liveFaceSession: OpenFaceSession = (face) => openLocalSession({ faceRef: `h${face}`, hand: "cli" });
const LIVE_LANDING: LandingPorts = { pause: (ms) => new Promise((r) => setTimeout(r, ms)), now: () => performance.now(), note: (line) => console.error(line) };

/**
 * RUN ONE LANDING ON A FACE'S SESSION AND KEEP THE SESSION OPEN TO ITS END: the sign booking the owner's holder reads lives as long
 * as the session, so a local wait that ends reads the landing's receipt through THIS session (the vessel scopes the request id to
 * the face) before the session closes, and never closes it mid-landing. A shut or closing face answers `face-not-open`, which the
 * caller meets by the one-shot; every other refusal keeps its own name.
 */
export async function landOnFaceSession(open: OpenFaceSession, verb: string, args: Record<string, unknown>, face: number, ports: LandingPorts): Promise<SubmitResult> {
  let session: FaceSession;
  try { session = await open(face); }
  catch (e) {
    if (e instanceof UdsUnreachable) throw new DaemonUnreachable(udsSocketPath());
    if (e instanceof SessionRefused) return refusedLanding(face, e.refusal);
    throw e;
  }
  try {
    try {
      const { kind: _kind, ...rest } = await session.call(verb, args, { timeoutMs: LANDING_WAIT_MS });
      return rest as unknown as SubmitResult;
    } catch (e) {
      if (e instanceof SessionRefused) return refusedLanding(face, e.refusal);
      if (!(e instanceof LocalWaitExpired)) throw e;
      const id = e.requestId, patience = ports.patienceMs ?? SHARE_READBACK_MS, started = ports.now();
      ports.note?.(`  ${verb} still lands in the vessel; reading its receipt (request ${id})…`);
      for (;;) {
        const r = await session.receipt(id).catch(() => ({ state: "unknown" } as { state: string; outcome?: Readonly<Record<string, unknown>> }));
        if (r.state === "done" || r.state === "error") {
          const out = (r.outcome ?? {}) as { results?: SubmitResult["results"]; errorMessage?: string };
          return { status: r.state, requestId: id, ...(out.results !== undefined ? { results: out.results } : {}), ...(out.errorMessage !== undefined ? { errorMessage: out.errorMessage } : {}) };
        }
        if (r.state === "abandoned" || r.state === "interrupted") throw new Error(`request-${r.state}: the vessel ${r.state} ${verb} (request ${id}); run it again`);
        if (r.state === "evicted") throw new Error(`retention-gap: the vessel no longer holds the outcome of ${verb} (request ${id})`);
        if (ports.now() - started >= patience) throw new Error(`${verb} still lands after ${Math.round(patience / 1000)}s of reading its receipt; run the same \`lares wiki share\` line again; the session's receipt for request ${id} closes with this session`);
        await ports.pause(1_000);
      }
    }
  } finally { await session.close().catch(() => { /* the socket already went */ }); }
}

/** A session's refusal, kept by name; only a shut or closing face reads `face-not-open`. */
function refusedLanding(face: number, refusal: string): SubmitResult {
  const shut = /^(face-not-open|face-closing)/.test(refusal);
  return {
    status: "error", requestId: "",
    errorMessage: shut ? `face-not-open: face h${face} stands shut on this vessel (${refusal}); nothing ran` : `${refusal}: the vessel refused this landing on face h${face}'s session; nothing ran${/-needs-hand$/.test(refusal) ? "; the shares land by a person's hand: run `lares wiki share` (or `lares wear ${face}`) at a terminal outside any agent harness" : ""}`,
    refusal: { reason: shut ? "face-not-open" : refusal },
  };
}

export const LIVE_SHARE_DOORS: ShareDoors = {
  faces: async () => {
    const petnames = makeFleetPetnameStore(sealedPetnameStore());
    const out: ShareFace[] = [];
    for (const { handleIndex } of (await readPersonaRoots()).roots) out.push({ handleIndex, petname: (await petnames.get(handleIndex)) ?? null });
    return out;
  },
  file: {
    read: () => (existsSync(shareFilePath()) ? readFileSync(shareFilePath(), "utf8") : null),
    write: (text) => {
      mkdirSync(larConfigHome(), { recursive: true });
      const tmp = `${shareFilePath()}.tmp`;
      writeFileSync(tmp, text, { mode: 0o600 });
      renameSync(tmp, shareFilePath());
    },
  },
  verb: async (name, args) => {
    try {
      const did = await vesselDid();
      // THE LANDING RIDES THE WORN FACE'S SESSION: a landing that seats a face hands it a lockbox from the realm owner's holder, and
      // that holder signs only under the session the ask books (a one-shot line books none, so it reads `signer-unavailable`).
      const worn = name === "share-apply" ? await sealedAct<{ face: number }>("face.resolve", { worn: true }).then((f) => f.face, () => null) : null;
      const oneShot = () => readBackOnExpiry(name, () => runVerb(name, args, did), LIVE_READBACK);
      let r: SubmitResult;
      if (worn === null) r = await oneShot();
      else {
        r = await landOnFaceSession(liveFaceSession, name, args, worn, LIVE_LANDING);
        if (r.refusal?.reason === "face-not-open") r = await oneShot();
      }
      if (r.status === "error") throw new Error(r.errorMessage ?? `${name} refused`);
      return (summaryOutput(r) ?? {}) as Record<string, unknown>;
    } catch (e) {
      if (/daemon-unreachable|ECONNREFUSED|ENOENT|no vessel/i.test(e instanceof Error ? e.message : String(e))) return null;
      throw e;
    }
  },
  out: (line) => console.log(line),
  err: (line) => console.error(line),
};


/**
 * THE OPERATOR'S HAND LANDS THE SHARES (`share-apply`): each lit grantee takes a shared bag's row by reference and a delegation
 * from its owner's hive; a grant whose face stands shut waits behind an opaque flag. Null where no vessel answers.
 */
export async function landShares(doors: Pick<ShareDoors, "verb">, faces: readonly ShareFace[], extra?: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  return doors.verb("share-apply", { faces: faces.map((f) => ({ handleIndex: f.handleIndex, petname: f.petname })), ...(extra ?? {}) });
}
