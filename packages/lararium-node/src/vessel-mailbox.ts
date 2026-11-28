/**
 * vessel-mailbox — the durable mailbox of the lane law (§7): ONE sealed custody row on this vessel, never a document.
 *
 * A verb addressed to an island that isn't live PARKS in the vessel's own custody row (`mailbox`, sealed under the device
 * key, hot), keyed by island identity; the island's next `ea` (its own breath declaration) drains it — deliver-to-IDENTITY:
 * the message survives the island and the process, and arrives when the identity breathes again. A delivered verb LEAVES
 * the row in a read-decide-write after its delivery, so the row holds only what still waits: no Repo announces it, no
 * fleet syncs it, and no history accumulates behind it.
 *
 * A locked custody refuses by its own name (`CustodyLocked`) at the park or the drain: the floor parks nothing in memory
 * waiting for a key. A malformed row reads as no parked verb, and the next park starts the row afresh.
 *
 * Lane law: this rides the merge seat. Nothing here touches workers or ports — the caller supplies `placeVerb` (its own
 * live-delivery path). Node-main only: the row door (`custody-seat`) never runs in a worker.
 */
import { readCustodyRecord, updateCustodyRecord } from "./custody-seat.js";

/** The custody row the mailbox rests in (identity home, hot, sealed under the device key). */
export const MAILBOX_FILE = "mailbox.json";

export interface MailboxVerb {
  readonly verb:        string;
  readonly args:        Record<string, unknown>;
  readonly requestedBy: string;
}

/** One parked verb as the row keeps it. */
export interface ParkedVerb extends MailboxVerb {
  readonly id:     string;
  readonly wikiId: string;
}

export interface DurableMailbox {
  /** Park a verb for a non-live island — durably, visibly, never silently. */
  park(wikiId: string, v: MailboxVerb): Promise<void>;
  /** Deliver every parked verb for this island; a delivered verb leaves the row, a failed one stays parked. */
  drain(wikiId: string): Promise<void>;
  /** What the row holds now, oldest first. */
  parked(): Promise<readonly ParkedVerb[]>;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function parse(bytes: Uint8Array | null): ParkedVerb[] {
  if (bytes === null) return [];
  try {
    const read = JSON.parse(dec.decode(bytes)) as unknown;
    if (!Array.isArray(read)) return [];
    return read.filter((p): p is ParkedVerb => typeof p === "object" && p !== null
      && typeof (p as ParkedVerb).id === "string" && typeof (p as ParkedVerb).wikiId === "string" && typeof (p as ParkedVerb).verb === "string");
  } catch { return []; }
}

const rewrite = (rows: readonly ParkedVerb[]): Uint8Array => enc.encode(JSON.stringify(rows));

export function makeDurableMailbox(
  placeVerb: (wikiId: string, v: MailboxVerb) => Promise<unknown>,
  log: (line: string) => void = () => {},
): DurableMailbox {
  // One row change at a time in this process: a park never lands between a drain's read and its removal.
  let turn: Promise<unknown> = Promise.resolve();
  const inTurn = <T>(act: () => Promise<T>): Promise<T> => { const run = turn.then(act, act); turn = run.catch(() => undefined); return run; };
  return {
    park: (wikiId, v) => inTurn(async () => {
      const row: ParkedVerb = { id: crypto.randomUUID(), wikiId, verb: v.verb, args: v.args, requestedBy: v.requestedBy };
      await updateCustodyRecord("identity", MAILBOX_FILE, (plaintext) => ({ plaintext: rewrite([...parse(plaintext), row]), value: undefined }));
      log(`[mailbox] parked ${v.verb} for ${wikiId} (island not live)`);
    }),

    drain: (wikiId) => inTurn(async () => {
      const waiting = parse(await readCustodyRecord("identity", MAILBOX_FILE)).filter((p) => p.wikiId === wikiId);
      for (const p of waiting) {
        try { await placeVerb(wikiId, { verb: p.verb, args: p.args, requestedBy: p.requestedBy || "mailbox" }); }
        catch { continue; /* island died mid-drain — the verb stays parked for the next ea */ }
        await updateCustodyRecord("identity", MAILBOX_FILE, (plaintext) => {
          const standing = parse(plaintext);
          const kept = standing.filter((s) => s.id !== p.id);
          return { plaintext: kept.length === standing.length ? null : rewrite(kept), value: undefined };
        });
        log(`[mailbox] delivered ${p.verb} to ${wikiId}`);
      }
    }),

    parked: async () => parse(await readCustodyRecord("identity", MAILBOX_FILE)),
  };
}
