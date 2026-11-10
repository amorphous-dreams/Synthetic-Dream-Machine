/**
 * carriage-log — the PLACE'S PUBLIC CARRIAGE LOG: an append-only record of what this place carried, one signed receipt per
 * carriage, on the place's public floor.
 *
 * WHAT IT ANSWERS. "Did you carry X?" A place answers from its own log and from nothing else: a receipt stands for X, or
 * none does. Tending emits a POSITIVE receipt (lamplighters#/the-herm-cannot-witness-its-own-neglect): presence proofs stay
 * cheap and unforgeable, and the log never claims an absence.
 *
 * KEYED BY THE CARRIAGE, NEVER BY A CLOCK. Each receipt names the carriage by its own content or causal id (a ciphertext's
 * cid, a persona-KEL event's cid), so the same carriage taken twice, replayed, or taken again after a restart finds its
 * receipt standing and appends nothing. No counter and no timestamp rides a receipt: neither orders anything two places share.
 *
 * SIGNED UNDER THE PLACE'S OWN KEY. A herm signs its local-carry statements under its own single key
 * (lamplighters#/under-every-lararium): each receipt is a floor duty of the place signer (`CARRIAGE_RECEIPT_DOMAIN`), framed as
 * every floor duty frames, so a receipt never verifies as any other duty, nor another duty as a receipt.
 *
 * FLOOR CANON, NEVER A CONTROL DOCUMENT. The log rests UNSEALED: it names carriage ids and the place key alone, never a peer,
 * a payload or any operator-private content. Every place keeps one, herm and hearth alike (one floor, no second kind of Herm,
 * waking-floor#/the-breaks). A journal the platform supplies keeps it durable; a receipt joins the log only once its journal
 * line landed, so a log never answers "carried" for a receipt a restart would lose.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/lamplighters#/the-carriage-log
 */
import { canonicalJsonBytes } from "./crypto.js";
import { CARRIAGE_RECEIPT_DOMAIN } from "./domains.js";
import { frameFloorDuty, verifyPlaceDuty, type PlaceSigner } from "./place-signer.js";

/** The carriage lanes a place logs: a persona-KEL successor drop it kept, a sealed ciphertext block it served. */
export const CARRIAGE_LANES = ["persona-kel-drop", "cas-block"] as const;
export type CarriageLane = (typeof CARRIAGE_LANES)[number];

/** One positive receipt: this place carried this carriage on this lane. */
export interface CarriageReceipt {
  readonly kind:     typeof CARRIAGE_RECEIPT_DOMAIN;
  /** The carriage's own content or causal id. */
  readonly carriage: string;
  readonly lane:     CarriageLane;
  /** The place signer's key (lowercase hex) the receipt signs under. */
  readonly place:    string;
  /** The place signer's signature over the framed image (hex). */
  readonly sig:      string;
}

/** A carriage id: a content or causal address, never free text. */
const CARRIAGE_ID_RE = /^[A-Za-z0-9:._-]{1,256}$/;
const KEY_RE = /^[0-9a-f]{64}$/;

export class CarriageLogRefused extends Error {
  override readonly name = "CarriageLogRefused";
  constructor(why: string) { super(`carriage-log-refused: ${why}`); }
}

/** The framed image a receipt signs: the duty's domain at byte zero, then the receipt's fields. */
export function carriageReceiptImage(parts: { readonly carriage: string; readonly lane: CarriageLane; readonly place: string }): Uint8Array {
  return frameFloorDuty(CARRIAGE_RECEIPT_DOMAIN, canonicalJsonBytes({
    kind: CARRIAGE_RECEIPT_DOMAIN, carriage: parts.carriage, lane: parts.lane, place: parts.place,
  }));
}

/** Sign one receipt under the place signer. The module holds no key. */
export async function signCarriageReceipt(signer: PlaceSigner, carriage: string, lane: CarriageLane): Promise<CarriageReceipt> {
  if (!CARRIAGE_ID_RE.test(carriage)) throw new CarriageLogRefused("a carriage id names a content or causal address");
  if (!CARRIAGE_LANES.includes(lane)) throw new CarriageLogRefused(`${String(lane)} names no carriage lane`);
  const place = signer.key.toLowerCase();
  const sig = await signer.signFloor(CARRIAGE_RECEIPT_DOMAIN, carriageReceiptImage({ carriage, lane, place }));
  return { kind: CARRIAGE_RECEIPT_DOMAIN, carriage, lane, place, sig };
}

/** Read a receipt off untrusted bytes: it verifies under the key it names, or reads as nothing. */
export function readCarriageReceipt(raw: unknown): CarriageReceipt | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r["kind"] !== CARRIAGE_RECEIPT_DOMAIN) return null;
  const { carriage, lane, place, sig } = r;
  if (typeof carriage !== "string" || !CARRIAGE_ID_RE.test(carriage)) return null;
  if (typeof lane !== "string" || !(CARRIAGE_LANES as readonly string[]).includes(lane)) return null;
  if (typeof place !== "string" || !KEY_RE.test(place) || typeof sig !== "string") return null;
  const receipt: CarriageReceipt = { kind: CARRIAGE_RECEIPT_DOMAIN, carriage, lane: lane as CarriageLane, place, sig };
  try {
    return verifyPlaceDuty({ domain: CARRIAGE_RECEIPT_DOMAIN, image: carriageReceiptImage(receipt), sig, signerKey: place }) ? receipt : null;
  } catch { return null; }
}

/** Where a log rests: the platform's durable, append-only journal. `append` throws where the line did not land. */
export interface CarriageLogJournal {
  load(): readonly unknown[];
  append(receipt: CarriageReceipt): void;
}

export interface CarriageLog {
  /** The key the log signs new receipts under. */
  readonly place: string;
  /**
   * Log one carriage: the receipt standing for `carriage` where one stands (nothing appends), else a fresh receipt signed,
   * journaled, then kept. A journal that refuses the line keeps nothing and the call refuses.
   */
  carry(carriage: string, lane: CarriageLane): Promise<CarriageReceipt>;
  /** Did this place carry `carriage`? Its receipt, or null. */
  carried(carriage: string): CarriageReceipt | null;
  /** Every receipt, in the order the log took them. */
  receipts(): readonly CarriageReceipt[];
}

/**
 * Stand a place's carriage log over its journal. Reading the journal back verifies every line under the key it names and
 * keeps it only where that key stands as one of this place's signers (`signedByPlace`, default: the signer's own key): a
 * torn line, a forged line and a line under a stranger's key file nothing. The first receipt per carriage stands.
 */
export function makeCarriageLog(opts: {
  readonly signer: PlaceSigner;
  readonly journal?: CarriageLogJournal;
  readonly signedByPlace?: (key: string) => boolean;
}): CarriageLog {
  const place = opts.signer.key.toLowerCase();
  const ours = opts.signedByPlace ?? ((key: string) => key === place);
  const byCarriage = new Map<string, CarriageReceipt>();
  for (const raw of opts.journal?.load() ?? []) {
    const receipt = readCarriageReceipt(raw);
    if (receipt && ours(receipt.place) && !byCarriage.has(receipt.carriage)) byCarriage.set(receipt.carriage, receipt);
  }
  // ONE WRITER: two takes of one carriage in flight sign and journal it once.
  let turn: Promise<unknown> = Promise.resolve();
  return {
    place,
    carry(carriage, lane) {
      const run = turn.then(async () => {
        const standing = byCarriage.get(carriage);
        if (standing) return standing;
        const receipt = await signCarriageReceipt(opts.signer, carriage, lane);
        opts.journal?.append(receipt);
        byCarriage.set(carriage, receipt);
        return receipt;
      });
      turn = run.catch(() => { /* the caller reads the refusal; the next take still runs */ });
      return run;
    },
    carried: (carriage) => byCarriage.get(carriage) ?? null,
    receipts: () => [...byCarriage.values()],
  };
}
