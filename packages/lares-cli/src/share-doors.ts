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
import { SHARE_CONFIG_FILE, type ShareFace } from "@lararium/mesh";
import { vesselDid } from "./env.js";
import { runVerb } from "./verb-call.js";
import { summaryOutput, type SubmitResult } from "./verb-result.js";
import { LocalWaitExpired, queryReceipt, type ReceiptAnswer } from "./local-connector.js";
import { readPersonaRoots, sealedPetnameStore } from "./sealed-rows.js";
import { makeFleetPetnameStore } from "./daemon-persona-store.js";

/** The doors the share door reaches, injectable so a test drives it with no vessel. */
export interface ShareDoors {
  readonly faces: () => Promise<readonly ShareFace[]>;
  readonly file: { read(): string | null; write(text: string): void };
  /** Ask the standing vessel; null where none answers. */
  readonly verb: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

const shareFilePath = (): string => join(larConfigHome(), SHARE_CONFIG_FILE);

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
 * receipt door (`lares receipt <id>`).
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
      if (ports.now() - started >= patience) throw new Error(`${verb} still lands after ${Math.round(patience / 1000)}s of reading its receipt; read its outcome with \`lares receipt ${id}\``);
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
      const r = await readBackOnExpiry(name, () => runVerb(name, args, did), LIVE_READBACK);
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
export async function landShares(doors: Pick<ShareDoors, "verb">, faces: readonly ShareFace[]): Promise<Record<string, unknown> | null> {
  return doors.verb("share-apply", { faces: faces.map((f) => ({ handleIndex: f.handleIndex, petname: f.petname })) });
}
